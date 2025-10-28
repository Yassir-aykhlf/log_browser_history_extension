class TabLoggerUI {
  constructor() {
    this.allTabs = [];
    this.filteredTabs = [];
    this.searchResults = [];
    this.currentPage = 1;
    this.itemsPerPage = 20;
    this.currentTab = 'logs';

    this.init();
  }

  async init() {
    await this.loadTabs();
    this.setupEventListeners();
    this.applyFilters();
    this.renderTabs();
    this.updateStats();
  }

  async loadTabs() {
    try {
      const result = await chrome.storage.local.get({ loggedTabs: [] });
      const rawTabs = Array.isArray(result.loggedTabs) ? result.loggedTabs : [];
      this.allTabs = rawTabs.map(entry => this.normalizeEntry(entry));
      this.searchResults = [...this.allTabs];
      this.filteredTabs = [...this.allTabs];
      this.sortTabs();
    } catch (error) {
      console.error('Failed to load tabs:', error);
      this.allTabs = [];
      this.filteredTabs = [];
      this.searchResults = [];
    }
  }

  normalizeEntry(entry) {
    const normalized = { ...entry };
    const timestampCandidate = normalized.timestamp ?? normalized.timestampMs ?? normalized.time;
    let timestamp = typeof timestampCandidate === 'number' ? timestampCandidate : Number(timestampCandidate);

    if (!Number.isFinite(timestamp)) {
      const parsedFormatted = Date.parse(normalized.formattedTime || '');
      const parsedString = Date.parse(normalized.timestampString || normalized.timestamp);
      timestamp = Number.isFinite(parsedFormatted) ? parsedFormatted : parsedString;
    }

    if (!Number.isFinite(timestamp)) {
      timestamp = Date.now();
    }

    normalized.timestamp = timestamp;
    normalized.formattedTime = normalized.formattedTime || new Date(timestamp).toLocaleString();
    normalized.event = normalized.event || 'opened';
    normalized.url = normalized.url || '';
    normalized.title = normalized.title || 'No title';
    normalized.domain = normalized.domain || this.extractDomain(normalized.url);

    return normalized;
  }

  setupEventListeners() {
    document.querySelectorAll('.tab-nav-item').forEach(button => {
      button.addEventListener('click', e => {
        const tabName = e.currentTarget.dataset.tab;
        this.switchTab(tabName);
      });
    });

    document.getElementById('searchInput').addEventListener('input', e => {
      this.handleSearch(e.target.value);
    });

    document.getElementById('eventFilter').addEventListener('change', () => this.applyFilters());
    document.getElementById('timeFilter').addEventListener('change', () => this.applyFilters());
    document.getElementById('sortFilter').addEventListener('change', () => this.applyFilters());

    document.getElementById('exportBtn').addEventListener('click', () => this.handleExport());
    document.getElementById('clearBtn').addEventListener('click', () => this.handleClear());
    document.getElementById('refreshBtn').addEventListener('click', () => this.handleRefresh());

    document.getElementById('prevBtn').addEventListener('click', () => this.previousPage());
    document.getElementById('nextBtn').addEventListener('click', () => this.nextPage());
  }

  switchTab(tabName) {
    document.querySelectorAll('.tab-nav-item').forEach(button => {
      button.classList.toggle('active', button.dataset.tab === tabName);
    });

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
      this.searchResults = [...this.allTabs];
    } else {
      this.searchResults = this.allTabs.filter(tab =>
        (tab.url && tab.url.toLowerCase().includes(searchTerm)) ||
        (tab.title && tab.title.toLowerCase().includes(searchTerm)) ||
        (tab.domain && tab.domain.toLowerCase().includes(searchTerm))
      );
    }

    this.applyFilters();
  }

  applyFilters() {
    let filtered = [...this.searchResults];

    const eventFilter = document.getElementById('eventFilter').value;
    if (eventFilter) {
      filtered = filtered.filter(tab => tab.event === eventFilter);
    }

    const timeFilter = document.getElementById('timeFilter').value;
    if (timeFilter) {
      const now = Date.now();
      let cutoff = null;

      if (timeFilter === 'today') {
        const today = new Date();
        cutoff = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
      } else if (timeFilter === 'week') {
        cutoff = now - 7 * 24 * 60 * 60 * 1000;
      } else if (timeFilter === 'month') {
        const current = new Date();
        cutoff = new Date(current.getFullYear(), current.getMonth(), 1).getTime();
      }

      if (cutoff) {
        filtered = filtered.filter(tab => tab.timestamp >= cutoff);
      }
    }

    this.filteredTabs = filtered;
    this.sortTabs();
    this.currentPage = 1;
    this.renderTabs();
    this.updateStats();
  }

  sortTabs() {
    const sortSelect = document.getElementById('sortFilter');
    const sortBy = sortSelect ? sortSelect.value : 'newest';

    if (sortBy === 'oldest') {
      this.filteredTabs.sort((a, b) => a.timestamp - b.timestamp);
    } else if (sortBy === 'domain') {
      this.filteredTabs.sort((a, b) => (a.domain || '').localeCompare(b.domain || ''));
    } else {
      this.filteredTabs.sort((a, b) => b.timestamp - a.timestamp);
    }
  }

  renderTabs() {
    const loading = document.getElementById('loading');
    const tabList = document.getElementById('tabList');
    const emptyState = document.getElementById('emptyState');

    if (loading) {
      loading.style.display = 'none';
    }

    if (this.filteredTabs.length === 0) {
      tabList.style.display = 'none';
      emptyState.style.display = 'block';
      this.updatePagination();
      return;
    }

    emptyState.style.display = 'none';
    tabList.style.display = 'block';
    tabList.innerHTML = '';

    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    const pageItems = this.filteredTabs.slice(start, end);

    pageItems.forEach(tab => {
      const item = this.createTabListItem(tab);
      tabList.appendChild(item);
    });

    this.updatePagination();
  }

  createTabListItem(tab) {
    const li = document.createElement('li');
    li.className = 'tab-item';

    const eventClass = `event-${tab.event || 'opened'}`;
    const timeAgo = this.getTimeAgo(tab.timestamp);

    li.innerHTML = `
      <div class="tab-header">
        <span class="event-badge ${eventClass}">${(tab.event || 'opened').toUpperCase()}</span>
        <span class="tab-time">${timeAgo}</span>
      </div>
      <a class="tab-url" href="${tab.url}" target="_blank" rel="noopener noreferrer">${this.truncateUrl(tab.url, 70)}</a>
      <div class="tab-title" title="${tab.title}">${tab.title}</div>
      <div class="tab-meta">
        <span>Domain: ${tab.domain || 'unknown'}</span>
        <span>Logged: ${tab.formattedTime}</span>
      </div>
    `;

    return li;
  }

  updatePagination() {
    const total = this.filteredTabs.length;
    const totalPages = Math.max(1, Math.ceil(total / this.itemsPerPage));
    this.currentPage = Math.min(this.currentPage, totalPages);

    const start = total === 0 ? 0 : (this.currentPage - 1) * this.itemsPerPage + 1;
    const end = Math.min(start + this.itemsPerPage - 1, total);

    document.getElementById('showingCount').textContent = total === 0 ? '0' : `${start}-${end}`;
    document.getElementById('totalCount').textContent = `${total}`;
    document.getElementById('pageInfo').textContent = `Page ${this.currentPage} of ${totalPages}`;

    document.getElementById('prevBtn').classList.toggle('disabled', this.currentPage <= 1);
    document.getElementById('nextBtn').classList.toggle('disabled', this.currentPage >= totalPages);
  }

  previousPage() {
    if (this.currentPage > 1) {
      this.currentPage -= 1;
      this.renderTabs();
    }
  }

  nextPage() {
    const totalPages = Math.ceil(this.filteredTabs.length / this.itemsPerPage);
    if (this.currentPage < totalPages) {
      this.currentPage += 1;
      this.renderTabs();
    }
  }

  updateStats() {
    const total = this.allTabs.length;
    const today = this.getTodayCount();
    const domains = this.getUniqueDomains().size;

    document.getElementById('totalTabs').textContent = `${total} tab${total === 1 ? '' : 's'}`;
    document.getElementById('todayTabs').textContent = `${today} today`;
    document.getElementById('activeDomains').textContent = `${domains} domain${domains === 1 ? '' : 's'}`;
  }

  getTodayCount() {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    return this.allTabs.filter(tab => tab.timestamp >= startOfDay).length;
  }

  getUniqueDomains() {
    const set = new Set();
    this.allTabs.forEach(tab => {
      if (tab.domain) {
        set.add(tab.domain);
      }
    });
    return set;
  }

  renderAnalytics() {
    const total = this.allTabs.length;
    const uniqueDomains = this.getUniqueDomains().size;
    const today = this.getTodayCount();

    let avgPerDay = 0;
    if (total > 0) {
      const oldest = this.allTabs.reduce((min, tab) => Math.min(min, tab.timestamp), Date.now());
      const days = Math.max(1, Math.ceil((Date.now() - oldest) / (24 * 60 * 60 * 1000)));
      avgPerDay = Math.round(total / days);
    }

    document.getElementById('totalTabsAnalytics').textContent = total;
    document.getElementById('uniqueDomainsAnalytics').textContent = uniqueDomains;
    document.getElementById('todayTabsAnalytics').textContent = today;
    document.getElementById('avgPerDayAnalytics').textContent = avgPerDay;

    this.renderTopDomains();
  }

  renderTopDomains() {
    const container = document.getElementById('topDomainsList');
    container.innerHTML = '';

    if (this.allTabs.length === 0) {
      container.innerHTML = '<div style="text-align: center; color: #6c757d; padding: 20px;">No data yet</div>';
      return;
    }

    const domainCounts = {};
    this.allTabs.forEach(tab => {
      const domain = tab.domain || 'unknown';
      domainCounts[domain] = (domainCounts[domain] || 0) + 1;
    });

    Object.entries(domainCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .forEach(([domain, count]) => {
        const item = document.createElement('div');
        item.className = 'domain-item';
        item.innerHTML = `
          <span>${domain}</span>
          <span class="domain-count">${count}</span>
        `;
        container.appendChild(item);
      });
  }

  async handleExport() {
    if (this.filteredTabs.length === 0) {
      this.showNotification('Nothing to export yet.', 'info');
      return;
    }

    try {
      const headers = ['Timestamp', 'Event', 'URL', 'Title', 'Domain'];
      let csv = `${headers.join(',')}\n`;

      this.filteredTabs.forEach(tab => {
        const row = [
          tab.formattedTime,
          tab.event || 'opened',
          tab.url,
          tab.title,
          tab.domain || ''
        ].map(value => {
          const safe = String(value ?? '').replace(/"/g, '""');
          return safe.includes(',') ? `"${safe}"` : safe;
        });
        csv += `${row.join(',')}\n`;
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const filename = `tab_log_${new Date().toISOString().replace(/[:]/g, '-').slice(0, 19)}.csv`;

      await chrome.downloads.download({
        url,
        filename,
        saveAs: true
      });

      URL.revokeObjectURL(url);
      this.showNotification('CSV exported successfully.', 'success');
    } catch (error) {
      console.error('Export failed:', error);
      this.showNotification('Export failed. Please try again.', 'error');
    }
  }

  async handleClear() {
    if (!confirm('Clear all logged entries?')) {
      return;
    }

    try {
      await chrome.storage.local.set({ loggedTabs: [] });
      this.allTabs = [];
      this.filteredTabs = [];
      this.currentPage = 1;
      this.renderTabs();
      this.updateStats();
      this.showNotification('All logs cleared.', 'success');
    } catch (error) {
      console.error('Failed to clear logs:', error);
      this.showNotification('Failed to clear logs. Try again.', 'error');
    }
  }

  async handleRefresh() {
    const refreshBtn = document.getElementById('refreshBtn');

    await this.loadTabs();
    this.applyFilters();
    this.updateStats();

  }

  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    const background = type === 'success' ? '#2f9e44' : type === 'error' ? '#e03131' : '#4c6ef5';
    notification.style.cssText = `
      position: fixed;
      top: 12px;
      right: 12px;
      padding: 12px 16px;
      background: ${background};
      color: #ffffff;
      border-radius: 6px;
      font-size: 12px;
      z-index: 1000;
      animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 2500);
  }

  extractDomain(url) {
    try {
      return new URL(url).hostname;
    } catch (_) {
      return 'unknown';
    }
  }

  truncateUrl(url, maxLength) {
    if (!url || url.length <= maxLength) {
      return url || '';
    }
    return `${url.slice(0, maxLength - 3)}...`;
  }

  getTimeAgo(timestamp) {
    const diff = Date.now() - timestamp;
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
}

document.addEventListener('DOMContentLoaded', () => {
  new TabLoggerUI();
});

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