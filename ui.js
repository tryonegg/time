// UI Module - Handles all UI rendering and event handling

let deferredPrompt;
let editingProjectId = null;
let editingSessionId = null;

// Initialize UI
function initUI() {
  setupInstallPrompt();
  setupViewNavigation();
  setupTimerControls();
  setupProjectModal();
  setupSessionModal();
  setupSettingsUI();
}

// Install banner for PWA
function setupInstallPrompt() {
  const installBanner = document.getElementById('install-banner');
  const installBannerBtn = document.getElementById('install-banner-btn');
  const dismissBannerBtn = document.getElementById('dismiss-install-banner-btn');
  
  let hasNativeSupport = false;

  // Check if banner has been dismissed
  function isBannerDismissed() {
    return localStorage.getItem('install-banner-dismissed') === 'true';
  }

  // Show banner on page load if not dismissed and not installed
  function showBannerIfNeeded() {
    if (!isBannerDismissed()) {
      installBanner.style.display = 'flex';
    }
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    hasNativeSupport = true;
    // Show banner when install is available
    showBannerIfNeeded();
  });

  installBannerBtn.addEventListener('click', async () => {
    installBanner.style.display = 'none';
    
    if (deferredPrompt && hasNativeSupport) {
      // Use native install prompt
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`User response: ${outcome}`);
      deferredPrompt = null;
      hasNativeSupport = false;
    } else {
      // Show browser-specific instructions in modal
      showInstallInstructions();
    }
  });

  function showInstallInstructions() {
    const installModal = document.getElementById('install-modal');
    const browserInstructions = document.getElementById('browser-instructions');
    const userAgent = navigator.userAgent.toLowerCase();
    let instructions = '';

    if (userAgent.includes('safari') && !userAgent.includes('chrome')) {
      // Safari
      instructions = `
        <ol style="margin-left: 1.5rem; line-height: 1.8;">
          <li>Tap the <strong>Share</strong> button (square with arrow)</li>
          <li>Scroll down and select <strong>Add to Home Screen</strong></li>
          <li>Enter a name and tap <strong>Add</strong></li>
        </ol>
      `;
    } else if (userAgent.includes('firefox')) {
      // Firefox
      instructions = `
        <ol style="margin-left: 1.5rem; line-height: 1.8;">
          <li>Tap the menu button (three dots)</li>
          <li>Select <strong>Install</strong> or <strong>Add to Home Screen</strong></li>
          <li>Confirm the installation</li>
        </ol>
      `;
    } else if (userAgent.includes('chrome') || userAgent.includes('edge')) {
      // Chrome/Edge
      instructions = `
        <p>The install button should appear automatically. If you don't see it:</p>
        <ol style="margin-left: 1.5rem; line-height: 1.8;">
          <li>Click the menu button (three dots)</li>
          <li>Select <strong>Install app</strong> or <strong>Create shortcut</strong></li>
        </ol>
      `;
    } else {
      // Generic
      instructions = `
        <p>Look for an <strong>Install</strong>, <strong>Add to Home Screen</strong>, or similar option in your browser menu, or:</p>
        <ol style="margin-left: 1.5rem; line-height: 1.8;">
          <li>Open the browser menu</li>
          <li>Look for an install or home screen option</li>
          <li>Follow the prompts to add Time Keeper to your home screen</li>
        </ol>
      `;
    }

    browserInstructions.innerHTML = instructions;
    installModal.classList.add('show');
    installModal.style.display = 'flex';
  }

  dismissBannerBtn.addEventListener('click', () => {
    installBanner.style.display = 'none';
    localStorage.setItem('install-banner-dismissed', 'true');
  });

  // Hide banner if already installed
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    hasNativeSupport = false;
    installBanner.style.display = 'none';
    localStorage.setItem('install-banner-dismissed', 'true');
  });

  // Click outside modal to close
  const installModal = document.getElementById('install-modal');
  const closeBtn = document.getElementById('install-modal-close');
  const closeBtnFooter = document.getElementById('install-modal-close-btn');

  closeBtn.addEventListener('click', () => {
    installModal.classList.remove('show');
    installModal.style.display = 'none';
  });

  closeBtnFooter.addEventListener('click', () => {
    installModal.classList.remove('show');
    installModal.style.display = 'none';
  });

  installModal.addEventListener('click', (e) => {
    if (e.target === installModal) {
      installModal.classList.remove('show');
      installModal.style.display = 'none';
    }
  });

  // Show banner on page load if not dismissed
  showBannerIfNeeded();
}

