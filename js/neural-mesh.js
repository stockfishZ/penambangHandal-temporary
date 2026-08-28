/**
 * NiTERRA Subsurface Strata Wave (v14.0 — Geological Horizon Generator)
 * Interactive 3D generative subsurface geological horizons:
 * - Limonite (Champagne & Amber Gold)
 * - Saprolite (Luminous Emerald & Nickel Jade)
 * - Ultramafic Bedrock (Deep Mineral Teal & Electric Cyan)
 * Features real-time magnetic fluid warp, kinetic sonar ripples, and crystalline mineral assays.
 */

class StrataWaveVisualizer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');

    this.width = 0;
    this.height = 0;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    // Multi-Horizon Stratigraphic Layers (18 cascading strata ribbons)
    this.layerCount = 18;
    this.samplesPerLayer = 72;

    // Physical Grid Node Matrix
    this.grid = [];
    this.initGrid();

    // Mouse Tracking with Smooth Inertia
    this.mouse = {
      x: -2000,
      y: -2000,
      targetX: -2000,
      targetY: -2000,
      vx: 0,
      vy: 0,
      isHovering: false,
      influenceRadius: 160,
      pulseEnergy: 0
    };

    // Harmonic Geological Time
    this.waveTime = 0;
    this.baseSpeed = 0.0022;

    // Mineral Stratigraphic Color Palette
    this.colors = {
      goldLight:     { r: 254, g: 240, b: 138 }, // Specular Limonite Crystal
      goldCrest:     { r: 245, g: 200, b: 85 },  // Champagne Gold Horizon
      goldDeep:      { r: 226, g: 163, b: 86 },  // Amber Ore Matrix
      emeraldBright: { r: 52,  g: 211, b: 153 }, // Radiant Supergene Nickel
      emeraldMid:    { r: 16,  g: 185, b: 129 }, // Saprolite Green Core
      tealDeep:      { r: 14,  g: 116, b: 144 }, // Bedrock Serpentinite
      cyanGlow:      { r: 56,  g: 189, b: 248 }, // Geophysical TMI Pulse
      darkBase:      { r: 7,   g: 11,  b: 9 }    // Volumetric Void
    };

    this.init();
  }

  initGrid() {
    this.grid = [];
    for (let l = 0; l < this.layerCount; l++) {
      const layer = [];
      for (let s = 0; s < this.samplesPerLayer; s++) {
        layer.push({
          warpY: 0,
          warpX: 0,
          warpZ: 0,
          glow: 0,
          projX: 0,
          projY: 0,
          scale: 1,
          depthFog: 1,
          edgeFade: 1,
          normH: 0.5,
          twinkle: Math.random() * Math.PI * 2
        });
      }
      this.grid.push(layer);
    }
  }

  init() {
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.bindEvents();

    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  resize() {
    const parent = this.canvas.parentElement;
    this.width = parent ? parent.clientWidth : window.innerWidth;
    this.height = Math.max(260, Math.min(340, Math.round(window.innerHeight * 0.32)));

    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;

    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(this.dpr, this.dpr);
  }

  bindEvents() {
    const updateMousePos = (clientX, clientY) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;

      if (x >= -60 && x <= this.width + 60 && y >= -60 && y <= this.height + 60) {
        this.mouse.targetX = x;
        this.mouse.targetY = y;
        this.mouse.isHovering = true;
      } else {
        this.mouse.isHovering = false;
      }
    };

    window.addEventListener('mousemove', (e) => updateMousePos(e.clientX, e.clientY));
    this.canvas.addEventListener('mousemove', (e) => updateMousePos(e.clientX, e.clientY));

    window.addEventListener('mouseleave', () => {
      this.mouse.isHovering = false;
    });

    this.canvas.addEventListener('click', (e) => {
      updateMousePos(e.clientX, e.clientY);
      this.triggerBurst();
    });

    // Mobile / Tablet Touch Interactions
    this.canvas.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) {
        updateMousePos(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    this.canvas.addEventListener('touchend', () => {
      this.mouse.isHovering = false;
    });
  }

  triggerBurst() {
    this.mouse.pulseEnergy = 1.0;
  }

  update() {
    this.waveTime += this.baseSpeed;

    // Decay kinetic pulse energy
    if (this.mouse.pulseEnergy > 0.01) {
      this.mouse.pulseEnergy *= 0.94;
    } else {
      this.mouse.pulseEnergy = 0;
    }

    // Smooth Mouse Tracking with Spring Damper
    if (this.mouse.isHovering) {
      if (this.mouse.x === -2000) {
        this.mouse.x = this.mouse.targetX;
        this.mouse.y = this.mouse.targetY;
      } else {
        this.mouse.vx = this.mouse.targetX - this.mouse.x;
        this.mouse.vy = this.mouse.targetY - this.mouse.y;
        this.mouse.x += (this.mouse.targetX - this.mouse.x) * 0.16;
        this.mouse.y += (this.mouse.targetY - this.mouse.y) * 0.16;
      }
    } else {
      // Return gently toward center offscreen
      this.mouse.x += (-2000 - this.mouse.x) * 0.05;
    }

    const t = this.waveTime;
    const pitch = 0.42; // Cinematic 24 degree geological elevation angle
    const cosP = Math.cos(pitch);
    const sinP = Math.sin(pitch);
    const fov = 460;
    const cameraZ = 500;
    const originY = this.height * 0.52;

    // Compute Geometry and Magnetic Fluid Warp per Vertex
    for (let l = 0; l < this.layerCount; l++) {
      const layerNorm = l / (this.layerCount - 1); // 0 (Top / Limonite) to 1 (Bottom / Bedrock)
      const layerZBase = (layerNorm - 0.5) * 380;
      const layerPhase = l * 0.38;

      for (let s = 0; s < this.samplesPerLayer; s++) {
        const u = s / (this.samplesPerLayer - 1); // 0 to 1
        const node = this.grid[l][s];
        node.twinkle += 0.03;

        // 1. Natural Geological Tectonic Undulation
        const baseWorldX = (u - 0.5) * (this.width * 1.38);
        const zFold = Math.sin(u * Math.PI * 2.0 + layerPhase + t * 0.6) * 55;
        const baseWorldZ = layerZBase + zFold;

        // Broad Sweeping Multi-Harmonic Waves
        const wave1 = Math.sin(u * Math.PI * 2.2 + layerPhase + t * 1.2) * 32;
        const wave2 = Math.cos(u * Math.PI * 1.4 - t * 0.5 + layerPhase * 0.5) * 16;
        const wave3 = Math.sin(u * Math.PI * 4.0 + t * 0.8) * 6; // Micro-texture ripple
        const stratumOffset = (layerNorm - 0.5) * 44; // Vertical stratigraphic stratification
        const baseWorldY = wave1 + wave2 + wave3 + stratumOffset;

        // 2. Approximate Unwarped Projected Screen Coordinates for Interaction
        const yRot0 = baseWorldY * cosP - baseWorldZ * sinP;
        const zRot0 = baseWorldY * sinP + baseWorldZ * cosP;
        const scale0 = fov / (cameraZ + zRot0);
        const approxScreenX = this.width / 2 + baseWorldX * scale0;
        const approxScreenY = originY + yRot0 * scale0;

        // 3. Dynamic Magnetic Fluid Warp & Sonar Kinetic Wave
        let targetWarpY = 0;
        let targetWarpX = 0;
        let targetWarpZ = 0;
        let targetGlow = 0;

        if (this.mouse.isHovering && this.mouse.x !== -2000) {
          const dx = approxScreenX - this.mouse.x;
          const dy = approxScreenY - this.mouse.y;
          const dist = Math.hypot(dx, dy);

          if (dist < this.mouse.influenceRadius) {
            const factor = Math.cos((dist / this.mouse.influenceRadius) * Math.PI * 0.5);
            const ripple = Math.sin(dist * 0.035 - t * 6.0);
            const burstAmp = this.mouse.pulseEnergy * 10;

            // Very subtle and graceful magnetic lift & fluid ripple
            targetWarpY = -factor * (8 + ripple * 3 + burstAmp);
            targetWarpX = (dx / (dist || 1)) * factor * 3.5;
            targetWarpZ = (dy / (dist || 1)) * factor * 4.5;
            targetGlow = factor * 0.3;
          }
        }

        // Smooth Spring-Lerp Interpolation
        node.warpY += (targetWarpY - node.warpY) * 0.08;
        node.warpX += (targetWarpX - node.warpX) * 0.08;
        node.warpZ += (targetWarpZ - node.warpZ) * 0.08;
        node.glow += (targetGlow - node.glow) * 0.06;

        // 4. Combined 3D World Coordinates
        const finalWorldX = baseWorldX + node.warpX;
        const finalWorldY = baseWorldY + node.warpY;
        const finalWorldZ = baseWorldZ + node.warpZ;

        // 5. Final 3D Perspective Projection
        const yRot = finalWorldY * cosP - finalWorldZ * sinP;
        const zRot = finalWorldY * sinP + finalWorldZ * cosP;
        const scale = fov / (cameraZ + zRot);

        node.projX = this.width / 2 + finalWorldX * scale;
        node.projY = originY + yRot * scale;
        node.scale = scale;
        node.depthFog = Math.max(0.18, Math.min(1.0, (zRot + 280) / 540));
        node.edgeFade = Math.sin(u * Math.PI); // Soft fade at lateral edges
        node.normH = Math.max(0, Math.min(1, (finalWorldY + 80) / 160));
      }
    }
  }

  draw() {
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.update();

    // 1. Draw Transverse Seismic Depth Filaments (Subsurface Mesh Skeleton)
    for (let s = 0; s < this.samplesPerLayer; s += 3) {
      this.ctx.beginPath();
      for (let l = 0; l < this.layerCount; l++) {
        const pt = this.grid[l][s];
        if (l === 0) {
          this.ctx.moveTo(pt.projX, pt.projY);
        } else {
          this.ctx.lineTo(pt.projX, pt.projY);
        }
      }
      const filamentAlpha = (0.03 + this.grid[0][s].edgeFade * 0.08);
      this.ctx.strokeStyle = `rgba(52, 211, 153, ${filamentAlpha})`;
      this.ctx.lineWidth = 0.6;
      this.ctx.stroke();
    }

    // 2. Draw 18 Cascading Horizon Strata Strings
    for (let l = 0; l < this.layerCount; l++) {
      const layer = this.grid[l];
      const layerNorm = l / (this.layerCount - 1); // 0 (Top) to 1 (Bottom)

      // Smooth Spline Contour
      this.ctx.beginPath();
      for (let s = 0; s < this.samplesPerLayer; s++) {
        const pt = layer[s];
        if (s === 0) {
          this.ctx.moveTo(pt.projX, pt.projY);
        } else {
          const prev = layer[s - 1];
          const cpx = (prev.projX + pt.projX) * 0.5;
          const cpy = (prev.projY + pt.projY) * 0.5;
          this.ctx.quadraticCurveTo(prev.projX, prev.projY, cpx, cpy);
        }
      }

      // Geological Horizon Gradient Shading:
      // Top 35% -> Champagne Gold & Amber (Limonite Zone)
      // Mid 40% -> Emerald & Nickel Green (Saprolite Supergene Zone)
      // Bottom 25% -> Deep Teal & Cyan (Protolith Bedrock)
      let colorRGB = this.colors.emeraldMid;
      if (layerNorm < 0.35) {
        colorRGB = (l % 2 === 0) ? this.colors.goldCrest : this.colors.goldDeep;
      } else if (layerNorm > 0.75) {
        colorRGB = (l % 2 === 0) ? this.colors.cyanGlow : this.colors.tealDeep;
      } else {
        colorRGB = (l % 2 === 0) ? this.colors.emeraldBright : this.colors.emeraldMid;
      }

      const layerVisibility = 0.28 + layerNorm * 0.65;
      const alpha = layerVisibility * 0.85;

      this.ctx.strokeStyle = `rgba(${colorRGB.r}, ${colorRGB.g}, ${colorRGB.b}, ${alpha})`;
      this.ctx.lineWidth = 0.85 + layerNorm * 0.60;
      this.ctx.stroke();

      // 3. Draw Sparkling Mineral Assay Star Nodes (Crystalline Assays)
      for (let s = (l % 3); s < this.samplesPerLayer; s += 4) {
        const pt = layer[s];
        const twinkleFactor = 0.88 + 0.12 * Math.sin(pt.twinkle);
        const radius = Math.max(0.80, 1.15 * pt.scale * twinkleFactor);
        const nodeAlpha = Math.min(0.92, pt.edgeFade * pt.depthFog * (0.38 + pt.normH * 0.42 + pt.glow * 0.20));

        let nodeColor = colorRGB;
        if (pt.normH > 0.72) {
          nodeColor = this.colors.goldLight;
        } else if (pt.glow > 0.25) {
          nodeColor = this.colors.goldLight;
        }

        this.ctx.fillStyle = `rgba(${nodeColor.r}, ${nodeColor.g}, ${nodeColor.b}, ${nodeAlpha})`;
        this.ctx.beginPath();
        this.ctx.arc(pt.projX, pt.projY, radius, 0, Math.PI * 2);
        this.ctx.fill();

        // Very subtle specular halo for prominent assay nodes
        if (pt.glow > 0.2) {
          this.ctx.fillStyle = `rgba(${nodeColor.r}, ${nodeColor.g}, ${nodeColor.b}, ${pt.glow * 0.15})`;
          this.ctx.beginPath();
          this.ctx.arc(pt.projX, pt.projY, radius * 2.2, 0, Math.PI * 2);
          this.ctx.fill();
        }
      }
    }
  }

  animate() {
    this.draw();
    requestAnimationFrame(this.animate);
  }
}

// Auto-initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('neuralCanvas')) {
    window.neuralCore = new StrataWaveVisualizer('neuralCanvas');
  }
});

