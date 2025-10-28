// Enhanced Tab Logger Background Script
class TabLogger {
  constructor() {
    this.activeTabSessions = new Map(); // Track active tab sessions
    this.recentlyLogged = new Map(); // Prevent duplicate logging with cooldown
    this.COOLDOWN_PERIOD = 2000; // 2 seconds cooldown
    this.MAX_STORAGE_SIZE = 10000; // Maximum entries before cleanup
    
    this.init();
  }

  init() {
    // Set up event listeners
    this.setupEventListeners();
    
    // Periodic cleanup every hour
    setInterval(() => this.performMaintenance(), 3600000);
    
    // Initial cleanup on startup
    this.performMaintenance();
  }

  setupEventListeners() {
    // Tab creation
    chrome.tabs.onCreated.addListener((tab) => {
      if (this.shouldLogTab(tab)) {
        setTimeout(() => this.handleTabCreated(tab), 500); // Small delay to ensure URL is available
      }
    });

    // Tab updates (navigation, loading complete)
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (this.shouldLogTab(tab)) {
        this.handleTabUpdated(tabId, changeInfo, tab);
      }
    });

    // Tab activation (switching between tabs)
    chrome.tabs.onActivated.addListener((activeInfo) => {
      chrome.tabs.get(activeInfo.tabId, (tab) => {
        if (!chrome.runtime.lastError && this.shouldLogTab(tab)) {
          this.handleTabActivated(tab);
        }
      });
    });

    // Tab removal (closing tabs)
    chrome.tabs.onRemoved.addListener((tabId) => {
      this.handleTabClosed(tabId);
    });
  }

  shouldLogTab(tab) {
    if (!tab.url) return false;
    
    // Skip system URLs and extensions
    const skipPatterns = [
      'chrome://', 
      'chrome-extension://', 
      'edge://', 
      'about:blank',
      'moz-extension://',
      'safari-extension://'
    ];
    
    return !skipPatterns.some(pattern => tab.url.startsWith(pattern));
  }

  extractDomain(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return 'unknown';
    }
  }

  createTabEntry(tab, event, additionalData = {}) {
    const now = Date.now();
    const domain = this.extractDomain(tab.url);
    
    return {
      id: `${tab.id}-${now}-${event}`,
      tabId: tab.id,
      url: tab.url,
      title: tab.title || 'Loading...',
      domain: domain,
      event: event,
      timestamp: now,
      formattedTime: new Date(now).toLocaleString(),
      sessionId: this.getSessionId(),
      ...additionalData
    };
  }

  getSessionId() {
    // Simple session ID based on browser startup
    if (!this.sessionId) {
      this.sessionId = `session_${Date.now()}`;
    }
    return this.sessionId;
  }

  async logTabEntry(entry) {
    try {
      // Check for recent duplicates
      const recentKey = `${entry.tabId}-${entry.url}-${entry.event}`;
      const lastLogged = this.recentlyLogged.get(recentKey);
      
      if (lastLogged && (Date.now() - lastLogged < this.COOLDOWN_PERIOD)) {
        return; // Skip duplicate within cooldown period
      }
      
      this.recentlyLogged.set(recentKey, Date.now());

      // Get existing logs
      const result = await chrome.storage.local.get({loggedTabs: []});
      const logs = result.loggedTabs;
      
      // Add new entry
      logs.push(entry);
      
      // Check if we need to cleanup old entries
      if (logs.length > this.MAX_STORAGE_SIZE) {
        // Keep only the most recent 80% of entries
        const keepCount = Math.floor(this.MAX_STORAGE_SIZE * 0.8);
        logs.splice(0, logs.length - keepCount);
      }
      
      // Save back to storage
      await chrome.storage.local.set({loggedTabs: logs});
      
    } catch (error) {
      console.error('Failed to log tab entry:', error);
    }
  }

  handleTabCreated(tab) {
    const entry = this.createTabEntry(tab, 'opened');
    this.logTabEntry(entry);
    
    // Start tracking session time
    this.activeTabSessions.set(tab.id, Date.now());
  }

  handleTabUpdated(tabId, changeInfo, tab) {
    // Log when page finishes loading
    if (changeInfo.status === 'complete') {
      const entry = this.createTabEntry(tab, 'loaded');
      this.logTabEntry(entry);
    }
    
    // Log URL changes (navigation within same tab)
    if (changeInfo.url && changeInfo.url !== tab.url) {
      const entry = this.createTabEntry(tab, 'navigated', {
        previousUrl: changeInfo.url
      });
      this.logTabEntry(entry);
    }
  }

  handleTabActivated(tab) {
    const sessionStart = this.activeTabSessions.get(tab.id) || Date.now();
    const entry = this.createTabEntry(tab, 'focused', {
      sessionDuration: Date.now() - sessionStart
    });
    
    this.logTabEntry(entry);
    
    // Update session tracking
    this.activeTabSessions.set(tab.id, Date.now());
  }

  handleTabClosed(tabId) {
    // Calculate session duration if we were tracking this tab
    const sessionStart = this.activeTabSessions.get(tabId);
    if (sessionStart) {
      const duration = Date.now() - sessionStart;
      
      // Create a close event (we don't have the tab object, so limited info)
      const entry = {
        id: `${tabId}-${Date.now()}-closed`,
        tabId: tabId,
        event: 'closed',
        timestamp: Date.now(),
        formattedTime: new Date().toLocaleString(),
        sessionDuration: duration,
        sessionId: this.getSessionId()
      };
      
      this.logTabEntry(entry);
      this.activeTabSessions.delete(tabId);
    }
    
    // Clean up recent logging tracking
    for (const [key] of this.recentlyLogged) {
      if (key.startsWith(`${tabId}-`)) {
        this.recentlyLogged.delete(key);
      }
    }
  }

  performMaintenance() {
    // Clean up old entries from recent logging map
    const cutoff = Date.now() - (this.COOLDOWN_PERIOD * 10); // Keep 10x cooldown period
    for (const [key, timestamp] of this.recentlyLogged) {
      if (timestamp < cutoff) {
        this.recentlyLogged.delete(key);
      }
    }

    // Clean up orphaned tab sessions
    chrome.tabs.query({}, (tabs) => {
      const activeTabs = new Set(tabs.map(tab => tab.id));
      for (const [tabId] of this.activeTabSessions) {
        if (!activeTabs.has(tabId)) {
          this.activeTabSessions.delete(tabId);
        }
      }
    });

    // Perform storage maintenance
    this.maintainStorage();
  }

  async maintainStorage() {
    try {
      const result = await chrome.storage.local.get(['loggedTabs', 'userSettings']);
      const logs = result.loggedTabs || [];
      const settings = result.userSettings || {};

      // Clean up based on retention policy
      const retentionDays = settings.retentionDays || 90;
      const cutoffDate = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
      
      const filteredLogs = logs.filter(entry => entry.timestamp > cutoffDate);
      
      if (filteredLogs.length !== logs.length) {
        await chrome.storage.local.set({loggedTabs: filteredLogs});
        console.log(`Cleaned up ${logs.length - filteredLogs.length} old log entries`);
      }
    } catch (error) {
      console.error('Storage maintenance failed:', error);
    }
  }
}

// Initialize the logger
const tabLogger = new TabLogger();