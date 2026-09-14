import { Vector2D } from './js/vector.js';
import { Asteroid } from './js/asteroid.js';
import { PhysicsEngine } from './js/physics.js';

console.log("=========================================");
console.log("  AETHERENGINE: RUNNING HEADLESS TESTS   ");
console.log("=========================================\n");

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`[PASS] ${message}`);
        testsPassed++;
    } else {
        console.error(`[FAIL] ${message}`);
        testsFailed++;
    }
}

// ----------------------------------------------------
// TEST 1: Vector2D Arithmetic
// ----------------------------------------------------
try {
    const v1 = new Vector2D(3, 4);
    const v2 = new Vector2D(1, 2);
    
    assert(v1.mag() === 5, "Vector magnitude calculation correct (3,4 -> 5)");
    
    const v3 = Vector2D.add(v1, v2);
    assert(v3.x === 4 && v3.y === 6, "Vector static addition correct");
    
    v1.add(v2);
    assert(v1.x === 4 && v1.y === 6, "Vector instance addition correct");
    
    v1.normalize();
    assert(Math.abs(v1.mag() - 1.0) < 0.00001, "Vector normalization results in unit vector");
} catch (e) {
    console.error("Test 1 encountered error:", e);
    testsFailed++;
}

// ----------------------------------------------------
// TEST 2: Newtonian Orbit Stability
// ----------------------------------------------------
try {
    // Initialize physics with G = 0.5, Core Mass = 100,000, positioned at (0, 0)
    const physics = new PhysicsEngine(0.5, 100000);
    physics.setCorePosition(0, 0);
    
    // Spawn asteroid at (200, 0) with a mass of 50
    const startPos = new Vector2D(200, 0);
    const ast = new Asteroid(startPos.x, startPos.y, 0, 0, 50);
    
    // Calculate stable circular orbit velocity
    const orbitVel = physics.calculateStableOrbitVelocity(ast.pos, true);
    ast.vel = orbitVel;
    physics.addAsteroid(ast);
    
    // Theoretical orbital velocity: v = sqrt( (G * M * d) / (d^2 + epsilon^2) )
    // d = 200, G = 0.5, M = 100,000, epsilon = 15
    // v = sqrt( (0.5 * 100000 * 200) / (40000 + 225) ) = sqrt( 10000000 / 40225 ) = sqrt(248.60) = 15.767
    const expectedSpeed = Math.sqrt((0.5 * 100000 * 200) / (200*200 + 15*15));
    assert(Math.abs(orbitVel.mag() - expectedSpeed) < 0.001, `Orbital velocity calculation matches theoretical: ${orbitVel.mag().toFixed(3)} vs ${expectedSpeed.toFixed(3)}`);
    
    // Simulate 1000 steps (about 16 seconds of orbit)
    const dt = 1/60;
    let maxDistError = 0;
    
    for (let i = 0; i < 1000; i++) {
        physics.update(dt);
        if (physics.asteroids.length === 0) {
            maxDistError = 999;
            break;
        }
        const currentDist = physics.asteroids[0].pos.dist(physics.core.pos);
        const error = Math.abs(currentDist - 200);
        if (error > maxDistError) {
            maxDistError = error;
        }
    }
    
    // Verify eccentricity stays small (distance stays within 2.5% of start radius)
    const errorPercent = (maxDistError / 200) * 100;
    assert(errorPercent < 2.5, `Orbit remains stable and circular: Max distance deviation is ${maxDistError.toFixed(2)}px (${errorPercent.toFixed(2)}% eccentricity)`);
} catch (e) {
    console.error("Test 2 encountered error:", e);
    testsFailed++;
}

