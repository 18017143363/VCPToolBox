# 项目分析报告: pac-master

**分析ID:** pac-master-2026-05-03.22.24  
**分析时间:** 2026/5/3 22:24:10  
**项目路径:** F:\pac-master

---

## 📋 项目简介

**核心功能:** 该项目主要用于维护 PAC/代理分流与广告过滤规则配置，服务于网络访问分流、广告拦截和相关代理客户端配置生成。

**关键实现:**
*   `core.js`: 从命名上看是项目核心脚本，最可能承担 PAC/规则处理或主逻辑封装职责。
*   `singbox.js`: 面向 Sing-box 代理工具的规则或配置生成脚本，是代理分流能力的重要实现入口。
*   `js-ad-rules.js`: 负责 JavaScript 形式的广告过滤规则维护或转换，是广告拦截功能的关键实现文件。

---

## 📁 文件结构树

```
├── adclear.json [配置文件]
├── adguard_user_rules_2505_111236.txt
├── china-ads-clash.yaml
├── china-ads.yaml
├── china-white-jinx.yaml
├── chnroute.txt.md5sum.txt
├── clash-config.yaml
├── core.js
├── js-ad-rules.js
├── md5sum.txt
├── neural-phantom-4.2.zip
├── neural-phantom4.5.zip
├── neural-phantom4_6.zip
├── neural-phantom4_6_fixed.zip
├── Neural-Phantom使用claude开发.zip
├── PingFangSC-Semibold.woff2
├── README.md
├── singbox.js
├── tomoon-socks5.yaml
└── 全局视频控制栏.zip

```

---

## 📝 文件详细分析


### 📄 `core.js`

# 代码文件分析报告: `F:\pac-master\core.js`

## 1. 文件元数据 (File Metadata)
- **文件路径:** `F:\pac-master\core.js`
- **语言类型:** JavaScript
- **代码行数:** 约 253 行

## 2. 核心功能摘要 (Core Functionality Summary)
该文件是一个浏览器扩展/内容脚本环境中的核心前端逻辑文件，用于在网页中接收后台脚本嗅探到的 M3U8/HLS 媒体资源，并注入一个可拖拽的悬浮播放器进行播放。它还提供设置面板，用于配置广告关键词过滤和自动播放行为，并通过 `CustomEvent` 与扩展运行时消息机制交互完成设置读写。

## 3. 主要结构与组件 (Main Structures & Components)

### 3.1 函数/方法 (Functions/Methods)

- **`loadHlsJs`**:  
  功能：动态加载 Hls.js 播放库。  
  输入参数：无。  
  返回值：`Promise<void>`。  
  关键逻辑：
  - 首先检查全局变量 `Hls` 是否已存在。
  - 若已存在，直接 `resolve()`。
  - 若不存在，则创建 `<script>` 标签加载：
    ```js
    https://cdn.jsdelivr.net/npm/hls.js@latest/dist/hls.min.js
    ```
  - 加载成功或失败都会调用 `resolve()`，失败时仅打印错误日志，不中断后续逻辑。

- **`injectStyles`**:  
  功能：向页面注入播放器相关 CSS 样式。  
  输入参数：无。  
  返回值：无。  
  关键逻辑：
  - 如果页面中已经存在 `id="m3u8-purifier-styles"` 的 `<style>` 标签，则直接返回，避免重复注入。
  - 定义悬浮播放器背景层、容器、标题栏、按钮、视频元素的样式。
  - 创建 `<style>` 元素并追加到 `document.head`。

- **`processM3U8`**:  
  功能：处理 M3U8 文本内容，过滤广告片段，并修正相对路径为绝对路径。  
  输入参数：
  - `text`: M3U8 文件文本内容。
  - `m3u8Url`: M3U8 文件原始 URL。
  返回值：处理后的 M3U8 文本字符串；若处理异常，则返回原始 `text`。  
  关键逻辑：
  - 将 M3U8 文本按行切分。
  - 使用 `new URL(m3u8Url, self.location.href)` 解析资源地址。
  - 获取：
    - `origin`：资源源站地址。
    - `basePath`：M3U8 文件所在目录路径。
  - 从 `localSettings.keywords` 中读取广告关键词。
  - 遍历每一行：
    - 空行跳过。
    - 如果是非注释行，并且包含 `.ts` 或 `.m3u8`，则认为是媒体片段或子播放列表。
    - 若该行包含任意广告关键词：
      - 如果上一行是 `#EXTINF`，则将其移除。
      - 跳过当前广告资源行。
    - 如果资源行是相对路径：
      - 以 `/` 开头：拼接 `origin`。
      - 否则：拼接 `basePath`。
    - 其他注释行或非媒体资源行原样保留。
  - 最终使用 `\n` 拼接返回。

- **`PlayerManager.injectPlayer`**:  
  功能：在页面中注入悬浮视频播放器。  
  输入参数：
  - `mediaItem`: 媒体资源对象，至少应包含 `url` 字段，可能包含 `processedContent`。  
  返回值：无。  
  关键逻辑：
  - 如果当前已有播放器，则先调用 `destroyPlayer()` 清理。
  - 设置 `isPlayerActive = true`。
  - 暂停页面上除 `#purifier-player` 外的所有 `<video>` 和 `<audio>`。
  - 创建：
    - 背景层 `#m3u8-player-backdrop`
    - 播放器容器 `#m3u8-player-container`
    - 标题栏 `.m3u8-player-header`
    - 视频元素 `#purifier-player`
  - 容器位置使用 `localSettings.floatingPos`，否则使用默认位置：
    ```js
    { left: '100px', top: '100px', width: '60vw', height: 'auto' }
    ```
  - 设置关闭按钮、画中画按钮事件。
  - 调用 `setupPlayer()` 初始化播放。
  - 调用 `makeDraggable()` 实现拖拽。

- **`PlayerManager.setupPlayer`**:  
  功能：配置视频元素并加载媒体资源。  
  输入参数：
  - `video`: HTMLVideoElement。
  - `mediaItem`: 媒体资源对象。  
  返回值：无。  
  关键逻辑：
  - 开启原生控制栏：
    ```js
    video.controls = true;
    ```
  - 设置自动播放：
    ```js
    video.autoplay = true;
    ```
  - 默认播放地址为 `mediaItem.url`。
  - 如果存在 `mediaItem.processedContent`，则将处理后的 M3U8 文本转成 base64 Data URL：
    ```js
    data:application/vnd.apple.mpegurl;base64,...
    ```
  - 如果 Hls.js 可用且浏览器支持，并且播放地址是 `.m3u8` 或 Data URL：
    - 创建 `new Hls({ debug: false })`
    - `loadSource(urlToPlay)`
    - `attachMedia(video)`
    - 将 HLS 实例挂到 `video.hls` 上，便于销毁。
  - 否则直接设置：
    ```js
    video.src = urlToPlay;
    ```
  - 调用 `video.play()`，并忽略播放失败异常。

- **`PlayerManager.destroyPlayer`**:  
  功能：销毁当前悬浮播放器。  
  输入参数：无。  
  返回值：无。  
  关键逻辑：
  - 如果存在当前播放器容器：
    - 查找其中的 `<video>`。
    - 如果视频元素存在 `video.hls`，调用 `video.hls.destroy()` 释放 Hls.js 资源。
    - 移除播放器 DOM。
  - 重置：
    ```js
    isPlayerActive = false;
    mediaFoundAndHandled = false;
    ```

- **`PlayerManager.makeDraggable`**:  
  功能：使播放器容器可以通过标题栏拖拽。  
  输入参数：
  - `element`: 要移动的 DOM 元素。
  - `handle`: 拖拽句柄 DOM 元素。  
  返回值：无。  
  关键逻辑：
  - 支持鼠标和触摸事件。
  - 拖拽起始时记录鼠标/触摸点相对容器左上角的偏移。
  - 拖拽移动时实时更新：
    ```js
    element.style.left = `${coords.clientX - offsetX}px`;
    element.style.top = `${coords.clientY - offsetY}px`;
    ```
  - 点击按钮时不会触发拖拽。
  - 鼠标释放或触摸结束后停止拖拽。

- **`SettingsPanel.toggle`**:  
  功能：切换设置面板的打开/关闭状态。  
  输入参数：无。  
  返回值：无。  
  关键逻辑：
  - 若 `isOpen` 为真，则调用 `close()`。
  - 否则调用 `open()`。

- **`SettingsPanel.open`**:  
  功能：打开设置面板，并从扩展后台读取当前配置。  
  输入参数：无。  
  返回值：`Promise<void>`。  
  关键逻辑：
  - 如果已经打开，则直接返回。
  - 通过派发自定义事件请求设置：
    ```js
    __M3U8_PURIFIER_REQUEST__
    ```
    事件详情为：
    ```js
    { type: 'GET_SETTINGS' }
    ```
  - 监听：
    ```js
    __M3U8_PURIFIER_RESPONSE__
    ```
    获取 `SETTINGS_DATA`。
  - 创建全屏遮罩设置面板。
  - 面板中包含：
    - 广告关键词文本框。
    - 自动播放开关。
    - 关闭按钮。
    - 保存按钮。
  - 保存时构造：
    ```js
    {
      keywords: [...],
      autoPlay: boolean
    }
    ```
  - 派发 `SAVE_SETTINGS` 请求事件。
  - 更新本地 `localSettings`。
  - 弹出 `alert('设置已保存！')`。
  - 关闭设置面板。

- **`SettingsPanel.close`**:  
  功能：关闭并移除设置面板。  
  输入参数：无。  
  返回值：无。  
  关键逻辑：
  - 如果面板未打开或 DOM 不存在，直接返回。
  - 移除面板 DOM。
  - 清空 `panelElement`。
  - 设置 `isOpen = false`。

- **`handleMedia`**:  
  功能：处理后台脚本发现的媒体资源，并决定是否自动播放。  
  输入参数：
  - `mediaItem`: 媒体资源对象。  
  返回值：`Promise<void>`。  
  关键逻辑：
  - 如果当前页面不是顶层窗口，即 `window.self !== window.top`，则直接返回。
  - 如果已经处理过媒体资源，即 `mediaFoundAndHandled` 为真，则直接返回。
  - 设置 `mediaFoundAndHandled = true`，避免重复处理。
  - 如果设置中 `autoPlay === false`：
    - 重置 `mediaFoundAndHandled = false`。
    - 返回，不自动播放。
  - 调用 `loadHlsJs()` 加载 HLS 播放库。
  - 如果资源 URL 包含 `.m3u8`，且还没有 `processedContent`：
    - 使用 `fetch(mediaItem.url)` 请求 M3U8 文本。
    - 若请求成功，将文本保存到 `mediaItem.responseText`。
    - 调用 `processM3U8()` 生成过滤后的播放列表，保存到 `mediaItem.processedContent`。
  - 调用 `PlayerManager.injectPlayer(mediaItem)` 注入并播放媒体。

- **`Interceptor.activate`**:  
  功能：占位方法。  
  输入参数：无。  
  返回值：无。  
  关键逻辑：
  - 当前版本中无实际逻辑。
  - 注释说明该最终版本依赖 `background.js` 的 WebRequest 进行媒体嗅探，`core.js` 不再主动嗅探。

