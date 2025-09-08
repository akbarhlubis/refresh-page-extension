  // Ambil URL tab aktif ke input url-reload
  $('#get-current-url').on('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0] && tabs[0].url) {
        $('#url-reload-input').val(tabs[0].url).trigger('input');
      }
    });
  });
  // URL reload opsional
  let urlReloadActive = false;
  let urlReloadValue = '';

  chrome.storage.local.get(['urlReloadActive', 'urlReloadValue'], function(result) {
    urlReloadActive = !!result.urlReloadActive;
    urlReloadValue = result.urlReloadValue || '';
    if (urlReloadActive) {
      $('#toggle-url-reload').removeClass('off').addClass('on').text('ON');
      $('#url-reload-fields').show();
    } else {
      $('#toggle-url-reload').removeClass('on').addClass('off').text('OFF');
      $('#url-reload-fields').hide();
    }
    $('#url-reload-input').val(urlReloadValue);
  });

  $('#toggle-url-reload').on('click', function() {
    urlReloadActive = !urlReloadActive;
    if (urlReloadActive) {
      $(this).removeClass('off').addClass('on').text('ON');
      $('#url-reload-fields').show();
    } else {
      $(this).removeClass('on').addClass('off').text('OFF');
      $('#url-reload-fields').hide();
    }
    chrome.storage.local.set({urlReloadActive});
  });
  $('#url-reload-input').on('input', function() {
    urlReloadValue = $(this).val();
    chrome.storage.local.set({urlReloadValue});
  });
  
  // Debug button: cek selector dan value di halaman aktif
  $('#debug-check').on('click', function() {
    // Get both old compare and new advanced compare selectors
    const sel1 = $('#compare-selector1').val();
    const sel2 = $('#compare-selector2').val();
    const advSel = $('#advanced-compare-selector').val();
    const advValues = advancedCompareConfig.values;
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0]) {
        chrome.scripting.executeScript({
          target: {tabId: tabs[0].id},
          func: function(sel1, sel2, advSel, advValues) {
            function getElementValue(selector) {
              try {
                const el = document.querySelector(selector);
                if (!el) return null;
                return el.value !== undefined ? el.value : (el.textContent || '').trim();
              } catch(e) {
                return null;
              }
            }
            
            function detectValueType(value) {
              const trimmed = value.trim();
              if (trimmed.startsWith('#') || trimmed.startsWith('.') || 
                  trimmed.startsWith('[') || trimmed.includes('::') ||
                  /^[a-zA-Z][a-zA-Z0-9]*$/.test(trimmed.split(' ')[0])) {
                return 'selector';
              }
              return 'literal';
            }
            
            let result = '';
            
            // Old compare debug
            if (sel1 || sel2) {
              let el1 = null, el2 = null, v1 = '', v2 = '';
              try { el1 = document.querySelector(sel1); } catch(e){}
              try { el2 = document.querySelector(sel2); } catch(e){}
              if (el1) v1 = el1.value !== undefined ? el1.value : (el1.textContent || '');
              if (el2) v2 = el2.value !== undefined ? el2.value : (el2.textContent || '');
              
              result += `<b>Basic Compare:</b><br>`;
              result += `Selector 1: ${sel1} | Found: <b>${!!el1}</b> | Value: <b>${v1}</b><br>`;
              result += `Selector 2: ${sel2} | Found: <b>${!!el2}</b> | Value: <b>${v2}</b><br><br>`;
            }
            
            // Advanced compare debug
            if (advSel && advValues.length > 0) {
              const mainValue = getElementValue(advSel);
              result += `<b>Advanced Compare:</b><br>`;
              result += `Main Selector: ${advSel} | Found: <b>${mainValue !== null}</b> | Value: <b>${mainValue}</b><br><br>`;
              
              result += `<b>Compare Values:</b><br>`;
              advValues.forEach((val, idx) => {
                const valueType = detectValueType(val);
                if (valueType === 'selector') {
                  const compValue = getElementValue(val);
                  result += `${idx + 1}. ${val} (SELECTOR) | Found: <b>${compValue !== null}</b> | Value: <b>${compValue}</b><br>`;
                } else {
                  result += `${idx + 1}. ${val} (LITERAL)<br>`;
                }
              });
            }
            
            return result || 'No selectors to debug.';
          },
          args: [sel1, sel2, advSel, advValues]
        }, function(results) {
          if (chrome.runtime.lastError || !results || !results[0]) {
            $('#debug-result').text('Gagal membaca selector.').show();
            return;
          }
          $('#debug-result').html(results[0].result).show();
        });
      }
    });
  });
