/* ==========================================================================
   CHRONO GUIDE TOUR — STEP-BY-STEP INTERACTIVE TUTORIAL
   ========================================================================== */

let tourCurrentStep = 0;

const tourSteps = [
  {
    title: "Welcome to Task Scheduler!",
    text: "Welcome to Task Scheduler! This platform is an <strong>Enterprise-grade C++ Scheduling Engine</strong> that optimizes your task priorities, difficulties, and deadlines into available time slots without conflicts. Let's take a quick tour!",
    target: "header.glass-card",
    position: "bottom"
  },
  {
    title: "Sidebar Control Dock",
    text: "Use the sidebar to manage your inputs: <strong>Tasks</strong> (with priorities and difficulty), <strong>Available Slots</strong> (your free hours), and <strong>Fixed Commitments</strong> (unmovable events). Your edits instantly sync to the <strong>Developer tab</strong>.",
    target: "aside.sidebar-dock",
    position: "right"
  },
  {
    title: "SaaS Analytics Dashboard",
    text: "The dashboard displays real-time analytics. Whenever you run the C++ optimizer, it updates your **Optimization Index**, workload density charts, and cognitive load radar map.",
    target: "section.metrics-hud-row",
    position: "bottom"
  },
  {
    title: "Visual 24h Timeline Chrono",
    text: "This is your interactive schedule calendar. Emerald frames show available slots, orange cards represent locked commitments, and purple cards display optimized tasks scheduled by the engine.",
    target: "div.timeline-viewport",
    position: "top"
  },
  {
    title: "Vanilla Drag Snapping",
    text: "Need manual adjustments? Simply **drag and drop** or **resize** any scheduled task block vertically! It snaps to the nearest grid interval, locks the task in place, and triggers the optimizer to recalculate the rest of your schedule.",
    target: "div.visual-blocks-col",
    position: "left"
  }
];

// Initialize Tour on startup
window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-chrono-guide').addEventListener('click', startChronoTour);
  
  // Auto-launch on startup unless disabled in settings
  const autolaunch = localStorage.getItem('chrono_demo_tour_autolaunch') !== 'false';
  if (autolaunch) {
    startChronoTour();
  }
});

function startChronoTour() {
  tourCurrentStep = 0;
  
  const overlay = document.getElementById('tour-overlay-element');
  if (overlay) overlay.classList.add('active');
  const card = document.getElementById('tour-card-element');
  if (card) card.classList.add('active');
  
  renderTourStep();
}

function abortChronoTour() {
  const overlay = document.getElementById('tour-overlay-element');
  if (overlay) overlay.classList.remove('active');
  const card = document.getElementById('tour-card-element');
  if (card) card.classList.remove('active');
  
  // Clear any existing focus highlights
  document.querySelectorAll('.tour-highlight-focus').forEach(el => {
    el.classList.remove('tour-highlight-focus');
  });

  if (typeof setTourCameraStep === 'function') {
    setTourCameraStep(-1);
  }

  localStorage.setItem('chrono_tour_completed_phase7', 'true');
  showSpringToast('Completed Chrono Guide Tour. Happy scheduling!');
}

function navigateTourStep(direction) {
  tourCurrentStep += direction;
  
  if (tourCurrentStep < 0) {
    tourCurrentStep = 0;
    return;
  }
  
  if (tourCurrentStep >= tourSteps.length) {
    abortChronoTour();
    return;
  }
  
  renderTourStep();
}

