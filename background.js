// Track the last open event we logged per tab to reduce duplicate entries
const lastOpenEventByTab = new Map();

// Ensure storage writes happen sequentially to avoid lost updates
let storageWriteQueue = Promise.resolve();
const MAX_LOG_ENTRIES = 5000;

function shouldLogTab(tab) {
  if (!tab || !tab.url) {
    return false;
  }

  const disallowedPrefixes = [
    'chrome://',
    'chrome-extension://',
    'edge://',
    'about:blank',
    'moz-extension://',
    'safari-extension://'
  ];

  return !disallowedPrefixes.some(prefix => tab.url.startsWith(prefix));
}

function extractDomain(url) {
  try {
    return new URL(url).hostname;
  } catch (_) {
    return 'unknown';
  }
}

function buildLogEntry(tab, event) {
  const now = Date.now();
  return {
    id: `${tab.id}-${now}-${event}`,
    tabId: tab.id,
    url: tab.url,
    title: tab.title || 'Loading...',
    domain: extractDomain(tab.url),
    event,
    timestamp: now,
    formattedTime: new Date(now).toLocaleString()
  };
}

async function appendLogEntry(entry) {
  const result = await chrome.storage.local.get({ loggedTabs: [] });
  const logs = Array.isArray(result.loggedTabs) ? result.loggedTabs : [];
  logs.push(entry);

  if (logs.length > MAX_LOG_ENTRIES) {
    logs.splice(0, logs.length - MAX_LOG_ENTRIES);
  }

  await chrome.storage.local.set({ loggedTabs: logs });
}

function queueLogEntry(entry) {
  storageWriteQueue = storageWriteQueue
    .then(() => appendLogEntry(entry))
    .catch(error => console.error('Failed to persist tab log:', error));
}

function logOpenedIfNew(tab) {
  if (!shouldLogTab(tab)) {
    return;
  }

  const now = Date.now();
  const lastOpen = lastOpenEventByTab.get(tab.id);
  if (lastOpen && lastOpen.url === tab.url && now - lastOpen.timestamp < 1000) {
    return;
  }

  lastOpenEventByTab.set(tab.id, { url: tab.url, timestamp: now });
  queueLogEntry(buildLogEntry(tab, 'opened'));
}

function logActivation(tab) {
  if (!shouldLogTab(tab)) {
    return;
  }

  if (tab.url) {
    lastOpenEventByTab.set(tab.id, { url: tab.url, timestamp: Date.now() });
  }

  queueLogEntry(buildLogEntry(tab, 'activated'));
}

chrome.tabs.onCreated.addListener(tab => {
  // Some tabs have a URL immediately (pinned or duplicated tabs)
  if (tab.url) {
    logOpenedIfNew(tab);
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    logOpenedIfNew(tab);
  }
});

chrome.tabs.onActivated.addListener(activeInfo => {
  chrome.tabs.get(activeInfo.tabId, tab => {
    if (chrome.runtime.lastError) {
      return;
    }
    logActivation(tab);
  });
});

chrome.tabs.onRemoved.addListener(tabId => {
  lastOpenEventByTab.delete(tabId);
});