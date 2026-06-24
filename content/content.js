(function() {
  let isReaderMode = false;

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'ping') {
      sendResponse({});
      return;
    }
    if (msg.action === 'enter-reader-mode') {
      if (isReaderMode) return;
      enterReaderMode();
    }
  });

  window.addEventListener('reader-exit', () => {
    isReaderMode = false;
  });

  function enterReaderMode() {
    // Collect metadata from original (rendered) SVGs before cloning.
    // getBBox() returns the true bounding box of all graphical elements,
    // which may differ from viewBox. Using it ensures the img element
    // has the correct aspect-ratio and content is not clipped.
    // Also detects whether each SVG sits in an inline parent context,
    // so small decorative icons keep their natural size instead of
    // being forced to width:100%.
    const inlineParentTags = new Set(['SPAN', 'A', 'EM', 'STRONG', 'B', 'I', 'U', 'SMALL', 'LABEL', 'BUTTON', 'CODE', 'KBD', 'SUB', 'SUP', 'MARK', 'ABBR', 'CITE', 'TIME']);
    const svgMeta = [];
    document.querySelectorAll('svg').forEach((svg) => {
      try {
        const bbox = svg.getBBox();
        const bounds = bbox && bbox.width > 0 && bbox.height > 0
          ? { x: bbox.x, y: bbox.y, w: bbox.width, h: bbox.height }
          : null;

        const parent = svg.parentElement;
        let isInline = true;
        if (parent) {
          const display = window.getComputedStyle(parent).display;
          isInline = display.startsWith('inline')
            || parent.tagName === 'P'
            || inlineParentTags.has(parent.tagName);
        }

        // An SVG rendered at 48px or smaller in both dimensions
        // is never meaningful content — always treat as inline.
        if (bounds && bounds.w <= 48 && bounds.h <= 48) {
          isInline = true;
        }

        svgMeta.push({ bounds, isInline });
      } catch (e) {
        svgMeta.push(null);
      }
    });

    const documentClone = document.cloneNode(true);

    documentClone.querySelectorAll('svg').forEach((svg, i) => {
      if (!svg.getAttribute('xmlns')) {
        svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      }
      if (svg.querySelector('[xlink\\:href]') && !svg.getAttribute('xmlns:xlink')) {
        svg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
      }
      svg.setAttribute('overflow', 'visible');

      const meta = svgMeta[i];

      // Update viewBox to match actual content bounds so the SVG
      // maps correctly into the img's CSS box without clipping.
      if (meta && meta.bounds) {
        svg.setAttribute('viewBox', `${meta.bounds.x} ${meta.bounds.y} ${meta.bounds.w} ${meta.bounds.h}`);
      }

      const svgText = new XMLSerializer().serializeToString(svg);
      const base64 = btoa(unescape(encodeURIComponent(svgText)));
      const img = documentClone.createElement('img');
      img.src = 'data:image/svg+xml;base64,' + base64;
      img.setAttribute('data-rm-svg-id', i);
      if (meta && meta.bounds) {
        img.setAttribute('width', Math.ceil(meta.bounds.w));
        img.setAttribute('height', Math.ceil(meta.bounds.h));
      }
      if (meta && meta.isInline) {
        img.setAttribute('data-rm-svg-inline', '');
      }

      svg.parentNode.replaceChild(img, svg);
    });

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