function renderTourStep() {
  const step = tourSteps[tourCurrentStep];
  
  if (typeof setTourCameraStep === 'function') {
    setTourCameraStep(tourCurrentStep);
  }
  
  // 1. Update text & title
  document.getElementById('tour-step-title').textContent = step.title;
  document.getElementById('tour-step-text').innerHTML = step.text;
  
  // 2. Render pips
  const pipsContainer = document.getElementById('tour-pips-viewport');
  pipsContainer.innerHTML = '';
  for (let i = 0; i < tourSteps.length; i++) {
    const pip = document.createElement('span');
    pip.className = `tour-pip ${i === tourCurrentStep ? 'active' : ''}`;
    pipsContainer.appendChild(pip);
  }

  // 3. Configure button text
  const prevBtn = document.getElementById('btn-tour-prev');
  const nextBtn = document.getElementById('btn-tour-next');
  
  prevBtn.style.visibility = tourCurrentStep === 0 ? 'hidden' : 'visible';
  nextBtn.textContent = tourCurrentStep === tourSteps.length - 1 ? 'Finish' : 'Next';

  // 4. Set highlights
  document.querySelectorAll('.tour-highlight-focus').forEach(el => {
    el.classList.remove('tour-highlight-focus');
  });
  
  const targetEl = document.querySelector(step.target);
  if (targetEl) {
    targetEl.classList.add('tour-highlight-focus');
    
    // Scroll highlighted target into view instantly first
    targetEl.scrollIntoView({ behavior: 'auto', block: 'center' });
    
    // Wait 50ms for layout scroll to complete before positioning
    setTimeout(() => {
      positionTourCard(targetEl, step.position);
    }, 50);
  } else {
    // Fallback to screen center
    centerTourCard();
  }

  lucide.createIcons();
}

function positionTourCard(targetEl, position) {
  const card = document.getElementById('tour-card-element');
  const rect = targetEl.getBoundingClientRect();
  
  const cardWidth = 380;
  const cardHeight = 240;
  const margin = 20;
  
  const viewWidth = window.innerWidth;
  const viewHeight = window.innerHeight;
  
  let targetPosition = position;
  
  // Dynamic direction auto-flipping to prevent target overlapping due to screen boundaries
  if (targetPosition === 'bottom') {
    // If placing at bottom would overflow the screen bottom, flip to top
    if (rect.bottom + cardHeight + margin > viewHeight) {
      targetPosition = 'top';
    }
  } else if (targetPosition === 'top') {
    // If placing at top would overflow the screen top, flip to bottom
    if (rect.top - cardHeight - margin < 0) {
      targetPosition = 'bottom';
    }
  } else if (targetPosition === 'right') {
    // If placing at right would overflow the screen right, flip to left
    if (rect.right + cardWidth + margin > viewWidth) {
      targetPosition = 'left';
    }
  } else if (targetPosition === 'left') {
    // If placing at left would overflow the screen left, flip to right
    if (rect.left - cardWidth - margin < 0) {
      targetPosition = 'right';
    }
  }
  
  let top = viewHeight / 2 - cardHeight / 2;
  let left = viewWidth / 2 - cardWidth / 2;
  
  if (targetPosition === 'bottom') {
    top = rect.bottom + margin;
    left = rect.left + rect.width / 2 - cardWidth / 2;
  } else if (targetPosition === 'top') {
    top = rect.top - cardHeight - margin;
    left = rect.left + rect.width / 2 - cardWidth / 2;
  } else if (targetPosition === 'right') {
    top = rect.top + rect.height / 2 - cardHeight / 2;
    left = rect.right + margin;
  } else if (targetPosition === 'left') {
    top = rect.top + rect.height / 2 - cardHeight / 2;
    left = rect.left - cardWidth - margin;
  }
  
  // Clamping parameters to prevent window overflows
  top = Math.max(margin, Math.min(top, viewHeight - cardHeight - margin));
  left = Math.max(margin, Math.min(left, viewWidth - cardWidth - margin));
  
  card.style.top = top + 'px';
  card.style.left = left + 'px';
}

function centerTourCard() {
  const card = document.getElementById('tour-card-element');
  const cardWidth = 380;
  const cardHeight = 240;
  
  card.style.top = (window.innerHeight / 2 - cardHeight / 2) + 'px';
  card.style.left = (window.innerWidth / 2 - cardWidth / 2) + 'px';
}