// ----------------------------------------------------
// TEST 3: Inelastic Collision & Momentum Conservation
// ----------------------------------------------------
try {
    const physics = new PhysicsEngine(0, 100000); // Set G = 0 to isolate collision mechanics
    physics.setCorePosition(0, 10000);
    
    // Spawn two asteroids moving toward each other
    // A: Mass 100, Position (0, 0), Velocity (5, 0)
    // B: Mass 300, Position (10, 0), Velocity (-5, 0)
    const astA = new Asteroid(0, 0, 5, 0, 100);
    const astB = new Asteroid(10, 0, -5, 0, 300);
    
    physics.addAsteroid(astA);
    physics.addAsteroid(astB);
    
    // Total initial momentum: p = m1*v1 + m2*v2 = 100*5 + 300*(-5) = -1000
    // Total mass: 400
    // Expected post-collision velocity: v_new = -1000 / 400 = -2.5
    // Expected post-collision position (center of mass moving at -2.5 for 1/60 sec):
    // x_initial = (100*0 + 300*10) / 400 = 7.5
    // x_final = 7.5 + (-2.5 * 1/60) = 7.458333333
    
    // Update physics to trigger collision resolution
    physics.update(1/60);
    
    assert(physics.asteroids.length === 1, "Asteroids merged successfully into 1 body");
    if (physics.asteroids.length === 1) {
        const merged = physics.asteroids[0];
        assert(merged.mass === 400, `Merged mass is conserved: ${merged.mass} (expected 400)`);
        assert(Math.abs(merged.vel.x - (-2.5)) < 0.00001 && merged.vel.y === 0, `Momentum conserved: post-collision velocity is ${merged.vel.x} (expected -2.5)`);
        assert(Math.abs(merged.pos.x - 7.458333333) < 0.00001 && merged.pos.y === 0, `Center of mass conserved: post-collision position is ${merged.pos.x.toFixed(4)} (expected 7.4583)`);
    }
} catch (e) {
    console.error("Test 3 encountered error:", e);
    testsFailed++;
}

// ----------------------------------------------------
// TEST 4: Emitter Mode A (Inversion Field)
// ----------------------------------------------------
try {
    const physics = new PhysicsEngine(0.5, 100000);
    physics.setCorePosition(0, 0);
    
    // Spawn asteroid at (200, 0)
    const ast = new Asteroid(200, 0, 0, 0, 50);
    physics.addAsteroid(ast);
    
    // Deploy Inversion Emitter at (200, 0)
    const emitter = physics.addEmitter(200, 0, 'inversion');
    
    // Expected normal Core gravity force: directed towards (0,0) [negative x]
    // Under Inversion, force should be multiplied by -1.5 [directed towards positive x]
    // Normal gravity acceleration magnitude: a = G * M_core / (d^2 + epsilon^2) = 0.5 * 100000 / (40000 + 225) = 1.243
    // Inverted acceleration magnitude: 1.243 * 1.5 = 1.8645 (directed in +x direction)
    physics.update(1/60);
    
    const expectedAcc = ((0.5 * 100000) / (200*200 + 15*15)) * 1.5;
    const actualVel = ast.vel.x; // vel = a * dt
    const expectedVel = expectedAcc * (1/60);
    
    assert(ast.vel.x > 0, "Inversion field pushes asteroid away from core (+x direction)");
    assert(Math.abs(actualVel - expectedVel) < 0.001, `Inversion force magnitude matches F_grav * -1.5: ${actualVel.toFixed(4)} (expected ${expectedVel.toFixed(4)})`);
} catch (e) {
    console.error("Test 4 encountered error:", e);
    testsFailed++;
}

// ----------------------------------------------------
// TEST 5: Emitter Mode B (Zero-G Shield)
// ----------------------------------------------------
try {
    const physics = new PhysicsEngine(0.5, 100000);
    physics.setCorePosition(0, 0);
    
    // Spawn asteroid at (200, 0)
    const ast = new Asteroid(200, 0, 0, 0, 50);
    physics.addAsteroid(ast);
    
    // Deploy Zero-G Shield at (200, 0)
    physics.addEmitter(200, 0, 'shield');
    
    // Core gravity should be neutralized
    physics.update(1/60);
    
    assert(ast.vel.x === 0 && ast.vel.y === 0, "Zero-G Shield completely neutralizes core gravity (asteroid remains stationary)");
} catch (e) {
    console.error("Test 5 encountered error:", e);
    testsFailed++;
}

