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
  
  // Initialize meshes with blank configurations (colored by theme observer)
  const sphereGeo = new THREE.SphereGeometry(110, 64, 64);
  const sphereMat = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0.05 });
  planetMesh = new THREE.Mesh(sphereGeo, sphereMat);
  planetGroup.add(planetMesh);
  
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
  
  // 7. Add Lighting
  ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
  scene.add(ambientLight);
  
  directionalLight = new THREE.DirectionalLight(0xffffff, 1.3);
  directionalLight.position.set(300, 200, 300);
  scene.add(directionalLight);
  
  // Position planet based on screen size
  updatePlanetLayout();
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
  
  const style = getComputedStyle(document.body);
  const accentHex = style.getPropertyValue('--neon-accent').trim() || '#a855f7';
  const purpleHex = style.getPropertyValue('--neon-purple').trim() || '#a855f7';
  const cyanHex = style.getPropertyValue('--neon-cyan').trim() || '#06b6d4';
  
  const isLight = theme.includes('theme-light');
  
  // Define custom procedural colors based on theme presets
  let c1 = '#090518', c2 = '#1b0d3a', spot = accentHex;
  if (theme.includes('theme-oled')) {
    c1 = '#020512'; c2 = '#081745'; spot = cyanHex;
  } else if (theme.includes('theme-amber')) {
    c1 = '#120802'; c2 = '#3a1805'; spot = purpleHex;
  } else if (theme.includes('theme-emerald')) {
    c1 = '#021206'; c2 = '#083a15'; spot = accentHex;
  } else if (theme.includes('theme-sakura')) {
    c1 = '#18020d'; c2 = '#450828'; spot = accentHex;
  } else if (theme.includes('theme-light')) {
    c1 = '#e2e8f0'; c2 = '#94a3b8'; spot = '#4f46e5';
  } else if (theme.includes('theme-ocean')) {
    c1 = '#020e18'; c2 = '#062d4e'; spot = cyanHex;
  } else if (theme.includes('theme-sunset')) {
    c1 = '#200508'; c2 = '#5a121a'; spot = '#f97316';
  } else if (theme.includes('theme-nord')) {
    c1 = '#2e3440'; c2 = '#4c566a'; spot = '#88c0d0';
  } else if (theme.includes('theme-forest')) {
    c1 = '#05180c'; c2 = '#123a1e'; spot = '#a3e635';
  } else if (theme.includes('theme-slate')) {
    c1 = '#1e293b'; c2 = '#475569'; spot = '#cbd5e1';
  }
  
  // Re-generate textures
  const planetTex = generatePlanetTexture(c1, c2, spot);
  const ringTex = generateRingTexture(spot);
  
  planetMesh.material.map = planetTex;
  planetMesh.material.needsUpdate = true;
  
  ringMesh.material.map = ringTex;
  ringMesh.material.needsUpdate = true;
  
  // Adjust lights
  directionalLight.color.set(spot);
  
  if (isLight) {
    ambientLight.color.set('#ffffff');
    ambientLight.intensity = 0.8;
    starParticles.material.color.set('#475569'); // Dark slate particles on light bg
    starParticles.material.opacity = 0.45;
  } else {
    ambientLight.color.set('#ffffff');
    ambientLight.intensity = 0.4;
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

// Render Loop
let moonAngle = 0;
function animate() {
  requestAnimationFrame(animate);
  
  // Easing interpolation for mouse parallax
  mouseX += (targetMouseX - mouseX) * 0.055;
  mouseY += (targetMouseY - mouseY) * 0.055;
  
  // Smoothly displace camera slightly based on mouse
  camera.position.x = mouseX * 220;
  camera.position.y = -mouseY * 200;
  camera.lookAt(scene.position);
  
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
  
  // Twinkle stars (slight oscillation on opacity in shader phase simulation)
  if (starParticles) {
    starParticles.rotation.y += 0.0002;
    starParticles.rotation.x += 0.0001;
  }
  
  // Sync colors from active theme
  syncThreeColors();
  
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
  animate();
});
