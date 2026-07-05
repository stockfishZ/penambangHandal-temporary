---
version: "alpha"
name: "STOKE — Engineer the future of scale"
description: "Stoke Engineer Pricing Section is designed for comparing plans and supporting conversion decisions. Key features include plan comparison blocks and conversion-oriented actions. It is suitable for subscription pricing pages and plan comparison experiences."
colors:
  primary: "#FFB04A"
  secondary: "#3A1602"
  tertiary: "#7EE08A"
  neutral: "#121212"
  background: "#FFB04A"
  surface: "#3A1602"
  text-primary: "#5C5249"
  text-secondary: "#8A7D70"
  border: "#FF9646"
  accent: "#FFB04A"
typography:
  display-lg:
    fontFamily: "Space Grotesk"
    fontSize: "45.1584px"
    fontWeight: 600
    lineHeight: "43.3521px"
    letterSpacing: "-0.025em"
  body-md:
    fontFamily: "Inter"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "22.68px"
  label-md:
    fontFamily: "Inter"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: "20px"
    letterSpacing: "0.14px"
rounded:
  full: "9999px"
spacing:
  base: "6px"
  sm: "1px"
  md: "1.2px"
  lg: "6px"
  xl: "8px"
  gap: "4px"
  card-padding: "13px"
components:
  button-primary:
    textColor: "#1A0D05"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    padding: "12px"
  button-link:
    textColor: "#CDBFB2"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    padding: "12px"
---

## Overview

- **Composition cues:**
  - Layout: Grid
  - Content Width: Full Bleed
  - Framing: Glassy
  - Grid: Strong

## Colors

The color system uses light mode with #FFB04A as the main accent and #121212 as the neutral foundation.

