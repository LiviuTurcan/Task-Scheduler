/* ==========================================================================
   CRUD MODALS CONTROLLER, DYNAMIC SUBTASKS CHECKLIST, AND REQS TREE
   ========================================================================== */

function displayModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('active');
}

function dismissModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('active');
}

function toggleFormTaskFixed(checked) {
  const inputs = document.getElementById('form-task-fixed-time-inputs');
  if (inputs) {
    inputs.style.display = checked ? 'grid' : 'none';
  }
}

// 1. Tasks Popups CRUD
function launchAddTaskModal() {
  document.getElementById('form-task-index').value = '';
  document.getElementById('hud-task-modal-header').innerHTML = `<i data-lucide="plus-circle" style="color:var(--neon-purple-glow)"></i> Create Custom Task`;

  document.getElementById('form-task-name').value = '';
  document.getElementById('form-task-duration').value = '120';
  document.getElementById('form-task-deadline').value = '2026-06-01T18:00';
  document.getElementById('form-task-priority').value = '3';
  document.getElementById('form-task-difficulty').value = '3';
  document.getElementById('form-task-split').checked = true;

  const fixedToggle = document.getElementById('form-task-fixed-toggle');
  if (fixedToggle) {
    fixedToggle.checked = false;
    toggleFormTaskFixed(false);
  }
  document.getElementById('form-task-fixed-start').value = '';
  document.getElementById('form-task-fixed-end').value = '';

  // Clear subtasks checklists UI viewport
  document.getElementById('form-task-subtasks-viewport').innerHTML = '';

  populateDependencyChoices([]);
  displayModal('modal-task-popup');
  lucide.createIcons();
}

function launchEditTaskModal(index) {
  const task = tasks[index];
  document.getElementById('form-task-index').value = index;
  document.getElementById('hud-task-modal-header').innerHTML = `<i data-lucide="edit" style="color:var(--neon-purple-glow)"></i> Edit Task Details`;

  document.getElementById('form-task-name').value = task.name;
  document.getElementById('form-task-duration').value = task.duration_minutes;

  let dl = task.deadline;
  if (dl.length > 16) dl = dl.substring(0, 16);
  document.getElementById('form-task-deadline').value = dl;

  document.getElementById('form-task-priority').value = task.priority;
  document.getElementById('form-task-difficulty').value = task.difficulty;
  document.getElementById('form-task-split').checked = task.can_split;

  const fixedToggle = document.getElementById('form-task-fixed-toggle');
  if (fixedToggle) {
    fixedToggle.checked = !!task.fixed;
    toggleFormTaskFixed(!!task.fixed);
  }
  if (task.fixed && task.fixed_start && task.fixed_end) {
    let fStart = task.fixed_start;
    if (fStart.length > 16) fStart = fStart.substring(0, 16);
    let fEnd = task.fixed_end;
    if (fEnd.length > 16) fEnd = fEnd.substring(0, 16);
    document.getElementById('form-task-fixed-start').value = fStart;
    document.getElementById('form-task-fixed-end').value = fEnd;
  } else {
    document.getElementById('form-task-fixed-start').value = '';
    document.getElementById('form-task-fixed-end').value = '';
  }

  // Populate subtasks checklists UI viewport (PHASE 9)
  const subtasksContainer = document.getElementById('form-task-subtasks-viewport');
  subtasksContainer.innerHTML = '';
  
  if (task.subtasks && task.subtasks.length > 0) {
    task.subtasks.forEach(sub => {
      appendSubtaskFormRow(sub.name, sub.completed);
    });
  }

  populateDependencyChoices(task.dependencies, task.id);
  displayModal('modal-task-popup');
  lucide.createIcons();
}

// Append new checklist subtask text field row (PHASE 9)
function appendSubtaskFormRow(nameVal = '', isCompleted = false) {
  const container = document.getElementById('form-task-subtasks-viewport');
  const row = document.createElement('div');
  row.style.display = 'flex';
  row.style.gap = '8px';
  row.style.alignItems = 'center';
  row.className = 'subtask-input-row';
  
  row.innerHTML = `
    <input type="checkbox" name="subtask-form-checkbox" ${isCompleted ? 'checked' : ''} style="accent-color:var(--neon-purple); cursor:pointer;" />
    <input type="text" name="subtask-form-text" class="hud-input" placeholder="e.g. Gather resources" value="${escapeHtml(nameVal)}" style="flex:1; padding:8px 12px; font-size:12.5px;" required />
    <button type="button" class="card-action-btn delete" onclick="this.parentElement.remove()" style="color:var(--text-muted);"><i data-lucide="minus-circle" style="width:16px;"></i></button>
  `;
  container.appendChild(row);
  lucide.createIcons();
}

