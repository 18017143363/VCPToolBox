# 项目分析报告: neural-phantom-4.7

**分析ID:** neural-phantom-4.7-2026-05-03.22.52  
**分析时间:** 2026/5/3 22:52:14  
**项目路径:** F:\neural-phantom-4.7

---

## 📋 项目简介

**核心功能:** 该项目是一个浏览器扩展，用于通过后台脚本、页面注入脚本和规则配置对网页请求或页面行为进行拦截、注入与控制。

**关键实现:**
*   `manifest.json`: 浏览器扩展的核心配置文件，定义扩展权限、后台脚本、注入脚本、页面入口和规则集等关键能力。
*   `background.js`: 扩展后台逻辑的主要实现位置，通常负责事件监听、请求处理、规则调度和扩展生命周期管理。
*   `inject.js`: 负责向目标网页注入脚本或逻辑，是扩展影响页面运行环境、实现页面级控制的关键入口。

---

## 📁 文件结构树

```
├── background.js
├── chain.html
├── chain.js
├── console.html
├── console.js
├── dashboard.css
├── icon.png
├── inject.js
├── manifest.json [配置文件]
├── page-script.js
├── rules.json [配置文件]
└── _metadata/
    └── generated_indexed_rulesets/
        └── _ruleset1

```

---

## 📝 文件详细分析


### 📄 `background.js`

# 代码文件分析报告: `F:\neural-phantom-4.7\background.js`

## 1. 文件元数据 (File Metadata)
- **文件路径:** `F:\neural-phantom-4.7\background.js`
- **语言类型:** JavaScript
- **代码行数:** 约 1250 行

## 2. 核心功能摘要 (Core Functionality Summary)
该文件是 Chrome 扩展 “Neural Phantom” 的后台 Service Worker / background 核心逻辑，负责通过 `chrome.debugger`、`chrome.webRequest`、`chrome.runtime` 等扩展 API 捕获、缓存、分析和转发浏览器网络流量。它集成了请求/响应日志、响应体缓存、WebSocket 抓包、HAR 录制回放、密钥嗅探、安全扫描、参数溯源、AI 分析、视频播放链路追踪、预挂钩 debugger 附加等多种能力，是整个扩展的数据采集与分析中枢。

## 3. 主要结构与组件 (Main Structures & Components)

### 3.1 函数/方法 (Functions/Methods)
- **`parseSetCookieHeader(raw)`**: 解析单条 `Set-Cookie` 响应头。
  - **输入参数:** `raw`，原始 Set-Cookie 字符串。
  - **返回值:** `{ name, value, full }` 或 `null`。
  - **关键逻辑:** 截取第一个分号前的 `name=value` 部分，再按第一个等号拆分 Cookie 名和值。

- **`indexSetCookie(url, requestId, responseHeaders)`**: 建立 Cookie 来源索引。
  - **输入参数:** 响应 URL、请求 ID、响应头对象。
  - **返回值:** 无。
  - **关键逻辑:** 从响应头中查找 `set-cookie`，解析 Cookie 名和值，并写入 `cookieOriginIndex`，用于后续 Cookie 来源分析。超过 `MAX_COOKIE_ORIGIN` 时按插入顺序删除最早记录。

- **`_truncate(s, n)`**: 字符串截断工具。
  - **输入参数:** 任意值 `s`、最大长度 `n`。
  - **返回值:** 截断后的字符串。
  - **关键逻辑:** 将 `null/undefined` 转为空字符串，超过长度时追加省略号 `…`。

- **`findInCryptoEvents(value)`**: 在加密事件中查找某个值的来源。
  - **输入参数:** 待匹配值。
  - **返回值:** 命中时返回算法、明文、密钥、栈帧等信息，否则返回 `null`。
  - **关键逻辑:** 遍历 `MediaChainEngine._sessionEvents` 中 `step === 'CRYPTO_CALL'` 的事件，判断目标值是否出现在 `plaintext` 或 `key` 中。

- **`analyzeCookieOne(name, value)`**: 分析单个 Cookie 的来源。
  - **输入参数:** Cookie 名和值。
  - **返回值:** 包含 `verdict` 与 `details` 的分析结果。
  - **关键逻辑:** 依次判断是否为常见客户端追踪 Cookie、是否来自 `Set-Cookie`、是否出现在响应体、是否与加密事件相关，否则标记为未知。

- **`analyzeHeaderOne(name, value)`**: 分析单个请求头的来源。
  - **输入参数:** Header 名和值。
  - **返回值:** 包含来源判定的对象。
  - **关键逻辑:** 判断是否为浏览器自动生成 Header；否则在响应缓存、加密事件中检索，未命中则认为可能由 JS 设置。

- **`analyzeRequestAuth(requestIdOrUrl)`**: 分析某个请求的 Header 与 Cookie 来源。
  - **输入参数:** 请求 ID、URL 或包含二者的对象。
  - **返回值:** 请求认证相关头部与 Cookie 的溯源结果。
  - **关键逻辑:** 根据 requestId 或 URL 在 `globalLogs` 中定位日志，遍历请求头，将 Cookie 拆分后分别调用 `analyzeCookieOne`，其他 Header 调用 `analyzeHeaderOne`，最后按 `verdict` 聚合统计。

- **`fetchAndCacheBody(debuggee, requestId, meta)`**: 拉取并缓存响应体。
  - **输入参数:** debugger 目标、请求 ID、请求元信息。
  - **返回值:** 无。
  - **关键逻辑:**  
    1. 跳过媒体、字体、WASM、二进制等大文件。
    2. 通过 `Network.getResponseBody` 获取响应体。
    3. 失败时进行多次延迟重试。
    4. 缓存响应体到 `contentCache`。
    5. 对响应体执行密钥扫描、敏感字段扫描、GraphQL 识别、M3U8 净化、HAR 记录、Schema 变更检测、告警规则检查、媒体 URL 扫描。
  - **重要特性:** 内部定义了 `fetchFallback`、`attempt`、`handleBodyText` 三段逻辑。

- **`buildHAR(entries)`**: 构建 HAR 1.2 格式数据。
  - **输入参数:** 录制期间的日志条目。
  - **返回值:** 标准 HAR 对象。
  - **关键逻辑:** 将内部请求日志映射为 HAR `log.entries`，包含 request、response、content、timings 等字段。

- **`parseQueryString(url)`**: 解析 URL 查询参数为 HAR 所需格式。
  - **输入参数:** URL 字符串。
  - **返回值:** `{ name, value }[]`。
  - **关键逻辑:** 使用 `URL` 和 `searchParams` 解析，失败则返回空数组。

- **`mimeFromType(type)`**: 根据内部资源类型推断 MIME。
  - **输入参数:** 内部类型，如 `XHR`、`SCRIPT`、`CSS`。
  - **返回值:** MIME 字符串。
  - **关键逻辑:** 使用固定映射表，不存在则返回 `text/plain`。

- **`parseHAREntries(harText)`**: 解析 HAR 文本为内部条目。
  - **输入参数:** HAR JSON 字符串。
  - **返回值:** 简化后的请求条目数组。
  - **关键逻辑:** JSON 解析后提取 `request.url`、`method`、`postData`、`response.status`、`content.text`、headers 等字段。

- **`replayHAR(entries, tabId)`**: 回放 HAR 请求。
  - **输入参数:** HAR 条目数组、目标标签页 ID。
  - **返回值:** Promise，无显式返回值。
  - **关键逻辑:** 每隔 50ms 向目标 tab 发送 `HAR_REPLAY_REQUEST` 消息，由内容脚本执行实际请求。

- **`extractSchema(obj, depth = 0)`**: 提取 JSON 数据结构 Schema。
  - **输入参数:** 任意 JSON 对象、递归深度。
  - **返回值:** 类型结构描述。
  - **关键逻辑:** 对对象递归提取字段类型，对数组取首元素结构，深度超过 5 返回 `'...'`。

- **`diffSchema(oldS, newS, path = '')`**: 比较两个 Schema 的差异。
  - **输入参数:** 旧 Schema、新 Schema、当前路径。
  - **返回值:** 变更列表。
  - **关键逻辑:** 检测字段新增、删除、类型变化，并递归比较对象子字段。

- **`checkAlertRules(log)`**: 检查条件告警规则。
  - **输入参数:** 请求日志。
  - **返回值:** 无。
  - **关键逻辑:** 根据规则类型匹配状态码、耗时、URL 包含、Body 包含等条件，命中后发送 `ALERT_HIT` 消息并创建桌面通知。

- **`recordTrafficBucket(log)`**: 记录实时流量统计 bucket。
  - **输入参数:** 请求日志。
  - **返回值:** 无。
  - **关键逻辑:** 以秒为单位统计请求数、错误数、平均耗时，并维护最近约 2 分钟数据。

- **`cleanM3u8(content)`**: 净化 M3U8 播放列表。
  - **输入参数:** M3U8 文本内容。
  - **返回值:** `{ cleaned, hasAds }`。
  - **关键逻辑:** 根据用户过滤规则、广告关键字、低于 1 秒的切片判断广告片段并移除。

- **`updateLogs(entry)`**: 更新全局网络日志。
  - **输入参数:** 日志片段或完整日志。
  - **返回值:** 无。
  - **关键逻辑:** 根据 `id` 合并或新增日志；计算请求耗时；同步消息给前端；将日志推入媒体链路追踪引擎。

- **`updateHeaderRules(headers)`**: 动态更新请求头伪造规则。
  - **输入参数:** Header 键值对象。
  - **返回值:** Promise。
  - **关键逻辑:** 使用 `chrome.declarativeNetRequest.updateDynamicRules` 删除旧规则并新增修改请求头的动态规则。

- **`callOpenAI(content, apiKey, promptType, model, apiHost)`**: 调用 OpenAI 兼容接口进行 AI 分析。
  - **输入参数:** 内容、API Key、提示类型、模型名、API Host。
  - **返回值:** AI 返回文本。
  - **关键逻辑:** 根据 `promptType` 组装不同系统提示词，截断输入至 20000 字符，调用 `/v1/chat/completions`。
  - **支持场景:** HTTP 响应解释、TypeScript 类型生成、Mock 数据、API 文档、代码反混淆、Fuzz 用例、代码生成、签名逆向、攻击建议、拦截脚本生成。

- **`attachDebuggerEager(tabId, reason)`**: 预先附加 Chrome debugger。
  - **输入参数:** tab ID、原因字符串。
  - **返回值:** Promise。
  - **关键逻辑:** 对目标标签调用 `chrome.debugger.attach`，启用 `Network.enable`、WebSocket frame 支持、`Target.setAutoAttach`，并在需要时运行 `Runtime.runIfWaitingForDebugger`。

- **`scanAndAttachAllTabs()`**: 扫描并附加所有 HTTP/HTTPS 标签页。
  - **输入参数:** 无。
  - **返回值:** 无。
  - **关键逻辑:** 查询所有 tab，对 URL 以 `http` 开头的标签页调用 `attachDebuggerEager`。

### 3.2 类/结构体 (Classes/Structs)
本文件未使用 ES6 `class` 定义类，但定义了多个对象字面量形式的功能模块。

- **`ParamSourceAnalyzer`**: 参数来源交叉匹配引擎。
  - **主要属性:** 无显式状态属性，依赖外部 `globalLogs`、`contentCache`、`paramTraceStore`。
  - **核心方法:**  
    - `searchInResponses(value)` - 在 URL、响应体缓存、响应头中搜索目标值。
    - `analyze(paramKey, paramValue)` - 分析单个参数值来源，判定为 `FROM_RESPONSE`、`FROM_REQUEST` 或 `JS_COMPUTED`。
    - `analyzeTrace(trace)` - 批量分析一次参数追踪事件中的所有参数。

- **`KeyHunter`**: 密钥与敏感字段扫描器。
  - **主要属性:**  
    - `patterns` - 多类密钥正则，包括 OpenAI、Anthropic、Google、AWS、GitHub、Stripe、JWT、私钥等。
    - `sensitiveFields` - 敏感字段名列表，如 `password`、`token`、`authorization`、`cookie` 等。
  - **核心方法:**  
    - `scan(text)` - 使用正则扫描文本中的疑似密钥。
    - `scanFields(text)` - 尝试解析 JSON 并递归检测敏感字段。

- **`TracerEngine`**: 全流量内容检索引擎。
  - **主要属性:** 无独立状态。
  - **核心方法:**  
    - `findValueSource(targetValue, logs)` - 在响应体和请求 URL 中查找目标值。
    - `getPreview(content, target)` - 生成目标值周围的上下文预览。

- **`SecurityHeaders`**: 安全响应头检测器。
  - **主要属性:**  
    - `required` - 推荐存在的安全头列表及严重性描述。
    - `leaky` - 可能泄露技术栈的响应头列表。
  - **核心方法:**  
    - `scan(logs)` - 检测响应缺失的安全头与泄露头，并给出评分。

- **`VulnScanner`**: 基于正则的漏洞/敏感信息扫描器。
  - **主要属性:**  
    - `patterns` - SQL 错误、堆栈泄露、版本泄露、内网 IP、调试信息、路径泄露、邮箱、CORS 通配符等正则。
  - **核心方法:**  
    - `scan(logs)` - 扫描响应头和响应体，返回命中项。

- **`EndpointExtractor`**: 端点提取器。
  - **主要属性:**  
    - `patterns` - 用于从 JS/XHR 响应中提取 API 路径、完整 URL、fetch/axios 调用等的正则。
  - **核心方法:**  
    - `extract(logs)` - 从脚本和 XHR 内容中提取端点，并记录来源。

- **`ParamMiner`**: 参数挖掘器。
  - **主要属性:** 无显式状态。
  - **核心方法:**  
    - `mine(logs)` - 从 URL query、POST body、敏感请求头中统计参数名、样例值、来源和出现次数。

- **`MediaChainEngine`**: 播放链路追踪引擎。
  - **主要属性:**  
    - `_window` - 短时间窗口内的链路事件。
    - `_sessionEvents` - 当前会话事件。
    - `_SESSION_MAX` - 会话事件最大数量。
    - `_WINDOW_MS` - 链路分析时间窗口。
    - `_mediaRe` - 媒体 URL 匹配正则。
    - `_staticRe` - 静态资源排除正则。
    - `_cdnRe` - 常见 CDN 排除正则。
    - `_ignoreRe` - 忽略协议/扩展 URL 正则。
    - `_urlKeys` - JSON 中疑似媒体字段名正则。
  - **核心方法:**  
    - `_shouldSkip(evt)` - 判断事件是否应忽略。
    - `push(evt)` - 写入链路事件，并在发现媒体时尝试生成完整链路。
    - `deepFindUrls(obj, depth)` - 从 JSON 对象中递归提取媒体 URL。
    - `_finalize(mediaEvt)` - 根据窗口事件生成一条媒体播放链路。
    - `pushFromLog(entry)` - 从网络日志自动生成请求、响应、媒体事件。
    - `scanBodyForMedia(bodyText, sourceUrl)` - 从 XHR JSON 响应体中提取媒体 URL。

### 3.3 接口/Traits (Interfaces/Traits)
- 本文件为 JavaScript 文件，未定义 TypeScript Interface 或 Rust Trait。
- 但通过 `chrome.runtime.onMessage` 暴露了大量基于 `msg.action` 的消息接口，构成扩展内部 API。主要包括：
  - 日志接口：`GET_LOGS`、`CLEAR_LOGS`、`FETCH_BODY`
  - 参数追踪接口：`PARAM_TRACE_EVENT`、`ANALYZE_PARAM_SOURCE`、`GET_PARAM_TRACES`
  - HAR 接口：`HAR_START`、`HAR_STOP`、`HAR_EXPORT`、`HAR_REPLAY`、`HAR_IMPORT`
  - WebSocket 接口：`GET_WS_LOGS`
  - 安全分析接口：`SCAN_SECURITY_HEADERS`、`SCAN_VULNS`、`EXTRACT_ENDPOINTS`、`MINE_PARAMS`
  - AI 接口：`AI_FUZZ`、`ANALYZE_WITH_AI`、`GET_AI_MODELS`、`CHECK_AI_BALANCE`
  - 视频链路接口：`CHAIN_PUSH_EVENT`、`CHAIN_GET_STATE`、`CHAIN_RESET_WINDOW`、`CHAIN_RESET_SESSION`、`CHAIN_CLEAR_ALL`、`CHAIN_OPEN_WINDOW`
  - 调试器/预挂钩接口：`GET_PREHOOK_STATUS`、`SET_PREHOOK`、`GET_ATTACHED_TABS`
  - 控制台接口：`OPEN_CONSOLE_WINDOW`、`CONSOLE_ENTER_URL`、`GET_CONSOLE_STATS`

### 3.4 常量/枚举 (Constants/Enums)
- **`MAX_PARAM_TRACES`**: 参数追踪记录最大数量，值为 `1000`。
- **`MAX_FUNC_TRACES`**: 函数调用追踪记录最大数量，值为 `500`。
- **`MAX_COOKIE_ORIGIN`**: Cookie 来源索引最大数量，值为 `300`。
- **`BROWSER_AUTO_HEADERS`**: 浏览器自动设置的请求头集合，用于 Header 溯源。
- **`MAX_CACHE_SIZE`**: 日志和响应体缓存最大数量，值为 `500`。
- **`MAX_WS_LOGS`**: WebSocket 日志最大数量，值为 `200`。
- **`schemaSnapshots`**: URL pattern 到响应 Schema 的快照 Map。
- **`trafficTimeline`**: 实时流量统计时间线。
- **`EARLY_LOG_MAX`**: webRequest 早期观察日志最大数量，值为 `500`。
- **`MAX_MEDIA_CHAINS`**: 媒体链路存储最大数量，值为 `100`。
- **`KeyHunter.patterns`**: 多种密钥类型正则集合。
- **`SecurityHeaders.required`**: 推荐安全响应头规则列表。
- **`SecurityHeaders.leaky`**: 潜在信息泄露响应头列表。
- **`VulnScanner.patterns`**: 漏洞特征正则集合。
- **`EndpointExtractor.patterns`**: 端点提取正则集合。

## 4. 依赖关系 (Dependencies)

### 4.1 内部依赖 (Internal Dependencies)
该文件没有使用 `import` 或 `require` 显式导入内部模块，但通过 Chrome 扩展消息机制和页面脚本形成运行时依赖：

- `inject.js`
  - 发送 `PARAM_TRACE_EVENT`
  - 发送 `FUNC_TRACE_PUSH`
  - 可能发送 `CHAIN_PUSH_EVENT`
  - 注释中提到通过 `CRYPTO_REPORT` / 函数追踪向 background 转发事件，但具体实现不在本文件中。

- `chain.js`
  - 通过 `CHAIN_GET_STATE`、`CHAIN_RESET_WINDOW`、`CHAIN_CLEAR_ALL` 等消息读取或控制媒体链路状态。

- `chain.html`
  - 由 `CHAIN_OPEN_WINDOW` 打开，作为播放链路追踪独立弹窗。

- `console.js`
  - 可能调用 `OPEN_CONSOLE_WINDOW`、`CONSOLE_ENTER_URL`、`GET_CONSOLE_STATS`、`GET_ATTACHED_TABS` 等后台接口。

- `console.html`
  - 由 `OPEN_CONSOLE_WINDOW` 打开，作为独立控制台窗口。

- `page-script.js`
  - 文件中未直接引用，但结合扩展结构，可能与注入脚本协同完成页面上下文 hook；具体调用关系无法仅凭本文件确认。

- `manifest.json`
  - 提供 background、permissions、host_permissions、declarativeNetRequest、debugger、storage、webRequest、notifications、alarms 等权限配置；具体权限内容需查看 manifest，本文件本身未展示。

### 4.2 外部依赖 (External Dependencies)
本文件未引入 npm 包或第三方库，但依赖 Chrome Extension 与浏览器原生 API：

- `chrome.runtime`
- `chrome.debugger`
- `chrome.tabs`
- `chrome.windows`
- `chrome.storage.local`
- `chrome.cookies`
- `chrome.webNavigation`
- `chrome.webRequest`
- `chrome.alarms`
- `chrome.declarativeNetRequest`
- `chrome.notifications`
- `fetch`
- `URL`
- `URLSearchParams`
- `Map`
- `Set`
- `JSON`
- `atob`
- `btoa`
- `setTimeout`

