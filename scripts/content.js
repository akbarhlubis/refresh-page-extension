chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'checkElements' && Array.isArray(msg.selectors)) {
    let allExist = msg.selectors
      .filter(sel => sel.trim() !== '')
      .every(sel => !!document.querySelector(sel));

    // Cek apakah ada fitur compare aktif
    chrome.storage.local.get(['compareActive', 'compareConfig'], function(result) {
      let shouldReload = !allExist;
      if (result.compareActive && result.compareConfig) {
        const {selector1, operator, selector2, action} = result.compareConfig;
        let v1 = '';
        let v2 = '';
        try {
          let el1 = document.querySelector(selector1);
          let el2 = document.querySelector(selector2);
          v1 = el1 ? (el1.value !== undefined ? el1.value : (el1.textContent || '')) : '';
          v2 = el2 ? (el2.value !== undefined ? el2.value : (el2.textContent || '')) : '';
        } catch (e) {}
        let cmp = false;
        if (operator === '=') cmp = v1 == v2;
        else if (operator === '!=') cmp = v1 != v2;
        else if (operator === '>') cmp = parseFloat(v1) > parseFloat(v2);
        else if (operator === '<') cmp = parseFloat(v1) < parseFloat(v2);
        else if (operator === '>=') cmp = parseFloat(v1) >= parseFloat(v2);
        else if (operator === '<=') cmp = parseFloat(v1) <= parseFloat(v2);
        // Jika aksi refresh, reload jika cmp true. Jika no-refresh, reload jika cmp false.
        if (action === 'refresh') {
          shouldReload = cmp;
        } else if (action === 'no-refresh') {
          shouldReload = !cmp;
        }
      }
      sendResponse({shouldReload});
    });
    // Agar sendResponse async
    return true;
  }
});

// Selector Picker Feature (Vanilla JS)
let pickerActive = false;
let overlay, infoBox;

function getFullSelector(el) {
  const parts = [];
  while (el.parentElement && el.tagName.toLowerCase() !== 'html') {
    let tag = el.tagName.toLowerCase();
    if (el.id) {
      tag += '#' + el.id;
      parts.unshift(tag);
      break;
    } else {
      const classes = [...el.classList].join('.');
      const siblingIndex = Array.from(el.parentNode.children).indexOf(el) + 1;
      tag += classes ? '.' + classes : '';
      tag += `:nth-child(${siblingIndex})`;
      parts.unshift(tag);
      el = el.parentElement;
    }
  }
  return parts.join(' > ');
}

function enablePicker() {
  if (pickerActive) return;
  pickerActive = true;

  overlay = document.createElement('div');
  overlay.style.position = 'absolute';
  overlay.style.border = '2px solid red';
  overlay.style.background = 'rgba(255,0,0,0.1)';
  overlay.style.pointerEvents = 'none';
  overlay.style.zIndex = 9999;
  document.body.appendChild(overlay);

  infoBox = document.createElement('div');
  infoBox.id = 'info-box';
  infoBox.style.position = 'fixed';
  infoBox.style.top = '10px';
  infoBox.style.left = '10px';
  infoBox.style.maxWidth = '500px';
  infoBox.style.padding = '10px';
  infoBox.style.background = 'black';
  infoBox.style.color = 'white';
  infoBox.style.fontFamily = 'monospace';
  infoBox.style.fontSize = '14px';
  infoBox.style.whiteSpace = 'pre-wrap';
  infoBox.style.zIndex = 10000;
  infoBox.style.borderRadius = '4px';
  infoBox.textContent = 'Klik pada elemen untuk copy selector. [ESC untuk batal]';
  document.body.appendChild(infoBox);

  document.addEventListener('mousemove', mousemoveHandler, true);
  document.addEventListener('click', clickHandler, true);
  document.addEventListener('keydown', keydownHandler, true);
}

function mousemoveHandler(e) {
  const el = document.elementFromPoint(e.clientX, e.clientY);
  if (el && el !== overlay && el !== infoBox) {
    const rect = el.getBoundingClientRect();
    overlay.style.top = (rect.top + window.scrollY) + 'px';
    overlay.style.left = (rect.left + window.scrollX) + 'px';
    overlay.style.width = rect.width + 'px';
    overlay.style.height = rect.height + 'px';
    infoBox.textContent = `Hovering: <${el.tagName.toLowerCase()}>${el.id ? '#' + el.id : ''}\nKlik untuk copy selector`;
  }
}

function clickHandler(e) {
  e.preventDefault();
  const el = document.elementFromPoint(e.clientX, e.clientY);
  if (!el || el === overlay || el === infoBox) return;
  const fullSelector = getFullSelector(el);
  navigator.clipboard.writeText(fullSelector);
  infoBox.textContent = `Selector: ${fullSelector}\n➡️ Selector telah disalin ke clipboard`;
  chrome.runtime.sendMessage({action: 'selectorPicked', selector: fullSelector});
  disablePicker();
}

function keydownHandler(e) {
  if (e.key === 'Escape') {
    disablePicker();
  }
}

function disablePicker() {
  pickerActive = false;
  if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
  if (infoBox && infoBox.parentNode) infoBox.parentNode.removeChild(infoBox);
  document.removeEventListener('mousemove', mousemoveHandler, true);
  document.removeEventListener('click', clickHandler, true);
  document.removeEventListener('keydown', keydownHandler, true);
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'pickSelector') {
    enablePicker();
  }
});