- **`initialize`**:  
  功能：初始化核心逻辑，包括设置通信、读取配置、样式注入、命令监听和后台消息监听。  
  输入参数：无。  
  返回值：`Promise<void>`。  
  关键逻辑：
  - 添加 `__M3U8_PURIFIER_REQUEST__` 事件监听器。
  - 当收到请求事件时，调用：
    ```js
    chrome.runtime.sendMessage(event.detail, callback)
    ```
    将请求转发给扩展后台。
  - 后台响应后，再派发：
    ```js
    __M3U8_PURIFIER_RESPONSE__
    ```
    类型固定为：
    ```js
    SETTINGS_DATA
    ```
  - 初始化阶段主动请求设置 `GET_SETTINGS`。
  - 调用 `injectStyles()` 注入 CSS。
  - 调用 `Interceptor.activate()`。
  - 监听 `__M3U8_PURIFIER_CMD__`：
    - 当命令类型为 `TOGGLE_SETTINGS_PANEL` 且当前窗口为顶层窗口时，切换设置面板。
  - 监听 `chrome.runtime.onMessage`：
    - 当消息类型为 `BACKGROUND_MEDIA_FOUND` 时，调用 `handleMedia(message.payload)`。

- **立即执行函数 `(function() { ... })()`**:  
  功能：封装整个文件逻辑，避免污染全局作用域。  
  输入参数：无。  
  返回值：无。  
  关键逻辑：
  - 使用 `'use strict'` 启用严格模式。
  - 初始化常量、状态变量、管理对象和核心函数。
  - 文件末尾调用 `initialize()` 启动逻辑。

### 3.2 类/结构体 (Classes/Structs)

该文件未使用 ES6 `class` 定义类，但定义了多个对象字面量形式的管理器。

- **`PlayerManager`**:  
  类型：对象字面量。  
  用途和职责：负责悬浮播放器的创建、播放源设置、销毁以及拖拽行为。
  - **主要属性:** `currentPlayerContainer` - 当前播放器外层 DOM 容器引用，初始值为 `null`。
  - **核心方法:** `injectPlayer` - 创建播放器 DOM 并插入页面。
  - **核心方法:** `setupPlayer` - 设置视频播放源，优先使用 Hls.js 播放 HLS/M3U8。
  - **核心方法:** `destroyPlayer` - 销毁播放器及其 Hls.js 实例。
  - **核心方法:** `makeDraggable` - 为播放器容器添加拖拽能力。

- **`SettingsPanel`**:  
  类型：对象字面量。  
  用途和职责：负责设置面板的展示、关闭、读取配置和保存配置。
  - **主要属性:** `isOpen` - 标识设置面板是否打开。
  - **主要属性:** `panelElement` - 当前设置面板 DOM 元素引用。
  - **核心方法:** `toggle` - 切换设置面板开关状态。
  - **核心方法:** `open` - 读取配置并渲染设置面板。
  - **核心方法:** `close` - 移除设置面板并更新状态。

- **`Interceptor`**:  
  类型：对象字面量。  
  用途和职责：媒体嗅探拦截器占位组件。
  - **核心方法:** `activate` - 当前为空实现，表示此版本依赖后台脚本 WebRequest 嗅探媒体。

### 3.3 接口/Traits (Interfaces/Traits)

该文件不包含 TypeScript 接口或 Rust Trait 定义。

但从代码使用情况可推断存在以下运行时消息/事件约定：

- **`__M3U8_PURIFIER_REQUEST__` 自定义 DOM 事件协议**:  
  描述：用于从页面脚本侧向扩展运行时请求设置读写。  
  可能的 `detail.type`：
  - `GET_SETTINGS`
  - `SAVE_SETTINGS`

- **`__M3U8_PURIFIER_RESPONSE__` 自定义 DOM 事件协议**:  
  描述：用于返回设置数据。  
  当前代码只处理：
  - `SETTINGS_DATA`

- **`__M3U8_PURIFIER_CMD__` 自定义 DOM 事件协议**:  
  描述：用于接收外部 UI 或注入脚本发出的控制命令。  
  当前代码只处理：
  - `TOGGLE_SETTINGS_PANEL`

- **`chrome.runtime.onMessage` 消息协议**:  
  描述：用于接收扩展后台脚本发现的媒体资源。  
  当前代码处理：
  - `BACKGROUND_MEDIA_FOUND`

### 3.4 常量/枚举 (Constants/Enums)

- **`SCRIPT_NAME`**:  
  类型：字符串常量。  
  值：
  ```js
  'M3U8 净化平台'
  ```
  描述：用于播放器标题和设置面板标题。

- **`ICONS`**:  
  类型：对象常量。  
  描述：包含播放器控制按钮使用的 SVG 图标。
  - `close`: 关闭图标。
  - `pip`: 画中画图标。

- **状态变量 `isPlayerActive`**:  
  类型：布尔变量。  
  初始值：`false`。  
  描述：标识播放器当前是否处于活动状态。

- **状态变量 `mediaFoundAndHandled`**:  
  类型：布尔变量。  
  初始值：`false`。  
  描述：用于防止同一页面重复处理多个后台发现的媒体资源。

- **状态变量 `localSettings`**:  
  类型：对象。  
  初始值：`{}`。  
  描述：保存本地加载到的设置，包括广告关键词、是否自动播放、悬浮窗位置等。

## 4. 依赖关系 (Dependencies)

### 4.1 内部依赖 (Internal Dependencies)
该文件没有通过 `import`、`require` 或 ES Module 显式导入项目内部模块。

但根据代码中的通信约定和注释，它依赖项目中其他扩展脚本提供能力：

- `background.js`  
  用途：
  - 通过 WebRequest 嗅探媒体资源。
  - 发送 `BACKGROUND_MEDIA_FOUND` 消息给当前脚本。
  - 响应 `GET_SETTINGS`、`SAVE_SETTINGS` 等设置请求。

- `injector.js`  
  用途：
  - 注释中提到其与 `background.js` 通信用于读写设置。
  - 可能负责向页面派发 `__M3U8_PURIFIER_CMD__` 或桥接 UI 命令。  
  注意：该文件未出现在用户提供的目录结构中，因此其存在无法由当前项目结构确认，只能基于代码注释说明。

### 4.2 外部依赖 (External Dependencies)
- `hls.js`  
  加载地址：
  ```js
  https://cdn.jsdelivr.net/npm/hls.js@latest/dist/hls.min.js
  ```
  用途：在不原生支持 HLS 的浏览器中播放 `.m3u8` 流媒体。

- `Chrome Extensions API / chrome.runtime`  
  用途：
  - `chrome.runtime.sendMessage`
  - `chrome.runtime.onMessage.addListener`  
  用于内容脚本与扩展后台脚本通信。

- 浏览器 Web API：
  - `document.createElement`
  - `document.addEventListener`
  - `CustomEvent`
  - `fetch`
  - `URL`
  - `HTMLMediaElement.play`
  - `HTMLMediaElement.pause`
  - `HTMLVideoElement.requestPictureInPicture`
  - DOM 样式与事件 API
  - `btoa`
  - `encodeURIComponent`
  - `unescape`

## 5. 暴露的接口/API (Exposed Interfaces/APIs)

该文件被立即执行函数包裹，没有通过模块系统导出任何变量、函数或类。因此没有传统意义上的 `export` API。

但它向外部运行环境暴露/监听以下事件与消息接口：

- **`__M3U8_PURIFIER_REQUEST__`**:  
  类型：DOM 自定义事件监听接口。  
  描述：接收设置读写请求，并通过 `chrome.runtime.sendMessage` 转发给扩展后台。

- **`__M3U8_PURIFIER_RESPONSE__`**:  
  类型：DOM 自定义事件派发接口。  
  描述：将扩展后台返回的数据以自定义事件形式派发回页面内其他脚本。

- **`__M3U8_PURIFIER_CMD__`**:  
  类型：DOM 自定义事件监听接口。  
  描述：接收外部命令，目前支持切换设置面板：
  ```js
  { type: 'TOGGLE_SETTINGS_PANEL' }
  ```

- **`chrome.runtime.onMessage` 中的 `BACKGROUND_MEDIA_FOUND`**:  
  类型：Chrome 扩展消息监听接口。  
  描述：接收后台脚本发现的媒体资源，并触发播放器注入和播放流程。

- **页面 DOM 注入元素**:  
  类型：DOM UI 接口。  
  描述：向宿主页面注入以下主要元素：
  - `#m3u8-purifier-styles`
  - `#m3u8-player-backdrop`
  - `#m3u8-player-container`
  - `#purifier-player`
  - 设置面板 DOM

## 6. 关键算法/逻辑流分析 (Key Algorithm/Logic Flow Analysis)

### 6.1 初始化流程

1. 文件作为 IIFE 立即执行。
2. 打印版本日志：
   ```js
   [M3U8 Purifier Core] v9.0.0 Executed! (DNR Edition)
   ```
3. 调用 `initialize()`。
4. `initialize()` 首先注册 `__M3U8_PURIFIER_REQUEST__` 事件监听器。
5. 该监听器将事件详情通过 `chrome.runtime.sendMessage` 发送给扩展后台。
6. 后台响应后，派发 `__M3U8_PURIFIER_RESPONSE__`，返回设置数据。
7. 初始化阶段主动请求 `GET_SETTINGS` 并写入 `localSettings`。
8. 注入播放器 CSS。
9. 启动 `Interceptor.activate()`，但当前为空实现。
10. 注册命令事件 `__M3U8_PURIFIER_CMD__`，用于打开或关闭设置面板。
11. 注册 `chrome.runtime.onMessage`，等待后台媒体嗅探结果。

### 6.2 媒体发现与播放流程

1. 后台脚本通过 `chrome.runtime.onMessage` 发送消息：
   ```js
   {
     type: 'BACKGROUND_MEDIA_FOUND',
     payload: mediaItem
   }
   ```
2. `core.js` 调用 `handleMedia(mediaItem)`。
3. `handleMedia` 先检查：
   - 是否为顶层窗口。
   - 是否已经处理过媒体。
4. 如果设置 `autoPlay === false`，则不播放。
5. 加载 Hls.js。
6. 如果媒体 URL 是 `.m3u8` 且没有已处理内容：
   - 使用 `fetch` 请求 M3U8 文本。
   - 调用 `processM3U8()` 过滤广告片段。
7. 调用 `PlayerManager.injectPlayer(mediaItem)` 注入悬浮播放器。
8. `injectPlayer` 暂停页面已有音视频，创建播放器 UI。
9. `setupPlayer` 根据播放源类型选择：
   - Hls.js 播放；
   - 或设置 `<video>.src` 直接播放。
10. 调用 `video.play()` 开始播放。

### 6.3 M3U8 广告过滤逻辑

该文件的核心“净化”逻辑集中在 `processM3U8()`。

处理步骤：

1. 将 M3U8 文本按换行符切分。
2. 初始化 `finalLines`。
3. 遍历每一行：
   - 去除首尾空白。
   - 空行忽略。
4. 对于媒体资源行：
   ```js
   !line.startsWith('#') && /\.(ts|m3u8)/i.test(line)
   ```
   判断其是否包含任何广告关键词。
5. 如果命中关键词：
   - 若上一行是 `#EXTINF`，删除上一行。
   - 当前资源行不加入结果。
6. 如果未命中关键词：
   - 若不是绝对 URL，则转换为绝对路径。
7. 注释行和其他行保留。
8. 返回新 M3U8 文本。

潜在特点：
- 它只识别 `.ts` 和 `.m3u8` 资源。
- 过滤策略基于字符串包含判断：
  ```js
  line.includes(k)
  ```
- 默认关键词在设置面板中为：
  ```js
  ['/ad', '-ad-']
  ```

### 6.4 设置面板通信流程

1. 外部派发：
   ```js
   __M3U8_PURIFIER_CMD__
   ```
   且 `detail.type === 'TOGGLE_SETTINGS_PANEL'`。
2. `SettingsPanel.toggle()` 被调用。
3. 如果打开面板：
   - 先通过 `GET_SETTINGS` 请求后台配置。
   - 收到 `SETTINGS_DATA` 后渲染面板。
4. 用户修改：
   - 广告关键词。
   - 自动播放开关。
