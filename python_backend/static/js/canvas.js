/* ==========================================================================
   3D WEBGL DYNAMIC SPACE BACKDROP (THREE.JS PROCEDURAL RENDERER)
   ========================================================================== */

const canvas = document.getElementById('particles-canvas');
let scene, camera, renderer, starParticles;
let planetGroup, planetMesh, ringMesh, moonMesh;
let ambientLight, directionalLight;

let mouseX = 0, mouseY = 0;
let targetMouseX = 0, targetMouseY = 0;
let lastTheme = '';

// Cinematic 3D Tour variables
let cinematicMode = false;
let tourStep = -1;
let currentLookAt = new THREE.Vector3(0, 0, 0);
let targetCameraPos = new THREE.Vector3(0, 0, 700);
let targetLookAt = new THREE.Vector3(0, 0, 0);

// Helper to convert hex to RGBA
function hexToRgba(hex, alpha) {
  let c = hex.substring(1);
  if (c.length === 3) {
    c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
  }
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Procedural Planet Map Generator
function generatePlanetTexture(color1, color2, spotColor) {
  const canvasTexture = document.createElement('canvas');
  canvasTexture.width = 1024;
  canvasTexture.height = 512;
  const ctx = canvasTexture.getContext('2d');
  
  // Base gradient
  const grad = ctx.createLinearGradient(0, 0, 0, canvasTexture.height);
  grad.addColorStop(0, color1);
  grad.addColorStop(0.5, color2);
  grad.addColorStop(1, color1);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvasTexture.width, canvasTexture.height);
  
  // Add atmospheric gas bands
  for (let i = 0; i < 28; i++) {
    const y = Math.random() * canvasTexture.height;
    const height = Math.random() * 30 + 10;
    const opacity = Math.random() * 0.15 + 0.02;
    ctx.fillStyle = Math.random() < 0.5 ? `rgba(255, 255, 255, ${opacity})` : `rgba(0, 0, 0, ${opacity * 1.5})`;
    ctx.fillRect(0, y, canvasTexture.width, height);
  }
  
  // Add swirling storm circles (like Jupiter's red spot)
  for (let i = 0; i < 3; i++) {
    const x = Math.random() * canvasTexture.width;
    const y = canvasTexture.height * 0.4 + Math.random() * canvasTexture.height * 0.2;
    const rx = Math.random() * 50 + 25;
    const ry = rx * 0.5;
    const opacity = Math.random() * 0.2 + 0.05;
    
    ctx.fillStyle = hexToRgba(spotColor, opacity);
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.5})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(x, y, rx + 8, ry + 4, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  
  return new THREE.CanvasTexture(canvasTexture);
}

