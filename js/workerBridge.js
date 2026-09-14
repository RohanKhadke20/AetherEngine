/**
 * workerBridge.js — Clean message-passing bridge over the physics Web Worker.
 *
 * WorkerBridge wraps physicsWorker.js and exposes a minimal API so the DOM-thread
 * game loop can optionally offload the N-body gravitational kernel:
 *
 *   const bridge = new WorkerBridge();
 *   bridge.onFrame = (bodies) => { ... reconcile with PhysicsEngine ... };
 *   bridge.init(serialisedBodies, { G: 0.15, coreMass: 100000, coreX, coreY });
 *   // Inside requestAnimationFrame loop:
 *   bridge.tick(fixedDt);
 *
 * Body POJO format (serialisable, no class instances):
 *   { id, px, py, vx, vy, ax, ay, mass, radius, destroyed }
 *
 * Fallback: if Web Workers are unavailable (e.g. file:// without a server),
 * WorkerBridge becomes a no-op and physics continues on the DOM thread unchanged.
 */

import { logger } from './logger.js';

export class WorkerBridge {
  constructor() {
    /** @type {Worker|null} */
    this.worker = null;

    /**
     * Frame callback — set by the consumer before calling init().
     * Invoked with the updated body POJO array each time a FRAME message arrives.
     * @type {((bodies: object[]) => void)|null}
     */
    this.onFrame = null;

    /** @private */
    this._ready = false;
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Spin up the physics worker and send initial body state.
   *
   * @param {object[]} bodies - Serialisable body POJOs (see format above)
   * @param {{ G?: number, coreMass?: number, coreX?: number, coreY?: number }} opts
   */
  init(bodies, opts = {}) {
    if (typeof Worker === 'undefined') {
      logger.warn('[WorkerBridge] Web Workers not available — running physics on DOM thread');
      return;
    }

    try {
      this.worker = new Worker(
        new URL('./physicsWorker.js', import.meta.url),
        { type: 'module' }
      );
    } catch (err) {
      logger.error('[WorkerBridge] Failed to construct Worker', { message: String(err) });
      return;
    }

    this.worker.onmessage = ({ data }) => this._handleMessage(data);

    this.worker.onerror = (e) => {
      logger.error('[WorkerBridge] Physics Worker runtime error', {
        message: e.message,
        filename: e.filename,
        lineno: e.lineno,
      });
    };

    this.worker.postMessage({
      cmd: 'INIT',
      bodies,
      G:        opts.G        ?? 0.15,
      coreMass: opts.coreMass ?? 100000,
      coreX:    opts.coreX   ?? 0,
      coreY:    opts.coreY   ?? 0,
    });

    logger.info('[WorkerBridge] Worker initialised', { bodyCount: bodies.length });
  }

  /**
   * Send a TICK command to the worker for one physics step.
   * The result arrives asynchronously via the onFrame callback.
   *
   * @param {number} dt      - Fixed timestep (seconds)
   * @param {{ G?: number, coreMass?: number, coreX?: number, coreY?: number }} opts
   */
  tick(dt, opts = {}) {
    if (!this.worker || !this._ready) return;
    this.worker.postMessage({ cmd: 'TICK', dt, ...opts });
  }

  /**
   * Gracefully shut down the worker.
   * Safe to call multiple times.
   */
  terminate() {
    if (this.worker) {
      this.worker.postMessage({ cmd: 'TERMINATE' });
      // Belt-and-suspenders: force-terminate after 200 ms in case the worker is stuck
      setTimeout(() => {
        if (this.worker) {
          this.worker.terminate();
          this.worker = null;
          this._ready = false;
          logger.info('[WorkerBridge] Worker force-terminated');
        }
      }, 200);
    }
  }

  /** True once the worker has posted its READY acknowledgement. */
  get isReady() {
    return this._ready;
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  /**
   * @param {{ cmd: string, bodies?: object[] }} data
   * @private
   */
  _handleMessage(data) {
    switch (data.cmd) {
      case 'READY':
        this._ready = true;
        logger.info('[WorkerBridge] Worker ready');
        break;

      case 'FRAME':
        if (typeof this.onFrame === 'function') {
          this.onFrame(data.bodies);
        }
        break;

      default:
        logger.warn('[WorkerBridge] Unexpected message from worker', { cmd: data.cmd });
    }
  }
}
