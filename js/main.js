import { PhysicsEngine } from './physics.js';
import { Renderer } from './renderer.js';
import { UIManager } from './ui.js';
import { runBrowserTest } from './test-runner.js';
// WorkerBridge is available as an opt-in performance upgrade for high body-counts (>150).
// To enable offloaded physics: import { WorkerBridge } from './workerBridge.js';
// See js/workerBridge.js and js/physicsWorker.js for the full pipeline.

// Global simulation variables
let physics;
let renderer;
let ui;

// Loop and Fixed Timestep Variables
const fixedDt = 1 / 60; // 60 updates per second for physics determinism
let accumulator = 0;
let lastTime = 0;

// FPS tracking variables
let fps = 60;
const fpsSmoothing = 0.95; // Smoothing factor for FPS rolling average
let lastFpsUpdateTime = 0;

/**
 * Initialize all modules and begin simulation loop
 */
function init() {
    const canvas = document.getElementById('physics-canvas');
    if (!canvas) {
        console.error("Canvas element '#physics-canvas' not found.");
        return;
    }

    // 1. Initialize Physics Engine (Gravity = 0.15, Core Mass = 100,000)
    physics = new PhysicsEngine(0.15, 100000);

    // 2. Initialize Renderer
    renderer = new Renderer(canvas, physics);

    // 3. Initialize UI & Event Handlers
    ui = new UIManager(physics, renderer);

    // 4. Force first layout calculation to center the Core
    renderer.resize();

    // 5. Spawn initial orbital ring
    ui.spawnInitialOrbitalRing();
    ui.addTerminalLog("Orbital sectors active. Standard circular rings deployed.", "system-line");

    // Launch automated browser diagnostics
    runBrowserTest(physics, ui, renderer);

    // 6. Bind resize event
    window.addEventListener('resize', () => {
        renderer.resize();
        ui.addTerminalLog("Sector boundaries recalibrated.", "warning-line");
    });

    // 7. Request first frame
    lastTime = performance.now();
    lastFpsUpdateTime = lastTime;
    requestAnimationFrame(loop);
}

/**
 * Deterministic Simulation Loop
 * Separates fixed-step physics updates from variable-step render frames
 */
function loop(currentTime) {
    // 1. Calculate frame time delta (in seconds)
    let frameTime = (currentTime - lastTime) / 1000;
    lastTime = currentTime;

    // Cap frameTime to prevent "spiral of death" during major lag spikes or tab switching
    if (frameTime > 0.25) {
        frameTime = 0.25;
    }

    // 2. Rolling average for FPS stat readout
    if (frameTime > 0) {
        const currentFps = 1.0 / frameTime;
        fps = fps * fpsSmoothing + currentFps * (1.0 - fpsSmoothing);
    }

    // 3. Accumulate elapsed time for fixed physics step updates
    if (!ui.isPaused && !physics.isGameOver) {
        accumulator += frameTime;
        
        // Update physics deterministically in fixed-size intervals
        // TODO: integrate WorkerBridge for offloaded physics
        // Replace: physics.update(fixedDt) → bridge.tick(fixedDt, { G, coreMass, coreX, coreY })
        // then reconcile returned body POJOs back into physics.asteroids via bridge.onFrame.
        while (accumulator >= fixedDt) {
            physics.update(fixedDt);
            accumulator -= fixedDt;
        }
    } else {
        // Clear accumulator if paused or game over to prevent rapid catch-up steps
        accumulator = 0;
    }

    // 4. Render current state
    renderer.draw();

    // 5. Draw active dragging vectors/predictions
    ui.drawDragPreview();

    // 6. Update HUD display stats (cap DOM updates to 10 times per second for optimization)
    if (currentTime - lastFpsUpdateTime > 100) {
        ui.updateStats(fps);
        ui.updateTooltipPosition(ui.mousePos.x + canvasRectOffset().left, ui.mousePos.y + canvasRectOffset().top);
        lastFpsUpdateTime = currentTime;
    }

    // 7. Queue next frame
    requestAnimationFrame(loop);
}

// Helper to find client rectangle of canvas dynamically for tooltip updates
function canvasRectOffset() {
    const canvas = document.getElementById('physics-canvas');
    if (!canvas) return { left: 0, top: 0 };
    return canvas.getBoundingClientRect();
}

// Kick off initialization once DOM is loaded
window.addEventListener('DOMContentLoaded', init);