此外，`callOpenAI` 依赖 OpenAI 兼容 HTTP API：
- `/v1/chat/completions`
- `/v1/models`
- `/v1/dashboard/billing/subscription`

## 5. 暴露的接口/API (Exposed Interfaces/APIs)
该文件没有使用 ES Module `export`，但作为 Chrome 扩展后台脚本，通过事件监听器暴露运行时能力。

- **`chrome.debugger.onEvent` 监听器**: 类型：事件处理器。捕获 Network 请求、响应、响应完成、失败、WebSocket 创建和帧收发事件。
- **`chrome.runtime.onMessage` 主消息路由**: 类型：消息 API。为面板、控制台、链路窗口、注入脚本提供主要后台服务。
- **`chrome.runtime.onMessage` 链路消息路由**: 类型：消息 API。为 `chain.js` 和注入脚本提供媒体链路相关接口。
- **`chrome.action.onClicked` 监听器**: 类型：扩展图标交互 API。向当前 tab 发送 `TOGGLE_PANEL`。
- **`chrome.runtime.onConnect` 监听器**: 类型：连接 API。处理 `phantom-keepalive` 端口，避免长请求期间 Service Worker 休眠。
- **`chrome.webNavigation.onCommitted` 监听器**: 类型：导航事件 API。主 frame 导航后重置视频会话起点。
- **`chrome.webNavigation.onBeforeNavigate` 监听器**: 类型：导航预挂钩 API。导航前尝试附加 debugger。
- **`chrome.webRequest.onBeforeRequest` 监听器**: 类型：早期请求观察 API。记录 debugger 尚未就绪时的早期请求。
- **`chrome.alarms.onAlarm` 监听器**: 类型：保活/周期扫描 API。周期性扫描并 attach 标签页。
- **`chrome.tabs.onCreated` 监听器**: 类型：标签事件 API。新标签创建时尝试预 attach。
- **`chrome.tabs.onUpdated` 监听器**: 类型：标签事件 API。标签加载时尝试 attach。
- **`chrome.tabs.onRemoved` 监听器**: 类型：标签事件 API。从 `attachedTabs` 中移除关闭的标签页。

主要 `msg.action` 公共接口如下：

- **`FETCH_COOKIES`**: 类型：消息接口，读取当前页面 Cookie。
- **`GET_LOGS`**: 类型：消息接口，获取安全序列化后的全局网络日志。
- **`CLEAR_LOGS`**: 类型：消息接口，清空请求日志、响应体缓存和 WebSocket 日志。
- **`PARAM_TRACE_EVENT`**: 类型：消息接口，接收参数追踪事件并执行来源分析。
- **`ANALYZE_PARAM_SOURCE`**: 类型：消息接口，主动分析某个参数值来源。
- **`GET_PARAM_TRACES`**: 类型：消息接口，获取最近参数追踪记录。
- **`HAR_START` / `HAR_STOP` / `HAR_EXPORT` / `HAR_IMPORT` / `HAR_REPLAY`**: 类型：消息接口，控制 HAR 录制、导出、导入和回放。
- **`SEARCH_TRACER`**: 类型：消息接口，在已捕获流量中搜索关键值来源。
- **`FETCH_BODY`**: 类型：消息接口，获取某请求响应体。
- **`UPDATE_HEADER_RULES`**: 类型：消息接口，更新动态请求头伪造规则。
- **`TOGGLE_STAR` / `GET_STARRED`**: 类型：消息接口，请求收藏管理。
- **`GET_WS_LOGS`**: 类型：消息接口，获取 WebSocket 日志。
- **`GET_PERF_STATS`**: 类型：消息接口，获取按类型聚合的性能统计和最慢请求列表。
- **`GET_TRAFFIC_TIMELINE`**: 类型：消息接口，获取实时流量时间线、域名统计、状态码统计。
- **`GET_SCHEMA_SNAPSHOTS` / `DELETE_SCHEMA_SNAPSHOT` / `FORCE_SNAPSHOT`**: 类型：消息接口，管理响应 Schema 快照。
- **`GET_ALERT_RULES` / `SAVE_ALERT_RULES`**: 类型：消息接口，读取和保存告警规则。
- **`EXPORT_CONFIG` / `IMPORT_CONFIG`**: 类型：消息接口，导出/导入扩展配置。
- **`AI_FUZZ` / `ANALYZE_WITH_AI`**: 类型：消息接口，调用 AI 分析或生成 Fuzz 用例。
- **`GET_AI_MODELS` / `CHECK_AI_BALANCE`**: 类型：消息接口，查询 AI 模型列表和账户订阅信息。
- **`SCAN_SECURITY_HEADERS`**: 类型：消息接口，扫描安全响应头。
- **`EXTRACT_ENDPOINTS`**: 类型：消息接口，从响应体中提取接口端点。
- **`SCAN_VULNS`**: 类型：消息接口，执行正则型漏洞扫描。
- **`MINE_PARAMS`**: 类型：消息接口，挖掘参数。
- **`GET_SOURCE_BY_URL`**: 类型：消息接口，根据 URL 获取缓存源码。
- **`GET_SESSION_INFO` / `RESET_VIDEO_SESSION`**: 类型：消息接口，读取或重置视频会话。
- **`GET_PREHOOK_STATUS` / `SET_PREHOOK`**: 类型：消息接口，读取或设置预挂钩状态。
- **`GET_EARLY_REQUESTS`**: 类型：消息接口，获取 webRequest 早期请求记录。
- **`ENTER_URL_IN_TAB`**: 类型：消息接口，先 attach debugger 后导航当前 tab。
- **`OPEN_CONSOLE_WINDOW` / `CONSOLE_ENTER_URL`**: 类型：消息接口，打开控制台或由控制台导航目标 URL。
- **`GET_ATTACHED_TABS`**: 类型：消息接口，获取已附加 debugger 的 tab 状态。
- **`GET_CONSOLE_STATS`**: 类型：消息接口，获取控制台统计信息。
- **`FUNC_TRACE_PUSH` / `GET_FUNC_TRACES`**: 类型：消息接口，接收和读取函数调用追踪。
- **`GET_FRAME_HOTSPOTS`**: 类型：消息接口，统计栈帧热点。
- **`ANALYZE_REQUEST_AUTH`**: 类型：消息接口，分析请求 Header/Cookie 来源。
- **`GET_RECENT_MEDIA_REQUESTS`**: 类型：消息接口，获取最近媒体请求。
- **`CHAIN_PUSH_EVENT` / `CHAIN_GET_STATE` / `CHAIN_RESET_WINDOW` / `CHAIN_RESET_SESSION` / `CHAIN_CLEAR_ALL` / `CHAIN_OPEN_WINDOW`**: 类型：消息接口，媒体链路追踪相关 API。

## 6. 关键算法/逻辑流分析 (Key Algorithm/Logic Flow Analysis)

### 6.1 网络请求捕获与日志更新流程
1. 预挂钩逻辑通过 `scanAndAttachAllTabs`、`webNavigation.onBeforeNavigate`、`tabs.onCreated`、`tabs.onUpdated` 尽早对 HTTP/HTTPS 标签页调用 `attachDebuggerEager`。
2. `attachDebuggerEager` 使用 `chrome.debugger.attach` 附加目标 tab，并启用 `Network.enable`。
3. 当 Chrome DevTools Protocol 触发 `Network.requestWillBeSent`：
   - 读取 URL、method、postData、request headers。
   - 调用 `updateLogs` 写入 `globalLogs`，状态为 `Pending`。
4. 当触发 `Network.responseReceived`：
   - 根据 MIME 和 URL 后缀推断资源类型，如 `XHR`、`SCRIPT`、`MEDIA-M3U8`、`HTML`、`WASM` 等。
   - 更新日志状态码、响应头、MIME、GraphQL 标记等。
   - 调用 `indexSetCookie` 建立 Cookie 下发来源索引。
   - 将 debuggee 元信息写入 `pendingDebuggees`。
5. 当触发 `Network.loadingFinished`：
   - 从 `pendingDebuggees` 取出元信息。
   - 调用 `fetchAndCacheBody` 获取响应体。
6. 当触发 `Network.loadingFailed`：
   - 标记请求失败或取消。
   - 写入失败说明到 `contentCache`。
   - 通知前端 `BODY_READY`。

### 6.2 响应体获取、缓存与审计流程
`fetchAndCacheBody` 是本文件中最核心的处理流程之一：

1. 根据资源类型跳过媒体、字体、WASM、二进制文件。
2. 调用 `chrome.debugger.sendCommand(debuggee, 'Network.getResponseBody')` 获取响应体。
3. 如果失败：
   - 先进行最多 2 次短延迟重试。
   - 仍失败则进入 `fetchFallback`，以 300ms、800ms、2000ms 多次延迟重试。
   - 全部失败时缓存“响应体不可用”说明。
4. 获取成功后：
   - 将响应体写入 `contentCache`。
   - 若响应体为 base64，则尝试 `atob` 解码。
   - 检测 gzip/zstd 等压缩魔数，必要时写入压缩提示。
5. 进入 `handleBodyText`：
   - 执行 `KeyHunter.scan` 扫描密钥。
   - 对 XHR 执行 `KeyHunter.scanFields` 扫描敏感字段。
   - 对 GraphQL 响应尝试解析操作名。
   - 对 M3U8 调用 `cleanM3u8` 净化广告片段，并通知页面重定向到清洗后的 data URL。
   - 通知前端响应体已就绪。
   - 若 HAR 正在录制，则加入 `harSession`。
   - 对 JSON XHR 提取 Schema，并与历史快照比较。
   - 执行条件告警 `checkAlertRules`。
   - 对 XHR 响应体调用 `MediaChainEngine.scanBodyForMedia` 发现媒体 URL。

### 6.3 参数与认证头溯源逻辑
参数溯源分为普通参数和认证相关 Header/Cookie 两类：

- 普通参数：
  1. `inject.js` 通过 `PARAM_TRACE_EVENT` 发送参数事件。
  2. 后台保存到 `paramTraceStore`。
  3. `ParamSourceAnalyzer.analyzeTrace` 对参数逐个分析。
  4. 对每个值，先在响应 URL、响应体、响应头中搜索。
  5. 再在其他请求参数中搜索相同值。
  6. 根据命中情况标记为 `FROM_RESPONSE`、`FROM_REQUEST` 或 `JS_COMPUTED`。

- Header/Cookie：
  1. 前端发送 `ANALYZE_REQUEST_AUTH`。
  2. `analyzeRequestAuth` 定位目标请求日志。
  3. 请求头 `Cookie` 被拆成多个 Cookie。
  4. Cookie 先判断是否为 GA/Facebook 等客户端追踪 Cookie。
  5. 再查 `cookieOriginIndex` 判断是否来自 `Set-Cookie`。
  6. 再查响应体与加密事件。
  7. Header 则先判断是否为浏览器自动 Header，再查响应体和加密事件。
  8. 最后按判定类型生成统计 `tally`。

### 6.4 HAR 录制与回放流程
1. `HAR_START` 将 `harRecording` 设为 `true`，清空 `harSession` 并记录开始时间。
2. 响应体处理完成后，如果正在录制，将日志条目和内容加入 `harSession`。
3. `HAR_EXPORT` 调用 `buildHAR` 转为 HAR 1.2 格式。
4. `HAR_IMPORT` 调用 `parseHAREntries` 将 HAR 文本转回内部条目。
5. `HAR_REPLAY` 调用 `replayHAR`，按 50ms 间隔向目标 tab 发送 `HAR_REPLAY_REQUEST` 消息。

### 6.5 视频播放链路追踪逻辑
1. `MediaChainEngine.pushFromLog` 从每条网络日志中生成链路事件：
   - `Pending` 状态生成 `REQUEST_SENT`。
   - 响应状态生成 `RESPONSE_RECV`。
   - 媒体类型或媒体 URL 额外生成 `MEDIA_FOUND`。
2. XHR 响应体解析成功后，`scanBodyForMedia` 会从 JSON 中递归查找媒体 URL。
3. 当事件 `step === 'MEDIA_FOUND'` 时，`_finalize` 尝试生成链路：
   - 取最近 `_WINDOW_MS` 时间窗口内事件。
   - 排除扩展 URL、静态资源、常见 CDN 等噪声。
   - 推断媒体类型，如 m3u8、mp4、mpd、flv。
   - 生成 chain 对象并写入 `mediaChainStore`。
4. `chain.js` 或弹窗通过 `CHAIN_GET_STATE` 获取当前链路、窗口事件、会话事件等。

### 6.6 预挂钩 debugger 附加逻辑
该文件通过多层机制减少漏抓页面初始请求：
1. Service Worker 启动时调用 `scanAndAttachAllTabs`。
2. `chrome.alarms` 每约 21 秒唤醒并重新扫描。
3. `webNavigation.onBeforeNavigate` 在主 frame 导航前 attach。
4. `tabs.onCreated` 新 tab 创建时 attach。
5. `tabs.onUpdated` 标签进入 loading 状态时 attach。
6. `webRequest.onBeforeRequest` 作为兜底记录早期请求，即使 debugger 未就绪也保留 URL、method、type 等基本信息。

### 6.7 安全扫描与数据挖掘逻辑
- `KeyHunter` 使用多组正则扫描响应体中的密钥和 Token。
- `SecurityHeaders.scan` 对每个 URL 去重后检测安全头缺失和泄露头。
- `VulnScanner.scan` 将响应头和响应体拼接后执行漏洞特征正则匹配。
- `EndpointExtractor.extract` 从脚本和 XHR 内容中提取潜在 API 端点。
- `ParamMiner.mine` 从 query、POST JSON、form-urlencoded body、敏感请求头中统计参数。

### 6.8 潜在风险与实现注意点
- **权限风险:** 该文件依赖 `chrome.debugger`、`webRequest`、`declarativeNetRequest`、`cookies`、`<all_urls>` 等高敏权限，具备读取大量浏览器流量和响应体的能力。
- **敏感数据存储风险:** 请求头、Cookie、响应体、密钥扫描结果等保存在内存结构中，并可通过消息接口读取。虽然没有直接持久化响应体，但仍需注意面板或其他扩展页面访问控制。
- **AI API Key 暴露风险:** `callOpenAI` 从消息中接收 `apiKey` 并直接请求外部 API。`EXPORT_CONFIG` 中排除了 `openAIKey`，这是正向处理，但具体前端如何存储 API Key 需查看其他文件。
- **正则误报风险:** `KeyHunter`、`VulnScanner` 使用正则启发式扫描，存在误报和漏报。例如 AWS Secret、32 位十六进制 WeChat AppSecret 已做上下文过滤，但仍无法完全准确。
- **响应体解码风险:** 对 base64 响应体使用 `atob`，对压缩格式仅做魔数提示，没有真正解压。部分二进制或非 UTF-8 内容可能导致乱码或扫描不准确。
- **GraphQL 检测不够精确:** `isGraphQL` 只根据 URL 包含 `/graphql`、`/gql` 或请求头 content-type 为 JSON 判断，可能将普通 JSON API 误标记为 GraphQL。
- **消息路由缺少统一 `else if`:** 主 `onMessage` 监听器内部大量使用独立 `if`，多数情况下可工作，但同一消息若满足多个条件可能继续向下执行。当前 action 名大多互斥，风险有限。
- **多个 `onMessage` 监听器并存:** 文件中定义了两个 `chrome.runtime.onMessage.addListener`，一个主路由、一个链路路由。Chrome 允许多个监听器，但如果多个监听器对同一消息调用 `sendResponse` 可能产生冲突。当前 action 名基本分离。
- **`chrome.debugger.sendCommand(...).catch` 兼容性:** 代码中部分 Chrome callback 风格 API 被当作 Promise 使用 `.catch()`，例如 `chrome.debugger.sendCommand({ tabId }, 'Network.enableWebSocketFrames', {}).catch(...)`。在 MV3 中部分 API 支持 Promise，但兼容性依赖 Chrome 版本。
- **桌面通知图标路径可能不一致:** `checkAlertRules` 使用 `icons/icon48.png`，项目结构中展示的是 `icon.png`，是否存在 `icons/icon48.png` 需查看完整项目。
- **HAR 构造简化:** `buildHAR` 中响应 headers 为空数组，cookies 为空，timings 也较简化，不是完整网络级 HAR。
- **内容缓存上限共享常量:** `MAX_CACHE_SIZE` 同时用于 `globalLogs` 和 `contentCache`，这在设计上简单，但不同数据结构可能需要不同策略。
- **M3U8 去广告启发式:** 以低于 1 秒切片作为广告判断可能误删合法短片段。
- **媒体链路 tab 过滤策略:** `_chainTargetTabId` 会被首个带 tabId 的日志设置，之后忽略其他 tab，适合单目标链路分析，但在多标签同时追踪时可能丢失其他标签链路。

## 7. 标签/关键词 (Tags/Keywords)
- `Chrome扩展后台脚本`
- `网络抓包`
- `chrome.debugger`
- `响应体缓存`
- `HAR录制回放`
- `安全扫描`
- `参数溯源`
- `视频链路追踪`

---


### 📄 `chain.js`

# 代码文件分析报告: `F:\neural-phantom-4.7\chain.js`

## 1. 文件元数据 (File Metadata)
- **文件路径:** `F:\neural-phantom-4.7\chain.js`
- **语言类型:** JavaScript
- **代码行数:** 约 180 行

## 2. 核心功能摘要 (Core Functionality Summary)
该文件是浏览器扩展中 `chain.html` 独立弹窗页面的前端逻辑脚本，用于从 `background.js` 拉取“链路追踪”数据并渲染到页面。它通过定时轮询 Chrome Extension Runtime 消息接口获取已完成链路和实时采集窗口数据，展示视频播放地址解析过程、API 请求响应、加密/解密、参数来源等事件，并提供复制播放地址、刷新目标网页、清空链路数据等交互功能。

## 3. 主要结构与组件 (Main Structures & Components)

该文件整体采用立即执行函数表达式（IIFE）封装，避免变量污染全局作用域。核心组件包括：

- DOM 元素引用与状态缓存
- HTML 转义工具函数
- 后台状态轮询逻辑
- 链路列表渲染逻辑
- 实时数据流渲染逻辑
- 完成链路卡片渲染逻辑
- 链路事件时间线渲染逻辑
- 卡片交互事件绑定
- 刷新网页按钮逻辑
- 清空数据按钮逻辑

### 3.1 函数/方法 (Functions/Methods)

- **`escHtml(s)`**:  
  用于对字符串进行 HTML 转义，防止将外部数据直接拼接进 `innerHTML` 时产生 HTML 注入或 XSS 风险。  
  - **输入参数:**  
    - `s`: 任意值，通常为字符串或可转换为字符串的数据。
  - **返回值:** 转义后的字符串。
  - **关键逻辑:**  
    将 `&`、`<`、`>`、`"` 分别替换为 `&amp;`、`&lt;`、`&gt;`、`&quot;`。  
    使用 `String(s || '')` 保证空值不会导致异常。

- **`poll()`**:  
  轮询 `background.js` 获取当前链路追踪状态，并在数据长度变化时触发重新渲染。  
  - **输入参数:** 无。
  - **返回值:** 无。
  - **关键逻辑:**  
    1. 调用 `chrome.runtime.sendMessage({ action: 'CHAIN_GET_STATE' }, callback)` 请求后台状态。
    2. 从返回的 `state` 中读取：
       - `state.chains`: 已完成链路数组。
       - `state.window`: 实时采集窗口事件数组。
    3. 通过比较当前 `chains.length`、`win.length` 与缓存的 `_prevChainLen`、`_prevLiveLen`，判断是否需要重新渲染。
    4. 若数据长度未变化，则直接返回，避免不必要的 DOM 操作。
    5. 更新页面上的链路总数和实时采集数量。
    6. 调用 `render(chains, win)` 渲染页面。

- **`render(chains, win)`**:  
  根据已完成链路和实时窗口事件生成完整 HTML，并写入链路列表容器。  
  - **输入参数:**  
    - `chains`: 已完成链路数组。
    - `win`: 实时采集窗口事件数组。
  - **返回值:** 无。
  - **关键逻辑:**  
    1. 初始化 HTML 字符串。
    2. 如果实时事件存在，调用 `renderLive(win)` 渲染实时数据流。
    3. 如果已完成链路和实时事件均为空，渲染空状态提示。
    4. 遍历 `chains`，调用 `renderCard(chain)` 渲染每条已完成链路卡片。
    5. 将生成的 HTML 设置到 `list.innerHTML`。
    6. 调用 `bindCardEvents()` 为新生成的 DOM 节点绑定交互事件。

