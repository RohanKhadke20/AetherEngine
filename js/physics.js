import { Vector2D } from './vector.js';
import { Asteroid } from './asteroid.js';
import { Emitter } from './emitter.js';

export class PhysicsEngine {
    constructor(g = 0.15, coreMass = 100000) {
        this.g = g;
        this.coreMass = coreMass;
        
        // Define Core (Central Singularity)
        this.core = {
            pos: new Vector2D(0, 0), // Will be centered in canvas by main/renderer
            mass: coreMass,
            radius: 32
        };

        this.asteroids = [];
        this.emitters = [];
        this.structuralLinks = [];
        this.nextLinkId = 1;
        this.consumedCount = 0;

        // Strategy gameplay variables
        this.coreStability = 100.0;
        this.aetherFuel = 100.0;
        this.credits = 0.0;
        this.elapsedTime = 0.0;
        this.isGameOver = false;
        this.lastSpawnTime = 0.0;
        this.width = 1200; // dynamic resize boundaries
        this.height = 800; // dynamic resize boundaries
        
        // Physics constants
        this.softeningFactor = 15.0; // Epsilon to prevent slingshot division-by-zero
        this.epsilonSq = this.softeningFactor * this.softeningFactor;
        
        // Callback for logging events to UI
        this.onLog = null;
    }

    setG(gValue) {
        this.g = gValue;
    }

    setCoreMass(massValue) {
        this.coreMass = massValue;
        this.core.mass = massValue;
        // Core visual radius scales slightly with mass for aesthetics
        this.core.radius = 20 + Math.pow(massValue, 0.25) * 1.2;
    }

    setCorePosition(x, y) {
        this.core.pos.set(x, y);
    }

    addAsteroid(asteroid) {
        this.asteroids.push(asteroid);
    }

    clearAsteroids() {
        this.asteroids = [];
        this.log("All asteroids cleared from orbit sector.", "warning-line");
    }

    addEmitter(x, y, mode) {
        if (this.aetherFuel < 25.0) {
            this.log(`[DEPLOY FAIL] Insufficient Aether Fuel (25.0 units required, current: ${this.aetherFuel.toFixed(1)}).`, "warning-line");
            return null;
        }
        this.aetherFuel -= 25.0;
        const emitter = new Emitter(x, y, mode);
        this.emitters.push(emitter);
        this.log(`Deployed Emitter #${emitter.id} (${emitter.displayName}) at sector [${Math.round(x)}, ${Math.round(y)}]. Cost: 25 Aether Fuel.`, "system-line");
        return emitter;
    }

    removeEmitterAt(x, y) {
        const clickPos = new Vector2D(x, y);
        const index = this.emitters.findIndex(e => e.pos.dist(clickPos) < 25); // 25px click collision box
        if (index !== -1) {
            const removed = this.emitters[index];
            this.emitters.splice(index, 1);
            this.log(`Recycled Emitter #${removed.id} (${removed.displayName}). Space recovery successful.`, "warning-line");
            return true;
        }
        return false;
    }

    addStructuralLink(bodyA, bodyB, stiffness = 1.8, maxStrain = 150) {
        if (!bodyA || !bodyB || bodyA === bodyB) return null;

        // Prevent duplicate links
        const exists = this.structuralLinks.some(link => 
            (link.bodyA === bodyA && link.bodyB === bodyB) || 
            (link.bodyA === bodyB && link.bodyB === bodyA)
        );
        if (exists) return null;

        const restLength = bodyA.pos.dist(bodyB.pos);
        const link = {
            id: this.nextLinkId++,
            bodyA,
            bodyB,
            restLength,
            stiffness,
            maxStrain,
            strainForce: 0,
            snapped: false
        };

        this.structuralLinks.push(link);
        
        const nameA = bodyA === this.core ? "Singularity Core" : `Asteroid #${bodyA.id}`;
        const nameB = bodyB === this.core ? "Singularity Core" : `Asteroid #${bodyB.id}`;
        this.log(`Secured Structural Beam #${link.id} between ${nameA} and ${nameB} (Rest Length: ${Math.round(restLength)}m).`, "system-line");
        return link;
    }

    spawnRogueAsteroid() {
        const edge = Math.floor(Math.random() * 4);
        let sx = 0, sy = 0;
        const padding = 40;

        if (edge === 0) { // left
            sx = -padding;
            sy = Math.random() * this.height;
        } else if (edge === 1) { // right
            sx = this.width + padding;
            sy = Math.random() * this.height;
        } else if (edge === 2) { // top
            sx = Math.random() * this.width;
            sy = -padding;
        } else { // bottom
            sx = Math.random() * this.width;
            sy = this.height + padding;
        }

        const timeScaleMinutes = Math.floor(this.elapsedTime / 60);
        const mass = 20.0 + timeScaleMinutes * 30.0 + Math.random() * 15.0;
        const ast = new Asteroid(sx, sy, 0, 0, mass);

        const toCore = Vector2D.sub(this.core.pos, ast.pos);
        toCore.normalize().mult(70); // Course direct trajectory CourseCourse Course
        ast.vel = toCore;

        this.addAsteroid(ast);
        this.log(`[ROGUE THREAT] Rogue asteroid detected on crash course! Mass: ${Math.round(mass)} kT.`, "warning-line");
    }

