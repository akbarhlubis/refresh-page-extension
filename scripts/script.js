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
        <button class="remove-selector" data-idx="${idx}" type="button">Remove</button>
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

$(document).ready(function() {
  // Load selectors
  chrome.storage.local.get(['selectors', 'useCondition'], function(result) {
    selectors = result.selectors || [''];
    useCondition = typeof result.useCondition === 'boolean' ? result.useCondition : true;
    renderSelectors();
    $('#toggle-condition').text('Condition: ' + (useCondition ? 'ON' : 'OFF'));
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
      if (isReloading) $button.text('Turn OFF Reload');
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
      isReloading = true;
    } else {
      chrome.runtime.sendMessage({action: 'stop'});
      chrome.storage.local.set({isReloading: false});
      $button.text('Turn ON Reload');
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
});