// View navigation
function setupViewNavigation() {
  const navBtns = document.querySelectorAll('.nav-btn');
  const views = document.querySelectorAll('.view');

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const viewName = btn.dataset.view;
      
      // Update active button
      navBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Update active view
      views.forEach(v => v.classList.remove('active'));
      document.getElementById(`${viewName}-view`).classList.add('active');

      // Refresh stats when entering stats view
      if (viewName === 'stats') {
        renderStats();
      }

      // Refresh history when entering history view
      if (viewName === 'history') {
        renderHistory();
      }
    });
  });
}

// Timer controls
function setupTimerControls() {
  const startBtn = document.getElementById('start-btn');
  const pauseBtn = document.getElementById('pause-btn');
  const stopBtn = document.getElementById('stop-btn');

  startBtn.addEventListener('click', () => {
    if (!appState.activeProjectId) {
      alert('Please select a project first');
      return;
    }
    timer.start(appState.activeProjectId);
    updateTimerUI();
  });

  pauseBtn.addEventListener('click', () => {
    timer.pause();
    updateTimerUI();
  });

  stopBtn.addEventListener('click', async () => {
    const elapsed = timer.getElapsedTime();
    const endTime = new Date(Date.now());
    const startTime = new Date(endTime.getTime() - elapsed);

    try {
      await db.createSession(appState.activeProjectId, startTime, endTime);
      
      // Reload projects and update UI
      appState.projects = await db.getProjects();
      appState.sessions = await db.getSessions();
      
      timer.stop();
      updateTimerUI();
      renderProjects();
      
      // Show confirmation
      const project = appState.projects.find(p => p.id === appState.activeProjectId);
      const roundedMins = Math.ceil(elapsed / 300000) * 5;
      alert(`Session saved for "${project.name}": ${roundedMins} minutes`);
    } catch (error) {
      console.error('Failed to save session:', error);
      alert('Failed to save session');
    }
  });

  // Update timer display every 100ms
  timer.onTick = (elapsed) => {
    const timerDisplay = document.getElementById('timer-display');
    timerDisplay.textContent = timer.formatTime(elapsed);
  };
}

// Update timer UI button states
function updateTimerUI() {
  const startBtn = document.getElementById('start-btn');
  const pauseBtn = document.getElementById('pause-btn');
  const stopBtn = document.getElementById('stop-btn');

  if (timer.isRunning) {
    startBtn.disabled = true;
    pauseBtn.disabled = false;
    stopBtn.disabled = false;
  } else if (timer.startTime && !timer.isRunning) {
    // Paused state
    startBtn.disabled = false;
    pauseBtn.disabled = true;
    stopBtn.disabled = false;
    startBtn.textContent = 'Resume';
    timer.resume(); // Auto-resume for now, can be changed to manual
  } else {
    // Stopped state
    startBtn.disabled = false;
    pauseBtn.disabled = true;
    stopBtn.disabled = true;
    startBtn.textContent = 'Start';
    document.getElementById('timer-display').textContent = '00:00:00';
  }
}

