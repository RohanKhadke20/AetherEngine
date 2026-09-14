import { Vector2D } from './vector.js';

// Counter for unique asteroid identifiers
let nextAsteroidId = 1;

export class Asteroid {
    constructor(x, y, vx = 0, vy = 0, mass = 50) {
        this.id = nextAsteroidId++;
        this.pos = new Vector2D(x, y);
        this.vel = new Vector2D(vx, vy);
        this.acc = new Vector2D(0, 0); // Stores net gravitational acceleration
        this.mass = mass;
        this.destroyed = false;
        
        // Constant 2D density scaling: Radius = scale * sqrt(mass)
        this.radiusScale = 2.0;
        this.updateRadius();
        
        // Trail history for drawing orbits
        this.trail = [];
        this.maxTrailLength = 120; // Stores up to 120 frames of trail positions
        this.trailSampleRate = 2; // Capture every 2nd frame to optimize performance
        this.trailCounter = 0;

        // Visual attributes
        this.hue = 190; // Default cyan/blue hue
        this.updateColor();
    }

    /**
     * Re-calculate radius when mass changes (e.g. after merging)
     */
    updateRadius() {
        this.radius = this.radiusScale * Math.sqrt(this.mass);
    }

    /**
     * Compute visual properties based on entity stats
     */
    updateColor() {
        // Base hue shifts from Cyan (190) -> Magenta/Orange (330/30) as mass increases
        // Smaller mass = Cyan. Medium mass = Purple. Heavy mass = Red-Hot.
        const massFactor = Math.min(this.mass / 1000, 1.0); // caps relative heat scale at 1000 mass
        this.hue = 190 + massFactor * 140; // 190 (cyan) + 140 = 330 (magenta/red-hot)
        
        // Lightness decreases slightly for very heavy elements to give them an dense core look
        const lightness = 60 - massFactor * 15; // 60% down to 45%
        
        this.color = `hsl(${this.hue}, 90%, ${lightness}%)`;
        this.glowColor = `rgba(${this.hexToRgb(this.hue)}, 0.45)`;
    }

    // Quick HSL Hue to RGB string helper for glowing canvas shadows
    hexToRgb(hue) {
        // Simple approximation for glow colors in RGBA
        if (hue < 220) return '0, 240, 255'; // Cyan
        if (hue < 280) return '163, 0, 255'; // Purple
        return '255, 0, 127'; // Magenta
    }

    /**
     * Apply a force to the asteroid (divides by mass to get acceleration)
     * F = m * a => a = F / m
     */
    applyForce(force) {
        const f = Vector2D.div(force, this.mass);
        this.acc.add(f);
    }

    /**
     * Update position and velocity using Euler integration
     */
    update(dt) {
        // Update velocity: v = v + a * dt
        this.vel.add(Vector2D.mult(this.acc, dt));
        // Update position: x = x + v * dt
        this.pos.add(Vector2D.mult(this.vel, dt));
        
        // Clear acceleration for the next frame
        // (but keep its value temporarily if needed for rendering before reset)
        this.lastAcc = this.acc.copy();
        this.acc.set(0, 0);

        // Record history trail
        this.trailCounter++;
        if (this.trailCounter % this.trailSampleRate === 0) {
            this.trail.push(this.pos.copy());
            if (this.trail.length > this.maxTrailLength) {
                this.trail.shift();
            }
        }
    }
}
