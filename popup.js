document.addEventListener('DOMContentLoaded', function() {
  chrome.storage.local.get({loggedTabs: []}, function(result) {
    const tabList = document.getElementById('tabList');
    const loggedTabs = result.loggedTabs;

    loggedTabs.forEach(function(tabInfo) {
      const listItem = document.createElement('li');
      const eventBadge = tabInfo.event ? `[${tabInfo.event}] ` : '';
      const title = tabInfo.title ? ` (${tabInfo.title})` : '';
      listItem.innerHTML = `<strong>${tabInfo.timestamp}</strong><br>
                           ${eventBadge}<a href="${tabInfo.url}" target="_blank">${tabInfo.url}</a>${title}`;
      tabList.appendChild(listItem);
    });

    // Show tab count
    const countElement = document.getElementById('tabCount');
    countElement.textContent = `Total tabs logged: ${loggedTabs.length}`;
  });

  // Download functionality
  document.getElementById('downloadBtn').addEventListener('click', function() {
    chrome.storage.local.get({loggedTabs: []}, function(result) {
      const loggedTabs = result.loggedTabs;
      
      // Create CSV content
      let csvContent = "Timestamp,Event,URL,Title\n";
      loggedTabs.forEach(function(tabInfo) {
        // Escape commas and quotes for proper CSV format
        const escapedUrl = (tabInfo.url || '').replace(/"/g, '""');
        const escapedTitle = (tabInfo.title || '').replace(/"/g, '""');
        const event = tabInfo.event || 'opened';
        csvContent += `"${tabInfo.timestamp}","${event}","${escapedUrl}","${escapedTitle}"\n`;
      });

      // Create and trigger download
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      
      chrome.downloads.download({
        url: url,
        filename: `tab_log_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`
      }, function(downloadId) {
        if (chrome.runtime.lastError) {
          console.error('Download failed:', chrome.runtime.lastError);
        } else {
          console.log('Download started with ID:', downloadId);
        }
        // Clean up the object URL
        URL.revokeObjectURL(url);
      });
    });
  });

  // Clear logs functionality
  document.getElementById('clearBtn').addEventListener('click', function() {
    if (confirm('Are you sure you want to clear all logged tabs?')) {
      chrome.storage.local.set({loggedTabs: []}, function() {
        location.reload(); // Refresh the popup to show empty list
      });
    }
  });
});