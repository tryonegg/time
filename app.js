// Database setup
class TimeKeeperDB {
  constructor() {
    this.db = null;
    this.init();
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('TimeKeeperDB', 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Projects store
        if (!db.objectStoreNames.contains('projects')) {
          const projectStore = db.createObjectStore('projects', { keyPath: 'id' });
          projectStore.createIndex('name', 'name', { unique: false });
          projectStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // Time sessions store
        if (!db.objectStoreNames.contains('sessions')) {
          const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' });
          sessionStore.createIndex('projectId', 'projectId', { unique: false });
          sessionStore.createIndex('startTime', 'startTime', { unique: false });
          sessionStore.createIndex('endTime', 'endTime', { unique: false });
        }

        // Settings store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };
    });
  }

  // Projects
  async createProject(name, color, tags = []) {
    const project = {
      id: Date.now().toString(),
      name,
      color,
      tags: tags.filter(t => t.trim()),
      createdAt: new Date(),
      totalTime: 0 // in milliseconds
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['projects'], 'readwrite');
      const store = transaction.objectStore('projects');
      const request = store.add(project);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(project);
    });
  }

  async getProjects() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['projects'], 'readonly');
      const store = transaction.objectStore('projects');
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || []);
    });
  }

  async getProject(id) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['projects'], 'readonly');
      const store = transaction.objectStore('projects');
      const request = store.get(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async updateProject(id, updates) {
    const project = await this.getProject(id);
    const updated = { ...project, ...updates };

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['projects'], 'readwrite');
      const store = transaction.objectStore('projects');
      const request = store.put(updated);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(updated);
    });
  }

  async deleteProject(id) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['projects'], 'readwrite');
      const store = transaction.objectStore('projects');
      const request = store.delete(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  // Time Sessions
  async createSession(projectId, startTime, endTime, notes = '') {
    const duration = endTime.getTime() - startTime.getTime();
    const roundedDuration = Math.ceil(duration / 300000) * 300000; // Round to nearest 5 min
    const roundedEndTime = new Date(startTime.getTime() + roundedDuration);

    const session = {
      id: Date.now().toString() + Math.random(),
      projectId,
      startTime,
      endTime: roundedEndTime,
      duration: roundedDuration,
      notes,
      createdAt: new Date(),
      editedAt: new Date()
    };

    return new Promise(async (resolve, reject) => {
      try {
        // Add session
        const transaction = this.db.transaction(['sessions'], 'readwrite');
        const sessionStore = transaction.objectStore('sessions');
        await new Promise((res, rej) => {
          const request = sessionStore.add(session);
          request.onerror = () => rej(request.error);
          request.onsuccess = () => res();
        });

        // Update project's total time (separate transaction)
        const project = await this.getProject(projectId);
        project.totalTime = (project.totalTime || 0) + roundedDuration;
        await this.updateProject(projectId, { totalTime: project.totalTime });

        resolve(session);
      } catch (error) {
        reject(error);
      }
    });
  }

  async getSessions(filters = {}) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['sessions'], 'readonly');
      const store = transaction.objectStore('sessions');
      let request;

      if (filters.projectId) {
        const index = store.index('projectId');
        request = index.getAll(filters.projectId);
      } else {
        request = store.getAll();
      }

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        let sessions = request.result || [];

        // Apply date range filter
        if (filters.startDate || filters.endDate) {
          const start = filters.startDate ? new Date(filters.startDate).getTime() : 0;
          const end = filters.endDate ? new Date(filters.endDate).getTime() + 86400000 : Infinity;
          sessions = sessions.filter(s => {
            const sTime = s.startTime instanceof Date ? s.startTime.getTime() : new Date(s.startTime).getTime();
            return sTime >= start && sTime < end;
          });
        }

        resolve(sessions);
      };
    });
  }

  async getSession(id) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['sessions'], 'readonly');
      const store = transaction.objectStore('sessions');
      const request = store.get(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async updateSession(id, updates) {
    const session = await this.getSession(id);
    const oldDuration = session.duration;
    
    let newDuration = oldDuration;
    let newEndTime = session.endTime;
    
    // Recalculate duration and apply rounding if times changed
    if (updates.startTime || updates.endTime) {
      const start = updates.startTime || session.startTime;
      const end = updates.endTime || session.endTime;
      const startTime = start instanceof Date ? start : new Date(start);
      const endTime = end instanceof Date ? end : new Date(end);
      
      const rawDuration = endTime.getTime() - startTime.getTime();
      newDuration = Math.ceil(rawDuration / 300000) * 300000; // Round to nearest 5 min
      newEndTime = new Date(startTime.getTime() + newDuration);
    }

    const updated = {
      ...session,
      ...updates,
      endTime: newEndTime,
      duration: newDuration,
      editedAt: new Date()
    };

    return new Promise(async (resolve, reject) => {
      try {
        // Update session
        const transaction = this.db.transaction(['sessions'], 'readwrite');
        const sessionStore = transaction.objectStore('sessions');
        await new Promise((res, rej) => {
          const request = sessionStore.put(updated);
          request.onerror = () => rej(request.error);
          request.onsuccess = () => res();
        });

        // Update project's total time (separate transaction)
        const project = await this.getProject(session.projectId);
        const timeDiff = newDuration - oldDuration;
        project.totalTime = (project.totalTime || 0) + timeDiff;
        await this.updateProject(session.projectId, { totalTime: project.totalTime });

        resolve(updated);
      } catch (error) {
        reject(error);
      }
    });
  }

  async deleteSession(id) {
    const session = await this.getSession(id);
    
    return new Promise(async (resolve, reject) => {
      try {
        // Delete session
        const transaction = this.db.transaction(['sessions'], 'readwrite');
        const sessionStore = transaction.objectStore('sessions');
        await new Promise((res, rej) => {
          const request = sessionStore.delete(id);
          request.onerror = () => rej(request.error);
          request.onsuccess = () => res();
        });

        // Update project's total time (separate transaction)
        const project = await this.getProject(session.projectId);
        project.totalTime = Math.max(0, (project.totalTime || 0) - session.duration);
        await this.updateProject(session.projectId, { totalTime: project.totalTime });

        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  // Settings
  async getSetting(key) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['settings'], 'readonly');
      const store = transaction.objectStore('settings');
      const request = store.get(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result?.value);
    });
  }

  async setSetting(key, value) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['settings'], 'readwrite');
      const store = transaction.objectStore('settings');
      const request = store.put({ key, value });

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(value);
    });
  }

  // Export/Import
  async exportData() {
    const projects = await this.getProjects();
    const sessions = await this.getSessions();
    const settings = {
      enableReminders: await this.getSetting('enableReminders'),
      reminderTime: await this.getSetting('reminderTime'),
      enableIdleDetection: await this.getSetting('enableIdleDetection'),
      idleThreshold: await this.getSetting('idleThreshold')
    };

    return {
      version: '1.0',
      exportDate: new Date().toISOString(),
      projects,
      sessions: sessions.map(s => ({
        ...s,
        startTime: s.startTime instanceof Date ? s.startTime.toISOString() : s.startTime,
        endTime: s.endTime instanceof Date ? s.endTime.toISOString() : s.endTime,
        createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
        editedAt: s.editedAt instanceof Date ? s.editedAt.toISOString() : s.editedAt
      })),
      settings
    };
  }

  async importData(data) {
    // Clear existing data
    await this.clearAll();

    // Import projects
    for (const project of data.projects || []) {
      const { id, ...projectData } = project;
      await this.createProject(projectData.name, projectData.color, projectData.tags);
    }

    // Import sessions
    for (const session of data.sessions || []) {
      const { id, ...sessionData } = session;
      const startTime = new Date(sessionData.startTime);
      const endTime = new Date(sessionData.endTime);
      await this.createSession(sessionData.projectId, startTime, endTime, sessionData.notes);
    }

    // Import settings
    if (data.settings) {
      for (const [key, value] of Object.entries(data.settings)) {
        await this.setSetting(key, value);
      }
    }
  }

  async clearAll() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['projects', 'sessions', 'settings'], 'readwrite');
      
      transaction.objectStore('projects').clear();
      transaction.objectStore('sessions').clear();
      transaction.objectStore('settings').clear();

      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => resolve();
    });
  }
}