function populateDependencyChoices(selectedIds, currentTaskId = null) {
  const viewport = document.getElementById('form-task-deps-viewport');
  viewport.innerHTML = '';

  const choices = tasks.filter(t => t.id !== currentTaskId);

  if (choices.length === 0) {
    viewport.innerHTML = '<div style="font-size:11px; color:var(--text-muted); font-style:italic;">No other tasks created yet.</div>';
  } else {
    choices.forEach(t => {
      const isChecked = selectedIds.includes(t.id) ? 'checked' : '';
      const label = document.createElement('label');
      label.className = 'hud-multi-item';
      label.innerHTML = `
        <input type="checkbox" name="task-dependency-item-box" value="${t.id}" ${isChecked} />
        <span>${escapeHtml(t.name)} (ID: ${t.id})</span>
      `;
      viewport.appendChild(label);
    });
  }
}

async function commitTaskForm(e) {
  e.preventDefault();

  const indexVal = document.getElementById('form-task-index').value;
  const name = document.getElementById('form-task-name').value.trim();
  const duration = parseInt(document.getElementById('form-task-duration').value);
  let deadline = document.getElementById('form-task-deadline').value;

  if (deadline.length === 16) deadline += ":00";

  const deadlineDate = new Date(deadline);
  if (deadlineDate < new Date()) {
    showSpringToast("Cannot schedule tasks with deadlines in the past!", "error");
    return;
  }

  const priority = parseInt(document.getElementById('form-task-priority').value);
  const difficulty = parseInt(document.getElementById('form-task-difficulty').value);
  const canSplit = document.getElementById('form-task-split').checked;

  const isFixed = document.getElementById('form-task-fixed-toggle') ? document.getElementById('form-task-fixed-toggle').checked : false;
  let fixedStart = null;
  let fixedEnd = null;
  if (isFixed) {
    fixedStart = document.getElementById('form-task-fixed-start').value;
    fixedEnd = document.getElementById('form-task-fixed-end').value;
    if (!fixedStart || !fixedEnd) {
      showSpringToast("Please provide both start and end datetimes for manual scheduling!", "error");
      return;
    }
    if (fixedStart.length === 16) fixedStart += ":00";
    if (fixedEnd.length === 16) fixedEnd += ":00";
    if (new Date(fixedStart) >= new Date(fixedEnd)) {
      showSpringToast("Locked End Datetime must be after Locked Start Datetime!", "error");
      return;
    }
  }

  const checkedDeps = Array.from(document.querySelectorAll('input[name="task-dependency-item-box"]:checked'))
                           .map(input => parseInt(input.value));

  // Gather subtasks inputs (PHASE 9)
  const subtaskRows = document.querySelectorAll('.subtask-input-row');
  const subtasksList = [];
  subtaskRows.forEach(row => {
    const txtInput = row.querySelector('input[name="subtask-form-text"]').value.trim();
    const chkInput = row.querySelector('input[name="subtask-form-checkbox"]').checked;
    if (txtInput) {
      subtasksList.push({ name: txtInput, completed: chkInput });
    }
  });

  if (indexVal === '') {
    const maxId = tasks.reduce((max, t) => t.id > max ? t.id : max, 0);
    const newTask = {
      id: maxId + 1,
      name: name,
      duration_minutes: duration,
      deadline: deadline,
      priority: priority,
      difficulty: difficulty,
      dependencies: checkedDeps,
      can_split: canSplit,
      fixed: isFixed,
      fixed_start: fixedStart,
      fixed_end: fixedEnd,
      subtasks: subtasksList // Save subtasks array (PHASE 9)
    };
    tasks.push(newTask);
    showSpringToast('Created new task successfully!');
  } else {
    const idx = parseInt(indexVal);
    tasks[idx].name = name;
    tasks[idx].duration_minutes = duration;
    tasks[idx].deadline = deadline;
    tasks[idx].priority = priority;
    tasks[idx].difficulty = difficulty;
    tasks[idx].dependencies = checkedDeps;
    tasks[idx].can_split = canSplit;
    tasks[idx].fixed = isFixed;
    tasks[idx].fixed_start = fixedStart;
    tasks[idx].fixed_end = fixedEnd;
    tasks[idx].subtasks = subtasksList; // Save subtasks array (PHASE 9)
    showSpringToast('Updated task adjustments.');
  }

  dismissModal('modal-task-popup');
  syncStateToVisualDocks();
  if (isAutoSolve) {
    await triggerSchedulerOptimization(true);
  } else {
    markScheduleOutOfSync();
  }
}

async function deleteTaskNode(index) {
  const deletedId = tasks[index].id;
  tasks.splice(index, 1);

  tasks.forEach(t => {
    t.dependencies = t.dependencies.filter(id => id !== deletedId);
  });

  showSpringToast('Deleted task successfully.');
  syncStateToVisualDocks();
  if (isAutoSolve) {
    await triggerSchedulerOptimization(true);
  } else {
    markScheduleOutOfSync();
  }
}

// 2. Availability Popups CRUD
function launchAddAvailabilityModal() {
  document.getElementById('form-availability-index').value = '';
  document.getElementById('form-availability-start').value = '2026-06-01T09:00';
  document.getElementById('form-availability-end').value = '2026-06-01T12:00';
  displayModal('modal-availability-popup');
}

