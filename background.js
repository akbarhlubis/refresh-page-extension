let intervalId = null;
let intervalMs = 1000;
let isReloading = false;
let useCondition = true;

chrome.storage.local.get(['intervalMs', 'isReloading', 'useCondition'], (result) => {
  if (result.intervalMs) intervalMs = result.intervalMs;
  if (typeof result.useCondition === 'boolean') useCondition = result.useCondition;
  if (result.isReloading) {
    isReloading = result.isReloading;
    if (isReloading) startReloading();
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'start') {
    intervalMs = msg.intervalMs;
    isReloading = true;
    chrome.storage.local.set({intervalMs, isReloading});
    startReloading();
  } else if (msg.action === 'stop') {
    isReloading = false;
    chrome.storage.local.set({isReloading});
    stopReloading();
  } else if (msg.action === 'updateInterval') {
    intervalMs = msg.intervalMs;
    chrome.storage.local.set({intervalMs});
    if (isReloading) {
      stopReloading();
      startReloading();
    }
  } else if (msg.action === 'updateCondition') {
    useCondition = msg.useCondition;
    chrome.storage.local.set({useCondition});
    if (isReloading) {
      stopReloading();
      startReloading();
    }
  }
});

function startReloading() {
  stopReloading();
  intervalId = setInterval(() => {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0]) {
        if (useCondition) {
          chrome.storage.local.get(['selectors'], function(result) {
            const selectors = result.selectors || [];
            chrome.tabs.sendMessage(tabs[0].id, {action: 'checkElements', selectors}, (response) => {
              if (response && response.shouldReload) {
                chrome.tabs.reload(tabs[0].id);
              }
            });
          });
        } else {
          chrome.tabs.reload(tabs[0].id);
        }
      }
    });
  }, intervalMs);
}

function stopReloading() {
  if (intervalId) clearInterval(intervalId);
  intervalId = null;
}