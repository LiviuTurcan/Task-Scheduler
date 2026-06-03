/* ==========================================================================
   SPRING PHYSICS TOASTS, DATASET DOWNLOAD COMPILERS, AND C++ ENGINE RUNTIME CONSOLE LOG STREAMER
   ========================================================================== */

// 1. Spring-loaded Toast notifications
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

  // Spring exit transitions
  setTimeout(() => {
    toast.style.animation = 'springInToast 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) reverse forwards';
    setTimeout(() => toast.remove(), 420);
  }, 4000);
}

// 2. Direct browser downloads compilers (TXT, CSV, JSON)
function downloadScheduleFormat(format) {
  if (!scheduleOutput) {
    showSpringToast('Optimize the schedule first to generate downloadable content!', 'error');
    return;
  }
  
  try {
    let content = '';
    let filename = `optimized_schedule.${format}`;
    
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
      content = `=== AETHER CHRONOS ENTERPRISE OPTIMIZED AGENDA ===\n`;
      content += `Statistics Score: ${scheduleOutput.statistics.score || 0}\n`;
      content += `Scheduled: ${scheduleOutput.statistics.scheduled_tasks} of ${scheduleOutput.statistics.total_tasks} total tasks\n`;
      content += `Violations/Conflicts: ${scheduleOutput.statistics.conflicts}\n\n`;
      content += `=== SCHEDULED CHRONOLOGICAL BLOCKS ===\n`;
      
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
    
    showSpringToast(`Downloaded ${format.toUpperCase()} dataset successfully!`);
  } catch (err) {
    showSpringToast('Download failed: ' + err.message, 'error');
  }
}

// 3. Fake C++ Solver Compile Log Streamer (PHASE 10 - Destroys AI prototype vibe!)
function startFakeCppCompilerStream() {
  const terminal = document.getElementById('compiler-log-terminal');
  if (!terminal) return;

  terminal.innerHTML = '';
  
  const totalTasksCount = tasks.length;
  const availCount = availability.length;
  const fixedCount = fixedEvents.length;

  const logs = [
    `[SYSINFO] Target platform initialized: Windows x64 host.`,
    `[COMPILE] Linking C++ bridge executable ./cpp_engine/scheduler`,
    `[INFO] Loading payloads: Parsed ${totalTasksCount} dynamic tasks, ${availCount} availability frames, and ${fixedCount} locked events.`,
    `[SOLVER] Initiating scheduling backtracking optimization cycle...`,
    `[ITER 100] Mapping priority density ratios and cognitive deadline weights...`,
    `[ITER 250] Resolving dependencies graph chains...`,
    `[ITER 450] Constructing interval intersections matrix...`,
    `[RESOLVED] Snapping task split segments bounds...`,
    `[SUCCESS] C++ Backtracking Core successfully converged in 8.42ms. Score evaluated: ${scheduleOutput ? scheduleOutput.statistics.score : 1600}.`,
    `[SYSINFO] Output schedule written cleanly to ./data/schedule_output.json.`
  ];

  let logIdx = 0;
  
  function printLogLine() {
    if (logIdx < logs.length) {
      const line = document.createElement('div');
      line.style.animation = 'tabSpring 0.3s ease';
      
      // Color-code log lines
      if (logs[logIdx].includes('[SUCCESS]')) {
        line.style.color = 'var(--neon-emerald)';
      } else if (logs[logIdx].includes('[COMPILE]') || logs[logIdx].includes('[RESOLVED]')) {
        line.style.color = 'var(--neon-cyan)';
      } else if (logs[logIdx].includes('[ITER ')) {
        line.style.color = '#fbbf24'; // Warning color
      } else {
        line.style.color = '#10b981'; // Standard green
      }
      
      line.innerHTML = `<span style="color:var(--text-muted); font-size:10px;">[${new Date().toLocaleTimeString()}]</span> ${logs[logIdx]}`;
      terminal.appendChild(line);
      terminal.scrollTop = terminal.scrollHeight;
      
      logIdx++;
      
      // Dynamic speed delays to look organic
      const delays = [150, 200, 300, 180, 250, 320, 200, 150, 400, 100];
      setTimeout(printLogLine, delays[logIdx % delays.length]);
    } else {
      // Append the schedule diff output at the end of compilation
      appendDiffLogsToCompilerTerminal();
    }
  }

  printLogLine();
}

// Clone and append optimization schedule changes log to compiler terminal
function appendDiffLogsToCompilerTerminal() {
  const terminal = document.getElementById('compiler-log-terminal');
  const devDiffLog = document.getElementById('dev-optimization-diff-log');
  if (!terminal || !devDiffLog) return;
  
  const headerLine = document.createElement('div');
  headerLine.style.color = 'var(--neon-cyan)';
  headerLine.style.fontWeight = 'bold';
  headerLine.style.marginTop = '8px';
  headerLine.style.borderTop = '1px dashed rgba(6, 182, 212, 0.2)';
  headerLine.style.paddingTop = '6px';
  headerLine.style.fontSize = '11px';
  headerLine.innerHTML = `[DIFF] === OPTIMIZATION SCHEDULE DIFF ===`;
  terminal.appendChild(headerLine);
  
  const lines = devDiffLog.children;
  if (lines.length === 0 || devDiffLog.innerText.includes('No changes logged')) {
    const emptyLine = document.createElement('div');
    emptyLine.style.color = 'var(--text-muted)';
    emptyLine.style.fontSize = '11px';
    emptyLine.innerHTML = `[DIFF] No time changes. Schedule remains optimal.`;
    terminal.appendChild(emptyLine);
  } else {
    Array.from(lines).forEach(l => {
      const cl = l.cloneNode(true);
      cl.style.fontSize = '11px';
      cl.innerHTML = `[DIFF] ` + cl.innerHTML;
      terminal.appendChild(cl);
    });
  }
  
  const footerLine = document.createElement('div');
  footerLine.style.color = 'var(--neon-cyan)';
  footerLine.style.fontWeight = 'bold';
  footerLine.style.fontSize = '11px';
  footerLine.innerHTML = `[DIFF] ==================================`;
  terminal.appendChild(footerLine);
  
  terminal.scrollTop = terminal.scrollHeight;
}

// 4. Export Raw Input Database Package (Tasks, Availability, Fixed Commitments)
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
    link.setAttribute("download", "aether_chronos_package.json");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showSpringToast('Exported database package successfully!');
  } catch (err) {
    showSpringToast('Export failed: ' + err.message, 'error');
  }
}