async function commitAvailabilityForm(e) {
  e.preventDefault();
  let start = document.getElementById('form-availability-start').value;
  let end = document.getElementById('form-availability-end').value;

  if (start.length === 16) start += ":00";
  if (end.length === 16) end += ":00";

  const newSlot = { start, end };
  availability.push(newSlot);
  availability.sort((a,b) => new Date(a.start) - new Date(b.start));

  dismissModal('modal-availability-popup');
  showSpringToast('Created available segment slot!');
  syncStateToVisualDocks();
  if (isAutoSolve) {
    await triggerSchedulerOptimization(true);
  } else {
    markScheduleOutOfSync();
  }
}

async function deleteAvailabilityNode(index) {
  availability.splice(index, 1);
  showSpringToast('Removed available segment.');
  syncStateToVisualDocks();
  if (isAutoSolve) {
    await triggerSchedulerOptimization(true);
  } else {
    markScheduleOutOfSync();
  }
}

// 3. Fixed Commitment Popups CRUD
function launchAddFixedModal() {
  document.getElementById('form-fixed-index').value = '';
  document.getElementById('form-fixed-name').value = '';
  document.getElementById('form-fixed-start').value = '2026-06-01T10:00';
  document.getElementById('form-fixed-end').value = '2026-06-01T11:30';
  displayModal('modal-fixed-popup');
}

async function commitFixedForm(e) {
  e.preventDefault();
  const name = document.getElementById('form-fixed-name').value.trim();
  let start = document.getElementById('form-fixed-start').value;
  let end = document.getElementById('form-fixed-end').value;

  if (start.length === 16) start += ":00";
  if (end.length === 16) end += ":00";

  const newEvent = {
    id: fixedEvents.length + 100,
    name,
    start,
    end
  };
  fixedEvents.push(newEvent);

  dismissModal('modal-fixed-popup');
  showSpringToast('Created locked event block!');
  syncStateToVisualDocks();
  if (isAutoSolve) {
    await triggerSchedulerOptimization(true);
  } else {
    markScheduleOutOfSync();
  }
}

async function deleteFixedNode(index) {
  fixedEvents.splice(index, 1);
  showSpringToast('Removed locked commitment.');
  syncStateToVisualDocks();
  if (isAutoSolve) {
    await triggerSchedulerOptimization(true);
  } else {
    markScheduleOutOfSync();
  }
}

/* ==========================================================================
   4. IMPORT JSON WIZARD HANDLERS
   ========================================================================== */
function launchImportModal(preselectedType) {
  const txtArea = document.getElementById('import-textarea-json');
  if (txtArea) txtArea.value = '';
  const fileInput = document.getElementById('import-file-selector');
  if (fileInput) fileInput.value = '';
  
  const typeSelect = document.getElementById('form-import-type');
  if (typeSelect) typeSelect.value = preselectedType || 'auto';
  const mergeSelect = document.getElementById('form-import-merge');
  if (mergeSelect) mergeSelect.value = 'replace';
  
  displayModal('modal-import-popup');
  lucide.createIcons();
}

/* ==========================================================================
   4B. SETTINGS WIDGET HANDLERS
   ========================================================================== */
function launchSettingsModal() {
  const toggle = document.getElementById('settings-auto-solve-toggle');
  if (toggle) {
    toggle.checked = isAutoSolve;
  }
  
  const tourToggle = document.getElementById('settings-tour-autolaunch-toggle');
  if (tourToggle) {
    tourToggle.checked = localStorage.getItem('chrono_demo_tour_autolaunch') !== 'false';
  }
  
  // Sync Performance controls
  const presetSelect = document.getElementById('settings-perf-preset');
  if (presetSelect) {
    let savedPreset = 'max-beauty';
    if (localStorage.getItem('chrono_max_opt') === 'true') {
      savedPreset = 'max-opt';
    } else if (localStorage.getItem('chrono_3d_quality') === 'medium') {
      savedPreset = 'balanced';
    }
    presetSelect.value = savedPreset;
  }

  const maxOptToggle = document.getElementById('settings-max-opt-toggle');
  if (maxOptToggle) {
    maxOptToggle.checked = localStorage.getItem('chrono_max_opt') === 'true';
  }

  const buttonGlowToggle = document.getElementById('settings-button-glow-toggle');
  if (buttonGlowToggle) {
    buttonGlowToggle.checked = localStorage.getItem('chrono_button_glow') !== 'false';
  }

  const select3d = document.getElementById('settings-3d-quality');
  if (select3d) {
    select3d.value = localStorage.getItem('chrono_3d_quality') || 'high';
  }
  
  // Sync the theme preset swatch active highlights
  const activeThemeClass = Array.from(document.body.classList).find(c => c.startsWith('theme-')) || 'theme-violet';
  document.querySelectorAll('#modal-settings-popup .theme-swatch').forEach(swatch => {
    swatch.classList.toggle('active', swatch.classList.contains(`swatch-${activeThemeClass.replace('theme-', '')}`));
  });
  
  displayModal('modal-settings-popup');
  lucide.createIcons();
}