    resetGame() {
        this.asteroids = [];
        this.emitters = [];
        this.structuralLinks = [];
        this.consumedCount = 0;
        this.coreStability = 100.0;
        this.aetherFuel = 100.0;
        this.credits = 0.0;
        this.elapsedTime = 0.0;
        this.isGameOver = false;
        this.lastSpawnTime = 0.0;
        this.log("Sandbox re-initialized. Strategy systems online.", "system-line");
    }

    log(message, type = "system-line") {
        if (this.onLog) {
            this.onLog(message, type);
        }
    }

    /**
     * Compute stable circular orbit velocity at a given position
     * v = sqrt( (G * M_core * d) / (d^2 + epsilon^2) )
     * Direction is tangent (90 degrees relative to position vector)
     */
    calculateStableOrbitVelocity(pos, clockwise = true) {
        const toCore = Vector2D.sub(this.core.pos, pos);
        const distance = toCore.mag();
        
        if (distance === 0) return new Vector2D(0, 0);

        // Gravity acceleration magnitude at this distance
        // a = G * M / (d^2 + epsilon^2)
        const dSq = distance * distance;
        const gAcc = (this.g * this.core.mass) / (dSq + this.epsilonSq);
        
        // Circular orbit velocity: v = sqrt(a * d)
        const speed = Math.sqrt(gAcc * distance);
        
        // Tangent vector: perpendicular to toCore
        // If toCore is (dx, dy), tangent is (-dy, dx) or (dy, -dx)
        const tangent = clockwise 
            ? new Vector2D(-toCore.y, toCore.x) 
            : new Vector2D(toCore.y, -toCore.x);
        
        tangent.normalize().mult(speed);
        return tangent;
    }