// Render projects
async function renderProjects() {
  const projectsList = document.getElementById('projects-list');
  projectsList.innerHTML = '';

  const projects = await db.getProjects();
  
  if (projects.length === 0) {
    projectsList.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #666;">No projects yet. Create one to get started!</p>';
    return;
  }

  projects.forEach(project => {
    const totalSeconds = Math.floor((project.totalTime || 0) / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const timeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

    const card = document.createElement('div');
    card.className = 'project-card';
    if (appState.activeProjectId === project.id) {
      card.classList.add('active');
    }
    card.style.borderLeftColor = project.color;

    const tagsHTML = project.tags && project.tags.length > 0
      ? project.tags.map(tag => `<span class="tag">${tag}</span>`).join('')
      : '';

    card.innerHTML = `
      <div class="project-name">${project.name}</div>
      <div class="project-time">Total: ${timeStr}</div>
      ${tagsHTML ? `<div class="project-tags">${tagsHTML}</div>` : ''}
      <div class="project-actions">
        <button class="project-edit-btn" data-project-id="${project.id}">Edit</button>
        <button class="project-delete-btn" data-project-id="${project.id}">Delete</button>
      </div>
    `;

    // Click to select project for timer
    card.addEventListener('click', (e) => {
      if (e.target.closest('.project-actions')) return; // Don't select on action clicks
      selectProject(project.id);
    });

    projectsList.appendChild(card);
  });

  // Setup action buttons
  document.querySelectorAll('.project-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const projectId = btn.dataset.projectId;
      openProjectModal(projectId);
    });
  });

  document.querySelectorAll('.project-delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const projectId = btn.dataset.projectId;
      if (confirm('Delete this project and all its sessions?')) {
        try {
          const sessions = await db.getSessions({ projectId });
          for (const session of sessions) {
            await db.deleteSession(session.id);
          }
          await db.deleteProject(projectId);
          appState.projects = await db.getProjects();
          appState.sessions = await db.getSessions();
          renderProjects();
        } catch (error) {
          console.error('Failed to delete project:', error);
        }
      }
    });
  });

  // Update timer project name
  const activeProject = projects.find(p => p.id === appState.activeProjectId);
  const timerProjectName = document.getElementById('timer-project-name');
  timerProjectName.textContent = activeProject ? activeProject.name : 'No project selected';
}

// Select a project
async function selectProject(projectId) {
  if (timer.isRunning) {
    if (confirm('Stop current timer and switch to this project?')) {
      // Stop current session first
      const elapsed = timer.getElapsedTime();
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - elapsed);

      try {
        await db.createSession(appState.activeProjectId, startTime, endTime);
        appState.projects = await db.getProjects();
        appState.sessions = await db.getSessions();
      } catch (error) {
        console.error('Failed to save session:', error);
      }

      timer.stop();
      updateTimerUI();
    } else {
      return; // Don't switch
    }
  }

  appState.activeProjectId = projectId;
  renderProjects();
  updateTimerUI();
}

// Project Modal
function setupProjectModal() {
  const modal = document.getElementById('project-modal');
  const closeBtn = document.getElementById('project-modal-close');
  const cancelBtn = document.getElementById('project-cancel-btn');
  const saveBtn = document.getElementById('project-save-btn');
  const nameInput = document.getElementById('project-name');
  const colorInput = document.getElementById('project-color');
  const tagsInput = document.getElementById('project-tags');

  document.getElementById('new-project-btn').addEventListener('click', () => {
    openProjectModal(null);
  });

  closeBtn.addEventListener('click', closeProjectModal);
  cancelBtn.addEventListener('click', closeProjectModal);

  colorInput.addEventListener('change', (e) => {
    document.getElementById('color-preview').style.backgroundColor = e.target.value;
  });

  saveBtn.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    const color = colorInput.value;
    const tags = tagsInput.value.split(',').map(t => t.trim());

    if (!name) {
      alert('Project name is required');
      return;
    }

    try {
      if (editingProjectId) {
        await db.updateProject(editingProjectId, { name, color, tags });
      } else {
        await db.createProject(name, color, tags);
      }

      appState.projects = await db.getProjects();
      renderProjects();
      closeProjectModal();
    } catch (error) {
      console.error('Failed to save project:', error);
      alert('Failed to save project');
    }
  });
}

