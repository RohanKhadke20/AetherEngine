import { Vector2D } from './vector.js';
import { Asteroid } from './asteroid.js';

export class UIManager {
    constructor(physicsEngine, renderer) {
        this.physics = physicsEngine;
        this.renderer = renderer;
        
        // UI State Variables
        this.isPaused = false;
        this.spawnMass = 50;
        this.dragStart = null;
        this.mousePos = new Vector2D(0, 0);
        this.isDragging = false;
        this.hoveredAsteroid = null;
        
        // Phase 2 Tool State
        this.activeTool = 'fling'; 
        
        // Phase 3 state trackers
        this.dragStartBody = null;
        this.hoveredLink = null;
        
        // Drag settings
        this.dragVelocityScale = 0.6; // Scale drag length to velocity vector

        // Create Telemetry Tooltip in DOM
        this.tooltip = document.createElement('div');
        this.tooltip.className = 'telemetry-tooltip';
        this.tooltip.style.display = 'none';
        document.body.appendChild(this.tooltip);

        // Bind DOM elements
        this.initDOMElements();
        this.bindEvents();
        
        // Register physics log listener
        this.physics.onLog = (msg, type) => this.addTerminalLog(msg, type);
    }

    initDOMElements() {
        this.btnPlayPause = document.getElementById('btn-play-pause');
        this.btnRestart = document.getElementById('btn-restart');
        this.btnClear = document.getElementById('btn-clear');

        this.sliderG = document.getElementById('slider-g');
        this.sliderCoreMass = document.getElementById('slider-core-mass');
        this.sliderSpawnMass = document.getElementById('slider-spawn-mass');

        this.valG = document.getElementById('val-g');
        this.valCoreMass = document.getElementById('val-core-mass');
        this.valSpawnMass = document.getElementById('val-spawn-mass');

        this.toggleVectors = document.getElementById('toggle-vectors');
        this.toggleGrid = document.getElementById('toggle-grid');
        this.toggleTrails = document.getElementById('toggle-trails');

        this.statCount = document.getElementById('stat-count');
        this.statMass = document.getElementById('stat-mass');
        this.statConsumed = document.getElementById('stat-consumed');
        this.statFps = document.getElementById('stat-fps');

        this.logTerminal = document.getElementById('log-terminal');
        
        // Hotbar buttons
        this.hotbarButtons = document.querySelectorAll('.hotbar-btn');
        
        // Phase 3 Stats element
        this.statLinks = document.getElementById('stat-links');

        // Phase 4 Strategic HUD & Modal elements
        this.hudStabilityVal = document.getElementById('hud-stability-val');
        this.hudFuelVal = document.getElementById('hud-fuel-val');
        this.hudCreditsVal = document.getElementById('hud-credits-val');
        this.hudTimeVal = document.getElementById('hud-time-val');
        this.gameOverOverlay = document.getElementById('game-over-overlay');
        this.btnGoRestart = document.getElementById('btn-go-restart');
        this.goTime = document.getElementById('go-time');
        this.goMined = document.getElementById('go-mined');
        this.goScore = document.getElementById('go-score');
    }

