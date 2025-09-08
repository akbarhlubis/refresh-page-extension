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
    intervalId = setInterval(() => {
      chrome.storage.local.get(['urlReloadActive', 'urlReloadValue'], function(urlResult) {
        if (urlResult.urlReloadActive && urlResult.urlReloadValue) {
          // Reload semua tab yang URL-nya cocok
          chrome.tabs.query({}, function(tabs) {
            tabs.forEach(tab => {
              if (tab.url && tab.url.includes(urlResult.urlReloadValue)) {
                chrome.tabs.reload(tab.id, {}, () => {
                  if (chrome.runtime.lastError) {
                    logError('Failed to reload tab (url match)', chrome.runtime.lastError);
                  } else {
                    logSuccess('Tab reloaded (url match): ' + tab.url);
                  }
                });
              }
            });
          });
        } else {
          // Default: reload tab aktif sesuai kondisi lama
          chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (chrome.runtime.lastError) {
              logError('Failed to query tabs', chrome.runtime.lastError);
              return;
            }
            if (tabs[0]) {
              if (useCondition) {
                // Check Advanced Compare first
                chrome.storage.local.get(['advancedCompareActive', 'advancedCompareConfig'], function(advResult) {
                  if (chrome.runtime.lastError) {
                    logError('Failed to get advanced compare config', chrome.runtime.lastError);
                    return;
                  }
                  
                  if (advResult.advancedCompareActive && advResult.advancedCompareConfig) {
                    // Use Advanced Compare
                    const config = advResult.advancedCompareConfig;
                    chrome.tabs.sendMessage(tabs[0].id, {
                      action: 'checkAdvancedCompare', 
                      config: config
                    }, (response) => {
                      if (chrome.runtime.lastError) {
                        logError('Failed to send checkAdvancedCompare', chrome.runtime.lastError);
                        return;
                      }
                      
                      const shouldReload = (config.action === 'refresh' && response && response.shouldReload) ||
                                         (config.action === 'no-refresh' && response && !response.shouldReload);
                      
                      if (shouldReload) {
                        chrome.tabs.reload(tabs[0].id, {}, () => {
                          if (chrome.runtime.lastError) {
                            logError('Failed to reload tab (advanced compare)', chrome.runtime.lastError);
                          } else {
                            logSuccess('Tab reloaded (advanced compare condition met)');
                          }
                        });
                      } else {
                        logSuccess('No reload needed (advanced compare condition not met)');
                      }
                    });
                  } else {
                    // Use old selector checking
                    chrome.storage.local.get(['selectors'], function(result) {
                      if (chrome.runtime.lastError) {
                        logError('Failed to get selectors', chrome.runtime.lastError);
                        return;
                      }
                      const selectors = result.selectors || [];
                      chrome.tabs.sendMessage(tabs[0].id, {action: 'checkElements', selectors}, (response) => {
                        if (chrome.runtime.lastError) {
                          logError('Failed to send checkElements', chrome.runtime.lastError);
                          return;
                        }
                        if (response && response.shouldReload) {
                          chrome.tabs.reload(tabs[0].id, {}, () => {
                            if (chrome.runtime.lastError) {
                              logError('Failed to reload tab', chrome.runtime.lastError);
                            } else {
                              logSuccess('Tab reloaded (condition not met)');
                            }
                          });
                        } else {
                          logSuccess('No reload needed (condition met)');
                        }
                      });
                    });
                  }
                });
              } else {
                chrome.tabs.reload(tabs[0].id, {}, () => {
                  if (chrome.runtime.lastError) {
                    logError('Failed to reload tab', chrome.runtime.lastError);
                  } else {
                    logSuccess('Tab reloaded (no condition)');
                  }
                });
              }
            }
          });
        }
      });
    }, intervalMs);
    logSuccess('Reloading started with interval ' + intervalMs + 'ms');
  } catch (err) {
    logError('Error in startReloading', err);
  }
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