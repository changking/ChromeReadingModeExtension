(function() {
  let isReaderMode = false;

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'enter-reader-mode') {
      if (isReaderMode) return;
      enterReaderMode();
    }
  });

  window.addEventListener('reader-exit', () => {
    isReaderMode = false;
  });

  function enterReaderMode() {
    const documentClone = document.cloneNode(true);
    const article = new Readability(documentClone).parse();

    if (!article) {
      showError('无法识别当前页面的文章内容。');
      return;
    }

    ReaderView.enter(document, article);
    ControlPanel.init();
    isReaderMode = true;
  }

  function showError(msg) {
    const el = document.createElement('div');
    el.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; z-index: 2147483647;
      background: #fff3cd; color: #856404; padding: 16px 24px;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 16px; text-align: center;
    `;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }
})();