5. 点击保存：
   - 将关键词按行拆分、去空白、过滤空行。
   - 生成 `settingsToSave`。
   - 派发 `SAVE_SETTINGS` 请求。
   - 合并更新 `localSettings`。
   - 弹出保存成功提示。
   - 关闭面板。

### 6.5 悬浮播放器拖拽逻辑

1. `PlayerManager.makeDraggable(container, header)` 将标题栏作为拖拽句柄。
2. 鼠标或触摸按下时：
   - 如果目标是按钮，则不启动拖拽。
   - 记录点击位置和容器位置之间的偏移。
3. 移动时：
   - 计算新位置。
   - 更新 `style.left` 和 `style.top`。
4. 释放时：
   - 设置 `isDragging = false`。
5. 当前实现没有把拖拽后的位置保存到 `localSettings.floatingPos` 或后台配置。

### 6.6 资源生命周期管理

播放器销毁时会做两件关键清理：

1. 如果使用 Hls.js，则调用：
   ```js
   video.hls.destroy()
   ```
   释放网络、MediaSource 等相关资源。
2. 移除播放器 DOM：
   ```js
   this.currentPlayerContainer.remove()
   ```

同时重置状态：
```js
isPlayerActive = false;
mediaFoundAndHandled = false;
```

### 6.7 潜在风险与注意点

- **对 `chrome.runtime` 的直接依赖缺少完整保护**:  
  `initialize()` 中部分代码直接使用：
  ```js
  chrome.runtime.onMessage.addListener(...)
  ```
  如果此脚本运行在非 Chrome 扩展上下文中，可能抛出 `ReferenceError: chrome is not defined`。

- **`chrome.runtime.sendMessage` 回调统一包装成 `SETTINGS_DATA`**:  
  即使请求是 `SAVE_SETTINGS`，响应事件类型仍为 `SETTINGS_DATA`。当前保存逻辑不依赖响应，因此问题不明显，但事件语义不够精确。

- **`loadHlsJs()` 加载失败也 resolve**:  
  如果 Hls.js 加载失败，后续会退化到直接设置 `video.src`。对于不原生支持 HLS 的浏览器，播放可能失败，但不会显式提示用户。

- **M3U8 过滤规则较简单**:  
  只根据资源行中是否包含关键词判断广告，可能误伤正常片段，也可能漏掉广告片段。  
  对更复杂的 HLS 标签，如 `#EXT-X-DISCONTINUITY`、`#EXT-X-KEY`、`#EXT-X-MAP`、`#EXT-X-BYTERANGE` 等没有专门处理。

- **相对路径处理有限**:  
  对 `../segment.ts` 这类路径，当前使用字符串拼接 `basePath + resolvedLine`，没有通过 `new URL(line, m3u8Url)` 进行标准化解析，可能产生不规范 URL。

- **Data URL 体积风险**:  
  将处理后的 M3U8 转为 base64 Data URL：
  ```js
  data:application/vnd.apple.mpegurl;base64,...
  ```
  对大型 M3U8 文件可能造成内存占用增加。

- **未保存播放器拖拽位置**:  
  虽然使用了 `localSettings.floatingPos` 作为初始位置，但拖拽后没有持久化新位置。

- **自动播放可能受浏览器策略限制**:  
  `video.play().catch(() => {})` 静默吞掉异常，用户可能不知道自动播放被浏览器阻止。

- **事件等待无超时机制**:  
  读取设置时通过 Promise 等待 `__M3U8_PURIFIER_RESPONSE__`，如果后台未响应，`open()` 或 `initialize()` 可能永久等待。

## 7. 标签/关键词 (Tags/Keywords)
- `M3U8播放`
- `HLS`
- `浏览器扩展`
- `内容脚本`
- `广告过滤`
- `悬浮播放器`
- `Chrome Runtime通信`
- `自定义DOM事件`

---


### 📄 `js-ad-rules.js`

# 代码文件分析报告: `F:\pac-master\js-ad-rules.js`

## 1. 文件元数据 (File Metadata)
- **文件路径:** `F:\pac-master\js-ad-rules.js`
- **语言类型:** JavaScript（Tampermonkey/Greasemonkey 用户脚本）
- **代码行数:** 大致 180 行

## 2. 核心功能摘要 (Core Functionality Summary)
该文件是一个 Tampermonkey 用户脚本，作用是在网页加载初期注入原生上下文脚本，拦截网页中的 `.m3u8` 播放列表请求，并根据远程规则清理其中的广告片段。它通过油猴沙盒层负责跨域获取和缓存规则，再将核心拦截逻辑注入到页面上下文中，劫持 `XMLHttpRequest` 和 `fetch` 以实现对 M3U8 内容的净化。

## 3. 主要结构与组件 (Main Structures & Components)

### 3.1 函数/方法 (Functions/Methods)

- **`syncRules`**:  
  功能：在 Tampermonkey 沙盒环境中读取本地缓存的广告过滤规则，并尝试从远程 GitHub 地址更新规则。  
  输入参数：无。  
  返回值：`Promise<Array>`，返回通过 `GM_getValue` 获取的缓存规则。  
  关键逻辑：
  - 使用 `GM_getValue('injected_rules', [])` 读取本地缓存规则。
  - 通过 `GM_xmlhttpRequest` 请求远程规则文件 `adclear.json`。
  - 请求 URL 追加时间戳参数 `?t=Date.now()`，避免浏览器缓存。
  - 如果响应状态为 `200`，尝试 `JSON.parse` 解析响应内容。
  - 解析成功后使用 `GM_setValue('injected_rules', rules)` 更新缓存。
  - 无论远程更新是否成功，立即返回当前缓存规则。

- **`injectedCore`**:  
  功能：被序列化并注入网页原生上下文执行的核心拦截逻辑，用于编译规则、净化 M3U8 内容，并劫持 `XMLHttpRequest` 和 `fetch`。  
  输入参数：
  - `rulesData`：从油猴沙盒层传入的规则数据，一般来自缓存的 `adclear.json`。  
  返回值：无显式返回值。  
  关键逻辑：
  - 调用内部函数 `compileRegex` 将规则中的正则表达式字符串编译为 `RegExp` 对象。
  - 如果没有可用规则，则直接退出，不进行劫持。
  - 定义 `purify` 函数清理 M3U8 内容。
  - 定义 `checkBuf` 函数按片段判断是否需要删除。
  - 代理全局 `window.XMLHttpRequest` 构造函数。
  - 包装全局 `window.fetch` 方法。
  - 对 URL 中包含 `.m3u8` 的请求响应进行内容替换和过滤。

- **`compileRegex`**:  
  功能：将规则数据中的正则表达式字符串编译为 JavaScript `RegExp` 对象。  
  输入参数：
  - `rules`：规则数组，预期每个元素包含 `regex` 字段。  
  返回值：`Array<RegExp>`，编译后的正则数组。  
  关键逻辑：
  - 遍历所有规则分组 `group`。
  - 将每个分组中的 `group.regex` 合并到 `patterns` 数组中。
  - 使用 `Set` 去重。
  - 对每个字符串执行 `new RegExp(str, 'gm')`。
  - 编译失败的正则返回 `null` 并被过滤掉。
  - 任意异常会导致返回空数组。

- **`purify`**:  
  功能：根据已编译的正则规则清理 M3U8 播放列表文本，删除广告相关片段。  
  输入参数：
  - `content`：原始 M3U8 文本内容。
  - `url`：请求的 M3U8 URL。  
  返回值：清理后的 M3U8 文本字符串。  
  关键逻辑：
  - 如果内容为空、不是字符串，或不包含 `#EXTINF`，则直接返回原始内容。
  - 对包含 `#EXT` 的正则规则执行全文替换。
  - 将剩余内容按行拆分。
  - 以 `#EXTINF` 为片段起点，将每个媒体片段暂存在 `buffer` 中。
  - 当遇到非注释且非空行时，认为一个片段结束，调用 `checkBuf` 判断是否保留。
  - 如果片段匹配非 `#EXT` 类型的广告正则，则删除该片段。
  - 最后将过滤后的行重新以 `\n` 拼接。
  - 如果有替换或内容长度减少，会输出拦截成功日志。

- **`checkBuf`**:  
  功能：检查一个 M3U8 片段缓冲区是否命中广告规则。  
  输入参数：
  - `buf`：字符串数组，表示一个 M3U8 媒体片段及相关标签。  
  返回值：
  - 如果命中广告规则，返回空数组 `[]`。
  - 否则返回原始 `buf`。  
  关键逻辑：
  - 将片段数组拼接成文本。
  - 遍历所有编译后的正则。
  - 对不包含 `#EXT` 的规则执行 `r.test(txt)`。
  - 一旦匹配成功，则认为该片段应被删除。
  - 未命中则保留。

- **`window.XMLHttpRequest` 包装函数**:  
  功能：替换页面环境中的 `XMLHttpRequest` 构造函数，以便拦截 XHR 请求返回的 `.m3u8` 内容。  
  输入参数：构造函数调用参数，代码中未显式定义。  
  返回值：真实 `XMLHttpRequest` 实例。  
  关键逻辑：
  - 保存原始 `window.XMLHttpRequest` 到 `RealXHR`。
  - 新构造函数内部创建 `new RealXHR()`。
  - 重写实例的 `open` 方法，记录请求 URL 到 `this._url`。
  - 监听 `readystatechange`。
  - 当 `readyState === 4` 且 `status === 200` 时，判断 URL 是否包含 `.m3u8`。
  - 读取 `xhr.responseText`。
  - 调用 `purify` 清理内容。
  - 使用 `Object.defineProperty` 强制覆盖实例上的 `responseText` 和 `response`。
  - 将新构造函数的 `prototype` 设置为 `RealXHR.prototype`，并复制原始构造函数的静态属性。

- **`window.fetch` 包装函数**:  
  功能：替换页面环境中的 `fetch`，拦截 `.m3u8` 请求响应并返回净化后的 `Response`。  
  输入参数：
  - `...args`：传给原始 `fetch` 的所有参数。  
  返回值：`Promise<Response>`。  
  关键逻辑：
  - 调用原始 `RealFetch(...args)` 获取响应。
  - 判断 `response.url` 是否包含 `.m3u8`。
  - 克隆响应 `response.clone()`。
  - 调用 `clone.text()` 读取文本。
  - 使用 `purify` 清理内容。
  - 构造新的 `Response`，保留原响应的 `status`、`statusText` 和 `headers`。
  - 如果处理失败，则返回原始响应。

- **`main`**:  
  功能：用户脚本入口函数，负责同步规则并将核心代码注入网页上下文。  
  输入参数：无。  
  返回值：`Promise<void>`。  
  关键逻辑：
  - 调用 `syncRules()` 获取缓存规则。
  - 将规则序列化为 JSON 字符串。
  - 使用 `injectedCore.toString()` 将核心函数转换为字符串。
  - 创建 `<script>` 元素，将核心函数和规则数据拼接为立即执行代码。
  - 将脚本插入 `document.head` 或 `document.documentElement`。
  - 插入后立即移除脚本标签，以减少被页面检测的可能。

### 3.2 类/结构体 (Classes/Structs)
- 本文件未定义自定义类或结构体。

### 3.3 接口/Traits (Interfaces/Traits)
- 本文件未定义接口或 Trait。

### 3.4 常量/枚举 (Constants/Enums)

- **`RULES_URL`**:  
  类型：常量字符串。  
  含义：远程广告清理规则文件地址。  
  当前值：
  ```js
  https://raw.githubusercontent.com/asdf1319964f/pac/refs/heads/master/adclear.json
  ```

- **`LOG_PREFIX`**:  
  类型：常量字符串。  
  含义：注入核心在控制台输出日志时使用的统一前缀。  
  定义于 `injectedCore` 内部：
  ```js
  const LOG_PREFIX = `[M3U8净化]`;
  ```

