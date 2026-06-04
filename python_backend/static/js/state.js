/* ==========================================================================
   GLOBAL APP STATE, API CALLS, AND BI-DIRECTIONAL TEXTPAYLOAD SYNC
   ========================================================================== */

// Global State Arrays
let tasks = [];
let availability = [];
let fixedEvents = [];
let scheduleOutput = null;
let endedTasks = JSON.parse(localStorage.getItem('chrono_ended_tasks_archive')) || [];

// Presentation & Auto-Plan States
let isAutoSolve = localStorage.getItem('planner_auto_plan') === 'true';
let isScheduleOutOfSync = false;
let lastSolverError = null;
let pendingInputSaveTimer = null;

function formatTaskDisplayLabel(taskOrId, fallbackName = '') {
  if (taskOrId && typeof taskOrId === 'object') {
    if (taskOrId.id === undefined || taskOrId.id === null) {
      return taskOrId.name || fallbackName;
    }
    return `#${taskOrId.id} ${taskOrId.name || fallbackName}`;
  }

  if (taskOrId === undefined || taskOrId === null) {
    return fallbackName;
  }

  return `#${taskOrId} ${fallbackName}`;
}

function serializeTaskToVirtualEventName(task) {
  const depsStr = (task.dependencies || []).join(',');
  const subtasksStr = encodeURIComponent(JSON.stringify(task.subtasks || []));
  const metadata = [
    task.id,
    task.priority,
    task.difficulty,
    task.deadline,
    task.can_split,
    depsStr,
    task.duration_minutes,
    subtasksStr
  ].join(':');
  return `__vt__:${metadata}__:${task.name}`;
}

function deserializeVirtualEventToTask(evt) {
  if (!evt.name || !evt.name.startsWith('__vt__:')) return null;
  const match = evt.name.match(/^__vt__:([^:]+):([^:]+):([^:]+):([^:]+):([^:]+):([^:]*):([^:]+):([^:]+)__:(.+)$/);
  if (!match) return null;
  
  const taskId = parseInt(match[1]);
  const priority = parseInt(match[2]);
  const difficulty = parseInt(match[3]);
  const deadline = match[4];
  const canSplit = match[5] === 'true';
  const dependencies = match[6] ? match[6].split(',').map(id => parseInt(id)) : [];
  const duration = parseInt(match[7]);
  let subtasks = [];
  try {
    subtasks = JSON.parse(decodeURIComponent(match[8]));
  } catch (e) {
    console.error("Failed to parse subtasks from virtual event", e);
  }
  const name = match[9];
  
  return {
    id: taskId,
    name: name,
    duration_minutes: duration,
    deadline: deadline,
    priority: priority,
    difficulty: difficulty,
    dependencies: dependencies,
    can_split: canSplit,
    subtasks: subtasks,
    fixed: true,
    fixed_start: evt.start,
    fixed_end: evt.end
  };
}

function buildOptimizationPayload() {
  const payloadTasks = [];
  const payloadFixedEvents = [...fixedEvents];
  
  let maxFixedEventId = 0;
  fixedEvents.forEach(e => {
    if (e.id > maxFixedEventId) maxFixedEventId = e.id;
  });
  
  const virtualizedTaskIds = new Set();
  tasks.forEach(task => {
    if (task.fixed && task.fixed_start && task.fixed_end) {
      virtualizedTaskIds.add(task.id);
      const virtualId = maxFixedEventId + 1 + task.id;
      payloadFixedEvents.push({
        id: virtualId,
        name: serializeTaskToVirtualEventName(task),
        start: task.fixed_start,
        end: task.fixed_end
      });
    }
  });

  tasks.forEach(task => {
    if (!(task.fixed && task.fixed_start && task.fixed_end)) {
      // Deep copy to prevent mutating the state variable's actual dependencies list
      const taskCopy = JSON.parse(JSON.stringify(task));
      if (taskCopy.dependencies) {
        taskCopy.dependencies = taskCopy.dependencies.filter(depId => !virtualizedTaskIds.has(depId));
      }
      payloadTasks.push(taskCopy);
    }
  });

  return {
    tasks: payloadTasks,
    availability: availability,
    fixed_events: payloadFixedEvents
  };
}

function queueInputSave() {
  if (pendingInputSaveTimer) {
    clearTimeout(pendingInputSaveTimer);
  }
  pendingInputSaveTimer = setTimeout(() => {
    persistInputsOnly();
  }, 250);
}

async function persistInputsOnly() {
  const payload = buildOptimizationPayload();
  try {
    const res = await fetch('/inputs', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Unable to save planner inputs.');
    }
  } catch (err) {
    console.error('persistInputsOnly error', err);
    showSpringToast('Could not save the latest planner edits.', 'error');
  }
}

function toggleAutoSolveState(checked) {
  isAutoSolve = checked;
  localStorage.setItem('planner_auto_plan', isAutoSolve ? 'true' : 'false');
  showSpringToast(`Automatic planning is ${isAutoSolve ? 'on' : 'off'}.`);
  if (isAutoSolve) {
    clearScheduleOutOfSync();
    triggerSchedulerOptimization(true);
  }
}

function markScheduleOutOfSync() {
  isScheduleOutOfSync = true;
  queueInputSave();
  
  // Highlight the manual planning button.
  const btn = document.getElementById('btn-run-scheduler');
  if (btn) {
    btn.classList.add('hud-pulse-warning');
    const span = btn.querySelector('span');
    if (span) span.textContent = 'Plan needed';
  }
  
  // Show the warning banner above the calendar.
  const banner = document.getElementById('calendar-sync-warning-banner');
  if (banner) {
    banner.style.display = 'flex';
  }
  
  // Log a warning to the advanced details panel.
  const diffContainer = document.getElementById('dev-optimization-diff-log');
  if (diffContainer) {
    if (!diffContainer.innerHTML.includes('[WARNING]')) {
      const line = document.createElement('div');
      line.style.color = '#fbbf24';
      line.style.fontWeight = 'bold';
      line.innerHTML = `[WARNING] Planner inputs changed. Click "Plan my week" to refresh the schedule.`;
      diffContainer.insertBefore(line, diffContainer.firstChild);
    }
  }
}

function clearScheduleOutOfSync() {
  isScheduleOutOfSync = false;
  
  // Reset Plan my week button.
  const btn = document.getElementById('btn-run-scheduler');
  if (btn) {
    btn.classList.remove('hud-pulse-warning');
    const span = btn.querySelector('span');
    if (span) span.textContent = 'Plan my week';
  }
  
  // Hide the warning banner above the calendar.
  const banner = document.getElementById('calendar-sync-warning-banner');
  if (banner) {
    banner.style.display = 'none';
  }
}

