var ReaderView;
if (!ReaderView) {
  ReaderView = {
    readerEl: null,
    styleEls: null,

    enter(doc, article, origStylesheets) {
      this.exit();

      this.styleEls = [];
      ['styles/reader-view.css', 'styles/control-panel.css'].forEach(path => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = chrome.runtime.getURL(path);
        document.head.appendChild(link);
        this.styleEls.push(link);
      });
      const svgStyle = document.createElement('style');
      svgStyle.textContent = '#reader-view .rv-content img[data-rm-svg-id]:not([data-rm-svg-inline]){width:100%!important;height:auto!important}#reader-view .rv-content img[data-rm-svg-inline]{max-width:100%!important;height:auto!important}';
      document.head.appendChild(svgStyle);
      this.styleEls.push(svgStyle);

      // Inject original page stylesheets so page-specific styling
      // (e.g. fonts, colors, decorations) carries into reader mode.
      if (origStylesheets) {
        origStylesheets.forEach(ss => {
          const el = ss.type === 'link'
            ? (() => { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = ss.href; return l; })()
            : (() => { const s = document.createElement('style'); s.textContent = ss.text; return s; })();
          document.head.appendChild(el);
          this.styleEls.push(el);
        });
      }

      const el = document.createElement('div');
      el.id = 'reader-view';
      el.setAttribute('data-rv-theme', 'light');
      el.setAttribute('data-rv-panel-position', 'right');
      el.innerHTML = `
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
        <button class="rv-pdf-btn" id="rv-pdf-btn" title="保存为 PDF">PDF</button>
      `;
      document.documentElement.appendChild(el);
      this.readerEl = el;

      document.documentElement.style.overflow = 'hidden';

      document.getElementById('rv-close-btn').addEventListener('click', () => {
        ReaderView.exitReaderMode();
      });
      document.getElementById('rv-pdf-btn').addEventListener('click', () => {
        window.print();
      });

      this.applySettings();
    },

    exit() {
      if (this.readerEl) {
        this.readerEl.remove();
        this.readerEl = null;
      }
      if (this.styleEls) {
        this.styleEls.forEach(el => el.remove());
        this.styleEls = null;
      }
      document.documentElement.style.overflow = '';
    },

    exitReaderMode() {
      chrome.runtime.sendMessage({ action: 'reader-mode-exited' }).catch(() => {});
      this.exit();
      window.dispatchEvent(new Event('reader-exit'));
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
