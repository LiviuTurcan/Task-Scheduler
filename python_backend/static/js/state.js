/* ==========================================================================
   GLOBAL APP STATE, API CALLS, AND BI-DIRECTIONAL TEXTPAYLOAD SYNC
   ========================================================================== */

// Global State Arrays
let tasks = [];
let availability = [];
let fixedEvents = [];
let scheduleOutput = null;
let endedTasks = JSON.parse(localStorage.getItem('chrono_ended_tasks_archive')) || [];

// Presentation & Auto-Solve States
let isAutoSolve = true;
let isScheduleOutOfSync = false;

function toggleAutoSolveState(checked) {
  isAutoSolve = checked;
  showSpringToast(`Live Auto-Solve is now ${isAutoSolve ? 'ENABLED' : 'DISABLED'}`);
  if (isAutoSolve) {
    clearScheduleOutOfSync();
    triggerSchedulerOptimization(true); // run silently to sync
  }
}

function markScheduleOutOfSync() {
  isScheduleOutOfSync = true;
  
  // 1. Highlight the Run Optimizer button with pulsing warning styling
  const btn = document.getElementById('btn-run-scheduler');
  if (btn) {
    btn.classList.add('hud-pulse-warning');
    const span = btn.querySelector('span');
    if (span) span.textContent = 'Solve Pending';
  }
  
  // 2. Show the warning banner above the calendar
  const banner = document.getElementById('calendar-sync-warning-banner');
  if (banner) {
    banner.style.display = 'flex';
  }
  
  // 3. Log a warning to the Developer Changes Log terminal
  const diffContainer = document.getElementById('dev-optimization-diff-log');
  if (diffContainer) {
    if (!diffContainer.innerHTML.includes('[WARNING]')) {
      const line = document.createElement('div');
      line.style.color = '#fbbf24';
      line.style.fontWeight = 'bold';
      line.innerHTML = `[WARNING] Schedule is out of sync. Changes are pending. Click 'Solve Pending' above to run the C++ optimizer.`;
      diffContainer.insertBefore(line, diffContainer.firstChild);
    }
  }
}

function clearScheduleOutOfSync() {
  isScheduleOutOfSync = false;
  
  // 1. Reset Run Optimizer button
  const btn = document.getElementById('btn-run-scheduler');
  if (btn) {
    btn.classList.remove('hud-pulse-warning');
    const span = btn.querySelector('span');
    if (span) span.textContent = 'Run Optimizer';
  }
  
  // 2. Hide the warning banner above the calendar
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

let activeTimelineSegment = 'grid'; // 'grid' or 'agenda'

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

  // 3. Automatically run scheduler optimization on landing page load (silently)
  await triggerSchedulerOptimization(true);
});

// Backup DB variables for the Unsync/Revert feature
let backupTasks = [];
let backupAvailability = [];
let backupFixedEvents = [];