// View Filtering States (Automatically initialized to Today's Date!)
let activeDayIndex = 1;
let activeDayDateString = "";

// Initialize state to Today's local date
const initialToday = new Date();
const todayIndexVal = initialToday.getDay() === 0 ? 7 : initialToday.getDay();
activeDayIndex = todayIndexVal;

const tYyyy = initialToday.getFullYear();
const tMm = String(initialToday.getMonth() + 1).padStart(2, '0');
const tDd = String(initialToday.getDate()).padStart(2, '0');
activeDayDateString = `${tYyyy}-${tMm}-${tDd}`;

let activeTimelineSegment = 'agenda'; // 'grid' or 'agenda'

// Bootstrapping events listeners
window.addEventListener('DOMContentLoaded', async () => {
  // Set the dynamic week start date to the Monday of the current week
  if (typeof activeWeekStartDate !== 'undefined') {
    const mondayDiff = initialToday.getDate() - todayIndexVal + 1;
    const currentMonday = new Date(initialToday.setDate(mondayDiff));
    currentMonday.setHours(0,0,0,0);
    activeWeekStartDate = currentMonday;
  }

  // Global DOM attachments
  document.getElementById('btn-run-scheduler').addEventListener('click', triggerSchedulerOptimization);
  
  // Wire up Preload Samples button
  const btnPreload = document.getElementById('btn-preload-samples');
  if (btnPreload) {
    btnPreload.addEventListener('click', async () => {
      await fetchServerInputs();
      await triggerSchedulerOptimization(true); // run silently
    });
  }

  // 1. Render hourly grid tick labels
  if (typeof renderChronoTimelineTicks === 'function') {
    renderChronoTimelineTicks();
  }

  // 2. Fetch standard inputs from database storage
  await fetchServerInputs();

  // Draw dynamic weekdays buttons inside container
  if (typeof renderDynamicWeekDays === 'function') {
    renderDynamicWeekDays();
  }

  if (isAutoSolve) {
    await triggerSchedulerOptimization(true);
  } else {
    renderDashboardSummary();
  }

  // Attach HTML5 Drag-and-Drop listener to the calendar canvas.
  const canvas = document.getElementById('chrono-timeline-canvas');
  if (canvas) {
    canvas.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });
    
    canvas.addEventListener('dragenter', (e) => {
      canvas.classList.add('drag-hover');
    });
    
    canvas.addEventListener('dragleave', (e) => {
      canvas.classList.remove('drag-hover');
    });
    
    canvas.addEventListener('drop', async (e) => {
      e.preventDefault();
      canvas.classList.remove('drag-hover');
      
      const taskIdStr = e.dataTransfer.getData('text/plain');
      const taskId = parseInt(taskIdStr);
      if (isNaN(taskId)) return;
      
      const rect = canvas.getBoundingClientRect();
      let clickY = e.clientY - rect.top;
      
      // Snap to 15-minute grid (15px)
      clickY = Math.round(clickY / 15) * 15;
      clickY = Math.max(0, Math.min(clickY, 1440 - 15));
      
      const startHour = Math.floor(clickY / 60);
      const startMins = clickY % 60;
      
      const taskObj = tasks.find(t => t.id === taskId);
      if (!taskObj) return;
      
      const duration = taskObj.duration_minutes || 60;
      const endTotal = clickY + duration;
      const endHour = Math.floor(endTotal / 60);
      const endMins = endTotal % 60;
      
      const newStartISO = `${activeDayDateString}T${String(startHour).padStart(2, '0')}:${String(startMins).padStart(2, '0')}:00`;
      const newEndISO = `${activeDayDateString}T${String(endHour).padStart(2, '0')}:${String(endMins).padStart(2, '0')}:00`;
      
      if (typeof saveBackupCurrentDatabaseState === 'function') {
        saveBackupCurrentDatabaseState();
      }
      taskObj.fixed = true;
      taskObj.fixed_start = newStartISO;
      taskObj.fixed_end = newEndISO;
      
      showSpringToast(`Scheduled "${taskObj.name}" on ${activeDayDateString} at ${String(startHour).padStart(2, '0')}:${String(startMins).padStart(2, '0')}.`);
      
      syncStateToVisualDocks();
      if (isAutoSolve) {
        await triggerSchedulerOptimization(true);
      } else {
        markScheduleOutOfSync();
      }
    });
  }
});

// Backup DB variables for the Unsync/Revert feature
let backupTasks = [];
let backupAvailability = [];
let backupFixedEvents = [];
let backupScheduleOutput = null;

// Save copies of data variables to allow undoing edits
function saveBackupCurrentDatabaseState() {
  backupTasks = JSON.parse(JSON.stringify(tasks));
  backupAvailability = JSON.parse(JSON.stringify(availability));
  backupFixedEvents = JSON.parse(JSON.stringify(fixedEvents));
  backupScheduleOutput = scheduleOutput ? JSON.parse(JSON.stringify(scheduleOutput)) : null;
}

// Flag to block backup saving during active revert sequences
let isRevertingDatabaseState = false;

// Revert unsynced developer JSON console changes
async function revertUnsyncDeveloperEdits() {
  if (backupTasks.length === 0 && backupAvailability.length === 0 && backupFixedEvents.length === 0) {
    showSpringToast('No prior state logged. Preload or run first!', 'error');
    return;
  }
  
  isRevertingDatabaseState = true;
  
  tasks = JSON.parse(JSON.stringify(backupTasks));
  availability = JSON.parse(JSON.stringify(backupAvailability));
  fixedEvents = JSON.parse(JSON.stringify(backupFixedEvents));
  scheduleOutput = backupScheduleOutput ? JSON.parse(JSON.stringify(backupScheduleOutput)) : null;
  
  syncStateToVisualDocks();
  showSpringToast('Restored previous database state. Unsynced changes.');
  
  // Call solver in silent mode (silent = true)
  await triggerSchedulerOptimization(true);
  
  isRevertingDatabaseState = false;
}