function openProjectModal(projectId) {
  const modal = document.getElementById('project-modal');
  const titleEl = document.getElementById('project-modal-title');
  const nameInput = document.getElementById('project-name');
  const colorInput = document.getElementById('project-color');
  const tagsInput = document.getElementById('project-tags');
  const deleteBtn = document.getElementById('project-delete-btn');

  editingProjectId = projectId;

  if (projectId) {
    const project = appState.projects.find(p => p.id === projectId);
    titleEl.textContent = 'Edit Project';
    nameInput.value = project.name;
    colorInput.value = project.color;
    tagsInput.value = (project.tags || []).join(', ');
    deleteBtn.style.display = 'inline-block';
    document.getElementById('color-preview').style.backgroundColor = project.color;

    deleteBtn.onclick = async () => {
      if (confirm('Delete this project and all its sessions?')) {
        try {
          const sessions = await db.getSessions({ projectId });
          for (const session of sessions) {
            await db.deleteSession(session.id);
          }
          await db.deleteProject(projectId);
          appState.projects = await db.getProjects();
          appState.sessions = await db.getSessions();
          renderProjects();
          closeProjectModal();
        } catch (error) {
          console.error('Failed to delete project:', error);
        }
      }
    };
  } else {
    titleEl.textContent = 'New Project';
    nameInput.value = '';
    colorInput.value = '#4a90e2';
    tagsInput.value = '';
    deleteBtn.style.display = 'none';
    document.getElementById('color-preview').style.backgroundColor = '#4a90e2';
  }

  modal.classList.add('show');
  modal.style.display = 'flex';
}

function closeProjectModal() {
  const modal = document.getElementById('project-modal');
  modal.classList.remove('show');
  modal.style.display = 'none';
  editingProjectId = null;
}

// History View
async function renderHistory() {
  const sessionsList = document.getElementById('sessions-list');
  const dateFilter = document.getElementById('history-date-filter');
  const projectFilter = document.getElementById('history-project-filter');

  // Setup project filter options
  projectFilter.innerHTML = '<option value="">All Projects</option>';
  (await db.getProjects()).forEach(project => {
    const option = document.createElement('option');
    option.value = project.id;
    option.textContent = project.name;
    projectFilter.appendChild(option);
  });

  // Render sessions
  renderSessionsList();

  dateFilter.addEventListener('change', renderSessionsList);
  projectFilter.addEventListener('change', renderSessionsList);

  async function renderSessionsList() {
    const selectedDate = dateFilter.value;
    const selectedProjectId = projectFilter.value;

    const filters = {};
    if (selectedDate) {
      filters.startDate = selectedDate;
      filters.endDate = selectedDate;
    }
    if (selectedProjectId) {
      filters.projectId = selectedProjectId;
    }

    const sessions = await db.getSessions(filters);
    sessionsList.innerHTML = '';

    if (sessions.length === 0) {
      sessionsList.innerHTML = '<p style="text-align: center; color: #666;">No sessions found.</p>';
      return;
    }

    // Sort sessions by date (newest first)
    sessions.sort((a, b) => {
      const aTime = a.startTime instanceof Date ? a.startTime.getTime() : new Date(a.startTime).getTime();
      const bTime = b.startTime instanceof Date ? b.startTime.getTime() : new Date(b.startTime).getTime();
      return bTime - aTime;
    });

    sessions.forEach(session => {
      const project = appState.projects.find(p => p.id === session.projectId);
      const startTime = session.startTime instanceof Date ? session.startTime : new Date(session.startTime);
      const endTime = session.endTime instanceof Date ? session.endTime : new Date(session.endTime);
      
      const duration = Math.floor((session.duration || 0) / 1000);
      const minutes = Math.floor(duration / 60);
      const durationStr = `${minutes}m`;

      const dateStr = startTime.toLocaleDateString();
      const timeStr = startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const item = document.createElement('div');
      item.className = 'session-item';
      item.style.borderLeftColor = project ? project.color : '#ddd';

      item.innerHTML = `
        <div class="session-header">
          <span class="session-project">${project ? project.name : 'Unknown'}</span>
          <span class="session-date">${dateStr} at ${timeStr}</span>
          <span class="session-duration">${durationStr}</span>
        </div>
        ${session.notes ? `<div class="session-notes">${session.notes}</div>` : ''}
      `;

      item.addEventListener('click', () => {
        openSessionModal(session.id);
      });

      sessionsList.appendChild(item);
    });
  }
}