- **`renderLive(win)`**:  
  渲染实时采集中的事件流。  
  - **输入参数:**  
    - `win`: 实时事件数组。
  - **返回值:** HTML 字符串。
  - **关键逻辑:**  
    1. 定义事件步骤到图标的映射 `stepIcons`。
    2. 定义事件步骤到中文标签的映射 `stepLabels`。
    3. 创建实时数据流容器。
    4. 从 `win` 中取最近 25 条事件，并反转顺序，使最新事件显示在上方。
    5. 对每条事件，根据不同字段组合摘要信息：
       - `evt.url`
       - `evt.algo`
       - `evt.plaintext`
       - `evt.field`
       - `evt.key`
    6. 使用 `escHtml(info)` 转义动态信息。
    7. 显示事件图标、标签、摘要和时间。
    8. 如果实时事件超过 25 条，显示还有多少条更早事件的提示。

- **`renderCard(chain)`**:  
  渲染一条已完成链路的卡片。  
  - **输入参数:**  
    - `chain`: 单条链路对象。
  - **返回值:** HTML 字符串。
  - **关键逻辑:**  
    1. 计算链路耗时：`chain.endTime - chain.startTime`。
    2. 对 `chain.mediaUrl` 进行截断显示。
    3. 定义事件步骤图标、标签和 CSS class 映射。
    4. 遍历 `chain.events`，统计每类事件出现次数，生成步骤摘要标签。
    5. 查找第一条 `URL_EXTRACT` 事件，用于显示关键 API 与字段信息。
    6. 生成链路卡片结构，包括：
       - 媒体类型徽标
       - 媒体 URL
       - 复制按钮
       - 关键 API 行
       - 步骤数量、耗时、开始时间
       - 步骤摘要
       - 时间线详情
    7. 调用 `renderTimeline(chain, stepIcons, stepLabels, stepClasses)` 渲染详细事件时间线。

- **`renderTimeline(chain, icons, labels, classes)`**:  
  渲染单条链路的详细事件时间线。  
  - **输入参数:**  
    - `chain`: 单条链路对象。
    - `icons`: 步骤图标映射表。
    - `labels`: 步骤中文标签映射表。
    - `classes`: 步骤 CSS class 映射表。
  - **返回值:** HTML 字符串。
  - **关键逻辑:**  
    遍历 `chain.events`，根据 `evt.step` 类型生成不同的详细描述。支持的事件类型包括：
    - `PARAM_SOURCE`: 参数来源追踪。
    - `CRYPTO_CALL`: JS 加密调用。
    - `SIGN_FIELD`: 签名字段。
    - `PARAM_CRYPTO`: 参数加密检测。
    - `REQUEST_SENT`: API 请求发出。
    - `RESPONSE_RECV`: API 响应接收。
    - `URL_EXTRACT`: 从 API 响应中提取播放地址。
    - `DECRYPT`: 解密还原。
    - `MEDIA_FOUND`: 发现媒体播放地址。

  每个事件被渲染为 `.chain-step` DOM 块，包含：
    - 步骤图标和标签。
    - 事件时间。
    - 事件详情。

- **`bindCardEvents()`**:  
  为链路卡片和复制按钮绑定点击事件。  
  - **输入参数:** 无。
  - **返回值:** 无。
  - **关键逻辑:**  
    1. 为所有 `.chain-card` 元素绑定点击事件。
    2. 点击卡片时切换 `expanded` class，用于展开/折叠时间线详情。
    3. 如果点击目标是 `.chain-copy-btn`，则不触发展开折叠。
    4. 为所有 `.chain-copy-btn` 按钮绑定点击事件。
    5. 点击复制按钮时调用 `navigator.clipboard.writeText(btn.dataset.url)` 复制媒体地址。
    6. 复制成功后将按钮文本短暂变为 `✅`，1.5 秒后恢复为 `复制`。

- **刷新按钮点击回调函数**:  
  绑定在 `document.getElementById('refresh-btn')` 上，用于清空实时采集窗口并刷新目标网页。  
  - **输入参数:** DOM 点击事件上下文。
  - **返回值:** 无。
  - **关键逻辑:**  
    1. 请求后台状态，读取 `state.targetTabId`。
    2. 发送 `CHAIN_RESET_WINDOW` 消息清空采集窗口。
    3. 将 `_prevLiveLen` 重置为 `-1`，确保下次轮询触发渲染。
    4. 如果存在 `targetTabId`，调用 `chrome.tabs.reload(tabId)` 刷新目标标签页。
    5. 如果没有锁定目标标签页，则查询当前活跃标签页：
       - 使用 `chrome.tabs.query({ active: true, currentWindow: false }, callback)`。
       - 选择 URL 以 `http` 开头的标签页。
       - 调用 `chrome.tabs.reload(httpTab.id)` 刷新。
    6. 将按钮文本短暂改为 `✅ 已刷新`，之后恢复为 `🔄 刷新网页`。

- **清空按钮点击回调函数**:  
  绑定在 `document.getElementById('clear-btn')` 上，用于清空所有链路数据。  
  - **输入参数:** DOM 点击事件上下文。
  - **返回值:** 无。
  - **关键逻辑:**  
    1. 发送 `CHAIN_CLEAR_ALL` 消息给后台。
    2. 重置 `_prevChainLen` 和 `_prevLiveLen`。
    3. 清空列表容器 `list.innerHTML`。
    4. 将链路计数显示为 `0 条`。
    5. 隐藏实时采集数量元素。

- **`setInterval(poll, 800)` 启动逻辑**:  
  每 800 毫秒执行一次 `poll()`，持续从后台获取链路状态。初始化时立即调用一次 `poll()`，避免等待第一个轮询周期。

### 3.2 类/结构体 (Classes/Structs)
该文件未定义 JavaScript `class`、构造函数或显式结构体。

不过代码中隐式依赖若干对象结构：

- **`state` 对象**:  
  由 `background.js` 响应 `CHAIN_GET_STATE` 消息返回。
  - **主要属性:**  
    - `chains` - 已完成链路数组。
    - `window` - 实时采集窗口事件数组。
    - `targetTabId` - 当前锁定或目标网页标签页 ID。
  - **核心方法:** 无。

- **`chain` 对象**:  
  表示一条完整媒体解析链路。
  - **主要属性:**  
    - `id` - 链路唯一标识，用于设置 `data-chain-id`。
    - `mediaUrl` - 最终发现的媒体播放地址。
    - `mediaType` - 媒体类型，用作徽标文本和 CSS class。
    - `startTime` - 链路开始时间戳。
    - `endTime` - 链路结束时间戳。
    - `events` - 链路内事件数组。
  - **核心方法:** 无。

- **`evt` 事件对象**:  
  表示链路中的单个追踪事件。
  - **主要属性:**  
    - `step` - 事件步骤类型。
    - `time` - 事件时间戳。
    - `url` - 相关请求或媒体 URL。
    - `method` - HTTP 方法。
    - `status` - HTTP 状态码。
    - `duration` - 请求耗时。
    - `type` - 响应类型。
    - `key` - 参数名或密钥。
    - `value` - 参数值。
    - `field` - 字段名。
    - `algo` - 加密或解密算法。
    - `plaintext` - 明文。
    - `ciphertext` - 密文。
    - `trace` - 调用栈信息。
    - `verdict` - 参数来源判定。
    - `fromUrl` - 参数来源 URL。
    - `decoded` - 解码结果数组。
    - `detected` - 检测出的加密/编码类型数组。
    - `postData` - 请求体数据。
    - `sourceApi` - 来源 API 地址。
    - `source` - 媒体发现来源。
    - `apiUrl` - 相关 API URL。
  - **核心方法:** 无。

### 3.3 接口/Traits (Interfaces/Traits)
该文件未定义 TypeScript 接口、JavaScript 抽象接口或 Traits。

但它依赖 Chrome 扩展 API 的消息和标签页接口：

- **`chrome.runtime.sendMessage`**:  
  用于与扩展后台脚本通信，发送控制命令并获取链路状态。

- **`chrome.tabs.reload`**:  
  用于刷新指定标签页。

- **`chrome.tabs.query`**:  
  用于查找当前活跃标签页。

- **`navigator.clipboard.writeText`**:  
  用于将媒体 URL 写入系统剪贴板。

### 3.4 常量/枚举 (Constants/Enums)

- **`list`**:  
  DOM 元素引用，指向 ID 为 `chain-list` 的链路列表容器。

- **`countEl`**:  
  DOM 元素引用，指向 ID 为 `chain-count` 的链路总数展示元素。

- **`liveCountEl`**:  
  DOM 元素引用，指向 ID 为 `chain-live-count` 的实时采集数量展示元素。

- **`_prevChainLen`**:  
  内部状态变量，用于缓存上一次已完成链路数量，避免无变化时重复渲染。

- **`_prevLiveLen`**:  
  内部状态变量，用于缓存上一次实时窗口事件数量，避免无变化时重复渲染。

- **`stepIcons`**:  
  在 `renderLive()` 和 `renderCard()` 中定义的步骤图标映射表。  
  支持的步骤包括：
  - `PARAM_SOURCE`
  - `CRYPTO_CALL`
  - `SIGN_FIELD`
  - `PARAM_CRYPTO`
  - `REQUEST_SENT`
  - `RESPONSE_RECV`
  - `URL_EXTRACT`
  - `DECRYPT`
  - `MEDIA_FOUND`

- **`stepLabels`**:  
  在 `renderLive()` 和 `renderCard()` 中定义的步骤中文标签映射表。

- **`stepClasses`**:  
  在 `renderCard()` 中定义的步骤到 CSS class 的映射表，用于时间线事件样式分类。

## 4. 依赖关系 (Dependencies)

### 4.1 内部依赖 (Internal Dependencies)
该文件没有通过 `import`、`require` 或 ES Module 语法显式导入内部模块，但从功能上依赖项目内其他文件：

- `chain.html`  
  提供该脚本所操作的 DOM 结构，例如：
  - `chain-list`
  - `chain-count`
  - `chain-live-count`
  - `refresh-btn`
  - `clear-btn`

- `background.js`  
  通过 `chrome.runtime.sendMessage` 提供链路状态和控制能力，响应以下 action：
  - `CHAIN_GET_STATE`
  - `CHAIN_RESET_WINDOW`
  - `CHAIN_CLEAR_ALL`

- `dashboard.css` 或 `chain.html` 内联样式  
  代码中使用了多个 CSS class，需要对应样式定义支持：
  - `chain-card`
  - `chain-card-header`
  - `chain-type-badge`
  - `chain-card-url`
  - `chain-copy-btn`
  - `btn-small`
  - `chain-card-meta`
  - `chain-timeline`
  - `chain-step`
  - `step-label`
  - `step-time`
  - `step-detail`
  - `expanded`
  - `step-param`
  - `step-crypto`
  - `step-sign`
  - `step-request`
  - `step-response`
  - `step-media`
  - `step-decrypt`

### 4.2 外部依赖 (External Dependencies)
该文件依赖浏览器和 Chrome 扩展运行时提供的 API：

- `chrome.runtime`
- `chrome.tabs`
- `navigator.clipboard`
- DOM Web API
  - `document.getElementById`
  - `querySelectorAll`
  - `addEventListener`
  - `classList`
  - `dataset`
  - `setInterval`
  - `setTimeout`
- JavaScript 标准内置对象/API
  - `Date`
  - `String`
  - `Object.keys`
  - `Array.prototype.forEach`
  - `Array.prototype.find`
  - `Array.prototype.slice`
  - `Array.prototype.reverse`
  - `String.prototype.substring`
  - `String.prototype.replace`
  - `parseInt`

## 5. 暴露的接口/API (Exposed Interfaces/APIs)
该文件未通过模块系统导出任何函数、类、常量，也未向全局对象显式挂载 API。所有变量和函数都被包裹在 IIFE 内部，属于私有作用域。

但它对外部系统具有以下行为接口：

- **`CHAIN_GET_STATE`**:  
  类型: Chrome runtime 消息 action。  
  用途: 请求后台返回当前链路状态，包括已完成链路、实时窗口事件和目标标签页 ID。

- **`CHAIN_RESET_WINDOW`**:  
  类型: Chrome runtime 消息 action。  
  用途: 通知后台清空实时采集窗口。

- **`CHAIN_CLEAR_ALL`**:  
  类型: Chrome runtime 消息 action。  
  用途: 通知后台清空所有链路和实时采集数据。

- **DOM 事件接口：`refresh-btn` 点击事件**:  
  类型: UI 事件。  
  用途: 清空实时窗口并刷新目标网页或活跃网页。

- **DOM 事件接口：`clear-btn` 点击事件**:  
  类型: UI 事件。  
  用途: 清空所有链路显示和后台数据。

- **DOM 事件接口：`.chain-card` 点击事件**:  
  类型: UI 事件。  
  用途: 展开或折叠单条链路详情。

- **DOM 事件接口：`.chain-copy-btn` 点击事件**:  
  类型: UI 事件。  
  用途: 复制媒体播放地址到剪贴板。

## 6. 关键算法/逻辑流分析 (Key Algorithm/Logic Flow Analysis)

### 6.1 页面启动与轮询流程

1. IIFE 立即执行。
2. 获取关键 DOM 节点：
   - 链路列表容器
   - 链路数量元素
   - 实时采集数量元素
3. 初始化 `_prevChainLen` 和 `_prevLiveLen` 为 `-1`。
4. 注册刷新按钮和清空按钮事件。
5. 启动定时器：`setInterval(poll, 800)`。
6. 立即调用一次 `poll()`，首次加载数据。

该逻辑使页面始终保持与 `background.js` 中链路状态的近实时同步。

### 6.2 后台状态拉取与增量渲染判断

`poll()` 的核心优化是只比较数组长度：

```javascript
var chainChanged = chains.length !== _prevChainLen;
var liveChanged = win.length !== _prevLiveLen;
if (!chainChanged && !liveChanged) return;
```

这种方式可以减少 DOM 重绘开销，但也存在限制：

- 如果某条链路对象内容变化但数组长度未变化，页面不会更新。
- 如果实时事件对象内容被修改但 `win.length` 不变，页面也不会更新。
- 该策略适用于“只追加事件”的数据模型；如果后台会修改已有事件，该文件无法感知。

### 6.3 实时数据流渲染流程

实时窗口 `win` 的渲染过程如下：

1. 如果 `win.length > 0`，显示实时数据流容器。
2. 仅取最近 25 条事件：

```javascript
var recent = win.slice(-25).reverse();
```

3. 反转后最新事件显示在最上方。
4. 每条事件根据字段优先级生成摘要：
   - 有 `url` 时优先显示 URL 截断信息。
   - 否则显示加密算法和明文。
   - 否则显示字段和值。
   - 否则显示 key/value。
5. 事件摘要使用 `escHtml()` 进行转义。
6. 如果总事件数超过 25 条，显示更早事件数量提示。

该逻辑适合展示不断追加的采集流，避免过多 DOM 节点影响性能。

### 6.4 已完成链路卡片渲染流程

单个链路卡片包含三层信息：

1. **概览层**
   - 媒体类型
   - 媒体 URL
   - 复制按钮

2. **摘要层**
   - 关键 API
   - 事件数量
   - 耗时
   - 开始时间
   - 各步骤类型出现次数

3. **详情层**
   - 完整事件时间线
   - 点击卡片通过 `expanded` class 展开或折叠

步骤摘要通过统计 `chain.events` 中每个 `step` 的出现次数生成：

```javascript
var counts = {};
chain.events.forEach(function(e) {
    counts[e.step] = (counts[e.step] || 0) + 1;
});
```

### 6.5 时间线事件分类渲染逻辑

`renderTimeline()` 是该文件中业务表达最集中的部分。它根据 `evt.step` 生成不同详情文本：

- **`PARAM_SOURCE`**  
  展示参数名、参数值、来源判定、来源 URL。

- **`CRYPTO_CALL`**  
  展示加密算法、输入明文、密钥、调用栈。

- **`SIGN_FIELD`**  
  展示签名字段名和值。

- **`PARAM_CRYPTO`**  
  展示参数名、检测到的编码/加密类型、解码结果。

- **`REQUEST_SENT`**  
  展示请求方法、请求 URL、请求体。

- **`RESPONSE_RECV`**  
  展示 HTTP 状态、响应类型、耗时和 URL。  
  其中状态码颜色根据数值区分：
  - `>= 400`: 红色
  - `>= 300`: 橙色
  - `< 300`: 绿色

- **`URL_EXTRACT`**  
  展示从 API 响应中提取的播放地址、字段名和来源 API。

- **`DECRYPT`**  
  展示解密算法、密文、明文。

- **`MEDIA_FOUND`**  
  展示媒体地址来源和最终 URL。  
  根据 `evt.source` 映射说明：
  - `api_response`: 从 API 响应中解析
  - `direct_request`: 直接请求媒体文件
  - 其他: 网络捕获

### 6.6 刷新网页流程

刷新按钮逻辑服务于“重新触发网页请求以便采集链路”：

1. 获取后台状态。
2. 读取 `targetTabId`。
3. 发送 `CHAIN_RESET_WINDOW` 清空实时采集窗口。
4. 重置 `_prevLiveLen`。
5. 如果 `targetTabId` 存在，刷新该标签页。
6. 否则查询活跃标签页并尝试刷新第一个 HTTP/HTTPS 页面。
7. 更新按钮文字提示。

值得注意的是：

```javascript
chrome.tabs.query({ active:true, currentWindow:false }, ...)
```

这里使用了 `currentWindow:false`，含义是查询非当前窗口中的活跃标签页。若意图是刷新当前窗口的活跃标签页，通常应为 `currentWindow:true`。基于现有代码，只能判断它会查找“非当前窗口”的活跃标签页，是否符合作者意图无法从该文件单独确认。

### 6.7 清空数据流程

清空按钮会：

1. 通知后台执行 `CHAIN_CLEAR_ALL`。
2. 重置本地长度缓存。
3. 清空 DOM。
4. 更新计数显示。
5. 隐藏实时采集计数。

该操作同时影响后台数据和当前 UI 状态。

### 6.8 安全性与潜在风险分析

- **HTML 注入风险控制不完全**  
  大多数动态文本通过 `escHtml()` 转义，但存在部分动态值直接拼接进 HTML 属性或 class 的情况：
  - `chain.mediaType` 被直接用于 CSS class 和文本：
    ```javascript
    '<span class="chain-type-badge '+chain.mediaType+'">'+chain.mediaType.toUpperCase()+'</span>'
    ```
    如果 `mediaType` 来自不可信输入，可能造成 HTML 属性注入或 class 注入。
  - `chain.id` 直接写入 `data-chain-id`：
    ```javascript
    data-chain-id="'+chain.id+'"
    ```
    如果不是受控值，也可能产生属性注入风险。
  - `evt.status` 在部分位置直接拼接：
    ```javascript
    'HTTP '+evt.status
    ```
    虽然前面进行了 `parseInt` 用于颜色判断，但输出仍使用原始 `evt.status`。
  - `evt.detected.join(', ')` 未经过 `escHtml()`：
    ```javascript
    (evt.detected||[]).join(', ')
    ```
    如果数组元素包含 HTML 特殊字符，存在注入风险。

- **使用 `innerHTML` 构造复杂界面**  
  该文件大量使用字符串拼接生成 HTML。虽然有一定转义措施，但维护成本较高，容易遗漏转义点。

- **轮询更新粒度较粗**  
  当前只比较数组长度。如果后台状态对象内容变化但数组长度不变，页面不会更新。

- **剪贴板 API 错误未处理**  
  `navigator.clipboard.writeText()` 只处理成功回调，没有 `.catch()`。若权限不足或复制失败，用户不会看到错误反馈。

- **Chrome API 错误未处理**  
  `chrome.runtime.sendMessage`、`chrome.tabs.reload`、`chrome.tabs.query` 等调用没有检查 `chrome.runtime.lastError`。

- **DOM 元素存在性未校验**  
  代码直接调用：
  ```javascript
  document.getElementById('refresh-btn').addEventListener(...)
  ```
  如果页面缺少对应元素，会抛出异常并中断脚本。