// Load inputs from backend GET /inputs
async function fetchServerInputs() {
  try {
    const res = await fetch('/inputs');
    const data = await res.json();
    
    if (data.success) {
      const serverTasks = data.tasks || [];
      const serverFixedEvents = data.fixed_events || [];
      
      const restoredTasks = [...serverTasks];
      const restoredFixedEvents = [];
      
      serverFixedEvents.forEach(evt => {
        const restoredTask = deserializeVirtualEventToTask(evt);
        if (restoredTask) {
          const exists = restoredTasks.some(t => t.id === restoredTask.id);
          if (!exists) {
            restoredTasks.push(restoredTask);
          }
        } else {
          restoredFixedEvents.push(evt);
        }
      });
      
      tasks = restoredTasks;
      availability = data.availability || [];
      fixedEvents = restoredFixedEvents;
      
      // Auto-align calendar view week starting date based on first loaded task or availability date
      // Only do this if they exist and are in a different week to preserve "today" focus
      let firstDateStr = null;
      if (tasks.length > 0 && tasks[0].deadline) {
        firstDateStr = tasks[0].deadline;
      } else if (availability.length > 0 && availability[0].start) {
        firstDateStr = availability[0].start;
      }
      
      if (firstDateStr && typeof activeWeekStartDate !== 'undefined') {
        const d = new Date(firstDateStr);
        if (!isNaN(d.getTime())) {
          // Calculate Monday of the first item's week
          const day = d.getDay();
          const diff = d.getDate() - day + (day === 0 ? -6 : 1);
          const monday = new Date(d.getTime());
          monday.setDate(diff);
          monday.setHours(0,0,0,0);
          
          // Only shift the calendar focus if the loaded week differs from current week start
          if (Math.abs(activeWeekStartDate.getTime() - monday.getTime()) > 24 * 60 * 60 * 1000) {
            activeWeekStartDate = monday;
            const yyyy = monday.getFullYear();
            const mm = String(monday.getMonth() + 1).padStart(2, '0');
            const dd = String(monday.getDate()).padStart(2, '0');
            activeDayDateString = `${yyyy}-${mm}-${dd}`;
            activeDayIndex = 1;
          }
        }
      }
      
      // Save initial backup copy
      saveBackupCurrentDatabaseState();
      
      // Scan and archive any ended/expired tasks right away
      const didArchiveOnLoad = scanAndArchiveEndedTasks();
      if (didArchiveOnLoad) {
        queueInputSave();
      }
      
      renderDashboardSummary();
    } else {
      showSpringToast('Failed to load saved planner data.', 'error');
    }
  } catch (err) {
    console.error("fetchServerInputs error", err);
    showSpringToast('Could not connect to saved planner data.', 'error');
  }

  // Draw docks card list cards
  syncStateToVisualDocks();
}