    /**
     * Perform one step of physics update
     */
    update(dt) {
        if (this.isGameOver) return;

        const numAsteroids = this.asteroids.length;

        // Increment time timer
        this.elapsedTime += dt;

        // 0. Emitter energy updates and fuel requirements
        let activeEmittersCount = 0;
        for (let e of this.emitters) {
            let count = 0;
            for (let a of this.asteroids) {
                if (!a.destroyed && a.pos.dist(e.pos) < e.fieldRadius) {
                    count++;
                }
            }
            e.update(dt, count);
            
            // Emitter operates only if it has internal charge AND the global grid has fuel
            if (e.energy > 0 && this.aetherFuel > 0) {
                e.active = true;
                activeEmittersCount++;
            } else {
                e.active = false;
            }
            e.activeThisFrame = false; // reset flag
        }

        // Deplete active emitter maintenance costs: 1.0 fuel unit / sec per active emitter
        const fuelDrain = activeEmittersCount * 1.0 * dt;
        const fuelBefore = this.aetherFuel;
        this.aetherFuel = Math.max(0, this.aetherFuel - fuelDrain);
        
        if (fuelBefore > 0 && this.aetherFuel === 0 && activeEmittersCount > 0) {
            this.log("[POWER FAILURE] Aether fuel depleted! All anti-gravity emitters shut down.", "warning-line");
            for (let e of this.emitters) {
                e.active = false;
            }
        }

        // Cleanup dead/depleted emitters
        this.emitters = this.emitters.filter(e => {
            if (e.energy <= 0) {
                this.log(`Emitter #${e.id} collapsed: Device energy completely exhausted.`, "warning-line");
                return false;
            }
            return true;
        });

        // Cleanup structural links connected to destroyed asteroids
        this.structuralLinks = this.structuralLinks.filter(link => {
            if (link.bodyA.destroyed || link.bodyB.destroyed) {
                return false;
            }
            return true;
        });

        // 0.5. Process mining chains (structural beams connecting two dynamic asteroids)
        for (let link of this.structuralLinks) {
            const a = link.bodyA;
            const b = link.bodyB;
            
            if (a !== this.core && b !== this.core) {
                // Mine 1.0 fuel and credits per second
                const minedAmount = 1.0 * dt;
                this.aetherFuel += minedAmount;
                this.credits += minedAmount;

                // Dynamic swelling: Mass increases by 5% every second
                a.mass *= (1.0 + 0.05 * dt);
                b.mass *= (1.0 + 0.05 * dt);
                a.updateRadius();
                b.updateRadius();
                a.updateColor();
                b.updateColor();
            }
        }

        // 0.6. Wave threat spawner: Rogue asteroid direct Course Course Course course Course course every 15s
        if (this.elapsedTime - this.lastSpawnTime >= 15.0) {
            this.spawnRogueAsteroid();
            this.lastSpawnTime = this.elapsedTime;
        }

        // 1. Calculate and Apply Gravity Forces
        // Core gravity acting on asteroids (potentially intercepted by anti-gravity fields)
        for (let i = 0; i < numAsteroids; i++) {
            const ast = this.asteroids[i];
            if (ast.destroyed) continue;

            const toCore = Vector2D.sub(this.core.pos, ast.pos);
            const distSq = toCore.magSq();
            const dist = Math.sqrt(distSq);

            if (dist > 0) {
                // Newton's law: F = G * m1 * m2 / (r^2 + eps^2)
                const fMag = (this.g * this.core.mass * ast.mass) / (distSq + this.epsilonSq);
                const force = toCore.normalize().mult(fMag);
                
                // Check anti-gravity field interception (only if fuel is available!)
                let intercepted = false;
                if (this.aetherFuel > 0) {
                    for (let e of this.emitters) {
                        if (!e.active) continue;
                        
                        const d = ast.pos.dist(e.pos);
                        if (d < e.fieldRadius) {
                            intercepted = true;
                            e.activeThisFrame = true;
                            ast.inAntiGravityField = true;
                            
                            if (e.mode === 'inversion') {
                                // Mode A (Inversion): Reverse force and amplify it
                                force.mult(-1.5);
                            } else if (e.mode === 'shield') {
                                // Mode B (Zero-G Shield): Neutralize core gravity
                                force.set(0, 0);
                            } else if (e.mode === 'diverter') {
                                // Mode C (Diverter): Neutralize core gravity, align tangent velocity
                                force.set(0, 0);
                                
                                const toAst = Vector2D.sub(ast.pos, e.pos);
                                const distToEmit = toAst.mag();
                                if (distToEmit > 0.1) {
                                    // Find tangential options
                                    const t1 = new Vector2D(-toAst.y, toAst.x).normalize();
                                    const t2 = new Vector2D(toAst.y, -toAst.x).normalize();
                                    
                                    // Choose direction closer to forward trajectory (dot product)
                                    const tangent = ast.vel.dot(t1) >= ast.vel.dot(t2) ? t1 : t2;
                                    
                                    // Conserve entry speed but divert direction
                                    const speed = ast.vel.mag();
                                    ast.vel = Vector2D.mult(tangent, speed);
                                }
                            }
                            break; // Process first overlapping field only
                        }
                    }
                }
                
                if (!intercepted) {
                    ast.inAntiGravityField = false;
                }

                ast.applyForce(force);
            }
        }

        // Mutual asteroid-to-asteroid gravity acting on each other
        for (let i = 0; i < numAsteroids; i++) {
            const astA = this.asteroids[i];
            if (astA.destroyed) continue;

            for (let j = i + 1; j < numAsteroids; j++) {
                const astB = this.asteroids[j];
                if (astB.destroyed) continue;

                const toB = Vector2D.sub(astB.pos, astA.pos);
                const distSq = toB.magSq();
                const dist = Math.sqrt(distSq);

                if (dist > 0) {
                    // Mutual gravity force magnitude
                    const fMag = (this.g * astA.mass * astB.mass) / (distSq + this.epsilonSq);
                    
                    // Force vector on A pulling towards B
                    const forceA = Vector2D.mult(toB, fMag / dist);
                    astA.applyForce(forceA);

                    // Equal and opposite force on B pulling towards A
                    const forceB = Vector2D.mult(forceA, -1);
                    astB.applyForce(forceB);
                }
            }
        }

        // 1.5. Calculate and apply structural link spring forces + Snapping checks
        const numLinks = this.structuralLinks.length;
        for (let i = 0; i < numLinks; i++) {
            const link = this.structuralLinks[i];
            const a = link.bodyA;
            const b = link.bodyB;

            const toB = Vector2D.sub(b.pos, a.pos);
            const r = toB.mag();

            if (r > 0.1) {
                const distanceDelta = r - link.restLength;
                const fStrain = link.stiffness * distanceDelta;
                link.strainForce = fStrain;

                // Check snapping load threshold
                if (Math.abs(fStrain) > link.maxStrain) {
                    link.snapped = true;
                    const nameA = a === this.core ? "Core" : `#${a.id}`;
                    const nameB = b === this.core ? "Core" : `#${b.id}`;
                    this.log(`[BEAM COLLAPSE] Beam #${link.id} snapped between ${nameA} and ${nameB} under load: ${Math.round(Math.abs(fStrain))} kN.`, "warning-line");

                    // Apply momentum-preserving kinetic impulse vectors on snap
                    const u = Vector2D.div(toB, r);
                    const impulseStrength = 0.08 * fStrain; // push proportional to elastic energy

                    if (b !== this.core && !b.destroyed) {
                        b.vel.add(Vector2D.mult(u, impulseStrength / b.mass));
                    }
                    if (a !== this.core && !a.destroyed) {
                        a.vel.sub(Vector2D.mult(u, impulseStrength / a.mass));
                    }
                } else {
                    // Apply spring forces (Hooke's Law)
                    const u = Vector2D.div(toB, r);
                    const forceB = Vector2D.mult(u, -fStrain);
                    const forceA = Vector2D.mult(u, fStrain);

                    if (b !== this.core && !b.destroyed) {
                        b.applyForce(forceB);
                    }
                    if (a !== this.core && !a.destroyed) {
                        a.applyForce(forceA);
                    }
                }
            }
        }

        // Remove snapped links
        this.structuralLinks = this.structuralLinks.filter(l => !l.snapped);

        // 2. Update asteroid positions/velocities
        for (let i = 0; i < numAsteroids; i++) {
            const ast = this.asteroids[i];
            if (!ast.destroyed) {
                ast.update(dt);
            }
        }

        // 3. Resolve Collisions and Merges
        // Asteroid-to-Core consumption and stability damage
        for (let i = 0; i < numAsteroids; i++) {
            const ast = this.asteroids[i];
            if (ast.destroyed) continue;

            const dist = ast.pos.dist(this.core.pos);
            const threshold = this.core.radius * 0.8 + ast.radius * 0.2; // Eat slightly inside event horizon
            if (dist < threshold) {
                ast.destroyed = true;
                this.consumedCount++;
                
                // Stability Damage = mass * 0.5
                const damage = ast.mass * 0.5;
                this.coreStability = Math.max(0, this.coreStability - damage);
                
                this.log(`Core absorbed Asteroid #${ast.id} (Mass: ${Math.round(ast.mass)} kT). Core Stability reduced by ${damage.toFixed(1)}%.`, "eat-line");

                if (this.coreStability <= 0) {
                    this.coreStability = 0;
                    this.isGameOver = true;
                    this.log("[MISSION COLLAPSE] Singularity Core collapsed! Sandbox sector offline.", "warning-line");
                }
            }
        }

        // Asteroid-to-Asteroid inelastic merges
        for (let i = 0; i < numAsteroids; i++) {
            const astA = this.asteroids[i];
            if (astA.destroyed) continue;

            for (let j = i + 1; j < numAsteroids; j++) {
                const astB = this.asteroids[j];
                if (astB.destroyed) continue;

                const dist = astA.pos.dist(astB.pos);
                // Collide if they overlap
                if (dist < astA.radius + astB.radius) {
                    this.mergeAsteroids(astA, astB);
                }
            }
        }

        // 4. Cleanup destroyed asteroids
        this.asteroids = this.asteroids.filter(ast => !ast.destroyed);
    }

