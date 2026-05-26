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
    // Get actual content bounds from original (rendered) SVGs before cloning.
    // getBBox() returns the true bounding box of all graphical elements,
    // which may differ from viewBox. Using it ensures the img element
    // has the correct aspect-ratio and content is not clipped.
    const svgBounds = [];
    document.querySelectorAll('svg').forEach((svg) => {
      try {
        const bbox = svg.getBBox();
        svgBounds.push(
          bbox && bbox.width > 0 && bbox.height > 0
            ? { x: bbox.x, y: bbox.y, w: bbox.width, h: bbox.height }
            : null
        );
      } catch (e) {
        svgBounds.push(null);
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

      // Update viewBox to match actual content bounds so the SVG
      // maps correctly into the img's CSS box without clipping.
      const bounds = svgBounds[i];
      if (bounds) {
        svg.setAttribute('viewBox', `${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`);
      }

      const svgText = new XMLSerializer().serializeToString(svg);
      const base64 = btoa(unescape(encodeURIComponent(svgText)));
      const img = documentClone.createElement('img');
      img.src = 'data:image/svg+xml;base64,' + base64;
      img.setAttribute('data-rm-svg-id', i);
      if (bounds) {
        img.setAttribute('width', Math.ceil(bounds.w));
        img.setAttribute('height', Math.ceil(bounds.h));
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
