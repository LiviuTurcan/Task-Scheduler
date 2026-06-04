/* ==========================================================================
   CHART.JS DATA INTEGRATIONS & LIVE SCORE DIALS
   ========================================================================== */

let workloadChart = null;
let cognitiveChart = null;

// Initialize Chart.js components
window.addEventListener('DOMContentLoaded', () => {
  initAnalyticsCharts();
});

function initAnalyticsCharts() {
  const densityCtx = document.getElementById('chart-density-workload').getContext('2d');
  const radarCtx = document.getElementById('chart-radar-cognitive').getContext('2d');

  const themeAccent = getThemeColorToken('--neon-accent') || '#a855f7';
  const themeCyan = getThemeColorToken('--neon-cyan') || '#06b6d4';

  // 1. Density Workload Bar Chart
  workloadChart = new Chart(densityCtx, {
    type: 'bar',
    data: {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      datasets: [{
        label: 'Scheduled Hours',
        data: [0, 0, 0, 0, 0, 0, 0],
        backgroundColor: themeAccent + '33', // 20% opacity
        borderColor: themeAccent,
        borderWidth: 2,
        borderRadius: 6,
        hoverBackgroundColor: themeAccent + '77'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(5, 2, 14, 0.95)',
          titleFont: { family: 'Outfit', size: 12 },
          bodyFont: { family: 'Plus Jakarta Sans', size: 11 },
          borderColor: themeAccent,
          borderWidth: 1
        }
      },
      scales: {
        y: {
          grid: { color: getThemeColorToken('--chart-grid') || 'rgba(255, 255, 255, 0.03)' },
          ticks: { color: getThemeColorToken('--chart-text') || '#64748b', font: { family: 'Outfit', size: 10 } }
        },
        x: {
          grid: { display: false },
          ticks: { color: getThemeColorToken('--chart-text') || '#64748b', font: { family: 'Outfit', size: 10 } }
        }
      }
    }
  });

  // 2. Radar Cognitive Mapping Load Chart
  cognitiveChart = new Chart(radarCtx, {
    type: 'radar',
    data: {
      labels: ['Task ID', 'Priority', 'Difficulty', 'Duration', 'Splits'],
      datasets: [{
        label: 'Selected Day Focus Map',
        data: [0, 0, 0, 0, 0],
        backgroundColor: themeCyan + '22',
        borderColor: themeCyan,
        borderWidth: 2,
        pointBackgroundColor: themeCyan,
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: themeCyan
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(5, 2, 14, 0.95)',
          titleFont: { family: 'Outfit', size: 11 },
          bodyFont: { family: 'Plus Jakarta Sans', size: 11 },
          borderColor: themeCyan,
          borderWidth: 1
        }
      },
      scales: {
        r: {
          grid: { color: getThemeColorToken('--chart-grid') || 'rgba(255, 255, 255, 0.04)' },
          angleLines: { color: getThemeColorToken('--chart-grid') || 'rgba(255, 255, 255, 0.04)' },
          pointLabels: { color: getThemeColorToken('--chart-text') || '#64748b', font: { family: 'Outfit', size: 9, weight: '700' } },
          ticks: { display: false }
        }
      }
    }
  });
}

// Update counters, score dial, and charts data when solver runs
function renderMainMetricsDashboard() {
  if (!scheduleOutput) return;

  const stats = scheduleOutput.statistics || {};
  
  // Real-time numeric counting animation for Score
  const scoreEl = document.getElementById('stat-score-val');
  animateNumericCounter(scoreEl, parseInt(scoreEl.textContent) || 0, stats.score || 0);

  const scheduledCount = stats.scheduled_tasks || 0;
  const totalCount = stats.total_tasks || 0;
  const conflicts = stats.conflicts || 0;
  const violations = stats.deadline_violations || 0;

  const efficiencyPercent = totalCount > 0 ? Math.round((scheduledCount / totalCount) * 100) : 0;
  document.getElementById('stat-efficiency-val').textContent = efficiencyPercent + '%';

  // Ring stroke-dashoffset transition (length 238)
  const dialFill = document.getElementById('hud-gauge-fill');
  if (dialFill) {
    const offsetVal = 238 - (238 * efficiencyPercent) / 100;
    dialFill.style.strokeDashoffset = offsetVal;
  }

  const scheduledValEl = document.getElementById('stat-scheduled-val');
  if (scheduledValEl) scheduledValEl.textContent = `${scheduledCount} / ${totalCount}`;
  
  const progressBarEl = document.getElementById('stat-progress-bar');
  if (progressBarEl) {
    const progressPercent = totalCount > 0 ? (scheduledCount / totalCount) * 100 : 0;
    progressBarEl.style.width = progressPercent + '%';
  }

  document.getElementById('stat-conflicts-val').textContent = conflicts + violations;

  // Update Chart.js datasets
  recalculateChartsData();

  // Call Visual timeline re-render
  if (typeof renderTimelineView === 'function') {
    renderTimelineView();
  }
  
  if (typeof updateWeekDensityDotCounters === 'function') {
    updateWeekDensityDotCounters();
  }

  lucide.createIcons();
}