// Session Modal
function setupSessionModal() {
  const modal = document.getElementById('session-modal');
  const closeBtn = document.getElementById('session-modal-close');
  const cancelBtn = document.getElementById('session-cancel-btn');
  const saveBtn = document.getElementById('session-save-btn');
  const deleteBtn = document.getElementById('session-delete-btn');
  const startInput = document.getElementById('session-start');
  const endInput = document.getElementById('session-end');

  closeBtn.addEventListener('click', closeSessionModal);
  cancelBtn.addEventListener('click', closeSessionModal);

  // Update duration display when times change
  [startInput, endInput].forEach(input => {
    input.addEventListener('change', () => {
      updateSessionDurationDisplay();
    });
  });

  saveBtn.addEventListener('click', async () => {
    const projectId = document.getElementById('session-project').value;
    const startTime = new Date(startInput.value);
    const endTime = new Date(endInput.value);
    const notes = document.getElementById('session-notes').value;

    if (endTime <= startTime) {
      alert('End time must be after start time');
      return;
    }

    try {
      await db.updateSession(editingSessionId, {
        projectId,
        startTime,
        endTime,
        notes
      });

      appState.projects = await db.getProjects();
      appState.sessions = await db.getSessions();
      renderHistory();
      closeSessionModal();
    } catch (error) {
      console.error('Failed to save session:', error);
      alert('Failed to save session');
    }
  });

  deleteBtn.addEventListener('click', async () => {
    if (confirm('Delete this session?')) {
      try {
        await db.deleteSession(editingSessionId);
        appState.projects = await db.getProjects();
        appState.sessions = await db.getSessions();
        renderHistory();
        closeSessionModal();
      } catch (error) {
        console.error('Failed to delete session:', error);
      }
    }
  });
}

function updateSessionDurationDisplay() {
  const startInput = document.getElementById('session-start');
  const endInput = document.getElementById('session-end');
  const durationEl = document.getElementById('session-duration');
  const roundedEl = document.getElementById('session-rounded-duration');

  if (startInput.value && endInput.value) {
    const start = new Date(startInput.value);
    const end = new Date(endInput.value);
    const duration = Math.floor((end.getTime() - start.getTime()) / 1000 / 60);
    const rounded = Math.ceil(duration / 5) * 5;
    
    durationEl.textContent = `${duration} min`;
    roundedEl.textContent = `${rounded} min`;
  }
}

async function openSessionModal(sessionId) {
  const modal = document.getElementById('session-modal');
  const session = await db.getSession(sessionId);
  const projectSelect = document.getElementById('session-project');
  const startInput = document.getElementById('session-start');
  const endInput = document.getElementById('session-end');
  const notesInput = document.getElementById('session-notes');

  editingSessionId = sessionId;

  // Populate project select
  projectSelect.innerHTML = '';
  const projects = await db.getProjects();
  projects.forEach(project => {
    const option = document.createElement('option');
    option.value = project.id;
    option.textContent = project.name;
    projectSelect.appendChild(option);
  });

  // Set values
  projectSelect.value = session.projectId;
  
  const startTime = session.startTime instanceof Date ? session.startTime : new Date(session.startTime);
  const endTime = session.endTime instanceof Date ? session.endTime : new Date(session.endTime);
  
  startInput.value = startTime.toISOString().slice(0, 16);
  endInput.value = endTime.toISOString().slice(0, 16);
  notesInput.value = session.notes || '';

  updateSessionDurationDisplay();
  modal.classList.add('show');
  modal.style.display = 'flex';
}