- **对数据结构假设较强**  
  例如：
  ```javascript
  var shortUrl = chain.mediaUrl.length > 80 ? ...
  ```
  如果 `chain.mediaUrl` 不存在或不是字符串，会抛出异常。  
  因此该文件依赖后台保证链路对象结构完整。

## 7. 标签/关键词 (Tags/Keywords)
- `Chrome扩展`
- `链路追踪`
- `媒体地址解析`
- `后台消息通信`
- `DOM渲染`
- `实时事件流`
- `API请求分析`
- `剪贴板复制`

---


### 📄 `console.js`

# 代码文件分析报告: `F:\neural-phantom-4.7\console.js`

## 1. 文件元数据 (File Metadata)
- **文件路径:** `F:\neural-phantom-4.7\console.js`
- **语言类型:** JavaScript
- **代码行数:** 约 530 行

## 2. 核心功能摘要 (Core Functionality Summary)
该文件是 Neural Phantom 扩展“独立控制台窗口”的前端逻辑脚本，负责从 `background.js`/Service Worker 周期性拉取调试状态、链路事件、函数追踪、媒体请求与鉴权分析结果，并渲染到 `console.html` 对应的 DOM 面板中。它还提供 URL 进入/复用 Tab、导出会话、重置会话、清空事件、打开链路窗口、聚焦 Tab 等控制台交互能力。

## 3. 主要结构与组件 (Main Structures & Components)

### 3.1 函数/方法 (Functions/Methods)
- **`$`**: DOM 快捷选择函数。
  - **输入参数:** `id`，DOM 元素 ID。
  - **返回值:** `document.getElementById(id)` 的结果。
  - **关键逻辑:** 用于简化后续 DOM 引用获取。

- **`esc`**: HTML 转义工具函数。
  - **输入参数:** `s`，任意待显示值。
  - **返回值:** 转义后的字符串。
  - **关键逻辑:** 将 `&`、`<`、`>`、`"` 转义为 HTML 实体，防止将外部数据直接拼接进 `innerHTML` 时造成 HTML 注入/XSS 风险。

- **`fmtTime`**: 时间格式化函数。
  - **输入参数:** `ts`，时间戳或可被 `Date` 解析的时间值。
  - **返回值:** 本地化时间字符串；异常或空值时返回 `-`。
  - **关键逻辑:** 使用 `new Date(ts).toLocaleTimeString()` 进行展示格式化，并用 `try/catch` 兜底。

- **`shortUrl`**: URL 缩短展示函数。
  - **输入参数:** `u` URL 字符串，`n` 最大长度。
  - **返回值:** 移除 `http://` 或 `https://` 前缀后的短 URL。
  - **关键逻辑:** 如果 URL 长度超过指定长度，截断并追加省略号 `…`。

- **`doEnter`**: 控制台输入 URL 并进入/导航目标页面的核心函数。
  - **输入参数:** 无，直接读取 `enterUrl` 和 `enterMode` DOM 值。
  - **返回值:** 无。
  - **关键逻辑:**
    1. 读取并校验 URL。
    2. 若无协议头，自动补全为 `https://`。
    3. 根据模式决定新建或复用 Tab。
    4. 通过 `chrome.runtime.sendMessage` 发送 `CONSOLE_ENTER_URL` 给后台。
    5. 根据后台响应更新提示文案与按钮状态。
    6. 成功后调用 `pollAll()` 立即刷新控制台数据。
  - **依赖后台动作:** `CONSOLE_ENTER_URL`。

- **`setHint`**: 设置 URL 进入区域的提示信息。
  - **输入参数:** `msg` 提示文本，`color` 文本颜色。
  - **返回值:** 无。
  - **关键逻辑:** 修改 `enterHint.textContent` 与 `enterHint.style.color`。

- **`pollPreHook`**: 轮询预挂钩状态。
  - **输入参数:** 无。
  - **返回值:** 无。
  - **关键逻辑:** 向后台发送 `GET_PREHOOK_STATUS`，根据返回的 `enabled` 与 `attachedTabs` 更新 `prehookState` 的文本、背景色与字体颜色。
  - **依赖后台动作:** `GET_PREHOOK_STATUS`。

- **`pollStats`**: 轮询控制台统计信息。
  - **输入参数:** 无。
  - **返回值:** 无。
  - **关键逻辑:** 向后台发送 `GET_CONSOLE_STATS`，更新已 attach Tab 数、请求数、加密调用数、解密数、签名字段数、参数加密数、媒体捕获数、早期请求数以及会话起点信息。
  - **依赖后台动作:** `GET_CONSOLE_STATS`。

- **`pollAttachedTabs`**: 轮询并渲染已 attach 的 Tab 列表。
  - **输入参数:** 无。
  - **返回值:** 无。
  - **关键逻辑:**
    1. 向后台发送 `GET_ATTACHED_TABS`。
    2. 读取返回的 `res.tabs`。
    3. 使用 `lastAttachedKey` 对 Tab 状态进行摘要比对，避免不必要 DOM 重绘。
    4. 渲染每个 Tab 的 ID、URL、请求数量、pending 数、错误数。
    5. 为每个 Tab 绑定“重用”和“聚焦”按钮事件。
  - **依赖后台动作:** `GET_ATTACHED_TABS`、`CONSOLE_ENTER_URL`。
  - **依赖 Chrome API:** `chrome.tabs.update`、`chrome.tabs.get`、`chrome.windows.update`。

- **`pollEvents`**: 轮询并渲染链路事件流。
  - **输入参数:** 无。
  - **返回值:** 无。
  - **关键逻辑:**
    1. 发送 `CHAIN_GET_STATE` 获取链路状态。
    2. 优先使用 `state.sessionEvents`，否则使用 `state.window`。
    3. 根据 `currentFilter` 过滤事件类型。
    4. 使用 `lastEventLen` 判断事件数量是否变化，减少重绘。
    5. 最近 200 条事件倒序展示。
    6. 根据事件 step 映射图标和中文标签。
    7. 根据事件字段 `url`、`algo`、`field`、`key` 推导详情文本。
  - **依赖后台动作:** `CHAIN_GET_STATE`。

- **`pollHotspots`**: 轮询函数调用热点。
  - **输入参数:** 无。
  - **返回值:** 无。
  - **关键逻辑:**
    1. 发送 `GET_FRAME_HOTSPOTS`，限制数量为 15。
    2. 更新热点数量。
    3. 使用 `lastHotspotKey` 比较热点数据是否变化，减少 DOM 更新。
    4. 渲染函数名、源码位置、涉及事件类型图标、调用次数。
    5. 点击源码位置时通过 `window.open(file, '_blank')` 打开文件 URL。
  - **依赖后台动作:** `GET_FRAME_HOTSPOTS`。

- **`pollFuncTraces`**: 轮询最近函数调用轨迹。
  - **输入参数:** 无。
  - **返回值:** 无。
  - **关键逻辑:**
    1. 发送 `GET_FUNC_TRACES`，限制数量为 30。
    2. 更新轨迹数量。
    3. 使用 `lastFuncTraceLen` 判断是否需要重绘。
    4. 渲染同步调用、异步调用、异常调用的标签、函数 label、参数摘要、耗时、时间。
  - **依赖后台动作:** `GET_FUNC_TRACES`。

- **`pollAuthMediaList`**: 轮询最近媒体请求列表，用于鉴权溯源分析。
  - **输入参数:** 无。
  - **返回值:** 无。
  - **关键逻辑:**
    1. 发送 `GET_RECENT_MEDIA_REQUESTS`，限制数量为 10。
    2. 保存返回的媒体请求到 `mediaList`。
    3. 渲染媒体请求下拉框。
    4. 使用 `sel.dataset.key` 避免重复重绘。
    5. 如果未手动选择媒体请求，则自动选择最新一条并触发 `runAuthAnalysis()`。
  - **依赖后台动作:** `GET_RECENT_MEDIA_REQUESTS`。

- **`runAuthAnalysis`**: 对指定媒体请求运行鉴权分析。
  - **输入参数:** `target`，媒体请求对象，预期包含 `id`、`url` 等字段。
  - **返回值:** 无。
  - **关键逻辑:**
    1. 如果无目标请求，显示“尚无媒体请求”。
    2. 显示分析中的状态。
    3. 向后台发送 `ANALYZE_REQUEST_AUTH`，携带 `requestId` 与 `url`。
    4. 根据响应渲染错误信息或调用 `renderAuthAnalysis()` 生成分析结果 HTML。
  - **依赖后台动作:** `ANALYZE_REQUEST_AUTH`。

- **`renderAuthAnalysis`**: 渲染鉴权分析结果。
  - **输入参数:** `res`，后台鉴权分析结果。
  - **返回值:** HTML 字符串。
  - **关键逻辑:**
    1. 解构 `url`、`method`、`time`、`headers`、`cookies`、`tally`。
    2. 基于 `tally` 和 `VERDICT_META` 渲染来源分类统计徽章。
    3. 渲染 Cookie 来源分析。
    4. 将请求头拆分为浏览器自动头与非自动头。
    5. 关键自定义头直接展示，浏览器自动头放入 `<details>` 折叠区。
  - **注意:** 解构了 `time` 但当前函数中未实际使用该变量。

- **`renderAuthRow`**: 渲染单个 Header/Cookie 鉴权来源行。
  - **输入参数:** `item`，包含 `name`、`value`、`verdict`、`details` 的鉴权条目。
  - **返回值:** HTML 字符串。
  - **关键逻辑:**
    1. 根据 `item.verdict` 从 `VERDICT_META` 获取图标、颜色、标签。
    2. 针对不同来源类型生成补充说明：
       - `FROM_SET_COOKIE`: 展示 Set-Cookie 来源 URL 与时间。
       - `FROM_RESPONSE_BODY`: 展示命中的响应体来源。
       - `JS_CRYPTO`: 展示算法、提示和首个栈帧位置。
       - `CLIENT_TRACKER`: 展示追踪 SDK 信息。
       - `UNKNOWN` / `UNKNOWN_JS`: 展示后台提供的 hint。
    3. 返回包含名称、值、来源标签和说明的 HTML 片段。

- **`pollAll`**: 统一轮询入口。
  - **输入参数:** 无。
  - **返回值:** 无。
  - **关键逻辑:** 顺序调用所有轮询函数：
    - `pollPreHook()`
    - `pollStats()`
    - `pollAttachedTabs()`
    - `pollEvents()`
    - `pollHotspots()`
    - `pollFuncTraces()`
    - `pollAuthMediaList()`

- **匿名立即执行函数表达式 `IIFE`**:
  - **类型:** 自执行函数。
  - **功能:** 封装整个控制台脚本的作用域，避免变量泄漏到全局对象。
  - **关键逻辑:** 初始化 DOM 引用、状态变量、事件监听、Chrome 连接保活、轮询任务，并启动 `setInterval`。

### 3.2 类/结构体 (Classes/Structs)
- 本文件未定义 JavaScript `class` 或类似结构体。

### 3.3 接口/Traits (Interfaces/Traits)
- 本文件未定义 TypeScript 接口或其他显式接口。
- 但它隐式依赖多个后台消息协议接口，例如：
  - `GET_PREHOOK_STATUS`
  - `GET_CONSOLE_STATS`
  - `GET_ATTACHED_TABS`
  - `CHAIN_GET_STATE`
  - `GET_FRAME_HOTSPOTS`
  - `GET_FUNC_TRACES`
  - `GET_RECENT_MEDIA_REQUESTS`
  - `ANALYZE_REQUEST_AUTH`
  - `CONSOLE_ENTER_URL`
  - `CHAIN_RESET_SESSION`
  - `CHAIN_CLEAR_ALL`
  - `CHAIN_OPEN_WINDOW`

### 3.4 常量/枚举 (Constants/Enums)
- **`POLL_INTERVAL_MS`**: 统一轮询间隔，值为 `1000` 毫秒。
- **`stepIcons`**: 链路事件 step 到图标的映射。
  - 包含 `PARAM_SOURCE`、`CRYPTO_CALL`、`SIGN_FIELD`、`PARAM_CRYPTO`、`REQUEST_SENT`、`RESPONSE_RECV`、`URL_EXTRACT`、`DECRYPT`、`MEDIA_FOUND` 等事件类型。
- **`stepLabels`**: 链路事件 step 到中文标签的映射。
  - 用于将内部事件类型转换为控制台中的中文说明。
- **`VERDICT_META`**: 鉴权来源判定类型的展示元数据。
  - 包含图标、颜色和中文标签。
  - 支持的判定类型：
    - `BROWSER_AUTO`: 浏览器自动
    - `FROM_SET_COOKIE`: Set-Cookie 下发
    - `FROM_RESPONSE_BODY`: 响应体透传
    - `JS_CRYPTO`: JS 加密产物
    - `CLIENT_TRACKER`: 统计 SDK 生成
    - `UNKNOWN`: 未知来源
    - `UNKNOWN_JS`: JS 设置

## 4. 依赖关系 (Dependencies)

### 4.1 内部依赖 (Internal Dependencies)
该文件没有通过 `import`、`require` 或 ES Module 形式显式导入内部模块。  
但从行为上，它强依赖项目中的以下组件：

- `background.js`
  - 作为 Chrome 扩展后台/Service Worker 消息处理方。
  - 负责响应 `chrome.runtime.sendMessage` 中的各类 `action`。
- `console.html`
  - 提供本文件查询和操作的 DOM 元素，例如：
    - `enter-url`
    - `enter-mode`
    - `enter-go`
    - `prehook-state`
    - `tabs-list`
    - `events-list`
    - `hotspots-list`
    - `auth-media-select`
    - `auth-result`
- `chain.html` / `chain.js`
  - 文件中通过 `CHAIN_OPEN_WINDOW` 打开链路窗口，具体打开逻辑在后台或相关文件中实现。
- `inject.js` / `page-script.js`
  - 本文件展示的加密调用、函数追踪、媒体捕获等数据很可能来自页面注入与采集逻辑；但本文件未直接引用，具体实现不能仅凭本文件确定。

### 4.2 外部依赖 (External Dependencies)
- **Chrome Extensions API**
  - `chrome.runtime.connect`
  - `chrome.runtime.sendMessage`
  - `chrome.tabs.query`
  - `chrome.tabs.update`
  - `chrome.tabs.get`
  - `chrome.windows.update`
- **浏览器 DOM/Web API**
  - `document.getElementById`
  - `addEventListener`
  - `setInterval`
  - `Blob`
  - `URL.createObjectURL`
  - `URL.revokeObjectURL`
  - `document.createElement`
  - `window.open`
  - `confirm`
  - `Date`

## 5. 暴露的接口/API (Exposed Interfaces/APIs)
- 本文件没有使用 `export`，也没有显式向全局对象挂载 API。
- 所有函数和状态变量均位于 IIFE 内部，属于文件私有作用域。
- 从外部交互角度看，它通过以下方式“消费”而非“暴露”接口：
  - 监听 DOM 事件。
  - 向 Chrome 扩展后台发送消息。
  - 根据后台返回值更新控制台 UI。

可视为该文件提供给用户的 UI 操作入口包括：

- **URL 进入按钮 `enter-go`**: 触发 `doEnter()`，请求后台打开或复用 Tab 并开始调试链路采集。
- **链路窗口按钮 `open-chain`**: 发送 `CHAIN_OPEN_WINDOW` 打开链路窗口。
- **导出会话按钮 `export-session`**: 导出当前链路与事件数据为 JSON 文件。
- **重置会话按钮 `reset-session`**: 发送 `CHAIN_RESET_SESSION` 清空事件窗口并重置会话起点。
- **清空全部按钮 `clear-all`**: 发送 `CHAIN_CLEAR_ALL` 清空链路和事件数据。
- **媒体鉴权分析按钮 `auth-analyze-btn`**: 对选中的媒体请求执行鉴权来源分析。

## 6. 关键算法/逻辑流分析 (Key Algorithm/Logic Flow Analysis)

### 6.1 控制台初始化流程
1. 脚本通过 IIFE 立即执行，避免污染全局命名空间。
2. 定义 `$` 工具函数并缓存大量 DOM 节点。
3. 初始化状态变量：
   - `currentFilter`: 当前事件过滤类型，默认为 `ALL`。
   - `lastEventLen`: 上一次事件列表长度，用于避免重复渲染。
   - `lastAttachedKey`: 上一次已 attach Tab 摘要 key。
   - `lastHotspotKey`: 上一次热点摘要 key。
   - `lastFuncTraceLen`: 上一次函数调用轨迹数量。
   - `mediaList`、`selectedMediaId`、`autoAnalyzedForId`: 媒体鉴权分析状态。
4. 通过 `chrome.runtime.connect({ name: 'phantom-keepalive' })` 建立保活 Port，尝试降低 Service Worker 休眠概率。
5. 绑定各类按钮、输入框、下拉框的事件监听。
6. 调用 `pollAll()` 立即拉取一次数据。
7. 使用 `setInterval(pollAll, 1000)` 每秒轮询刷新。

### 6.2 URL 进入/复用 Tab 流程
1. 用户输入 URL 并点击进入或按下 Enter。
2. `doEnter()` 检查 URL 是否为空。
3. 如果 URL 没有 `http://` 或 `https://` 前缀，则自动补为 `https://`。
4. 根据 `enterMode` 判断：
   - `new`: 发送 `CONSOLE_ENTER_URL`，`tabId` 为 `null`。
   - `reuse`: 先通过 `chrome.tabs.query({})` 找到一个 HTTP Tab，并排除包含 `console.html` 的页面，然后发送 `CONSOLE_ENTER_URL`。
5. 发送过程中禁用进入按钮，避免重复提交。
6. 后台响应成功后，提示会话起点已重置，并调用 `pollAll()` 立即刷新。

### 6.3 已 Attach Tab 渲染与操作流程
1. `pollAttachedTabs()` 向后台请求 `GET_ATTACHED_TABS`。
2. 如果返回数据不是数组，直接退出。
3. 将每个 Tab 的 `tabId`、请求数量、pending 数、错误数、URL 前缀拼成 `key`。
4. 如果 `key` 与 `lastAttachedKey` 相同，说明可展示数据没有变化，跳过 DOM 更新。
5. 如果无 Tab，显示等待 attach 的空状态。
6. 如果存在 Tab，生成每一行 Tab 项：
   - 显示 Tab ID。
   - 显示短 URL，完整 URL 放在 `title`。
   - 显示请求数量、pending、错误数。
   - 提供“重用”和“聚焦”按钮。
7. “重用”按钮直接以当前输入 URL 在指定 `tabId` 中重新导航。
8. “聚焦”按钮激活目标 Tab，并将其所在窗口置前。

### 6.4 链路事件流展示流程
1. `pollEvents()` 请求 `CHAIN_GET_STATE`。
2. 数据源选择逻辑：
   - 优先使用 `state.sessionEvents`。
   - 如果无会话事件，则使用 `state.window`。
3. 根据事件过滤器 `currentFilter` 筛选事件。
4. 更新事件数量。
5. 如果过滤后数量与 `lastEventLen` 相同，则跳过渲染。
6. 如果无事件，显示“等待事件”。
7. 若有事件，取最近 200 条并倒序显示。
8. 每个事件根据 `step` 映射图标和中文标签。
9. 事件详情优先级：
   - 有 `url` 时显示短 URL。
   - 否则有 `algo` 时显示算法及部分明文。
   - 否则有 `field` 时显示字段和值。
   - 否则有 `key` 时显示键和值。

### 6.5 会话导出流程
1. 用户点击 `export-session`。
2. 脚本发送 `CHAIN_GET_STATE` 获取当前链路状态。
3. 组装导出对象：
   - `sessionStart`
   - `sessionStartUrl`
   - `chains`
   - `events`
   - `exportedAt`
4. 使用 `JSON.stringify(data, null, 2)` 生成格式化 JSON。
5. 创建 `Blob` 和临时 Object URL。
6. 创建隐藏/临时 `<a>` 元素并设置 `download` 文件名。
7. 模拟点击触发下载。
8. 移除 `<a>` 并释放 Object URL。

### 6.6 函数热点和函数调用轨迹展示流程
- **热点聚合展示:**
  1. `pollHotspots()` 请求 `GET_FRAME_HOTSPOTS`。
  2. 后台返回按栈帧聚合后的热点列表。
  3. 每项展示函数名、文件名、行号、事件类型图标和计数。
  4. 点击位置尝试用新标签打开对应文件。