- **`COMPILED_REGEX`**:  
  类型：局部变量数组。  
  含义：保存由远程规则编译得到的 `RegExp` 对象集合。  
  定义于 `injectedCore` 内部：
  ```js
  let COMPILED_REGEX = [];
  ```

- **`RealXHR`**:  
  类型：局部常量。  
  含义：保存页面原始的 `window.XMLHttpRequest` 构造函数，便于包装后仍能调用真实 XHR。

- **`RealFetch`**:  
  类型：局部常量。  
  含义：保存页面原始的 `window.fetch` 函数，便于包装后仍能发起真实请求。

## 4. 依赖关系 (Dependencies)

### 4.1 内部依赖 (Internal Dependencies)
该文件没有通过 `import`、`require` 或模块系统显式引入项目内其他文件。

但从功能上依赖项目中的远程规则文件：

- `adclear.json`

该规则文件通过 `RULES_URL` 从 GitHub raw 地址加载，而不是本地直接读取。

### 4.2 外部依赖 (External Dependencies)

- `Tampermonkey/Greasemonkey API`
  - `GM_xmlhttpRequest`
  - `GM_setValue`
  - `GM_getValue`

- 浏览器 Web API
  - `window.XMLHttpRequest`
  - `window.fetch`
  - `Response`
  - `document.createElement`
  - `document.head`
  - `document.documentElement`
  - `Element.appendChild`
  - `Element.remove`
  - `console.log`
  - `Object.defineProperty`
  - `RegExp`

- 远程资源服务
  - `raw.githubusercontent.com`

## 5. 暴露的接口/API (Exposed Interfaces/APIs)

由于这是一个立即执行函数表达式，即 IIFE：

```js
(function() {
    ...
})();
```

文件内部定义的函数和常量不会直接暴露到全局作用域。

但它会在页面上下文中修改/覆盖以下全局 API，形成事实上的外部影响：

- **`window.XMLHttpRequest`**:  
  类型：全局构造函数覆盖。  
  描述：被替换为包装后的构造函数，用于拦截页面发起的 XHR 请求，并在 `.m3u8` 响应完成后尝试净化 `responseText` 与 `response`。

- **`window.fetch`**:  
  类型：全局函数覆盖。  
  描述：被替换为包装后的异步函数，用于拦截页面通过 Fetch API 请求的 `.m3u8` 内容，并返回净化后的 `Response`。

- **Tampermonkey 本地存储键 `injected_rules`**:  
  类型：持久化缓存数据。  
  描述：通过 `GM_setValue` 和 `GM_getValue` 读写，用于保存从远程 `adclear.json` 获取到的规则数据。

## 6. 关键算法/逻辑流分析 (Key Algorithm/Logic Flow Analysis)

### 6.1 整体执行流程

1. 脚本在 `document-start` 阶段运行。
2. 进入 IIFE，启用严格模式。
3. 调用 `main()`。
4. `main()` 先调用 `syncRules()` 获取缓存规则。
5. `syncRules()` 同时发起异步远程规则更新请求：
   - 若远程请求成功并解析成功，则更新本地缓存。
   - 当前页面实际使用的是函数调用开始时读取到的缓存规则，而不是本次网络请求刚更新的规则。
6. `main()` 将缓存规则序列化为 JSON。
7. 将 `injectedCore` 函数转成字符串，构造成 `<script>` 标签内容：
   ```js
   (function injectedCore(...) {...})(rulesData);
   ```
8. 将 `<script>` 插入页面 DOM。
9. 脚本在网页原生上下文中立即执行。
10. 执行后移除 `<script>` 标签。

### 6.2 沙盒层与网页层分工

该脚本明确区分两个运行环境：

- **Tampermonkey 沙盒层**
  - 可以使用 `GM_xmlhttpRequest` 跨域请求 GitHub。
  - 可以使用 `GM_setValue`、`GM_getValue` 持久化缓存。
  - 但直接修改页面原生对象时可能受隔离环境限制。

- **网页原生上下文**
  - 无法直接使用 Tampermonkey API。
  - 可以直接覆盖网页看到的 `window.XMLHttpRequest` 和 `window.fetch`。
  - 更适合对页面播放器代码产生实际影响。

通过动态创建 `<script>` 标签，脚本将 `injectedCore` 注入页面上下文，从而实现对原生 API 的修改。

### 6.3 规则编译逻辑

规则数据预期格式大致为：

```js
[
  {
    regex: [
      "pattern1",
      "pattern2"
    ]
  }
]
```

编译流程：

1. 初始化空数组 `patterns`。
2. 遍历每个规则组：
   ```js
   rules.forEach(group => {
       patterns = patterns.concat(group.regex);
   });
   ```
3. 使用 `Set` 去重：
   ```js
   patterns = [...new Set(patterns)];
   ```
4. 每条规则使用：
   ```js
   new RegExp(str, 'gm')
   ```
   编译为全局、多行正则。
5. 编译失败的规则被忽略。
6. 如果整个过程异常，则返回空规则数组。

潜在问题：
- 未校验 `group.regex` 是否存在或是否为数组。
- 正则统一使用 `g` 标志，后续 `test()` 调用可能受到 `lastIndex` 状态影响。
- 捕获异常时完全静默，不输出错误原因，不利于调试规则问题。

### 6.4 M3U8 净化逻辑

`purify(content, url)` 包含两层处理。

#### 第一层：全文正则替换

```js
for (let regex of COMPILED_REGEX) {
    if (regex.source.includes('#EXT')) {
        const matches = result.match(regex);
        if (matches) {
            dropped += matches.length;
            result = result.replace(regex, '');
        }
    }
}
```

含义：
- 对正则源码中包含 `#EXT` 的规则，认为它们是针对 M3U8 标签结构的规则。
- 直接在完整文本中执行匹配与替换。
- 命中后将匹配内容替换为空字符串。

作用：
- 适合删除成段的 M3U8 标签，例如广告标记、广告片段声明、特定 `#EXT-X-*` 块等。

#### 第二层：按媒体片段切片过滤

```js
const lines = result.split('\n');
const final = [];
let buffer = [];
```

处理思路：
- 按行解析 M3U8。
- 遇到 `#EXTINF` 表示一个媒体分片开始。
- 将 `#EXTINF` 与后续行放入 `buffer`。
- 当遇到一个非注释且非空行时，通常认为这是媒体切片 URI，该片段结束。
- 对完整片段调用 `checkBuf(buffer)`。

片段示意：

```m3u8
#EXTINF:5.000,
segment001.ts
```

如果片段文本命中普通广告规则：

```js
if (!r.source.includes('#EXT') && r.test(txt)) return [];
```

则整个片段被删除。

作用：
- 适合根据切片 URL、路径、文件名、广告域名等规则删除广告分片。
- 与全文替换配合，既可以删除标签块，也可以删除具体分片。

### 6.5 XHR 拦截流程

1. 保存原始构造函数：
   ```js
   const RealXHR = window.XMLHttpRequest;
   ```
2. 覆盖全局构造函数：
   ```js
   window.XMLHttpRequest = function() { ... };
   ```
3. 每次页面创建 XHR 时，内部仍然创建真实 XHR：
   ```js
   const xhr = new RealXHR();
   ```
4. 重写该实例的 `open` 方法，用于记录请求 URL：
   ```js
   this._url = url || '';
   ```
5. 添加 `readystatechange` 监听器。
6. 当请求完成且 HTTP 状态为 `200` 时：
   - 取 `_url` 或 `responseURL`。
   - 判断是否包含 `.m3u8`。
   - 读取 `responseText`。
   - 调用 `purify`。
   - 用 `Object.defineProperty` 覆盖 `responseText` 和 `response`。
7. 为减少被页面检测的概率：
   ```js
   window.XMLHttpRequest.prototype = RealXHR.prototype;
   Object.keys(RealXHR).forEach(k => window.XMLHttpRequest[k] = RealXHR[k]);
   ```

潜在问题：
- 某些情况下 `responseText` 是只读或不可重定义属性，`Object.defineProperty` 可能失败，但被静默捕获。
- 如果页面使用 `responseType = 'arraybuffer'`、`blob` 等，读取 `responseText` 可能抛错。
- URL 判断仅使用 `url.includes('.m3u8')`，可能漏掉不带 `.m3u8` 后缀的播放列表接口。
- 覆盖构造函数可能仍被高级反篡改检测识别，例如检查 `toString()`、属性描述符、函数名称等。

### 6.6 Fetch 拦截流程

1. 保存原始函数：
   ```js
   const RealFetch = window.fetch;
   ```
2. 覆盖：
   ```js
   window.fetch = async function(...args) { ... };
   ```
3. 调用真实 `fetch` 获取响应。
4. 根据 `response.url` 判断是否为 `.m3u8`。
5. 如果是：
   - 克隆响应。
   - 读取文本。
   - 调用 `purify`。
   - 使用清理后的文本构造新的 `Response`。
   - 保留原响应状态码、状态文本和响应头。
6. 如果处理失败，返回原始响应。

潜在问题：
- 新构造的 `Response` 不会保留原响应的一些属性，例如 `url`、`redirected`、`type` 等。
- 如果响应体不是文本或已被特殊编码，`clone.text()` 可能无法正确表示原始数据。
- 如果 `.m3u8` 请求 URL 被封装在接口中，而 `response.url` 不包含 `.m3u8`，则不会处理。
- 只处理 `response.url`，没有直接检查 `args[0]`，对于某些重定向或特殊请求可能判断不完整。

## 7. 标签/关键词 (Tags/Keywords)
- `Tampermonkey`
- `用户脚本`
- `M3U8净化`
- `广告过滤`
- `XMLHttpRequest劫持`
- `Fetch劫持`
- `脚本注入`
- `正则规则`

---


### 📄 `singbox.js`

# 代码文件分析报告: `F:\pac-master\singbox.js`

## 1. 文件元数据 (File Metadata)
- **文件路径:** `F:\pac-master\singbox.js`
- **语言类型:** JavaScript
- **代码行数:** 约 1800 行

## 2. 核心功能摘要 (Core Functionality Summary)
该文件是一个代理配置“中央编排器”，用于接收原始代理配置并生成增强后的 Clash/Mihomo 风格配置，包括系统参数、DNS、规则集、代理分组、区域自动分组、服务分组和自定义规则注入。文件还实现了节点质量评估、地理路由、缓存、指标统计、GitHub 镜像选择、AI 风格的节点评分与持久化等运行时管理能力，并暴露 `main`、`CentralManager`、`NodeManager`、`Config` 作为外部 API。

## 3. 主要结构与组件 (Main Structures & Components)

### 3.1 函数/方法 (Functions/Methods)

- **`main(config)`**:  
  文件主入口函数。  
  - **输入参数:** `config`，原始代理配置对象。
  - **返回值:** 处理后的最终配置对象。
  - **关键逻辑:**  
    1. 获取 `CentralManager` 单例。
    2. 调用 `centralManager.processConfiguration(config)` 执行基础增强配置生成。
    3. 注入两个自定义代理组：
       - `ISP专线-国内优选`
       - `特殊媒体-SG/HK`
    4. 根据关键词列表生成高优先级规则并插入到 `rules` 顶部。
    5. 返回增强后的配置。

- **`GH_RAW_URL(path)`**:  
  根据当前 GitHub 代理前缀拼接 Raw GitHub 资源地址。  
  - **输入参数:** `path`，GitHub raw 路径。
  - **返回值:** 完整 raw URL。

- **`GH_RELEASE_URL(path)`**:  
  根据当前 GitHub 代理前缀拼接 GitHub release 资源地址。  
  - **输入参数:** `path`。
  - **返回值:** 完整 GitHub URL。

- **`pickTestTarget()`**:  
  从 `GH_TEST_TARGETS` 中随机选择一个 GitHub 测试目标 URL。

