// Notifications Module - Handles idle detection and reminders

let idleCheckInterval = null;
let reminderCheckInterval = null;
let lastReminderDate = null;

// Initialize notifications
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(initNotifications, 1000); // Wait for app to initialize
});

async function initNotifications() {
  // Request notification permission
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }

  // Start checking for idle and reminders
  startIdleDetection();
  startReminderCheck();
}

// Idle Detection
function startIdleDetection() {
  // Check every 30 seconds
  idleCheckInterval = setInterval(checkIdle, 30000);
}

async function checkIdle() {
  if (!window.appState || !window.timer) return;

  const { enableIdleDetection, idleThreshold } = window.appState.settings;
  
  if (!enableIdleDetection || !window.timer.isRunning) return;

  const elapsedMs = window.timer.getElapsedTime();
  const elapsedMinutes = Math.floor(elapsedMs / 60000);

  if (elapsedMinutes >= idleThreshold) {
    showIdleWarning();
  }
}

async function showIdleWarning() {
  if (!window.timer.isRunning) return; // Already stopped

  const elapsed = window.timer.getElapsedTime();
  const elapsedMinutes = Math.floor(elapsed / 60000);
  const project = window.appState.projects.find(p => p.id === window.timer.activeProjectId);

  // Create modal overlay
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.7);
    z-index: 2000;
    display: flex;
    align-items: center;
    justify-content: center;
  `;

  const modal = document.createElement('div');
  modal.style.cssText = `
    background: white;
    padding: 2rem;
    border-radius: 12px;
    max-width: 400px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    text-align: center;
  `;

  modal.innerHTML = `
    <h2 style="margin-bottom: 1rem; color: #e74c3c;">⏱ Idle Warning</h2>
    <p style="margin-bottom: 1rem; font-size: 1.1rem;">
      The timer for <strong>${project?.name || 'Unknown'}</strong> has been running for <strong>${elapsedMinutes} minutes</strong>.
    </p>
    <p style="margin-bottom: 2rem; color: #666;">
      Do you want to pause the timer?
    </p>
    <div style="display: flex; gap: 1rem;">
      <button id="idle-pause-btn" style="
        flex: 1;
        padding: 0.75rem;
        background-color: #e74c3c;
        color: white;
        border: none;
        border-radius: 6px;
        font-size: 1rem;
        font-weight: 600;
        cursor: pointer;
      ">Pause Timer</button>
      <button id="idle-continue-btn" style="
        flex: 1;
        padding: 0.75rem;
        background-color: #27ae60;
        color: white;
        border: none;
        border-radius: 6px;
        font-size: 1rem;
        font-weight: 600;
        cursor: pointer;
      ">Keep Going</button>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Handle buttons
  const pauseBtn = document.getElementById('idle-pause-btn');
  const continueBtn = document.getElementById('idle-continue-btn');

  pauseBtn.addEventListener('click', () => {
    window.timer.pause();
    updateTimerUI();
    overlay.remove();
    showNotification('Timer Paused', `Timer paused after ${elapsedMinutes} minutes for ${project?.name}.`);
  });

  continueBtn.addEventListener('click', () => {
    overlay.remove();
  });
}

// Daily Reminders
function startReminderCheck() {
  // Check every minute
  reminderCheckInterval = setInterval(checkReminder, 60000);
  // Also check immediately
  checkReminder();
}

async function checkReminder() {
  if (!window.appState) return;

  const { enableReminders, reminderTime } = window.appState.settings;
  
  if (!enableReminders) return;

  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const today = now.toDateString();

  // Only show once per day at the set time
  if (currentTime === reminderTime && lastReminderDate !== today) {
    lastReminderDate = today;
    showReminderNotification();
  }
}

async function showReminderNotification() {
  const message = 'Time to track your work! Start a timer for your current project.';
  showNotification('Daily Reminder - Time Keeper', message);
}

// Show notification
function showNotification(title, message) {
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body: message,
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect fill="%234a90e2" width="192" height="192"/><text x="96" y="130" font-size="120" font-weight="bold" fill="white" text-anchor="middle">⏱</text></svg>',
        badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect fill="%234a90e2" width="192" height="192"/><text x="96" y="130" font-size="120" font-weight="bold" fill="white" text-anchor="middle">⏱</text></svg>'
      });
    } catch (error) {
      console.error('Notification failed:', error);
    }
  }
}

// Clean up on page unload
window.addEventListener('beforeunload', () => {
  if (idleCheckInterval) clearInterval(idleCheckInterval);
  if (reminderCheckInterval) clearInterval(reminderCheckInterval);
});
