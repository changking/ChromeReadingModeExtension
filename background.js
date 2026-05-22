const tabStates = new Map();
const scriptsInjected = new Set();

async function injectContentScripts(tabId) {
  if (scriptsInjected.has(tabId)) return;
  await chrome.scripting.executeScript({
    target: { tabId },
    files: [
      'content/readability.js',
      'content/reader-view.js',
      'content/control-panel.js',
      'content/content.js'
    ]
  });
  scriptsInjected.add(tabId);
}

async function toggleReaderMode(tab) {
  const tabId = tab.id;
  const isActive = tabStates.get(tabId) || false;

  try {
    if (!isActive) {
      await injectContentScripts(tabId);
      await chrome.tabs.sendMessage(tabId, { action: 'enter-reader-mode' });
      tabStates.set(tabId, true);
      chrome.action.setIcon({
        tabId,
        path: { 16: 'icons/icon16-active.png', 48: 'icons/icon48-active.png', 128: 'icons/icon128-active.png' }
      });
    } else {
      await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          if (typeof ReaderView !== 'undefined' && ReaderView.exitReaderMode) {
            ReaderView.exitReaderMode();
          }
        }
      });
      tabStates.set(tabId, false);
      chrome.action.setIcon({
        tabId,
        path: { 16: 'icons/icon16.png', 48: 'icons/icon48.png', 128: 'icons/icon128.png' }
      });
    }
  } catch (err) {
    console.error('Reader mode error:', err);
    tabStates.set(tabId, false);
  }
}

chrome.action.onClicked.addListener(toggleReaderMode);

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'toggle-reader-mode') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) toggleReaderMode(tab);
  }
});

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.action === 'reader-mode-exited') {
    const tabId = sender.tab.id;
    if (tabStates.get(tabId)) {
      tabStates.set(tabId, false);
      chrome.action.setIcon({
        tabId,
        path: { 16: 'icons/icon16.png', 48: 'icons/icon48.png', 128: 'icons/icon128.png' }
      });
    }
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  tabStates.delete(tabId);
  scriptsInjected.delete(tabId);
});