- **`__probeMirror(prefix, fetchFn, timeoutMs)`**:  
  测试指定 GitHub 镜像前缀是否可用。  
  - **输入参数:** 镜像前缀、fetch 函数、超时时间。
  - **返回值:** 布尔值，表示镜像是否健康。
  - **关键逻辑:** 使用 `AbortController` 实现超时控制，向测试 URL 发起 GET 请求。

- **`selectBestMirror(runtimeFetch)`**:  
  自动选择可用的 GitHub 镜像源。  
  - **输入参数:** 运行时 fetch 函数。
  - **返回值:** 被选中的镜像前缀。
  - **关键逻辑:** 并发探测多个 GitHub 镜像，优先使用原始 GitHub，其次使用健康镜像，并通过 TTL 与锁变量避免频繁重复探测。

- **`ICON_VAL(fn)`**:  
  安全获取图标 URL。  
  - **输入参数:** 函数或值。
  - **返回值:** 图标 URL 或空字符串。
  - **关键逻辑:** 若传入的是函数则调用，否则直接返回；异常时返回空字符串。

- **`Utils.now()`**:  
  返回当前时间戳，封装 `Date.now()`。

- **`Utils.clamp(v, min, max)`**:  
  将数值限制在指定区间。

- **`Utils.clamp01(v)`**:  
  将数值限制在 `[0, 1]` 区间。

- **`Utils.isFunc(f)`**:  
  判断参数是否为函数。

- **`Utils.sleep(ms)`**:  
  返回一个指定延迟后 resolve 的 Promise。

- **`Utils.retry(fn, attempts, delay)`**:  
  异步重试工具。  
  - **输入参数:** 待执行函数、重试次数、基础延迟。
  - **返回值:** 成功结果。
  - **关键逻辑:** 指数退避重试，失败后抛出最后一次错误。

- **`Utils.asyncPool(tasks, limit)`**:  
  并发任务池。  
  - **输入参数:** 任务函数数组、并发限制。
  - **返回值:** 结果数组。
  - **关键逻辑:** 使用多个 runner 消费共享索引，限制最大并发；任务异常以 `{ __error }` 包装。

- **`Utils.calculateWeightedAverage(values, weightFactor)`**:  
  计算加权平均值，越新的数据权重越高。

- **`Utils.calculateStdDev(values)`**:  
  计算标准差。

- **`Utils.calculateTrend(values)`**:  
  计算一组数值的加权线性趋势斜率。

- **`Utils.calculatePercentile(values, p)`**:  
  计算百分位数。

- **`Utils.isValidDomain(d)`**:  
  校验域名格式是否合法。

- **`Utils.isIPv4(ip)`**:  
  基于正则判断字符串是否为 IPv4 格式。  
  注意：该函数只验证格式，不验证每段是否小于等于 255。

- **`Utils.isPrivateIP(ip)`**:  
  判断 IPv4 地址是否为私有或本地地址。  
  - **支持范围:** `10.0.0.0/8`、`127.0.0.0/8`、`192.168.0.0/16`、`172.16.0.0/12`。

- **`Utils.filterProxiesByRegion(proxies, region)`**:  
  根据区域正则筛选代理名称，并过滤高倍率节点。  
  - **输入参数:** 代理数组、区域对象。
  - **返回值:** 匹配的代理名称数组。
  - **关键逻辑:** 从节点名中解析倍率，如 `x2`、`倍率2`，超过 `Config.regionOptions.ratioLimit` 的节点会被过滤。

- **`Utils.createServiceGroups(config, regionGroupNames, ruleProviders, rules)`**:  
  根据 `Config.services` 创建各类服务代理组和规则。  
  - **输入参数:** 配置对象、区域组名列表、规则提供者 Map、规则数组。
  - **返回值:** 无显式返回，直接修改 `config`、`ruleProviders`、`rules`。
  - **关键逻辑:**  
    - 遍历启用的服务。
    - 注入服务规则和 rule-provider。
    - 构建服务代理组。
    - 根据节点质量对代理候选项排序。
    - 添加到 `config["proxy-groups"]`。

- **`Logger.error/info/warn/debug(...a)`**:  
  日志输出方法，分别调用 `console.error/info/warn/debug`。  
  `debug` 受 `CONSTANTS.ENABLE_SCORE_DEBUGGING` 控制。

- **`EventEmitter.on(ev, fn)`**:  
  注册事件监听器。

- **`EventEmitter.off(ev, fn)`**:  
  移除指定事件监听器。

- **`EventEmitter.emit(ev, ...args)`**:  
  触发事件并传递参数。

- **`EventEmitter.removeAllListeners(ev)`**:  
  移除某个事件或全部事件监听器。

- **`AppState.updateNodeStatus(nodeId, status)`**:  
  更新指定节点状态。  
  - **输入参数:** 节点 ID、状态对象。
  - **关键逻辑:** 合并旧状态与新状态，并更新 `lastUpdated`。

- **`LRUCache.get(key)`**:  
  获取缓存值。  
  - **返回值:** 命中且未过期时返回缓存值，否则返回 `null`。
  - **关键逻辑:** 命中后更新访问时间并移动到链表头部。

- **`LRUCache.set(key, value, ttl)`**:  
  设置缓存项。  
  - **关键逻辑:** 使用 Map + 双向链表实现 LRU；超过容量时淘汰尾部；会尝试清理过期项。

- **`LRUCache.delete(key)`**:  
  删除指定缓存项。

- **`LRUCache.clear()`**:  
  清空缓存。

- **`LRUCache._unlink(n)`**:  
  将节点从双向链表中移除。

- **`LRUCache._pushFront(n)`**:  
  将节点插入双向链表头部。

- **`LRUCache._evictTail()`**:  
  淘汰链表尾部最久未使用缓存项。

- **`LRUCache._cleanupExpiredEntries(limit)`**:  
  批量清理过期缓存项。

- **`RollingStats.add(v)`**:  
  向固定窗口统计器追加数据。

- **`RollingStats.average`**:  
  获取当前滑动窗口平均值。

- **`RollingStats.reset()`**:  
  重置统计数据。

- **`SuccessRateTracker.record(success, { hardFail })`**:  
  记录一次成功或失败。  
  - **关键逻辑:** 更新成功次数、总次数和连续硬失败次数。

- **`SuccessRateTracker.rate`**:  
  获取成功率。

- **`SuccessRateTracker.reset()`**:  
  重置成功率统计。

- **`NodeManager.getInstance()`**:  
  获取 `NodeManager` 单例。

- **`NodeManager.isInCooldown(id)`**:  
  判断节点是否处于切换冷却期。

- **`NodeManager._cooldownTime(id)`**:  
  根据节点质量动态计算冷却时间。  
  - **关键逻辑:** 节点质量越高，冷却时间越长。

- **`NodeManager._recordSwitchEvent(oldId, newId, targetGeo)`**:  
  记录节点切换事件到 debug 日志。

- **`NodeManager._updateNodeHistory(id, score)`**:  
  更新节点质量历史，并限制最大历史长度。

- **`NodeManager.updateNodeQuality(id, delta)`**:  
  增量更新节点质量分。  
  - **输入参数:** 节点 ID、质量分变化值。
  - **关键逻辑:** `delta` 被限制在 `[-20, 20]`，最终分数限制在 `[0, 100]`。

- **`NodeManager.switchToNode(id, targetGeo)`**:  
  切换到指定节点。  
  - **返回值:** 成功时返回节点对象，否则返回 `null`。
  - **关键逻辑:** 校验节点存在性，更新当前节点、冷却时间并记录日志。

- **`NodeManager._best(nodes)`**:  
  从候选节点中选择综合评分最高的节点。  
  - **关键逻辑:** 综合考虑节点质量、实时指标分、成功率和可用性惩罚。

- **`NodeManager.getBestNode(nodes, targetGeo)`**:  
  获取最佳节点。  
  - **输入参数:** 节点数组、可选目标地理信息。
  - **返回值:** 最佳节点对象或 `null`。
  - **关键逻辑:** 优先排除冷却中的节点；如果目标地理区域匹配，则优先区域节点；否则使用综合评分选择。

- **`NodeManager.switchToBestNode(nodes, targetGeo)`**:  
  切换到当前最佳节点。  
  - **关键逻辑:** 调用 `getBestNode`，更新当前节点与冷却时间。

- **`RegionAutoManager._buildKnownRegexMap()`**:  
  构建内置地区识别正则表。

- **`RegionAutoManager._normalizeName(name)`**:  
  规范化节点名称。

- **`RegionAutoManager._hasRegion(regions, name)`**:  
  判断区域列表中是否已有指定区域。

- **`RegionAutoManager.discoverRegionsFromProxies(proxies)`**:  
  从代理节点名称中自动发现区域。  
  - **返回值:** `Map<区域名, 区域配置>`。
  - **关键逻辑:** 使用内置正则识别常见国家/地区；额外支持 `ES`、`CA`、`AU`、`FR`、`IT`、`NL`、`RU`、`IN`、`BR`、`AR` 等缩写。

- **`RegionAutoManager.mergeNewRegions(configRegions, discoveredMap)`**:  
  将自动发现的新区域合并进已有区域配置。

- **`RegionAutoManager.buildRegionGroups(config, regions)`**:  
  构建区域代理组。  
  - **返回值:** `{ regionProxyGroups, otherProxyNames }`。
  - **关键逻辑:** 每个区域生成一个 `url-test` 代理组，未被区域组覆盖的节点放入 `其他节点`。

- **`CentralManager.getInstance()`**:  
  获取 `CentralManager` 单例。

- **`CentralManager.scoreComponents(m)`**:  
  静态方法，根据延迟、抖动、丢包、吞吐计算评分组件。  
  - **返回值:** `{ latencyScore, jitterScore, lossScore, throughputScore, metricScore }`。
  - **关键逻辑:** 延迟最高 35 分，抖动最高 25 分，丢包最高 25 分，吞吐最高 15 分。

- **`CentralManager._getFetchRuntime()`**:  
  获取可用的 `fetch` 与 `AbortController`。  
  - **关键逻辑:** 浏览器或现代 Node 中直接使用全局 `fetch`；Node 环境下尝试 `require("node-fetch")` 和 `require("abort-controller")`。

- **`CentralManager.isGeoExternalLookupEnabled()`**:  
  判断是否启用外部地理位置查询。

- **`CentralManager._safeFetch(url, options, timeout)`**:  
  带超时和 User-Agent 的安全 fetch。  
  - **关键逻辑:**  
    - 自动添加 UA。
    - 对 GitHub URL 自动选择镜像。
    - 使用 `AbortController` 或 `Promise.race` 实现超时。
    - fetch 不可用时抛出错误。

- **`CentralManager.initialize()`**:  
  初始化中央管理器。  
  - **关键逻辑:**  
    - 预选 GitHub 镜像。
    - 加载 AI 节点历史数据。
    - 注册事件监听器。
    - 触发节点预热。
    - 注册进程退出或浏览器卸载清理逻辑。

- **`CentralManager.destroy()`**:  
  清理资源。  
  - **关键逻辑:** 清理事件监听、保存 AI 数据、清空缓存。

- **`CentralManager.setupEventListeners()`**:  
  设置内部与环境事件监听器。

- **`CentralManager.cleanupEventListeners()`**:  
  清理已注册的事件监听器。

- **`CentralManager.onNodeUpdate(id, status)`**:  
  根据节点状态更新节点质量。

- **`CentralManager.onConfigChanged()`**:  
  配置变化时触发全量节点评估。

- **`CentralManager.onNetworkOnline()`**:  
  网络恢复时触发全量节点评估。

- **`CentralManager.onPerformanceThresholdBreached(nodeId)`**:  
  某节点性能低于阈值时触发单点评估。

- **`CentralManager.onEvaluationCompleted()`**:  
  节点评估完成后保存数据并自动清理异常节点。