- **最近调用展示:**
  1. `pollFuncTraces()` 请求 `GET_FUNC_TRACES`。
  2. 每项按调用状态标记为：
     - `ERR`: 异常调用。
     - `ASY`: 异步调用。
     - `SYN`: 同步调用。
  3. 展示函数 label、参数摘要、耗时与时间。

### 6.7 媒体请求鉴权分析流程
1. `pollAuthMediaList()` 每秒请求最近媒体请求。
2. 更新媒体请求下拉框。
3. 如果用户未手动选择请求，自动对最新媒体请求执行分析。
4. `runAuthAnalysis()` 发送 `ANALYZE_REQUEST_AUTH`，携带请求 ID 和 URL。
5. 后台返回后，`renderAuthAnalysis()` 将结果分为：
   - Cookie 来源分析。
   - 关键自定义头。
   - 浏览器自动头。
6. 每个 Header/Cookie 条目由 `renderAuthRow()` 根据 `verdict` 渲染来源说明。

### 6.8 性能优化策略
该文件在多个高频轮询区域使用轻量级 diff 策略减少不必要 DOM 操作：

- `lastAttachedKey`: 比较 attached tabs 的摘要。
- `lastEventLen`: 比较事件数量。
- `lastHotspotKey`: 比较热点文件、行号和计数。
- `lastFuncTraceLen`: 比较函数轨迹数量。
- `sel.dataset.key`: 比较媒体请求 ID 列表。

这些优化可以降低每秒轮询带来的渲染开销，但也存在局限：如果列表长度不变但内容变化，部分区域可能不会重新渲染。例如 `pollEvents()` 只比较长度，若同等数量事件的内容发生变化，界面不会更新。

### 6.9 潜在风险与注意事项
1. **高度依赖后台消息协议**
   - 本文件没有对后台响应结构进行完整校验。
   - 如果 `background.js` 返回字段缺失或类型变化，UI 可能显示异常。

2. **轮询频率固定为 1 秒**
   - 每秒调用多个 `chrome.runtime.sendMessage`，包括统计、事件、热点、函数轨迹、媒体请求等。
   - 在数据量较大或后台处理较重时，可能造成扩展性能压力。

3. **部分 DOM 更新判断较粗**
   - `pollEvents()` 仅通过 `filtered.length` 判断是否重绘。
   - `pollFuncTraces()` 仅通过 `traces.length` 判断是否重绘。
   - 当数量不变但内容变更时，UI 可能展示旧数据。

4. **内联 HTML 拼接较多**
   - 虽然多数动态数据使用 `esc()` 转义，但仍需持续保持谨慎。
   - 样式值如 `meta.color` 来自本地常量，风险较低。
   - 如果未来引入未经转义的数据到 HTML 属性或 style 中，可能产生注入风险。

5. **复用 Tab 选择逻辑较简单**
   - `mode === 'reuse'` 时通过 `chrome.tabs.query({})` 选择第一个 HTTP Tab，并排除 URL 包含 `console.html` 的页面。
   - 这并不一定是用户当前期望复用的 Tab。
   - Tab 列表中的“重用”按钮则可以明确指定 `tabId`，行为更准确。

6. **Service Worker 保活并非绝对可靠**
   - 代码通过 `chrome.runtime.connect` 建立名为 `phantom-keepalive` 的 Port。
   - `onDisconnect` 中只尝试重连一次，且没有保存新 Port 引用。
   - Manifest V3 下 Service Worker 生命周期仍可能受到浏览器策略影响。

7. **Chrome API 错误未检查**
   - 多处调用 `chrome.tabs.*`、`chrome.runtime.sendMessage` 后未检查 `chrome.runtime.lastError`。
   - 当 Tab 不存在、权限不足、Service Worker 不可用时，错误可能被静默忽略。

8. **导出数据可能较大**
   - 会话事件和链路数据全部序列化为 JSON。
   - 如果长时间采集，可能导致内存占用和下载文件较大。

## 7. 标签/关键词 (Tags/Keywords)
- `Chrome扩展控制台`
- `Service Worker通信`
- `链路事件流`
- `调试器Attach状态`
- `函数追踪`
- `媒体请求分析`
- `鉴权溯源`
- `轮询渲染`

---


### 📄 `inject.js`

# 代码文件分析报告: `F:\neural-phantom-4.7\inject.js`

## 1. 文件元数据 (File Metadata)
- **文件路径:** `F:\neural-phantom-4.7\inject.js`
- **语言类型:** JavaScript
- **代码行数:** 约 3200+ 行

## 2. 核心功能摘要 (Core Functionality Summary)
该文件是 Chrome 扩展 Neural Phantom 的核心 Content Script/UI 注入层，负责在目标网页中创建 Shadow DOM 调试面板、接收 background/page-script 的抓包与 Hook 事件，并提供网络抓包、WebSocket 拦截、密钥审计、参数溯源、视频链路逆向、AI 分析、请求构造、Storage/Cookie 监控等大量交互功能。它主要充当页面上下文、扩展后台 Service Worker 与可视化调试面板之间的桥接与渲染控制中心。

## 3. 主要结构与组件 (Main Structures & Components)
该文件没有使用 ES Module、类或显式模块化结构，而是以大量全局状态变量、消息监听器、UI 构建函数和渲染/工具函数组成。整体可分为以下组件：

1. **反检测与页面桥接**
   - 修改 `navigator.webdriver`，降低页面检测自动化/调试环境的概率。
   - 通过 `window.postMessage` 与 `page-script.js` 通信。
   - 通过 `chrome.runtime.sendMessage/onMessage` 与 background 通信。

2. **Shadow DOM 调试面板**
   - 使用 `panelHost.attachShadow({ mode: 'open' })` 创建隔离 UI。
   - 加载 `dashboard.css`。
   - 动态生成包含大量 Tab 的主面板。

3. **网络抓包与缓存**
   - 接收 `SYNC_LOG` 日志。
   - 维护 `logsMap`、`postCacheStore`、`trafficCacheStore`。
   - 支持请求详情查看、响应体拉取、POST 库、全流量搜索与导出。

4. **拦截与改写能力**
   - Mock 响应规则。
   - 动态 Hook 脚本。
   - Header 覆盖。
   - 本地文件替换。
   - CSS 注入。
   - 请求断点修改/放行/丢弃。
   - WebSocket 帧拦截、改写、断点放行/丢弃。

5. **审计与逆向分析**
   - 密钥库 Key Vault。
   - 加密/解密 Hook 报告展示。
   - 参数来源追踪。
   - 参数加密检测。
   - 签名字段嗅探。
   - 函数调用追踪。
   - 视频/音频/文字/图片链路追踪。

6. **辅助工具**
   - 编解码工具箱。
   - JWT 解码。
   - 安全头扫描。
   - 端点提取。
   - 被动漏洞扫描。
   - 参数挖掘。
   - HAR 录制/导入/回放。
   - 请求构造器。
   - AI 代码分析与自动生成。

### 3.1 函数/方法 (Functions/Methods)
- **`sendAIMessage(msg, callback)`**: 向 background 发送 AI 分析相关消息，并通过 `chrome.runtime.connect` 建立 keepalive port，降低 Service Worker 在等待 AI 响应时休眠的概率。
  - **输入参数:** `msg` 消息对象，`callback` 回调函数。
  - **返回值:** 无。
  - **关键逻辑:** 建立 port → `chrome.runtime.sendMessage` → 响应后断开 port → 调用回调。

- **`syncRulesToPage()`**: 将 Mock 规则、动态脚本、本地文件替换规则同步给页面脚本。
  - **输入参数:** 无。
  - **返回值:** 无。
  - **关键逻辑:** 使用 `window.postMessage` 发送 `UPDATE_MOCK_RULES`、`UPDATE_DYNAMIC_SCRIPT`、`UPDATE_LOCAL_FILE_RULES`。

- **`toggleDashboard()`**: 打开或关闭主调试面板。
  - **输入参数:** 无。
  - **返回值:** 无。
  - **关键逻辑:** 若面板已打开则隐藏；否则创建/显示 UI，并从 background 拉取历史日志，刷新流量、Mock、文件替换、密钥库、动态脚本编辑器等视图。

- **`createDashboardUI()`**: 创建完整的 Shadow DOM 面板 UI。
  - **输入参数:** 无。
  - **返回值:** 无。
  - **关键逻辑:** 等待 `document.body` 可用 → 创建 `panelHost` → attach shadow root → 引入 CSS → 注入轻量 Prism 兼容语法高亮实现 → 构造超大 `container.innerHTML` → 绑定事件 → 启用拖拽。

- **`initEvents()`**: 绑定主面板绝大多数交互事件。
  - **输入参数:** 无。
  - **返回值:** 无。
  - **关键逻辑:** 绑定 Tab 切换、搜索过滤、断点开关、断点弹窗、Mock/Header/脚本/AI/导出/清空/HAR/请求构造器/密钥库/参数追踪/Storage/WS/编解码/JWT/扫描器/POST 库/媒体/Cookie/函数追踪/解密/参数加密等大量事件。

- **`buildParamResultHTML(result)`**: 构建参数来源分析结果 HTML。
  - **输入参数:** `result` 参数溯源结果对象。
  - **返回值:** HTML 字符串。
  - **关键逻辑:** 根据 `verdict` 判断参数来源类型，如响应体、其他请求或 JS 动态计算，并渲染来源列表。

- **`renderParamAnalysis(trace, analysis)`**: 将实时参数追踪分析结果渲染到参数来源追踪面板。
  - **输入参数:** `trace` 请求/调用追踪信息，`analysis` 分析数组。
  - **返回值:** 无。
  - **关键逻辑:** 过滤有价值结果 → 构建卡片 → 展示参数、判定、来源、调用栈 → 支持展开详情。

- **`addToKeyVault({ type, value, source, category, pinned })`**: 将密钥/敏感值加入密钥库。
  - **输入参数:** 对象参数，包含类型、值、来源、分类、是否置顶。
  - **返回值:** 无。
  - **关键逻辑:** 过滤短值 → 基于 `type + value` 去重 → 更新计数或新增记录 → 限制最大 500 条 → 刷新 UI。

- **`renderKeyVault()`**: 渲染密钥库列表。
  - **输入参数:** 无。
  - **返回值:** 无。
  - **关键逻辑:** 根据分类过滤 → 置顶排序 → 渲染密钥卡片 → 绑定复制、置顶、删除、标签保存、展开值等事件。

- **`buildKeyAlertHTML({ type, value, source, category })`**: 构造审计区密钥告警 HTML。
  - **输入参数:** 密钥类型、值、来源、分类。
  - **返回值:** HTML 字符串。
  - **关键逻辑:** 根据分类设置颜色，生成入库/复制按钮。

- **`bindKeyAlertEvents(div)`**: 为密钥告警卡片绑定按钮事件。
  - **输入参数:** DOM 元素 `div`。
  - **返回值:** 无。
  - **关键逻辑:** 绑定入库与复制按钮。

- **`renderAlertRules()`**: 渲染条件告警规则列表。
  - **输入参数:** 无。
  - **返回值:** 无。
  - **关键逻辑:** 展示规则名称、类型、值、启用状态，并支持删除/启停。

- **`renderSchemaSnapshots(snapshots)`**: 渲染接口 Schema 快照列表。
  - **输入参数:** `snapshots` 快照数组。
  - **返回值:** 无。
  - **关键逻辑:** 展示 URL 与 schema 内容，支持展开与删除。

- **`showCodeGenModal(codes)`**: 展示 AI 生成的多语言请求代码。
  - **输入参数:** `codes` 语言到代码内容的映射对象。
  - **返回值:** 无。
  - **关键逻辑:** 使用主 modal 显示语言 Tab 和代码内容。

- **`showFuzzCases(cases)`**: 展示并可批量执行 AI 生成的 Fuzz 用例。
  - **输入参数:** `cases` Fuzz 用例数组。
  - **返回值:** 无。
  - **关键逻辑:** 渲染用例说明、URL、Body、预期异常，并提供批量 `fetch` 执行按钮。

- **`appendWsFrame(container, dir, frame, requestId)`**: 向 WebSocket 帧面板追加一条帧记录。
  - **输入参数:** 容器、方向、帧数据、请求 ID。
  - **返回值:** 无。
  - **关键逻辑:** 根据发送/接收方向设置颜色，展示预览并提供复制按钮。

- **`runDiff(itemA, itemB)`**: 对两个请求响应体进行差异分析。
  - **输入参数:** 请求 A、请求 B。
  - **返回值:** Promise/异步无显式返回。
  - **关键逻辑:** 拉取响应体 → 尝试 JSON 解析 → JSON 深度 Diff 或文本 Diff → 渲染新增、删除、值变更、类型变化。

- **`jsonDeepDiff(a, b, path, changes)`**: 递归比较两个 JSON 数据结构。
  - **输入参数:** 对象 A、对象 B、当前路径、变更数组。
  - **返回值:** 无，结果写入 `changes`。
  - **关键逻辑:** 比较类型、对象键、数组索引、原始值差异。

- **`jsonTypeStr(v)`**: 返回 JSON 值类型描述。
  - **输入参数:** 任意值。
  - **返回值:** 类型字符串。
  - **关键逻辑:** 特判 `null` 和数组。

- **`jsonValStr(v)`**: 将 JSON 值转换为短字符串。
  - **输入参数:** 任意值。
  - **返回值:** 字符串。
  - **关键逻辑:** 对对象 JSON 序列化并截断，对原始值字符串化并截断。

- **`renderTextDiff(bodyA, bodyB, container)`**: 渲染文本行级 Diff。
  - **输入参数:** 文本 A、文本 B、容器。
  - **返回值:** 无。
  - **关键逻辑:** 按行比较，输出相同/删除/新增行。

- **`fetchBody(item)`**: 根据请求项从 background 获取响应体。
  - **输入参数:** 请求对象。
  - **返回值:** Promise，解析为响应体字符串。
  - **关键逻辑:** 如果本地已有 `content` 直接返回，否则发送 `FETCH_BODY`，处理 base64 解码。

- **`escHtml(s)`**: HTML 转义。
  - **输入参数:** 任意值。
  - **返回值:** 转义后的字符串。
  - **关键逻辑:** 替换 `&`、`<`、`>`。

- **`saveToPostCache(item)`**: 保存请求到 POST/请求缓存库。
  - **输入参数:** 抓包日志项。
  - **返回值:** 无。
  - **关键逻辑:** 新增或更新缓存条目 → 异步获取响应体 → 存入 `chrome.storage.local` → 刷新 POST 缓存视图。

- **`getFilteredPostCache()`**: 根据多维过滤条件筛选 POST 缓存库。
  - **输入参数:** 无。
  - **返回值:** 过滤后的缓存数组。
  - **关键逻辑:** 按 Method、状态码段、是否有响应体、最小耗时、关键字范围过滤。

- **`renderPostCache()`**: 渲染 POST/请求缓存库列表。
  - **输入参数:** 无。
  - **返回值:** 无。
  - **关键逻辑:** 统计总数/筛选数，展示请求摘要、请求体预览、响应体缓存状态，并绑定详情、复制、删除操作。

- **`showPostCacheDetail(entry)`**: 展示缓存请求详情。
  - **输入参数:** 缓存条目。
  - **返回值:** 无。
  - **关键逻辑:** 在 modal 中展示请求概要、请求体、响应体、Headers，并支持标签切换和语法高亮。

- **`renderFuncHookedList()`**: 渲染已挂钩函数标签列表。
  - **输入参数:** 无。
  - **返回值:** 无。
  - **关键逻辑:** 展示函数名标签，支持从列表中移除显示项。

- **`renderFuncTrace()`**: 渲染函数调用追踪日志。
  - **输入参数:** 无。
  - **返回值:** 无。
  - **关键逻辑:** 展示函数名、同步/异步、耗时、入参、返回值、异常和调用栈；点击可打开完整详情。

- **`renderDecryptList()`**: 渲染解密猎手记录。
  - **输入参数:** 无。
  - **返回值:** 无。
  - **关键逻辑:** 展示算法、密钥、密文、明文、调用栈，并支持复制。

- **`renderParamCryptoList()`**: 渲染参数加密检测列表。
  - **输入参数:** 无。
  - **返回值:** 无。
  - **关键逻辑:** 根据搜索和类型过滤参数加密结果，展示检测类型、原值、解码结果和详情 modal。

- **`renderCookieTimeline()`**: 渲染 Cookie 变化时间线。
  - **输入参数:** 无。
  - **返回值:** 无。
  - **关键逻辑:** 根据 Cookie 名过滤，显示 SET/DELETE/READ/MODIFY 等事件、值和来源。

- **`renderMediaView()`**: 渲染媒体嗅探器列表。
  - **输入参数:** 无。
  - **返回值:** 无。
  - **关键逻辑:** 根据 URL 过滤媒体资源，展示扩展名、大小、URL，并提供复制/打开。

- **`renderLocalFileRules()`**: 渲染本地文件替换规则。
  - **输入参数:** 无。
  - **返回值:** 无。
  - **关键逻辑:** 展示 URL 关键字到本地文件名映射，支持删除并同步规则。

- **`renderMockRules()`**: 渲染静态 Mock 规则。
  - **输入参数:** 无。
  - **返回值:** 无。
  - **关键逻辑:** 展示 URL 关键字和响应体预览，支持删除并同步到页面。

- **`syntaxHighlight(json)`**: 简单 JSON 语法高亮。
  - **输入参数:** JSON 对象或字符串。
  - **返回值:** HTML 字符串。
  - **关键逻辑:** JSON stringify 后用正则包装字符串、数字、布尔、null、key。

- **`prismHighlight(code, lang)`**: 调用 Prism 兼容高亮器。
  - **输入参数:** 代码字符串、语言。
  - **返回值:** 高亮 HTML 字符串。
  - **关键逻辑:** 优先调用 `window.Prism.highlight`，失败则 HTML 转义。

- **`detectLang(content, type)`**: 根据内容和类型推断代码语言。
  - **输入参数:** 内容、资源类型。
  - **返回值:** 语言标识。
  - **关键逻辑:** 判断 XHR/JSON、SCRIPT、CSS、HTML，默认 JavaScript。

- **`renderContentInModal(content, type, isBase64)`**: 在源码审计 modal 中渲染内容。
  - **输入参数:** 内容、类型、是否 base64。
  - **返回值:** 无。
  - **关键逻辑:** 图片特殊展示，base64 解码，M3U8 特殊渲染，JSON 格式化，其他内容语法高亮。

- **`makeDraggable(element, handle)`**: 为指定元素添加 PC/移动端拖拽能力。
  - **输入参数:** 被拖拽元素、拖拽手柄。
  - **返回值:** 无。
  - **关键逻辑:** 监听 mouse/touch start/move/end，实时调整 top/left。

- **`processLog(item)`**: 处理一条抓包日志并渲染到抓包列表。
  - **输入参数:** 日志项。
  - **返回值:** 无。
  - **关键逻辑:** 保存到 `logsMap`，若已存在则更新状态/耗时，否则创建日志 DOM，绑定收藏、Diff、复制、查看、重放事件，并自动写入 POST 缓存。

- **`applyFilter()`**: 对抓包列表应用当前过滤条件。
  - **输入参数:** 无。
  - **返回值:** 无。
  - **关键逻辑:** 遍历 `.log-item` 调用 `applyFilterSingle`。

- **`applyFilterSingle(item)`**: 判断单条抓包记录是否显示。
  - **输入参数:** 日志 DOM 元素。
  - **返回值:** 无。
  - **关键逻辑:** 按类型、搜索文本、收藏状态设置 `display`。

- **`showLogContent(item, fromBodyReady = false)`**: 展示单个请求详情和响应体。
  - **输入参数:** 日志项、是否来自响应体就绪刷新。
  - **返回值:** 无。
  - **关键逻辑:** 处理失败/取消请求、已有缓存、等待响应体、空响应、拉取失败、成功响应；支持 POST payload 与响应体联合展示。

- **`getCookies()`**: 拉取当前域 Cookie 并展示。
  - **输入参数:** 无。
  - **返回值:** 无。
  - **关键逻辑:** 向 background 发送 `FETCH_COOKIES`，用 modal 展示 cookie 名和值。