function toggleMaxOptimization(enabled) {
  localStorage.setItem('chrono_max_opt', enabled ? 'true' : 'false');
  
  const body = document.body;
  if (enabled) {
    body.classList.add('max-optimized');
    // Set 3D quality to disabled
    const select3d = document.getElementById('settings-3d-quality');
    if (select3d) {
      select3d.value = 'disabled';
      localStorage.setItem('chrono_3d_quality', 'disabled');
      if (typeof rebuild3DScene === 'function') {
        rebuild3DScene('disabled');
      }
    }
    // Set button glow to disabled
    const buttonGlowToggle = document.getElementById('settings-button-glow-toggle');
    if (buttonGlowToggle) {
      buttonGlowToggle.checked = false;
      localStorage.setItem('chrono_button_glow', 'false');
      body.classList.add('no-glows');
    }
    // Update preset selector
    const presetSelect = document.getElementById('settings-perf-preset');
    if (presetSelect) {
      presetSelect.value = 'max-opt';
    }
    if (typeof showSpringToast === 'function') {
      showSpringToast('Maximum Optimization Mode Active');
    }
  } else {
    body.classList.remove('max-optimized');
    // Revert to balanced
    const presetSelect = document.getElementById('settings-perf-preset');
    if (presetSelect) {
      presetSelect.value = 'balanced';
      applyPresetSettings('balanced');
    }
  }
}

function toggleButtonGlows(enabled) {
  localStorage.setItem('chrono_button_glow', enabled ? 'true' : 'false');
  const body = document.body;
  if (enabled) {
    body.classList.remove('no-glows');
  } else {
    body.classList.add('no-glows');
  }
  
  // Uncheck max opt if button glows are re-enabled
  if (enabled && localStorage.getItem('chrono_max_opt') === 'true') {
    const maxOptToggle = document.getElementById('settings-max-opt-toggle');
    if (maxOptToggle) maxOptToggle.checked = false;
    localStorage.setItem('chrono_max_opt', 'false');
    body.classList.remove('max-optimized');
    const presetSelect = document.getElementById('settings-perf-preset');
    if (presetSelect) presetSelect.value = 'balanced';
  }
}

function applyPresetSettings(preset) {
  const select3d = document.getElementById('settings-3d-quality');
  const buttonGlowToggle = document.getElementById('settings-button-glow-toggle');
  const maxOptToggle = document.getElementById('settings-max-opt-toggle');
  const body = document.body;
  
  if (preset === 'max-beauty') {
    if (select3d) select3d.value = 'high';
    if (buttonGlowToggle) buttonGlowToggle.checked = true;
    if (maxOptToggle) maxOptToggle.checked = false;
    
    localStorage.setItem('chrono_3d_quality', 'high');
    localStorage.setItem('chrono_button_glow', 'true');
    localStorage.setItem('chrono_max_opt', 'false');
    
    body.classList.remove('max-optimized', 'no-glows');
    if (typeof rebuild3DScene === 'function') {
      rebuild3DScene('high');
    }
    if (typeof showSpringToast === 'function') {
      showSpringToast('Preset: Max Quality & Beauty');
    }
  } 
  else if (preset === 'balanced') {
    if (select3d) select3d.value = 'medium';
    if (buttonGlowToggle) buttonGlowToggle.checked = true;
    if (maxOptToggle) maxOptToggle.checked = false;
    
    localStorage.setItem('chrono_3d_quality', 'medium');
    localStorage.setItem('chrono_button_glow', 'true');
    localStorage.setItem('chrono_max_opt', 'false');
    
    body.classList.remove('max-optimized', 'no-glows');
    if (typeof rebuild3DScene === 'function') {
      rebuild3DScene('medium');
    }
    if (typeof showSpringToast === 'function') {
      showSpringToast('Preset: Balanced Performance');
    }
  } 
  else if (preset === 'max-opt') {
    if (select3d) select3d.value = 'disabled';
    if (buttonGlowToggle) buttonGlowToggle.checked = false;
    if (maxOptToggle) maxOptToggle.checked = true;
    
    localStorage.setItem('chrono_3d_quality', 'disabled');
    localStorage.setItem('chrono_button_glow', 'false');
    localStorage.setItem('chrono_max_opt', 'true');
    
    body.classList.add('max-optimized', 'no-glows');
    if (typeof rebuild3DScene === 'function') {
      rebuild3DScene('disabled');
    }
    if (typeof showSpringToast === 'function') {
      showSpringToast('Preset: Max Optimization Mode');
    }
  }
}

function syncSettingsAutoSolve(checked) {
  toggleAutoSolveState(checked);
}

function toggleTourAutolaunch(checked) {
  localStorage.setItem('chrono_demo_tour_autolaunch', checked ? 'true' : 'false');
  if (typeof showSpringToast === 'function') {
    showSpringToast(checked ? 'Guide Auto-Launch Enabled' : 'Guide Auto-Launch Disabled');
  }
}

function triggerGlobalImportFromSettings() {
  dismissModal('modal-settings-popup');
  launchImportModal('package');
}