// Timer Manager
class TimerManager {
  constructor() {
    this.activeProjectId = null;
    this.startTime = null;
    this.pausedTime = null;
    this.isRunning = false;
    this.animationId = null;
    this.onTick = null;
  }

  start(projectId) {
    this.activeProjectId = projectId;
    this.startTime = new Date();
    this.pausedTime = null;
    this.isRunning = true;
    this._tick();
  }

  pause() {
    this.isRunning = false;
    this.pausedTime = this.getElapsedTime();
  }

  resume() {
    this.isRunning = true;
    this.startTime = new Date(Date.now() - this.pausedTime);
    this._tick();
  }

  stop() {
    this.isRunning = false;
    this.activeProjectId = null;
    this.startTime = null;
    this.pausedTime = null;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  getElapsedTime() {
    if (!this.isRunning && this.pausedTime) return this.pausedTime;
    if (!this.startTime) return 0;
    return new Date().getTime() - this.startTime.getTime();
  }

  _tick() {
    if (this.onTick) {
      this.onTick(this.getElapsedTime());
    }
    if (this.isRunning) {
      this.animationId = requestAnimationFrame(() => this._tick());
    }
  }

  formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
}

// App State
class AppState {
  constructor() {
    this.projects = [];
    this.sessions = [];
    this.activeProjectId = null;
    this.currentSession = null;
    this.settings = {
      enableReminders: false,
      reminderTime: '09:00',
      enableIdleDetection: false,
      idleThreshold: 180 // minutes
    };
  }

