import { Vector2D } from './vector.js';

let nextEmitterId = 1;

export class Emitter {
    constructor(x, y, mode = 'inversion') {
        this.id = nextEmitterId++;
        this.pos = new Vector2D(x, y);
        
        // Emitter configuration
        this.fieldRadius = 80.0;
        this.mode = mode; // 'inversion', 'shield', 'diverter'
        
        // Energy capacity
        this.energy = 100.0;
        this.maxEnergy = 100.0;
        this.active = true;
        
        // Track visual and simulation interaction states
        this.activeThisFrame = false;
        
        // Visual color mapping based on mode
        this.updateVisuals();
    }

    updateVisuals() {
        if (this.mode === 'inversion') {
            this.color = '#ff5500'; // Vivid orange-red
            this.glowColor = 'rgba(255, 85, 0, 0.4)';
            this.displayName = "Inversion Field";
        } else if (this.mode === 'shield') {
            this.color = '#e3e8f8'; // Faint silver-white
            this.glowColor = 'rgba(227, 232, 248, 0.3)';
            this.displayName = "Zero-G Shield";
        } else if (this.mode === 'diverter') {
            this.color = '#00f0ff'; // Neon electric cyan
            this.glowColor = 'rgba(0, 240, 255, 0.4)';
            this.displayName = "Diverter";
        }
    }

    /**
     * Update emitter energy level based on usage
     * @param {number} dt Time step in seconds
     * @param {number} asteroidCount Number of asteroids currently in range
     */
    update(dt, asteroidCount) {
        if (!this.active) return;

        // Energy consumption math:
        // Idle rate: 1.5 units / sec
        // Interacting rate: 12 units / sec per asteroid in range
        let depletion = 1.5 * dt;
        if (asteroidCount > 0) {
            depletion += 12.0 * asteroidCount * dt;
        }

        this.energy = Math.max(0, this.energy - depletion);

        if (this.energy <= 0) {
            this.active = false;
            this.energy = 0;
        }
    }
}