- **`exportData()`**: 导出当前 `logsMap` 中的抓包数据。
  - **输入参数:** 无。
  - **返回值:** 无。
  - **关键逻辑:** 转为 JSON Blob 并触发下载。

- **`togglePickerMode()`**: 启停页面元素吸管模式。
  - **输入参数:** 无。
  - **返回值:** 无。
  - **关键逻辑:** 切换 `isInspecting`，绑定/解绑 hover 和 click，隐藏/恢复主面板。

- **`handleHover(e)`**: 吸管模式 hover 高亮元素。
  - **输入参数:** 鼠标事件。
  - **返回值:** 无。
  - **关键逻辑:** 给当前元素添加红色虚线 outline。

- **`handleClick(e)`**: 吸管模式点击捕获元素选择器。
  - **输入参数:** 点击事件。
  - **返回值:** 无。
  - **关键逻辑:** 阻止默认事件，生成 CSS Selector 和 XPath，展示结果，关闭吸管模式。

- **`getCssSelector(el)`**: 生成元素 CSS Selector。
  - **输入参数:** DOM 元素。
  - **返回值:** selector 字符串。
  - **关键逻辑:** 优先使用 id，否则逐级计算 `nth-of-type`。

- **`getXpath(el)`**: 生成元素 XPath。
  - **输入参数:** DOM 元素。
  - **返回值:** XPath 字符串。
  - **关键逻辑:** 优先使用 id，否则逐级计算同标签兄弟索引。

- **`createOverlay()`**: 创建吸管结果浮层。
  - **输入参数:** 无。
  - **返回值:** 无。
  - **关键逻辑:** 创建固定定位浮层，包含 CSS Selector/XPath 输入框和关闭按钮。

- **`showResult(css, xpath)`**: 展示吸管结果。
  - **输入参数:** CSS Selector、XPath。
  - **返回值:** 无。
  - **关键逻辑:** 确保 overlay 存在并填充值。

- **`phantomMD5(str)`**: 纯前端 MD5 实现。
  - **输入参数:** 字符串。
  - **返回值:** MD5 十六进制字符串。
  - **关键逻辑:** 实现 MD5 四轮压缩函数 `ff/gg/hh/ii`、分块、padding 和摘要输出。

- **`saveToTrafficCache(logData)`**: 保存所有流量到全流量缓存。
  - **输入参数:** 抓包日志。
  - **返回值:** 无。
  - **关键逻辑:** 跳过扩展自身请求，新增/合并 Pending 到完成状态，限制最大 500 条，节流写入 storage，刷新全流量视图。

- **`highlightText(text, keyword)`**: 对文本中的关键字做高亮。
  - **输入参数:** 文本、关键字。
  - **返回值:** HTML 字符串。
  - **关键逻辑:** 先转义，再用正则替换为 `<mark>`。

- **`trafficMatchesKeyword(entry, keyword)`**: 判断全流量条目是否命中关键字。
  - **输入参数:** 流量条目、关键字。
  - **返回值:** 布尔值。
  - **关键逻辑:** 匹配 URL、POST body、method、请求头、响应头。

- **`renderTrafficView()`**: 渲染全流量查看器。
  - **输入参数:** 无。
  - **返回值:** 无。
  - **关键逻辑:** 按 method 与关键字过滤，更新统计，渲染列表并绑定详情点击。

- **`parseUrlParams(url)`**: 解析 URL Query 参数。
  - **输入参数:** URL。
  - **返回值:** `{ key, value }[]`。
  - **关键逻辑:** 使用 `URL` 和 `searchParams`。

- **`parseBodyParams(body)`**: 解析请求体参数。
  - **输入参数:** body 字符串。
  - **返回值:** 参数数组。
  - **关键逻辑:** 优先 JSON flatten，再尝试 URLSearchParams。

- **`renderParamTableHL(params, keyword)`**: 渲染带高亮的参数表格。
  - **输入参数:** 参数数组、关键字。
  - **返回值:** HTML 字符串。
  - **关键逻辑:** key/value 命中时整行高亮。

- **`renderHeadersHL(headers, keyword)`**: 渲染带高亮的 Headers 表格。
  - **输入参数:** header 对象、关键字。
  - **返回值:** HTML 字符串。
  - **关键逻辑:** 遍历 header 键值并高亮命中项。

- **`showTrafficDetail(entry)`**: 展示全流量请求详情 modal。
  - **输入参数:** 流量条目。
  - **返回值:** 无。
  - **关键逻辑:** 展示 URL、Query、Body、请求头、响应头、元信息，支持复制 JSON 和生成 cURL。

- **`bindTrafficEvents()`**: 绑定全流量面板事件。
  - **输入参数:** 无。
  - **返回值:** 无。
  - **关键逻辑:** 搜索框防抖、Method chip、清空、导出、modal 背景关闭。

- **`updateScriptRegistry(logData)`**: 将脚本请求注册到视频链路脚本清单。
  - **输入参数:** 抓包日志。
  - **返回值:** 无。
  - **关键逻辑:** 仅处理 SCRIPT 或 JavaScript MIME，按 URL 存入 `scriptRegistry`。

- **`attributeEventToScript(data)`**: 将携带调用栈帧的事件归属到脚本文件。
  - **输入参数:** 事件数据。
  - **返回值:** 无。
  - **关键逻辑:** 取第一帧文件作为主责脚本，累计加密/解密/请求/签名计数，并保存事件索引。

- **`buildEventSummary(data)`**: 为视频链路脚本事件生成摘要。
  - **输入参数:** 事件数据。
  - **返回值:** 摘要字符串。
  - **关键逻辑:** 按事件类型返回不同字段组合。

- **`renderFrames(frames, maxShow)`**: 渲染调用栈帧。
  - **输入参数:** frames 数组、最大显示数量。
  - **返回值:** HTML 字符串。
  - **关键逻辑:** 每帧生成可点击源码跳转链接 `.sv-link`。

- **`renderVideoChain()`**: 视频链路主渲染入口。
  - **输入参数:** 无。
  - **返回值:** 无。
  - **关键逻辑:** 从 background 获取链路状态，渲染视频列表、脚本列表、事件时间线。

- **`renderVcMediaList(chains)`**: 渲染发现的视频/媒体链路。
  - **输入参数:** 链路数组。
  - **返回值:** 无。
  - **关键逻辑:** 展示媒体 URL、事件数量、API 提取来源，支持复制、展开事件、校验头分析。

- **`renderAuthAnalysis(res)`**: 渲染校验头/鉴权数据溯源结果。
  - **输入参数:** 分析结果对象。
  - **返回值:** HTML 字符串。
  - **关键逻辑:** 按 Cookie、关键自定义头、浏览器自动头分类展示来源判定。

- **`renderAuthRow(item)`**: 渲染单个鉴权头/Cookie 来源行。
  - **输入参数:** 头或 Cookie 分析项。
  - **返回值:** HTML 字符串。
  - **关键逻辑:** 根据 verdict 显示来源解释，如 Set-Cookie、响应体、JS 加密、统计 SDK 等。

- **`bindAuthAnalysisEvents(container)`**: 绑定鉴权溯源结果中的源码链接。
  - **输入参数:** 容器元素。
  - **返回值:** 无。
  - **关键逻辑:** 点击 `.auth-src-link` 调用 `showSourceAt`。

- **`renderVcScriptsList()`**: 渲染视频链路 JS 文件清单。
  - **输入参数:** 无。
  - **返回值:** 无。
  - **关键逻辑:** 按过滤条件和活跃度排序脚本，展示加密/解密/网络/签名计数，支持源码查看和事件展开。

- **`renderVcEvents(events)`**: 渲染视频链路事件时间线。
  - **输入参数:** 事件数组。
  - **返回值:** 无。
  - **关键逻辑:** 按事件类型过滤，倒序展示最近事件。

- **`buildEventLineHTML(evt)`**: 构造单个视频链路事件 HTML。
  - **输入参数:** 事件对象。
  - **返回值:** HTML 字符串。
  - **关键逻辑:** 根据 `evt.step` 设置图标、颜色、摘要字段，并附带调用栈帧。

- **`startVideoChainPolling()`**: 开始视频链路轮询刷新。
  - **输入参数:** 无。
  - **返回值:** 无。
  - **关键逻辑:** 按短链路/会话模式设置不同间隔，周期调用 `renderVideoChain`。

- **`stopVideoChainPolling()`**: 停止视频链路轮询。
  - **输入参数:** 无。
  - **返回值:** 无。
  - **关键逻辑:** 清除 `videoChainTimer`。

- **`showSourceAt(fileUrl, line, col)`**: 源码查看器跳转到指定文件行列。
  - **输入参数:** 文件 URL、行号、列号。
  - **返回值:** 无。
  - **关键逻辑:** 请求 background 获取源码 → 高亮整文件 → 按行加行号 → 滚动到目标行。

- **`bindVideoChainEvents()`**: 绑定视频链路面板及源码查看器事件。
  - **输入参数:** 无。
  - **返回值:** 无。
  - **关键逻辑:** 绑定 URL 进入、模式切换、刷新、重置、清空、导出、脚本过滤、事件过滤、源码查看器按钮、全局 `.sv-link` 代理、预挂钩事件。

- **`bindPreHookEvents()`**: 绑定预挂钩引擎 UI。
  - **输入参数:** 无。
  - **返回值:** 无。
  - **关键逻辑:** 查询/显示预挂钩状态，绑定启用、暂停子 Target、状态轮询和 badge 跳转设置页。

此外，文件中还定义了多个在函数内部作用域中的局部函数，如 `renderBpParams`、`syncParamsToUrl`、`validateScript`、`updateLineNumbers`、`renderWsRules`、`syncWsRules`、`renderStorageKV`、`refreshModelList`、`handleAICall`、`doEnter` 等。这些函数因定义在 `initEvents()` 或其他函数内部，主要用于局部 UI 控制，不作为全局 API 暴露。

### 3.2 类/结构体 (Classes/Structs)
- 本文件未定义 JavaScript `class`。
- 主要数据结构以普通对象、数组、`Map`、`Set` 形式存在。

- **`logsMap`**: `Map`
  - **用途:** 保存抓包请求 ID 到日志对象的映射。
  - **主要属性:** Map key 为请求 ID，value 为请求日志对象。
  - **核心方法:** 使用原生 `set/get/has/clear/values`。

- **`scriptRegistry`**: `Map`
  - **用途:** 视频链路逆向中记录 JS 文件信息与活动计数。
  - **主要属性:** value 形如 `{ url, mime, size, loadTime, cryptoCount, requestCount, decryptCount, mediaRefs, signalCount }`。
  - **核心方法:** 由 `updateScriptRegistry()`、`attributeEventToScript()` 写入，由 `renderVcScriptsList()` 渲染。

- **`scriptEventsByUrl`**: `Map`
  - **用途:** 按脚本 URL 保存归属事件。
  - **主要属性:** key 为脚本 URL，value 为事件数组。
  - **核心方法:** 在 `attributeEventToScript()` 中维护，在脚本详情展开时读取。

- **`starredSet` / `keyVaultPinned` / `pcFilter.methods`**: `Set`
  - **用途:** 分别用于收藏请求、密钥置顶、多选 Method 过滤。
  - **主要属性:** 字符串 ID 或 Method。
  - **核心方法:** `add/delete/has`。

- **`keyVault`**: 数组
  - **用途:** 保存自动发现的密钥、敏感字段、加密密钥、明文等。
  - **主要属性:** `{ id, type, value, source, category, time, lastSeen, count, pinned, tag }`。
  - **核心方法:** 通过 `addToKeyVault()` 去重入库，通过 `renderKeyVault()` 展示。

- **`postCacheStore`**: 数组
  - **用途:** 请求缓存库，保存请求/响应体及 headers。
  - **主要属性:** `{ id, url, method, time, status, duration, postData, contentType, responseHeaders, requestHeaders, responseBody, saved }`。
  - **核心方法:** `saveToPostCache()`、`getFilteredPostCache()`、`renderPostCache()`。

- **`trafficCacheStore`**: 数组
  - **用途:** 全流量缓存，持久化 GET/POST 等所有请求。
  - **主要属性:** `{ id, url, method, status, postData, requestHeaders, responseHeaders, time, mimeType, type, durationMs }`。
  - **核心方法:** `saveToTrafficCache()`、`renderTrafficView()`、`showTrafficDetail()`。

- **`funcTraceStore`**: 数组
  - **用途:** 函数调用追踪记录。
  - **主要属性:** `{ id, label, args, returnVal, error, isAsync, stack, durationMs, time }`。
  - **核心方法:** `renderFuncTrace()`。

- **`decryptStore`**: 数组
  - **用途:** 解密猎手记录。
  - **主要属性:** `{ id, algo, ciphertext, key, cfg, plaintext, stack, time }`。
  - **核心方法:** `renderDecryptList()`。

- **`paramCryptoStore`**: 数组
  - **用途:** 参数加密检测记录。
  - **主要属性:** `{ id, key, value, detected, decoded, url, method, time }`。
  - **核心方法:** `renderParamCryptoList()`。

- **`cookieTimeline`**: 数组
  - **用途:** Cookie 变化事件。
  - **主要属性:** `{ name, value, oldValue, op, time, source }`。
  - **核心方法:** `renderCookieTimeline()`。

### 3.3 接口/Traits (Interfaces/Traits)
- 本文件未定义 TypeScript interface、Flow 类型或其他显式接口。
- 但存在大量约定式消息接口：

- **Chrome Runtime 消息接口**
  - `REDIRECT_M3U8`
  - `TOGGLE_PICKER`
  - `TOGGLE_PANEL`
  - `SYNC_LOG`
  - `KEY_FOUND`
  - `SENSITIVE_FIELD_FOUND`
  - `PARAM_ANALYZED`
  - `BODY_READY`
  - `SCHEMA_CHANGED`
  - `ALERT_HIT`
  - `HAR_REPLAY_REQUEST`
  - `ABORT_REQUEST_FROM_UI`
  - `WS_FRAME`
  - `WS_EVENT`

- **Window postMessage 页面桥接接口**
  - 接收：
    - `REQUEST_PAUSED_INTERNAL`
    - `STORAGE_EVENT`
    - `STORAGE_DUMP_RESULT`
    - `WS_HOOK_SENT`
    - `WS_HOOK_RECV`
    - `WS_HOOK_MODIFIED`
    - `CRYPTO_REPORT`
    - `PARAM_TRACE`
    - `FUNC_TRACE`
    - `TRACE_FUNCTION_RESULT`
    - `DECRYPT_FOUND`
    - `PARAM_CRYPTO_FOUND`
    - `COOKIE_CHANGED`
    - `SIGN_FIELD_FOUND`
    - `AUDIO_TRACK`
    - `TEXT_TRACK`
    - `IMAGE_TRACK`
    - `DECRYPT_KEY_TRACK`
  - 发送：
    - `ADD_REDIRECT_RULE`
    - `ABORT_REQUEST`
    - `RESUME_REQUEST`
    - `UPDATE_MOCK_RULES`
    - `UPDATE_DYNAMIC_SCRIPT`
    - `UPDATE_LOCAL_FILE_RULES`
    - `TOGGLE_BREAKPOINT`
    - `REPLAY_REQUEST`
    - `DUMP_STORAGE`
    - `UPDATE_WS_RULES`
    - `TRACE_FUNCTION`
    - `WS_FRAME_RESUME`
    - `WS_FRAME_ABORT`

这些接口均依赖消息对象中的 `action` 或 `type` 字段进行分发。

### 3.4 常量/枚举 (Constants/Enums)
- **`MAX_POST_CACHE`**: POST/请求缓存库最大长度，值为 `300`。
- **`MAX_TRAFFIC_CACHE`**: 全流量缓存最大长度，值为 `500`。
- **`MAX_COOKIE_EVENTS`**: Cookie 时间线最大事件数，值为 `500`。
- **`MAX_FUNC_TRACE`**: 函数调用追踪最大记录数，值为 `500`。
- **`MAX_DECRYPT`**: 解密记录最大数，值为 `300`。
- **`MAX_PARAM_CRYPTO`**: 参数加密检测最大数，值为 `500`。
- **`VERDICT_META`**: 鉴权头/校验数据来源判定元信息映射。
  - 包含：
    - `BROWSER_AUTO`
    - `FROM_SET_COOKIE`
    - `FROM_RESPONSE_BODY`
    - `JS_CRYPTO`
    - `CLIENT_TRACKER`
    - `UNKNOWN`
    - `UNKNOWN_JS`
  - 用于校验头溯源 UI 的图标、颜色、标签显示。
- **`videoChainMode`**: 视频链路模式状态，取值语义为 `'short' | 'session'`。
- **`trafficMethodFilter`**: 全流量 Method 过滤状态，默认 `'ALL'`。
- **`paramCryptoTypeFilter`**: 参数加密类型过滤状态，默认 `'ALL'`。
- **`currentTypeFilter`**: 抓包列表资源类型过滤状态，默认 `'ALL'`。

## 4. 依赖关系 (Dependencies)
### 4.1 内部依赖 (Internal Dependencies)
该文件没有使用 `import` 或 `require` 显式导入模块，但通过运行时 API 引用了项目内资源和其他脚本能力：

- `dashboard.css`
  - 通过 `chrome.runtime.getURL('dashboard.css')` 加载到 Shadow DOM。
- `page-script.js`
  - 注释说明该脚本由 manifest content_scripts 的 MAIN world 注入。
  - 本文件通过 `window.postMessage` 与其进行双向通信。
- `background.js`
  - 未直接导入，但大量通过 `chrome.runtime.sendMessage` / `chrome.runtime.onMessage` / `chrome.runtime.connect` 依赖其提供后台功能。
- `chain.html` / `chain.js`
  - 通过 `CHAIN_OPEN_WINDOW`、`CHAIN_GET_STATE`、`CHAIN_PUSH_EVENT` 等消息间接关联链路追踪窗口。
- `console.html` / `console.js`
  - 通过 `OPEN_CONSOLE_WINDOW`、`FUNC_TRACE_PUSH` 等消息间接关联独立控制台窗口。
- `manifest.json`
  - 隐含依赖 content script 注入、权限、资源声明、MAIN world 注入策略。
- `rules.json` / declarativeNetRequest 规则相关文件
  - 文件内未直接读取，但 `REDIRECT_M3U8`、Header 规则等功能可能与 background/rules 配合；具体实现不在本文件中。

### 4.2 外部依赖 (External Dependencies)
该文件未通过包管理器导入第三方库，但依赖浏览器/Chrome 扩展原生 API 和 Web API：

- `chrome.runtime`
- `chrome.storage.local`
- `chrome.runtime.connect`
- `chrome.runtime.sendMessage`
- `chrome.runtime.onMessage`
- `chrome.runtime.getURL`
- `window.postMessage`
- `window.addEventListener`
- `document`
- `Shadow DOM`
- `fetch`
- `Blob`
- `URL.createObjectURL`
- `FileReader`
- `navigator.clipboard`
- `crypto.subtle`
- `TextEncoder`
- `TextDecoder`
- `URL`
- `URLSearchParams`
- `CanvasRenderingContext2D`
- `setTimeout` / `setInterval`

此外，文件内部构造了一个兼容 `window.Prism` 部分接口的轻量语法高亮对象 `PhantomHL`，并未依赖真正的 Prism.js 外部库。

## 5. 暴露的接口/API (Exposed Interfaces/APIs)
本文件没有使用 ES Module `export`。但作为 content script，它通过全局事件、Chrome 消息监听和挂到 `window` 的函数暴露能力。

- **`chrome.runtime.onMessage.addListener(...)`**: 类型: 消息监听器  
  - 接收 background 推送的抓包、密钥、告警、HAR、WebSocket 等事件，是扩展后台到页面 UI 的主要入口。

- **`window.addEventListener('message', ...)`**: 类型: 消息监听器  
  - 接收 `page-script.js` 在页面 MAIN world 中发出的底层 Hook 事件，如加密调用、函数追踪、Storage、Cookie、媒体链路等。

- **`window.showBreakpointModal`**: 类型: 函数  
  - 在 `initEvents()` 内赋值到 `window`，用于展示请求断点弹窗。
  - 注意：外层消息监听中直接调用了 `showBreakpointModal(data.details)`，依赖其成为全局可见函数；在浏览器非严格模式下，`window.showBreakpointModal` 通常可作为全局变量访问。

