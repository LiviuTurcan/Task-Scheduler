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
  
  // 3. Create Renderer
  renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  
  // 4. Create Starfield (Points)
  const starCount = 1800;
  const starGeometry = new THREE.BufferGeometry();
  const starPositions = new Float32Array(starCount * 3);
  const starPhases = new Float32Array(starCount);
  
  for (let i = 0; i < starCount * 3; i += 3) {
    // Distribute randomly in a large bounding sphere
    const radius = Math.random() * 600 + 400;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);
    
    starPositions[i] = radius * Math.sin(phi) * Math.cos(theta);
    starPositions[i+1] = radius * Math.sin(phi) * Math.sin(theta);
    starPositions[i+2] = radius * Math.cos(phi) - 200;
    
    starPhases[i/3] = Math.random() * Math.PI * 2; // for twinkling
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
  
  // 5. Create Planet Group
  planetGroup = new THREE.Group();
  scene.add(planetGroup);
  
  // Initialize meshes with fixed Saturn-like realistic cosmic colors
  const planetTex = generatePlanetTexture('#2f2519', '#d4a373', '#e07a5f');
  const sphereGeo = new THREE.SphereGeometry(110, 64, 64);
  const sphereMat = new THREE.MeshStandardMaterial({ 
    map: planetTex,
    roughness: 0.9, 
    metalness: 0.05 
  });
  planetMesh = new THREE.Mesh(sphereGeo, sphereMat);
  planetGroup.add(planetMesh);
  
  const ringTex = generateRingTexture('#e9c46a');
  const ringGeo = new THREE.RingGeometry(140, 220, 64);
  // UV mapping coordinate fix for RingGeometry to wrap ring texture circularly
  const pos = ringGeo.attributes.position;
  const v3 = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v3.fromBufferAttribute(pos, i);
    const len = v3.length();
    // u coord maps to radius, v maps to angle
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
  
  // 6. Create Orbiting Moon
  const moonGeo = new THREE.SphereGeometry(18, 32, 32);
  const moonMat = new THREE.MeshStandardMaterial({ 
    map: generateMoonTexture(),
    roughness: 0.85,
    metalness: 0.02
  });
  moonMesh = new THREE.Mesh(moonGeo, moonMat);
  planetGroup.add(moonMesh);
  
  // 7. Add Lighting (Warm, sun-like directional light)
  ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
  scene.add(ambientLight);
  
  directionalLight = new THREE.DirectionalLight(0xfff8e7, 1.45);
  directionalLight.position.set(300, 200, 300);
  scene.add(directionalLight);
  
  // Position planet based on screen size
  updatePlanetLayout();
  syncThreeColors();
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
  const theme = document.body.className || 'theme-violet';
  if (theme === lastTheme) return;
  lastTheme = theme;
  
  const isLight = theme.includes('theme-light');
  
  if (isLight) {
    ambientLight.color.set('#ffffff');
    ambientLight.intensity = 0.85;
    starParticles.material.color.set('#475569'); // Dark slate particles on light bg
    starParticles.material.opacity = 0.45;
  } else {
    ambientLight.color.set('#ffffff');
    ambientLight.intensity = 0.45;
    starParticles.material.color.set('#ffffff'); // Twinkling white stars on dark bg
    starParticles.material.opacity = 0.85;
  }
  starParticles.material.needsUpdate = true;
}

// Mouse Move capture
window.addEventListener('mousemove', (e) => {
  targetMouseX = (e.clientX - window.innerWidth / 2) / (window.innerWidth / 2);
  targetMouseY = (e.clientY - window.innerHeight / 2) / (window.innerHeight / 2);
});

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
    // Step 0: Welcome - everything hidden, focus close on planet
    document.body.classList.remove('sidebar-fadein', 'main-fadein', 'header-fadein');
    if (planetGroup) {
      targetCameraPos.set(planetGroup.position.x - 130, planetGroup.position.y + 30, planetGroup.position.z + 230);
      targetLookAt.set(planetGroup.position.x, planetGroup.position.y, planetGroup.position.z);
    }
  }
  else if (stepIndex === 1) {
    // Step 1: Sidebar Control Dock - show sidebar, track moon closely
    document.body.classList.add('sidebar-fadein');
    document.body.classList.remove('main-fadein', 'header-fadein');
  }
  else if (stepIndex === 2) {
    // Step 2: SaaS Analytics Dashboard - show sidebar & main grid
    document.body.classList.add('sidebar-fadein', 'main-fadein');
    document.body.classList.remove('header-fadein');
    if (planetGroup) {
      targetCameraPos.set(planetGroup.position.x + 260, planetGroup.position.y - 80, planetGroup.position.z + 340);
      targetLookAt.set(planetGroup.position.x, planetGroup.position.y, planetGroup.position.z);
    }
  }
  else if (stepIndex === 3) {
    // Step 3: Visual 24h Timeline Chrono - show all UI, top-down solar system panorama
    document.body.classList.add('sidebar-fadein', 'main-fadein', 'header-fadein');
    targetCameraPos.set(0, 340, 800);
    targetLookAt.set(0, 0, -100);
  }
  else if (stepIndex === 4) {
    // Step 4: Vanilla Drag Snapping - show all UI, side profiles
    document.body.classList.add('sidebar-fadein', 'main-fadein', 'header-fadein');
    if (planetGroup) {
      targetCameraPos.set(-260, 120, 600);
      targetLookAt.set(planetGroup.position.x, planetGroup.position.y, planetGroup.position.z);
    }
  }
}