- **`CentralManager.preheatNodes()`**:  
  预热前若干个节点。  
  - **关键逻辑:** 测试前 `PREHEAT_NODE_COUNT` 个节点，记录指标、质量分和可用性状态。

- **`CentralManager.calculateQuality(metrics)`**:  
  根据指标计算节点质量分，本质调用 `scoreComponents(metrics).metricScore`。

- **`CentralManager.evaluateAllNodes()`**:  
  并发评估所有节点质量。

- **`CentralManager.evaluateNodeQuality(node)`**:  
  评估单个节点质量。  
  - **关键逻辑:**  
    1. 调用 `testNodeMultiMetrics` 获取延迟、丢包、抖动、吞吐。
    2. 计算成功状态和可用率。
    3. 获取节点 IP 地理信息。
    4. 更新状态、指标和质量。
    5. 若当前节点质量低或不可用，则切换到最佳节点。

- **`CentralManager.handleRequestWithGeoRouting(targetIp)`**:  
  根据目标 IP 地理位置选择最佳节点。

- **`CentralManager.autoEliminateNodes()`**:  
  自动清理异常节点。  
  - **关键逻辑:** 样本数不足不清理；长时间未评估或分数低于阈值的节点会从状态、指标和质量表中删除。

- **`CentralManager.onRequestOutbound(reqCtx)`**:  
  根据请求上下文智能选择代理节点。  
  - **输入参数:** 请求上下文，包括 URL、host、port、headers、用户、客户端 IP 等。
  - **返回值:** `{ mode: "proxy" | "direct", node, targetGeo, clientGeo, reason }`。
  - **关键逻辑:**  
    - 解析 URL、协议、端口。
    - 识别视频、AI、大流量、游戏、TLS/HTTP 等请求类型。
    - 根据请求类型给节点加权偏置。
    - 尝试使用目标地理区域筛选节点。
    - 选择最佳节点并写入缓存。

- **`CentralManager.onResponseInbound(resCtx)`**:  
  根据响应结果更新节点指标，并在节点异常时切换节点。

- **`CentralManager.handleProxyRequest(req, ...args)`**:  
  代理请求处理入口。  
  - **关键逻辑:** 调用 `onRequestOutbound` 选择节点，再调用 `proxyRequestWithNode` 执行请求，最后通过 `onResponseInbound` 记录结果；异常时回退直连。

- **`CentralManager.smartDispatchNode(user, nodes, context)`**:  
  基于用户、地理位置、请求类型和缓存智能分配节点。  
  - **关键逻辑:**  
    - 优先使用缓存节点。
    - 视频流请求优先尝试高质量节点。
    - 有目标地区时优先区域节点。
    - 最后回退到 `NodeManager.getBestNode`。

- **`CentralManager.getGeoInfo(ip, domain)`**:  
  获取 IP 地理信息。  
  - **关键逻辑:**  
    - 私有 IP 直接返回 Local。
    - 使用 `geoInfoCache` 缓存。
    - 若允许外部查询，先查询 `ipapi.co`，再查询 `ipinfo.io`。
    - 失败时使用域名 TLD 推断或返回 Unknown。

- **`CentralManager.getIpGeolocation(ip)`**:  
  `getGeoInfo` 的别名方法。

- **`CentralManager._fetchGeoFromPrimaryAPI(ip)`**:  
  通过 `https://ipapi.co/{ip}/json/` 查询地理位置。

- **`CentralManager._fetchGeoFromFallbackAPI(ip)`**:  
  通过 `https://ipinfo.io/{ip}/json` 查询地理位置。

- **`CentralManager._getFallbackGeoInfo(domain)`**:  
  根据域名 TLD 推断地理信息，或返回 Unknown。

- **`CentralManager.resolveDomainToIP(domain)`**:  
  使用 DoH 将域名解析为 IPv4。  
  - **关键逻辑:** 同时向 Cloudflare、Google、Quad9 DoH 发起请求，返回第一个成功 A 记录，并缓存 10 分钟。

- **`CentralManager.proxyRequestWithNode(node, ...args)`**:  
  使用指定节点发起代理请求。  
  - **关键逻辑:** 实际上通过 `_safeFetch(node.proxyUrl || http://server)` 发起请求，并记录延迟与响应字节数。
  - **注意:** 该实现并不是真正意义上通过代理转发原始请求，而是对节点 URL 或 server 发起 fetch 探测式请求。

- **`CentralManager.proxyToDirect()`**:  
  返回直连成功对象 `{ success: true, direct: true }`。

- **`CentralManager.recordRequestMetrics(node, result, req)`**:  
  记录请求指标，并调用 AI 评分逻辑更新节点质量。

- **`CentralManager.aiScoreNode(node, metrics)`**:  
  根据历史指标和当前结果计算节点质量调整值。

- **`CentralManager.extractNodeFeatures(node, currentMetrics, recentMetrics, history)`**:  
  从节点历史指标中提取特征。  
  - **包括:** 当前延迟、丢包、抖动、吞吐、平均延迟、P95 延迟、成功率、趋势等。

- **`CentralManager.predictNodeFuturePerformance(f)`**:  
  根据特征预测未来性能风险。  
  - **返回值:** 风险、预期延迟、稳定性、置信度等。

- **`CentralManager.getDynamicRiskWeights(f)`**:  
  根据成功率和延迟波动动态调整风险权重。

- **`CentralManager.calculateScoreAdjustment(p, success)`**:  
  根据预测风险和当前成功状态生成质量分调整值。

- **`CentralManager.processConfiguration(config)`**:  
  配置处理核心方法。  
  - **输入参数:** 原始配置对象。
  - **返回值:** 增强后的配置对象。
  - **关键逻辑:**  
    1. 深拷贝原始配置。
    2. 校验代理节点或代理提供者存在。
    3. 注入系统配置和 DNS 配置。
    4. 自动发现区域。
    5. 生成区域代理组。
    6. 生成默认节点组。
    7. 添加 `直连` 节点。
    8. 添加规则集提供者。
    9. 添加服务代理组。
    10. 添加默认代理组。
    11. 添加区域代理组和其他节点组。
    12. 生成最终规则和 rule-provider。

- **`CentralManager.selfTest()`**:  
  内部自检方法。  
  - **关键逻辑:** 构造示例节点，验证是否能生成香港、美国、西班牙、土耳其等区域分组。

- **`MetricsManager.append(id, m)`**:  
  追加节点指标，并限制每个节点最多保存 `FEATURE_WINDOW_SIZE` 条指标。

- **`AvailabilityTracker.ensure(id)`**:  
  确保指定节点有成功率追踪器。

- **`AvailabilityTracker.record(id, success, opts)`**:  
  记录节点可用性结果，并更新应用状态。

- **`AvailabilityTracker.rate(id)`**:  
  获取指定节点成功率。

- **`AvailabilityTracker.hardFailStreak(id)`**:  
  获取连续硬失败次数。

- **`ThroughputEstimator.tcpConnectLatency(host, port, timeout)`**:  
  在 Node 环境下测量 TCP 连接延迟。  
  - **依赖:** Node 内置 `net` 模块。
  - **浏览器环境:** 直接抛出 `Not Node`。

- **`ThroughputEstimator.measureResponse(response)`**:  
  测量响应体大小并估算抖动。  
  - **关键逻辑:** 支持 Web Streams `getReader()`、`arrayBuffer()` 和 `Content-Length` 三种方式。

- **`ThroughputEstimator.bpsFromBytesLatency({ bytes, latency })`**:  
  根据字节数和延迟估算 bits per second，并限制最大值。

- **`CentralManager.prototype.loadAIDBFromFile()`**:  
  从持久化存储加载 AI 节点数据。  
  - **支持存储:** `$persistentStore`、`window.localStorage`。
  - **返回值:** Promise。
  - **关键逻辑:** 读取 `ai_node_data`，解析 JSON 后恢复到 `state.metrics`。

- **`CentralManager.prototype.saveAIDBToFile()`**:  
  保存 AI 节点数据到持久化存储。  
  - **支持存储:** `$persistentStore`、`window.localStorage`。
  - **关键逻辑:** 将 `state.metrics` 序列化为 JSON 并写入 `ai_node_data`。

- **`CentralManager.prototype.testNodeMultiMetrics(node)`**:  
  测试节点多维指标。  
  - **返回值:** `{ latency, loss, jitter, bytes, bps }`，失败时可能带 `__hardFail` 或 `__simulated`。
  - **关键逻辑:**  
    1. 优先从缓存读取。
    2. Node 环境下尝试 TCP 连接延迟。
    3. 使用 `_safeFetch` 探测节点 URL。
    4. 测量响应大小、抖动和吞吐。
    5. 网络探测失败时返回模拟数据。

### 3.2 类/结构体 (Classes/Structs)

- **`Logger`**:  
  日志工具类。  
  - **主要属性:** 无实例属性，全部为静态方法。
  - **核心方法:**  
    - `error` - 输出错误日志。
    - `info` - 输出信息日志。
    - `warn` - 输出警告日志。
    - `debug` - 条件输出调试日志。

- **`ConfigurationError`**:  
  配置错误类型，继承 `Error`。  
  - **主要属性:**  
    - `name` - 固定为 `"ConfigurationError"`。
  - **核心方法:** 构造函数设置错误消息和名称。

- **`InvalidRequestError`**:  
  请求错误类型，继承 `Error`。  
  - **主要属性:**  
    - `name` - 固定为 `"InvalidRequestError"`。
  - **核心方法:** 构造函数设置错误消息和名称。

- **`EventEmitter`**:  
  简单事件系统实现。  
  - **主要属性:**  
    - `eventListeners` - `Map`，保存事件名到监听函数数组的映射。
  - **核心方法:**  
    - `on` - 注册事件。
    - `off` - 取消事件。
    - `emit` - 触发事件。
    - `removeAllListeners` - 清理事件监听。

- **`AppState`**:  
  全局运行状态容器。  
  - **主要属性:**  
    - `nodes` - 节点状态 Map。
    - `metrics` - 节点指标 Map。
    - `config` - 当前配置对象。
    - `lastUpdated` - 最近更新时间。
  - **核心方法:**  
    - `updateNodeStatus` - 合并更新节点状态。

- **`LRUCache`**:  
  带 TTL 的 LRU 缓存。  
  - **主要属性:**  
    - `cache` - `Map`，存储 key 到缓存节点。
    - `maxSize` - 最大缓存容量。
    - `ttl` - 默认过期时间。
    - `head` - 双向链表头哨兵。
    - `tail` - 双向链表尾哨兵。
  - **核心方法:**  
    - `get` - 获取并刷新缓存项。
    - `set` - 设置缓存项。
    - `delete` - 删除缓存项。
    - `clear` - 清空缓存。
    - `_evictTail` - 淘汰最近最少使用项。
    - `_cleanupExpiredEntries` - 清理过期项。

- **`RollingStats`**:  
  固定窗口滚动统计器。  
  - **主要属性:**  
    - `windowSize` - 窗口大小。
    - `data` - 环形数组。
    - `index` - 当前写入位置。
    - `count` - 当前有效样本数。
    - `sum` - 样本总和。
  - **核心方法:**  
    - `add` - 添加样本。
    - `average` - 获取平均值。
    - `reset` - 重置。

- **`SuccessRateTracker`**:  
  成功率与连续失败追踪器。  
  - **主要属性:**  
    - `successCount` - 成功次数。
    - `totalCount` - 总次数。
    - `hardFailStreak` - 连续硬失败次数。
  - **核心方法:**  
    - `record` - 记录成功或失败。
    - `rate` - 获取成功率。
    - `reset` - 重置统计。

