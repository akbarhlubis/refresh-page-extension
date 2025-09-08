let intervalId = null;
let intervalMs = 1000;
let isReloading = false;
let useCondition = true;

function logSuccess(msg) {
  console.log('[Refresh Extension][SUCCESS]', msg);
}

function logError(msg, err) {
  console.error('[Refresh Extension][ERROR]', msg, err || '');
}

chrome.storage.local.get(['intervalMs', 'isReloading', 'useCondition'], (result) => {
  try {
    if (result.intervalMs) intervalMs = result.intervalMs;
    if (typeof result.useCondition === 'boolean') useCondition = result.useCondition;
    if (result.isReloading) {
      isReloading = result.isReloading;
      if (isReloading) startReloading();
    }
    logSuccess('Initialized from storage');
  } catch (err) {
    logError('Failed to initialize from storage', err);
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  try {
    if (msg.action === 'start') {
      intervalMs = msg.intervalMs;
      isReloading = true;
      chrome.storage.local.set({intervalMs, isReloading}, () => {
        if (chrome.runtime.lastError) {
          logError('Failed to set intervalMs/isReloading', chrome.runtime.lastError);
        } else {
          logSuccess('Started reloading');
        }
      });
      startReloading();
    } else if (msg.action === 'stop') {
      isReloading = false;
      chrome.storage.local.set({isReloading}, () => {
        if (chrome.runtime.lastError) {
          logError('Failed to set isReloading', chrome.runtime.lastError);
        } else {
          logSuccess('Stopped reloading');
        }
      });
      stopReloading();
    } else if (msg.action === 'updateInterval') {
      intervalMs = msg.intervalMs;
      chrome.storage.local.set({intervalMs}, () => {
        if (chrome.runtime.lastError) {
          logError('Failed to update intervalMs', chrome.runtime.lastError);
        } else {
          logSuccess('Interval updated');
        }
      });
      if (isReloading) {
        stopReloading();
        startReloading();
      }
    } else if (msg.action === 'updateCondition') {
      useCondition = msg.useCondition;
      chrome.storage.local.set({useCondition}, () => {
        if (chrome.runtime.lastError) {
          logError('Failed to update useCondition', chrome.runtime.lastError);
        } else {
          logSuccess('Condition updated');
        }
      });
      if (isReloading) {
        stopReloading();
        startReloading();
      }
    }
  } catch (err) {
    logError('Error in onMessage handler', err);
  }
});

// Relay pesan selectorPicked dari content script ke popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  try {
    if (msg.action === 'selectorPicked' && msg.selector) {
      chrome.runtime.sendMessage({action: 'selectorPicked', selector: msg.selector}, () => {
        if (chrome.runtime.lastError) {
          logError('Failed to relay selectorPicked', chrome.runtime.lastError);
        } else {
          logSuccess('Selector relayed to popup');
        }
      });
    }
  } catch (err) {
    logError('Error relaying selectorPicked', err);
  }
});

function startReloading() {
  stopReloading();
  try {
    intervalId = setInterval(async () => {
      const urlResult = await getStorageData(['urlReloadActive', 'urlReloadValue']);
      
      if (urlResult.urlReloadActive && urlResult.urlReloadValue) {
        // Reload semua tab yang URL-nya cocok
        const tabs = await queryTabs({});
        const matchingTabs = tabs.filter(tab => 
          tab.url && tab.url.includes(urlResult.urlReloadValue)
        );
        
        for (const tab of matchingTabs) {
          await processTabReload(tab);
        }
      } else {
        // Reload hanya tab aktif
        const activeTabs = await queryTabs({active: true, currentWindow: true});
        if (activeTabs[0]) {
          await processTabReload(activeTabs[0]);
        }
      }
    }, intervalMs);
    
    logSuccess('Reloading started with interval ' + intervalMs + 'ms');
  } catch (err) {
    logError('Error in startReloading', err);
  }
}

async function processTabReload(tab) {
  try {
    if (!useCondition) {
      await reloadTab(tab.id, `Tab reloaded (no condition): ${tab.url}`);
      return;
    }

    const shouldReload = await checkReloadCondition(tab.id);
    if (shouldReload) {
      await reloadTab(tab.id, `Tab reloaded (condition met): ${tab.url}`);
    } else {
      logSuccess(`No reload needed (condition not met): ${tab.url}`);
    }
  } catch (err) {
    logError(`Error processing tab reload for ${tab.url}`, err);
  }
}

async function checkReloadCondition(tabId) {
  try {
    const advResult = await getStorageData(['advancedCompareActive', 'advancedCompareConfig']);
    
    if (advResult.advancedCompareActive && advResult.advancedCompareConfig) {
      return await checkAdvancedCompare(tabId, advResult.advancedCompareConfig);
    } else {
      return await checkBasicCompare(tabId);
    }
  } catch (err) {
    logError('Error checking reload condition', err);
    return false;
  }
}

async function checkAdvancedCompare(tabId, config) {
  try {
    const response = await sendMessageToTab(tabId, {
      action: 'checkAdvancedCompare',
      config: config
    });

    if (!response) return false;

    // Logika reload berdasarkan action dan response
    return (config.action === 'refresh' && response.shouldReload) ||
           (config.action === 'no-refresh' && !response.shouldReload);
  } catch (err) {
    logError('Error in advanced compare check', err);
    return false;
  }
}

async function checkBasicCompare(tabId) {
  try {
    const result = await getStorageData(['selectors']);
    const selectors = result.selectors || [];
    
    const response = await sendMessageToTab(tabId, {
      action: 'checkElements',
      selectors: selectors
    });

    return response && response.shouldReload;
  } catch (err) {
    logError('Error in basic compare check', err);
    return false;
  }
}

// Helper functions untuk async/await pattern
function getStorageData(keys) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(keys, (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(result);
      }
    });
  });
}

function queryTabs(queryInfo) {
  return new Promise((resolve, reject) => {
    chrome.tabs.query(queryInfo, (tabs) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(tabs);
      }
    });
  });
}

function sendMessageToTab(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        logError('Failed to send message to tab', chrome.runtime.lastError);
        resolve(null); // Return null instead of rejecting
      } else {
        resolve(response);
      }
    });
  });
}

function reloadTab(tabId, successMsg) {
  return new Promise((resolve, reject) => {
    chrome.tabs.reload(tabId, {}, () => {
      if (chrome.runtime.lastError) {
        logError('Failed to reload tab', chrome.runtime.lastError);
        reject(chrome.runtime.lastError);
      } else {
        logSuccess(successMsg);
        resolve();
      }
    });
  });
}

function stopReloading() {
  try {
    if (intervalId) clearInterval(intervalId);
    intervalId = null;
    logSuccess('Reloading stopped');
  } catch (err) {
    logError('Error in stopReloading', err);
  }
}