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
    // Step 1: Mark all position:fixed/sticky subtrees in the original
    // document. These are floating UI elements (toolbars, modals, sidebars,
    // follow/like/comment buttons) that must never reach Readability.
    function markFixed(container) {
      for (const child of container.children) {
        if (child.tagName === 'SVG') continue;
        try {
          if (window.getComputedStyle(child).position === 'fixed' ||
              window.getComputedStyle(child).position === 'sticky') {
            child.dataset.rmFixed = '1';
            continue;
          }
        } catch (e) {}
        markFixed(child);
      }
    }
    markFixed(document.documentElement);

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

        // getBoundingClientRect() returns the actual CSS-pixel display
        // size of the SVG element on screen.  Use this for the <img>
        // dimensions and the inline-vs-content heuristic, NOT the
        // viewBox-space bounds from getBBox().
        const rect = svg.getBoundingClientRect();
        const displaySize = rect && rect.width > 0 && rect.height > 0
          ? { w: rect.width, h: rect.height }
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
        if (displaySize && displaySize.w <= 48 && displaySize.h <= 48) {
          isInline = true;
        }

        svgMeta.push({ bounds, displaySize, isInline });
      } catch (e) {
        svgMeta.push(null);
      }
    });

    const documentClone = document.cloneNode(true);

    // Remove all marked floating subtrees from the clone so they never
    // reach Readability.
    documentClone.querySelectorAll('[data-rm-fixed]').forEach(el => el.remove());
    // Clean up temporary markers from the original document.
    document.querySelectorAll('[data-rm-fixed]').forEach(el => el.removeAttribute('data-rm-fixed'));

    documentClone.querySelectorAll('svg').forEach((svg, i) => {
      const meta = svgMeta[i];

      // SVGs inside fixed/sticky subtrees are already removed above;
      // skip if meta is out of range (should not happen).
      if (!meta) return;

      if (!svg.getAttribute('xmlns')) {
        svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      }
      if (svg.querySelector('[xlink\\:href]') && !svg.getAttribute('xmlns:xlink')) {
        svg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
      }
      svg.setAttribute('overflow', 'visible');

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
      if (meta && meta.displaySize) {
        img.setAttribute('width', Math.round(meta.displaySize.w));
        img.setAttribute('height', Math.round(meta.displaySize.h));
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