- **`NodeManager`**:  
  节点选择与切换管理器，继承 `EventEmitter`。  
  - **主要属性:**  
    - `currentNode` - 当前节点 ID。
    - `nodeQuality` - 节点质量 Map。
    - `switchCooldown` - 节点切换冷却 Map。
    - `nodeHistory` - 节点质量历史 Map。
    - `nodeSuccess` - 节点成功率追踪 Map。
  - **核心方法:**  
    - `getInstance` - 获取单例。
    - `updateNodeQuality` - 更新节点质量。
    - `getBestNode` - 选择最佳节点。
    - `switchToNode` - 切换到指定节点。
    - `switchToBestNode` - 切换到最佳节点。

- **`RegionAutoManager`**:  
  区域自动发现与区域代理组生成器。  
  - **主要属性:**  
    - `knownRegexMap` - 内置区域识别正则列表。
  - **核心方法:**  
    - `discoverRegionsFromProxies` - 从节点名称发现区域。
    - `mergeNewRegions` - 合并新区域。
    - `buildRegionGroups` - 构建区域代理组。

- **`CentralManager`**:  
  中央管理器，继承 `EventEmitter`，是本文件的核心控制器。  
  - **主要属性:**  
    - `state` - `AppState` 实例。
    - `stats` - `RollingStats` 实例。
    - `successTracker` - 全局成功率追踪器。
    - `nodeManager` - `NodeManager` 实例。
    - `lruCache` - 通用 LRU 缓存。
    - `geoInfoCache` - 地理信息缓存。
    - `metricsManager` - 指标管理器。
    - `availabilityTracker` - 可用性追踪器。
    - `throughputEstimator` - 吞吐估算器。
    - `regionAutoManager` - 区域自动管理器。
    - `eventListeners` - 注册的事件监听器集合。
    - `_listenersRegistered` - 事件监听注册状态。
  - **核心方法:**  
    - `processConfiguration` - 处理并增强配置。
    - `initialize` - 初始化运行环境。
    - `evaluateAllNodes` - 全量节点评估。
    - `evaluateNodeQuality` - 单节点评估。
    - `onRequestOutbound` - 请求出站节点选择。
    - `onResponseInbound` - 响应入站指标记录。
    - `getGeoInfo` - 查询地理信息。
    - `resolveDomainToIP` - DoH 解析域名。
    - `recordRequestMetrics` - 记录请求指标。
    - `aiScoreNode` - 基于历史指标调整节点评分。

- **`MetricsManager`**:  
  节点指标存储管理器。  
  - **主要属性:**  
    - `state` - 引用全局状态。
  - **核心方法:**  
    - `append` - 添加节点指标并裁剪历史窗口。

- **`AvailabilityTracker`**:  
  节点可用性管理器。  
  - **主要属性:**  
    - `state` - 引用全局状态。
    - `nodeManager` - 节点管理器。
    - `trackers` - 复用 `nodeManager.nodeSuccess`。
  - **核心方法:**  
    - `ensure` - 确保节点 tracker 存在。
    - `record` - 记录可用性。
    - `rate` - 获取成功率。
    - `hardFailStreak` - 获取连续硬失败次数。

- **`ThroughputEstimator`**:  
  吞吐与响应测量工具。  
  - **主要属性:** 无显式实例属性。
  - **核心方法:**  
    - `tcpConnectLatency` - 测量 TCP 连接延迟。
    - `measureResponse` - 读取响应并测量字节数和抖动。
    - `bpsFromBytesLatency` - 根据字节和延迟估算吞吐。

### 3.3 接口/Traits (Interfaces/Traits)
- 本文件为 JavaScript 文件，未定义 TypeScript 接口或 Rust Trait。
- 逻辑上存在以下隐式接口/对象约定：
  - **代理节点对象:**  
    预期包含 `id`、`name`、`server`、`proxyUrl`、`probeUrl`、`type` 等字段。
  - **配置对象:**  
    预期包含 `proxies`、`proxy-groups`、`rules`、`proxy-providers`、`rule-providers` 等 Clash/Mihomo 风格字段。
  - **请求上下文对象:**  
    `onRequestOutbound`、`handleProxyRequest`、`smartDispatchNode` 依赖 `url`、`headers`、`host`、`port`、`protocol`、`contentLength`、`clientIP` 等字段。
  - **地理信息对象:**  
    预期包含 `country`、`region` 或 `regionName` 字段。

### 3.4 常量/枚举 (Constants/Enums)

- **`PLATFORM`**:  
  冻结对象，用于标识当前运行环境。
  - `isNode` - 是否 Node.js 环境。
  - `isBrowser` - 是否浏览器环境。

- **`CONSTANTS`**:  
  冻结对象，集中保存运行参数与评分参数。  
  主要内容包括：
  - 节点预热数量：`PREHEAT_NODE_COUNT`
  - 节点测试超时：`NODE_TEST_TIMEOUT`
  - 节点切换冷却时间：`BASE_SWITCH_COOLDOWN`、`MIN_SWITCH_COOLDOWN`、`MAX_SWITCH_COOLDOWN`
  - 历史记录上限：`MAX_HISTORY_RECORDS`
  - 缓存容量与 TTL：`LRU_CACHE_MAX_SIZE`、`LRU_CACHE_TTL`
  - 并发限制：`CONCURRENCY_LIMIT`
  - 地理信息超时：`GEO_INFO_TIMEOUT`
  - 评分权重：`QUALITY_WEIGHT`、`METRIC_WEIGHT`、`SUCCESS_WEIGHT`
  - 网络指标限制：`LATENCY_CLAMP_MS`、`JITTER_CLAMP_MS`、`LOSS_CLAMP`
  - 请求识别正则：`STREAM_HINT_REGEX`、`AI_HINT_REGEX`
  - 特定端口列表：`GAMING_PORTS`、`TLS_PORTS`、`HTTP_PORTS`

- **`Utils`**:  
  工具函数集合对象。

- **`GH_MIRRORS`**:  
  GitHub 镜像前缀列表。包括原始 GitHub 和多个代理镜像。

- **`GH_TEST_TARGETS`**:  
  GitHub 镜像可用性测试目标列表。

- **`GH_PROXY_PREFIX`**:  
  当前选中的 GitHub 镜像前缀。

- **`__ghSelected`**:  
  最近一次选中的 GitHub 镜像。

- **`__ghLastProbeTs`**:  
  最近一次 GitHub 镜像探测时间戳。

- **`__GH_PROBE_TTL`**:  
  GitHub 镜像探测 TTL，值为 10 分钟。

- **`__ghSelectLock`**:  
  GitHub 镜像选择锁，用 Promise 串行化选择逻辑。

- **`ICONS`**:  
  图标 URL 生成器集合，包含代理、国家/地区、应用服务、广告、下载等图标。

- **`URLS`**:  
  外部规则集和 geodata 资源 URL 生成器集合。
  - `rulesets` - 应用规则、AI 规则、广告规则、日本银行类规则等。
  - `geox` - geoip、geosite、mmdb、asn 下载地址。

- **`Config`**:  
  全局基础配置对象。  
  - **核心配置区:**  
    - `enable`
    - `privacy`
    - `ruleOptions`
    - `preRules`
    - `regionOptions`
    - `dns`
    - `services`
    - `system`
    - `common`
  - **作用:** 控制规则启用、服务分组、系统参数、DNS 参数、地区识别、默认规则与默认代理组。

## 4. 依赖关系 (Dependencies)

### 4.1 内部依赖 (Internal Dependencies)
该文件没有使用 `import` 或 `require` 导入项目内其他文件。  
但根据项目结构和文件行为，它在运行时预期接收外部传入的配置对象，可能由代理配置处理器或订阅转换环境调用。

- 无显式内部模块依赖。

### 4.2 外部依赖 (External Dependencies)

- **Node.js 运行时全局/内置能力**
  - `process`
  - `require`
  - `module.exports`
  - `net`  
    用于 `ThroughputEstimator.tcpConnectLatency` 测量 TCP 连接延迟。

- **Web/现代 JS 运行时 API**
  - `fetch`
  - `AbortController`
  - `URL`
  - `window`
  - `window.localStorage`
  - `window.addEventListener`
  - `window.removeEventListener`

- **可选第三方包**
  - `node-fetch`  
    当 Node 环境没有全局 `fetch` 时尝试加载。
  - `abort-controller`  
    当环境没有全局 `AbortController` 时尝试加载。

- **特定代理脚本环境 API**
  - `$persistentStore`  
    用于读取和保存 `ai_node_data`。

- **外部网络服务/API**
  - GitHub raw/release 资源。
  - GitHub 镜像：
    - `https://mirror.ghproxy.com/`
    - `https://github.moeyy.xyz/`
    - `https://ghproxy.com/`
  - IP 地理信息：
    - `https://ipapi.co/{ip}/json/`
    - `https://ipinfo.io/{ip}/json`
  - DNS over HTTPS：
    - `https://1.1.1.1/dns-query`
    - `https://8.8.8.8/dns-query`
    - `https://9.9.9.9/dns-query`
  - 规则集和图标资源：
    - `Koolson/Qure`
    - `DustinWin/ruleset_geodata`
    - `dahaha-365/YaNet`
    - `217heidai/adblockfilters`
    - `MetaCubeX/meta-rules-dat`

## 5. 暴露的接口/API (Exposed Interfaces/APIs)

- **`main`**:  
  类型: 函数。  
  用途: 外部调用的配置处理入口，接收原始配置并返回增强后的最终配置。

- **`CentralManager`**:  
  类型: 类。  
  用途: 中央编排与运行时管理核心，提供配置处理、节点评估、地理路由、请求调度、指标统计和数据持久化等能力。

- **`NodeManager`**:  
  类型: 类。  
  用途: 管理当前节点、节点质量、节点切换、冷却机制和最佳节点选择。

- **`Config`**:  
  类型: 常量对象。  
  用途: 外部可读取或修改的基础配置对象，用于控制规则开关、服务分组、区域识别、DNS、系统参数等。

导出方式：

```js
if (typeof module !== "undefined") {
  module.exports = { main, CentralManager, NodeManager, Config };
}
```

因此该文件主要面向 CommonJS/Node 风格调用环境。

## 6. 关键算法/逻辑流分析 (Key Algorithm/Logic Flow Analysis)

### 6.1 主配置生成流程

入口为 `main(config)`。

核心流程如下：

1. **获取中央管理器单例**
   ```js
   const centralManager = CentralManager.getInstance();
   ```

2. **调用基础配置处理**
   ```js
   const finalConfig = centralManager.processConfiguration(config);
   ```

3. **自动配置处理内部逻辑**
   `processConfiguration` 会：
   - 深拷贝传入配置，避免直接修改原始对象。
   - 校验是否存在 `proxies` 或 `proxy-providers`。
   - 合并 `Config.system` 到顶层配置。
   - 注入 `Config.dns`。
   - 从节点名称自动发现地区。
   - 构造区域代理组，例如：
     - `HK香港`
     - `US美国`
     - `JP日本`
     - `SG新加坡`
     - `TR土耳其`
     - 自动识别的 `ES西班牙` 等。
   - 创建核心代理组 `默认节点`。
   - 确保存在 `直连` 代理。
   - 创建服务代理组，例如：
     - `国外AI`
     - `YouTube`
     - `NETFLIX`
     - `Github`
     - `广告过滤`
     - `日本网站`
   - 创建默认代理组：
     - `下载软件`
     - `其他外网`
     - `国内网站`
   - 写入规则和 `rule-providers`。

4. **注入自定义 ISP 分组**
   ```js
   const groupNameISP = "ISP专线-国内优选";
   const specificNodes = findProxies(/济南联通|徐州移动|联通|移动/);
   ```
   - 若存在匹配节点，则代理组使用这些节点加 `直连`。
   - 若不存在，则回退为 `["直连", "国内网站"]`。
   - 组类型为 `url-test`，用于自动选择低延迟节点。

