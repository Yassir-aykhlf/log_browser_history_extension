// Enhanced Tab Logger Popup Script
class TabLoggerUI {
  constructor() {
    this.allTabs = [];
    this.filteredTabs = [];
    this.currentPage = 1;
    this.itemsPerPage = 20;
    this.currentTab = 'logs';
    
    this.init();
  }

  async init() {
    await this.loadTabs();
    this.setupEventListeners();
    this.renderTabs();
    this.updateStats();
  }

  async loadTabs() {
    try {
      const result = await chrome.storage.local.get({loggedTabs: []});
      this.allTabs = result.loggedTabs || [];
      this.filteredTabs = [...this.allTabs];
      this.sortTabs();
    } catch (error) {
      console.error('Failed to load tabs:', error);
      this.allTabs = [];
      this.filteredTabs = [];
    }
  }

  setupEventListeners() {
    // Tab navigation
    document.querySelectorAll('.tab-nav-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tabName = e.target.dataset.tab;
        this.switchTab(tabName);
      });
    });

    // Search functionality
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', (e) => {
      this.handleSearch(e.target.value);
    });

    // Filter dropdowns
    document.getElementById('eventFilter').addEventListener('change', () => this.applyFilters());
    document.getElementById('timeFilter').addEventListener('change', () => this.applyFilters());
    document.getElementById('sortFilter').addEventListener('change', () => this.applyFilters());

    // Action buttons
    document.getElementById('exportBtn').addEventListener('click', () => this.handleExport());
    document.getElementById('clearBtn').addEventListener('click', () => this.handleClear());
    document.getElementById('refreshBtn').addEventListener('click', () => this.handleRefresh());
    document.getElementById('analyticsBtn').addEventListener('click', () => this.switchTab('analytics'));

    // Pagination
    document.getElementById('prevBtn').addEventListener('click', () => this.previousPage());
    document.getElementById('nextBtn').addEventListener('click', () => this.nextPage());
  }

  switchTab(tabName) {
    // Update nav
    document.querySelectorAll('.tab-nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Show/hide content
    document.getElementById('logsTab').style.display = tabName === 'logs' ? 'block' : 'none';
    document.getElementById('analyticsTab').style.display = tabName === 'analytics' ? 'block' : 'none';

    this.currentTab = tabName;

    if (tabName === 'analytics') {
      this.renderAnalytics();
    }
  }

  handleSearch(query) {
    const searchTerm = query.toLowerCase().trim();
    
    if (!searchTerm) {
      this.filteredTabs = [...this.allTabs];
    } else {
      this.filteredTabs = this.allTabs.filter(tab => 
        (tab.url && tab.url.toLowerCase().includes(searchTerm)) ||
        (tab.title && tab.title.toLowerCase().includes(searchTerm)) ||
        (tab.domain && tab.domain.toLowerCase().includes(searchTerm))
      );
    }
    
    this.applyFilters();
  }

  applyFilters() {
    let filtered = [...this.filteredTabs];

    // Event filter
    const eventFilter = document.getElementById('eventFilter').value;
    if (eventFilter) {
      filtered = filtered.filter(tab => tab.event === eventFilter);
    }

    // Time filter
    const timeFilter = document.getElementById('timeFilter').value;
    if (timeFilter) {
      const now = new Date();
      let cutoff;
      
      switch (timeFilter) {
        case 'today':
          cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          cutoff = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
          break;
        case 'month':
          cutoff = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
      }
      
      if (cutoff) {
        filtered = filtered.filter(tab => new Date(tab.timestamp) >= cutoff);
      }
    }

    this.filteredTabs = filtered;
    this.sortTabs();
    this.currentPage = 1;
    this.renderTabs();
    this.updateStats();
  }

  sortTabs() {
    const sortBy = document.getElementById('sortFilter').value;
    
    switch (sortBy) {
      case 'newest':
        this.filteredTabs.sort((a, b) => b.timestamp - a.timestamp);
        break;
      case 'oldest':
        this.filteredTabs.sort((a, b) => a.timestamp - b.timestamp);
        break;
      case 'domain':
        this.filteredTabs.sort((a, b) => {
          const domainA = a.domain || '';
          const domainB = b.domain || '';
          return domainA.localeCompare(domainB);
        });
        break;
      default:
        this.filteredTabs.sort((a, b) => b.timestamp - a.timestamp);
    }
  }

  renderTabs() {
    const loading = document.getElementById('loading');
    const tabList = document.getElementById('tabList');
    const emptyState = document.getElementById('emptyState');
    
    // Hide loading
    loading.style.display = 'none';

    if (this.filteredTabs.length === 0) {
      tabList.style.display = 'none';
      emptyState.style.display = 'block';
      this.updatePagination();
      return;
    }

    emptyState.style.display = 'none';
    tabList.style.display = 'block';

    // Calculate pagination
    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    const pageItems = this.filteredTabs.slice(start, end);

    // Clear existing items
    tabList.innerHTML = '';

    // Render items
    pageItems.forEach(tab => {
      const listItem = this.createTabListItem(tab);
      tabList.appendChild(listItem);
    });

    this.updatePagination();
  }

  createTabListItem(tab) {
    const li = document.createElement('li');
    li.className = 'tab-item';

    const eventClass = `event-${tab.event || 'opened'}`;
    const timeAgo = this.getTimeAgo(tab.timestamp);
    const domain = tab.domain || this.extractDomain(tab.url);
    
    li.innerHTML = `
      <div class="tab-header">
        <span class="event-badge ${eventClass}">${tab.event || 'opened'}</span>
        <span class="tab-time">${timeAgo}</span>
      </div>
      <a href="${tab.url}" target="_blank" class="tab-url" title="${tab.url}">
        ${this.truncateUrl(tab.url, 60)}
      </a>
      <div class="tab-title" title="${tab.title || 'No title'}">
        ${tab.title || 'No title'}
      </div>
      <div class="tab-meta">
        <span>📍 ${domain}</span>
        ${tab.sessionDuration ? `<span>⏱️ ${this.formatDuration(tab.sessionDuration)}</span>` : ''}
        ${tab.formattedTime ? `<span>🕐 ${tab.formattedTime}</span>` : ''}
      </div>
    `;

    return li;
  }

  updatePagination() {
    const totalPages = Math.ceil(this.filteredTabs.length / this.itemsPerPage);
    const start = (this.currentPage - 1) * this.itemsPerPage + 1;
    const end = Math.min(start + this.itemsPerPage - 1, this.filteredTabs.length);

    document.getElementById('showingCount').textContent = 
      this.filteredTabs.length === 0 ? '0' : `${start}-${end}`;
    document.getElementById('totalCount').textContent = this.filteredTabs.length;
    document.getElementById('pageInfo').textContent = `Page ${this.currentPage} of ${totalPages || 1}`;

    // Update button states
    document.getElementById('prevBtn').classList.toggle('disabled', this.currentPage <= 1);
    document.getElementById('nextBtn').classList.toggle('disabled', this.currentPage >= totalPages);
  }

  previousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.renderTabs();
    }
  }

  nextPage() {
    const totalPages = Math.ceil(this.filteredTabs.length / this.itemsPerPage);
    if (this.currentPage < totalPages) {
      this.currentPage++;
      this.renderTabs();
    }
  }

  updateStats() {
    const total = this.allTabs.length;
    const today = this.getTodayCount();
    const domains = this.getUniqueDomains().size;

    document.getElementById('totalTabs').textContent = `${total} tabs logged`;
    document.getElementById('todayTabs').textContent = `${today} today`;
    document.getElementById('activeDomains').textContent = `${domains} domains`;
  }

  getTodayCount() {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    
    return this.allTabs.filter(tab => tab.timestamp >= startOfDay).length;
  }

  getUniqueDomains() {
    const domains = new Set();
    this.allTabs.forEach(tab => {
      if (tab.domain) {
        domains.add(tab.domain);
      } else if (tab.url) {
        domains.add(this.extractDomain(tab.url));
      }
    });
    return domains;
  }

  renderAnalytics() {
    const uniqueDomains = this.getUniqueDomains();
    const todayCount = this.getTodayCount();
    
    // Calculate average per day
    const oldestTab = this.allTabs.reduce((oldest, tab) => 
      tab.timestamp < oldest ? tab.timestamp : oldest, Date.now());
    const daysSinceFirst = Math.max(1, Math.ceil((Date.now() - oldestTab) / (24 * 60 * 60 * 1000)));
    const avgPerDay = Math.round(this.allTabs.length / daysSinceFirst);

    // Update analytics stats
    document.getElementById('totalTabsAnalytics').textContent = this.allTabs.length;
    document.getElementById('uniqueDomainsAnalytics').textContent = uniqueDomains.size;
    document.getElementById('todayTabsAnalytics').textContent = todayCount;
    document.getElementById('avgPerDayAnalytics').textContent = avgPerDay;

    // Top domains
    this.renderTopDomains();
  }

  renderTopDomains() {
    const domainCounts = {};
    
    this.allTabs.forEach(tab => {
      const domain = tab.domain || this.extractDomain(tab.url);
      domainCounts[domain] = (domainCounts[domain] || 0) + 1;
    });

    const sortedDomains = Object.entries(domainCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10);

    const container = document.getElementById('topDomainsList');
    container.innerHTML = '';

    if (sortedDomains.length === 0) {
      container.innerHTML = '<div style="text-align: center; color: #6c757d; padding: 20px;">No domains to show</div>';
      return;
    }

    sortedDomains.forEach(([domain, count]) => {
      const item = document.createElement('div');
      item.className = 'domain-item';
      item.innerHTML = `
        <span class="domain-name">${domain}</span>
        <span class="domain-count">${count}</span>
      `;
      container.appendChild(item);
    });
  }

  async handleExport() {
    try {
      const exportData = this.filteredTabs.map(tab => ({
        Timestamp: tab.formattedTime || new Date(tab.timestamp).toLocaleString(),
        Event: tab.event || 'opened',
        URL: tab.url || '',
        Title: tab.title || '',
        Domain: tab.domain || this.extractDomain(tab.url),
        'Session Duration': tab.sessionDuration ? this.formatDuration(tab.sessionDuration) : '',
        'Session ID': tab.sessionId || ''
      }));

      // Create CSV content
      const headers = Object.keys(exportData[0] || {});
      let csvContent = headers.join(',') + '\n';
      
      exportData.forEach(row => {
        const values = headers.map(header => {
          const value = row[header] || '';
          // Escape quotes and wrap in quotes if contains comma
          const escapedValue = String(value).replace(/"/g, '""');
          return escapedValue.includes(',') ? `"${escapedValue}"` : escapedValue;
        });
        csvContent += values.join(',') + '\n';
      });

      // Create and trigger download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      
      const filename = `tab_log_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`;
      
      await chrome.downloads.download({
        url: url,
        filename: filename,
        saveAs: true
      });

      // Clean up
      URL.revokeObjectURL(url);
      
      // Show success feedback
      this.showNotification('Export completed successfully!', 'success');
      
    } catch (error) {
      console.error('Export failed:', error);
      this.showNotification('Export failed. Please try again.', 'error');
    }
  }

  async handleClear() {
    if (!confirm('Are you sure you want to clear all logged tabs? This action cannot be undone.')) {
      return;
    }

    try {
      await chrome.storage.local.set({loggedTabs: []});
      this.allTabs = [];
      this.filteredTabs = [];
      this.currentPage = 1;
      
      this.renderTabs();
      this.updateStats();
      
      this.showNotification('All logs cleared successfully!', 'success');
      
    } catch (error) {
      console.error('Clear failed:', error);
      this.showNotification('Failed to clear logs. Please try again.', 'error');
    }
  }

  async handleRefresh() {
    const refreshBtn = document.getElementById('refreshBtn');
    refreshBtn.style.transform = 'rotate(180deg)';
    
    await this.loadTabs();
    this.applyFilters();
    this.updateStats();
    
    setTimeout(() => {
      refreshBtn.style.transform = 'rotate(0deg)';
    }, 300);
  }

  showNotification(message, type = 'info') {
    // Simple notification system
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      padding: 12px 16px;
      background: ${type === 'success' ? '#51cf66' : type === 'error' ? '#ff6b6b' : '#667eea'};
      color: white;
      border-radius: 6px;
      font-size: 12px;
      z-index: 1000;
      animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }

  // Utility functions
  extractDomain(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return 'unknown';
    }
  }

  truncateUrl(url, maxLength) {
    if (!url || url.length <= maxLength) return url;
    return url.substring(0, maxLength - 3) + '...';
  }

  getTimeAgo(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    
    const minute = 60 * 1000;
    const hour = minute * 60;
    const day = hour * 24;
    const week = day * 7;
    
    if (diff < minute) return 'Just now';
    if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
    if (diff < day) return `${Math.floor(diff / hour)}h ago`;
    if (diff < week) return `${Math.floor(diff / day)}d ago`;
    return `${Math.floor(diff / week)}w ago`;
  }

  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }
}

// Initialize the UI when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new TabLoggerUI();
});

// Add CSS animation for notifications
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
`;
document.head.appendChild(style);