// Recalculate schedule POST /run
async function triggerSchedulerOptimization(silent = false) {
  const btn = document.getElementById('btn-run-scheduler');
  const icon = document.getElementById('run-icon');
  
  btn.disabled = true;
  btn.style.opacity = '0.75';
  btn.querySelector('span').textContent = 'Planning...';
  if (icon) {
    icon.setAttribute('data-lucide', 'loader-2');
    icon.classList.add('loading-spinner-spin');
  }
  lucide.createIcons();

  // Save a backup of input fields right before running the solver, if not reverting
  if (!isRevertingDatabaseState) {
    saveBackupCurrentDatabaseState();
  }

  // Retain a copy of the prior schedule to compare start-end time differences
  const priorSchedule = scheduleOutput ? JSON.parse(JSON.stringify(scheduleOutput.schedule || [])) : [];



  const payload = buildOptimizationPayload();

  try {
    const res = await fetch('/run', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    
    if (data.success) {
      scheduleOutput = data.schedule;
      lastSolverError = null;
      
      // Append manually scheduled (fixed) tasks back into the output schedule
      tasks.forEach(task => {
        if (task.fixed && task.fixed_start && task.fixed_end) {
          const exists = scheduleOutput.schedule.some(seg => seg.task_id === task.id);
          if (!exists) {
            scheduleOutput.schedule.push({
              task_id: task.id,
              task_name: task.name,
              start: task.fixed_start,
              end: task.fixed_end,
              priority: task.priority,
              deadline: task.deadline
            });
          }
        }
      });
      
      // Correct statistics to reflect virtualized fixed tasks
      if (scheduleOutput.statistics) {
        const totalGlobalTasks = tasks.length;
        const fixedTasksCount = tasks.filter(t => t.fixed && t.fixed_start && t.fixed_end).length;
        
        scheduleOutput.statistics.total_tasks = totalGlobalTasks;
        scheduleOutput.statistics.scheduled_tasks = (scheduleOutput.statistics.scheduled_tasks || 0) + fixedTasksCount;
        scheduleOutput.statistics.unscheduled_tasks = totalGlobalTasks - scheduleOutput.statistics.scheduled_tasks;
        if (scheduleOutput.statistics.unscheduled_tasks < 0) {
          scheduleOutput.statistics.unscheduled_tasks = 0;
        }
      }
      
      clearScheduleOutOfSync();
      
      // Scan for ended tasks and archive them
      const didArchive = scanAndArchiveEndedTasks();
      if (didArchive) {
        setTimeout(() => {
          triggerSchedulerOptimization(true);
        }, 100);
        return;
      }
      
      // Only show success toast if user manually clicked plan or sync (not silent).
      if (!silent) {
        showSpringToast('Your week is planned.');
      }
      
      // Calculate schedule differences (diff-like log) for live demonstration
      const diffContainer = document.getElementById('dev-optimization-diff-log');
      if (diffContainer) {
        diffContainer.innerHTML = '';
        const currentSchedule = scheduleOutput.schedule || [];
        
        let changeCount = 0;
        
        currentSchedule.forEach(newSeg => {
          // Look for matching task_id in previous schedule
          const oldSeg = priorSchedule.find(s => s.task_id === newSeg.task_id);
          
          if (!oldSeg) {
            // Task newly scheduled
            const logLine = document.createElement('div');
            logLine.style.color = 'var(--neon-cyan)';
            logLine.innerHTML = `<span style="color: var(--neon-emerald); font-weight:700;">+ Planned</span> "${escapeHtml(newSeg.task_name)}" at <span style="font-weight:700;">${formatTimeClock(new Date(newSeg.start))}-${formatTimeClock(new Date(newSeg.end))}</span>`;
            diffContainer.appendChild(logLine);
            changeCount++;
          } else if (oldSeg.start !== newSeg.start || oldSeg.end !== newSeg.end) {
            // Task rescheduled to different hours
            const logLine = document.createElement('div');
            logLine.style.color = '#a66b2f';
            logLine.innerHTML = `<span style="color: #a66b2f; font-weight:700;">~ Moved</span> "${escapeHtml(newSeg.task_name)}" from <span style="text-decoration: line-through; opacity: 0.6;">${formatTimeClock(new Date(oldSeg.start))}</span> to <span style="font-weight:700;">${formatTimeClock(new Date(newSeg.start))}-${formatTimeClock(new Date(newSeg.end))}</span>`;
            diffContainer.appendChild(logLine);
            changeCount++;
          }
        });
        
        // Find deleted/unscheduled tasks
        priorSchedule.forEach(oldSeg => {
          const stillScheduled = currentSchedule.some(s => s.task_id === oldSeg.task_id);
          if (!stillScheduled) {
            const logLine = document.createElement('div');
            logLine.style.color = 'var(--neon-rose)';
            logLine.innerHTML = `<span style="color: var(--neon-rose); font-weight:700;">- Removed</span> "${escapeHtml(oldSeg.task_name)}" is no longer planned`;
            diffContainer.appendChild(logLine);
            changeCount++;
          }
        });
        
        if (changeCount === 0) {
          diffContainer.innerHTML = '<span style="color: var(--text-muted);">No time changes. Your current schedule still fits.</span>';
        }
      }
      
      // Update sidebar visual docks (to show newly scheduled / fixed times)
      syncStateToVisualDocks();
      
      // Update charts & timeline chrono grids
      renderMainMetricsDashboard();
    } else {
      showSpringToast('Planning failed: ' + data.error, 'error');
      lastSolverError = data.error;
      syncStateToVisualDocks();
      if (backupTasks && backupTasks.length > 0) {
        tasks = JSON.parse(JSON.stringify(backupTasks));
        availability = JSON.parse(JSON.stringify(backupAvailability));
        fixedEvents = JSON.parse(JSON.stringify(backupFixedEvents));
        scheduleOutput = backupScheduleOutput ? JSON.parse(JSON.stringify(backupScheduleOutput)) : null;
        syncStateToVisualDocks();
        if (typeof renderTimelineView === 'function') {
          renderTimelineView();
        }
        showSpringToast('Reverted the last manual schedule change.', 'warning');
      }
    }
  } catch (err) {
    console.error(err);
    showSpringToast('Could not reach the scheduler.', 'error');
    lastSolverError = err.message;
    syncStateToVisualDocks();
    if (backupTasks && backupTasks.length > 0) {
      tasks = JSON.parse(JSON.stringify(backupTasks));
      availability = JSON.parse(JSON.stringify(backupAvailability));
      fixedEvents = JSON.parse(JSON.stringify(backupFixedEvents));
      scheduleOutput = backupScheduleOutput ? JSON.parse(JSON.stringify(backupScheduleOutput)) : null;
      syncStateToVisualDocks();
      if (typeof renderTimelineView === 'function') {
        renderTimelineView();
      }
    }
  } finally {
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.querySelector('span').textContent = 'Plan my week';
    if (icon) {
      icon.setAttribute('data-lucide', 'sparkles');
      icon.classList.remove('loading-spinner-spin');
    }
    lucide.createIcons();
  }
}



function renderDashboardSummary() {
  renderTodayTasksSummary();
  renderUpcomingDeadlinesSummary();
  renderWeeklyPreviewSummary();
  renderScheduleExplanations();
  renderPlannerResultNote();
}

function renderPlannerHeaderCopy() {
  const weekEl = document.getElementById('planner-week-range');
  if (weekEl && typeof activeWeekStartDate !== 'undefined') {
    const weekStart = new Date(activeWeekStartDate.getTime());
    const weekEnd = new Date(activeWeekStartDate.getTime() + 6 * 24 * 60 * 60 * 1000);
    const startLabel = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endLabel = weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    weekEl.textContent = `${startLabel} - ${endLabel}`;
  }
}

function isSameLocalDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function formatShortDayLabel(dateObj) {
  return dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatDashboardTimeRange(start, end) {
  return `${formatTimeClock(new Date(start))}-${formatTimeClock(new Date(end))}`;
}

function renderTodayTasksSummary() {
  const container = document.getElementById('dashboard-today-list');
  if (!container) return;

  const today = new Date();
  const rows = [];

  if (scheduleOutput && Array.isArray(scheduleOutput.schedule)) {
    scheduleOutput.schedule.forEach(seg => {
      const start = new Date(seg.start);
      if (isSameLocalDay(start, today)) {
        rows.push({
          title: seg.task_name,
          meta: `${formatDashboardTimeRange(seg.start, seg.end)} planned`,
          sortDate: start
        });
      }
    });
  }

  fixedEvents.forEach(evt => {
    const start = new Date(evt.start);
    if (isSameLocalDay(start, today)) {
      rows.push({
        title: evt.name,
        meta: `${formatDashboardTimeRange(evt.start, evt.end)} fixed`,
        sortDate: start
      });
    }
  });

  tasks.forEach(task => {
    const deadline = new Date(task.deadline);
    const taskLabel = formatTaskDisplayLabel(task);
    const alreadyShown = rows.some(row => row.title === taskLabel);
    if (!alreadyShown && isSameLocalDay(deadline, today)) {
      rows.push({
        title: taskLabel,
        meta: `Due today at ${formatTimeClock(deadline)}`,
        sortDate: deadline
      });
    }
  });

  rows.sort((a, b) => a.sortDate - b.sortDate);

  if (rows.length === 0) {
    container.innerHTML = tasks.length === 0
      ? '<div class="empty-state">No schedule yet. Add tasks and availability to get started.</div>'
      : '<div class="empty-state">Nothing on today\'s plan yet.</div>';
    return;
  }

  container.innerHTML = rows.slice(0, 6).map(row => `
    <div class="summary-row">
      <strong>${escapeHtml(row.title)}</strong>
      <span>${escapeHtml(row.meta)}</span>
    </div>
  `).join('');
}

function renderUpcomingDeadlinesSummary() {
  const container = document.getElementById('dashboard-deadlines-list');
  if (!container) return;

  const now = new Date();
  const upcoming = tasks
    .filter(task => task.deadline && new Date(task.deadline) >= now)
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
    .slice(0, 5);

  if (upcoming.length === 0) {
    container.innerHTML = '<div class="empty-state">No deadlines coming up. Add a due date when you create a task.</div>';
    return;
  }

  container.innerHTML = upcoming.map(task => {
    const deadline = new Date(task.deadline);
    return `
      <div class="summary-row">
        <strong>${escapeHtml(formatTaskDisplayLabel(task))}</strong>
        <span>${formatShortDayLabel(deadline)} at ${formatTimeClock(deadline)}</span>
      </div>
    `;
  }).join('');
}

function renderWeeklyPreviewSummary() {
  const container = document.getElementById('dashboard-week-preview');
  if (!container) return;

  if (!scheduleOutput || !Array.isArray(scheduleOutput.schedule) || scheduleOutput.schedule.length === 0) {
    container.innerHTML = '<div class="empty-state">Your weekly preview will appear after planning.</div>';
    return;
  }

  const dayTotals = new Map();
  scheduleOutput.schedule.forEach(seg => {
    const start = new Date(seg.start);
    const key = start.toISOString().substring(0, 10);
    const current = dayTotals.get(key) || { date: start, minutes: 0, count: 0 };
    current.minutes += Math.max(0, (new Date(seg.end) - start) / (1000 * 60));
    current.count += 1;
    dayTotals.set(key, current);
  });

  const rows = Array.from(dayTotals.values())
    .sort((a, b) => a.date - b.date)
    .slice(0, 7);

  container.innerHTML = rows.map(row => {
    const hours = row.minutes >= 60
      ? `${Math.floor(row.minutes / 60)}h ${Math.round(row.minutes % 60)}m`
      : `${Math.round(row.minutes)}m`;
    return `
      <div class="week-preview-row">
        <strong>${formatShortDayLabel(row.date)}</strong>
        <span>${hours} across ${row.count} item${row.count === 1 ? '' : 's'}</span>
      </div>
    `;
  }).join('');
}

function renderScheduleExplanations() {
  const container = document.getElementById('schedule-explanation-list');
  if (!container) return;

  if (!scheduleOutput || !Array.isArray(scheduleOutput.schedule) || scheduleOutput.schedule.length === 0) {
    container.innerHTML = '<div class="empty-state">Plan your week to see why each block landed where it did.</div>';
    return;
  }

  function formatReasonList(reasons) {
    if (reasons.length === 1) return reasons[0];
    if (reasons.length === 2) return `${reasons[0]} and ${reasons[1]}`;
    return `${reasons.slice(0, -1).join(', ')}, and ${reasons[reasons.length - 1]}`;
  }

  const seenTaskIds = new Set();
  const segments = [...scheduleOutput.schedule].sort((a, b) => new Date(a.start) - new Date(b.start));
  const explanations = [];

  segments.forEach(seg => {
    if (seenTaskIds.has(seg.task_id) || explanations.length >= 6) return;
    seenTaskIds.add(seg.task_id);
    const task = tasks.find(t => String(t.id) === String(seg.task_id));
    const start = new Date(seg.start);
    const reasons = [];

    if (task && task.priority >= 4) {
      reasons.push('it is high priority');
    }

    if (task && task.deadline) {
      const hoursUntilDeadline = (new Date(task.deadline) - start) / (1000 * 60 * 60);
      if (hoursUntilDeadline <= 48) {
        reasons.push('it has a close deadline');
      }
    }

    if (task && task.difficulty >= 4) {
      reasons.push('it needs focused time');
    }

    const fitsAvailability = availability.some(avail => {
      const availStart = new Date(avail.start);
      const availEnd = new Date(avail.end);
      return availStart <= start && new Date(seg.end) <= availEnd;
    });
    if (fitsAvailability) {
      reasons.push('it fits inside your available hours');
    }

    const reasonText = reasons.length > 0
      ? `Placed here because ${formatReasonList(reasons)}.`
      : 'Placed in the earliest open time that avoided fixed events.';

    explanations.push(`
      <div class="explanation-item">
        <strong>${escapeHtml(seg.task_name)}</strong>
        <span>${reasonText}</span>
      </div>
    `);
  });

  container.innerHTML = explanations.join('');
}

function renderPlannerResultNote() {
  const note = document.getElementById('dashboard-plan-note');
  if (!note) return;

  if (!scheduleOutput || !scheduleOutput.statistics) {
    note.textContent = 'Plan your week to see a short recap here.';
    return;
  }

  const stats = scheduleOutput.statistics;
  const scheduled = stats.scheduled_tasks || 0;
  const total = stats.total_tasks || tasks.length;
  const unscheduled = Math.max(0, total - scheduled);
  note.textContent = unscheduled > 0
    ? `${scheduled} of ${total} tasks were placed. ${unscheduled} still need time.`
    : `${scheduled} of ${total} tasks were placed for this week.`;
}

// Re-render visual list cards in sidebar docks
function syncStateToVisualDocks() {
  // Totals tags
  document.getElementById('badge-total-tasks').textContent = tasks.length;
  document.getElementById('badge-total-availability').textContent = availability.length;
  document.getElementById('badge-total-fixed').textContent = fixedEvents.length;

  // 1. Task cards deck
  const tViewport = document.getElementById('tasks-deck-viewport');
  tViewport.innerHTML = '';
  
  if (tasks.length === 0) {
    tViewport.innerHTML = '<div class="empty-state">No tasks yet. Add your first task.</div>';
  } else {
    tasks.forEach((task, idx) => {
      const card = document.createElement('div');
      card.className = 'card-item';
      card.setAttribute('draggable', 'true');
      card.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', String(task.id));
        e.dataTransfer.effectAllowed = 'move';
      });
      
      const depsNames = task.dependencies.map(id => {
        const tObj = tasks.find(t => t.id === id);
        return tObj ? tObj.name : '#' + id;
      }).join(', ');

      let priorityStars = '';
      for (let s = 1; s <= 5; s++) {
        priorityStars += s <= task.priority ? '*' : '-';
      }

      // Compute checklist progress if subtasks checklists exist
      let checklistHtml = '';
      if (task.subtasks && task.subtasks.length > 0) {
        const total = task.subtasks.length;
        const checked = task.subtasks.filter(s => s.completed).length;
        const pct = Math.round((checked / total) * 100);
        
        checklistHtml = `
          <div class="card-subtask-checklist-hud">
            <div class="card-subtask-progress-deck">
              <span>Subtasks checklist</span>
              <span>${pct}% (${checked}/${total})</span>
            </div>
            <!-- Checklist progress line -->
            <div style="height: 3px; background: rgba(255,255,255,0.06); border-radius: 2px; overflow: hidden; margin-top:2px; margin-bottom:4px;">
              <div style="height:100%; width:${pct}%; background:var(--neon-cyan); transition:var(--transition-all);"></div>
            </div>
            <!-- Print subtasks checklist options -->
            ${task.subtasks.map((sub, sIdx) => `
              <div class="card-subtask-item ${sub.completed ? 'checked' : ''}" onclick="toggleSubtaskCheckNode(${idx}, ${sIdx}, event)">
                <input type="checkbox" ${sub.completed ? 'checked' : ''} />
                <span>${escapeHtml(sub.name)}</span>
              </div>
            `).join('')}
          </div>
        `;
      }

      card.innerHTML = `
        <div class="card-item-top">
          <div class="card-item-title">${escapeHtml(formatTaskDisplayLabel(task))}</div>
          <div class="card-item-actions">
            <button class="card-action-btn" onclick="launchEditTaskModal(${idx})" title="Edit task"><i data-lucide="edit-3" style="width:14px;height:14px;"></i></button>
            <button class="card-action-btn delete" onclick="deleteTaskNode(${idx})" title="Delete task"><i data-lucide="trash-2" style="width:14px;height:14px;"></i></button>
          </div>
        </div>
        <div class="card-badge-row">
          <span class="badge-hud p-purple">${formatMinutesLabel(task.duration_minutes)}</span>
          <span class="badge-hud" style="color:#fbbf24; border-color:rgba(251,191,36,0.15);">${priorityStars}</span>
          <span class="badge-hud">
            <div class="hud-difficulty-wrapper">
              <span>Diff:</span>
              <div class="hud-diff-track"><div class="hud-diff-fill" style="width:${task.difficulty * 20}%"></div></div>
            </div>
          </span>
          ${task.can_split ? '<span class="badge-hud p-cyan">Can split</span>' : '<span class="badge-hud" style="color:var(--text-muted);">One block</span>'}
          ${task.dependencies.length > 0 ? `<span class="badge-hud" title="Depends on: ${escapeHtml(depsNames)}" style="max-width:120px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"><i data-lucide="git-merge" style="width:10px;"></i> ${task.dependencies.length} before</span>` : ''}
        </div>
        
        ${checklistHtml}

        <div style="font-size:10px; color:var(--text-muted); display:flex; align-items:center; gap:5px; margin-top:4px;">
          <i data-lucide="calendar" style="width:11px;"></i> Due: ${formatDateLabel(task.deadline)}
        </div>
        ${(() => {
          if (task.fixed && task.fixed_start && task.fixed_end) {
            const start = new Date(task.fixed_start);
            const end = new Date(task.fixed_end);
            const isInside = availability.some(avail => {
              const availStart = new Date(avail.start);
              const availEnd = new Date(avail.end);
              return (availStart <= start && end <= availEnd);
            });
            return `
              <div style="font-size:10px; color:${isInside ? 'var(--neon-orange)' : 'var(--neon-rose)'}; display:flex; align-items:flex-start; gap:5px; margin-top:4px; font-weight:700;">
                <i data-lucide="${isInside ? 'lock' : 'alert-triangle'}" style="width:11px; color:${isInside ? 'var(--neon-orange)' : 'var(--neon-rose)'}; margin-top:2px;"></i>
                <div>
                  <span>Pinned time${isInside ? '' : ' (outside availability)'}:</span><br>
                  <span style="font-weight:500; ${isInside ? '' : 'text-decoration: underline wavy var(--neon-rose);'}">${formatDateLabel(task.fixed_start)} - ${formatTimeClock(new Date(task.fixed_end))}</span>
                </div>
              </div>
            `;
          } else if (scheduleOutput && scheduleOutput.schedule) {
            const segments = scheduleOutput.schedule.filter(seg => String(seg.task_id) === String(task.id));
            if (segments.length > 0) {
              segments.sort((a, b) => new Date(a.start) - new Date(b.start));
              const timeRanges = segments.map(seg => {
                const segStart = new Date(seg.start);
                const segEnd = new Date(seg.end);
                const isSegInside = availability.some(avail => {
                  const availStart = new Date(avail.start);
                  const availEnd = new Date(avail.end);
                  return (availStart <= segStart && segEnd <= availEnd);
                });
                return `<span style="font-weight:500; ${isSegInside ? '' : 'text-decoration: underline wavy var(--neon-rose);'}">${formatDateLabel(seg.start)} - ${formatTimeClock(new Date(seg.end))} ${isSegInside ? '' : '(outside availability)'}</span>`;
              }).join('<br>');
              
              const allInside = segments.every(seg => {
                const segStart = new Date(seg.start);
                const segEnd = new Date(seg.end);
                return availability.some(avail => {
                  const availStart = new Date(avail.start);
                  const availEnd = new Date(avail.end);
                  return (availStart <= segStart && segEnd <= availEnd);
                });
              });

              return `
                <div style="font-size:10px; color:${allInside ? 'var(--neon-emerald)' : 'var(--neon-rose)'}; display:flex; align-items:flex-start; gap:5px; margin-top:4px; font-weight:700;">
                  <i data-lucide="${allInside ? 'calendar' : 'alert-triangle'}" style="width:11px; color:${allInside ? 'var(--neon-emerald)' : 'var(--neon-rose)'}; margin-top:2px;"></i>
                  <div>
                    <span>Planned time:</span><br>
                    ${timeRanges}
                  </div>
                </div>
              `;
            } else {
              return `
                <div style="font-size:10px; color:var(--neon-rose); display:flex; align-items:center; gap:5px; margin-top:4px; font-weight:700;">
                  <i data-lucide="alert-circle" style="width:11px; color:var(--neon-rose);"></i> Not planned yet
                </div>
              `;
            }
          }
          return '';
        })()}
      `;
      tViewport.appendChild(card);
    });
  }

  // 2. Availability cards deck
  const aViewport = document.getElementById('availability-deck-viewport');
  aViewport.innerHTML = '';
  
  if (availability.length === 0) {
    aViewport.innerHTML = '<div class="empty-state">No availability added yet.</div>';
  } else {
    availability.forEach((avail, idx) => {
      const card = document.createElement('div');
      card.className = 'card-item';
      card.innerHTML = `
        <div class="card-item-top">
          <div class="card-item-title" style="color:var(--neon-emerald);"><i data-lucide="unlock" style="width:12px; display:inline-block; vertical-align:middle; margin-right:4px;"></i> Available time</div>
          <div class="card-item-actions">
            <button class="card-action-btn delete" onclick="deleteAvailabilityNode(${idx})" title="Delete availability"><i data-lucide="trash-2" style="width:14px;height:14px;"></i></button>
          </div>
        </div>
        <div class="card-badge-row">
          <span class="badge-hud p-emerald">${formatDateLabel(avail.start)}</span>
          <span class="badge-hud" style="background:transparent; border:none; color:var(--text-muted);">to</span>
          <span class="badge-hud p-emerald">${formatDateLabel(avail.end)}</span>
        </div>
      `;
      aViewport.appendChild(card);
    });
  }

  // 3. Fixed Commitment cards deck
  const fViewport = document.getElementById('fixed-deck-viewport');
  fViewport.innerHTML = '';
  
  if (fixedEvents.length === 0) {
    fViewport.innerHTML = '<div class="empty-state">No fixed events yet.</div>';
  } else {
    fixedEvents.forEach((evt, idx) => {
      const card = document.createElement('div');
      card.className = 'card-item';
      card.innerHTML = `
        <div class="card-item-top">
          <div class="card-item-title" style="color:var(--neon-orange);"><i data-lucide="lock" style="width:12px; display:inline-block; vertical-align:middle; margin-right:4px;"></i> ${escapeHtml(evt.name)}</div>
          <div class="card-item-actions">
            <button class="card-action-btn delete" onclick="deleteFixedNode(${idx})" title="Delete event"><i data-lucide="trash-2" style="width:14px;height:14px;"></i></button>
          </div>
        </div>
        <div class="card-badge-row">
          <span class="badge-hud p-coral">${formatDateLabel(evt.start)}</span>
          <span class="badge-hud" style="background:transparent; border:none; color:var(--text-muted);">to</span>
          <span class="badge-hud p-coral">${formatDateLabel(evt.end)}</span>
        </div>
      `;
      fViewport.appendChild(card);
    });
  }

  // 3.5. Ended tasks deck
  const eViewport = document.getElementById('ended-deck-viewport');
  if (eViewport) {
    eViewport.innerHTML = '';
    const badgeEnded = document.getElementById('badge-total-ended');
    if (badgeEnded) {
      badgeEnded.textContent = endedTasks.length;
    }
    
    if (endedTasks.length === 0) {
      eViewport.innerHTML = '<div class="empty-state">No archived completed tasks.</div>';
    } else {
      endedTasks.forEach((task, idx) => {
        const card = document.createElement('div');
        card.className = 'card-item';
        card.style.borderLeft = '4px solid var(--neon-rose)';
        card.style.background = 'rgba(244, 63, 94, 0.03)';
        
        let priorityStars = '';
        for (let s = 1; s <= 5; s++) {
          priorityStars += s <= task.priority ? '*' : '-';
        }

        card.innerHTML = `
          <div class="card-item-top">
            <div class="card-item-title" style="color: var(--neon-rose);">${escapeHtml(formatTaskDisplayLabel(task))}</div>
            <div class="card-item-actions">
              <button class="card-action-btn delete" onclick="deleteEndedTaskNode(${idx})" title="Delete archived task"><i data-lucide="trash-2" style="width:14px;height:14px;"></i></button>
            </div>
          </div>
          <div class="card-badge-row">
            <span class="badge-hud p-rose">${formatMinutesLabel(task.duration_minutes)}</span>
            <span class="badge-hud" style="color:#fbbf24; border-color:rgba(251,191,36,0.15);">${priorityStars}</span>
            <span class="badge-hud p-rose">Ended</span>
          </div>
          <div style="font-size:10px; color:var(--text-muted); display:flex; flex-direction:column; gap:2px; margin-top:6px;">
            <div style="display:flex; align-items:center; gap:5px;">
              <i data-lucide="calendar" style="width:11px;"></i> ${(task.start && task.end) ? `Scheduled: ${formatDateLabel(task.start)} to ${formatDateLabel(task.end)}` : `Expired: Deadline passed on ${formatDateLabel(task.deadline)}`}
            </div>
            <div style="display:flex; align-items:center; gap:5px; opacity:0.7;">
              <i data-lucide="archive" style="width:11px;"></i> Archived: ${formatDateLabel(task.archivedAt)}
            </div>
          </div>
        `;
        eViewport.appendChild(card);
      });
    }
  }



  // 3.8. Render Troubleshooter Warning Hub
  const troublePanel = document.getElementById('danger-alert-dock');
  if (troublePanel) {
    const unscheduledArray = (scheduleOutput && scheduleOutput.unscheduled_tasks) ? scheduleOutput.unscheduled_tasks : [];
    
    // Calculate availability conflicts
    const availabilityConflicts = [];
    tasks.forEach(task => {
      if (task.fixed && task.fixed_start && task.fixed_end) {
        const start = new Date(task.fixed_start);
        const end = new Date(task.fixed_end);
        const isInside = availability.some(avail => {
          const availStart = new Date(avail.start);
          const availEnd = new Date(avail.end);
          return (availStart <= start && end <= availEnd);
        });
        if (!isInside) {
          availabilityConflicts.push({
            task_id: task.id,
            task_name: task.name,
            reason: `Locked slot (${formatDateLabel(task.fixed_start)} - ${formatTimeClock(new Date(task.fixed_end))}) falls outside available working hours.`
          });
        }
      }
    });

    if (scheduleOutput && scheduleOutput.schedule) {
      scheduleOutput.schedule.forEach(seg => {
        const task = tasks.find(t => t.id === seg.task_id);
        if (task && task.fixed) return;
        const start = new Date(seg.start);
        const end = new Date(seg.end);
        const isInside = availability.some(avail => {
          const availStart = new Date(avail.start);
          const availEnd = new Date(avail.end);
          return (availStart <= start && end <= availEnd);
        });
        if (!isInside) {
          availabilityConflicts.push({
            task_id: seg.task_id,
            task_name: seg.task_name,
            reason: `Scheduled slot (${formatDateLabel(seg.start)} - ${formatTimeClock(new Date(seg.end))}) falls outside available working hours.`
          });
        }
      });
    }

    const totalAlerts = unscheduledArray.length + availabilityConflicts.length + (lastSolverError ? 1 : 0);

    if (totalAlerts > 0) {
      troublePanel.style.display = 'flex';
      troublePanel.innerHTML = `
        <div class="danger-title" style="display:flex; align-items:center; gap:8px;">
          <i data-lucide="alert-triangle" style="color:var(--danger);"></i> Needs a decision (${totalAlerts})
        </div>
        <div style="font-size:12.5px; color:var(--text-secondary); margin-bottom:12px;">
          A few tasks still need room. Add availability, extend a deadline, or move a pinned task into available time.
        </div>
        <div class="danger-items-grid">
          ${lastSolverError ? `
            <div class="danger-item-card" style="display: flex; flex-direction: column; justify-content: space-between; align-items: flex-start; gap: 8px; border-left: 4px solid var(--neon-rose); grid-column: span 2;">
              <div>
                <strong style="color: var(--neon-rose);">Scheduler error</strong>
                <span style="color:#fda4af; display: block; font-size: 11.5px; margin-top: 4px; font-family: 'JetBrains Mono', monospace;"><i data-lucide="alert-circle" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:2px;"></i> Error: ${escapeHtml(lastSolverError)}</span>
              </div>
            </div>
          ` : ''}
          ${unscheduledArray.map(item => `
            <div class="danger-item-card" style="display: flex; flex-direction: column; justify-content: space-between; align-items: flex-start; gap: 8px; border-left: 4px solid var(--neon-rose);">
              <div>
                <strong>${escapeHtml(formatTaskDisplayLabel(item.task_id, item.task_name))}</strong>
                <span style="color:#b5534b; display: block; font-size: 11.5px; margin-top: 4px;"><i data-lucide="alert-circle" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:2px;"></i> Not planned: ${escapeHtml(item.reason)}</span>
              </div>
              <button class="btn-action-outline" style="padding: 4px 8px; font-size: 11px; border-color: var(--neon-cyan); color: var(--neon-cyan); align-self: flex-end; display: flex; align-items: center; gap: 4px; border-radius: 6px; box-shadow: none;" onclick="launchFixProblemModal(${item.task_id}, \`${escapeHtml(item.reason)}\`)" title="Resolve this conflict">
                <i data-lucide="wrench" style="width: 12px; height: 12px;"></i> Help it fit
              </button>
            </div>
          `).join('')}
          ${availabilityConflicts.map(item => `
            <div class="danger-item-card" style="display: flex; flex-direction: column; justify-content: space-between; align-items: flex-start; gap: 8px; border-left: 4px solid var(--neon-orange);">
              <div>
                <strong>${escapeHtml(formatTaskDisplayLabel(item.task_id, item.task_name))}</strong>
                <span style="color:#a66b2f; display: block; font-size: 11.5px; margin-top: 4px;"><i data-lucide="clock" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:2px;"></i> Outside availability: ${escapeHtml(item.reason)}</span>
              </div>
              <button class="btn-action-outline" style="padding: 4px 8px; font-size: 11px; border-color: var(--neon-cyan); color: var(--neon-cyan); align-self: flex-end; display: flex; align-items: center; gap: 4px; border-radius: 6px; box-shadow: none;" onclick="launchFixProblemModal(${item.task_id}, \`${escapeHtml(item.reason)}\`)" title="Resolve this conflict">
                <i data-lucide="wrench" style="width: 12px; height: 12px;"></i> Help it fit
              </button>
            </div>
          `).join('')}
        </div>
      `;
    } else {
      troublePanel.style.display = 'none';
    }
  }

  renderDashboardSummary();
  lucide.createIcons();
  
  // Calculate load density indicators under week selector bar
  if (typeof updateWeekDensityDotCounters === 'function') {
    updateWeekDensityDotCounters();
  }
}