// Render Loop
let moonAngle = 0;
let is3dBackdropEnabled = localStorage.getItem('chrono_disable_3d') !== 'true';

function toggle3DBackground(disabled) {
  is3dBackdropEnabled = !disabled;
  localStorage.setItem('chrono_disable_3d', disabled ? 'true' : 'false');
  
  const canvasEl = document.getElementById('particles-canvas');
  if (canvasEl) {
    canvasEl.style.display = disabled ? 'none' : 'block';
  }
  
  if (is3dBackdropEnabled) {
    window.dispatchEvent(new Event('resize'));
  }
}

function animate() {
  requestAnimationFrame(animate);
  if (!is3dBackdropEnabled) return;
  
  // Update camera positions based on cinematic mode
  if (cinematicMode) {
    if (tourStep === 1 && moonMesh && planetGroup) {
      // Dynamic camera tracking of the orbiting moon in step 1
      const moonWorldPos = new THREE.Vector3();
      moonMesh.getWorldPosition(moonWorldPos);
      
      targetCameraPos.set(
        moonWorldPos.x - 65,
        moonWorldPos.y + 12,
        moonWorldPos.z + 85
      );
      targetLookAt.copy(moonWorldPos);
    }
    
    // Lerp smoothly to tour step coordinates
    camera.position.lerp(targetCameraPos, 0.04);
    currentLookAt.lerp(targetLookAt, 0.04);
    camera.lookAt(currentLookAt);
  } else {
    // Normal mouse parallax rotation easing
    mouseX += (targetMouseX - mouseX) * 0.055;
    mouseY += (targetMouseY - mouseY) * 0.055;
    
    const defaultX = window.innerWidth > 1300 ? (window.innerWidth * 0.22) : 0;
    const defaultY = window.innerWidth > 1300 ? 40 : 0;
    const defaultZ = window.innerWidth > 1300 ? -100 : -200;
    
    targetCameraPos.set(mouseX * 220 + defaultX, -mouseY * 200 + defaultY, 700 + defaultZ);
    targetLookAt.set(defaultX, defaultY, defaultZ);
    
    camera.position.lerp(targetCameraPos, 0.055);
    currentLookAt.lerp(targetLookAt, 0.055);
    camera.lookAt(currentLookAt);
  }
  
  // Slowly rotate planet and ring
  if (planetMesh) planetMesh.rotation.y += 0.0016;
  if (ringMesh) ringMesh.rotation.z -= 0.0006;
  
  // Orbit moon
  if (moonMesh) {
    moonAngle += 0.0035;
    moonMesh.position.x = Math.cos(moonAngle) * 260;
    moonMesh.position.z = Math.sin(moonAngle) * 260;
    moonMesh.position.y = Math.sin(moonAngle * 0.5) * 60;
    moonMesh.rotation.y += 0.01;
  }
  
  // Twinkle stars
  if (starParticles) {
    starParticles.rotation.y += 0.0002;
    starParticles.rotation.x += 0.0001;
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
  
  // Initialize state of toggle checkbox
  const disable3dToggle = document.getElementById('settings-disable-3d-toggle');
  if (disable3dToggle) {
    disable3dToggle.checked = localStorage.getItem('chrono_disable_3d') === 'true';
  }
  
  if (localStorage.getItem('chrono_disable_3d') === 'true') {
    is3dBackdropEnabled = false;
    const canvasEl = document.getElementById('particles-canvas');
    if (canvasEl) {
      canvasEl.style.display = 'none';
    }
  }
  
  animate();
});