function triggerGlobalExportFromSettings() {
  dismissModal('modal-settings-popup');
  downloadRawDatabasePackage();
}

function beautifyImportJson() {
  try {
    const txtArea = document.getElementById('import-textarea-json');
    if (txtArea && txtArea.value.trim()) {
      txtArea.value = JSON.stringify(JSON.parse(txtArea.value), null, 2);
      showSpringToast('Beautified Import JSON payload.');
    } else {
      showSpringToast('Import paste area is empty!', 'error');
    }
  } catch (err) {
    showSpringToast('Formatting Failed: Invalid JSON syntax. ' + err.message, 'error');
  }
}

function handleImportFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(evt) {
    const txtArea = document.getElementById('import-textarea-json');
    if (txtArea) {
      txtArea.value = evt.target.result;
      beautifyImportJson(); // Auto-beautify uploaded file
      showSpringToast(`Loaded ${file.name} successfully.`);
    }
  };
  reader.onerror = function() {
    showSpringToast('Failed to read file!', 'error');
  };
  reader.readAsText(file);
}

async function commitImportForm(e) {
  e.preventDefault();
  
  const rawText = document.getElementById('import-textarea-json').value.trim();
  if (!rawText) {
    showSpringToast('Please paste a JSON payload or select a file first!', 'error');
    return;
  }
  
  let data;
  try {
    data = JSON.parse(rawText);
  } catch (err) {
    showSpringToast('Invalid JSON Syntax: ' + err.message, 'error');
    return;
  }
  
  const importType = document.getElementById('form-import-type').value;
  const mergeBehavior = document.getElementById('form-import-merge').value;
  
  let detectedType = importType;
  if (importType === 'auto') {
    // Determine the structure
    if (typeof data === 'object' && !Array.isArray(data)) {
      if ('tasks' in data || 'availability' in data || 'fixed_events' in data || 'fixed' in data) {
        detectedType = 'package';
      } else {
        showSpringToast('Could not auto-detect object structure. Expected complete task package.', 'error');
        return;
      }
    } else if (Array.isArray(data)) {
      if (data.length === 0) {
        showSpringToast('Auto-detection failed: JSON array is empty.', 'error');
        return;
      }
      const first = data[0];
      if (typeof first === 'object' && first !== null) {
        if ('duration_minutes' in first || 'can_split' in first || 'deadline' in first) {
          detectedType = 'tasks';
        } else if ('start' in first && 'end' in first) {
          if ('name' in first || 'id' in first) {
            detectedType = 'fixed';
          } else {
            detectedType = 'availability';
          }
        } else {
          showSpringToast('Could not auto-detect array structure. Unknown keys.', 'error');
          return;
        }
      } else {
        showSpringToast('Auto-detection failed: Array elements are not objects.', 'error');
        return;
      }
    } else {
      showSpringToast('Auto-detection failed: JSON is neither an object nor an array.', 'error');
      return;
    }
  }
  
  // Now process based on detectedType
  try {
    if (detectedType === 'package') {
      const pkgTasks = data.tasks || [];
      const pkgAvail = data.availability || [];
      const pkgFixed = data.fixed_events || data.fixed || [];
      
      if (mergeBehavior === 'replace') {
        tasks = pkgTasks;
        availability = pkgAvail;
        fixedEvents = pkgFixed;
      } else {
        tasks = tasks.concat(pkgTasks);
        availability = availability.concat(pkgAvail);
        fixedEvents = fixedEvents.concat(pkgFixed);
      }
    } else if (detectedType === 'tasks') {
      if (!Array.isArray(data)) throw new Error('Tasks dataset must be a JSON array.');
      if (mergeBehavior === 'replace') {
        tasks = data;
      } else {
        tasks = tasks.concat(data);
      }
    } else if (detectedType === 'availability') {
      if (!Array.isArray(data)) throw new Error('Availability dataset must be a JSON array.');
      if (mergeBehavior === 'replace') {
        availability = data;
      } else {
        availability = availability.concat(data);
      }
    } else if (detectedType === 'fixed') {
      if (!Array.isArray(data)) throw new Error('Fixed commitments dataset must be a JSON array.');
      if (mergeBehavior === 'replace') {
        fixedEvents = data;
      } else {
        fixedEvents = fixedEvents.concat(data);
      }
    }
    
    // Auto-indexing tasks if id is missing or duplicate
    let taskIdSet = new Set();
    tasks.forEach((t) => {
      if (!t.id || taskIdSet.has(t.id)) {
        t.id = (taskIdSet.size > 0 ? Math.max(...Array.from(taskIdSet)) : 0) + 1;
      }
      taskIdSet.add(t.id);
      if (!t.dependencies) t.dependencies = [];
      if (!t.subtasks) t.subtasks = [];
    });
    
    // Sort availability chronologically
    availability.sort((a,b) => new Date(a.start) - new Date(b.start));
    
    // Auto-adjust calendar starting date to the week of the first imported item
    let firstDateStr = null;
    if (tasks.length > 0 && tasks[0].deadline) {
      firstDateStr = tasks[0].deadline;
    } else if (availability.length > 0 && availability[0].start) {
      firstDateStr = availability[0].start;
    }
    
    if (firstDateStr && typeof activeWeekStartDate !== 'undefined') {
      const d = new Date(firstDateStr);
      if (!isNaN(d.getTime())) {
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d.setDate(diff));
        monday.setHours(0,0,0,0);
        activeWeekStartDate = monday;
        
        const yyyy = monday.getFullYear();
        const mm = String(monday.getMonth() + 1).padStart(2, '0');
        const dd = String(monday.getDate()).padStart(2, '0');
        activeDayDateString = `${yyyy}-${mm}-${dd}`;
        activeDayIndex = 1;
      }
    }
    
    dismissModal('modal-import-popup');
    showSpringToast(`Imported ${detectedType.toUpperCase()} dataset successfully!`);
    
    // Refresh weekday buttons for the new dates
    if (typeof renderDynamicWeekDays === 'function') {
      renderDynamicWeekDays();
    }
    
    syncStateToVisualDocks();
    if (isAutoSolve) {
      await triggerSchedulerOptimization(true);
    } else {
      markScheduleOutOfSync();
    }
  } catch (err) {
    showSpringToast('Import Failed: ' + err.message, 'error');
  }
}