// ----------------------------------------------------
// TEST 6: Emitter Mode C (Diverter Redirection)
// ----------------------------------------------------
try {
    const physics = new PhysicsEngine(0.5, 100000);
    physics.setCorePosition(0, 10000); // disable core gravity effect by putting core far away
    physics.setG(0); // clear gravity constant to isolate
    
    // Spawn asteroid at (200, 0) moving in -x direction (directly towards emitter at (100,0))
    // Entry speed is 10
    const ast = new Asteroid(200, 0, -10, 0, 50);
    physics.addAsteroid(ast);
    
    // Deploy Diverter at (100, 0)
    // Distance from asteroid (200, 0) to emitter (100, 0) is 100px (< 80px fieldRadius? No, 100px is outside field!)
    // Wait! fieldRadius is 80, so at (200,0) and (100,0), distance is 100 which is OUTSIDE!
    // Let's spawn emitter at (150, 0) so distance is 50px (< 80px) and it is INSIDE!
    physics.addEmitter(150, 0, 'diverter');
    
    // Under Diverter, velocity vector is rotated tangentially (perpendicular to displacement)
    // Displacement from emitter (150,0) to asteroid (200,0) is (50, 0) [positive x]
    // Perpendicular tangents are (0, 1) and (0, -1). Speed should stay 10.
    physics.update(1/60);
    
    assert(Math.abs(ast.vel.mag() - 10) < 0.0001, "Diverter conserves speed magnitude of the asteroid");
    assert(ast.vel.x === 0 && Math.abs(ast.vel.y) === 10, `Diverter rotates velocity vector tangentially: [${ast.vel.x}, ${ast.vel.y}] (expected [0, ±10])`);
} catch (e) {
    console.error("Test 6 encountered error:", e);
    testsFailed++;
}

// ----------------------------------------------------
// TEST 7: Emitter Energy Depletion Rates
// ----------------------------------------------------
try {
    const physics = new PhysicsEngine(0, 100000); // G = 0 to isolate
    physics.setCorePosition(0, 10000);
    
    // Deploy two emitters
    const emitterIdle = physics.addEmitter(0, 0, 'shield');
    const emitterActive = physics.addEmitter(500, 0, 'shield');
    
    // Spawn asteroid inside emitterActive field (distance 30 < 80)
    const ast = new Asteroid(500, 30, 0, 0, 50);
    physics.addAsteroid(ast);
    
    // Simulate 2 seconds (120 steps of dt = 1/60)
    const dt = 1/60;
    for (let i = 0; i < 120; i++) {
        physics.update(dt);
    }
    
    // Idle rate: 1.5% / sec. For 2 sec, expected depletion is 3.0%. Energy should be 97.0
    // Active rate: 1.5% + 12% = 13.5% / sec. For 2 sec, expected depletion is 27.0%. Energy should be 73.0
    assert(Math.abs(emitterIdle.energy - 97.0) < 0.001, `Idle emitter depletes at 1.5%/s: ${emitterIdle.energy.toFixed(2)}% (expected 97.00%)`);
    assert(Math.abs(emitterActive.energy - 73.0) < 0.001, `Active emitter depletes at 13.5%/s: ${emitterActive.energy.toFixed(2)}% (expected 73.00%)`);
    
    // Deplete completely and verify deactivation
    for (let i = 0; i < 600; i++) {
        physics.update(dt); // Run for 10 more seconds (idle will deplete by 15%, active will deplete by 135% -> should hit 0% and collapse)
    }
    assert(emitterActive.active === false && emitterActive.energy === 0, "Depleted emitter sets active flag to false and collapses");
} catch (e) {
    console.error("Test 7 encountered error:", e);
    testsFailed++;
}