// Procedural Ring Texture Generator
function generateRingTexture(colorHex) {
  const canvasTexture = document.createElement('canvas');
  canvasTexture.width = 512;
  canvasTexture.height = 16;
  const ctx = canvasTexture.getContext('2d');
  
  ctx.clearRect(0, 0, canvasTexture.width, canvasTexture.height);
  
  // Draw concentric bands of opacity
  for (let i = 0; i < canvasTexture.width; i++) {
    const intensity = Math.sin(i * 0.2) * Math.sin(i * 0.06) * 0.5 + 0.5;
    const alpha = intensity * (0.25 + Math.random() * 0.2);
    ctx.fillStyle = hexToRgba(colorHex, alpha);
    ctx.fillRect(i, 0, 1, canvasTexture.height);
  }
  
  const texture = new THREE.CanvasTexture(canvasTexture);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

// Procedural Moon Texture Generator
function generateMoonTexture() {
  const canvasTexture = document.createElement('canvas');
  canvasTexture.width = 512;
  canvasTexture.height = 256;
  const ctx = canvasTexture.getContext('2d');
  
  const grad = ctx.createLinearGradient(0, 0, 0, canvasTexture.height);
  grad.addColorStop(0, '#5a6b7c');
  grad.addColorStop(0.5, '#2e3a46');
  grad.addColorStop(1, '#1b232a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvasTexture.width, canvasTexture.height);
  
  // Add craters
  ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  for (let i = 0; i < 45; i++) {
    const x = Math.random() * canvasTexture.width;
    const y = Math.random() * canvasTexture.height;
    const r = Math.random() * 10 + 2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  return new THREE.CanvasTexture(canvasTexture);
}

// Initialize ThreeJS Scene
function init3DBackdrop() {
  // 1. Create Scene
  scene = new THREE.Scene();
  
  // 2. Create Camera
  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 3000);
  camera.position.z = 700;
  
  // 3. Create Renderer with highly optimized parameters to reduce GPU composite cost
  renderer = new THREE.WebGLRenderer({ 
    canvas: canvas, 
    alpha: true, 
    antialias: false, // Disables MSAA to save massive shader compute (especially on Retina)
    powerPreference: 'low-power', // Force low-power integrated GPU usage
    precision: 'mediump', // Lower shader math overhead
    stencil: false // Disable stencil buffer
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(1.0); // Fix pixel ratio to 1.0 to avoid heavy high-DPI rendering overhead
  
  // 4. Add Lighting (Warm, sun-like directional light)
  ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
  scene.add(ambientLight);
  
  directionalLight = new THREE.DirectionalLight(0xfff8e7, 1.45);
  directionalLight.position.set(300, 200, 300);
  scene.add(directionalLight);
  
  // 5. Build scene based on stored quality
  const savedQuality = localStorage.getItem('chrono_3d_quality') || 'high';
  rebuild3DScene(savedQuality);
}

// Position planet in the desktop sidebar area
function updatePlanetLayout() {
  if (!planetGroup) return;
  const width = window.innerWidth;
  if (width > 1300) {
    planetGroup.position.set(width * 0.22, 40, -100);
  } else {
    planetGroup.position.set(0, 0, -200); // center behind main overlays
  }
}

// Read CSS variables and refresh textures & colors based on theme class
function syncThreeColors() {
  if (!scene) return;
  const theme = document.body.className || 'theme-violet';
  if (theme === lastTheme) return;
  lastTheme = theme;
  
  const isLight = theme.includes('theme-light');
  
  if (isLight) {
    ambientLight.color.set('#ffffff');
    ambientLight.intensity = 0.85;
    if (starParticles && starParticles.material) {
      starParticles.material.color.set('#475569'); // Dark slate particles on light bg
      starParticles.material.opacity = 0.45;
    }
  } else {
    ambientLight.color.set('#ffffff');
    ambientLight.intensity = 0.45;
    if (starParticles && starParticles.material) {
      starParticles.material.color.set('#ffffff'); // Twinkling white stars on dark bg
      starParticles.material.opacity = 0.85;
    }
  }
  if (starParticles && starParticles.material) {
    starParticles.material.needsUpdate = true;
  }
}

// Dynamically rebuild ThreeJS elements based on quality level (prevents page refresh)
function rebuild3DScene(quality) {
  if (!scene) return;
  
  // 1. Dispose & Clean up current objects to prevent GPU memory leaks
  if (starParticles) {
    scene.remove(starParticles);
    if (starParticles.geometry) starParticles.geometry.dispose();
    if (starParticles.material) starParticles.material.dispose();
    starParticles = null;
  }
  if (planetGroup) {
    scene.remove(planetGroup);
    planetGroup.traverse(child => {
      if (child.isMesh) {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      }
    });
    planetGroup = null;
    planetMesh = null;
    ringMesh = null;
    moonMesh = null;
  }
  
  const canvasEl = document.getElementById('particles-canvas');
  
  if (quality === 'disabled') {
    is3dBackdropEnabled = false;
    if (canvasEl) canvasEl.style.display = 'none';
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    return;
  }
  
  is3dBackdropEnabled = true;
  if (canvasEl) canvasEl.style.display = 'block';
  
  // 2. Build Starfield (for 'high' or 'low')
  if (quality === 'high' || quality === 'low') {
    const starCount = quality === 'high' ? 800 : 300;
    const starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    const starPhases = new Float32Array(starCount);
    
    for (let i = 0; i < starCount * 3; i += 3) {
      const radius = Math.random() * 600 + 400;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      
      starPositions[i] = radius * Math.sin(phi) * Math.cos(theta);
      starPositions[i+1] = radius * Math.sin(phi) * Math.sin(theta);
      starPositions[i+2] = radius * Math.cos(phi) - 200;
      
      starPhases[i/3] = Math.random() * Math.PI * 2;
    }
    
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeometry.setAttribute('phase', new THREE.BufferAttribute(starPhases, 1));
    
    const starMaterial = new THREE.PointsMaterial({
      size: 1.6,
      color: 0xffffff,
      transparent: true,
      opacity: 0.85,
      sizeAttenuation: true
    });
    
    starParticles = new THREE.Points(starGeometry, starMaterial);
    scene.add(starParticles);
  }
  
  // 3. Build Planet Group (for 'high' or 'medium')
  if (quality === 'high' || quality === 'medium') {
    planetGroup = new THREE.Group();
    scene.add(planetGroup);
    
    // Geometry detail segment counts based on quality preset
    const segments = quality === 'high' ? 32 : 16;
    
    const planetTex = generatePlanetTexture('#2f2519', '#d4a373', '#e07a5f');
    const sphereGeo = new THREE.SphereGeometry(110, segments, segments);
    const sphereMat = new THREE.MeshStandardMaterial({ 
      map: planetTex,
      roughness: 0.9, 
      metalness: 0.05 
    });
    planetMesh = new THREE.Mesh(sphereGeo, sphereMat);
    planetGroup.add(planetMesh);
    
    const ringTex = generateRingTexture('#e9c46a');
    const ringGeo = new THREE.RingGeometry(140, 220, segments);
    
    // Ring UV coordinates circular wrapping fix
    const pos = ringGeo.attributes.position;
    const v3 = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v3.fromBufferAttribute(pos, i);
      const len = v3.length();
      const u = (len - 140) / 80;
      const v = (Math.atan2(v3.y, v3.x) + Math.PI) / (Math.PI * 2);
      ringGeo.attributes.uv.setXY(i, u, v);
    }
    
    const ringMat = new THREE.MeshStandardMaterial({ 
      map: ringTex,
      side: THREE.DoubleSide, 
      transparent: true, 
      opacity: 0.72,
      roughness: 0.6
    });
    ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = Math.PI / 2.3;
    ringMesh.rotation.y = Math.PI / 9;
    planetGroup.add(ringMesh);
    
    const moonGeo = new THREE.SphereGeometry(18, quality === 'high' ? 16 : 8, quality === 'high' ? 16 : 8);
    const moonMat = new THREE.MeshStandardMaterial({ 
      map: generateMoonTexture(),
      roughness: 0.85,
      metalness: 0.02
    });
    moonMesh = new THREE.Mesh(moonGeo, moonMat);
    planetGroup.add(moonMesh);
    
    updatePlanetLayout();
  }
  
  // Refresh themes
  lastTheme = '';
  syncThreeColors();
  
  // Restart loop
  startAnimationLoop();
}

// Cinematic 3D Tour camera controller
function setTourCameraStep(stepIndex) {
  tourStep = stepIndex;
  
  if (stepIndex === -1) {
    cinematicMode = false;
    document.body.classList.remove('tour-cinematic-mode', 'sidebar-fadein', 'main-fadein', 'header-fadein');
    updatePlanetLayout();
    return;
  }
  
  cinematicMode = true;
  document.body.classList.add('tour-cinematic-mode');
  
  if (stepIndex === 0) {
    document.body.classList.remove('sidebar-fadein', 'main-fadein', 'header-fadein');
    if (planetGroup) {
      targetCameraPos.set(planetGroup.position.x - 130, planetGroup.position.y + 30, planetGroup.position.z + 230);
      targetLookAt.set(planetGroup.position.x, planetGroup.position.y, planetGroup.position.z);
    }
  }
  else if (stepIndex === 1) {
    document.body.classList.add('sidebar-fadein');
    document.body.classList.remove('main-fadein', 'header-fadein');
  }
  else if (stepIndex === 2) {
    document.body.classList.add('sidebar-fadein', 'main-fadein');
    document.body.classList.remove('header-fadein');
    if (planetGroup) {
      targetCameraPos.set(planetGroup.position.x + 260, planetGroup.position.y - 80, planetGroup.position.z + 340);
      targetLookAt.set(planetGroup.position.x, planetGroup.position.y, planetGroup.position.z);
    }
  }
  else if (stepIndex === 3) {
    document.body.classList.add('sidebar-fadein', 'main-fadein', 'header-fadein');
    targetCameraPos.set(0, 340, 800);
    targetLookAt.set(0, 0, -100);
  }
  else if (stepIndex === 4) {
    document.body.classList.add('sidebar-fadein', 'main-fadein', 'header-fadein');
    if (planetGroup) {
      targetCameraPos.set(-260, 120, 600);
      targetLookAt.set(planetGroup.position.x, planetGroup.position.y, planetGroup.position.z);
    }
  }
}

// Render loop variables
let moonAngle = 0;
let is3dBackdropEnabled = (localStorage.getItem('chrono_3d_quality') || 'high') !== 'disabled';
let isTabVisible = true;
let animationFrameId = null;
let lastInteractionTime = performance.now();
let lastFrameTime = 0;

function startAnimationLoop() {
  if (!animationFrameId && is3dBackdropEnabled && isTabVisible) {
    lastFrameTime = performance.now();
    animationFrameId = requestAnimationFrame(animate);
  }
}

function recordInteraction() {
  lastInteractionTime = performance.now();
  startAnimationLoop();
}

// Window Event Listeners for Dynamic Idle Framerate Throttling
window.addEventListener('mousemove', (e) => {
  targetMouseX = (e.clientX - window.innerWidth / 2) / (window.innerWidth / 2);
  targetMouseY = (e.clientY - window.innerHeight / 2) / (window.innerHeight / 2);
  recordInteraction();
});
window.addEventListener('click', recordInteraction);
window.addEventListener('scroll', recordInteraction, { passive: true });
window.addEventListener('keydown', recordInteraction);

document.addEventListener('visibilitychange', () => {
  isTabVisible = !document.hidden;
  if (isTabVisible) {
    startAnimationLoop();
  }
});

// Legacy wrapper to support theme/custom overrides calling toggle3DBackground
function toggle3DBackground(disabled) {
  const quality = disabled ? 'disabled' : 'high';
  localStorage.setItem('chrono_3d_quality', quality);
  const select3d = document.getElementById('settings-3d-quality');
  if (select3d) select3d.value = quality;
  rebuild3DScene(quality);
}

// Main WebGL Animate Loop (supports delta-time updates to preserve speed independent of FPS)
function animate(currentTime) {
  if (!is3dBackdropEnabled || !isTabVisible) {
    animationFrameId = null;
    return;
  }
  
  animationFrameId = requestAnimationFrame(animate);
  
  if (!currentTime) currentTime = performance.now();
  const elapsed = currentTime - lastFrameTime;
  
  // Set target FPS: 30 FPS when active, drop to 15 FPS when idle (after 10s of no input)
  const timeSinceInteraction = currentTime - lastInteractionTime;
  const targetFPS = timeSinceInteraction > 10000 ? 15 : 30;
  const fpsInterval = 1000 / targetFPS;
  
  if (elapsed < fpsInterval) return;
  
  // Calculate delta factor relative to standard 60 FPS (16.67ms per frame)
  const delta = Math.min(elapsed / 16.67, 4.0); // Capped to avoid extreme jumps during spikes
  lastFrameTime = currentTime - (elapsed % fpsInterval);
  
  // Lerp Camera
  if (cinematicMode) {
    if (tourStep === 1 && moonMesh && planetGroup) {
      const moonWorldPos = new THREE.Vector3();
      moonMesh.getWorldPosition(moonWorldPos);
      
      targetCameraPos.set(
        moonWorldPos.x - 65,
        moonWorldPos.y + 12,
        moonWorldPos.z + 85
      );
      targetLookAt.copy(moonWorldPos);
    }
    
    // Frame-rate independent camera lerps
    camera.position.lerp(targetCameraPos, 1 - Math.pow(1 - 0.04, delta));
    currentLookAt.lerp(targetLookAt, 1 - Math.pow(1 - 0.04, delta));
    camera.lookAt(currentLookAt);
  } else {
    // Normal mouse parallax rotation easing
    mouseX += (targetMouseX - mouseX) * (1 - Math.pow(1 - 0.055, delta));
    mouseY += (targetMouseY - mouseY) * (1 - Math.pow(1 - 0.055, delta));
    
    const defaultX = window.innerWidth > 1300 ? (window.innerWidth * 0.22) : 0;
    const defaultY = window.innerWidth > 1300 ? 40 : 0;
    const defaultZ = window.innerWidth > 1300 ? -100 : -200;
    
    targetCameraPos.set(mouseX * 220 + defaultX, -mouseY * 200 + defaultY, 700 + defaultZ);
    targetLookAt.set(defaultX, defaultY, defaultZ);
    
    camera.position.lerp(targetCameraPos, 1 - Math.pow(1 - 0.055, delta));
    currentLookAt.lerp(targetLookAt, 1 - Math.pow(1 - 0.055, delta));
    camera.lookAt(currentLookAt);
  }
  
  // Slowly rotate planet and ring (scaled by delta)
  if (planetMesh) planetMesh.rotation.y += 0.0016 * delta;
  if (ringMesh) ringMesh.rotation.z -= 0.0006 * delta;
  
  // Orbit moon (scaled by delta)
  if (moonMesh) {
    moonAngle += 0.0035 * delta;
    moonMesh.position.x = Math.cos(moonAngle) * 260;
    moonMesh.position.z = Math.sin(moonAngle) * 260;
    moonMesh.position.y = Math.sin(moonAngle * 0.5) * 60;
    moonMesh.rotation.y += 0.01 * delta;
  }
  
  // Twinkle stars (scaled by delta)
  if (starParticles) {
    starParticles.rotation.y += 0.0002 * delta;
    starParticles.rotation.x += 0.0001 * delta;
  }
  
  renderer.render(scene, camera);
}

// Window resizing
window.addEventListener('resize', () => {
  if (camera && renderer) {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    updatePlanetLayout();
  }
});

// Bootstrapper initialization
window.addEventListener('DOMContentLoaded', () => {
  init3DBackdrop();
});