// Load a premium demonstration task package preset template into the Import editor (PHASE 16)
function loadImportTemplatePreset(presetType) {
  const txtArea = document.getElementById('import-textarea-json');
  if (!txtArea) return;

  const presets = {
    developer: {
      "tasks": [
        {
          "id": 1,
          "name": "Refactor Legacy DB Layer",
          "duration_minutes": 180,
          "deadline": "2026-06-03T18:00:00",
          "priority": 5,
          "difficulty": 4,
          "dependencies": [],
          "can_split": true,
          "fixed": false
        },
        {
          "id": 2,
          "name": "Write Automated Unit Tests",
          "duration_minutes": 120,
          "deadline": "2026-06-04T12:00:00",
          "priority": 4,
          "difficulty": 3,
          "dependencies": [1],
          "can_split": true,
          "fixed": false
        },
        {
          "id": 3,
          "name": "Setup Docker Configurations",
          "duration_minutes": 90,
          "deadline": "2026-06-02T20:00:00",
          "priority": 3,
          "difficulty": 4,
          "dependencies": [],
          "can_split": false,
          "fixed": false
        },
        {
          "id": 4,
          "name": "Write API documentation specs",
          "duration_minutes": 60,
          "deadline": "2026-06-05T18:00:00",
          "priority": 2,
          "difficulty": 2,
          "dependencies": [],
          "can_split": true,
          "fixed": false
        }
      ],
      "availability": [
        { "start": "2026-06-01T09:00:00", "end": "2026-06-01T18:00:00" },
        { "start": "2026-06-02T09:00:00", "end": "2026-06-02T18:00:00" },
        { "start": "2026-06-03T09:00:00", "end": "2026-06-03T18:00:00" },
        { "start": "2026-06-04T09:00:00", "end": "2026-06-04T18:00:00" },
        { "start": "2026-06-05T09:00:00", "end": "2026-06-05T18:00:00" }
      ],
      "fixed_events": [
        { "id": 101, "name": "Daily Team Scrum Meeting", "start": "2026-06-01T10:00:00", "end": "2026-06-01T10:30:00" },
        { "id": 102, "name": "Sprint Planning & Review", "start": "2026-06-03T14:00:00", "end": "2026-06-03T15:30:00" }
      ]
    },
    university: {
      "tasks": [
        {
          "id": 1,
          "name": "Math Exam Sheet Preparation",
          "duration_minutes": 150,
          "deadline": "2026-06-02T16:00:00",
          "priority": 5,
          "difficulty": 4,
          "dependencies": [],
          "can_split": true,
          "fixed": false
        },
        {
          "id": 2,
          "name": "Physics Assignment Problems",
          "duration_minutes": 180,
          "deadline": "2026-06-04T18:00:00",
          "priority": 4,
          "difficulty": 5,
          "dependencies": [],
          "can_split": true,
          "fixed": false
        },
        {
          "id": 3,
          "name": "Read History Chapter 5",
          "duration_minutes": 90,
          "deadline": "2026-06-03T20:00:00",
          "priority": 2,
          "difficulty": 2,
          "dependencies": [],
          "can_split": true,
          "fixed": false
        }
      ],
      "availability": [
        { "start": "2026-06-01T08:00:00", "end": "2026-06-01T20:00:00" },
        { "start": "2026-06-02T08:00:00", "end": "2026-06-02T20:00:00" },
        { "start": "2026-06-03T08:00:00", "end": "2026-06-03T20:00:00" },
        { "start": "2026-06-04T08:00:00", "end": "2026-06-04T20:00:00" }
      ],
      "fixed_events": [
        { "id": 201, "name": "Calculus Lecture Seminar", "start": "2026-06-01T11:00:00", "end": "2026-06-01T12:30:00" },
        { "id": 202, "name": "Linear Algebra Recitation", "start": "2026-06-02T13:00:00", "end": "2026-06-02T15:00:00" },
        { "id": 203, "name": "Chemistry Lab Session", "start": "2026-06-03T10:00:00", "end": "2026-06-03T12:00:00" }
      ]
    },
    weekend: {
      "tasks": [
        {
          "id": 1,
          "name": "Cardio Interval Trail Run",
          "duration_minutes": 60,
          "deadline": "2026-06-06T12:00:00",
          "priority": 4,
          "difficulty": 3,
          "dependencies": [],
          "can_split": false,
          "fixed": false
        },
        {
          "id": 2,
          "name": "Grocery Shopping & Cooking",
          "duration_minutes": 120,
          "deadline": "2026-06-06T19:00:00",
          "priority": 3,
          "difficulty": 2,
          "dependencies": [],
          "can_split": true,
          "fixed": false
        },
        {
          "id": 3,
          "name": "Read Sci-Fi Novels chapters",
          "duration_minutes": 90,
          "deadline": "2026-06-07T21:00:00",
          "priority": 2,
          "difficulty": 1,
          "dependencies": [],
          "can_split": true,
          "fixed": false
        },
        {
          "id": 4,
          "name": "Figma SaaS Design mockups",
          "duration_minutes": 150,
          "deadline": "2026-06-07T18:00:00",
          "priority": 4,
          "difficulty": 3,
          "dependencies": [],
          "can_split": true,
          "fixed": false
        }
      ],
      "availability": [
        { "start": "2026-06-06T09:00:00", "end": "2026-06-06T21:00:00" },
        { "start": "2026-06-07T09:00:00", "end": "2026-06-07T21:00:00" }
      ],
      "fixed_events": [
        { "id": 301, "name": "Family dinner meeting", "start": "2026-06-06T13:00:00", "end": "2026-06-06T15:00:00" },
        { "id": 302, "name": "Gym Workout & Yoga", "start": "2026-06-07T10:00:00", "end": "2026-06-07T11:30:00" }
      ]
    }
  };

  const selectedPreset = presets[presetType];
  if (selectedPreset) {
    txtArea.value = JSON.stringify(selectedPreset, null, 2);
    // Set auto-detect and replace mode automatically to make loading instant
    const typeSelect = document.getElementById('form-import-type');
    if (typeSelect) typeSelect.value = 'auto';
    const mergeSelect = document.getElementById('form-import-merge');
    if (mergeSelect) mergeSelect.value = 'replace';
    
    showSpringToast(`Preloaded '${presetType.toUpperCase()}' demo package preset.`);
  }
}