5. **注入自定义特殊媒体分组**
   ```js
   const groupNameAdult = "特殊媒体-SG/HK";
   ```
   - 优先使用已生成的 `SG新加坡`、`HK香港` 区域组。
   - 若不存在，则回退到 `["默认节点", "其他外网"]`。
   - 组类型为 `url-test`。

6. **将自定义代理组插入最前**
   ```js
   finalConfig["proxy-groups"].unshift(groupAdult);
   finalConfig["proxy-groups"].unshift(groupISP);
   ```

7. **注入高优先级 DOMAIN-KEYWORD 规则**
   - 国内/ISP 关键词：
     - `c0.jdbstatic.com`
     - `miaogongzi`
     - `jfg`
     - `jifangge`
     - `jfgso`
     - `deepseek`
   - 特殊媒体关键词：
     - `jav`
     - `missav`
     - `rou`
     - `18comic`
     - `zuise`
     - `jmcomic`
     - `manwa`

8. **将新规则插入规则顶部**
   ```js
   finalConfig.rules = [...newRules, ...finalConfig.rules];
   ```

9. **返回最终配置**

### 6.2 区域自动分组逻辑

主要由 `RegionAutoManager` 和 `Utils.filterProxiesByRegion` 完成。

1. 从 `safe.proxies` 遍历每个节点名称。
2. 用内置正则识别常见区域，如香港、美国、日本、新加坡等。
3. 从名称中提取英文缩写或中文片段。
4. 对部分白名单缩写生成额外区域，例如：
   - `ES` -> `ES西班牙`
   - `CA` -> `CA加拿大`
   - `AU` -> `AU澳大利亚`
5. 合并到 `Config.regionOptions.regions`。
6. 为每个区域生成 `url-test` 代理组。
7. 过滤高倍率节点：
   ```js
   const m = name.match(/(?:[xX✕✖⨉]|倍率)(\d+\.?\d*)/i);
   ```
   若倍率超过 `ratioLimit`，默认 2，则不加入区域组。
8. 没被任何区域组收纳的节点放入 `其他节点`。

### 6.3 节点评分逻辑

核心评分由 `CentralManager.scoreComponents(m)` 实现。

评分维度：

1. **延迟分**
   ```js
   latencyScore = clamp(35 - latency / 25, 0, 35)
   ```
   延迟越低分数越高，最高 35 分。

2. **抖动分**
   ```js
   jitterScore = clamp(25 - jitter, 0, 25)
   ```
   抖动越低分数越高，最高 25 分。

3. **丢包分**
   ```js
   lossScore = clamp(25 * (1 - loss), 0, 25)
   ```
   丢包越少分数越高，最高 25 分。

4. **吞吐分**
   ```js
   throughputScore = clamp(Math.round(Math.log10(1 + bps) * 2), 0, 15)
   ```
   使用对数函数降低高吞吐的边际收益，最高 15 分。

5. **总指标分**
   ```js
   metricScore = clamp(round(latencyScore + jitterScore + lossScore + throughputScore), 0, 100)
   ```

### 6.4 最佳节点选择逻辑

由 `NodeManager.getBestNode` 和 `_best` 实现。

1. 先排除处于冷却期的节点。
2. 若所有节点都在冷却期，则使用原节点池。
3. 如果提供了 `targetGeo`，则优先筛选地理区域匹配的节点。
4. 对候选节点计算综合分：
   - `nodeQuality`
   - `metricScore`
   - `successRate`
   - 可用率低于阈值时加惩罚
5. 返回分数最高的节点。

综合分大致为：

```js
quality * QUALITY_WEIGHT
+ metricScore * METRIC_WEIGHT
+ successRate * SUCCESS_WEIGHT
+ availabilityPenalty
```

其中默认权重：
- 质量：0.5
- 指标：0.35
- 成功率：0.15

### 6.5 请求智能调度逻辑

`CentralManager.onRequestOutbound(reqCtx)` 根据请求上下文选择代理节点。

判断维度包括：

- 视频流：
  - `Content-Type` 包含 `video`
  - URL 命中 `youtube|netflix|stream|video|live|hls|dash`
- AI 请求：
  - URL 或 hostname 命中 `openai|claude|gemini|ai|chatgpt|api.openai|anthropic|googleapis`
- 大文件：
  - `contentLength >= 512KB`
- 游戏端口：
  - 如 `3074`、`27015`、`27036` 等
- TLS/HTTP 端口：
  - HTTPS/TLS: `443`、`8443`
  - HTTP: `80`、`8080`、`8880`

偏好策略：

- 视频和大文件偏向高吞吐。
- 游戏、AI、TLS 偏向低延迟。
- AI 和视频偏向稳定低抖动。
- 可用率不足的节点受到强惩罚。

最终按 bias 排序后，再交给 `NodeManager.getBestNode` 做最终选择。

### 6.6 AI 风格节点质量调整逻辑

虽然名称中使用了 AI，但代码中没有机器学习模型。它是基于规则和统计特征的启发式预测。

流程：

1. `recordRequestMetrics` 记录请求结果。
2. 调用 `aiScoreNode`。
3. 若样本数不足：
   - 成功：`+2`
   - 失败：`-2`
4. 样本足够时，提取特征：
   - 当前延迟、丢包、抖动、吞吐。
   - 平均延迟。
   - P95 延迟。
   - 加权延迟。
   - 延迟标准差。
   - 成功率。
   - 延迟趋势。
   - 丢包趋势。
   - 成功趋势。
   - 历史质量趋势。
5. `predictNodeFuturePerformance` 计算风险值。
6. `calculateScoreAdjustment` 根据风险调整质量：
   - 请求失败：`-10`
   - 风险 < 0.3：`+5`
   - 风险 < 0.5：`+2`
   - 风险 > 0.7：`-3`
   - 其他：`0`

### 6.7 GitHub 镜像选择逻辑

该文件大量使用 GitHub 资源，如图标、规则集和 geodata。为提高可用性，实现了镜像探测：

1. 镜像列表：
   - 原始 GitHub
   - `mirror.ghproxy.com`
   - `github.moeyy.xyz`
   - `ghproxy.com`
2. 并发访问随机测试 URL。
3. 如果原始 GitHub 可用，优先使用原始 URL。
4. 否则选择第一个可用镜像。
5. 使用 `__GH_PROBE_TTL` 缓存选择结果，避免频繁探测。

### 6.8 缓存实现逻辑

`LRUCache` 使用 Map + 双向链表实现：

- Map 用于 O(1) 查找。
- 双向链表维护访问顺序。
- `get` 时将节点移动到头部。
- `set` 新值时插入头部。
- 超过容量时移除尾部。
- 每个缓存项带有独立 TTL。
- 支持清理过期项。

用途包括：

- 请求到节点选择缓存。
- DNS 解析缓存。
- 节点指标测试缓存。
- IP 地理信息缓存。

### 6.9 地理信息与隐私逻辑

配置项：

```js
privacy: {
  geoExternalLookup: true
}
```

当 `geoExternalLookup` 为 `true` 时：

1. IP 地理查询先使用 `ipapi.co`。
2. 失败后使用 `ipinfo.io`。
3. 再失败则根据域名 TLD 或 Unknown 回退。

当 `geoExternalLookup` 为 `false` 时：

- 不访问外部 IP 地理 API。
- 使用 `_getFallbackGeoInfo` 根据域名后缀推断。
- 这能减少隐私泄露风险，但地理路由准确性下降。

### 6.10 自定义规则注入逻辑

文件末尾 `main` 中的自定义逻辑是该文件区别于通用编排器的关键业务逻辑。

新增分组一：

```js
ISP专线-国内优选
```

匹配节点名：

```js
/济南联通|徐州移动|联通|移动/
```

用于关键词：

- `c0.jdbstatic.com`
- `miaogongzi`
- `jfg`
- `jifangge`
- `jfgso`
- `deepseek`

生成规则示例：

```txt
DOMAIN-KEYWORD,deepseek,ISP专线-国内优选
```

新增分组二：

```js
特殊媒体-SG/HK
```

优先代理：

- `SG新加坡`
- `HK香港`

用于关键词：

- `jav`
- `missav`
- `rou`
- `18comic`
- `zuise`
- `jmcomic`
- `manwa`

生成规则示例：

```txt
DOMAIN-KEYWORD,missav,特殊媒体-SG/HK
```

这些规则被插入到最终规则最顶部，因此优先级高于原有规则。

### 6.11 潜在风险与注意事项

1. **文件名为 `singbox.js`，但配置结构更接近 Clash/Mihomo**
   - 使用了 `proxy-groups`、`rule-providers`、`GEOSITE`、`GEOIP`、`RULE-SET` 等 Clash/Mihomo 风格字段。
   - 如果目标实际是 sing-box 原生配置，可能并不直接兼容。

2. **`processConfiguration` 使用 JSON 深拷贝会丢失正则**
   ```js
   safe = JSON.parse(JSON.stringify(config));
   ```
   原始传入配置中的函数、正则、`undefined`、Map 等都会丢失。  
   但该函数主要依赖 `Config` 内部正则，而非 `safe` 中的正则，因此对当前逻辑影响有限。

3. **节点 ID 假设可能不总是成立**
   - 很多逻辑依赖 `node.id`。
   - 常见 Clash 代理节点通常只有 `name`，不一定有 `id`。
   - 若输入节点没有 `id`，运行时评分、切换、指标记录能力会受限。
   - 配置生成部分主要依赖 `name`，仍可工作。

4. **`proxyRequestWithNode` 不是真正代理转发**
   - 该方法对 `node.proxyUrl` 或 `http://${node.server}` 发起 fetch。
   - 这更像节点探测，不等价于通过代理节点转发用户请求。

5. **`Utils.isIPv4` 校验不严格**
   - `999.999.999.999` 也会被正则认为是 IPv4 格式。
   - 后续外部 API 可能处理失败。

6. **地理信息查询存在隐私泄露风险**
   - 默认 `geoExternalLookup: true`。
   - 会将 IP 发送到第三方服务 `ipapi.co` 和 `ipinfo.io`。
   - 如果注重隐私，应设置为 `false`。

7. **外部规则和图标依赖 GitHub 可用性**
   - 虽然实现了镜像选择，但镜像服务稳定性和可信度不可完全保证。

8. **`LRUCache.set` 的过期清理触发阈值较低**
   ```js
   if (this.cache.size / this.maxSize > CONSTANTS.CACHE_CLEANUP_THRESHOLD)
   ```
   `CACHE_CLEANUP_THRESHOLD` 为 `0.1`，意味着缓存超过 10% 容量就会尝试清理过期项。  
   这不是错误，但可能比常见实现更频繁。

9. **`CentralManager` 构造函数中自动异步初始化**
   - 创建单例后立即异步执行 `initialize()`。
   - 如果外部调用马上依赖初始化结果，可能出现初始化尚未完成的情况。
   - `main(config)` 中主要调用 `processConfiguration`，不强依赖初始化完成。

10. **事件监听可能重复注册 `requestDetected`**
    - `initialize()` 中每次都会执行：
      ```js
      this.on("requestDetected", ...)
      ```
    - `_listenersRegistered` 只保护 `setupEventListeners()`，没有保护该 `requestDetected` 注册。
    - 如果 `initialize()` 被重复调用，可能重复处理事件。

## 7. 标签/关键词 (Tags/Keywords)
- `代理配置生成`
- `Clash/Mihomo配置`
- `节点质量评估`
- `区域自动分组`
- `智能路由`
- `规则集注入`
- `LRU缓存`
- `GitHub镜像选择`

---


---

## ✅ 分析完成

**总计分析文件数:** 3
**完成时间:** 2026/5/3 22:26:53

---
*本报告由 ProjectAnalyst 插件自动生成*
