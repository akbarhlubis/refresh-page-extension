chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'checkElements' && Array.isArray(msg.selectors)) {
    let allExist = msg.selectors
      .filter(sel => sel.trim() !== '')
      .every(sel => !!document.querySelector(sel));
    sendResponse({shouldReload: !allExist});
  }
});