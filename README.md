# Tab Logger

A Chrome extension that captures when tabs are opened and activated, keeps a rolling history, and lets you download the log as a CSV. The popup provides search, filtering, pagination, and basic analytics so you can explore your browsing sessions at a glance.

## Features

- Records every tab open (on load) and tab activation event with title, URL, domain, and timestamp.
- Persists history in `chrome.storage.local` while automatically trimming older entries (default maximum: 5,000).
- Popup dashboard with:
	- Search across URLs, titles, and domains.
	- Event and time filters plus sortable results.
	- Pagination for large histories and quick stats (total logs, today's activity, unique domains).
	- Analytics tab highlighting activity averages and top domains.
- One-click CSV export and the ability to clear the stored history.

## Getting Started

1. Clone or download this repository.
2. Open Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode** in the top-right corner.
4. Click **Load unpacked**, then select this project folder.
5. Pin the extension and start browsing - open the popup anytime to inspect or export your activity.

## Development

- `background.js` listens to tab events and serialises them into storage using a queued writer to avoid race conditions.
- `popup.html` / `popup.js` implement the dashboard UI and CSV export logic.
- Update the constants in `background.js` (such as `MAX_LOG_ENTRIES`) to fine-tune retention behaviour.

Feel free to extend the analytics, add custom filters, or wire the settings scaffold into the background script if you need more advanced retention or exclusion rules.