- **Primary (#FFB04A):** Main accent and emphasis color.
- **Secondary (#3A1602):** Supporting accent for secondary emphasis.
- **Tertiary (#7EE08A):** Reserved accent for supporting contrast moments.
- **Neutral (#121212):** Neutral foundation for backgrounds, surfaces, and supporting chrome.

- **Usage:** Background: #FFB04A; Surface: #3A1602; Text Primary: #5C5249; Text Secondary: #8A7D70; Border: #FF9646; Accent: #FFB04A

- **Gradients:** bg-gradient-to-b from-[var(--line-soft)] to-transparent

## Typography

Typography pairs Space Grotesk for display hierarchy with Inter for supporting content and interface copy.

- **Display (`display-lg`):** Space Grotesk, 45.1584px, weight 600, line-height 43.3521px, letter-spacing -0.025em.
- **Body (`body-md`):** Inter, 14px, weight 400, line-height 22.68px.
- **Labels (`label-md`):** Inter, 14px, weight 500, line-height 20px, letter-spacing 0.14px.

## Layout

Layout follows a grid composition with reusable spacing tokens. Preserve the grid, full bleed structural frame before changing ornament or component styling. Use 6px as the base rhythm and let larger gaps step up from that cadence instead of introducing unrelated spacing values.

Treat the page as a grid / full bleed composition, and keep that framing stable when adding or remixing sections.

- **Layout type:** Grid
- **Content width:** Full Bleed
- **Base unit:** 6px
- **Scale:** 1px, 1.2px, 6px, 8px, 10px, 12px, 16px, 17.51px
- **Card padding:** 13px
- **Gaps:** 4px, 8px, 10px, 16px

## Elevation & Depth

Depth is communicated through glass, border contrast, and reusable shadow or blur treatments. Keep those recipes consistent across hero panels, cards, and controls so the page reads as one material system.

Surfaces should read as glass first, with borders, shadows, and blur only reinforcing that material choice.

- **Surface style:** Glass
- **Borders:** 0.8px #FF9646; 0.8px #FFC88C
- **Shadows:** rgba(255, 120, 40, 0.7) 0px 4px 22px -6px; rgba(255, 120, 40, 0.65) 0px 8px 30px -8px; rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgb(255, 122, 24) 0px 0px 9px 1px
- **Blur:** 4px

### Techniques
- **Gradient border shell:** Use a thin gradient border shell around the main card. Wrap the surface in an outer shell with 0px padding and a 0px radius. Drive the shell with radial-gradient(120% 90% at 14% 118%, rgba(255, 110, 30, 0.34) 0%, rgba(255, 80, 20, 0.1) 28%, rgba(10, 7, 5, 0) 56%), radial-gradient(90% 70% at 96% -10%, rgba(255, 150, 60, 0.1) 0%, rgba(10, 7, 5, 0) 50%), radial-gradient(140% 120%, rgba(20, 12, 7, 0) 40%, rgba(6, 4, 3, 0.7) 100%), linear-gradient(rgb(12, 8, 5) 0%, rgb(10, 6, 4) 100%) so the edge reads like premium depth instead of a flat stroke. Keep the actual stroke understated so the gradient shell remains the hero edge treatment. Inset the real content surface inside the wrapper with a slightly smaller radius so the gradient only appears as a hairline frame.

## Shapes

Shapes rely on a tight radius system anchored by 1px and scaled across cards, buttons, and supporting surfaces. Icon geometry should stay compatible with that soft-to-controlled silhouette.

Use the radius family intentionally: larger surfaces can open up, but controls and badges should stay within the same rounded DNA instead of inventing sharper or pill-only exceptions.

- **Corner radii:** 1px, 9999px
- **Icon treatment:** Linear
- **Icon sets:** Solar

## Components

Anchor interactions to the detected button styles.

### Buttons
- **Primary:** text #1A0D05, radius 9999px, padding 12px, border 0px solid rgb(229, 231, 235).
- **Links:** text #CDBFB2, radius 9999px, padding 12px, border 0px solid rgb(229, 231, 235).

### Iconography
- **Treatment:** Linear.
- **Sets:** Solar.

## Do's and Don'ts

Use these constraints to keep future generations aligned with the current system instead of drifting into adjacent styles.

### Do
- Do use the primary palette as the main accent for emphasis and action states.
- Do keep spacing aligned to the detected 6px rhythm.
- Do reuse the Glass surface treatment consistently across cards and controls.
- Do keep corner radii within the detected 1px, 9999px family.

### Don't
- Don't introduce extra accent colors outside the core palette roles unless the page needs a new semantic state.
- Don't mix unrelated shadow or blur recipes that break the current depth system.
- Don't exceed the detected moderate motion intensity without a deliberate reason.

## Motion

Motion feels controlled and interface-led across text, layout, and section transitions. Timing clusters around 300ms. Easing favors ease and cubic-bezier(0.4. Hover behavior focuses on text and shadow changes.

**Motion Level:** moderate

**Durations:** 300ms

**Easings:** ease, cubic-bezier(0.4, 0, 0.2, 1)

**Hover Patterns:** text, shadow, color

## WebGL

Reconstruct the graphics as a full-bleed background field using webgl, renderer, alpha, custom shaders. The effect should read as technical, meditative, and atmospheric: dot-matrix particle field with black and sparse spacing. Build it from dot particles + soft depth fade so the effect reads clearly. Animate it as slow breathing pulse. Interaction can react to the pointer, but only as a subtle drift. Preserve reduced motion + dom fallback.

**Id:** webgl

**Label:** WebGL

**Stack:** ThreeJS, WebGL

**Insights:**
  - **Scene:**
    - **Value:** Full-bleed background field
  - **Effect:**
    - **Value:** Dot-matrix particle field
  - **Primitives:**
    - **Value:** Dot particles + soft depth fade
  - **Motion:**
    - **Value:** Slow breathing pulse
  - **Interaction:**
    - **Value:** Pointer-reactive drift
  - **Render:**
    - **Value:** WebGL, Renderer, alpha, custom shaders

**Techniques:** Dot matrix, Breathing pulse, Pointer parallax, Shader gradients, Noise fields

**Code Evidence:**
  - **HTML reference:**
    - **Language:** html
    - **Snippet:**
      ```
      <!-- Ambient Backgrounds -->
      <div class="fixed inset-0 z-0 pointer-events-none" style="background: radial-gradient(120% 90% at 14% 118%, rgba(255,110,30,0.34) 0%, rgba(255,80,20,0.10) 28%, rgba(10,7,5,0) 56%), radial-gradient(90% 70% at 96% -10%, rgba(255,150,60,0.10) 0%, rgba(10,7,5,0) 50%), radial-gradient(140% 120% at 50% 50%, rgba(20,12,7,0) 40%, rgba(6,4,3,0.7) 100%), linear-gradient(180deg,#0c0805 0%,#0a0604 1…
      ```
  - **JS reference:**
    - **Language:** js
    - **Snippet:**
      ```
      /* ============ EMBER PARTICLE STREAMS (WebGL / Three.js) ============ */
      (function(){
          const canvas = document.getElementById('gl');
          if(!window.THREE) return;
          const RES = 0.5;
          const renderer = new THREE.WebGLRenderer({canvas, antialias:false, alpha:true, powerPreference:'high-performance'});
          renderer.setPixelRatio(1);
          renderer.setClearColor(0x000000, 0);
      …
      ```
  - **Renderer setup:**
    - **Language:** js
    - **Snippet:**
      ```
      (function(){
          const canvas = document.getElementById('gl');
          if(!window.THREE) return;
          const RES = 0.5;
          const renderer = new THREE.WebGLRenderer({canvas, antialias:false, alpha:true, powerPreference:'high-performance'});
          renderer.setPixelRatio(1);
          renderer.setClearColor(0x000000, 0);
      …
      ```
  - **Scene setup:**
    - **Language:** js
    - **Snippet:**
      ```
      const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      /* ============ EMBER PARTICLE STREAMS (WebGL / Three.js) ============ */
      (function(){
          const canvas = document.getElementById('gl');
          if(!window.THREE) return;
          const RES = 0.5;
      ```

## ThreeJS

Reconstruct the Three.js layer as a full-bleed background field with layered spatial depth that feels volumetric and technical. Use alpha renderer settings, orthographic projection, custom buffer geometry geometry, shadermaterial materials, and ambient + key + rim lighting. Motion should read as timeline-led reveals, with reduced motion + non-3d fallback.

**Id:** threejs

**Label:** ThreeJS

**Stack:** ThreeJS, WebGL

**Insights:**
  - **Scene:**
    - **Value:** Full-bleed background field with layered spatial depth
  - **Render:**
    - **Value:** alpha
  - **Camera:**
    - **Value:** Orthographic projection
  - **Lighting:**
    - **Value:** ambient + key + rim
  - **Materials:**
    - **Value:** ShaderMaterial
  - **Geometry:**
    - **Value:** custom buffer geometry
  - **Motion:**
    - **Value:** Timeline-led reveals

**Techniques:** Shader materials, Particle depth, Timeline beats, alpha, Reduced motion + non-3D fallback

**Code Evidence:**
  - **HTML reference:**
    - **Language:** html
    - **Snippet:**
      ```
      <!-- Ambient Backgrounds -->
      <div class="fixed inset-0 z-0 pointer-events-none" style="background: radial-gradient(120% 90% at 14% 118%, rgba(255,110,30,0.34) 0%, rgba(255,80,20,0.10) 28%, rgba(10,7,5,0) 56%), radial-gradient(90% 70% at 96% -10%, rgba(255,150,60,0.10) 0%, rgba(10,7,5,0) 50%), radial-gradient(140% 120% at 50% 50%, rgba(20,12,7,0) 40%, rgba(6,4,3,0.7) 100%), linear-gradient(180deg,#0c0805 0%,#0a0604 1…
      ```
  - **JS reference:**
    - **Language:** js
    - **Snippet:**
      ```
      /* ============ EMBER PARTICLE STREAMS (WebGL / Three.js) ============ */
      (function(){
          const canvas = document.getElementById('gl');
          if(!window.THREE) return;
          const RES = 0.5;
          const renderer = new THREE.WebGLRenderer({canvas, antialias:false, alpha:true, powerPreference:'high-performance'});
          renderer.setPixelRatio(1);
          renderer.setClearColor(0x000000, 0);
      …
      ```
  - **Renderer setup:**
    - **Language:** js
    - **Snippet:**
      ```
      (function(){
          const canvas = document.getElementById('gl');
          if(!window.THREE) return;
          const RES = 0.5;
          const renderer = new THREE.WebGLRenderer({canvas, antialias:false, alpha:true, powerPreference:'high-performance'});
          renderer.setPixelRatio(1);
          renderer.setClearColor(0x000000, 0);
      …
      ```
  - **Scene setup:**
    - **Language:** js
    - **Snippet:**
      ```
      const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      /* ============ EMBER PARTICLE STREAMS (WebGL / Three.js) ============ */
      (function(){
          const canvas = document.getElementById('gl');
          if(!window.THREE) return;
          const RES = 0.5;
      ```