let intervalMs = 1000;
let isReloading = false;
let selectors = [];
let useCondition = true;

function renderSelectors() {
  const $list = $('#selectors-list');
  $list.empty();
  selectors.forEach((sel, idx) => {
    const $row = $(`
      <div style="margin-bottom:4px;">
        <input type="text" class="selector-input" value="${sel}" style="width:180px;margin-right:8px;" />
        <button class="remove-selector btn off" data-idx="${idx}" type="button">Remove</button>
      </div>
    `);
    $list.append($row);
  });
}

function saveSelectors() {
  chrome.storage.local.set({selectors});
}

function saveCondition() {
  chrome.storage.local.set({useCondition});
}

let compareActive = false;
let compareConfig = {
  selector1: '',
  operator: '=',
  selector2: '',
  action: 'refresh',
};

function saveCompareConfig() {
  chrome.storage.local.set({compareActive, compareConfig});
}

function loadCompareConfig(cb) {
  chrome.storage.local.get(['compareActive', 'compareConfig'], function(result) {
    compareActive = typeof result.compareActive === 'boolean' ? result.compareActive : false;
    compareConfig = result.compareConfig || {selector1:'', operator:'=', selector2:'', action:'refresh'};
    if (cb) cb();
  });
}

$(document).ready(function() {
  // Load selectors & compare config
  chrome.storage.local.get(['selectors', 'useCondition', 'compareActive', 'compareConfig'], function(result) {
    selectors = result.selectors || [''];
    useCondition = typeof result.useCondition === 'boolean' ? result.useCondition : true;
    compareActive = typeof result.compareActive === 'boolean' ? result.compareActive : false;
    compareConfig = result.compareConfig || {selector1:'', operator:'=', selector2:'', action:'refresh'};
    renderSelectors();
    $('#toggle-condition').text('Condition: ' + (useCondition ? 'ON' : 'OFF'));
    if (useCondition) {
      $('#toggle-condition').removeClass('off').addClass('on');
    } else {
      $('#toggle-condition').removeClass('on').addClass('off');
    }
    // Set compare UI
    if (compareActive) {
      $('#toggle-compare').removeClass('off').addClass('on').text('ON');
      $('#compare-fields').show();
    } else {
      $('#toggle-compare').removeClass('on').addClass('off').text('OFF');
      $('#compare-fields').hide();
    }
    $('#compare-selector1').val(compareConfig.selector1);
    $('#compare-operator').val(compareConfig.operator);
    $('#compare-selector2').val(compareConfig.selector2);
    $('#compare-action').val(compareConfig.action);
  });
  // Toggle compare feature
  $('#toggle-compare').on('click', function() {
    compareActive = !compareActive;
    if (compareActive) {
      $(this).removeClass('off').addClass('on').text('ON');
      $('#compare-fields').show();
    } else {
      $(this).removeClass('on').addClass('off').text('OFF');
      $('#compare-fields').hide();
    }
    saveCompareConfig();
  });

  // Update compare config fields
  $('#compare-selector1').on('input', function() {
    compareConfig.selector1 = $(this).val();
    saveCompareConfig();
  });
  $('#compare-operator').on('change', function() {
    compareConfig.operator = $(this).val();
    saveCompareConfig();
  });
  $('#compare-selector2').on('input', function() {
    compareConfig.selector2 = $(this).val();
    saveCompareConfig();
  });
  $('#compare-action').on('change', function() {
    compareConfig.action = $(this).val();
    saveCompareConfig();
  });

  // Add selector
  $('#add-selector').on('click', function(e) {
    e.preventDefault();
    selectors.push('');
    renderSelectors();
    saveSelectors();
  });

  // Update selector value
  $('#selectors-list').on('input', '.selector-input', function() {
    const idx = $(this).parent().index();
    selectors[idx] = $(this).val();
    saveSelectors();
  });

  // Remove selector
  $('#selectors-list').on('click', '.remove-selector', function() {
    const idx = $(this).data('idx');
    selectors.splice(idx, 1);
    renderSelectors();
    saveSelectors();
  });

  // Toggle condition
  $('#toggle-condition').on('click', function() {
    useCondition = !useCondition;
    $(this).text('Condition: ' + (useCondition ? 'ON' : 'OFF'));
    if (useCondition) {
      $(this).removeClass('off').addClass('on');
    } else {
      $(this).removeClass('on').addClass('off');
    }
    saveCondition();
    chrome.runtime.sendMessage({action: 'updateCondition', useCondition});
  });

  // Interval & reload logic
  const $input = $('#interval-input');
  const $button = $('#toggle-reload');

  chrome.storage.local.get(['intervalMs', 'isReloading'], function(result) {
    if (result.intervalMs) {
      intervalMs = result.intervalMs;
      $input.val(intervalMs);
    }
    if (result.isReloading) {
      isReloading = result.isReloading;
      if (isReloading) {
        $button.text('Turn OFF Reload');
        $button.removeClass('off');
      } else {
        $button.text('Turn ON Reload');
        $button.addClass('off');
      }
    } else {
      $button.text('Turn ON Reload');
      $button.addClass('off');
    }
  });

  $input.on('change', function() {
    intervalMs = parseInt($input.val(), 10) || 500;
    chrome.runtime.sendMessage({action: 'updateInterval', intervalMs});
    chrome.storage.local.set({intervalMs});
  });

  $button.on('click', function() {
    if (!isReloading) {
      intervalMs = parseInt($input.val(), 10) || 500;
      chrome.runtime.sendMessage({action: 'start', intervalMs});
      chrome.storage.local.set({intervalMs, isReloading: true});
      $button.text('Turn OFF Reload');
      $button.removeClass('off');
      isReloading = true;
    } else {
      chrome.runtime.sendMessage({action: 'stop'});
      chrome.storage.local.set({isReloading: false});
      $button.text('Turn ON Reload');
      $button.addClass('off');
      isReloading = false;
    }
  });

  // Pick selector
  $('#pick-selector').on('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {action: 'pickSelector'});
      }
    });
  });

  // Listen for selector picked from content script
  chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
    if (msg.action === 'selectorPicked' && msg.selector) {
      selectors.push(msg.selector);
      renderSelectors();
      saveSelectors();
    }
  });

  // Advanced Compare Variables and Functions
  let advancedCompareActive = false;
  let advancedCompareConfig = {
    selector: '',
    operator: '=',
    action: 'refresh',
    logic: 'AND',
    values: []
  };

  function saveAdvancedCompareConfig() {
    chrome.storage.local.set({advancedCompareActive, advancedCompareConfig});
  }

  function loadAdvancedCompareConfig(cb) {
    chrome.storage.local.get(['advancedCompareActive', 'advancedCompareConfig'], function(result) {
      advancedCompareActive = typeof result.advancedCompareActive === 'boolean' ? result.advancedCompareActive : false;
      advancedCompareConfig = result.advancedCompareConfig || {
        selector: '',
        operator: '=',
        action: 'refresh',
        logic: 'AND',
        values: []
      };
      if (cb) cb();
    });
  }

  function detectValueType(value) {
    // Auto-detect if value is a selector or literal
    const trimmed = value.trim();
    if (trimmed.startsWith('#') || trimmed.startsWith('.') || 
        trimmed.startsWith('[') || trimmed.includes('::') ||
        /^[a-zA-Z][a-zA-Z0-9]*$/.test(trimmed.split(' ')[0])) {
      return 'selector';
    }
    return 'literal';
  }

  function renderAdvancedCompareValues() {
    const $container = $('#advanced-compare-values');
    $container.empty();
    
    advancedCompareConfig.values.forEach((value, idx) => {
      const valueType = detectValueType(value);
      const typeDisplay = valueType === 'selector' ? 'SEL' : 'LIT';
      const typeClass = valueType === 'selector' ? 'selector' : 'literal';
      
      const $row = $(`
        <div class="advanced-compare-value-row">
          <input type="text" class="advanced-compare-value-input" value="${value}" data-idx="${idx}" placeholder="Selector atau nilai literal" />
          <span class="value-type-indicator ${typeClass}">${typeDisplay}</span>
          <button class="advanced-compare-remove-btn" data-idx="${idx}">×</button>
        </div>
      `);
      
      if (idx > 0) {
        const logicDisplay = $(`<div class="advanced-compare-logic-display">${advancedCompareConfig.logic}</div>`);
        $container.append(logicDisplay);
      }
      
      $container.append($row);
    });
  }

  // Load Advanced Compare config on page load
  loadAdvancedCompareConfig(function() {
    // Set Advanced Compare UI
    if (advancedCompareActive) {
      $('#toggle-advanced-compare').removeClass('off').addClass('on').text('ON');
      $('#advanced-compare-fields').show();
    } else {
      $('#toggle-advanced-compare').removeClass('on').addClass('off').text('OFF');
      $('#advanced-compare-fields').hide();
    }
    
    $('#advanced-compare-selector').val(advancedCompareConfig.selector);
    $('#advanced-compare-operator').val(advancedCompareConfig.operator);
    $('#advanced-compare-action').val(advancedCompareConfig.action);
    $('#advanced-compare-logic').val(advancedCompareConfig.logic);
    
    // Add default values if empty
    if (advancedCompareConfig.values.length === 0) {
      advancedCompareConfig.values = ['#nilai2', 'Hello World'];
      saveAdvancedCompareConfig();
    }
    
    renderAdvancedCompareValues();
  });

  // Toggle Advanced Compare feature
  $('#toggle-advanced-compare').on('click', function() {
    advancedCompareActive = !advancedCompareActive;
    if (advancedCompareActive) {
      $(this).removeClass('off').addClass('on').text('ON');
      $('#advanced-compare-fields').show();
    } else {
      $(this).removeClass('on').addClass('off').text('OFF');
      $('#advanced-compare-fields').hide();
    }
    saveAdvancedCompareConfig();
  });

  // Update Advanced Compare config fields
  $('#advanced-compare-selector').on('input', function() {
    advancedCompareConfig.selector = $(this).val();
    saveAdvancedCompareConfig();
  });

  $('#advanced-compare-operator').on('change', function() {
    advancedCompareConfig.operator = $(this).val();
    saveAdvancedCompareConfig();
  });

  $('#advanced-compare-action').on('change', function() {
    advancedCompareConfig.action = $(this).val();
    saveAdvancedCompareConfig();
  });

  $('#advanced-compare-logic').on('change', function() {
    advancedCompareConfig.logic = $(this).val();
    saveAdvancedCompareConfig();
    renderAdvancedCompareValues(); // Re-render to update logic display
  });

  // Add new value
  $('#add-advanced-compare-value').on('click', function() {
    advancedCompareConfig.values.push('');
    renderAdvancedCompareValues();
    saveAdvancedCompareConfig();
  });

  // Update value
  $('#advanced-compare-values').on('input', '.advanced-compare-value-input', function() {
    const idx = $(this).data('idx');
    const value = $(this).val();
    advancedCompareConfig.values[idx] = value;
    
    // Update type indicator
    const valueType = detectValueType(value);
    const typeDisplay = valueType === 'selector' ? 'SEL' : 'LIT';
    const typeClass = valueType === 'selector' ? 'selector' : 'literal';
    
    const $indicator = $(this).siblings('.value-type-indicator');
    $indicator.removeClass('selector literal').addClass(typeClass).text(typeDisplay);
    
    saveAdvancedCompareConfig();
  });

  // Remove value
  $('#advanced-compare-values').on('click', '.advanced-compare-remove-btn', function() {
    const idx = $(this).data('idx');
    advancedCompareConfig.values.splice(idx, 1);
    renderAdvancedCompareValues();
    saveAdvancedCompareConfig();
  });

  // Check for Updates button (jQuery version)
  $('#check-update-btn').on('click', function() {
    checkForUpdates();
  });

  function checkForUpdates() {
    // Change this URL to your GitHub repository releases atom feed URL
    const githubReleasesURL = "https://github.com/akbarhlubis/refresh-page-extension/releases.atom";
    
    // Change button appearance during the process
    const $btn = $('#check-update-btn');
    $btn.html('<i class="bi bi-arrow-clockwise"></i>');
    $btn.prop('disabled', true);
    
    fetch(githubReleasesURL)
      .then(response => response.text())
      .then(xmlText => {
        // Parse Atom feed for latest release
        const latestVersion = parseGithubReleaseFeed(xmlText);
        
        // Read extension version from manifest.json
        const manifest = chrome.runtime.getManifest();
        const currentVersion = manifest.version;
        
        if (latestVersion && compareVersions(latestVersion, currentVersion) > 0) {
          // New version available
          if (confirm(`New version ${latestVersion} available! Your version: ${currentVersion}. Open download page?`)) {
            chrome.tabs.create({ url: "https://github.com/akbarhlubis/refersh-page-extension/releases/latest" });
          }
        } else {
          // Version is up to date - show success message
          showUpdateMessage("You are using the latest version.", "success");
        }
        
        // Reset button to normal
        $btn.html('<i class="bi bi-arrow-repeat"></i>');
        $btn.prop('disabled', false);
      })
      .catch(error => {
        console.error("Error checking for updates:", error);
        showUpdateMessage("Failed to check for updates. Please try again later.", "error");
        
        // Reset button to normal
        $btn.html('<i class="bi bi-arrow-repeat"></i>');
        $btn.prop('disabled', false);
      });
  }
  
  function parseGithubReleaseFeed(xmlText) {
    // Parsing GitHub Releases Atom feed
    const entryMatch = /<entry>[\s\S]*?<title>([^<]*)<\/title>[\s\S]*?<\/entry>/i.exec(xmlText);
    if (entryMatch && entryMatch[1]) {
      // Biasanya format title adalah "v1.0.0" atau hanya "1.0.0"
      const versionText = entryMatch[1].trim();
      // Remove 'v' prefix jika ada
      return versionText.startsWith('v') ? versionText.substring(1) : versionText;
    }
    return null;
  }
  
  function compareVersions(v1, v2) {
    // Split versi berdasarkan titik, lalu bandingkan numerik
    const v1parts = v1.split('.').map(Number);
    const v2parts = v2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(v1parts.length, v2parts.length); i++) {
      const v1part = i < v1parts.length ? v1parts[i] : 0;
      const v2part = i < v2parts.length ? v2parts[i] : 0;
      
      if (v1part > v2part) return 1;
      if (v1part < v2part) return -1;
    }
    
    return 0; // Versi sama
  }

  // Helper: show update messages
  function showUpdateMessage(message, type) {
    // Create or update message div
    let $messageDiv = $('#update-message');
    if ($messageDiv.length === 0) {
      $messageDiv = $('<div id="update-message"></div>');
      $('.header-container').after($messageDiv);
    }
    
    // Set message style based on type
    const bgColor = type === 'success' ? '#22c55e' : '#ef4444';
    const textColor = '#ffffff';
    
    $messageDiv
      .text(message)
      .css({
        'background': bgColor,
        'color': textColor,
        'padding': '8px 12px',
        'border-radius': '6px',
        'margin': '8px 0',
        'font-size': '13px',
        'text-align': 'center',
        'font-weight': '500'
      })
      .show();
    
    // Auto hide after 4 seconds
    setTimeout(() => {
      $messageDiv.fadeOut(300);
    }, 4000);
  }

  // Helper: show version from manifest
  function displayVersion() {
    const manifest = chrome.runtime.getManifest();
    const $versionElement = $('.version');
    if ($versionElement.length && manifest.version) {
      $versionElement.text(`v${manifest.version}`);
    }
  }

  // Call displayVersion on page load
  displayVersion();
});

  // Collapse/accordion logic (jQuery version)
  $(document).on('click', '.collapse-toggle', function(e) {
    e.preventDefault();
    var $btn = $(this);
    var targetSel = $btn.data('target');
    var $target = $(targetSel);
    var expanded = $btn.attr('aria-expanded') === 'true';
    if ($target.length) {
      $target.toggle(!expanded);
      $btn.attr('aria-expanded', expanded ? 'false' : 'true');
      var $icon = $btn.find('i').first();
      $icon.attr('class', expanded ? 'bi bi-chevron-down' : 'bi bi-chevron-up');
    }
  });