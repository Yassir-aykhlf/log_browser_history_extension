// Settings Management
class SettingsManager {
  constructor() {
    this.defaultSettings = {
      enableLogging: true,
      logIncognito: false,
      trackTime: true,
      minSessionTime: 5,
      retentionDays: 90,
      maxEntries: 10000,
      enableFiltering: false,
      excludedSites: [],
      exportFormat: 'csv',
      includeMetadata: true
    };
    
    this.init();
  }

  async init() {
    await this.loadSettings();
    this.setupEventListeners();
    this.updateStorageInfo();
    setInterval(() => this.updateStorageInfo(), 5000); // Update every 5 seconds
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.local.get(['userSettings']);
      this.settings = { ...this.defaultSettings, ...result.userSettings };
      this.updateUI();
    } catch (error) {
      console.error('Failed to load settings:', error);
      this.settings = { ...this.defaultSettings };
    }
  }

  setupEventListeners() {
    // Toggle switches
    document.querySelectorAll('.toggle-switch').forEach(toggle => {
      toggle.addEventListener('click', () => {
        toggle.classList.toggle('active');
        this.handleToggleChange(toggle.id, toggle.classList.contains('active'));
      });
    });

    // Number and select inputs
    document.getElementById('minSessionTime').addEventListener('change', (e) => {
      this.settings.minSessionTime = parseInt(e.target.value);
    });

    document.getElementById('retentionDays').addEventListener('change', (e) => {
      this.settings.retentionDays = parseInt(e.target.value);
    });

    document.getElementById('maxEntries').addEventListener('change', (e) => {
      this.settings.maxEntries = parseInt(e.target.value);
    });

    document.getElementById('exportFormat').addEventListener('change', (e) => {
      this.settings.exportFormat = e.target.value;
    });

    // Enter key for adding sites
    document.getElementById('newSiteInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.addExcludedSite();