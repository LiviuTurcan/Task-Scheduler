/* ==========================================================================
   24h CHRONOLOGICAL CALENDAR DRAWING & GRID DRAG-AND-DROP SOLVER
   ========================================================================== */

// Segments view controller
function toggleTimelineSegment(mode) {
  activeTimelineSegment = mode;
  
  document.getElementById('seg-btn-grid').classList.toggle('active', mode === 'grid');
  document.getElementById('seg-btn-agenda').classList.toggle('active', mode === 'agenda');

  document.getElementById('chrono-timeline-grid').classList.toggle('active', mode === 'grid');
  document.getElementById('chrono-timeline-agenda').classList.toggle('active', mode === 'agenda');

  renderTimelineView();
}

// Dynamic week start date tracking. We initialize it to the Monday of June 1st, 2026.
let activeWeekStartDate = new Date("2026-06-01T00:00:00");

// Render the 7 weekday selector buttons dynamically based on activeWeekStartDate
function renderDynamicWeekDays() {
  const container = document.getElementById('week-nav-bar-container');
  if (!container) return;
  container.innerHTML = '';

  const weekdays = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  for (let i = 0; i < 7; i++) {
    // Generate date offset relative to Active Week Start Date (Monday)
    const current = new Date(activeWeekStartDate.getTime() + i * 24 * 60 * 60 * 1000);
    const yyyy = current.getFullYear();
    const mm = String(current.getMonth() + 1).padStart(2, '0');
    const dd = String(current.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

    const isDayActive = (activeDayDateString === dateStr);

    const btn = document.createElement('button');
    btn.id = `week-day-${i + 1}`;
    btn.className = `week-nav-btn ${isDayActive ? 'active' : ''}`;
    btn.setAttribute('onclick', `selectDaySelector(${i + 1}, '${dateStr}')`);

    btn.innerHTML = `
      <span class="week-btn-title">${weekdays[i]}</span>
      <span class="week-btn-subtitle">${current.getDate()} ${months[current.getMonth()]}</span>
      <div class="week-dots-group" id="density-dots-${i + 1}"></div>
    `;
    container.appendChild(btn);
  }

  // Refresh density indicator dots under newly drawn buttons
  updateWeekDensityDotCounters();
}

// Navigate whole week (7 days) in future or past
function navigateActiveWeek(offsetWeeks) {
  activeWeekStartDate = new Date(activeWeekStartDate.getTime() + offsetWeeks * 7 * 24 * 60 * 60 * 1000);
  
  // Keep the same weekday offset when navigating to new week
  const newSelectedDay = new Date(activeWeekStartDate.getTime() + (activeDayIndex - 1) * 24 * 60 * 60 * 1000);
  const yyyy = newSelectedDay.getFullYear();
  const mm = String(newSelectedDay.getMonth() + 1).padStart(2, '0');
  const dd = String(newSelectedDay.getDate()).padStart(2, '0');
  
  activeDayDateString = `${yyyy}-${mm}-${dd}`;
  
  renderDynamicWeekDays();
  renderTimelineView();
  if (typeof recalculateChartsData === 'function') {
    recalculateChartsData();
  }
}

// Selector weekday controller
function selectDaySelector(dayIndex, dateString) {
  activeDayIndex = dayIndex;
  activeDayDateString = dateString;

  document.querySelectorAll('.week-nav-btn').forEach(btn => btn.classList.remove('active'));
  const btn = document.getElementById(`week-day-${dayIndex}`);
  if (btn) btn.classList.add('active');

  renderTimelineView();
  
  // Update radar charts
  if (typeof recalculateChartsData === 'function') {
    recalculateChartsData();
  }
}

// Render visual blocks inside timeline
function renderTimelineView() {
  const availWrapper = document.getElementById('chrono-availabilities-wrapper');
  const schedWrapper = document.getElementById('chrono-schedule-wrapper');
  const agendaWrapper = document.getElementById('chrono-timeline-agenda');

  if (!availWrapper || !schedWrapper || !agendaWrapper) return;

  availWrapper.innerHTML = '';
  schedWrapper.innerHTML = '';
  agendaWrapper.innerHTML = '';

  const startDayStr = activeDayDateString + "T00:00:00";
  const endDayStr = activeDayDateString + "T23:59:59";
  const startDay = new Date(startDayStr);
  const endDay = new Date(endDayStr);

  // Simulated Laser mock line placement
  const laserIndicator = document.getElementById('chrono-sim-laser');
  if (activeDayDateString === "2026-06-01") {
    laserIndicator.style.display = 'block';
    const topPx = 17 * 60 + (18 / 60) * 60; // 1038px
    laserIndicator.style.top = topPx + 'px';
  } else {
    laserIndicator.style.display = 'none';
  }

  // 1. Draw Available frame backdrops
  availability.forEach(slot => {
    const start = new Date(slot.start);
    const end = new Date(slot.end);

    if (start < endDay && end > startDay) {
      const matchStart = new Date(Math.max(start, startDay));
      const matchEnd = new Date(Math.min(end, endDay));

      const startHr = matchStart.getHours() + matchStart.getMinutes() / 60;
      const duration = (matchEnd - matchStart) / (1000 * 60 * 60);

      const topPx = startHr * 60;
      const heightPx = duration * 60;

      const panel = document.createElement('div');
      panel.className = 'neon-available-panel';
      panel.style.top = topPx + 'px';
      panel.style.height = heightPx + 'px';
      panel.innerHTML = `<span style="margin-top:8px;"><i data-lucide="unlock" style="width:11px; display:inline-block; vertical-align:middle; margin-right:4px;"></i> Available Frame</span>`;
      availWrapper.appendChild(panel);
    }
  });

  let chronologicalAgenda = [];

  // 2. Draw Fixed Events Locked cards
  fixedEvents.forEach((evt) => {
    const start = new Date(evt.start);
    const end = new Date(evt.end);

    if (start < endDay && end > startDay) {
      const matchStart = new Date(Math.max(start, startDay));
      const matchEnd = new Date(Math.min(end, endDay));

      const startHr = matchStart.getHours() + matchStart.getMinutes() / 60;
      const duration = (matchEnd - matchStart) / (1000 * 60 * 60);

      const topPx = startHr * 60;
      const heightPx = duration * 60;

      const block = document.createElement('div');
      block.className = 'timeline-block block-type-fixed';
      if (heightPx < 45) {
        block.classList.add('short-block');
      }
      block.style.top = topPx + 'px';
      block.style.height = heightPx + 'px';
      block.innerHTML = `
        <div class="block-header-box">
          <span class="block-headline"><i data-lucide="lock" style="width:11px; display:inline-block;"></i> ${escapeHtml(evt.name)}</span>
          <span class="block-hours-tag">${formatTimeClock(start)} - ${formatTimeClock(end)}</span>
        </div>
        <div class="block-footer-box">
          <span class="block-pills-row"><span style="color:#fed7aa; font-weight:700;">Locked Commitment</span></span>
        </div>
      `;

      // Tooltip triggers
      block.addEventListener('mousemove', (e) => triggerHoverTooltip(e, {
        name: evt.name,
        type: 'Fixed Commitment',
        start: evt.start,
        end: evt.end,
        duration: Math.round((end - start) / (1000 * 60))
      }));
      block.addEventListener('mouseleave', dismissHoverTooltip);

      schedWrapper.appendChild(block);

      chronologicalAgenda.push({
        name: evt.name,
        type: 'fixed',
        start: start,
        end: end
      });
    }
  });

  // 2.5 Draw Ended Tasks (Archived Completed Tasks)
  if (typeof endedTasks !== 'undefined') {
    endedTasks.forEach((task) => {
      if (!task.start || !task.end) return;
      const start = new Date(task.start);
      const end = new Date(task.end);

      if (start < endDay && end > startDay) {
        const matchStart = new Date(Math.max(start, startDay));
        const matchEnd = new Date(Math.min(end, endDay));

        const startHr = matchStart.getHours() + matchStart.getMinutes() / 60;
        const duration = (matchEnd - matchStart) / (1000 * 60 * 60);

        const topPx = startHr * 60;
        const heightPx = duration * 60;

        const block = document.createElement('div');
        block.className = 'timeline-block block-type-ended';
        if (heightPx < 45) {
          block.classList.add('short-block');
        }
        block.style.top = topPx + 'px';
        block.style.height = heightPx + 'px';
        block.innerHTML = `
          <div class="block-header-box">
            <span class="block-headline">${escapeHtml(task.name)}</span>
            <span class="block-hours-tag">${formatTimeClock(start)} - ${formatTimeClock(end)}</span>
          </div>
          <div class="block-footer-box">
            <span class="block-pills-row">
              <span class="block-split-badge" style="background:rgba(244,63,94,0.18); border:1px solid rgba(244,63,94,0.35); color:var(--neon-rose); text-transform:uppercase;">Ended</span>
            </span>
          </div>
        `;

        // Tooltip triggers
        block.addEventListener('mousemove', (e) => triggerHoverTooltip(e, {
          name: task.name,
          type: 'Ended / Completed Task',
          start: task.start,
          end: task.end,
          duration: Math.round((end - start) / (1000 * 60))
        }));
        block.addEventListener('mouseleave', dismissHoverTooltip);

        schedWrapper.appendChild(block);

        chronologicalAgenda.push({
          name: task.name,
          type: 'ended',
          start: start,
          end: end
        });
      }
    });
  }

  // 3. Draw Scheduled Optimized Task blocks (Equipped with custom drag-and-drop!)
  if (scheduleOutput && scheduleOutput.schedule) {
    const taskTotalSplits = {};
    scheduleOutput.schedule.forEach(seg => {
      taskTotalSplits[seg.task_id] = (taskTotalSplits[seg.task_id] || 0) + 1;
    });

    const taskCurrentSegmentIndex = {};

    scheduleOutput.schedule.forEach(seg => {
      const start = new Date(seg.start);
      const end = new Date(seg.end);

      if (start < endDay && end > startDay) {
        taskCurrentSegmentIndex[seg.task_id] = (taskCurrentSegmentIndex[seg.task_id] || 0) + 1;

        const matchStart = new Date(Math.max(start, startDay));
        const matchEnd = new Date(Math.min(end, endDay));

        const startHr = matchStart.getHours() + matchStart.getMinutes() / 60;
        const duration = (matchEnd - matchStart) / (1000 * 60 * 60);

        const topPx = startHr * 60;
        const heightPx = duration * 60;

        const totalSplits = taskTotalSplits[seg.task_id] || 1;
        const currentIdx = taskCurrentSegmentIndex[seg.task_id] || 1;

        const block = document.createElement('div');
        const isEnded = new Date(seg.end) < new Date();
        block.className = `timeline-block ${isEnded ? 'block-type-ended' : 'block-type-task'}`;
        if (heightPx < 45) {
          block.classList.add('short-block');
        }
        block.style.top = topPx + 'px';
        block.style.height = heightPx + 'px';
        
        block.innerHTML = `
          <div class="block-header-box">
            <span class="block-headline">${escapeHtml(seg.task_name)}</span>
            <span class="block-hours-tag">${formatTimeClock(start)} - ${formatTimeClock(end)}</span>
          </div>
          <div class="block-footer-box">
            <span class="block-pills-row">
              ${totalSplits > 1 ? `<span class="block-split-badge">Segment ${currentIdx}/${totalSplits}</span>` : ''}
              ${isEnded ? '<span class="block-split-badge" style="background:rgba(244,63,94,0.18); border:1px solid rgba(244,63,94,0.35); color:var(--neon-rose); text-transform:uppercase;">Ended</span>' : `<span style="font-size:9.5px; font-weight:700; color:var(--text-secondary);">Prio: ${seg.priority}</span>`}
            </span>
          </div>
        `;

        // Tooltip triggers
        block.addEventListener('mousemove', (e) => {
          if (!block.classList.contains('dragging-active')) {
            triggerHoverTooltip(e, {
              name: seg.task_name,
              type: 'Optimized Task Allocation',
              start: seg.start,
              end: seg.end,
              deadline: seg.deadline,
              priority: seg.priority,
              splitIndex: totalSplits > 1 ? `${currentIdx} of ${totalSplits}` : null,
              duration: Math.round((end - start) / (1000 * 60))
            });
          }
        });
        block.addEventListener('mouseleave', dismissHoverTooltip);

        // ATTACH ACTIVE DRAG-AND-DROP TRIGGERS (PHASE 8)
        makeTimelineBlockDraggable(block, seg, Math.round(duration * 60));

        schedWrapper.appendChild(block);

        chronologicalAgenda.push({
          name: seg.task_name,
          type: 'task',
          start: start,
          end: end,
          priority: seg.priority,
          splitLabel: totalSplits > 1 ? `Segment part ${currentIdx}/${totalSplits}` : null
        });
      }
    });
  }

  // Render Classic Agenda list
  if (chronologicalAgenda.length === 0) {
    agendaWrapper.innerHTML = '<div class="empty-state">Nothing planned for today. Enjoy your free time!</div>';
  } else {
    chronologicalAgenda.sort((a,b) => a.start - b.start);
    
    chronologicalAgenda.forEach(item => {
      const card = document.createElement('div');
      card.className = 'card-item';
      card.style.borderLeft = item.type === 'fixed' ? '4px solid var(--neon-orange)' : (item.type === 'ended' ? '4px solid var(--neon-rose)' : '4px solid var(--neon-purple)');
      card.style.background = 'rgba(12, 6, 32, 0.45)';

      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div style="font-weight:800; color:#fff; font-family:var(--font-title); font-size:15px;">${escapeHtml(item.name)}</div>
          <div style="font-size:12px; font-weight:700; color:var(--neon-cyan);">${formatTimeClock(item.start)} - ${formatTimeClock(item.end)}</div>
        </div>
        <div class="card-badge-row" style="margin-top:8px;">
          <span class="badge-hud ${item.type === 'fixed' ? 'p-coral' : (item.type === 'ended' ? 'p-rose' : 'p-purple')}">${item.type.toUpperCase()}</span>
          ${item.splitLabel ? `<span class="badge-hud p-cyan">${item.splitLabel}</span>` : ''}
          ${item.priority ? `<span class="badge-hud">Priority: ${item.priority}</span>` : ''}
          <span class="badge-hud">${Math.round((item.end - item.start)/(1000*60))} min segment</span>
        </div>
      `;
      agendaWrapper.appendChild(card);
    });
  }

  lucide.createIcons();
}

// DRAG AND DROP MATHEMATICAL ENGINESnap logic (PHASE 8)
function makeTimelineBlockDraggable(element, segment, durationMinutes) {
  let startY = 0;
  let startTop = 0;
  let isDragging = false;

  // Prevent native HTML5 drag-and-drop from hijacking custom mouse/pointer movements
  element.addEventListener('dragstart', (e) => e.preventDefault());

  // Use PointerEvents to support touchscreens and mouse inputs seamlessly
  element.addEventListener('pointerdown', (e) => {
    // Left click / primary touch point only
    if (e.button !== 0) return;
    
    // Ignore if clicking input fields or buttons
    if (e.target.closest('button') || e.target.closest('input')) return;
    
    e.preventDefault();
    dismissHoverTooltip(); // hide popover while moving
    
    isDragging = true;
    element.classList.add('dragging-active');
    startY = e.clientY;
    
    const styleTop = element.style.top;
    startTop = styleTop ? parseInt(styleTop, 10) : element.offsetTop;
    if (isNaN(startTop)) startTop = 0;
    
    document.addEventListener('pointermove', onDragMove);
    document.addEventListener('pointerup', onDragEnd);
    document.addEventListener('pointercancel', onDragEnd);
  });
  
  function onDragMove(e) {
    if (!isDragging) return;
    
    let dy = e.clientY - startY;
    let newTop = startTop + dy;
    
    // Snapping matrix logic: Snap to 15-minute grids (15 minutes = 15px)
    newTop = Math.round(newTop / 15) * 15;
    
    // Boundaries clamping (00:00 to 24:00 - duration)
    const maxTop = 1440 - durationMinutes; // 24h = 1440px
    newTop = Math.max(0, Math.min(newTop, maxTop));
    
    element.style.top = newTop + 'px';
    
    // Live feedback update indicator inside hours label
    const startHour = Math.floor(newTop / 60);
    const startMins = newTop % 60;
    const endTotal = newTop + durationMinutes;
    const endHour = Math.floor(endTotal / 60);
    const endMins = endTotal % 60;
    
    const timeString = `${String(startHour).padStart(2, '0')}:${String(startMins).padStart(2, '0')} - ${String(endHour).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;
    const hoursTag = element.querySelector('.block-hours-tag');
    if (hoursTag) {
      hoursTag.textContent = timeString;
    }
  }
  
  async function onDragEnd(e) {
    if (!isDragging) return;
    isDragging = false;
    
    document.removeEventListener('pointermove', onDragMove);
    document.removeEventListener('pointerup', onDragEnd);
    document.removeEventListener('pointercancel', onDragEnd);
    
    element.classList.remove('dragging-active');
    
    const finalTop = parseInt(element.style.top, 10) || 0;
    
    // Calculate new start / end date times
    const startHour = Math.floor(finalTop / 60);
    const startMins = finalTop % 60;
    const endTotal = finalTop + durationMinutes;
    const endHour = Math.floor(endTotal / 60);
    const endMins = endTotal % 60;
    
    // Create new ISO strings relative to activeDayDateString
    const newStartISO = `${activeDayDateString}T${String(startHour).padStart(2, '0')}:${String(startMins).padStart(2, '0')}:00`;
    const newEndISO = `${activeDayDateString}T${String(endHour).padStart(2, '0')}:${String(endMins).padStart(2, '0')}:00`;
    
    // Find task in local memory, convert it to FIXED at this custom time so backend respects it!
    const taskIdx = tasks.findIndex(t => String(t.id) === String(segment.task_id));
    if (taskIdx !== -1) {
      tasks[taskIdx].fixed = true;
      tasks[taskIdx].fixed_start = newStartISO;
      tasks[taskIdx].fixed_end = newEndISO;
      
      showSpringToast(`Rescheduled "${tasks[taskIdx].name}" manually. Solver locking slot.`);
      
      // Update UI cards and Dev JSON accordion
      syncStateToVisualDocks();
      
      // Re-run solver to optimize the rest of tasks around this custom fixed slot!
      if (isAutoSolve) {
        await triggerSchedulerOptimization(true);
      } else {
        markScheduleOutOfSync();
      }
    } else {
      showSpringToast('Reschedule error. Task template missing.', 'error');
      renderTimelineView(); // restore
    }
  }
}

// Generate dots counter under day labels
function updateWeekDensityDotCounters() {
  for (let day = 1; day <= 7; day++) {
    const dotsWrapper = document.getElementById(`density-dots-${day}`);
    if (!dotsWrapper) continue;
    dotsWrapper.innerHTML = '';

    // Dynamically calculate target date string for this day index relative to activeWeekStartDate
    const targetDate = new Date(activeWeekStartDate.getTime() + (day - 1) * 24 * 60 * 60 * 1000);
    const yyyy = targetDate.getFullYear();
    const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
    const dd = String(targetDate.getDate()).padStart(2, '0');
    const dayDateStr = `${yyyy}-${mm}-${dd}`;

    const dayStart = new Date(dayDateStr + "T00:00:00");
    const dayEnd = new Date(dayDateStr + "T23:59:59");
    
    let count = 0;

    if (scheduleOutput && scheduleOutput.schedule) {
      count += scheduleOutput.schedule.filter(seg => {
        const s = new Date(seg.start);
        return s >= dayStart && s <= dayEnd;
      }).length;
    }

    const dotLimit = Math.min(3, count);
    for (let i = 0; i < dotLimit; i++) {
      const dot = document.createElement('div');
      dot.className = 'week-dot-indicator';
      dotsWrapper.appendChild(dot);
    }
  }
}

// Hover details bindings
function triggerHoverTooltip(e, data) {
  const tooltip = document.getElementById('chrono-hover-tooltip');
  if (!tooltip) return;
  tooltip.style.display = 'block';
  tooltip.style.left = (e.clientX + 16) + 'px';
  tooltip.style.top = (e.clientY + 12) + 'px';

  let html = `<div class="tooltip-headline">${escapeHtml(data.name)}</div>`;
  html += `<div class="tooltip-item-row"><span class="tooltip-key">Type:</span><span class="tooltip-val">${escapeHtml(data.type)}</span></div>`;
  html += `<div class="tooltip-item-row"><span class="tooltip-key">Duration:</span><span class="tooltip-val">${data.duration} min</span></div>`;
  html += `<div class="tooltip-item-row"><span class="tooltip-key">Starts:</span><span class="tooltip-val">${formatDateLabel(data.start)}</span></div>`;
  html += `<div class="tooltip-item-row"><span class="tooltip-key">Ends:</span><span class="tooltip-val">${formatDateLabel(data.end)}</span></div>`;

  if (data.deadline) {
    html += `<div class="tooltip-item-row"><span class="tooltip-key">Deadline:</span><span class="tooltip-val">${formatDateLabel(data.deadline)}</span></div>`;
  }
  if (data.priority) {
    html += `<div class="tooltip-item-row"><span class="tooltip-key">Priority:</span><span class="tooltip-val">${data.priority}/5</span></div>`;
  }
  if (data.splitIndex) {
    html += `<div class="tooltip-item-row"><span class="tooltip-key">Split segment:</span><span class="tooltip-val">${data.splitIndex}</span></div>`;
  }

  tooltip.innerHTML = html;
}

function dismissHoverTooltip() {
  const tooltip = document.getElementById('chrono-hover-tooltip');
  if (tooltip) tooltip.style.display = 'none';
}

// Generate the 24 hourly tick rows inside the calendar column (Prevents collapsed grid layout!)
function renderChronoTimelineTicks() {
  const ticksCol = document.getElementById('chrono-timeline-ticks');
  if (!ticksCol) return;
  ticksCol.innerHTML = '';
  for (let hr = 0; hr <= 23; hr++) {
    const row = document.createElement('div');
    row.className = 'tick-timeline-row';
    
    // Format hour string nicely: e.g. 00:00, 01:00, etc.
    const hrStr = String(hr).padStart(2, '0') + ':00';
    row.textContent = hrStr;
    ticksCol.appendChild(row);
  }
}