// Save copies of data variables to allow undoing edits
function saveBackupCurrentDatabaseState() {
  backupTasks = JSON.parse(JSON.stringify(tasks));
  backupAvailability = JSON.parse(JSON.stringify(availability));
  backupFixedEvents = JSON.parse(JSON.stringify(fixedEvents));
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
      tasks = data.tasks || [];
      availability = data.availability || [];
      fixedEvents = data.fixed_events || [];
      
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
        const payload = {
          tasks: tasks,
          availability: availability,
          fixed_events: fixedEvents
        };
        fetch('/run', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(payload)
        });
      }
      
      showSpringToast('Connected to database. Synced configurations.');
    } else {
      showSpringToast('Failed to load server inputs. Standalone mode initialized.', 'error');
    }
  } catch (err) {
    console.error("fetchServerInputs error", err);
    showSpringToast('Offline. Spawning standard sandbox database.', 'error');
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
  btn.querySelector('span').textContent = 'Solving Equations...';
  icon.setAttribute('data-lucide', 'loader-2');
  icon.classList.add('loading-spinner-spin');
  lucide.createIcons();

  // Save a backup of input fields right before running the solver, if not reverting
  if (!isRevertingDatabaseState) {
    saveBackupCurrentDatabaseState();
  }

  // Retain a copy of the prior schedule to compare start-end time differences
  const priorSchedule = scheduleOutput ? JSON.parse(JSON.stringify(scheduleOutput.schedule || [])) : [];

  // Fake C++ console logging startup (PHASE 10)
  if (typeof startFakeCppCompilerStream === 'function') {
    startFakeCppCompilerStream();
  }

  const payload = {
    tasks: tasks,
    availability: availability,
    fixed_events: fixedEvents
  };

  try {
    const res = await fetch('/run', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    
    if (data.success) {
      scheduleOutput = data.schedule;
      
      clearScheduleOutOfSync();
      
      // Scan for ended tasks and archive them
      const didArchive = scanAndArchiveEndedTasks();
      if (didArchive) {
        setTimeout(() => {
          triggerSchedulerOptimization(true);
        }, 100);
        return;
      }
      
      // Only show success toast if user manually clicked optimize or sync (not silent)
      if (!silent) {
        showSpringToast('Optimization completed successfully!');
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
            logLine.innerHTML = `<span style="color: var(--neon-emerald); font-weight:700;">+ [NEW]</span> "${escapeHtml(newSeg.task_name)}" scheduled to <span style="font-weight:700;">${formatTimeClock(new Date(newSeg.start))}-${formatTimeClock(new Date(newSeg.end))}</span>`;
            diffContainer.appendChild(logLine);
            changeCount++;
          } else if (oldSeg.start !== newSeg.start || oldSeg.end !== newSeg.end) {
            // Task rescheduled to different hours
            const logLine = document.createElement('div');
            logLine.style.color = '#fbbf24'; // Warning color
            logLine.innerHTML = `<span style="color: #fbbf24; font-weight:700;">~ [MOVED]</span> "${escapeHtml(newSeg.task_name)}" shifted: <span style="text-decoration: line-through; opacity: 0.6;">${formatTimeClock(new Date(oldSeg.start))}</span> ➔ <span style="font-weight:700; color: #fff;">${formatTimeClock(new Date(newSeg.start))}-${formatTimeClock(new Date(newSeg.end))}</span>`;
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
            logLine.innerHTML = `<span style="color: var(--neon-rose); font-weight:700;">- [REMOVED]</span> "${escapeHtml(oldSeg.task_name)}" was unscheduled`;
            diffContainer.appendChild(logLine);
            changeCount++;
          }
        });
        
        if (changeCount === 0) {
          diffContainer.innerHTML = '<span style="color: var(--text-muted);">No time changes. Schedule remains optimal.</span>';
        }
      }
      
      // Update charts & timeline chrono grids
      renderMainMetricsDashboard();
    } else {
      showSpringToast('Engine failure: ' + data.error, 'error');
    }
  } catch (err) {
    console.error(err);
    showSpringToast('Network connection lost. C++ backend unreachable.', 'error');
  } finally {
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.querySelector('span').textContent = 'Run Optimizer';
    icon.setAttribute('data-lucide', 'zap');
    icon.classList.remove('loading-spinner-spin');
    lucide.createIcons();

  }
}

// Bi-directional payload sync: Developer Console -> GUI
async function commitJsonEditsToGUI() {
  try {
    const tVal = document.getElementById('dev-textarea-tasks').value.trim();
    const aVal = document.getElementById('dev-textarea-availability').value.trim();
    const fVal = document.getElementById('dev-textarea-fixed').value.trim();

    tasks = tVal ? JSON.parse(tVal) : [];
    availability = aVal ? JSON.parse(aVal) : [];
    fixedEvents = fVal ? JSON.parse(fVal) : [];

    syncStateToVisualDocks();
    showSpringToast('Developer console changes loaded into memory.');
    await triggerSchedulerOptimization();
  } catch (err) {
    showSpringToast('Syntax Error! Invalid JSON payload. ' + err.message, 'error');
  }
}