  async loadAll() {
    this.projects = await db.getProjects();
    this.sessions = await db.getSessions();
    
    // Load settings
    this.settings.enableReminders = await db.getSetting('enableReminders') || false;
    this.settings.reminderTime = await db.getSetting('reminderTime') || '09:00';
    this.settings.enableIdleDetection = await db.getSetting('enableIdleDetection') || false;
    this.settings.idleThreshold = await db.getSetting('idleThreshold') || 180;
  }

  async saveSettings() {
    await db.setSetting('enableReminders', this.settings.enableReminders);
    await db.setSetting('reminderTime', this.settings.reminderTime);
    await db.setSetting('enableIdleDetection', this.settings.enableIdleDetection);
    await db.setSetting('idleThreshold', this.settings.idleThreshold);
  }
}

// Global instances
let db;
let timer;
let appState;

// Initialize app
async function initApp() {
  try {
    // Initialize database
    db = new TimeKeeperDB();
    await db.init();

    // Initialize timer and state
    timer = new TimerManager();
    appState = new AppState();
    await appState.loadAll();

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(err => 
        console.log('Service Worker registration failed:', err)
      );
    }

    console.log('App initialized successfully');
  } catch (error) {
    console.error('Failed to initialize app:', error);
  }
}

// Export for other modules
window.db = db;
window.timer = timer;
window.appState = appState;

// Placeholder functions to be defined in ui.js
window.initUI = function() {};
window.renderProjects = async function() {};

// Start app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', async () => {
    await initApp();
    // Call UI initialization after all scripts are loaded
    setTimeout(() => {
      if (window.initUI) {
        window.initUI();
        window.renderProjects();
      }
    }, 100);
  });
} else {
  initApp().then(() => {
    setTimeout(() => {
      if (window.initUI) {
        window.initUI();
        window.renderProjects();
      }
    }, 100);
  });
}
