var ControlPanel;
if (!ControlPanel) {
  ControlPanel = {
    panelEl: null,
    toggleBtn: null,
    isOpen: false,
    settings: {
      theme: 'light',
      fontSize: 18,
      maxWidth: 720,
      lineHeight: 1.8,
      fontFamily: 'serif'
    },

    async init() {
      const saved = await chrome.storage.sync.get(Object.keys(this.settings));
      Object.assign(this.settings, saved);

      this.createToggleButton();
      this.createPanel();
    },

    createToggleButton() {
      this.toggleBtn = document.createElement('button');
      this.toggleBtn.id = 'rv-panel-toggle';
      this.toggleBtn.innerHTML = '⚙';
      this.toggleBtn.title = '阅读设置';
      this.toggleBtn.addEventListener('click', () => this.toggle());
      document.getElementById('reader-view').appendChild(this.toggleBtn);
    },

    createPanel() {
      this.panelEl = document.createElement('div');
      this.panelEl.id = 'rv-control-panel';
      this.panelEl.innerHTML = `
        <button class="rv-panel-close">✕</button>
        <div class="rv-panel-title">阅读设置</div>

        <div class="rv-control-group">
          <span class="rv-control-label">主题</span>
          <div class="rv-theme-options" data-setting="theme">
            <button class="rv-theme-btn" data-theme="light" title="浅色"></button>
            <button class="rv-theme-btn" data-theme="dark" title="深色"></button>
            <button class="rv-theme-btn" data-theme="sepia" title="护眼棕"></button>
          </div>
        </div>

        <div class="rv-control-group">
          <span class="rv-control-label">字号</span>
          <input type="range" class="rv-slider" data-setting="fontSize" min="12" max="32" value="${this.settings.fontSize}">
        </div>

        <div class="rv-control-group">
          <span class="rv-control-label">页面宽度</span>
          <div class="rv-size-options" data-setting="maxWidth">
            <button class="rv-size-btn" data-value="540">窄</button>
            <button class="rv-size-btn" data-value="720">中</button>
            <button class="rv-size-btn" data-value="900">宽</button>
            <button class="rv-size-btn" data-value="1200">全宽</button>
          </div>
        </div>

        <div class="rv-control-group">
          <span class="rv-control-label">行间距</span>
          <input type="range" class="rv-slider" data-setting="lineHeight" min="1.2" max="2.5" step="0.1" value="${this.settings.lineHeight}">
        </div>

        <div class="rv-control-group">
          <span class="rv-control-label">字体</span>
          <select class="rv-font-select" data-setting="fontFamily">
            <option value="serif" ${this.settings.fontFamily === 'serif' ? 'selected' : ''}>衬线字体 (Georgia)</option>
            <option value="sans" ${this.settings.fontFamily === 'sans' ? 'selected' : ''}>无衬线字体 (苹方)</option>
          </select>
        </div>
      `;

      this.panelEl.querySelector('.rv-panel-close').addEventListener('click', () => this.toggle());
      this.panelEl.querySelectorAll('[data-setting]').forEach(el => {
        el.addEventListener('input', (e) => this.handleSettingChange(e));
        el.addEventListener('change', (e) => this.handleSettingChange(e));
        el.addEventListener('click', (e) => this.handleSettingChange(e));
      });

      this.updateActiveStates();
      document.getElementById('reader-view').appendChild(this.panelEl);
    },

    toggle() {
      this.isOpen = !this.isOpen;
      this.panelEl.classList.toggle('rv-open', this.isOpen);
    },

    handleSettingChange(e) {
      const target = e.target;

      if (target.classList.contains('rv-theme-btn')) {
        const value = target.dataset.theme;
        this.settings.theme = value;
        target.parentElement.querySelectorAll('.rv-theme-btn').forEach(b => b.classList.remove('rv-active'));
        target.classList.add('rv-active');
        chrome.storage.sync.set({ theme: value });
        ReaderView.applySettings(this.settings);
        return;
      }

      if (target.classList.contains('rv-size-btn')) {
        const value = parseInt(target.dataset.value);
        this.settings.maxWidth = value;
        target.parentElement.querySelectorAll('.rv-size-btn').forEach(b => b.classList.remove('rv-active'));
        target.classList.add('rv-active');
        chrome.storage.sync.set({ maxWidth: value });
        ReaderView.applySettings(this.settings);
        return;
      }

      const container = target.closest('[data-setting]') || target;
      const key = container.dataset.setting;
      if (!key) return;

      let value;
      if (container.tagName === 'SELECT') {
        value = container.value;
        this.settings[key] = value;
      } else if (container.type === 'range') {
        value = key === 'lineHeight' ? parseFloat(container.value) : parseInt(container.value);
        this.settings[key] = value;
      } else {
        return;
      }

      chrome.storage.sync.set({ [key]: value });
      ReaderView.applySettings(this.settings);
    },

    updateActiveStates() {
      const themeGroup = this.panelEl.querySelector('.rv-theme-options');
      if (themeGroup) {
        const activeTheme = themeGroup.querySelector(`[data-theme="${this.settings.theme}"]`);
        if (activeTheme) activeTheme.classList.add('rv-active');
      }

      const sizeGroup = this.panelEl.querySelector('[data-setting="maxWidth"]');
      if (sizeGroup) {
        const activeSize = sizeGroup.querySelector(`[data-value="${this.settings.maxWidth}"]`);
        if (activeSize) activeSize.classList.add('rv-active');
      }

      const fontSizeSlider = this.panelEl.querySelector('[data-setting="fontSize"]');
      if (fontSizeSlider) fontSizeSlider.value = this.settings.fontSize;

      const lineHeightSlider = this.panelEl.querySelector('[data-setting="lineHeight"]');
      if (lineHeightSlider) lineHeightSlider.value = this.settings.lineHeight;
    },
  };
}