    bindEvents() {
        const canvas = this.renderer.canvas;

        // Simulation control listeners
        this.btnPlayPause.addEventListener('click', () => this.toggleSimulationPause());
        this.btnRestart.addEventListener('click', () => this.restartSimulation());
        this.btnClear.addEventListener('click', () => this.physics.clearAsteroids());
        if (this.btnGoRestart) {
            this.btnGoRestart.addEventListener('click', () => this.restartSimulation());
        }

        // Physics constants slider updates
        this.sliderG.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            this.physics.setG(val);
            this.valG.textContent = val.toFixed(2);
        });

        this.sliderCoreMass.addEventListener('input', (e) => {
            const val = parseInt(e.target.value, 10);
            this.physics.setCoreMass(val);
            this.valCoreMass.textContent = val.toLocaleString();
        });

        this.sliderSpawnMass.addEventListener('input', (e) => {
            this.spawnMass = parseInt(e.target.value, 10);
            this.valSpawnMass.textContent = this.spawnMass;
        });

        // Toggles mapping
        this.toggleVectors.addEventListener('change', (e) => this.renderer.setDrawVectors(e.target.checked));
        this.toggleGrid.addEventListener('change', (e) => this.renderer.setDrawGrid(e.target.checked));
        this.toggleTrails.addEventListener('change', (e) => this.renderer.setDrawTrails(e.target.checked));

        // Click-and-drag asteroid spawning & Mouse hovers
        canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        window.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        
        // Prevent context menu for right-click recycling
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        // Hotbar tool selector buttons
        this.hotbarButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const tool = btn.getAttribute('data-tool');
                this.selectTool(tool);
            });
        });

        // Keyboard hotkeys mapping [1-5]
        window.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT') return; // ignore when slider has focus
            if (e.key === '1') this.selectTool('fling');
            else if (e.key === '2') this.selectTool('inversion');
            else if (e.key === '3') this.selectTool('shield');
            else if (e.key === '4') this.selectTool('diverter');
            else if (e.key === '5') this.selectTool('link');
            else if (e.code === 'Space') {
                e.preventDefault();
                this.togglePlayPause();
            }
            else if (e.key === 'r' || e.key === 'R') this.restartSimulation();
            else if (e.key === 'c' || e.key === 'C') this.clearAsteroids();
        });
    }

    selectTool(tool) {
        this.activeTool = tool;
        this.hotbarButtons.forEach(btn => {
            if (btn.getAttribute('data-tool') === tool) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        let desc = "";
        if (tool === 'fling') desc = "Fling Asteroid mode: click-and-drag coordinates to launch.";
        else if (tool === 'inversion') desc = "Inversion Field: pushes asteroids away from core.";
        else if (tool === 'shield') desc = "Zero-G Shield: neutralizes gravity internally.";
        else if (tool === 'diverter') desc = "Diverter Field: redirects asteroids tangentially.";
        else if (tool === 'link') desc = "Structural Beam: click-and-drag node-to-node to connect entities.";
        
        this.addTerminalLog(`Tool active: ${desc}`, "system-line");
    }

    toggleSimulationPause() {
        this.isPaused = !this.isPaused;
        if (this.isPaused) {
            this.btnPlayPause.innerHTML = '<span class="icon">▶</span> <span class="label">PLAY</span>';
            this.btnPlayPause.classList.remove('glow-cyan');
            this.btnPlayPause.classList.add('btn-primary');
            this.addTerminalLog("Simulation core suspended.", "warning-line");
        } else {
            this.btnPlayPause.innerHTML = '<span class="icon">⏸</span> <span class="label">PAUSE</span>';
            this.btnPlayPause.classList.remove('btn-primary');
            this.btnPlayPause.classList.add('glow-cyan');
            this.addTerminalLog("Simulation core running.", "system-line");
        }
    }

    restartSimulation() {
        this.physics.resetGame();
        this.isPaused = false;
        this.btnPlayPause.innerHTML = '<span class="icon">⏸</span> <span class="label">PAUSE</span>';
        this.btnPlayPause.classList.remove('btn-primary');
        this.btnPlayPause.classList.add('glow-cyan');
        
        // Reset constants sliders
        this.physics.setG(0.15);
        this.physics.setCoreMass(100000);
        this.sliderG.value = 0.15;
        this.sliderCoreMass.value = 100000;
        this.valG.textContent = "0.15";
        this.valCoreMass.textContent = "100000";
        
        // Hide Game Over Overlay
        if (this.gameOverOverlay) {
            this.gameOverOverlay.style.display = 'none';
        }
        
        // Respawn initial orbital ring
        this.spawnInitialOrbitalRing();
        this.addTerminalLog("Sector reset complete. Orbital ring redeployed.", "system-line");
    }

    spawnInitialOrbitalRing() {
        const center = this.physics.core.pos;
        const count = 7;
        for (let i = 0; i < count; i++) {
            // Distance from core: spaced out between 120 and 320 px
            const radius = 140 + i * 35 + Math.random() * 15;
            const angle = (i * (Math.PI * 2) / count) + Math.random() * 0.4;
            
            const x = center.x + Math.cos(angle) * radius;
            const y = center.y + Math.sin(angle) * radius;
            
            const ast = new Asteroid(x, y, 0, 0, 10 + Math.random() * 60);
            
            // Calculate perfect circular orbital velocity
            const orbitVel = this.physics.calculateStableOrbitVelocity(ast.pos, true);
            ast.vel = orbitVel;
            
            this.physics.addAsteroid(ast);
        }
    }

    handleMouseDown(e) {
        if (this.physics.isGameOver) return;

        const rect = this.renderer.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Right click -> recycle existing emitter or structural beam
        if (e.button === 2) {
            let removed = this.physics.removeEmitterAt(mouseX, mouseY);
            
            // If no emitter was removed, try recycling a hovered beam link
            if (!removed && this.hoveredLink) {
                const idx = this.physics.structuralLinks.indexOf(this.hoveredLink);
                if (idx !== -1) {
                    const link = this.hoveredLink;
                    this.physics.structuralLinks.splice(idx, 1);
                    this.physics.log(`Recycled Beam #${link.id}. Materials reclaimed.`, "warning-line");
                    this.hoveredLink = null;
                    this.renderer.hoveredLink = null;
                    removed = true;
                }
            }

            if (removed) {
                e.preventDefault();
            }
            return;
        }

        if (e.button !== 0) return; // Left click only below

        if (this.activeTool === 'fling') {
            this.dragStart = new Vector2D(mouseX, mouseY);
            this.mousePos.set(mouseX, mouseY);
            this.isDragging = true;
        } else if (this.activeTool === 'link') {
            // Find click target node (Core or Asteroid)
            let clickedBody = null;
            const distToCore = this.mousePos.dist(this.physics.core.pos);
            
            if (distToCore < this.physics.core.radius) {
                clickedBody = this.physics.core;
            } else {
                for (let ast of this.physics.asteroids) {
                    if (!ast.destroyed && this.mousePos.dist(ast.pos) < ast.radius + 8) {
                        clickedBody = ast;
                        break;
                    }
                }
            }

            if (clickedBody) {
                this.dragStartBody = clickedBody;
                this.dragStart = new Vector2D(mouseX, mouseY);
                this.isDragging = true;
            }
        } else {
            // Deploy Emitter static device
            if (this.physics.aetherFuel < 25.0) {
                this.addTerminalLog(`[DEPLOY FAIL] Insufficient Aether Fuel (25.0 units required, current: ${this.physics.aetherFuel.toFixed(1)}).`, "warning-line");
                return;
            }
            this.physics.addEmitter(mouseX, mouseY, this.activeTool);
        }
    }

    handleMouseMove(e) {
        if (this.physics.isGameOver) {
            this.hoveredAsteroid = null;
            this.hoveredLink = null;
            this.renderer.hoveredLink = null;
            this.tooltip.style.display = 'none';
            return;
        }

        const rect = this.renderer.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        this.mousePos.set(mouseX, mouseY);

        // Check if mouse is hovering over an asteroid
        let foundHover = null;
        const asteroids = this.physics.asteroids;
        const numAsteroids = asteroids.length;
        
        for (let i = 0; i < numAsteroids; i++) {
            const ast = asteroids[i];
            if (ast.destroyed) continue;
            
            const dist = this.mousePos.dist(ast.pos);
            if (dist < ast.radius + 12) {
                foundHover = ast;
                break;
            }
        }

        this.hoveredAsteroid = foundHover;

        // Link Segment Hover Check (only if not currently deploying a beam)
        if (this.isDragging && this.activeTool === 'link') {
            this.hoveredLink = null;
            this.renderer.hoveredLink = null;
        } else {
            let nearestLink = null;
            let minDist = 8.0; // Selection distance tolerance in pixels

            const links = this.physics.structuralLinks;
            const numLinks = links.length;
            for (let i = 0; i < numLinks; i++) {
                const link = links[i];
                if (link.snapped) continue;

                const p1 = link.bodyA.pos;
                const p2 = link.bodyB.pos;
                const m = this.mousePos;

                // Segment line projection: t = dot(M-P1, P2-P1) / |P2-P1|^2
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const lSq = dx * dx + dy * dy;

                if (lSq === 0) continue;

                let t = ((m.x - p1.x) * dx + (m.y - p1.y) * dy) / lSq;
                t = Math.max(0, Math.min(1, t)); // clamp to segment

                const px = p1.x + t * dx;
                const py = p1.y + t * dy;

                const dist = Math.sqrt((m.x - px) * (m.x - px) + (m.y - py) * (m.y - py));
                if (dist < minDist) {
                    minDist = dist;
                    nearestLink = link;
                }
            }

            this.hoveredLink = nearestLink;
            this.renderer.hoveredLink = nearestLink;
        }

        this.updateTooltipPosition(e.clientX, e.clientY);
    }

    handleMouseUp(e) {
        if (!this.isDragging) return;
        this.isDragging = false;
        
        const start = this.dragStart;
        const end = this.mousePos;
        this.dragStart = null;

        if (this.activeTool === 'link') {
            if (this.dragStartBody) {
                // Find release target node (Core or Asteroid)
                let releaseBody = null;
                const distToCore = this.mousePos.dist(this.physics.core.pos);
                if (distToCore < this.physics.core.radius) {
                    releaseBody = this.physics.core;
                } else {
                    for (let ast of this.physics.asteroids) {
                        if (!ast.destroyed && this.mousePos.dist(ast.pos) < ast.radius + 8) {
                            releaseBody = ast;
                            break;
                        }
                    }
                }

                if (releaseBody && releaseBody !== this.dragStartBody) {
                    this.physics.addStructuralLink(this.dragStartBody, releaseBody);
                }
                this.dragStartBody = null;
            }
            return;
        }
        
        if (!start) return;
        const dragDist = start.dist(end);
        let vx, vy;
        
        if (dragDist < 5) {
            // Click-to-spawn without drag -> automatic circular orbit!
            const orbitVel = this.physics.calculateStableOrbitVelocity(start, true);
            vx = orbitVel.x;
            vy = orbitVel.y;
        } else {
            // Fling spawn: Velocity proportional to drag vector direction and length
            const dragVector = Vector2D.sub(end, start);
            const launchVel = Vector2D.mult(dragVector, this.dragVelocityScale);
            vx = launchVel.x;
            vy = launchVel.y;
        }
        
        // Spawn the asteroid
        const ast = new Asteroid(start.x, start.y, vx, vy, this.spawnMass);
        this.physics.addAsteroid(ast);
        this.addTerminalLog(`Launched Asteroid #${ast.id} (Mass: ${this.spawnMass}).`, "system-line");
    }

    updateTooltipPosition(clientX, clientY) {
        if (this.hoveredAsteroid) {
            const ast = this.hoveredAsteroid;
            const corePos = this.physics.core.pos;
            const distToCore = ast.pos.dist(corePos);
            const netAcc = (ast.lastAcc || ast.acc).mag();

            this.tooltip.style.display = 'block';
            this.tooltip.style.left = `${clientX + 16}px`;
            this.tooltip.style.top = `${clientY - 20}px`;

            this.tooltip.innerHTML = `
                <h4>ASTEROID SECTOR DATA</h4>
                <div class="tooltip-row">
                    <span class="tooltip-label">ID:</span>
                    <span class="tooltip-value">#${ast.id}</span>
                </div>
                <div class="tooltip-row">
                    <span class="tooltip-label">Mass:</span>
                    <span class="tooltip-value">${Math.round(ast.mass)} kT</span>
                </div>
                <div class="tooltip-row">
                    <span class="tooltip-label">Velocity:</span>
                    <span class="tooltip-value">${(ast.vel.mag() * 12.5).toFixed(1)} km/s</span>
                </div>
                <div class="tooltip-row">
                    <span class="tooltip-label">Core Range:</span>
                    <span class="tooltip-value">${(distToCore * 18.2).toFixed(0)} km</span>
                </div>
                <div class="tooltip-row">
                    <span class="tooltip-label">Net Gravity:</span>
                    <span class="tooltip-value">${(netAcc * 150).toFixed(2)} m/s²</span>
                </div>
            `;
        } else if (this.hoveredLink) {
            const link = this.hoveredLink;
            const stress = Math.min(Math.abs(link.strainForce) / link.maxStrain, 1.0);
            
            const nameA = link.bodyA === this.physics.core ? "Singularity Core" : `Asteroid #${link.bodyA.id}`;
            const nameB = link.bodyB === this.physics.core ? "Singularity Core" : `Asteroid #${link.bodyB.id}`;

            this.tooltip.style.display = 'block';
            this.tooltip.style.left = `${clientX + 16}px`;
            this.tooltip.style.top = `${clientY - 20}px`;

            this.tooltip.innerHTML = `
                <h4>BEAM LOAD ANALYZER</h4>
                <div class="tooltip-row">
                    <span class="tooltip-label">Beam ID:</span>
                    <span class="tooltip-value">#${link.id}</span>
                </div>
                <div class="tooltip-row">
                    <span class="tooltip-label">Connect:</span>
                    <span class="tooltip-value" style="font-size: 0.65rem;">${nameA} ⟷ ${nameB}</span>
                </div>
                <div class="tooltip-row">
                    <span class="tooltip-label">Strain Force:</span>
                    <span class="tooltip-value">${Math.abs(link.strainForce).toFixed(1)} / ${link.maxStrain} kN</span>
                </div>
                <div class="tooltip-row">
                    <span class="tooltip-label">Load Stress:</span>
                    <span class="tooltip-value" style="color: ${stress > 0.9 ? '#ff3838' : stress > 0.5 ? '#ffc400' : '#39ff14'}; font-weight: 700;">${(stress * 100).toFixed(1)}%</span>
                </div>
            `;
        } else {
            this.tooltip.style.display = 'none';
        }
    }

    addTerminalLog(msg, type = "system-line") {
        const line = document.createElement('div');
        line.className = `log-line ${type}`;
        
        const timestamp = new Date().toLocaleTimeString('en-US', { 
            hour12: false, 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
        });
        
        line.innerHTML = `<span style="color: var(--color-gray);">[${timestamp}]</span> ${msg}`;
        this.logTerminal.appendChild(line);
        
        // Restrict terminal scroll height memory
        while (this.logTerminal.children.length > 60) {
            this.logTerminal.removeChild(this.logTerminal.firstChild);
        }
        
        // Auto scroll to bottom
        this.logTerminal.scrollTop = this.logTerminal.scrollHeight;
    }

    updateStats(fpsValue) {
        // Calculate sandbox totals
        const count = this.physics.asteroids.length;
        let totalMass = 0;
        for (let i = 0; i < count; i++) {
            totalMass += this.physics.asteroids[i].mass;
        }

        this.statCount.textContent = count;
        this.statMass.textContent = Math.round(totalMass).toLocaleString() + " kT";
        this.statConsumed.textContent = this.physics.consumedCount;
        this.statFps.textContent = fpsValue.toFixed(1);
        
        // Update active links count
        if (this.statLinks) {
            this.statLinks.textContent = this.physics.structuralLinks.length;
        }

        // Update strategic game HUD elements
        if (this.hudStabilityVal) {
            this.hudStabilityVal.textContent = `${Math.max(0, Math.round(this.physics.coreStability))}%`;
            if (this.physics.coreStability < 30.0) {
                this.hudStabilityVal.classList.add('blink-red');
            } else {
                this.hudStabilityVal.classList.remove('blink-red');
            }
        }
        if (this.hudFuelVal) {
            this.hudFuelVal.textContent = this.physics.aetherFuel.toFixed(1);
            if (this.physics.aetherFuel < 25.0) {
                this.hudFuelVal.classList.add('blink-red');
            } else {
                this.hudFuelVal.classList.remove('blink-red');
            }
        }
        if (this.hudCreditsVal) {
            this.hudCreditsVal.textContent = `${Math.round(this.physics.credits)} kT`;
        }
        if (this.hudTimeVal) {
            this.hudTimeVal.textContent = `${Math.round(this.physics.elapsedTime)}s`;
        }

        // Handle Game Over modal trigger
        if (this.physics.isGameOver) {
            if (this.gameOverOverlay && this.gameOverOverlay.style.display !== 'flex') {
                this.gameOverOverlay.style.display = 'flex';
                
                // Set score details
                const survivalTime = Math.round(this.physics.elapsedTime);
                const resourcesMined = Math.round(this.physics.credits);
                const finalScore = survivalTime + resourcesMined;
                
                if (this.goTime) this.goTime.textContent = `${survivalTime}s`;
                if (this.goMined) this.goMined.textContent = `${resourcesMined} kT`;
                if (this.goScore) this.goScore.textContent = finalScore;
                
                this.tooltip.style.display = 'none';
            }
        } else {
            if (this.gameOverOverlay && this.gameOverOverlay.style.display !== 'none') {
                this.gameOverOverlay.style.display = 'none';
            }
        }
    }

    drawDragPreview() {
        if (this.isDragging) {
            const start = this.dragStart;
            const end = this.mousePos;

            if (this.activeTool === 'link' && this.dragStartBody) {
                // Draw dashed blueprint structural beam connection preview
                this.renderer.ctx.beginPath();
                this.renderer.ctx.moveTo(this.dragStartBody.pos.x, this.dragStartBody.pos.y);
                this.renderer.ctx.lineTo(end.x, end.y);
                this.renderer.ctx.strokeStyle = 'rgba(57, 255, 20, 0.45)';
                this.renderer.ctx.lineWidth = 2.0;
                this.renderer.ctx.setLineDash([4, 4]);
                this.renderer.ctx.stroke();
                this.renderer.ctx.setLineDash([]);

                // Draw circular blueprint caps at endpoints
                this.renderer.ctx.beginPath();
                this.renderer.ctx.arc(this.dragStartBody.pos.x, this.dragStartBody.pos.y, 4, 0, Math.PI * 2);
                this.renderer.ctx.fillStyle = '#39ff14';
                this.renderer.ctx.fill();

                this.renderer.ctx.beginPath();
                this.renderer.ctx.arc(end.x, end.y, 3, 0, Math.PI * 2);
                this.renderer.ctx.fillStyle = '#39ff14';
                this.renderer.ctx.fill();
            } else if (this.activeTool === 'fling' && start) {
                // Draw drag preview line (dashed launcher vector)
                this.renderer.ctx.beginPath();
                this.renderer.ctx.moveTo(start.x, start.y);
                this.renderer.ctx.lineTo(end.x, end.y);
                this.renderer.ctx.strokeStyle = 'rgba(0, 240, 255, 0.6)';
                ctx_lineWidth_setup: {
                    this.renderer.ctx.lineWidth = 1.5;
                }
                this.renderer.ctx.stroke();

                // Draw spawn position dot indicator
                this.renderer.ctx.beginPath();
                this.renderer.ctx.arc(start.x, start.y, 4, 0, Math.PI * 2);
                this.renderer.ctx.fillStyle = '#00f0ff';
                this.renderer.ctx.fill();

                // Draw predicted launch velocity orbit trail projector
                const dragVector = Vector2D.sub(end, start);
                const launchVel = Vector2D.mult(dragVector, this.dragVelocityScale);
                
                // Draw prediction
                this.renderer.drawOrbitPrediction(start, launchVel);

                // Draw reference circle for stable orbit distance
                this.renderer.drawStableOrbitCircle(start);
            }
        }
    }
}