    /**
     * Merge two asteroids inelastically, conserving momentum
     * The larger asteroid consumes the smaller one (preserving ID & history)
     */
    mergeAsteroids(astA, astB) {
        // Identify larger and smaller
        const [larger, smaller] = astA.mass >= astB.mass ? [astA, astB] : [astB, astA];

        smaller.destroyed = true;

        const m1 = larger.mass;
        const m2 = smaller.mass;
        const mTotal = m1 + m2;

        // Conserve center of mass: pos = (m1*p1 + m2*p2) / mTotal
        const mergedPos = Vector2D.add(
            Vector2D.mult(larger.pos, m1),
            Vector2D.mult(smaller.pos, m2)
        ).div(mTotal);

        // Conserve linear momentum: vel = (m1*v1 + m2*v2) / mTotal
        const mergedVel = Vector2D.add(
            Vector2D.mult(larger.vel, m1),
            Vector2D.mult(smaller.vel, m2)
        ).div(mTotal);

        // Update larger asteroid properties
        larger.pos = mergedPos;
        larger.vel = mergedVel;
        larger.mass = mTotal;
        larger.updateRadius();
        larger.updateColor();

        // Concatenate trail history (keep up to max trail length, combining them)
        // Insert smaller's recent trail if useful, or just retain larger's history
        // Retaining larger's history is cleaner, but let's keep larger's trail
        
        this.log(`Collision: Asteroid #${larger.id} absorbed Asteroid #${smaller.id} (Mass: ${Math.round(mTotal)}).`, "collision-line");
    }
}