- **`window.__phantom_retry_item__` / `window.__phantom_retry__`**: 类型: 全局变量/函数  
  - 用于响应体等待 UI 中的“立即重试”按钮。
  - 通过内联 `onclick` 调用。

- **`window.Prism`**: 类型: 对象  
  - 文件中注入轻量 Prism 兼容对象，暴露 `highlight`、`highlightJSON`、`highlightJS`、`highlightElement`、`highlightAll`、`languages` 等方法。
  - 用于本文件内代码高亮，也可能影响页面全局 `window.Prism`。

- **快捷键接口 `Ctrl + \``**: 类型: DOM 键盘事件  
  - 通过 `document.addEventListener('keydown', ...)` 暴露打开/关闭面板的快捷键。

- **页面通信协议**
  - 对外发送多种 `window.postMessage` 消息给 `page-script.js`，实际构成页面脚本可消费的 API：
    - `UPDATE_MOCK_RULES`
    - `UPDATE_DYNAMIC_SCRIPT`
    - `UPDATE_LOCAL_FILE_RULES`
    - `TOGGLE_BREAKPOINT`
    - `ABORT_REQUEST`
    - `RESUME_REQUEST`
    - `REPLAY_REQUEST`
    - `DUMP_STORAGE`
    - `UPDATE_WS_RULES`
    - `TRACE_FUNCTION`
    - `WS_FRAME_RESUME`
    - `WS_FRAME_ABORT`

## 6. 关键算法/逻辑流分析 (Key Algorithm/Logic Flow Analysis)
### 6.1 整体运行流程
1. 文件加载后首先尝试通过 `Object.defineProperty(navigator, 'webdriver', ...)` 隐藏 webdriver 标记。
2. 初始化大量全局状态变量。
3. 从 `chrome.storage.local` 读取持久化配置：
   - Mock 规则
   - 动态脚本
   - AI 配置
   - 本地文件替换规则
   - CSS 注入规则
   - 收藏 ID
   - POST 缓存
   - 全流量缓存
4. 注册两类核心消息监听：
   - `chrome.runtime.onMessage`: 处理来自 background 的高层事件。
   - `window.addEventListener('message')`: 处理来自页面 MAIN world 的底层 Hook 事件。
5. 用户通过快捷键或扩展按钮触发 `TOGGLE_PANEL`，调用 `toggleDashboard()`。
6. 若首次打开，`createDashboardUI()` 创建 Shadow DOM 面板并调用 `initEvents()`、`bindTrafficEvents()`、`bindVideoChainEvents()`。
7. 后续所有抓包、Hook、审计、链路追踪事件持续进入对应 store，并在面板打开时实时刷新 UI。

### 6.2 抓包日志处理流程
1. background 发送 `SYNC_LOG`。
2. `chrome.runtime.onMessage` 中：
   - 若面板打开，调用 `processLog(msg.data)` 渲染到抓包列表。
   - 若请求状态非 Pending，调用 `saveToPostCache(msg.data)`。
   - 无论 Pending 与否，调用 `saveToTrafficCache(msg.data)`。
   - 若资源类型是媒体/图片/脚本/CSS/HTML 等，则写入 `mediaSniffCache`。
   - 调用 `updateScriptRegistry(msg.data)` 统计脚本。
3. `processLog()`：
   - 写入 `logsMap`。
   - 如果 DOM 已存在则更新状态和耗时。
   - 否则创建一条 `.log-item`，绑定收藏、Diff、重放、复制、查看等按钮。
4. 用户点击请求后调用 `showLogContent()`：
   - 若请求失败/取消，展示请求信息。
   - 若已有 `content`，直接渲染。
   - 否则发送 `FETCH_BODY` 给 background 拉取响应体。
   - 根据空响应、错误、base64、JSON、M3U8、图片等情况分别渲染。

### 6.3 POST 缓存与全流量缓存逻辑
- **POST 缓存库**
  1. `saveToPostCache()` 根据请求 ID 去重。
  2. 请求完成后异步获取响应体。
  3. 将前 100 条存入 `chrome.storage.local`。
  4. `renderPostCache()` 支持 Method 多选、状态码段、响应体有无、最小耗时、关键字范围过滤。
  5. 详情页可在请求体、响应体、Headers 间切换。

- **全流量缓存**
  1. `saveToTrafficCache()` 保存所有请求，包括 Pending。
  2. 对同 ID 请求做合并更新。
  3. 使用 500ms 节流写 storage。
  4. `renderTrafficView()` 支持 Method 过滤和关键词搜索。
  5. `showTrafficDetail()` 解析 URL 参数、Body 参数、Headers，并支持复制 JSON 和生成 cURL。

### 6.4 请求断点流程
1. 页面脚本检测到请求暂停后发送 `REQUEST_PAUSED_INTERNAL`。
2. content script 调用 `showBreakpointModal(data.details)`。
3. 弹窗展示 URL、Headers、Body 和 AI 建议 Tab。
4. 用户可以：
   - 修改 URL。
   - 修改 Query 参数并同步回 URL。
   - 修改 Headers JSON。
   - 修改 Body。
   - 请求 AI 生成攻击/测试建议。
5. 点击放行时发送：
   - `window.postMessage({ type: 'RESUME_REQUEST', requestId, modifiedData })`
6. 点击丢弃时发送：
   - `window.postMessage({ type: 'ABORT_REQUEST', requestId })`

### 6.5 WebSocket 拦截流程
1. 用户在 WS 拦截面板添加规则，调用 `syncWsRules()`。
2. 规则通过 `window.postMessage({ type: 'UPDATE_WS_RULES', rules })` 发给 page-script。
3. page-script 报告帧事件：
   - `WS_HOOK_SENT`
   - `WS_HOOK_RECV`
   - `WS_HOOK_MODIFIED`
4. UI 中根据方向展示帧。
5. 若启用 WS 断点并命中关键词，显示“放行”和“丢弃”按钮：
   - 放行发送 `WS_FRAME_RESUME`
   - 丢弃发送 `WS_FRAME_ABORT`

### 6.6 密钥库和加密审计流程
1. background 或 page-script 发现密钥/敏感字段/加密事件：
   - `KEY_FOUND`
   - `SENSITIVE_FIELD_FOUND`
   - `CRYPTO_REPORT`
   - `DECRYPT_FOUND`
   - `PARAM_CRYPTO_FOUND`
   - `SIGN_FIELD_FOUND`
2. 调用 `addToKeyVault()` 入库。
3. `addToKeyVault()` 对 `type + value` 去重，重复则增加计数和更新时间。
4. UI 提供：
   - 分类过滤。
   - 复制。
   - 标记/置顶。
   - 删除。
   - 标签。
   - 导出 JSON。
5. 加密/解密事件还会转发给 background 的链路追踪：
   - `CHAIN_PUSH_EVENT`

### 6.7 参数来源追踪流程
1. page-script 报告 `PARAM_TRACE`。
2. content script 转发给 background：
   - `PARAM_TRACE_EVENT`
3. background 分析后回推：
   - `PARAM_ANALYZED`
4. `renderParamAnalysis()` 渲染：
   - 参数名/值。
   - 判定结果：
     - 来自接口响应。
     - 来自其他请求。
     - JS 动态计算。
   - 来源 URL。
   - 调用栈。
5. 同时将参数来源事件推送给链路追踪窗口。

### 6.8 视频链路逆向流程
1. 通过抓包日志登记 JS 文件到 `scriptRegistry`。
2. 对带 `frames` 的事件调用 `attributeEventToScript()`：
   - 加密调用。
   - 函数追踪。
   - 解密。
   - 参数追踪。
   - 签名字段。
   - 音频/文字/图片/密钥事件等。
3. 将事件归属到第一帧脚本文件，增加加密、解密、网络、签名计数。
4. `renderVideoChain()` 从 background 获取链路状态：
   - 视频链路 chains。
   - 短窗口事件。
   - 会话事件。
5. UI 展示：
   - 发现的视频 URL。
   - 解析事件时间线。
   - JS 文件清单。
   - 调用栈帧源码跳转。
6. `showSourceAt()` 可向 background 请求脚本源码，并定位到具体行列。

### 6.9 AI 分析流程
1. 用户配置 API Host、API Key、模型。
2. AI 调用统一通过 `sendAIMessage()`。
3. 主要 AI 使用场景：
   - 源码解释。
   - 深度反汇编/去混淆。
   - 生成 TypeScript 类型。
   - 生成 Mock 数据。
   - 生成接口文档。
   - 请求构造器代码生成。
   - AI Fuzz。
   - 断点请求攻击/测试建议。
   - 签名逆向分析。
   - 动态 Hook 脚本生成。
4. `sendAIMessage()` 通过 port 保活 Service Worker，再发消息给 background，由 background 实际调用远程 AI API。

### 6.10 内置轻量语法高亮逻辑
1. `createDashboardUI()` 检查 `window.__phantom_prism_loaded__`。
2. 若未加载，则注入 token CSS。
3. 构建 `PhantomHL` 对象并赋值给 `window.Prism`。
4. 支持简化 JSON 与 JavaScript 高亮。
5. 后续渲染响应体、源码、请求详情时调用 `window.Prism.highlight()`。

### 6.11 潜在风险与注意点
- **XSS/HTML 注入风险:** 文件大量使用 `innerHTML` 拼接动态数据。部分位置使用 `escHtml()`，但并非所有字段都严格转义，例如某些 `data.*`、`item.url`、`rule.responseBody`、`preview` 等场景可能存在注入风险，尤其是在抓包内容来自不可信网页响应时。
- **全局污染风险:** 文件写入 `window.Prism`、`window.showBreakpointModal`、`window.__phantom_retry__` 等全局属性，可能与页面自身脚本冲突。
- **敏感信息持久化风险:** `postCacheStore`、`trafficCacheStore`、AI Key、密钥库等会保存到 `chrome.storage.local` 或内存中，包含 Cookie、Authorization、密钥、响应体等敏感数据。
- **AI 数据外传风险:** 源码、请求内容、密钥、签名上下文等可能通过 AI 功能发送到外部 API Host。
- **内存与性能压力:** 单文件包含大量 DOM 拼接和全量重渲染逻辑；抓包、函数追踪、视频链路、全流量缓存同时开启时可能造成性能下降。
- **事件重复绑定风险:** 部分函数如 `bindPreHookEvents()` 内使用 `setInterval(refreshStatus, 5000)`，若多次绑定可能产生多个定时器；代码中没有明显的去重保护。
- **Shadow DOM 隔离有限:** 虽使用 Shadow DOM 隔离 UI，但仍向 `document.head` 注入高亮样式，并向 `window` 写入对象，仍会影响页面全局。
- **安全边界复杂:** 同时使用 content script isolated world、MAIN world page-script、background debugger/CDP 能力，消息来源校验主要依赖 `__phantom_origin` 约定，若页面可伪造消息，需谨慎验证。
- **部分函数定义顺序与作用域依赖:** 如 `showBreakpointModal` 在 `initEvents()` 中赋给 `window`，但外部监听直接调用标识符；这依赖浏览器全局属性解析行为，不是最稳健写法。
- **代码可维护性风险:** 文件体积极大，UI、状态、通信、业务逻辑高度耦合，缺少模块边界和类型约束。

## 7. 标签/关键词 (Tags/Keywords)
- `Chrome扩展`
- `Content Script`
- `网络抓包`
- `WebSocket拦截`
- `Shadow DOM面板`
- `加密审计`
- `参数溯源`
- `视频链路逆向`

---


### 📄 `page-script.js`

# 代码文件分析报告: `F:\neural-phantom-4.7\page-script.js`

## 1. 文件元数据 (File Metadata)
- **文件路径:** `F:\neural-phantom-4.7\page-script.js`
- **语言类型:** JavaScript
- **代码行数:** 大致 1150 行

## 2. 核心功能摘要 (Core Functionality Summary)
该文件是浏览器扩展注入到网页上下文中的核心 Hook 脚本，用于劫持和监控页面内的网络请求、加密/解密调用、Storage、WebSocket、音频、文本、图片、WebCrypto 密钥操作等行为。它通过重写原生 API 并使用 `window.postMessage` 与扩展注入层通信，实现请求断点、响应改写、Mock、本地文件替换、参数追踪、链路追踪和敏感数据审计等功能。

## 3. 主要结构与组件 (Main Structures & Components)

### 3.1 函数/方法 (Functions/Methods)
- **`generateId`**: 生成唯一请求 ID。
  - **输入参数:** 无。
  - **返回值:** 字符串，由当前时间戳和随机字符串拼接而成。
  - **关键逻辑:** 使用 `Date.now().toString(36)` 和 `Math.random().toString(36).substr(2, 5)` 生成短 ID，用于断点请求标识。

- **`makeNative(mockFunc, originalFunc)`**: 对被 Hook 的函数进行“原生函数伪装”。
  - **输入参数:**
    - `mockFunc`: 替换后的函数。
    - `originalFunc`: 原始函数。
  - **返回值:** `Proxy` 包装后的函数。
  - **关键逻辑:** 使用 `Proxy` 拦截 `apply`、`construct` 和 `get`，并重写 `toString`，使 Hook 后函数的 `toString()` 返回原始函数字符串，从而降低被网页反调试检测发现的概率。

- **`parsePhantomStack(stackStr, depth)`**: 解析调用栈，提取结构化栈帧。
  - **输入参数:**
    - `stackStr`: 调用栈字符串。
    - `depth`: 跳过的栈深度。
  - **返回值:** 栈帧数组，每项包含 `fn`、`file`、`line`、`col`。
  - **关键逻辑:** 使用 `_PHANTOM_STACK_RE` 匹配 `file:line:col`，过滤 `page-script.js`、`inject.js`、扩展协议 URL，并最多返回 6 个有效栈帧。

- **`reportCrypto(algo, plaintext, keyInfo, extra, traceDepth)`**: 上报加密/哈希/签名操作。
  - **输入参数:**
    - `algo`: 算法名称。
    - `plaintext`: 明文或输入数据。
    - `keyInfo`: 密钥信息。
    - `extra`: 附加信息。
    - `traceDepth`: 调用栈截取深度。
  - **返回值:** 无。
  - **关键逻辑:** 捕获当前调用栈，调用 `parsePhantomStack` 解析栈帧，并通过 `window.postMessage` 发送 `CRYPTO_REPORT` 消息。

- **`hookCryptoJS`**: Hook `CryptoJS` 的加密、哈希和 HMAC 方法。
  - **输入参数:** 无。
  - **返回值:** 无。
  - **关键逻辑:** 检测 `window.CryptoJS` 是否存在，Hook `CryptoJS.AES.encrypt`、`HmacSHA1`、`HmacSHA256`、`HmacSHA512`、`HmacMD5`、`MD5`、`SHA1`、`SHA256`、`SHA512`，并调用 `reportCrypto` 上报参数。

- **`hookWebCrypto`**: Hook 原生 WebCrypto API 的部分方法。
  - **输入参数:** 无。
  - **返回值:** 无。
  - **关键逻辑:** Hook `crypto.subtle.sign`、`encrypt`、`digest`，在 Promise resolve 后上报算法、输入长度、IV、签名数据摘要、哈希结果等信息。

- **`sniffSignatureFields(text)`**: 嗅探 URL 或文本中的签名类字段。
  - **输入参数:** `text` 字符串。
  - **返回值:** 无。
  - **关键逻辑:** 使用 `SIG_PATTERNS` 匹配 `sign`、`signature`、`nonce`、`timestamp`、`access_token` 等字段，通过 `SIGN_FIELD_FOUND` 消息上报。

- **`replayRequest(url, method, body)`**: 重放请求。
  - **输入参数:**
    - `url`: 请求地址。
    - `method`: 请求方法。
    - `body`: 请求体。
  - **返回值:** 无。
  - **关键逻辑:** 使用 `window.fetch` 重新发起请求，并将响应文本打印到控制台。

- **`waitForBreakpoint(url, method, body, type)`**: 请求断点挂起逻辑。
  - **输入参数:**
    - `url`: 请求 URL。
    - `method`: HTTP 方法。
    - `body`: 请求体。
    - `type`: 请求类型，例如 `fetch` 或 `xhr`。
  - **返回值:** `Promise` 或 `null`。
  - **关键逻辑:** 如果断点开启且 URL 命中过滤条件，则生成 `requestId`，发送 `REQUEST_PAUSED_INTERNAL` 消息，并返回一个 Promise，将 resolver 保存到 `_breakpointResolvers`，等待外部恢复或中止。

- **`hookStorage(storageObj, storageName)`**: Hook `localStorage` 或 `sessionStorage`。
  - **输入参数:**
    - `storageObj`: Storage 对象。
    - `storageName`: Storage 名称。
  - **返回值:** 无。
  - **关键逻辑:** 重写 `setItem`、`removeItem`、`clear`，上报 `STORAGE_EVENT`，包括新增、修改、删除、清空操作。

- **`hookedFetch(...args)`**: 替代原生 `window.fetch` 的核心 Hook 函数。
  - **输入参数:** 与原生 `fetch` 一致，支持 `RequestInfo` 和 `RequestInit`。
  - **返回值:** `Promise<Response>`。
  - **关键逻辑:**
    1. 解析 URL、method、body。
    2. 优先匹配静态 Mock 规则。
    3. 匹配本地文件替换规则。
    4. 嗅探签名字段。
    5. 追踪 URL/body/header 参数来源。
    6. 检测参数中的 Base64、JWT、Hex 等加密/编码特征。
    7. 根据断点配置挂起请求。
    8. 调用原始 `fetch`。
    9. 如果存在动态响应处理脚本，则读取文本响应并允许脚本修改响应内容。

- **`hookedOpen(method, url)`**: 替代 `XMLHttpRequest.prototype.open`。
  - **输入参数:** 与原生 XHR `open` 基本一致。
  - **返回值:** 原始 `open` 的返回值。
  - **关键逻辑:** 记录 `_requestUrl` 和 `_method`，并根据 `_replaceMap` 执行 M3U8 或其他 URL 重定向映射。

- **`hookedSend(body)`**: 替代 `XMLHttpRequest.prototype.send`。
  - **输入参数:** 请求体。
  - **返回值:** 原始 `send` 的返回值或无返回。
  - **关键逻辑:**
    1. 匹配静态 Mock 规则，直接伪造 XHR 响应。
    2. 匹配本地文件替换规则，直接伪造响应。
    3. 上报 URL、body、header 参数。
    4. 执行加密参数检测。
    5. 若开启断点，则异步等待恢复后再发送。
    6. 若存在动态脚本，则调用 `setupXhrHook` 修改响应。

- **`setupXhrHook(xhr)`**: 为 XHR 注入响应修改逻辑。
  - **输入参数:** XHR 实例。
  - **返回值:** 无。
  - **关键逻辑:** 包装 `onreadystatechange` 和 `onload`，在 `readyState === 4` 时读取 `responseText`，调用 `_dynamicHandler` 修改响应，并通过 `Object.defineProperty` 覆盖只读响应属性。

- **`HookedWebSocket.constructor(url, protocols)`**: 自定义 WebSocket 构造逻辑。
  - **输入参数:**
    - `url`: WebSocket 地址。
    - `protocols`: 协议参数。
  - **返回值:** WebSocket 实例。
  - **关键逻辑:** 继承原生 `WebSocket`，生成 `_wsId`，上报连接创建，监听接收消息并根据 `_wsModifyRules` 尝试改写 JSON 消息。

- **`HookedWebSocket.send(data)`**: Hook WebSocket 发送帧。
  - **输入参数:** `data`，WebSocket 发送数据。
  - **返回值:** 无。
  - **关键逻辑:** 上报发送帧；若处于暂停状态则缓存帧；否则根据 `_wsModifyRules` 改写 JSON 字符串帧后调用 `super.send`。

- **`HookedWebSocket._resumeFrames(modifiedData)`**: 放行暂停的 WebSocket 帧。
  - **输入参数:** `modifiedData`，可选修改后的帧数据。
  - **返回值:** 无。
  - **关键逻辑:** 将 `_pendingFrames` 中缓存的数据逐个发送，若传入 `modifiedData` 则统一替换发送内容。

- **`hookAudio`**: 音频链路追踪模块的立即执行函数。
  - **输入参数:** 无。
  - **返回值:** 无。
  - **关键逻辑:** Hook `AudioContext.decodeAudioData`、`createMediaElementSource`、`createMediaStreamSource`、`navigator.mediaDevices.getUserMedia` 和 `MediaRecorder`，上报音频解码、媒体流、录制器状态、录制数据块等事件。