function closeSessionModal() {
  const modal = document.getElementById('session-modal');
  modal.classList.remove('show');
  modal.style.display = 'none';
  editingSessionId = null;
}

// Settings View
function setupSettingsUI() {
  const showInstallBannerBtn = document.getElementById('show-install-banner-btn');
  const enableRemindersCheckbox = document.getElementById('enable-reminders');
  const reminderTimeInput = document.getElementById('reminder-time');
  const enableIdleCheckbox = document.getElementById('enable-idle-detection');
  const idleThresholdInput = document.getElementById('idle-threshold');
  const exportBtn = document.getElementById('export-btn');
  const importBtn = document.getElementById('import-btn');
  const importFileInput = document.getElementById('import-file');
  const clearBtn = document.getElementById('clear-btn');

  // Show install banner button
  showInstallBannerBtn.addEventListener('click', () => {
    const installBanner = document.getElementById('install-banner');
    localStorage.removeItem('install-banner-dismissed');
    installBanner.style.display = 'flex';
  });

  // Load current settings
  enableRemindersCheckbox.checked = appState.settings.enableReminders;
  reminderTimeInput.value = appState.settings.reminderTime;
  reminderTimeInput.disabled = !appState.settings.enableReminders;
  enableIdleCheckbox.checked = appState.settings.enableIdleDetection;
  idleThresholdInput.value = appState.settings.idleThreshold;

  enableRemindersCheckbox.addEventListener('change', async () => {
    appState.settings.enableReminders = enableRemindersCheckbox.checked;
    reminderTimeInput.disabled = !appState.settings.enableReminders;
    
    // Request notification permission if enabling reminders
    if (appState.settings.enableReminders && 'Notification' in window) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        alert('Notifications permission denied. Reminders will not work.');
      }
    }
    
    await appState.saveSettings();
  });

  reminderTimeInput.addEventListener('change', async () => {
    appState.settings.reminderTime = reminderTimeInput.value;
    await appState.saveSettings();
  });

  enableIdleCheckbox.addEventListener('change', async () => {
    appState.settings.enableIdleDetection = enableIdleCheckbox.checked;
    
    // Request notification permission if enabling idle detection
    if (appState.settings.enableIdleDetection && 'Notification' in window) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        alert('Notifications permission denied. Idle warnings will not work.');
      }
    }
    
    await appState.saveSettings();
  });

  idleThresholdInput.addEventListener('change', async () => {
    appState.settings.idleThreshold = parseInt(idleThresholdInput.value);
    await appState.saveSettings();
  });

  exportBtn.addEventListener('click', async () => {
    try {
      const data = await db.exportData();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `timekeeper-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed');
    }
  });

  importBtn.addEventListener('click', () => {
    importFileInput.click();
  });

  importFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (confirm('This will replace all your current data. Continue?')) {
        await db.importData(data);
        appState.projects = await db.getProjects();
        appState.sessions = await db.getSessions();
        renderProjects();
        alert('Data imported successfully');
      }
    } catch (error) {
      console.error('Import failed:', error);
      alert('Import failed. Make sure the file is valid JSON.');
    }
  });

  clearBtn.addEventListener('click', async () => {
    if (confirm('Delete all data? This cannot be undone!')) {
      if (confirm('Really? All projects and sessions will be deleted.')) {
        try {
          await db.clearAll();
          appState.projects = [];
          appState.sessions = [];
          appState.activeProjectId = null;
          renderProjects();
          alert('All data cleared');
        } catch (error) {
          console.error('Clear failed:', error);
        }
      }
    }
  });
}

// Click outside modals to close
document.addEventListener('click', (e) => {
  const projectModal = document.getElementById('project-modal');
  const sessionModal = document.getElementById('session-modal');

  if (e.target === projectModal) {
    closeProjectModal();
  }
  if (e.target === sessionModal) {
    closeSessionModal();
  }
});