// ----------------------------------------------------
// TEST 8: Hookean Spring Force Calculations
// ----------------------------------------------------
try {
    const physics = new PhysicsEngine(0, 100000); // G = 0 to isolate
    physics.setCorePosition(0, 10000);
    
    // Spawn two asteroids of mass 100
    const astA = new Asteroid(0, 0, 0, 0, 100);
    const astB = new Asteroid(100, 0, 0, 0, 100);
    physics.addAsteroid(astA);
    physics.addAsteroid(astB);
    
    // Create link (stiffness = 1.0, maxStrain = 1000)
    // restLength is 100
    physics.addStructuralLink(astA, astB, 1.0, 1000);
    
    // Manually displace B to (120, 0), setting delta = +20px
    astB.pos.set(120, 0);
    
    // Expected restoring force: F = k * delta = 1.0 * 20 = 20 kN
    // B should accelerate left (-x), A should accelerate right (+x)
    // a = F / m = 20 / 100 = 0.2 px/s^2
    // v after 1 step: v = a * dt = 0.2 * 1/60 = 0.003333 px/s
    physics.update(1/60);
    
    assert(Math.abs(astB.vel.x - (-0.0033333)) < 0.0001, `Spring force pulls B left: B velocity is ${astB.vel.x.toFixed(6)} (expected -0.003333)`);
    assert(Math.abs(astA.vel.x - (0.0033333)) < 0.0001, `Spring force pulls A right: A velocity is ${astA.vel.x.toFixed(6)} (expected +0.003333)`);
} catch (e) {
    console.error("Test 8 encountered error:", e);
    testsFailed++;
}

// ----------------------------------------------------
// TEST 9: Snapping Load Threshold and Kinetic Release Impulse
// ----------------------------------------------------
try {
    const physics = new PhysicsEngine(0, 100000); // G = 0 to isolate
    physics.setCorePosition(0, 10000);
    
    // Spawn two asteroids of mass 100
    const astA = new Asteroid(0, 0, 0, 0, 100);
    const astB = new Asteroid(100, 0, 0, 0, 100);
    physics.addAsteroid(astA);
    physics.addAsteroid(astB);
    
    // Create link (stiffness = 2.0, maxStrain = 30)
    // restLength is 100
    physics.addStructuralLink(astA, astB, 2.0, 30);
    
    // Manually displace B to (120, 0), setting delta = +20px
    // Expected force: F = 2.0 * 20 = 40 kN (> 30 kN maxStrain) -> SNAP!
    astB.pos.set(120, 0);
    
    // On snap, link is removed and kinetic release impulse is applied:
    // impulseStrength = 0.08 * F = 0.08 * 40 = 3.2
    // v_impulse on B: +u * (3.2 / 100) = +0.032 px/s
    // v_impulse on A: -u * (3.2 / 100) = -0.032 px/s
    physics.update(1/60);
    
    assert(physics.structuralLinks.length === 0, "Stress exceeding maxStrain snaps the beam and removes it");
    assert(Math.abs(astB.vel.x - 0.032) < 0.0001, `Snap release pushes B outward (+x): velocity is ${astB.vel.x.toFixed(3)} (expected +0.032)`);
    assert(Math.abs(astA.vel.x - (-0.032)) < 0.0001, `Snap release pushes A outward (-x): velocity is ${astA.vel.x.toFixed(3)} (expected -0.032)`);
} catch (e) {
    console.error("Test 9 encountered error:", e);
    testsFailed++;
}

// ----------------------------------------------------
// TEST 10: Core Damage & Game Over
// ----------------------------------------------------
try {
    const physics = new PhysicsEngine(0, 100000); // G = 0 to isolate
    physics.setCorePosition(0, 0);
    physics.coreStability = 100.0;
    
    // Spawn asteroid of mass 100 overlapping the core
    const ast = new Asteroid(0, 0, 0, 0, 100);
    physics.addAsteroid(ast);
    
    physics.update(1/60);
    
    assert(physics.coreStability === 50.0, `Core collision drops stability by mass * 0.5: Stability is ${physics.coreStability}% (expected 50.0%)`);
    assert(physics.isGameOver === false, "Core stability > 0 does not trigger Game Over");
    
    // Spawn another asteroid of mass 120 to completely deplete stability
    const ast2 = new Asteroid(0, 0, 0, 0, 120);
    physics.addAsteroid(ast2);
    
    physics.update(1/60);
    
    assert(physics.coreStability === 0.0, "Core stability drops to 0%");
    assert(physics.isGameOver === true, "Core stability <= 0 triggers Game Over");
} catch (e) {
    console.error("Test 10 encountered error:", e);
    testsFailed++;
}

