/* ==========================================================================
   TOASTS AND DATA EXPORTS
   ========================================================================== */

// 1. Toast notifications
function showSpringToast(message, type = 'success') {
  const container = document.getElementById('chrono-toasts-viewport');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = `hud-toast-node ${type === 'error' ? 'toast-error-theme' : ''}`;
  
  const iconName = type === 'error' ? 'alert-octagon' : 'check-circle';
  toast.innerHTML = `
    <i data-lucide="${iconName}"></i>
    <span>${escapeHtml(message)}</span>
  `;
  
  container.appendChild(toast);
  lucide.createIcons();

  // Toast exit duration
  setTimeout(() => {
    toast.remove();
  }, 4000);
}

// 2. Direct browser downloads (TXT, CSV, JSON)
function downloadScheduleFormat(format) {
  if (!scheduleOutput) {
    showSpringToast('Plan your week first, then export the schedule.', 'error');
    return;
  }
  
  try {
    let content = '';
    let filename = `weekly_schedule.${format}`;
    
    if (format === 'json') {
      content = JSON.stringify(scheduleOutput, null, 2);
    } else if (format === 'csv') {
      let rows = [['Segment Start', 'Segment End', 'Task/Commitment Title', 'Priority Rating', 'Deadline']];
      
      if (scheduleOutput.schedule) {
        scheduleOutput.schedule.forEach(s => {
          rows.push([s.start, s.end, s.task_name, s.priority || '', s.deadline || '']);
        });
      }
      
      content = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    } else {
      content = `=== WEEKLY PLANNER SCHEDULE ===\n`;
      content += `Schedule score: ${scheduleOutput.statistics.score || 0}\n`;
      content += `Scheduled: ${scheduleOutput.statistics.scheduled_tasks} of ${scheduleOutput.statistics.total_tasks} total tasks\n`;
      content += `Conflicts: ${scheduleOutput.statistics.conflicts}\n\n`;
      content += `=== PLANNED BLOCKS ===\n`;
      
      if (scheduleOutput.schedule) {
        scheduleOutput.schedule.forEach(s => {
          content += `[${formatDateLabel(s.start)} - ${formatDateLabel(s.end)}] ${s.task_name} (Priority: ${s.priority})\n`;
        });
      }
    }

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showSpringToast(`Downloaded ${format.toUpperCase()} schedule.`);
  } catch (err) {
    showSpringToast('Download failed: ' + err.message, 'error');
  }
}

// 3. Export Raw Input Database Package (Tasks, Availability, Fixed Commitments)
function downloadRawDatabasePackage() {
  try {
    const pkg = {
      tasks: tasks,
      availability: availability,
      fixed_events: fixedEvents
    };
    const content = JSON.stringify(pkg, null, 2);
    const blob = new Blob([content], { type: 'application/json;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "weekly_planner_package.json");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showSpringToast('Exported planner package.');
  } catch (err) {
    showSpringToast('Export failed: ' + err.message, 'error');
  }
}
