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
    // Ambil selector dari compare field
    const sel1 = $('#compare-selector1').val();
    const sel2 = $('#compare-selector2').val();
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0]) {
        chrome.scripting.executeScript({
          target: {tabId: tabs[0].id},
          func: function(sel1, sel2) {
            let el1 = null, el2 = null, v1 = '', v2 = '';
            try { el1 = document.querySelector(sel1); } catch(e){}
            try { el2 = document.querySelector(sel2); } catch(e){}
            if (el1) v1 = el1.value !== undefined ? el1.value : (el1.textContent || '');
            if (el2) v2 = el2.value !== undefined ? el2.value : (el2.textContent || '');
            return {
              sel1, found1: !!el1, value1: v1,
              sel2, found2: !!el2, value2: v2
            };
          },
          args: [sel1, sel2]
        }, function(results) {
          if (chrome.runtime.lastError || !results || !results[0]) {
            $('#debug-result').text('Gagal membaca selector.').show();
            return;
          }
          const r = results[0].result;
          let html = `<b>Selector 1:</b> ${r.sel1} <br> Ditemukan: <b>${r.found1}</b> <br> Value: <b>${r.value1}</b><br><br>`;
          html += `<b>Selector 2:</b> ${r.sel2} <br> Ditemukan: <b>${r.found2}</b> <br> Value: <b>${r.value2}</b>`;
          $('#debug-result').html(html).show();
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