/* ==========================================================================
   5. INTERACTIVE CONFLICT RESOLUTION ASSISTANT
   ========================================================================== */
function launchFixProblemModal(taskId, reason) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) {
    showSpringToast("Task not found!", "error");
    return;
  }

  document.getElementById('fix-task-name').textContent = task.name;
  document.getElementById('fix-task-reason').textContent = `Reason: ${reason}`;
  document.getElementById('fix-task-id').value = taskId;

  // Set default values for option inputs
  let dl = task.deadline;
  if (dl.length > 16) dl = dl.substring(0, 16);
  document.getElementById('fix-task-new-deadline').value = dl;

  // Show/Hide dependency option card based on task dependencies
  const depsCard = document.getElementById('fix-dependency-card');
  if (task.dependencies && task.dependencies.length > 0) {
    depsCard.style.display = 'block';
  } else {
    depsCard.style.display = 'none';
  }

  // Choose default option based on the reason
  const availOpt = document.getElementById('fix-opt-enable-avail');
  const deadlineOpt = document.getElementById('fix-opt-enable-deadline');
  const depsOpt = document.getElementById('fix-opt-enable-deps');

  if (reason.toLowerCase().includes('dependency') && task.dependencies.length > 0) {
    if (depsOpt) depsOpt.checked = true;
    availOpt.checked = false;
    deadlineOpt.checked = false;
    toggleFixOption('deps');
  } else {
    availOpt.checked = true;
    deadlineOpt.checked = false;
    if (depsOpt) depsOpt.checked = false;
    toggleFixOption('avail');
  }

  // Generate weekday checkboxes dynamically based on activeWeekStartDate
  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const container = document.getElementById('fix-days-checkboxes');
  container.innerHTML = '';

  const taskDeadline = new Date(task.deadline);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(activeWeekStartDate.getTime());
    dayDate.setDate(activeWeekStartDate.getDate() + i);
    
    // Clear hours for accurate comparison
    const dayDateZero = new Date(dayDate.getTime());
    dayDateZero.setHours(0, 0, 0, 0);
    
    // Skip dates in the past relative to current local date
    if (dayDateZero < todayStart) {
      continue;
    }
    
    const yyyy = dayDate.getFullYear();
    const mm = String(dayDate.getMonth() + 1).padStart(2, '0');
    const dd = String(dayDate.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    
    const labelText = `${daysOfWeek[i]} (${dayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`;
    
    // Auto-check if the day is before or equal to the task's deadline
    const isBeforeOrOnDeadline = dayDateZero <= taskDeadline;
    const checkedAttr = isBeforeOrOnDeadline ? 'checked' : '';

    const div = document.createElement('div');
    div.innerHTML = `
      <label style="display:flex; align-items:center; gap:6px; font-size:12px; color:#fff; cursor:pointer;">
        <input type="checkbox" name="fix-day-checkbox" value="${dateStr}" ${checkedAttr} />
        <span>${labelText}</span>
      </label>
    `;
    container.appendChild(div);
  }

  displayModal('modal-fix-problem-popup');
  lucide.createIcons();
}

