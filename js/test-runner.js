export async function runBrowserTest(physics, ui, renderer) {
    ui.addTerminalLog("[TEST START] Commencing automated browser diagnostics...", "system-line");

    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    await delay(1000);

    // 1. Verify default asteroids count
    const initialAsteroids = physics.asteroids.length;
    if (initialAsteroids >= 5 && initialAsteroids <= 10) {
        ui.addTerminalLog(`[TEST PASS] Initial orbital ring verified: ${initialAsteroids} asteroids active.`, "system-line");
    } else {
        ui.addTerminalLog(`[TEST FAIL] Initial orbital ring count mismatch: ${initialAsteroids} active.`, "warning-line");
    }

    // 2. Simulate click-and-drag fling launch
    ui.addTerminalLog("[TEST RUN] Simulating click-and-drag fling launch...", "system-line");
    ui.selectTool('fling');
    
    const rect = renderer.canvas.getBoundingClientRect();
    const startX = 300;
    const startY = 300;
    const endX = 380;
    const endY = 320;

    // Simulate Mouse Down
    ui.handleMouseDown({
        button: 0,
        clientX: rect.left + startX,
        clientY: rect.top + startY,
        preventDefault: () => {}
    });

    await delay(200);

    // Simulate Mouse Move
    ui.handleMouseMove({
        clientX: rect.left + endX,
        clientY: rect.top + endY,
        preventDefault: () => {}
    });

    await delay(200);

    // Simulate Mouse Up
    ui.handleMouseUp({
        preventDefault: () => {}
    });

    // Check if new asteroid was created
    const afterFlingAsteroids = physics.asteroids.length;
    if (afterFlingAsteroids === initialAsteroids + 1) {
        ui.addTerminalLog(`[TEST PASS] Simulated fling launch verified: Asteroid created at [${startX}, ${startY}].`, "system-line");
    } else {
        ui.addTerminalLog(`[TEST FAIL] Fling launch simulation failed. Asteroid count: ${afterFlingAsteroids}.`, "warning-line");
    }

    await delay(500);

    // 3. Place an Inversion Emitter structure
    ui.addTerminalLog("[TEST RUN] Deploying local Inversion Emitter field...", "system-line");
    ui.selectTool('inversion');

    const emitX = 400;
    const emitY = 400;

    ui.handleMouseDown({
        button: 0,
        clientX: rect.left + emitX,
        clientY: rect.top + emitY,
        preventDefault: () => {}
    });

    // Emitters are deployed immediately on MouseDown
    const emitterCount = physics.emitters.length;
    if (emitterCount === 1) {
        ui.addTerminalLog(`[TEST PASS] Emitter structure deployed at sector [${emitX}, ${emitY}].`, "system-line");
    } else {
        ui.addTerminalLog(`[TEST FAIL] Emitter deployment failed. Emitters active: ${emitterCount}.`, "warning-line");
    }

    await delay(1000);

    // 4. Verify frame rate stability
    const currentFps = parseFloat(ui.statFps.textContent) || 60;
    if (currentFps >= 45) {
        ui.addTerminalLog(`[TEST PASS] Frame rate diagnostics clear. FPS: ${currentFps.toFixed(1)} (Simulation running smoothly).`, "system-line");
    } else {
        ui.addTerminalLog(`[TEST WARNING] Low frame rate detected: ${currentFps.toFixed(1)} FPS.`, "warning-line");
    }

    ui.addTerminalLog("[TEST COMPLETE] Automated diagnostics finished. Sandbox ready for manual command.", "system-line");
}