- **`hookText`**: 文本链路追踪模块的立即执行函数。
  - **输入参数:** 无。
  - **返回值:** 无。
  - **关键逻辑:** Hook Clipboard API、`document.execCommand`、监听 `selectionchange`、使用 `MutationObserver` 监控动态插入的敏感文本节点，并上报 `TEXT_TRACK`。

- **`hookImage`**: 图片链路追踪模块的立即执行函数。
  - **输入参数:** 无。
  - **返回值:** 无。
  - **关键逻辑:** Hook Canvas 的 `toDataURL`、`toBlob`、`getImageData`、`drawImage`，Hook `URL.createObjectURL` 和 `HTMLImageElement.prototype.src`，上报图片生成、像素读取、绘制、Blob URL 创建、图片加载等事件。

- **`hookCryptoKeys`**: WebCrypto 密钥追踪模块的立即执行函数。
  - **输入参数:** 无。
  - **返回值:** 无。
  - **关键逻辑:** Hook `crypto.subtle.importKey`、`deriveKey`、`deriveBits`、`generateKey`、`exportKey`、`unwrapKey`，上报密钥导入、派生、生成、导出、解包等操作。

### 3.2 类/结构体 (Classes/Structs)
- **`HookedWebSocket`**: 继承原生 WebSocket 的 Hook 类，用于 WebSocket 连接、发送帧、接收帧、帧改写和断点管理。
    - **主要属性:**
        - `_wsUrl` - WebSocket 连接 URL。
        - `_wsId` - 当前 WebSocket 实例 ID。
        - `_paused` - 是否暂停发送帧。
        - `_pendingFrames` - 暂停期间缓存的待发送帧。
    - **核心方法:**
        - `constructor` - 初始化 WebSocket 实例并注册接收消息监听。
        - `send` - 上报并可改写发送帧。
        - `_resumeFrames` - 恢复发送暂停帧。

- **`ParamTracer`**: 普通对象形式的参数来源追踪组件。
    - **主要属性:** 无固定数据属性。
    - **核心方法:**
        - `getStack` - 获取过滤后的调用栈字符串。
        - `extractUrlParams` - 从 URL 提取查询参数。
        - `extractBodyParams` - 从 JSON 或 URL encoded body 提取参数。
        - `report` - 过滤无关参数并通过 `PARAM_TRACE` 上报。

- **`FunctionTracer`**: 普通对象形式的函数调用追踪引擎。
    - **主要属性:**
        - `_hooks` - 已 Hook 函数记录表。
    - **核心方法:**
        - `getStack` - 获取调用栈数组。
        - `getFrames` - 获取结构化栈帧。
        - `safeStr` - 安全序列化任意值。
        - `traceMethod` - Hook 指定对象路径上的方法。
        - `traceGlobal` - 根据关键词批量 Hook `window` 上的函数。
        - `autoHookCrypto` - 自动 Hook 常见解密函数、WebCrypto 解密、`atob`。

- **`ParamCryptoDetector`**: 普通对象形式的请求参数加密/编码检测组件。
    - **主要属性:**
        - `patterns` - 检测规则数组，包括 JWT、Base64、Hex、URL 编码、疑似 AES Base64 等。
    - **核心方法:**
        - `tryDecode` - 尝试 Base64、URLDecode、JWT payload、Hex 文本解码。
        - `detect` - 对单个参数值执行模式匹配和解码尝试。
        - `scanUrl` - 扫描 URL 查询参数。
        - `scanBody` - 扫描 JSON 或 URL encoded 请求体。

### 3.3 接口/Traits (Interfaces/Traits)
- 本文件未定义 TypeScript 接口或类似 Trait 的结构。
- 但该脚本通过 `window.postMessage` 隐式定义了一组消息协议，用于与 `inject.js` 或扩展侧通信，包括：
  - `CRYPTO_REPORT`
  - `SIGN_FIELD_FOUND`
  - `PARAM_TRACE`
  - `FUNC_TRACE`
  - `DECRYPT_FOUND`
  - `PARAM_CRYPTO_FOUND`
  - `TRACE_FUNCTION`
  - `TRACE_FUNCTION_RESULT`
  - `UPDATE_MOCK_RULES`
  - `UPDATE_LOCAL_FILE_RULES`
  - `UPDATE_DYNAMIC_SCRIPT`
  - `TOGGLE_BREAKPOINT`
  - `RESUME_REQUEST`
  - `ABORT_REQUEST`
  - `ADD_REDIRECT_RULE`
  - `REPLAY_REQUEST`
  - `STORAGE_EVENT`
  - `STORAGE_DUMP_RESULT`
  - `WS_HOOK_CREATED`
  - `WS_HOOK_SENT`
  - `WS_HOOK_RECV`
  - `WS_HOOK_MODIFIED`
  - `WS_FRAME_PAUSED`
  - `WS_FRAME_RESUME`
  - `WS_FRAME_ABORT`
  - `AUDIO_TRACK`
  - `TEXT_TRACK`
  - `IMAGE_TRACK`
  - `DECRYPT_KEY_TRACK`

### 3.4 常量/枚举 (Constants/Enums)
- **`_PHANTOM_STACK_RE`**: 用于匹配调用栈中 URL、行号、列号的正则表达式。
- **`SIG_PATTERNS`**: 签名字段检测规则数组，用于匹配 URL 参数或 JSON 字符串中的 `sign`、`signature`、`nonce`、`timestamp`、`access_token` 等字段。
- **`_replaceMap`**: URL 替换映射表，用于将原始 URL 映射为清洗后的 URL。
- **`_mockRules`**: 静态 Mock 规则数组。
- **`_localFileRules`**: 本地文件替换规则数组。
- **`_breakpointResolvers`**: 请求断点挂起 Promise 的 resolver 映射表。
- **`_wsModifyRules`**: WebSocket 改写规则数组。
- **`ParamCryptoDetector.patterns`**: 参数加密/编码检测模式集合。
- **`_SENSITIVE_TEXT_RE`**: 敏感文本检测正则，用于匹配 token、api key、secret、password、authorization、bearer 等关键词。

## 4. 依赖关系 (Dependencies)

### 4.1 内部依赖 (Internal Dependencies)
该文件没有使用 `import` 或 `require` 显式导入内部模块，但从消息协议和注释可以看出它依赖项目中其他注入/后台脚本与其通信：
- `inject.js`
- `background.js`
- `console.js`
- `chain.js`

其中，`inject.js` 很可能负责将该脚本注入页面上下文，并转发 `window.postMessage` 消息到扩展环境；但具体实现不在当前文件中，不能进一步确认。

### 4.2 外部依赖 (External Dependencies)
该文件未通过包管理器导入第三方库，但运行时依赖浏览器和网页环境中的 API 或全局对象：
- `window`
- `document`
- `fetch`
- `XMLHttpRequest`
- `WebSocket`
- `CryptoJS`，如果目标页面加载了该库则会被 Hook
- `window.crypto.subtle`
- `localStorage`
- `sessionStorage`
- `indexedDB`
- `AudioContext`
- `webkitAudioContext`
- `MediaRecorder`
- `navigator.mediaDevices.getUserMedia`
- `navigator.clipboard`
- `MutationObserver`
- `HTMLCanvasElement`
- `CanvasRenderingContext2D`
- `HTMLImageElement`
- `URL.createObjectURL`
- `Blob`
- `File`
- `TextDecoder`
- `Response`
- `Headers`
- `performance`

## 5. 暴露的接口/API (Exposed Interfaces/APIs)
该文件没有使用 ES Module 的 `export`，但会修改全局对象并暴露或影响以下接口：

- **`window.fetch`**: 类型: 函数，替换为 Hook 后的 Fetch，用于 Mock、断点、参数追踪、响应改写、签名嗅探、加密参数检测。
- **`XMLHttpRequest.prototype.open`**: 类型: 函数，替换为 Hook 后的 XHR open，用于记录 URL/method 和执行 URL 替换。
- **`XMLHttpRequest.prototype.send`**: 类型: 函数，替换为 Hook 后的 XHR send，用于 Mock、断点、参数追踪、响应改写。
- **`XMLHttpRequest.prototype.setRequestHeader`**: 类型: 函数，替换后用于捕获请求头。
- **`window.WebSocket`**: 类型: 类/构造器，通过 Proxy 替换，用于 WebSocket 实例注册、收发帧追踪、改写和断点。
- **`window.__phantom_ws_instances`**: 类型: 对象，WebSocket 实例注册表，用于根据 `wsId` 恢复或丢弃暂停帧。
- **`window._origAtobPhantom`**: 类型: 函数，保存原始 `atob`，供内部 Base64 解码避免递归触发 Hook。
- **`window.atob`**: 类型: 函数，被 Hook 后用于监控较长 Base64 解码行为。
- **`localStorage.setItem/removeItem/clear`**: 类型: 函数，被 Hook 后用于 Storage 审计。
- **`sessionStorage.setItem/removeItem/clear`**: 类型: 函数，被 Hook 后用于 Storage 审计。
- **`window.indexedDB.open`**: 类型: 函数，被 Hook 后用于监听 IndexedDB 写操作。
- **`crypto.subtle.sign/encrypt/digest/decrypt/importKey/deriveKey/deriveBits/generateKey/exportKey/unwrapKey`**: 类型: 函数，被 Hook 后用于加密、解密和密钥审计。
- **`AudioContext.prototype.decodeAudioData`**: 类型: 函数，被 Hook 后用于音频解码追踪。
- **`AudioContext.prototype.createMediaElementSource`**: 类型: 函数，被 Hook 后用于媒体元素音频链路追踪。
- **`AudioContext.prototype.createMediaStreamSource`**: 类型: 函数，被 Hook 后用于媒体流音频链路追踪。
- **`navigator.mediaDevices.getUserMedia`**: 类型: 函数，被 Hook 后用于捕获麦克风/摄像头请求和授权结果。
- **`window.MediaRecorder`**: 类型: 类/构造器，通过 Proxy 替换，用于录音/录像创建和数据块追踪。
- **`navigator.clipboard.writeText/write/readText`**: 类型: 函数，被 Hook 后用于剪贴板读写追踪。
- **`document.execCommand`**: 类型: 函数，被 Hook 后用于旧版 copy/cut/paste 操作追踪。
- **`HTMLCanvasElement.prototype.toDataURL/toBlob`**: 类型: 函数，被 Hook 后用于 Canvas 图像导出追踪。
- **`CanvasRenderingContext2D.prototype.getImageData/drawImage`**: 类型: 函数，被 Hook 后用于像素读取和绘制链路追踪。
- **`URL.createObjectURL`**: 类型: 函数，被 Hook 后用于 Blob/File URL 创建追踪。
- **`HTMLImageElement.prototype.src`**: 类型: 属性访问器，被重定义后用于图片加载追踪。
- **`window.postMessage` 消息协议**: 类型: 通信 API，用于向扩展侧上报审计事件，并接收控制指令。

## 6. 关键算法/逻辑流分析 (Key Algorithm/Logic Flow Analysis)

### 6.1 整体执行流程
1. 文件通过最外层 IIFE 执行，避免大部分变量直接暴露到全局作用域。
2. 初始化内部状态变量，包括 Mock 规则、本地文件规则、断点状态、动态响应处理器、WebSocket 改写规则等。
3. 定义原生伪装函数 `makeNative`，后续大部分 Hook 函数会经过该函数包装。
4. 定义栈帧解析函数，用于为各种审计事件提供源代码位置。
5. 安装 CryptoJS、WebCrypto、函数追踪、参数追踪、参数加密检测等 Hook。
6. 监听来自扩展注入层的 `window.message` 指令，动态更新规则或执行断点恢复、请求重放等操作。
7. 重写网络相关 API：`fetch`、XHR、WebSocket。
8. 安装 Storage、IndexedDB、音频、文本、图片、WebCrypto 密钥等多类审计 Hook。
9. 所有模块通过 `window.postMessage` 向外发送事件，由扩展侧进一步展示或处理。

### 6.2 Fetch Hook 流程
1. 获取请求 URL、method、body。
2. 检查 `_mockRules`，命中则直接返回新的 `Response`。
3. 检查 `_localFileRules`，命中则返回本地文件内容构造的 `Response`。
4. 对 URL 和 body 执行签名字段嗅探。
5. 使用 `ParamTracer` 提取并上报 URL/body 参数。
6. 使用 `ParamCryptoDetector` 扫描参数中的 JWT、Base64、Hex、URL 编码等疑似加密/编码内容。
7. 从 headers 中筛选 `auth/token/sign/key/secret/x-` 等敏感头并上报。
8. 调用 `waitForBreakpoint` 判断是否需要暂停请求。
9. 如果断点恢复数据要求中止，则返回状态为 `0` 的伪造响应。
10. 如果断点恢复数据包含修改后的 URL、body、headers，则应用修改。
11. 调用原始 `fetch`。
12. 如果存在 `_dynamicHandler`，且响应为 JSON 或文本并小于 2MB，则读取响应体，调用动态脚本修改响应。
13. 返回原始或修改后的响应。

### 6.3 XHR Hook 流程
1. `open` 阶段保存请求 URL 和 method。
2. 如果 URL 命中 `_replaceMap`，替换请求 URL。
3. `send` 阶段检查 Mock 规则，命中则通过 `Object.defineProperty` 伪造 `responseText`、`response`、`status`、`readyState`，并异步触发回调。
4. 检查本地文件替换规则，逻辑同 Mock。
5. 提取并上报 URL/body/header 参数。
6. 检测参数中疑似加密或编码字段。
7. 如果断点开启，则等待 `waitForBreakpoint` 恢复后再调用原始 `send`。
8. 如果启用动态响应脚本，则通过 `setupXhrHook` 在响应完成后修改 `responseText` 和 `response`。
9. 调用原始 `send`。

### 6.4 请求断点机制
1. 外部通过 `TOGGLE_BREAKPOINT` 消息更新 `_breakpointEnabled` 和 `_breakpointFilter`。
2. Fetch 或 XHR 请求发出前调用 `waitForBreakpoint`。
3. 如果未开启断点或 URL 未命中过滤条件，直接放行。
4. 命中后生成 `requestId` 并发送 `REQUEST_PAUSED_INTERNAL`。
5. 当前请求等待 Promise resolve。
6. 外部发送 `RESUME_REQUEST` 时，通过 `_breakpointResolvers[requestId]` 恢复请求，并可携带修改后的请求数据。
7. 外部发送 `ABORT_REQUEST` 时，resolver 收到 `{ aborted: true }`，Fetch 返回伪造错误响应，XHR 当前逻辑会继续发送但可修改 body；这里 Fetch 与 XHR 的中止处理并不完全一致。

### 6.5 加密审计逻辑
1. 周期性调用 `hookCryptoJS`、`hookWebCrypto`、`FunctionTracer.autoHookCrypto`，防止页面后加载加密库导致漏 Hook。
2. 对 CryptoJS：
   - Hook AES 加密。
   - Hook HMAC。
   - Hook常见哈希函数。
   - Hook 解密函数并尝试以 UTF-8 输出明文。
3. 对 WebCrypto：
   - Hook `sign`、`encrypt`、`digest`、`decrypt`。
   - 对输入、输出、算法、IV、CryptoKey 类型等进行摘要上报。
4. 对密钥操作：
   - Hook `importKey`、`deriveKey`、`deriveBits`、`generateKey`、`exportKey`、`unwrapKey`。
   - 上报密钥格式、用途、是否可导出、派生参数、导出材料预览等。
5. 对 `atob`：
   - 仅在输入字符串长度大于 20 时上报 Base64 解码行为。
   - 使用 `_atobBusy` 防止递归。

### 6.6 参数加密/编码检测逻辑
1. 对 URL 查询参数和请求体参数进行扫描。
2. 使用正则识别：
   - JWT
   - Base64
   - MD5/SHA1/SHA256 长度的 Hex
   - 长 Hex
   - URL 编码
   - 疑似 AES Base64
3. 对命中的参数尝试：
   - Base64 解码。
   - URLDecode。
   - JWT payload 解析。
   - Hex 转文本。
4. 通过 `PARAM_CRYPTO_FOUND` 上报检测结果、解码结果、URL、method 和调用栈帧。

### 6.7 WebSocket Hook 流程
1. 保存原始 `window.WebSocket` 为 `_NativeWebSocket`。
2. 定义继承原生 WebSocket 的 `HookedWebSocket`。
3. 使用 `Proxy` 替换 `window.WebSocket` 构造器。
4. 创建实例时生成 `wsId`，注册到 `window.__phantom_ws_instances`。
5. `send` 时上报发送数据，并根据 `_wsModifyRules` 改写 JSON 字符串帧。
6. 接收消息时上报数据，并尝试根据规则改写 `MessageEvent.data`。
7. 通过 `WS_FRAME_RESUME` 或 `WS_FRAME_ABORT` 控制暂停帧恢复或丢弃。

### 6.8 Storage 和 IndexedDB 审计逻辑
1. 对 `localStorage` 和 `sessionStorage` 的 `setItem`、`removeItem`、`clear` 重写。
2. 每次写入、删除、清空都发送 `STORAGE_EVENT`。
3. 监听 `DUMP_STORAGE` 消息时枚举 localStorage/sessionStorage 全量数据并返回。
4. 对 `indexedDB.open` 重写。
5. 数据库打开成功后重写 `db.transaction`。
6. 当 transaction mode 为 `readwrite` 时，尝试 Hook object store 的 `put` 和 `delete`。
7. 对 IndexedDB 写入和删除发送 `STORAGE_EVENT`。

### 6.9 音频、文本、图片链路追踪
- **音频链路:**
  - 跟踪音频解码、媒体元素接入 AudioGraph、媒体流接入 AudioGraph、麦克风/摄像头授权、MediaRecorder 录制生命周期和数据块。
- **文本链路:**
  - 跟踪剪贴板读写、旧版复制剪切粘贴命令、用户选中文本、动态插入 DOM 的敏感文本。
- **图片链路:**
  - 跟踪 Canvas 导出、Blob 生成、像素读取、图片绘制、对象 URL 创建和图片 src 赋值。

### 6.10 潜在风险与注意点
- **强侵入性:** 文件大量重写浏览器原生 API，可能影响目标网页正常行为。
- **兼容性风险:** 某些原生属性可能不可写或不可配置，不同浏览器环境可能导致 Hook 失败。
- **安全与隐私风险:** 会采集密钥、Token、剪贴板、Storage、音视频、Canvas、WebCrypto 导出材料等高度敏感信息。
- **性能风险:** 多个 Hook、MutationObserver、周期性轮询、响应体 clone/text、参数扫描可能对复杂页面产生性能影响。
- **响应体处理风险:** Fetch 和 XHR 对 2MB 以下文本响应进行动态处理，但仍可能改变页面业务逻辑。
- **WebSocket 接收改写可靠性有限:** 在 `addEventListener('message', ...)` 的监听器中修改 `event.data` 不一定能影响其他监听器已接收到的事件顺序或行为。
- **XHR 断点中止逻辑不完整:** `ABORT_REQUEST` 返回 `{ aborted: true }`，Fetch 有明确处理，但 XHR 分支只修改 body 后继续发送，没有像 Fetch 一样直接伪造中止响应。
- **原生伪装不完全:** `makeNative` 改写 `toString`，但仍可能被更高级的反篡改检测发现，例如属性描述符、函数长度、名称、调用栈、Realm 差异等。
- **重复 Hook 风险:** 多处使用 `_phantomHooked`、`_isHooked` 标记防止重复 Hook，但不是所有 Hook 都通过 `makeNative` 或严格保护，复杂页面中仍可能发生冲突。

## 7. 标签/关键词 (Tags/Keywords)
- `浏览器扩展注入脚本`
- `API Hook`
- `Fetch/XHR 拦截`
- `WebSocket 改写`
- `加密审计`
- `请求断点`
- `参数追踪`
- `Storage 审计`
- `音频文本图片链路追踪`
- `WebCrypto 密钥监控`

---


---

## ✅ 分析完成

**总计分析文件数:** 5
**完成时间:** 2026/5/3 22:54:56

---
*本报告由 ProjectAnalyst 插件自动生成*
