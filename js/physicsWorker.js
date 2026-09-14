/**
 * physicsWorker.js — Self-contained Web Worker for N-body gravitational physics.
 *
 * This worker replicates the core integration loop from PhysicsEngine.update() without
 * any DOM dependencies. It handles three commands:
 *   INIT     → store bodies, post READY
 *   TICK     → run one Euler integration step, post FRAME with updated bodies
 *   TERMINATE→ gracefully close the worker
 *
 * Body objects exchanged over postMessage are plain serialisable POJOs:
 *   { id, px, py, vx, vy, ax, ay, mass, radius, destroyed }
 *
 * Design note: We intentionally avoid SharedArrayBuffer here so the bridge works
 * in environments where cross-origin isolation is not configured. SharedArrayBuffer
 * can be layered on later as a zero-copy optimisation.
 */

import { logger } from './logger.js';

// ─── State ────────────────────────────────────────────────────────────────────

/** @type {BodyPOJO[]} */
let bodies = [];

/** Physics constants — initialised via INIT */
let G = 0.15;
let coreMass = 100000;
let coreX = 0;
let coreY = 0;

/** Softening constant (must match PhysicsEngine.softeningFactor = 15) */
const SOFTENING = 15.0;
const EPSILON_SQ = SOFTENING * SOFTENING; // 225

// ─── Message handler ─────────────────────────────────────────────────────────

self.onmessage = ({ data }) => {
  switch (data.cmd) {
    case 'INIT': {
      bodies   = data.bodies   ?? [];
      G        = data.G        ?? 0.15;
      coreMass = data.coreMass ?? 100000;
      coreX    = data.coreX   ?? 0;
      coreY    = data.coreY   ?? 0;
      logger.info('[Worker] Physics worker initialized', { bodyCount: bodies.length, G, coreMass });
      self.postMessage({ cmd: 'READY' });
      break;
    }

    case 'TICK': {
      const dt = data.dt ?? (1 / 60);
      // Accept per-tick overrides (e.g. if user moves slider)
      if (data.G        !== undefined) G        = data.G;
      if (data.coreMass !== undefined) coreMass = data.coreMass;
      if (data.coreX    !== undefined) coreX    = data.coreX;
      if (data.coreY    !== undefined) coreY    = data.coreY;

      bodies = runPhysicsStep(bodies, dt);
      self.postMessage({ cmd: 'FRAME', bodies });
      break;
    }

    case 'TERMINATE': {
      logger.info('[Worker] Terminating physics worker');
      self.close();
      break;
    }

    default:
      logger.warn('[Worker] Unknown command received', { cmd: data.cmd });
  }
};

// ─── Core N-body integration step ────────────────────────────────────────────

/**
 * Run one Euler integration step replicating PhysicsEngine.update() gravity
 * and integration sections (sections 1 & 2 of physics.js update()).
 *
 * Anti-gravity emitter and structural-link logic require full engine state and
 * are intentionally omitted — this worker handles the hot N-body gravitational
 * kernel only. The full PhysicsEngine instance on the DOM thread handles the
 * remaining game logic.
 *
 * @param {BodyPOJO[]} inputBodies - Plain-object body list from DOM thread
 * @param {number}     dt          - Fixed timestep (seconds)
 * @returns {BodyPOJO[]} Updated body list (new array, safe to postMessage)
 */
function runPhysicsStep(inputBodies, dt) {
  const n = inputBodies.length;

  // Work with flat typed representation for speed; we'll map back at the end.
  // Using individual arrays avoids object allocation overhead in the hot loop.
  const px  = new Float64Array(n);
  const py  = new Float64Array(n);
  const vx  = new Float64Array(n);
  const vy  = new Float64Array(n);
  const ax  = new Float64Array(n);
  const ay  = new Float64Array(n);
  const mass = new Float64Array(n);
  const destroyed = new Uint8Array(n);

  // Unpack input bodies
  for (let i = 0; i < n; i++) {
    const b = inputBodies[i];
    px[i]  = b.px;
    py[i]  = b.py;
    vx[i]  = b.vx;
    vy[i]  = b.vy;
    ax[i]  = 0; // reset acceleration each step
    ay[i]  = 0;
    mass[i]      = b.mass;
    destroyed[i] = b.destroyed ? 1 : 0;
  }

  // ── 1. Core gravity on each asteroid ───────────────────────────────────────
  // F = G * M_core * m / (r² + ε²),  a = F / m = G * M_core / (r² + ε²)
  for (let i = 0; i < n; i++) {
    if (destroyed[i]) continue;

    const dx = coreX - px[i];
    const dy = coreY - py[i];
    const distSq = dx * dx + dy * dy;
    const dist   = Math.sqrt(distSq);

    if (dist > 0) {
      // Acceleration magnitude (Newton + softening)
      const aMag = (G * coreMass) / (distSq + EPSILON_SQ);
      // Unit vector toward core, scaled by acceleration
      ax[i] += (dx / dist) * aMag;
      ay[i] += (dy / dist) * aMag;
    }
  }

  // ── 2. Mutual asteroid-to-asteroid gravity ──────────────────────────────────
  // a_i += G * m_j / (r² + ε²) * unit(j→i)
  for (let i = 0; i < n; i++) {
    if (destroyed[i]) continue;
    for (let j = i + 1; j < n; j++) {
      if (destroyed[j]) continue;

      const dx = px[j] - px[i];
      const dy = py[j] - py[i];
      const distSq = dx * dx + dy * dy;
      const dist   = Math.sqrt(distSq);

      if (dist > 0) {
        // Force magnitude (not divided by mass yet — stored as F/m below)
        const fMag = (G * mass[i] * mass[j]) / (distSq + EPSILON_SQ);

        // Acceleration on i toward j:  a = F / m_i
        ax[i] += (dx / dist) * (fMag / mass[i]);
        ay[i] += (dy / dist) * (fMag / mass[i]);

        // Equal-and-opposite on j toward i: a = F / m_j
        ax[j] -= (dx / dist) * (fMag / mass[j]);
        ay[j] -= (dy / dist) * (fMag / mass[j]);
      }
    }
  }

  // ── 3. Euler integration: update velocities and positions ──────────────────
  for (let i = 0; i < n; i++) {
    if (destroyed[i]) continue;
    vx[i] += ax[i] * dt;
    vy[i] += ay[i] * dt;
    px[i] += vx[i] * dt;
    py[i] += vy[i] * dt;
  }

  // ── 4. Pack updated bodies back into POJO array ────────────────────────────
  const result = new Array(n);
  for (let i = 0; i < n; i++) {
    // Preserve all non-physics fields from input (id, radius, color, trail…)
    result[i] = {
      ...inputBodies[i],
      px: px[i],
      py: py[i],
      vx: vx[i],
      vy: vy[i],
      // ax/ay exposed for telemetry if needed
      ax: ax[i],
      ay: ay[i],
    };
  }
  return result;
}