// ----------------------------------------------------
// TEST 11: Mining Chains & Mass Swelling
// ----------------------------------------------------
try {
    const physics = new PhysicsEngine(0, 100000); // G = 0 to isolate
    physics.setCorePosition(0, 10000);
    
    physics.aetherFuel = 100.0;
    physics.credits = 0.0;
    
    const astA = new Asteroid(0, 0, 0, 0, 100);
    const astB = new Asteroid(50, 0, 0, 0, 100);
    physics.addAsteroid(astA);
    physics.addAsteroid(astB);
    
    // Add structural link between the two asteroids (not involving core)
    physics.addStructuralLink(astA, astB);
    
    // Simulate 2 seconds of mining (120 steps of dt = 1/60)
    const dt = 1/60;
    for (let i = 0; i < 120; i++) {
        physics.update(dt);
    }
    
    // Mined amount for 2s: 1.0 * 2.0 = 2.0 units
    // Fuel should be 100.0 + 2.0 = 102.0
    // Credits should be 0.0 + 2.0 = 2.0
    // Mass swells by 5% per second (compounded per step)
    let expectedMass = 100;
    for (let i = 0; i < 120; i++) {
        expectedMass *= (1.0 + 0.05 * dt);
    }
    
    assert(Math.abs(physics.aetherFuel - 102.0) < 0.001, `Mining generates 1.0 fuel/s: fuel is ${physics.aetherFuel.toFixed(2)} (expected 102.00)`);
    assert(Math.abs(physics.credits - 2.0) < 0.001, `Mining generates 1.0 credits/s: credits is ${physics.credits.toFixed(2)} (expected 2.00)`);
    assert(Math.abs(astA.mass - expectedMass) < 0.001, `Asteroid A mass swells by 5%/s: mass is ${astA.mass.toFixed(2)} (expected ${expectedMass.toFixed(2)})`);
    assert(Math.abs(astB.mass - expectedMass) < 0.001, `Asteroid B mass swells by 5%/s: mass is ${astB.mass.toFixed(2)} (expected ${expectedMass.toFixed(2)})`);
} catch (e) {
    console.error("Test 11 encountered error:", e);
    testsFailed++;
}

// ----------------------------------------------------
// TEST 12: Threat Wave Spawning & Trajectory
// ----------------------------------------------------
try {
    const physics = new PhysicsEngine(0, 100000); // G = 0 to isolate
    physics.width = 1200;
    physics.height = 800;
    physics.setCorePosition(600, 400); // Core at center
    physics.elapsedTime = 65.0; // 1 minute 5 seconds elapsed
    
    const countBefore = physics.asteroids.length;
    physics.spawnRogueAsteroid();
    
    assert(physics.asteroids.length === countBefore + 1, "Rogue asteroid spawned successfully");
    
    if (physics.asteroids.length === countBefore + 1) {
        const rogue = physics.asteroids[physics.asteroids.length - 1];
        
        // Assert mass scale: elapsedTime = 65s -> 1 minute.
        // base mass: 20 + 30 * 1 = 50. plus random 0..15. So mass must be in [50, 65] range
        assert(rogue.mass >= 50.0 && rogue.mass <= 65.0, `Rogue mass scaled correctly based on survival time: ${rogue.mass.toFixed(2)} (expected between 50.0 and 65.0)`);
        
        // Verify trajectory goes directly to core:
        // direction of velocity should match direction to core
        const toCore = Vector2D.sub(physics.core.pos, rogue.pos);
        const normalizedToCore = toCore.copy().normalize();
        const normalizedVel = rogue.vel.copy().normalize();
        
        // Dot product should be 1.0 (or very close)
        const dot = normalizedToCore.dot(normalizedVel);
        assert(Math.abs(dot - 1.0) < 0.0001, `Rogue asteroid trajectory points directly to Core (dot product of direction vectors is ${dot.toFixed(5)})`);
        assert(Math.abs(rogue.vel.mag() - 70.0) < 0.0001, `Rogue speed is 70 px/s: speed is ${rogue.vel.mag().toFixed(2)}`);
    }
} catch (e) {
    console.error("Test 12 encountered error:", e);
    testsFailed++;
}

console.log("\n=========================================");
console.log(`TEST RUN COMPLETE. Passed: ${testsPassed}, Failed: ${testsFailed}`);
console.log("=========================================");

if (testsFailed > 0) {
    process.exit(1);
} else {
    process.exit(0);
}
