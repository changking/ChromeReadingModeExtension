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

    // Normalize lazy-load attributes so images/iframes are captured
    // correctly in the clone.  Removing loading="lazy" also tells
    // Chrome to start fetching below-the-fold resources immediately.
    normalizeLazyAttributes(document);

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
        let isInline = false;
        if (parent) {
          const display = window.getComputedStyle(parent).display;
          if (display.startsWith('inline') || inlineParentTags.has(parent.tagName)) {
            isInline = true;
          }
        }

        // Use the SVG's CSS display size as the ultimate arbiter:
        //   - ≤48px in both dimensions → always inline (icon)
        //   - >48px in either dimension → always content
        if (displaySize) {
          if (displaySize.w <= 48 && displaySize.h <= 48) {
            isInline = true;
          } else {
            isInline = false;
          }
        }

        const wAttr = svg.getAttribute('width');
        const hAttr = svg.getAttribute('height');
        const isPct = (wAttr && String(wAttr).includes('%')) || (hAttr && String(hAttr).includes('%'));

        // Tag the SVG so we can look up its meta in the clone even when
        // other SVGs are removed from the clone (fixed/sticky subtrees).
        svg.setAttribute('data-rm-svg-idx', svgMeta.length);

        svgMeta.push({ bounds, displaySize, isInline, isPct });
      } catch (e) {
        svgMeta.push(null);
      }
    });

    const documentClone = document.cloneNode(true);

    // Collect original stylesheets to preserve in reader view.
    const origStylesheets = [];
    document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
      if (link.href) origStylesheets.push({ type: 'link', href: link.href });
    });
    document.querySelectorAll('style').forEach(style => {
      origStylesheets.push({ type: 'style', text: style.textContent });
    });

    // Remove all marked floating subtrees from the clone so they never
    // reach Readability.
    documentClone.querySelectorAll('[data-rm-fixed]').forEach(el => el.remove());
    // Clean up temporary markers from the original document.
    document.querySelectorAll('[data-rm-fixed]').forEach(el => el.removeAttribute('data-rm-fixed'));
    document.querySelectorAll('[data-rm-svg-idx]').forEach(el => el.removeAttribute('data-rm-svg-idx'));

    documentClone.querySelectorAll('svg').forEach((svg) => {
      const idx = parseInt(svg.getAttribute('data-rm-svg-idx'), 10);
      const meta = svgMeta[idx];

      // SVGs inside fixed/sticky subtrees are already removed above;
      // skip if meta is out of range (should not happen).
      if (!meta) return;

      if (!svg.getAttribute('xmlns')) {
        svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      }
      if (svg.querySelector('[xlink\\:href]') && !svg.getAttribute('xmlns:xlink')) {
        svg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
      }
      // The original SVG may have overflow:hidden in its style attribute
      // (e.g. Mermaid flowcharts).  Override it via the style property
      // so CSS cascade doesn't clip content outside the viewBox.
      svg.setAttribute('overflow', 'visible');
      svg.style.overflow = 'visible';

      // Update viewBox to encompass all content without clipping.
      // Expand the origin to at most 0 so that content rendered above
      // getBBox()'s reported top (e.g. via CSS transforms on <g>)
      // is not clipped.  For negative-origin SVGs (icons), keep it.
      if (meta && meta.bounds) {
        const vx = Math.min(0, meta.bounds.x);
        const vy = Math.min(0, meta.bounds.y);
        const vw = Math.ceil(meta.bounds.x + meta.bounds.w - vx);
        const vh = Math.ceil(meta.bounds.y + meta.bounds.h - vy);
        svg.setAttribute('viewBox', `${vx} ${vy} ${vw} ${vh}`);
      }

      // For percentage-sized SVGs (width/height="100%"), set explicit
      // pixel width/height on the SVG element matching the viewBox.
      // Without this the data URI has no proper intrinsic dimensions
      // and the browser falls back to a tiny default.
      if (meta && meta.bounds && meta.isPct) {
        const vx = Math.min(0, meta.bounds.x);
        const vy = Math.min(0, meta.bounds.y);
        const vw = Math.ceil(meta.bounds.x + meta.bounds.w - vx);
        const vh = Math.ceil(meta.bounds.y + meta.bounds.h - vy);
        svg.setAttribute('width', vw);
        svg.setAttribute('height', vh);
      }

      const svgText = new XMLSerializer().serializeToString(svg);
      const base64 = btoa(unescape(encodeURIComponent(svgText)));
      const img = documentClone.createElement('img');
      img.src = 'data:image/svg+xml;base64,' + base64;
      img.setAttribute('data-rm-svg-id', idx);
      if (meta && meta.displaySize) {
        if (meta.isPct && meta.bounds) {
          const vx = Math.min(0, meta.bounds.x);
          const vy = Math.min(0, meta.bounds.y);
          const vw = Math.ceil(meta.bounds.x + meta.bounds.w - vx);
          const vh = Math.ceil(meta.bounds.y + meta.bounds.h - vy);
          img.setAttribute('width', vw);
          img.setAttribute('height', vh);
        } else {
          img.setAttribute('width', Math.round(meta.displaySize.w));
          img.setAttribute('height', Math.round(meta.displaySize.h));
        }
      }
      if (meta && meta.isInline) {
        img.setAttribute('data-rm-svg-inline', '');
      }

      svg.parentNode.replaceChild(img, svg);
    });

    // Safety net: normalize any remaining lazy-load patterns in the
    // clone before Readability parses it.
    normalizeLazyAttributes(documentClone);

    const article = new Readability(documentClone, { keepClasses: true }).parse();

    if (!article) {
      showError('无法识别当前页面的文章内容。');
      return;
    }

    ReaderView.enter(document, article, origStylesheets);
    ControlPanel.init();
    isReaderMode = true;
  }

  function normalizeLazyAttributes(root) {
    root.querySelectorAll('img[loading="lazy"], iframe[loading="lazy"]').forEach(el => {
      el.setAttribute('loading', 'eager');
    });

    root.querySelectorAll('img[data-src]').forEach(img => {
      const dataSrc = img.getAttribute('data-src');
      if (dataSrc) {
        const curSrc = img.getAttribute('src');
        if (!curSrc || curSrc.includes('pic_blank') || /^data:image\//.test(curSrc)) {
          img.setAttribute('src', dataSrc);
        }
      }
    });

    root.querySelectorAll('img[data-srcset]').forEach(img => {
      if (!img.getAttribute('srcset') && img.getAttribute('data-srcset')) {
        img.setAttribute('srcset', img.getAttribute('data-srcset'));
      }
    });

    root.querySelectorAll('[data-original]').forEach(el => {
      if (!el.getAttribute('src') && el.getAttribute('data-original')) {
        el.setAttribute('src', el.getAttribute('data-original'));
      }
    });

    root.querySelectorAll('source[data-srcset]').forEach(source => {
      if (!source.getAttribute('srcset') && source.getAttribute('data-srcset')) {
        source.setAttribute('srcset', source.getAttribute('data-srcset'));
      }
    });

    root.querySelectorAll('video[data-poster]').forEach(v => {
      if (!v.getAttribute('poster') && v.getAttribute('data-poster')) {
        v.setAttribute('poster', v.getAttribute('data-poster'));
      }
    });

    root.querySelectorAll('iframe[data-src]').forEach(f => {
      if (!f.getAttribute('src') && f.getAttribute('data-src')) {
        f.setAttribute('src', f.getAttribute('data-src'));
      }
    });
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