// Beautify and pretty-print JSON arrays in the Developer console
function beautifyAllDeveloperJson() {
  try {
    const tArea = document.getElementById('dev-textarea-tasks');
    const aArea = document.getElementById('dev-textarea-availability');
    const fArea = document.getElementById('dev-textarea-fixed');

    if (tArea && tArea.value.trim()) tArea.value = JSON.stringify(JSON.parse(tArea.value), null, 2);
    if (aArea && aArea.value.trim()) aArea.value = JSON.stringify(JSON.parse(aArea.value), null, 2);
    if (fArea && fArea.value.trim()) fArea.value = JSON.stringify(JSON.parse(fArea.value), null, 2);

    showSpringToast('Beautified Developer JSON payloads.');
  } catch (err) {
    showSpringToast('Formatting Failed: Invalid JSON syntax. ' + err.message, 'error');
  }
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
    tViewport.innerHTML = '<div class="empty-state">No tasks created yet. Click +</div>';
  } else {
    tasks.forEach((task, idx) => {
      const card = document.createElement('div');
      card.className = 'card-item';
      
      const depsNames = task.dependencies.map(id => {
        const tObj = tasks.find(t => t.id === id);
        return tObj ? tObj.name : '#' + id;
      }).join(', ');

      let priorityStars = '';
      for (let s = 1; s <= 5; s++) {
        priorityStars += s <= task.priority ? '★' : '☆';
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
          <div class="card-item-title">${escapeHtml(task.name)}</div>
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
          ${task.can_split ? '<span class="badge-hud p-cyan">Splittable</span>' : '<span class="badge-hud" style="color:var(--text-muted);">Unsplittable</span>'}
          ${task.dependencies.length > 0 ? `<span class="badge-hud" title="Dependencies: ${escapeHtml(depsNames)}" style="max-width:120px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"><i data-lucide="git-merge" style="width:10px;"></i> ${task.dependencies.length} reqs</span>` : ''}
        </div>
        
        ${checklistHtml}

        <div style="font-size:10px; color:var(--text-muted); display:flex; align-items:center; gap:5px; margin-top:4px;">
          <i data-lucide="calendar" style="width:11px;"></i> Due: ${formatDateLabel(task.deadline)}
        </div>
      `;
      tViewport.appendChild(card);
    });
  }

  // 2. Availability cards deck
  const aViewport = document.getElementById('availability-deck-viewport');
  aViewport.innerHTML = '';
  
  if (availability.length === 0) {
    aViewport.innerHTML = '<div class="empty-state">No active available windows. Click +</div>';
  } else {
    availability.forEach((avail, idx) => {
      const card = document.createElement('div');
      card.className = 'card-item';
      card.innerHTML = `
        <div class="card-item-top">
          <div class="card-item-title" style="color:var(--neon-emerald);"><i data-lucide="unlock" style="width:12px; display:inline-block; vertical-align:middle; margin-right:4px;"></i> Available Frame</div>
          <div class="card-item-actions">
            <button class="card-action-btn delete" onclick="deleteAvailabilityNode(${idx})" title="Purge slot"><i data-lucide="trash-2" style="width:14px;height:14px;"></i></button>
          </div>
        </div>
        <div class="card-badge-row">
          <span class="badge-hud p-emerald">${formatDateLabel(avail.start)}</span>
          <span class="badge-hud" style="background:transparent; border:none; color:var(--text-muted);">➔</span>
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
    fViewport.innerHTML = '<div class="empty-state">No locked commitments. Click +</div>';
  } else {
    fixedEvents.forEach((evt, idx) => {
      const card = document.createElement('div');
      card.className = 'card-item';
      card.innerHTML = `
        <div class="card-item-top">
          <div class="card-item-title" style="color:var(--neon-orange);"><i data-lucide="lock" style="width:12px; display:inline-block; vertical-align:middle; margin-right:4px;"></i> ${escapeHtml(evt.name)}</div>
          <div class="card-item-actions">
            <button class="card-action-btn delete" onclick="deleteFixedNode(${idx})" title="Purge event"><i data-lucide="trash-2" style="width:14px;height:14px;"></i></button>
          </div>
        </div>
        <div class="card-badge-row">
          <span class="badge-hud p-coral">${formatDateLabel(evt.start)}</span>
          <span class="badge-hud" style="background:transparent; border:none; color:var(--text-muted);">➔</span>
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
          priorityStars += s <= task.priority ? '★' : '☆';
        }

        card.innerHTML = `
          <div class="card-item-top">
            <div class="card-item-title" style="color: var(--neon-rose);">${escapeHtml(task.name)}</div>
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
              <i data-lucide="calendar" style="width:11px;"></i> ${(task.start && task.end) ? `Scheduled: ${formatDateLabel(task.start)} ➔ ${formatDateLabel(task.end)}` : `Expired: Deadline passed on ${formatDateLabel(task.deadline)}`}
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

  // 4. DEV JSON console textareas values update
  document.getElementById('dev-textarea-tasks').value = JSON.stringify(tasks, null, 2);
  document.getElementById('dev-textarea-availability').value = JSON.stringify(availability, null, 2);
  document.getElementById('dev-textarea-fixed').value = JSON.stringify(fixedEvents, null, 2);
  
  const outArea = document.getElementById('dev-textarea-output');
  if (outArea) {
    outArea.value = scheduleOutput ? JSON.stringify(scheduleOutput, null, 2) : '';
  }

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
  showSpringToast('Sub-task checkbox checklist marked.');
  
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
  document.querySelectorAll('.dock-tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.dock-pane').forEach(pane => pane.classList.remove('active'));
  
  // Find button containing onclick action
  const activeBtn = Array.from(document.querySelectorAll('.dock-tab-btn'))
                         .find(btn => btn.getAttribute('onclick').includes(paneId));
  if (activeBtn) activeBtn.classList.add('active');
  
  const pane = document.getElementById(paneId);
  if (pane) pane.classList.add('active');
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
