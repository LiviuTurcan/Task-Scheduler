/* ==========================================================================
   2D CANVAS DYNAMIC SPACE STARFIELD & TWINKLING NEBULA BACKDROP
   ========================================================================== */

const canvas = document.getElementById('particles-canvas');
const ctx = canvas.getContext('2d');
let stars = [];
let nebulae = [];
let shootingStars = [];
let mouse = { x: null, y: null, radius: 150 };

window.addEventListener('mousemove', (e) => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});

window.addEventListener('mouseleave', () => {
  mouse.x = null;
  mouse.y = null;
});

function initBackdropParticles() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  stars = [];
  shootingStars = [];
  
  // 1. Initialize Nebulae (3 large gas clouds)
  nebulae = [
    {
      x: canvas.width * 0.2,
      y: canvas.height * 0.3,
      radius: Math.min(canvas.width, canvas.height) * 0.4,
      colorKey: '--neon-accent-rgb',
      opacity: 0.08,
      dx: 0.08,
      dy: 0.05
    },
    {
      x: canvas.width * 0.8,
      y: canvas.height * 0.7,
      radius: Math.min(canvas.width, canvas.height) * 0.45,
      colorKey: '--neon-cyan', // We can get this from variables
      colorRgb: '6, 182, 212',
      opacity: 0.06,
      dx: -0.06,
      dy: -0.04
    },
    {
      x: canvas.width * 0.5,
      y: canvas.height * 0.4,
      radius: Math.min(canvas.width, canvas.height) * 0.35,
      colorKey: '--neon-purple-glow',
      opacity: 0.04,
      dx: 0.04,
      dy: -0.06
    }
  ];
  
  // 2. Initialize 180 stars
  const starCount = Math.floor(window.innerWidth / 8);
  for (let i = 0; i < starCount; i++) {
    const layer = Math.random() < 0.6 ? 1 : (Math.random() < 0.8 ? 2 : 3); // 1 = deep/slow, 3 = near/fast
    let radius = 0.4;
    let opacity = Math.random() * 0.4 + 0.1;
    
    if (layer === 2) {
      radius = Math.random() * 0.6 + 0.5;
      opacity = Math.random() * 0.5 + 0.2;
    } else if (layer === 3) {
      radius = Math.random() * 0.8 + 1.0;
      opacity = Math.random() * 0.5 + 0.4;
    }
    
    stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      radius: radius,
      layer: layer,
      opacity: opacity,
      speedX: (Math.random() * 0.05 + 0.02) * (layer === 1 ? -0.5 : (layer === 2 ? -1.0 : -1.5)),
      speedY: (Math.random() * 0.04 + 0.01) * (layer === 1 ? -0.5 : (layer === 2 ? -1.0 : -1.5)),
      twinkleSpeed: Math.random() * 0.03 + 0.01,
      phase: Math.random() * Math.PI * 2,
      colorType: Math.random() < 0.15 ? 'accent' : 'white'
    });
  }
}

function animateBackdropParticles() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Read active theme CSS variables for dynamic coloring
  const style = getComputedStyle(document.body);
  const accentRgb = style.getPropertyValue('--neon-accent-rgb') || '168, 85, 247';
  
  // Draw Nebulae
  nebulae.forEach(n => {
    // slow drift movement
    n.x += n.dx;
    n.y += n.dy;
    if (n.x < 0 || n.x > canvas.width) n.dx *= -1;
    if (n.y < 0 || n.y > canvas.height) n.dy *= -1;
    
    // Resolve RGB color string from CSS variable
    let rgb = accentRgb;
    if (n.colorKey === '--neon-cyan') {
      rgb = '6, 182, 212';
    } else if (n.colorKey === '--neon-purple-glow') {
      rgb = '168, 85, 247';
    }
    
    // Scale opacity down if OLED black theme is active to preserve contrast
    let finalOpacity = n.opacity;
    if (document.body.classList.contains('theme-oled')) {
      finalOpacity = n.opacity * 0.4;
    }
    
    let grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.radius);
    grad.addColorStop(0, `rgba(${rgb.trim()}, ${finalOpacity})`);
    grad.addColorStop(0.5, `rgba(${rgb.trim()}, ${finalOpacity * 0.4})`);
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
    ctx.fill();
  });
  
  // Draw Stars
  stars.forEach(p => {
    // Constant space drift
    p.x += p.speedX;
    p.y += p.speedY;
    
    // Boundary wrapping
    if (p.x < 0) p.x = canvas.width;
    if (p.x > canvas.width) p.x = 0;
    if (p.y < 0) p.y = canvas.height;
    if (p.y > canvas.height) p.y = 0;
    
    // Mouse proximity warping (Parallax repulsion)
    let starX = p.x;
    let starY = p.y;
    if (mouse.x !== null && mouse.y !== null) {
      let dx = mouse.x - p.x;
      let dy = mouse.y - p.y;
      let dist = Math.sqrt(dx*dx + dy*dy);
      
      if (dist < mouse.radius) {
        let force = (mouse.radius - dist) / mouse.radius;
        let warp = force * 12 * (p.layer / 3);
        starX -= (dx / dist) * warp;
        starY -= (dy / dist) * warp;
      }
    }
    
    // Twinkling animation via opacity modulation
    p.phase += p.twinkleSpeed;
    let twinkle = Math.sin(p.phase) * 0.35 + 0.65;
    let finalOpacity = p.opacity * twinkle;
    
    ctx.beginPath();
    ctx.arc(starX, starY, p.radius, 0, Math.PI * 2);
    
    if (p.colorType === 'accent') {
      ctx.fillStyle = `rgba(${accentRgb.trim()}, ${finalOpacity})`;
    } else {
      ctx.fillStyle = `rgba(255, 255, 255, ${finalOpacity})`;
    }
    ctx.fill();
  });
  
  // Draw Shooting Stars (0.15% spawn probability)
  if (Math.random() < 0.0015 && shootingStars.length < 2) {
    shootingStars.push({
      x: Math.random() * canvas.width * 0.8,
      y: Math.random() * canvas.height * 0.4,
      dx: Math.random() * 5 + 5,
      dy: Math.random() * 2 + 2,
      length: Math.random() * 70 + 40,
      speed: Math.random() * 12 + 10,
      life: 0,
      maxLife: Math.random() * 25 + 15
    });
  }
  
  shootingStars.forEach((ss, idx) => {
    ss.life++;
    let pct = ss.life / ss.maxLife;
    let opacity = Math.sin(pct * Math.PI) * 0.8;
    
    let endX = ss.x + ss.dx * ss.speed * pct;
    let endY = ss.y + ss.dy * ss.speed * pct;
    let startX = endX - ss.dx * ss.length;
    let startY = endY - ss.dy * ss.length;
    
    let grad = ctx.createLinearGradient(startX, startY, endX, endY);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0)');
    grad.addColorStop(1, `rgba(255, 255, 255, ${opacity})`);
    
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    
    if (ss.life >= ss.maxLife) {
      shootingStars.splice(idx, 1);
    }
  });
  
  requestAnimationFrame(animateBackdropParticles);
}

window.addEventListener('resize', () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  initBackdropParticles();
});

// Load canvas on startup
window.addEventListener('DOMContentLoaded', () => {
  initBackdropParticles();
  animateBackdropParticles();
});