// Checklist checkboxes toggler callback (PHASE 9)
async function toggleSubtaskCheckNode(taskIdx, subtaskIdx, event) {
  event.stopPropagation(); // Avoid triggering details modal
  tasks[taskIdx].subtasks[subtaskIdx].completed = !tasks[taskIdx].subtasks[subtaskIdx].completed;
  
  syncStateToVisualDocks();
    showSpringToast('Subtask updated.');
  
  // Automatically trigger schedule solver
  if (isAutoSolve) {
    await triggerSchedulerOptimization(true);
  } else {
    markScheduleOutOfSync();
  }
}

// ==========================================================================
// STRING COMPILATION METADATA HELPERS
// ==========================================================================
function formatMinutesLabel(minutes) {
  if (minutes < 60) return `${minutes}m`;
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}

function formatDateLabel(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  return `${days[d.getDay()]} ${months[d.getMonth()]} ${d.getDate()}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatTimeClock(dateObj) {
  return String(dateObj.getHours()).padStart(2, '0') + ':' + String(dateObj.getMinutes()).padStart(2, '0');
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// Visual Tab Panel Switcher Callback
function switchDockTab(paneId) {
  // Close fullscreen book mode if switching away from developer tab
  const devPane = document.getElementById('pane-json');
  if (paneId !== 'pane-json' && devPane && devPane.classList.contains('fullscreen-book')) {
    toggleDeveloperConsoleFullscreen();
  }

  document.querySelectorAll('.dock-tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.dock-pane').forEach(pane => pane.classList.remove('active'));
  
  // Find button containing onclick action
  const activeBtn = Array.from(document.querySelectorAll('.dock-tab-btn'))
                         .find(btn => (btn.getAttribute('onclick') || '').includes(paneId));
  if (activeBtn) activeBtn.classList.add('active');
  
  const pane = document.getElementById(paneId);
  if (pane) pane.classList.add('active');
}

function toggleDeveloperConsoleFullscreen() {
  const pane = document.getElementById('pane-json');
  const wrapper = document.querySelector('.dock-panes-wrapper');
  
  if (pane.classList.contains('fullscreen-book')) {
    pane.classList.remove('fullscreen-book');
    wrapper.appendChild(pane);
  } else {
    pane.classList.add('fullscreen-book');
    document.body.appendChild(pane);
  }
}

// Scan scheduled tasks, archive ended ones, and return true if any changes occurred
function scanAndArchiveEndedTasks() {
  const now = new Date();
  let archivedIds = new Set();
  
  // Find task IDs whose scheduled allocations are completely in the past
  const taskSegs = {};
  if (scheduleOutput && scheduleOutput.schedule) {
    scheduleOutput.schedule.forEach(seg => {
      if (!taskSegs[seg.task_id]) {
        taskSegs[seg.task_id] = [];
      }
      taskSegs[seg.task_id].push(seg);
    });
    
    Object.keys(taskSegs).forEach(taskIdStr => {
      const taskId = parseInt(taskIdStr);
      const segs = taskSegs[taskIdStr];
      // Find the max end time of all segments
      const maxEnd = new Date(Math.max(...segs.map(s => new Date(s.end))));
      if (maxEnd < now) {
        archivedIds.add(taskId);
      }
    });
  }
  
  // Also archive tasks whose deadline is in the past (even if unscheduled or expired)
  tasks.forEach(task => {
    if (task.deadline) {
      const dlDate = new Date(task.deadline);
      if (dlDate < now) {
        archivedIds.add(task.id);
      }
    }
  });
  
  if (archivedIds.size === 0) return false;
  
  let updatedTasks = [];
  tasks.forEach(task => {
    if (archivedIds.has(task.id)) {
      // Find its scheduled segments to store their times in the archive
      const segs = taskSegs[task.id] || [];
      let startStr = null;
      let endStr = null;
      
      if (segs.length > 0) {
        const startTimes = segs.map(s => new Date(s.start));
        const endTimes = segs.map(s => new Date(s.end));
        startStr = new Date(Math.min(...startTimes)).toISOString();
        endStr = new Date(Math.max(...endTimes)).toISOString();
      }
      
      const archivedTask = {
        ...task,
        start: startStr,
        end: endStr,
        archivedAt: new Date().toISOString()
      };
      
      if (!endedTasks.some(t => t.id === task.id)) {
        endedTasks.push(archivedTask);
      }
    } else {
      updatedTasks.push(task);
    }
  });
  
  tasks = updatedTasks;
  localStorage.setItem('chrono_ended_tasks_archive', JSON.stringify(endedTasks));
  return true;
}

function clearEndedTasksArchive() {
  if (confirm("Are you sure you want to clear the entire completed tasks archive?")) {
    endedTasks = [];
    localStorage.setItem('chrono_ended_tasks_archive', JSON.stringify(endedTasks));
    syncStateToVisualDocks();
    if (typeof renderTimelineView === 'function') {
      renderTimelineView();
    }
    showSpringToast("Completed tasks archive cleared.");
  }
}

function deleteEndedTaskNode(idx) {
  endedTasks.splice(idx, 1);
  localStorage.setItem('chrono_ended_tasks_archive', JSON.stringify(endedTasks));
  syncStateToVisualDocks();
  if (typeof renderTimelineView === 'function') {
    renderTimelineView();
  }
  showSpringToast("Archived task deleted.");
}

