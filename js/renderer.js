import { Vector2D } from './vector.js';

export class Renderer {
    constructor(canvas, physicsEngine) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.physics = physicsEngine;
        
        // Visual settings (controlled by checkboxes in UI)
        this.drawVectors = true;
        this.drawGrid = true;
        this.drawTrails = true;

        // Visual scales
        this.velocityScale = 0.4;
        this.accelerationScale = 120.0;
        
        // Grid properties
        this.gridSpacing = 50; // pixels between grid lines
        this.gridSampleStep = 20; // sample point spacing for grid line distortion
        
        // Pulsing core animation time accumulator
        this.time = 0;
        
        // Phase 3: Hovered Link tracker
        this.hoveredLink = null;
    }

    setDrawVectors(val) { this.drawVectors = val; }
    setDrawGrid(val) { this.drawGrid = val; }
    setDrawTrails(val) { this.drawTrails = val; }

    resize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.physics.width = rect.width;
        this.physics.height = rect.height;
        this.physics.setCorePosition(this.canvas.width / 2, this.canvas.height / 2);
    }

    /**
     * Spacetime warping formula
     * Displaces coordinate points (x, y) towards gravity wells
     */
    warpPoint(x, y) {
        if (!this.drawGrid) return { x, y };

        let wx = x;
        let wy = y;
        
        // 1. Warp towards the Core
        const core = this.physics.core;
        const dxCore = core.pos.x - x;
        const dyCore = core.pos.y - y;
        const distCore = Math.sqrt(dxCore * dxCore + dyCore * dyCore);
        
        if (distCore > 0.1) {
            // Pull coefficient based on mass, inversely proportional to distance (smoothed)
            const pull = (core.mass * 0.006) / (distCore + 90);
            const limitPull = Math.min(pull, distCore * 0.85); // Don't pull past 85% of distance
            
            wx += (dxCore / distCore) * limitPull;
            wy += (dyCore / distCore) * limitPull;
        }

        // 2. Warp towards heavy asteroids (mass > 120)
        const asteroids = this.physics.asteroids;
        const numAsteroids = asteroids.length;
        for (let i = 0; i < numAsteroids; i++) {
            const ast = asteroids[i];
            if (ast.destroyed || ast.mass < 120) continue;
            
            const dxAst = ast.pos.x - x;
            const dyAst = ast.pos.y - y;
            const distAst = Math.sqrt(dxAst * dxAst + dyAst * dyAst);
            
            if (distAst > 0.1) {
                const pull = (ast.mass * 0.015) / (distAst + 35);
                const limitPull = Math.min(pull, distAst * 0.6); // Don't pull past 60%
                
                wx += (dxAst / distAst) * limitPull;
                wy += (dyAst / distAst) * limitPull;
            }
        }

        // 3. Reverse Outward Warp from Active Emitters
        const emitters = this.physics.emitters;
        const numEmitters = emitters.length;
        for (let i = 0; i < numEmitters; i++) {
            const e = emitters[i];
            if (!e.active) continue;

            const dx = x - e.pos.x;
            const dy = y - e.pos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > 0.1 && dist < e.fieldRadius * 2.5) {
                // Outward push representing anti-gravity repulsion
                const energyFactor = e.energy / 100;
                const push = (energyFactor * 1400) / (dist + 35);
                const limitPush = Math.min(push, dist * 0.45); // Keep boundary bounded

                wx += (dx / dist) * limitPush;
                wy += (dy / dist) * limitPush;
            }
        }

        return { x: wx, y: wy };
    }

    draw() {
        this.time += 1;
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;

        // Clear Viewport (Deep Space Background)
        ctx.fillStyle = '#07080d';
        ctx.fillRect(0, 0, width, height);

        // 1. Draw Space Coordinate Grid
        if (this.drawGrid) {
            ctx.lineWidth = 1;
            ctx.strokeStyle = 'rgba(0, 240, 255, 0.05)';
            
            // Draw horizontal lines
            for (let y = 0; y < height; y += this.gridSpacing) {
                ctx.beginPath();
                for (let x = 0; x <= width + this.gridSampleStep; x += this.gridSampleStep) {
                    const wp = this.warpPoint(x, y);
                    if (x === 0) ctx.moveTo(wp.x, wp.y);
                    else ctx.lineTo(wp.x, wp.y);
                }
                ctx.stroke();
            }

            // Draw vertical lines
            for (let x = 0; x < width; x += this.gridSpacing) {
                ctx.beginPath();
                for (let y = 0; y <= height + this.gridSampleStep; y += this.gridSampleStep) {
                    const wp = this.warpPoint(x, y);
                    if (y === 0) ctx.moveTo(wp.x, wp.y);
                    else ctx.lineTo(wp.x, wp.y);
                }
                ctx.stroke();
            }
        }

        // 2. Draw Orbit Trails for Asteroids
        if (this.drawTrails) {
            const asteroids = this.physics.asteroids;
            const numAsteroids = asteroids.length;
            for (let i = 0; i < numAsteroids; i++) {
                const ast = asteroids[i];
                if (ast.destroyed || ast.trail.length < 2) continue;

                ctx.beginPath();
                ctx.moveTo(ast.trail[0].x, ast.trail[0].y);
                for (let k = 1; k < ast.trail.length; k++) {
                    ctx.lineTo(ast.trail[k].x, ast.trail[k].y);
                }

                // Create a fading gradient trail or just transparency fade
                ctx.strokeStyle = `rgba(${ast.hue < 220 ? '0, 240, 255' : ast.hue < 280 ? '163, 0, 255' : '255, 0, 127'}, 0.25)`;
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }
        }

        // 2.5. Draw Emitters
        const emitters = this.physics.emitters;
        const numEmitters = emitters.length;
        for (let i = 0; i < numEmitters; i++) {
            const e = emitters[i];
            if (!e.active) continue;

            // Draw field filling with low opacity
            ctx.beginPath();
            ctx.arc(e.pos.x, e.pos.y, e.fieldRadius, 0, Math.PI * 2);
            ctx.fillStyle = e.glowColor;
            ctx.fill();

            // Draw field boundary ring
            ctx.beginPath();
            ctx.arc(e.pos.x, e.pos.y, e.fieldRadius, 0, Math.PI * 2);
            ctx.strokeStyle = e.color;
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Mode-specific micro-animations
            if (e.mode === 'inversion') {
                // Expanding force rings
                const waveRadius = ((this.time * 0.6) % e.fieldRadius);
                ctx.beginPath();
                ctx.arc(e.pos.x, e.pos.y, waveRadius, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(255, 85, 0, ${1.0 - waveRadius / e.fieldRadius})`;
                ctx.lineWidth = 1.0;
                ctx.stroke();
            } else if (e.mode === 'shield') {
                // Faint inner static grid patterns
                ctx.beginPath();
                ctx.arc(e.pos.x, e.pos.y, e.fieldRadius - 15, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(227, 232, 248, 0.12)';
                ctx.lineWidth = 1.0;
                ctx.stroke();
            } else if (e.mode === 'diverter') {
                // Rotating dashed circular indicators
                ctx.beginPath();
                ctx.arc(e.pos.x, e.pos.y, e.fieldRadius - 10, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(0, 240, 255, 0.2)';
                ctx.lineWidth = 1.0;
                ctx.setLineDash([5, 10]);
                ctx.lineDashOffset = -this.time * 0.3;
                ctx.stroke();
                ctx.setLineDash([]);
            }

            // Draw center hub device
            ctx.beginPath();
            ctx.arc(e.pos.x, e.pos.y, 7, 0, Math.PI * 2);
            ctx.fillStyle = e.color;
            ctx.shadowColor = e.color;
            ctx.shadowBlur = 8;
            ctx.fill();
            ctx.shadowBlur = 0; // reset shadow

            ctx.beginPath();
            ctx.arc(e.pos.x, e.pos.y, 3, 0, Math.PI * 2);
            ctx.fillStyle = '#07080d';
            ctx.fill();

            // Draw horizontal energy bar beneath emitter
            const barW = 36;
            const barH = 3;
            const bx = e.pos.x - barW / 2;
            const by = e.pos.y + 16;
            
            // Background
            ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
            ctx.fillRect(bx, by, barW, barH);
            
            // Foreground (green to red transition depending on power)
            const energyHue = e.energy * 1.2; // 0 to 120 degrees (red to green)
            ctx.fillStyle = `hsl(${energyHue}, 90%, 50%)`;
            ctx.fillRect(bx, by, barW * (e.energy / 100), barH);
        }

        // 2.7. Draw Structural Links
        const links = this.physics.structuralLinks;
        const numLinks = links.length;
        for (let i = 0; i < numLinks; i++) {
            const link = links[i];
            if (link.snapped) continue;

            const a = link.bodyA;
            const b = link.bodyB;

            const stress = Math.min(Math.abs(link.strainForce) / link.maxStrain, 1.0);

            // Strain color coding interpolation:
            // Neon Green (0%) -> Yellow (50%) -> Crimson Red (90%+)
            let strokeColor;
            if (stress < 0.5) {
                const ratio = stress / 0.5;
                const r = Math.round(57 + ratio * (255 - 57));
                const g = Math.round(255);
                const bVal = Math.round(20 - ratio * 20);
                strokeColor = `rgb(${r}, ${g}, ${bVal})`;
            } else if (stress < 0.9) {
                const ratio = (stress - 0.5) / 0.4;
                const r = Math.round(255);
                const g = Math.round(255 - ratio * 217);
                const bVal = Math.round(0 + ratio * 38);
                strokeColor = `rgb(${r}, ${g}, ${bVal})`;
            } else {
                const blink = Math.sin(this.time * 0.45) > 0;
                strokeColor = blink ? 'rgb(255, 56, 56)' : 'rgb(90, 10, 10)';
            }

            // Highlight outline when hovered
            if (this.hoveredLink === link) {
                ctx.beginPath();
                ctx.moveTo(a.pos.x, a.pos.y);
                ctx.lineTo(b.pos.x, b.pos.y);
                ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
                ctx.lineWidth = 1.5 + stress * 2.5 + 4;
                ctx.stroke();
            }

            // Draw primary spring structural line
            ctx.beginPath();
            ctx.moveTo(a.pos.x, a.pos.y);
            ctx.lineTo(b.pos.x, b.pos.y);
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = 1.5 + stress * 2.5; // grows thicker under load
            ctx.stroke();

            // Draw connector node joint caps
            ctx.beginPath();
            ctx.arc(a.pos.x, a.pos.y, 3, 0, Math.PI * 2);
            ctx.fillStyle = strokeColor;
            ctx.fill();

            ctx.beginPath();
            ctx.arc(b.pos.x, b.pos.y, 3, 0, Math.PI * 2);
            ctx.fillStyle = strokeColor;
            ctx.fill();
        }

        // 3. Draw Central Singularity (Core Black Hole)
        const core = this.physics.core;
        
        // Pulse factors
        const pulse = Math.sin(this.time * 0.03) * 1.5;
        const outerRadius = core.radius + pulse;
        
        // Accretion disk radial gradient glow
        const grad = ctx.createRadialGradient(
            core.pos.x, core.pos.y, core.radius * 0.4,
            core.pos.x, core.pos.y, outerRadius * 2.8
        );
        grad.addColorStop(0, '#000000');
        grad.addColorStop(0.15, 'rgba(0, 0, 0, 1)');
        grad.addColorStop(0.3, 'rgba(255, 0, 127, 0.7)');  // Accretion disk edge (hot magenta)
        grad.addColorStop(0.55, 'rgba(0, 240, 255, 0.2)');  // Corona (electric cyan)
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.beginPath();
        ctx.arc(core.pos.x, core.pos.y, outerRadius * 3, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        // Solid event horizon core
        ctx.beginPath();
        ctx.arc(core.pos.x, core.pos.y, core.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#020306';
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0; // Reset shadow

        // Faint border on event horizon
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // 4. Draw Active Asteroids
        const asteroids = this.physics.asteroids;
        const numAsteroids = asteroids.length;
        for (let i = 0; i < numAsteroids; i++) {
            const ast = asteroids[i];
            if (ast.destroyed) continue;

            // Neon outer glow for asteroid
            ctx.shadowColor = ast.color;
            ctx.shadowBlur = Math.min(ast.radius * 0.8, 15);
            
            ctx.beginPath();
            ctx.arc(ast.pos.x, ast.pos.y, ast.radius, 0, Math.PI * 2);
            ctx.fillStyle = ast.color;
            ctx.fill();
            
            // Reset shadows immediately
            ctx.shadowBlur = 0;

            // Draw core density (dark overlay inside asteroid)
            ctx.beginPath();
            ctx.arc(ast.pos.x, ast.pos.y, ast.radius * 0.4, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
            ctx.fill();

            // Center of mass dot
            ctx.beginPath();
            ctx.arc(ast.pos.x, ast.pos.y, 1.5, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();

            // Draw Vectors
            if (this.drawVectors) {
                // Velocity vector (Cyan)
                const velEnd = Vector2D.add(ast.pos, Vector2D.mult(ast.vel, this.velocityScale));
                this.drawArrow(ast.pos, velEnd, '#00f0ff');

                // Net gravity vector (Magenta or Cyan when inside anti-gravity)
                const accVec = ast.lastAcc || ast.acc;
                const accEnd = Vector2D.add(ast.pos, Vector2D.mult(accVec, this.accelerationScale));
                const vectorColor = ast.inAntiGravityField ? '#00f0ff' : '#ff007f';
                this.drawArrow(ast.pos, accEnd, vectorColor);
            }
        }
    }

    /**
     * Helper to draw a sleek arrow representing vectors
     */
    drawArrow(from, to, color, size = 6) {
        const ctx = this.ctx;
        
        // Skip drawing if vector magnitude is tiny to avoid visual clutter
        const dist = from.dist(to);
        if (dist < 3) return;

        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Arrowhead math
        const angle = Math.atan2(to.y - from.y, to.x - from.x);
        ctx.beginPath();
        ctx.moveTo(to.x, to.y);
        ctx.lineTo(
            to.x - size * Math.cos(angle - Math.PI / 6),
            to.y - size * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
            to.x - size * Math.cos(angle + Math.PI / 6),
            to.y - size * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
    }

    /**
     * Orbit prediction projector for drag-to-spawn flings
     */
    drawOrbitPrediction(startPos, startVel, steps = 240) {
        const ctx = this.ctx;
        let p = startPos.copy();
        let v = startVel.copy();
        const dt = 1 / 30; // Predicted simulation step size
        
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        
        // Fast Euler simulation loop of 2-body orbit path
        for (let i = 0; i < steps; i++) {
            const toCore = Vector2D.sub(this.physics.core.pos, p);
            const distSq = toCore.magSq();
            const dist = Math.sqrt(distSq);

            // Stop predicting if asteroid crashes into core event horizon
            if (dist < this.physics.core.radius * 0.8) break;

            const fMag = (this.physics.g * this.physics.core.mass) / (distSq + this.physics.epsilonSq);
            const acc = toCore.normalize().mult(fMag);

            v.add(Vector2D.mult(acc, dt));
            p.add(Vector2D.mult(v, dt));

            if (i % 2 === 0) { // Render every 2 steps to increase draw efficiency
                ctx.lineTo(p.x, p.y);
            }
        }

        ctx.strokeStyle = 'rgba(0, 240, 255, 0.35)';
        ctx.setLineDash([4, 6]);
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.setLineDash([]); // Reset dash style
    }

    /**
     * Helper to draw a circle outline indicating ideal stable circular orbits
     */
    drawStableOrbitCircle(pos) {
        const ctx = this.ctx;
        const corePos = this.physics.core.pos;
        const radius = pos.dist(corePos);

        ctx.beginPath();
        ctx.arc(corePos.x, corePos.y, radius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.15)';
        ctx.setLineDash([2, 4]);
        ctx.lineWidth = 1.0;
        ctx.stroke();
        ctx.setLineDash([]);
    }
}