function recalculateChartsData() {
  if (!scheduleOutput || !workloadChart || !cognitiveChart) return;

  // 1. Process workload density across weekdays (Mon-Sun)
  let dayHours = [0, 0, 0, 0, 0, 0, 0];
  
  if (scheduleOutput.schedule) {
    scheduleOutput.schedule.forEach(seg => {
      const start = new Date(seg.start);
      // d.getDay() is 0 (Sun) to 6 (Sat)
      // We align to labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      let labelIdx = start.getDay() - 1; 
      if (labelIdx < 0) labelIdx = 6; // Sunday idx 6
      
      const durationHours = (new Date(seg.end) - start) / (1000 * 60 * 60);
      dayHours[labelIdx] += parseFloat(durationHours.toFixed(2));
    });
  }

  workloadChart.data.datasets[0].data = dayHours;
  workloadChart.update();

  // 2. Process Cognitive Load metrics for selected day
  // Filter scheduled tasks for the currently selected activeDayDateString
  const startDay = new Date(activeDayDateString + "T00:00:00");
  const endDay = new Date(activeDayDateString + "T23:59:59");
  
  let dayTasks = [];
  if (scheduleOutput.schedule) {
    dayTasks = scheduleOutput.schedule.filter(seg => {
      const s = new Date(seg.start);
      return s >= startDay && s <= endDay;
    });
  }

  let avgPriority = 0;
  let avgDifficulty = 0;
  let totalDuration = 0;
  let splitsCount = 0;

  if (dayTasks.length > 0) {
    dayTasks.forEach(seg => {
      avgPriority += seg.priority || 3;
      
      // Match difficulty from form variables
      const taskObj = tasks.find(t => t.id === seg.task_id);
      avgDifficulty += taskObj ? taskObj.difficulty : 3;

      const durMins = (new Date(seg.end) - new Date(seg.start)) / (1000 * 60);
      totalDuration += durMins;
    });

    avgPriority = parseFloat((avgPriority / dayTasks.length).toFixed(1));
    avgDifficulty = parseFloat((avgDifficulty / dayTasks.length).toFixed(1));
    totalDuration = parseFloat((totalDuration / 60).toFixed(1)); // in hours
    
    // Calculate segments splits (where segments scheduled for same task_id > 1)
    const taskIds = dayTasks.map(t => t.task_id);
    const uniqueIds = [...new Set(taskIds)];
    splitsCount = dayTasks.length - uniqueIds.length;
  }

  // Update Radar values (scale normalized to 0-5)
  // Radar Labels: ['Active Tasks', 'Priority Load', 'Difficulty Scale', 'Duration Hrs', 'Splits Count']
  cognitiveChart.data.datasets[0].data = [
    Math.min(5, dayTasks.length),
    avgPriority,
    avgDifficulty,
    Math.min(5, totalDuration),
    Math.min(5, splitsCount)
  ];
  cognitiveChart.update();
}

// Re-colors charts on theme change
function updateChartsThemeColors() {
  if (!workloadChart || !cognitiveChart) return;

  const themeAccent = getThemeColorToken('--neon-accent') || '#a855f7';
  const themeCyan = getThemeColorToken('--neon-cyan') || '#06b6d4';
  const gridColor = getThemeColorToken('--chart-grid') || 'rgba(255, 255, 255, 0.03)';
  const textColor = getThemeColorToken('--chart-text') || '#64748b';

  // Recolor bar workload
  workloadChart.data.datasets[0].backgroundColor = themeAccent + '33';
  workloadChart.data.datasets[0].borderColor = themeAccent;
  workloadChart.data.datasets[0].hoverBackgroundColor = themeAccent + '77';
  workloadChart.options.plugins.tooltip.borderColor = themeAccent;
  
  if (workloadChart.options.scales && workloadChart.options.scales.y) {
    workloadChart.options.scales.y.grid.color = gridColor;
    workloadChart.options.scales.y.ticks.color = textColor;
  }
  if (workloadChart.options.scales && workloadChart.options.scales.x) {
    workloadChart.options.scales.x.ticks.color = textColor;
  }
  workloadChart.update();

  // Recolor radar
  cognitiveChart.data.datasets[0].backgroundColor = themeCyan + '22';
  cognitiveChart.data.datasets[0].borderColor = themeCyan;
  cognitiveChart.data.datasets[0].pointBackgroundColor = themeCyan;
  cognitiveChart.data.datasets[0].pointHoverBorderColor = themeCyan;
  cognitiveChart.options.plugins.tooltip.borderColor = themeCyan;
  
  if (cognitiveChart.options.scales && cognitiveChart.options.scales.r) {
    cognitiveChart.options.scales.r.grid.color = gridColor;
    cognitiveChart.options.scales.r.angleLines.color = gridColor;
    cognitiveChart.options.scales.r.pointLabels.color = textColor;
  }
  cognitiveChart.update();
}

function getThemeColorToken(variable) {
  return getComputedStyle(document.body).getPropertyValue(variable).trim();
}

function animateNumericCounter(element, start, end) {
  if (start === end) {
    element.textContent = end;
    return;
  }
  let current = start;
  const range = end - start;
  const stepTime = Math.abs(Math.floor(800 / range)) || 15;
  const increment = end > start ? 1 : -1;
  
  const timer = setInterval(() => {
    current += increment;
    if (current === end) {
      clearInterval(timer);
    }
    element.textContent = current;
  }, stepTime);
}
