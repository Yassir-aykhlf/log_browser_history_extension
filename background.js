// Track tabs that we've already logged to avoid duplicates
let loggedTabs = new Set();

// Function to log tab information
function logTabInfo(tab, event = 'opened') {
  // Skip if URL is not available, is a chrome:// URL, or empty
  if (!tab.url || 
      tab.url.startsWith('chrome://') || 
      tab.url.startsWith('chrome-extension://') ||
      tab.url === 'about:blank' ||
      tab.url === '') {
    return;
  }

  const timestamp = new Date().toLocaleString();
  const tabInfo = {
    url: tab.url,
    title: tab.title || 'Loading...',
    timestamp: timestamp,
    event: event
  };

  // Create a unique key for this tab to avoid duplicates
  const tabKey = `${tab.id}-${tab.url}`;
  
  // Skip if we already logged this exact tab/URL combination
  if (loggedTabs.has(tabKey)) {
    return;
  }
  
  loggedTabs.add(tabKey);

  chrome.storage.local.get({loggedTabs: []}, function(result) {
    const existingLogs = result.loggedTabs;
    existingLogs.push(tabInfo);
    chrome.storage.local.set({loggedTabs: existingLogs});
  });
}

// Listen for new tabs being created
chrome.tabs.onCreated.addListener(function(tab) {
  // New tabs often don't have URLs yet, so we'll catch them on update
  logTabInfo(tab, 'created');
});

// Listen for tab updates (when URL actually loads)
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  // Only log when the tab has finished loading and has a URL
  if (changeInfo.status === 'complete' && tab.url) {
    logTabInfo(tab, 'loaded');
  }
});

// Listen for tabs being activated (switched to)
chrome.tabs.onActivated.addListener(function(activeInfo) {
  chrome.tabs.get(activeInfo.tabId, function(tab) {
    if (chrome.runtime.lastError) {
      return; // Tab might have been closed
    }
    logTabInfo(tab, 'activated');
  });
});

// Clean up closed tabs from our tracking set
chrome.tabs.onRemoved.addListener(function(tabId, removeInfo) {
  // Remove all entries for this tab ID from our tracking set
  for (let key of loggedTabs) {
    if (key.startsWith(`${tabId}-`)) {
      loggedTabs.delete(key);
    }
  }
});