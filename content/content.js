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
    const documentClone = document.cloneNode(true);

    // Save all SVGs before Readability processes them,
    // so we can restore originals after extraction.
    const savedSVGs = [];
    documentClone.querySelectorAll('svg').forEach((svg, i) => {
      savedSVGs.push(svg.outerHTML);
      svg.setAttribute('data-rm-svg-id', i);
    });

    const article = new Readability(documentClone).parse();

    if (!article) {
      showError('无法识别当前页面的文章内容。');
      return;
    }

    ReaderView.enter(document, article);

    // Restore original SVGs directly in reader view DOM,
    // avoiding HTML string re-parsing which can truncate SVG content.
    if (savedSVGs.length > 0) {
      const svgList = Array.from(
        document.querySelectorAll('.rv-content svg[data-rm-svg-id]')
      );
      svgList.forEach(el => {
        const id = el.getAttribute('data-rm-svg-id');
        if (savedSVGs[id]) {
          // Use insertAdjacentHTML (not outerHTML) so the SVG string is parsed
          // in HTML context (parentNode is a HTML element, not SVG namespace).
          // This ensures SVG-internal <style> elements are correctly processed.
          el.insertAdjacentHTML('afterend', savedSVGs[id]);
          el.remove();
        }
      });

      // Fix SVG sizing: measure actual content bounding box with getBBox(),
      // then set width=100%, aspect-ratio from content, height=auto.
      // This works for SVGs with or without viewBox, and ensures parent
      // containers compute correct height from the SVG's layout box.
      document.querySelectorAll('.rv-content svg').forEach(svg => {
        try {
          var bbox = svg.getBBox();
          if (bbox && bbox.width > 0 && bbox.height > 0) {
            svg.removeAttribute('width');
            svg.removeAttribute('height');
            svg.style.setProperty('width', '100%', 'important');
            svg.style.setProperty('height', 'auto', 'important');
            svg.style.setProperty('aspect-ratio', bbox.width + ' / ' + bbox.height, 'important');
            svg.style.setProperty('overflow', 'visible', 'important');
          }
        } catch (e) {
          svg.style.setProperty('max-width', '100%', 'important');
        }
      });
    }
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
