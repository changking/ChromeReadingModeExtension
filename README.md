# 阅读模式 - Chrome 扩展

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

一键清除网页广告和干扰元素，提供沉浸式阅读体验。基于 Mozilla Readability 算法提取核心内容，支持多主题和丰富的自定义选项。

## 功能

- **一键阅读** — 点击工具栏图标或按 `Ctrl+Shift+R` 切换阅读模式
- **智能提取** — 基于 Mozilla Readability 算法自动识别文章正文
- **三款主题** — 浅色 / 深色 / 护眼棕
- **自定义设置** — 字号、页面宽度、行间距、字体自由调节
- **侧边控制面板** — 悬浮在右侧，随时调整，不干扰阅读
- **隐私友好** — 仅在手动激活时运行，不上传任何数据

## 安装

### 从 Chrome 网上应用店（待上架）

### 开发者模式

1. 下载或克隆本仓库
2. 打开 Chrome 浏览器，访问 `chrome://extensions`
3. 开启右上角的 **开发者模式**
4. 点击 **加载已解压的扩展**，选择本项目目录

## 打包

### 上传 Chrome 网上应用店

```bash
zip -r ../reading-mode-extension.zip . \
  -x '*.git*' 'node_modules/*' 'docs/*' 'AGENTS.md' '*.md' '!/LICENSE'
```

打包产物 `reading-mode-extension.zip` 可直接上传至 [Chrome 开发者仪表盘](https://chrome.google.com/webstore/devconsole)。

**关键说明：**
- `.git/`、`node_modules/`、`docs/` 等开发文件应排除
- 清单文件 `manifest.json` + `background.js` + `content/` + `styles/` + `icons/` 为运行时必备
- `LICENSE` 保留包含（应用店要求）

### 开发者自用（.crx）

1. 打开 `chrome://extensions`，开启开发者模式
2. 点击 **打包扩展**（Pack extension）
3. 选择本项目目录作为**扩展根目录**
4. 如需固定 App ID，可指定私钥文件（首次打包会生成 `.pem`）

## 使用

| 操作 | 方式 |
|------|------|
| 进入/退出阅读模式 | 点击工具栏图标，或按 `Ctrl+Shift+R` |
| 调整阅读设置 | 点击页面右侧的 ⚙ 齿轮按钮 |
| 退出阅读模式 | 点击页面右上角的 ✕ 按钮 |

## 项目结构

```
├── manifest.json            # Manifest V3 配置
├── background.js            # Service Worker
├── content/
│   ├── readability.js       # Mozilla Readability 算法
│   ├── reader-view.js       # 阅读视图渲染
│   ├── control-panel.js     # 控制面板
│   └── content.js           # 主入口
├── styles/
│   ├── reader-view.css      # 阅读视图样式
│   └── control-panel.css    # 控制面板样式
└── icons/                   # 扩展图标
```

## 技术栈

- Chrome Extension Manifest V3
- [Mozilla Readability](https://github.com/mozilla/readability)
- Vanilla JavaScript
- CSS Custom Properties（主题系统）

## 许可证

[MIT](LICENSE)
