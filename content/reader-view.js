var ReaderView;
if (!ReaderView) {
  ReaderView = {
    savedHTML: null,
    savedScrollY: 0,
    readerEl: null,

    enter(doc, article) {
      this.savedHTML = doc.documentElement.outerHTML;
      this.savedScrollY = window.scrollY;

      const stylesheets = [
        chrome.runtime.getURL('styles/reader-view.css'),
        chrome.runtime.getURL('styles/control-panel.css'),
      ];

      const articleHTML = `
        <div id="reader-view" data-rv-theme="${window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'}" data-rv-panel-position="right">
          <div class="rv-container">
            <div class="rv-header">
              <h1 class="rv-title">${this.escapeHTML(article.title)}</h1>
              <div class="rv-meta">
                ${article.byline ? `<span>${article.byline}</span>` : ''}
                ${article.byline && article.publishedTime ? ' · ' : ''}
                ${article.publishedTime ? `<span>${new Date(article.publishedTime).toLocaleDateString('zh-CN')}</span>` : ''}
              </div>
            </div>
            <div class="rv-content">${article.content}</div>
          </div>
          <button class="rv-close-btn" id="rv-close-btn" title="退出阅读模式">✕</button>
        </div>
      `;

      document.open();
      document.write('<!DOCTYPE html><html><head>');
      stylesheets.forEach(href => {
        document.write(`<link rel="stylesheet" href="${href}">`);
      });
      document.write('</head><body>');
      document.write(articleHTML);
      document.write('</body></html>');
      document.close();

      this.readerEl = document.getElementById('reader-view');
      document.getElementById('rv-close-btn').addEventListener('click', () => {
        ReaderView.exitReaderMode();
      });

      this.applySettings();
    },

    exit() {
      if (this.savedHTML) {
        document.open();
        document.write(this.savedHTML);
        document.close();
        window.scrollTo(0, this.savedScrollY);
      }
      this.savedHTML = null;
      this.readerEl = null;
    },

    exitReaderMode() {
      this.exit();
      window.dispatchEvent(new Event('reader-exit'));
      chrome.runtime.sendMessage({ action: 'reader-mode-exited' }).catch(() => {});
    },

    applySettings(settings) {
      if (!this.readerEl) return;
      if (settings) {
        if (settings.theme) this.readerEl.setAttribute('data-rv-theme', settings.theme);
        if (settings.fontSize) this.readerEl.style.setProperty('--rv-font-size', settings.fontSize + 'px');
        if (settings.maxWidth) this.readerEl.style.setProperty('--rv-max-width', settings.maxWidth + 'px');
        if (settings.lineHeight) this.readerEl.style.setProperty('--rv-line-height', settings.lineHeight);
        if (settings.fontFamily === 'sans') {
          this.readerEl.style.setProperty('--rv-font-family', "'-apple-system', 'BlinkMacSystemFont', 'PingFang SC', 'Helvetica Neue', sans-serif");
        } else if (settings.fontFamily === 'serif') {
          this.readerEl.style.setProperty('--rv-font-family', "'Georgia', 'Times New Roman', serif");
        }
      }
    },

    escapeHTML(str) {
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }
  };
}