function toggleFixOption(option) {
  const availOpt = document.getElementById('fix-opt-enable-avail');
  const deadlineOpt = document.getElementById('fix-opt-enable-deadline');
  const depsOpt = document.getElementById('fix-opt-enable-deps');

  const availSec = document.getElementById('fix-avail-section');
  const deadlineSec = document.getElementById('fix-deadline-section');
  const depsSec = document.getElementById('fix-deps-section');

  if (option === 'avail') {
    if (availOpt.checked) {
      availSec.style.display = 'block';
      deadlineOpt.checked = false;
      deadlineSec.style.display = 'none';
      if (depsOpt) {
        depsOpt.checked = false;
        depsSec.style.display = 'none';
      }
    } else {
      availSec.style.display = 'none';
    }
  } else if (option === 'deadline') {
    if (deadlineOpt.checked) {
      deadlineSec.style.display = 'block';
      availOpt.checked = false;
      availSec.style.display = 'none';
      if (depsOpt) {
        depsOpt.checked = false;
        depsSec.style.display = 'none';
      }
    } else {
      deadlineSec.style.display = 'none';
    }
  } else if (option === 'deps') {
    if (depsOpt && depsOpt.checked) {
      depsSec.style.display = 'block';
      availOpt.checked = false;
      availSec.style.display = 'none';
      deadlineOpt.checked = false;
      deadlineSec.style.display = 'none';
    } else {
      if (depsSec) depsSec.style.display = 'none';
    }
  }
}

async function applyProblemResolution(e) {
  e.preventDefault();

  const taskId = parseInt(document.getElementById('fix-task-id').value);
  const taskIdx = tasks.findIndex(t => t.id === taskId);
  if (taskIdx === -1) {
    showSpringToast("Task not found!", "error");
    return;
  }

  const availOpt = document.getElementById('fix-opt-enable-avail').checked;
  const deadlineOpt = document.getElementById('fix-opt-enable-deadline').checked;
  const depsOpt = document.getElementById('fix-opt-enable-deps') ? document.getElementById('fix-opt-enable-deps').checked : false;

  let appliedAny = false;

  if (availOpt) {
    const checkedBoxes = Array.from(document.querySelectorAll('input[name="fix-day-checkbox"]:checked'));
    if (checkedBoxes.length === 0) {
      showSpringToast("Please select at least one day to add availability!", "error");
      return;
    }

    const startTimeVal = document.getElementById('fix-avail-start-time').value || "09:00";
    const endTimeVal = document.getElementById('fix-avail-end-time').value || "18:00";
    
    if (startTimeVal >= endTimeVal) {
      showSpringToast("End time must be after start time!", "error");
      return;
    }

    checkedBoxes.forEach(cb => {
      const dateStr = cb.value;
      const start = `${dateStr}T${startTimeVal}:00`;
      const end = `${dateStr}T${endTimeVal}:00`;
      
      // Overwrite/expand if slot on same date already exists, otherwise push new slot
      const existingIdx = availability.findIndex(slot => slot.start.substring(0, 10) === dateStr);
      if (existingIdx !== -1) {
        availability[existingIdx] = { start, end };
        appliedAny = true;
      } else {
        availability.push({ start, end });
        appliedAny = true;
      }
    });

    if (appliedAny) {
      availability.sort((a, b) => new Date(a.start) - new Date(b.start));
      showSpringToast(`Added/Expanded availability slot(s) for selected days.`);
    }
  } else if (deadlineOpt) {
    let newDeadline = document.getElementById('fix-task-new-deadline').value;
    if (newDeadline) {
      if (newDeadline.length === 16) newDeadline += ":00";
      const deadlineDate = new Date(newDeadline);
      if (deadlineDate < new Date()) {
        showSpringToast("Cannot postpone deadline to a past date!", "error");
        return;
      }
      tasks[taskIdx].deadline = newDeadline;
      appliedAny = true;
      showSpringToast("Extended task deadline.");
    }
  } else if (depsOpt) {
    tasks[taskIdx].dependencies = [];
    appliedAny = true;
    showSpringToast("Cleared prerequisite requirements.");
  }

  if (appliedAny) {
    dismissModal('modal-fix-problem-popup');
    syncStateToVisualDocks();
    if (isAutoSolve) {
      await triggerSchedulerOptimization(false);
    } else {
      markScheduleOutOfSync();
    }
  }
}
