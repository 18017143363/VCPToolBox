# 项目分析报告: Neural-Phantom使用claude开发

**分析ID:** Neural-Phantom使用claude开发-2026-05-03.22.37  
**分析时间:** 2026/5/3 22:37:16  
**项目路径:** F:\pac-master\Neural-Phantom使用claude开发

---

## 📋 项目简介

**核心功能:** 这是一个浏览器扩展项目，核心功能是通过后台脚本、页面注入脚本和规则配置对网页环境进行干预或增强。

**关键实现:**
*   `manifest.json`: 定义浏览器扩展的权限、入口脚本、资源配置和运行方式，是项目启动与集成浏览器的核心配置。
*   `background.js`: 承担扩展后台逻辑，通常负责事件监听、状态管理、规则调度或与页面脚本通信。
*   `inject.js` / `page-script.js`: 负责将功能逻辑注入到目标网页上下文中，是实现网页环境修改或功能增强的关键执行层。

---

## 📁 文件结构树

```
├── background.js
├── dashboard.css
├── icon.png
├── icons/
│   └── icon48.png
├── inject.js
├── manifest.json [配置文件]
├── Neural-Phantom-使用文档.md
├── page-script.js
└── rules.json [配置文件]

```

---

## 📝 文件详细分析


### 📄 `background.js`

# 代码文件分析报告: `F:\pac-master\Neural-Phantom使用claude开发\background.js`

## 1. 文件元数据 (File Metadata)
- **文件路径:** `F:\pac-master\Neural-Phantom使用claude开发\background.js`
- **语言类型:** JavaScript
- **代码行数:** 约 970 行

## 2. 核心功能摘要 (Core Functionality Summary)
该文件是 Chrome 扩展 **Neural Phantom 4.1** 的后台脚本，承担全局流量抓包、响应体缓存、WebSocket 监听、HAR 录制/回放、安全扫描、参数追踪、AI 分析调用、动态 Header 修改等核心职责。它通过 `chrome.debugger`、`chrome.runtime`、`chrome.tabs`、`chrome.storage`、`chrome.declarativeNetRequest` 等 Chrome 扩展 API，在后台统一管理网络请求日志并向前端面板和注入脚本提供数据与控制能力。

## 3. 主要结构与组件 (Main Structures & Components)

### 3.1 函数/方法 (Functions/Methods)
- **`ParamSourceAnalyzer.searchInResponses(value)`**:  
  在已捕获的响应 URL、响应体缓存、响应头中搜索指定参数值。  
  - **输入参数:** `value`，待搜索的字符串值。
  - **返回值:** 匹配结果数组，每项包含来源类型、URL、时间、请求 ID、预览内容等。
  - **关键逻辑:** 遍历 `globalLogs`，结合 `contentCache` 获取响应体；若响应体为 Base64 编码则尝试 `atob` 解码；在 URL、Body、Headers 中做字符串包含匹配。

- **`ParamSourceAnalyzer.analyze(paramKey, paramValue)`**:  
  分析单个请求参数的来源。  
  - **输入参数:** `paramKey` 参数名，`paramValue` 参数值。
  - **返回值:** 参数来源分析对象或 `null`。
  - **关键逻辑:**  
    1. 在响应体/响应头/URL 中查找该参数值。  
    2. 在历史参数追踪 `paramTraceStore` 中查找是否来自其他请求参数。  
    3. 根据匹配结果给出 `FROM_RESPONSE`、`FROM_REQUEST`、`JS_COMPUTED` 三类判断。

- **`ParamSourceAnalyzer.analyzeTrace(trace)`**:  
  批量分析一次请求中的所有参数。  
  - **输入参数:** `trace`，参数追踪事件对象。
  - **返回值:** 参数分析结果数组。
  - **关键逻辑:** 遍历 `trace.params`，对每个键值调用 `analyze`。

- **`KeyHunter.scan(text)`**:  
  扫描文本中的 API Key、Token、JWT、私钥等敏感密钥。  
  - **输入参数:** `text`，待扫描文本。
  - **返回值:** 发现的密钥类型与命中值数组。
  - **关键逻辑:** 使用多组正则表达式匹配 OpenAI、Anthropic、Google、AWS、GitHub、Stripe、JWT、PEM 私钥、微信 AppSecret 等。对 AWS Secret、WeChat AppSecret 做上下文限制以降低误报。

- **`KeyHunter.scanFields(text)`**:  
  检测 JSON 文本中的敏感字段。  
  - **输入参数:** `text`，JSON 字符串。
  - **返回值:** 敏感字段发现数组。
  - **关键逻辑:** 尝试 `JSON.parse` 后递归遍历对象字段，匹配 `password`、`token`、`api_key`、`authorization`、`cookie`、`ssn`、`credit_card` 等敏感字段名，并返回字段路径和值预览。

- **`TracerEngine.findValueSource(targetValue, logs)`**:  
  在流量日志和响应体缓存中查找某个值的来源。  
  - **输入参数:** `targetValue` 目标值，`logs` 日志列表。
  - **返回值:** 来源结果数组。
  - **关键逻辑:** 检查日志内容、缓存响应体和请求 URL 是否包含目标值。

- **`TracerEngine.getPreview(content, target)`**:  
  生成目标值在文本中的上下文预览。  
  - **输入参数:** `content` 文本内容，`target` 目标字符串。
  - **返回值:** 目标附近约前后 40 字符的预览字符串。
  - **关键逻辑:** 使用 `indexOf` 定位目标值，并截取上下文，首尾必要时添加省略号。

- **`fetchAndCacheBody(debuggee, requestId, meta)`**:  
  在 `Network.loadingFinished` 后抓取响应体并写入缓存。  
  - **输入参数:**  
    - `debuggee`：Chrome debugger 目标对象。
    - `requestId`：网络请求 ID。
    - `meta`：请求元信息，包括 `tabId`、`type`、`url`、`isGraphQL` 等。
  - **返回值:** 无显式返回。
  - **关键逻辑:**  
    1. 对媒体流等二进制类型进行跳过。  
    2. 调用 `chrome.debugger.sendCommand(..., 'Network.getResponseBody')` 获取响应体。  
    3. 支持失败重试与延迟 fallback。  
    4. 将响应体存入 `contentCache`，限制最大缓存数量。  
    5. 处理 Base64、gzip/zstd 等压缩/二进制情况。  
    6. 统一调用内部 `handleBodyText` 进行密钥扫描、敏感字段扫描、GraphQL 分析、M3U8 净化、HAR 录制、Schema 检测、告警检测。

- **`handleBodyText(bodyText, base64Encoded)`**:  
  `fetchAndCacheBody` 内部定义的响应体统一处理函数。  
  - **输入参数:** `bodyText` 响应正文文本，`base64Encoded` 是否 Base64 编码。
  - **返回值:** 无显式返回。
  - **关键逻辑:** 执行响应体缓存、密钥扫描、敏感字段扫描、GraphQL 操作名提取、M3U8 广告净化、通知前端 BODY_READY、HAR 录制、Schema 变更检测、条件告警检测。

- **`buildHAR(entries)`**:  
  构建标准 HAR 1.2 数据结构。  
  - **输入参数:** `entries`，录制的请求条目。
  - **返回值:** HAR JSON 对象。
  - **关键逻辑:** 将内部日志格式转换为 HAR `log.entries`，包括请求方法、URL、Headers、QueryString、PostData、响应状态、响应内容和耗时等。

- **`parseQueryString(url)`**:  
  解析 URL 查询参数为 HAR 格式。  
  - **输入参数:** `url`。
  - **返回值:** `{ name, value }` 数组。
  - **关键逻辑:** 使用 `new URL(url)` 和 `searchParams.entries()` 提取查询参数；解析失败时返回空数组。

- **`mimeFromType(type)`**:  
  将内部资源类型映射为 MIME 类型。  
  - **输入参数:** `type`，如 `XHR`、`SCRIPT`、`CSS`、`IMAGE`、`MEDIA-M3U8`。
  - **返回值:** MIME 字符串。
  - **关键逻辑:** 使用固定映射表，不存在时返回 `text/plain`。

- **`parseHAREntries(harText)`**:  
  解析 HAR 文本并提取请求条目。  
  - **输入参数:** `harText`，HAR JSON 字符串。
  - **返回值:** 请求条目数组。
  - **关键逻辑:** `JSON.parse` 后读取 `har.log.entries`，转换为内部回放所需结构。

- **`replayHAR(entries, tabId)`**:  
  按顺序回放 HAR 请求。  
  - **输入参数:** `entries` 请求条目，`tabId` 目标标签页 ID。
  - **返回值:** Promise，无显式业务返回。
  - **关键逻辑:** 使用 `setTimeout` 每 50ms 向目标标签页发送 `HAR_REPLAY_REQUEST` 消息，实际请求执行依赖内容脚本处理。

- **`extractSchema(obj, depth = 0)`**:  
  从 JSON 对象中提取结构 Schema。  
  - **输入参数:** `obj` 任意 JSON 值，`depth` 递归深度。
  - **返回值:** Schema 描述对象、数组、类型字符串或 `'...'`。
  - **关键逻辑:** 限制最大递归深度为 5；数组只分析第一个元素；对象递归提取字段类型。

- **`diffSchema(oldS, newS, path = '')`**:  
  比较两个 Schema 的差异。  
  - **输入参数:** 旧 Schema、新 Schema、当前路径。
  - **返回值:** 变更数组。
  - **关键逻辑:** 检测字段新增、删除、类型变化，并递归比较对象字段。

- **`checkAlertRules(log)`**:  
  检查单条日志是否命中条件告警规则。  
  - **输入参数:** `log` 日志对象。
  - **返回值:** 无显式返回。
  - **关键逻辑:** 支持 `STATUS`、`DURATION`、`URL_CONTAINS`、`BODY_CONTAINS` 四类规则；命中后发送 `ALERT_HIT` 消息并尝试创建桌面通知。

- **`recordTrafficBucket(log)`**:  
  记录实时流量统计桶。  
  - **输入参数:** `log` 日志对象。
  - **返回值:** 无显式返回。
  - **关键逻辑:** 按秒聚合请求数量、错误数量和平均耗时；最多保留最近 120 个时间桶。

- **`SecurityHeaders.scan(logs)`**:  
  扫描响应安全头缺失与泄露头。  
  - **输入参数:** `logs` 日志数组。
  - **返回值:** 安全头扫描结果数组。
  - **关键逻辑:** 对非图片/CSS 响应检查 CSP、HSTS、X-Content-Type-Options、X-Frame-Options、Referrer-Policy 等头是否缺失，同时检测 `server`、`x-powered-by` 等泄露头。

- **`VulnScanner.scan(logs)`**:  
  基于正则扫描响应体和响应头中的常见安全风险。  
  - **输入参数:** `logs` 日志数组。
  - **返回值:** 漏洞发现数组。
  - **关键逻辑:** 检测 SQL 错误、堆栈跟踪、版本泄露、内网 IP、调试信息、路径泄露、邮箱、CORS 通配符等。

- **`EndpointExtractor.extract(logs)`**:  
  从 JavaScript/XHR 响应内容中提取潜在 API 端点。  
  - **输入参数:** `logs` 日志数组。
  - **返回值:** 端点列表。
  - **关键逻辑:** 对脚本和 XHR 内容使用多组正则匹配 `/api/`、`/v1/`、完整 URL、`fetch()`、`axios`、REST 方法调用等端点模式，最多返回 500 个。

- **`ParamMiner.mine(logs)`**:  
  从请求 URL、POST Body、请求头中挖掘参数。  
  - **输入参数:** `logs` 日志数组。
  - **返回值:** 参数统计列表。
  - **关键逻辑:**  
    1. 提取 URL query 参数。  
    2. 解析 JSON Body 或 `URLSearchParams` 表单参数。  
    3. 提取敏感/关键请求头，如 `authorization`、`cookie`、`x-api-key`。  
    4. 按出现次数排序，最多返回 500 项。

- **`cleanM3u8(content)`**:  
  净化 M3U8 播放列表中的广告切片。  
  - **输入参数:** `content`，M3U8 文本。
  - **返回值:** `{ cleaned, hasAds }`。
  - **关键逻辑:** 基于用户过滤规则、广告关键字、低于 1 秒的 `#EXTINF` 切片判断广告，并从播放列表中剔除。

- **`updateLogs(entry)`**:  
  更新全局网络日志并向前端同步。  
  - **输入参数:** `entry`，日志增量对象。
  - **返回值:** 无显式返回。
  - **关键逻辑:** 根据 `entry.id` 判断新增或合并更新；计算请求耗时；维护最大日志数量；发送 `SYNC_LOG` 消息；完成状态时记录流量统计。

- **`updateHeaderRules(headers)`**:  
  动态更新浏览器请求 Header 修改规则。  
  - **输入参数:** `headers`，键值形式的 Header 配置。
  - **返回值:** Promise。
  - **关键逻辑:** 先移除所有旧动态规则，再基于传入 Header 生成 `declarativeNetRequest` 规则，作用于主框架、子框架、XHR、媒体、脚本等资源类型。

- **`callOpenAI(content, apiKey, promptType, model, apiHost)`**:  
  调用 OpenAI 兼容接口完成 AI 分析、代码生成、Fuzz、反混淆等任务。  
  - **输入参数:**  
    - `content`：待分析内容。
    - `apiKey`：API Key。
    - `promptType`：任务类型。
    - `model`：模型名称。
    - `apiHost`：API 主机。
  - **返回值:** AI 返回的文本内容。
  - **关键逻辑:** 根据 `promptType` 构造不同系统提示词，截断输入至 20000 字符，调用 `${host}/v1/chat/completions`，返回 `data.choices[0].message.content`。

### 3.2 类/结构体 (Classes/Structs)
本文件未使用 JavaScript `class` 语法定义类，但定义了多个对象字面量形式的功能组件。

- **`ParamSourceAnalyzer`**: 参数来源交叉匹配引擎。
  - **主要属性:** 无固定数据属性，依赖外部 `globalLogs`、`contentCache`、`paramTraceStore`。
  - **核心方法:**  
    - `searchInResponses`：在响应 URL、Body、Header 中搜索值。  
    - `analyze`：判断参数值来源。  
    - `analyzeTrace`：批量分析参数追踪事件。

- **`KeyHunter`**: 密钥与敏感字段扫描器。
  - **主要属性:**  
    - `patterns` - 密钥类型到正则表达式的映射。  
    - `sensitiveFields` - 敏感 JSON 字段名列表。
  - **核心方法:**  
    - `scan` - 扫描密钥。  
    - `scanFields` - 扫描 JSON 敏感字段。

- **`TracerEngine`**: 全流量内容检索组件。
  - **主要属性:** 无独立状态。
  - **核心方法:**  
    - `findValueSource` - 搜索目标值来源。  
    - `getPreview` - 生成上下文预览。

- **`SecurityHeaders`**: 安全响应头检测组件。
  - **主要属性:**  
    - `required` - 推荐存在的安全头列表。  
    - `leaky` - 可能泄露服务器信息的响应头列表。
  - **核心方法:**  
    - `scan` - 对日志进行安全头扫描。

- **`VulnScanner`**: 简单漏洞/信息泄露扫描器。
  - **主要属性:**  
    - `patterns` - 漏洞类型正则规则。
  - **核心方法:**  
    - `scan` - 对响应头和响应体执行正则匹配。

- **`EndpointExtractor`**: 端点提取器。
  - **主要属性:**  
    - `patterns` - API 路径和请求调用模式正则。
  - **核心方法:**  
    - `extract` - 从脚本和 XHR 响应中提取端点。

- **`ParamMiner`**: 参数挖掘器。
  - **主要属性:** 无固定属性。
  - **核心方法:**  
    - `mine` - 从 URL、Body、Header 中统计参数。

### 3.3 接口/Traits (Interfaces/Traits)
本文件为 JavaScript 文件，不存在 TypeScript 接口或 Rust Trait 定义。

但它通过 Chrome 扩展消息机制隐式定义了大量消息接口：

- **`FETCH_COOKIES`**: 获取当前页面 Cookie。
- **`GET_LOGS`**: 获取全局请求日志。
- **`PARAM_TRACE_EVENT`**: 接收参数追踪事件。
- **`ANALYZE_PARAM_SOURCE`**: 查询单个参数值来源。
- **`GET_PARAM_TRACES`**: 获取参数追踪记录。
- **`CLEAR_LOGS`**: 清空日志和缓存。
- **`HAR_START` / `HAR_STOP` / `HAR_EXPORT` / `HAR_IMPORT` / `HAR_REPLAY`**: HAR 录制、导入、导出和回放。
- **`SEARCH_TRACER`**: 全流量内容搜索。
- **`FETCH_BODY`**: 获取某个请求的响应体。
- **`UPDATE_HEADER_RULES`**: 更新动态 Header 伪造规则。
- **`TOGGLE_STAR` / `GET_STARRED`**: 收藏请求管理。
- **`GET_WS_LOGS`**: 获取 WebSocket 日志。
- **`GET_PERF_STATS`**: 获取性能统计。
- **`GET_TRAFFIC_TIMELINE`**: 获取 Dashboard 流量统计。
- **`GET_SCHEMA_SNAPSHOTS` / `DELETE_SCHEMA_SNAPSHOT` / `FORCE_SNAPSHOT`**: Schema 快照管理。
- **`GET_ALERT_RULES` / `SAVE_ALERT_RULES`**: 条件告警规则管理。
- **`EXPORT_CONFIG` / `IMPORT_CONFIG`**: 配置导入导出。
- **`AI_FUZZ` / `ANALYZE_WITH_AI` / `GET_AI_MODELS` / `CHECK_AI_BALANCE`**: AI 相关操作。
- **`SCAN_SECURITY_HEADERS` / `EXTRACT_ENDPOINTS` / `SCAN_VULNS` / `MINE_PARAMS`**: 安全扫描与挖掘功能。

### 3.4 常量/枚举 (Constants/Enums)
- **`globalLogs`**: 全局请求日志数组，用于保存捕获到的网络请求和响应元数据。
- **`paramTraceStore`**: 参数追踪事件存储数组。
- **`MAX_PARAM_TRACES`**: 参数追踪最大数量，值为 `1000`。
- **`userFilters`**: 用户自定义过滤规则，主要用于 M3U8 广告净化。
- **`contentCache`**: 响应体缓存，`Map` 类型，键为 `requestId`。
- **`MAX_CACHE_SIZE`**: 日志和响应体缓存上限，值为 `500`。
- **`pendingDebuggees`**: 等待响应体读取的请求映射，键为 `requestId`。
- **`harRecording`**: HAR 是否正在录制的布尔标志。
- **`harSession`**: HAR 录制期间保存的完整请求条目。
- **`harStartTime`**: HAR 录制开始时间。
- **`attachedTabs`**: 已附加 debugger 的标签页 ID 集合。
- **`wsLogs`**: WebSocket 日志数组。
- **`MAX_WS_LOGS`**: WebSocket 日志最大数量，值为 `200`。
- **`starredIds`**: 被收藏请求 ID 的集合。
- **`schemaSnapshots`**: Schema 快照映射，键为归一化 URL。
- **`alertRules`**: 条件告警规则数组。
- **`trafficTimeline`**: Dashboard 实时流量时间线。
- **`_bucketTs` / `_bucketCount` / `_bucketErrors` / `_bucketMs`**: 当前秒级流量统计桶状态。
- **资源类型字符串:**  
  - `SCRIPT`
  - `XHR`
  - `IMAGE`
  - `CSS`
  - `MEDIA-M3U8`
  - `MEDIA`
  - `OTHER`
- **参数来源判定字符串:**  
  - `FROM_RESPONSE`
  - `FROM_REQUEST`
  - `JS_COMPUTED`

## 4. 依赖关系 (Dependencies)

### 4.1 内部依赖 (Internal Dependencies)
该文件没有通过 `import` 或 `require` 显式导入项目内其他模块，但通过 Chrome 扩展消息与其他文件存在运行时协作关系：

- `inject.js`
  - 通过 `PARAM_TRACE_EVENT` 向后台发送参数追踪事件。
  - 注释中提到加密拦截侧的 `CRYPTO_REPORT` 依赖于注入脚本，但当前文件未实现对应处理逻辑。
- `page-script.js`
  - 未直接引用，但从项目结构看可能与页面级 Hook、请求拦截、HAR 回放等消息协作有关；本文件中无法确认具体实现。
- `dashboard.css`
  - 无代码层依赖。
- `manifest.json`
  - 该文件依赖 Manifest 中配置的权限，例如 `debugger`、`storage`、`tabs`、`cookies`、`declarativeNetRequest`、`notifications` 等；具体权限需查看 `manifest.json` 才能确认。
- `icons/icon48.png`
  - 用于桌面通知图标。
- `rules.json`
  - 当前文件未直接读取该配置文件。

### 4.2 外部依赖 (External Dependencies)
本文件未使用 npm 包或第三方 JavaScript 库，但大量依赖浏览器/Chrome 扩展平台 API：

- `chrome.runtime`
- `chrome.storage.local`
- `chrome.debugger`
- `chrome.tabs`
- `chrome.action`
- `chrome.cookies`
- `chrome.declarativeNetRequest`
- `chrome.notifications`
- `fetch`
- `URL`
- `URLSearchParams`
- `Map`
- `Set`
- `atob`
- `btoa`

此外，AI 功能依赖 OpenAI 兼容 HTTP API：

- `https://api.openai.com/v1/chat/completions`
- `https://api.openai.com/v1/models`
- `https://api.openai.com/v1/dashboard/billing/subscription`

实际 API Host 可通过 `apiHost` 参数替换为兼容服务端。

## 5. 暴露的接口/API (Exposed Interfaces/APIs)
该文件没有 ES Module `export`，但作为 Chrome 扩展 background 脚本，通过事件监听和消息动作暴露接口。

- **`chrome.debugger.onEvent` 监听器**:  
  类型: 事件处理器。  
  用途: 捕获 Chrome DevTools Protocol 网络事件，包括请求、响应、加载完成、失败、WebSocket 创建/帧/关闭等。

- **`chrome.runtime.onMessage` 监听器**:  
  类型: 消息路由 API。  
  用途: 为面板、内容脚本、注入脚本提供后台能力入口。

- **`chrome.runtime.onConnect` 监听器**:  
  类型: 长连接接口。  
  用途: 接收名为 `phantom-keepalive` 的连接，用于防止长请求期间 Service Worker 休眠。

- **`chrome.action.onClicked` 监听器**:  
  类型: 扩展图标点击接口。  
  用途: 点击扩展图标后向当前页面发送 `TOGGLE_PANEL`，控制面板显示/隐藏。

- **`chrome.tabs.onUpdated` 监听器**:  
  类型: 标签页生命周期接口。  
  用途: 页面加载时自动附加 debugger 并开启网络抓包和 iframe 自动附加。

- **`chrome.tabs.onRemoved` 监听器**:  
  类型: 标签页移除接口。  
  用途: 清理 `attachedTabs` 中已关闭标签页。

- **`fetchAndCacheBody`**:  
  类型: 函数。  
  用途: 内部响应体抓取与缓存入口，不通过模块导出，但被 debugger 事件流程调用。

- **`buildHAR`**:  
  类型: 函数。  
  用途: 构造 HAR 导出数据。

- **`parseHAREntries`**:  
  类型: 函数。  
  用途: HAR 导入解析。

- **`replayHAR`**:  
  类型: 函数。  
  用途: HAR 请求回放调度。

- **`cleanM3u8`**:  
  类型: 函数。  
  用途: M3U8 广告切片过滤。

- **`updateLogs`**:  
  类型: 函数。  
  用途: 全局日志更新与同步。

- **`updateHeaderRules`**:  
  类型: 函数。  
  用途: 动态 Header 修改规则更新。

- **`callOpenAI`**:  
  类型: 函数。  
  用途: OpenAI 兼容模型调用。

## 6. 关键算法/逻辑流分析 (Key Algorithm/Logic Flow Analysis)

### 6.1 网络抓包主流程
1. `chrome.tabs.onUpdated` 在 HTTP/HTTPS 页面开始加载时触发。
2. 后台调用 `chrome.debugger.attach({ tabId }, '1.3')` 附加调试器。
3. 附加成功后：
   - 将 `tabId` 加入 `attachedTabs`。
   - 调用 `Network.enable` 开启网络事件。
   - 调用 `Network.enableWebSocketFrames` 尝试开启 WebSocket 帧。
   - 调用 `Target.setAutoAttach` 支持 iframe/子目标自动附加。
4. `chrome.debugger.onEvent` 接收 DevTools Protocol 网络事件：
   - `Network.requestWillBeSent`: 记录请求 URL、方法、POST 数据、请求头、开始时间。
   - `Network.responseReceived`: 记录响应状态、MIME、响应头、资源类型，并把读取响应体所需元信息放入 `pendingDebuggees`。
   - `Network.loadingFinished`: 响应体可读取后调用 `fetchAndCacheBody`。
   - `Network.loadingFailed`: 标记请求失败，并写入失败说明到 `contentCache`。

### 6.2 响应体读取与缓存流程
1. `Network.responseReceived` 阶段只记录元数据，不直接读取响应体。
2. `Network.loadingFinished` 后从 `pendingDebuggees` 获取请求元信息。
3. 调用 `fetchAndCacheBody`：
   - 跳过 `MEDIA` 等不适合缓存的大型二进制资源。
   - 首先调用 `Network.getResponseBody`，最多尝试 3 次。
   - 若失败，进入延迟 fallback，按 300ms、800ms、2000ms 重试。
   - 若仍失败，向 `contentCache` 写入“响应体不可用”的说明文本。
4. 成功获取后：
   - 写入 `contentCache`。
   - 如超过 `MAX_CACHE_SIZE`，删除最早缓存项。
   - 如果 `base64Encoded`，尝试 `atob` 解码。
   - 对 gzip/zstd 等压缩内容写入特殊说明。
5. 进入 `handleBodyText` 后续处理。

### 6.3 自动审计流程
响应体就绪后执行多类自动审计：

1. **密钥扫描**
   - 调用 `KeyHunter.scan(bodyText)`。
   - 命中后发送 `KEY_FOUND` 消息。

2. **敏感字段扫描**
   - 仅对 `type === 'XHR'` 处理。
   - 调用 `KeyHunter.scanFields(bodyText)`。
   - 命中后发送 `SENSITIVE_FIELD_FOUND`。

3. **GraphQL 操作名提取**
   - 若 `isGraphQL` 为真，尝试解析 JSON。
   - 如果存在 `data` 字段，取 `Object.keys(gqlData.data)[0]` 作为操作名。
   - 通过 `updateLogs` 更新 `gqlOperation`。

4. **Schema 变更检测**
   - 仅对 XHR JSON 响应处理。
   - 调用 `extractSchema` 生成新 Schema。
   - 使用去除 query/hash、数字 ID 泛化后的 URL 作为 key。
   - 若已有快照，调用 `diffSchema` 比较并在变化时发送 `SCHEMA_CHANGED`。
   - 若无快照，则保存初始快照。

5. **条件告警**
   - 查找对应 `globalLogs` 条目。
   - 写入 `content`。
   - 调用 `checkAlertRules` 检查规则并触发通知。

### 6.4 参数来源分析流程
1. 内容脚本或注入脚本发送 `PARAM_TRACE_EVENT`。
2. 后台将 `trace` 插入 `paramTraceStore` 头部，并控制最大数量为 `MAX_PARAM_TRACES`。
3. 调用 `ParamSourceAnalyzer.analyzeTrace(trace)`：
   - 对每个参数调用 `analyze`。
   - 先在历史响应 URL、响应体、响应头中查找参数值。
   - 再在其他请求参数中查找相同值。
   - 若响应命中，判定 `FROM_RESPONSE`。
   - 若其他请求参数命中，判定 `FROM_REQUEST`。
   - 否则判定为 `JS_COMPUTED`。
4. 分析结果通过 `PARAM_ANALYZED` 消息推送给面板。

### 6.5 HAR 录制、导出、导入与回放
1. 收到 `HAR_START`：
   - 设置 `harRecording = true`。
   - 清空 `harSession`。
   - 记录 `harStartTime`。
2. 响应体就绪时：
   - 若正在录制，则将对应 `globalLogs` 条目和 `content` 加入 `harSession`。
3. 收到 `HAR_STOP`：
   - 停止录制并返回条目数。
4. 收到 `HAR_EXPORT`：
   - 调用 `buildHAR(harSession)` 生成 HAR 1.2 格式对象。
5. 收到 `HAR_IMPORT`：
   - 调用 `parseHAREntries` 解析 HAR 文本。
6. 收到 `HAR_REPLAY`：
   - 调用 `replayHAR`，按 50ms 间隔向目标 tab 发送 `HAR_REPLAY_REQUEST`。

### 6.6 M3U8 广告净化流程
1. 当响应类型为 `MEDIA-M3U8` 时，调用 `cleanM3u8(bodyText)`。
2. 净化逻辑包括：
   - 用户自定义字符串过滤规则。
   - 内置广告关键字，如 `ad-system`、`google_ad`、`doubleclick`。
   - 判断低于 1 秒的 `#EXTINF` 片段为疑似广告。
3. 若发现广告：
   - 将净化后的 M3U8 内容转为 Base64 data URL。
   - 向当前 tab 发送 `REDIRECT_M3U8` 消息，请求页面侧替换原始播放列表。

### 6.7 WebSocket 监听流程
1. `Network.webSocketCreated`:
   - 新增 WebSocket 日志条目到 `wsLogs`。
   - 发送 `WS_EVENT` 创建事件。
2. `Network.webSocketFrameSent`:
   - 找到对应 WebSocket 条目。
   - 记录发送帧，方向为 `SENT`。
   - 发送 `WS_FRAME` 消息。
3. `Network.webSocketFrameReceived`:
   - 记录接收帧，方向为 `RECV`。
   - 发送 `WS_FRAME` 消息。
4. `Network.webSocketClosed`:
   - 发送关闭事件。

### 6.8 动态 Header 伪造流程
1. 面板发送 `UPDATE_HEADER_RULES`，携带 Header 键值。
2. `updateHeaderRules` 读取现有动态规则。
3. 删除所有旧规则。
4. 若传入 Header 为空，仅清理规则后返回。
5. 若不为空：
   - 为每个 Header 创建 `modifyHeaders` 规则。
   - 资源类型覆盖 `main_frame`、`sub_frame`、`xmlhttprequest`、`media`、`script`、`other`。
6. 调用 `chrome.declarativeNetRequest.updateDynamicRules` 更新规则。

### 6.9 AI 功能调用流程
1. 面板发送 `AI_FUZZ` 或 `ANALYZE_WITH_AI`。
2. 后台调用 `callOpenAI`。
3. 根据 `promptType` 构造不同任务提示词：
   - `EXPLAIN`：HTTP 响应业务和安全风险解释。
   - `TS_TYPE`：生成 TypeScript 类型。
   - `MOCK_DATA`：生成 Mock 数据。
   - `API_DOC`：生成 API 文档。
   - `DISASSEMBLE`：JS 反混淆和安全审计。
   - `FUZZ`：生成 Fuzz 测试用例。
   - `CODE_GEN`：生成多语言请求代码。
   - `SIGN_REVERSE`：加密签名逆向分析。
   - `BP_AI_SUGGEST`：攻击场景建议。
   - `SCRIPT_GEN`：生成响应拦截脚本。
4. 调用 OpenAI 兼容 Chat Completions API。
5. 将结果或错误通过 `sendResponse` 返回。

### 6.10 潜在风险与实现注意点
- **Debugger 权限敏感:**  
  使用 `chrome.debugger` 可读取大量网络内容，包括 Cookie、Token、响应体等，隐私和权限风险较高。

- **敏感数据驻留内存:**  
  `globalLogs`、`contentCache`、`paramTraceStore`、`wsLogs` 可能保存密钥、Cookie、Token、请求体和响应体。虽然有数量上限，但未见加密或脱敏存储。

- **响应体 Base64 解码可能处理二进制不稳:**  
  对 Base64 响应统一 `atob` 后按字符串处理，遇到非文本二进制可能导致乱码或误判。代码已对部分压缩格式做检测，但覆盖有限。

- **`diffSchema` 对非对象 Schema 的处理存在边界风险:**  
  `diffSchema` 使用 `Object.keys(oldS || {})`，若传入字符串类型 Schema，`Object.keys('string')` 会返回字符串索引键，可能产生非预期差异。实际调用多用于 JSON 对象，但数组或基础类型响应可能触发边界行为。

- **GraphQL 判断可能不准确:**  
  `isGraphQL` 使用 URL 包含 `/graphql`、`/gql` 或响应请求头 content-type 为 JSON 判断。其中 `response.requestHeaders` 是否稳定存在取决于 Chrome Debugger Protocol 返回结构，且 JSON 请求不一定是 GraphQL。

- **安全扫描正则存在误报:**  
  如 AWS Secret、32 位十六进制 WeChat AppSecret、邮箱、路径泄露等规则均可能误报。代码对部分规则做了上下文限制，但仍属启发式扫描。

- **`CHECK_AI_BALANCE` 接口可能不兼容:**  
  `/v1/dashboard/billing/subscription` 是特定 OpenAI 旧式/非通用接口，若使用兼容 API Host 或当前 OpenAI API，可能返回错误。

- **动态 Header 规则会删除所有现有动态规则:**  
  `updateHeaderRules` 通过 `getDynamicRules()` 获取并删除全部动态规则，若同一扩展内其他功能也使用动态规则，可能被清除。

- **多次附加 debugger 的处理较粗:**  
  `tabs.onUpdated` 每次加载都会尝试 `chrome.debugger.attach`，失败被静默忽略；对于已附加、权限不足、特殊页面等情况没有详细状态管理。

- **`chrome.runtime.sendMessage(...).catch()` 依赖 Promise 风格:**  
  在 MV3 中部分 Chrome API 支持 Promise，但兼容性与调用方式可能受运行环境影响；若某些 API 不返回 Promise，`.catch` 可能存在兼容风险。当前代码大量使用此模式。

- **`onMessage` 分支未统一 return:**  
  对同步 `sendResponse` 通常可工作；异步分支多数返回 `true`。但由于大量 `if` 不是 `else if`，理论上一个消息若 action 被重复匹配不太可能，但结构上没有提前终止，维护时需注意。

## 7. 标签/关键词 (Tags/Keywords)
- `Chrome扩展后台脚本`
- `网络抓包`
- `Debugger API`
- `响应体缓存`
- `HAR录制回放`
- `WebSocket监听`
- `安全扫描`
- `参数追踪`
- `AI分析`
- `动态Header修改`

---


### 📄 `inject.js`

# 代码文件分析报告: `F:\pac-master\Neural-Phantom使用claude开发\inject.js`

## 1. 文件元数据 (File Metadata)
- **文件路径:** `F:\pac-master\Neural-Phantom使用claude开发\inject.js`
- **语言类型:** JavaScript
- **代码行数:** 约 2400+ 行

## 2. 核心功能摘要 (Core Functionality Summary)
该文件是 Chrome 扩展 Neural Phantom 的内容脚本核心，负责注入页面级脚本 `page-script.js`、与 `background.js` 和页面环境双向通信，并在网页中构建一个功能完整的 Shadow DOM 调试/审计面板。它集成了网络抓包、请求查看/重放/构造、Mock、动态 Hook、断点拦截、WebSocket 拦截、密钥审计、AI 分析、HAR、Schema、Storage、安全扫描、参数追踪、编解码等大量前端调试与安全测试功能。

## 3. 主要结构与组件 (Main Structures & Components)

### 3.1 函数/方法 (Functions/Methods)
- **`sendAIMessage(msg, callback)`**:  
  用于向扩展后台发送 AI 分析相关消息。  
  - **输入参数:** `msg` 消息对象，`callback` 回调函数。  
  - **返回值:** 无。  
  - **关键逻辑:** 先尝试通过 `chrome.runtime.connect({ name: 'phantom-keepalive' })` 打开长连接，降低 Manifest V3 Service Worker 在等待 AI 响应时休眠的概率；随后调用 `chrome.runtime.sendMessage`，响应后断开 port。

- **`syncRulesToPage()`**:  
  将当前内容脚本中的规则同步给页面环境中的 `page-script.js`。  
  - **输入参数:** 无。  
  - **返回值:** 无。  
  - **关键逻辑:** 使用 `window.postMessage` 发送 `UPDATE_MOCK_RULES`、`UPDATE_DYNAMIC_SCRIPT`、`UPDATE_LOCAL_FILE_RULES` 消息。

- **`toggleDashboard()`**:  
  打开或关闭 Neural Phantom 主控制面板。  
  - **输入参数:** 无。  
  - **返回值:** 无。  
  - **关键逻辑:** 若面板已打开则隐藏；否则创建或显示面板，并从后台拉取历史日志 `GET_LOGS`，同时渲染 Mock、本地替换规则、密钥库和动态脚本内容。

- **`createDashboardUI()`**:  
  创建扩展的主 Dashboard UI。  
  - **输入参数:** 无。  
  - **返回值:** 无。  
  - **关键逻辑:** 创建固定定位的 `panelHost`，通过 `attachShadow({mode: 'open'})` 创建 Shadow DOM，加载 `dashboard.css`，并通过大量 HTML 模板构建抓包、WS、审计、性能、HAR、请求构造器、设置、密钥库、参数追踪等面板。最后调用 `initEvents()` 绑定交互，并为主面板和模态框启用拖拽。

- **`initEvents()`**:  
  绑定 Dashboard 内所有 UI 交互事件。  
  - **输入参数:** 无。  
  - **返回值:** 无。  
  - **关键逻辑:** 这是文件中最大的事件注册函数，负责 Tab 切换、搜索过滤、吸管、Cookie、导出、断点开关、断点弹窗、AI 调用、动态脚本、Mock、Header 覆盖、溯源搜索、AI 设置、HAR、请求构造器、密钥库、参数追踪、告警规则、Schema、Storage、WS 改写、脚本编辑器、配置导入导出、编解码、JWT、安全头扫描、端点提取、漏洞扫描、参数挖掘等所有交互逻辑。

- **`renderBpParams(url)`**:  
  定义在 `initEvents()` 内部，用于解析断点弹窗中的 URL Query 参数。  
  - **输入参数:** `url` 字符串。  
  - **返回值:** 无。  
  - **关键逻辑:** 使用 `new URL(url)` 解析参数并为每个参数生成可编辑输入框，输入改变时调用 `syncParamsToUrl()`。

- **`syncParamsToUrl()`**:  
  定义在 `initEvents()` 内部，用于将断点弹窗中编辑后的 Query 参数同步回完整 URL。  
  - **输入参数:** 无。  
  - **返回值:** 无。  
  - **关键逻辑:** 遍历 `.bp-param-val` 输入框，使用 `URLSearchParams.set()` 修改 URL。

- **`validateScript()`**:  
  定义在 `initEvents()` 内部，用于校验动态 Hook 脚本语法。  
  - **输入参数:** 无。  
  - **返回值:** 无。  
  - **关键逻辑:** 使用 `new Function('url', 'method', 'response', code)` 尝试构造函数，捕获语法异常并显示到脚本编辑器错误栏。

- **`updateLineNumbers()`**:  
  定义在 `initEvents()` 内部，用于更新动态脚本编辑器行号。  
  - **输入参数:** 无。  
  - **返回值:** 无。  
  - **关键逻辑:** 根据 `scriptEditor.value.split('\n').length` 生成对应数量的行号 DOM。

- **`renderStorageKV(tabId, data)`**:  
  定义在 `initEvents()` 内部，用于渲染 localStorage/sessionStorage 键值快照。  
  - **输入参数:** `tabId` 目标容器 ID，`data` 键值对象。  
  - **返回值:** 无。  
  - **关键逻辑:** 遍历 `Object.entries(data)`，尝试 JSON 格式化 value，并提供复制按钮。

- **`renderWsRules()`**:  
  定义在 `initEvents()` 内部，用于渲染 WebSocket 改写规则列表。  
  - **输入参数:** 无。  
  - **返回值:** 无。  
  - **关键逻辑:** 遍历 `wsModifyRules`，渲染启用开关、URL 关键字、方向标签和删除按钮。

- **`syncWsRules()`**:  
  定义在 `initEvents()` 内部，用于同步 WebSocket 改写规则到页面脚本。  
  - **输入参数:** 无。  
  - **返回值:** 无。  
  - **关键逻辑:** 通过 `window.postMessage({ type: 'UPDATE_WS_RULES', rules: wsModifyRules })` 通知 `page-script.js`。

- **`buildParamResultHTML(result)`**:  
  构建参数来源分析结果的 HTML。  
  - **输入参数:** `result` 分析结果对象。  
  - **返回值:** HTML 字符串。  
  - **关键逻辑:** 根据 `verdict` 区分 `FROM_RESPONSE`、`FROM_REQUEST`、`JS_COMPUTED`，展示参数值、来源响应、其他请求引用或 JS 动态计算提示。

- **`renderParamAnalysis(trace, analysis)`**:  
  渲染实时参数追踪分析结果。  
  - **输入参数:** `trace` 参数调用追踪信息，`analysis` 分析结果数组。  
  - **返回值:** 无。  
  - **关键逻辑:** 过滤有价值的分析项，按请求生成卡片，展示参数来源类型、值预览、来源 URL、调用栈，并支持点击详情后向后台请求 `ANALYZE_PARAM_SOURCE`。

- **`addToKeyVault({ type, value, source, category, pinned = false })`**:  
  将密钥、敏感字段或加密参数加入密钥库。  
  - **输入参数:** 对象参数，包含 `type`、`value`、`source`、`category`、`pinned`。  
  - **返回值:** 无。  
  - **关键逻辑:** 忽略过短值；按 `type + value` 去重；重复时增加 `count` 并更新 `lastSeen`；最多保留 500 条。

- **`renderKeyVault()`**:  
  渲染密钥库 UI。  
  - **输入参数:** 无。  
  - **返回值:** 无。  
  - **关键逻辑:** 根据分类过滤，置顶项优先显示，为每条密钥生成复制、标记、删除、标签保存、展开详情等交互。

- **`buildKeyAlertHTML({ type, value, source, category })`**:  
  构建审计面板中的密钥告警 HTML。  
  - **输入参数:** 密钥告警对象。  
  - **返回值:** HTML 字符串。  
  - **关键逻辑:** 根据 category 设置颜色，展示密钥类型、值预览、来源，并包含“入库”和“复制”按钮。

- **`bindKeyAlertEvents(div)`**:  
  绑定密钥告警卡片按钮事件。  
  - **输入参数:** `div` 告警卡片 DOM 元素。  
  - **返回值:** 无。  
  - **关键逻辑:** 为 `.kv-inline-save` 绑定入库逻辑，为 `.kv-inline-copy` 绑定复制逻辑。

- **`renderAlertRules()`**:  
  渲染条件告警规则列表。  
  - **输入参数:** 无。  
  - **返回值:** 无。  
  - **关键逻辑:** 遍历 `localAlertRules`，提供启用/禁用和删除功能，修改后通过 `SAVE_ALERT_RULES` 同步后台。

- **`renderSchemaSnapshots(snapshots)`**:  
  渲染接口 Schema 快照列表。  
  - **输入参数:** `snapshots` 快照数组。  
  - **返回值:** 无。  
  - **关键逻辑:** 每条快照展示 URL、Schema 内容，可展开/收起，也可通过 `DELETE_SCHEMA_SNAPSHOT` 删除后台记录。

- **`showCodeGenModal(codes)`**:  
  展示 AI 生成的多语言请求代码。  
  - **输入参数:** `codes` 语言到代码的映射对象。  
  - **返回值:** 无。  
  - **关键逻辑:** 在源码模态框内创建语言 Tab，切换时更新代码内容。

- **`showFuzzCases(cases)`**:  
  展示 AI 生成的 Fuzz 用例。  
  - **输入参数:** `cases` 用例数组。  
  - **返回值:** 无。  
  - **关键逻辑:** 将用例渲染到请求构造器响应区域，并附加“批量发送”按钮，逐个 `fetch` 发送并统计异常响应。

- **`appendWsFrame(container, dir, frame, requestId)`**:  
  渲染 WebSocket 帧。  
  - **输入参数:** `container` 容器元素，`dir` 方向，`frame` 帧对象，`requestId` 请求 ID。  
  - **返回值:** 无。  
  - **关键逻辑:** 根据发送/接收方向设置背景色，展示时间和值预览，并提供复制按钮；最多保留 100 条。

- **`runDiff(itemA, itemB)`**:  
  对两个请求响应体执行 Diff。  
  - **输入参数:** 两个日志项。  
  - **返回值:** Promise。  
  - **关键逻辑:** 调用 `fetchBody()` 获取响应体，若均为 JSON 则执行结构化深度 Diff；否则回退到文本行级 Diff。

- **`jsonDeepDiff(a, b, path, changes)`**:  
  深度比较两个 JSON 结构。  
  - **输入参数:** `a`、`b` 两个值，`path` 当前路径，`changes` 变更数组。  
  - **返回值:** 无。  
  - **关键逻辑:** 递归比较对象、数组和基本类型，记录新增、删除、值变更、类型变更。

- **`jsonTypeStr(v)`**:  
  返回 JSON 值的类型描述。  
  - **输入参数:** 任意值。  
  - **返回值:** 类型字符串。  
  - **关键逻辑:** 特判 `null`、数组，其余使用 `typeof`。

- **`jsonValStr(v)`**:  
  返回 JSON 值的短字符串展示。  
  - **输入参数:** 任意值。  
  - **返回值:** 字符串。  
  - **关键逻辑:** 对对象执行 `JSON.stringify` 并截断，对基本值转字符串并截断。

- **`renderTextDiff(bodyA, bodyB, container)`**:  
  渲染文本行级 Diff。  
  - **输入参数:** 两段文本和目标容器。  
  - **返回值:** 无。  
  - **关键逻辑:** 按行比较，不同处分别以删除/新增颜色展示。

- **`fetchBody(item)`**:  
  获取请求日志对应的响应体。  
  - **输入参数:** 日志项。  
  - **返回值:** Promise<string>。  
  - **关键逻辑:** 若本地已有 `item.content` 则直接返回，否则向后台发送 `FETCH_BODY`，并处理 base64 解码。

- **`escHtml(s)`**:  
  HTML 转义工具。  
  - **输入参数:** 任意值。  
  - **返回值:** 转义后的字符串。  
  - **关键逻辑:** 替换 `&`、`<`、`>`，用于降低 HTML 注入风险。

- **`renderLocalFileRules()`**:  
  渲染本地文件替换规则列表。  
  - **输入参数:** 无。  
  - **返回值:** 无。  
  - **关键逻辑:** 遍历 `localFileRules`，显示 URL 关键字和文件名，支持删除并同步给页面脚本。

- **`renderMockRules()`**:  
  渲染静态 Mock 规则列表。  
  - **输入参数:** 无。  
  - **返回值:** 无。  
  - **关键逻辑:** 遍历 `mockRules`，显示拦截关键字和响应体预览，支持删除并持久化。

- **`syntaxHighlight(json)`**:  
  对 JSON 内容进行简单语法高亮。  
  - **输入参数:** JSON 对象或 JSON 字符串。  
  - **返回值:** 带 `<span>` 的 HTML 字符串。  
  - **关键逻辑:** 先序列化和 HTML 转义，再用正则标记字符串、数字、布尔值、null 和 key。

- **`renderContentInModal(content, type, isBase64)`**:  
  在源码/响应查看模态框中渲染内容。  
  - **输入参数:** 内容、资源类型、是否 base64。  
  - **返回值:** 无。  
  - **关键逻辑:** 图片以 `data:image/png;base64` 显示；base64 文本尝试解码；JSON 尝试高亮；M3U8 进行行级特殊着色。

- **`makeDraggable(element, handle)`**:  
  使指定元素可拖拽。  
  - **输入参数:** 被拖拽元素和拖拽手柄元素。  
  - **返回值:** 无。  
  - **关键逻辑:** 同时支持鼠标和触摸事件，拖动时更新 `top/left` 并清除 `right/bottom`。

- **`processLog(item)`**:  
  处理并渲染单条网络日志。  
  - **输入参数:** 日志项对象。  
  - **返回值:** 无。  
  - **关键逻辑:** 写入 `logsMap`；若已有 DOM 项则更新状态和耗时；否则创建抓包列表项，绑定收藏、Diff A/B、复制 URL、查看内容、重放请求等操作。

- **`applyFilter()`**:  
  对所有日志项应用过滤条件。  
  - **输入参数:** 无。  
  - **返回值:** 无。  
  - **关键逻辑:** 遍历 `.log-item` 并调用 `applyFilterSingle()`。

- **`applyFilterSingle(item)`**:  
  对单条日志项应用类型、搜索文本和收藏过滤。  
  - **输入参数:** 日志 DOM 元素。  
  - **返回值:** 无。  
  - **关键逻辑:** 根据 `currentTypeFilter`、`currentSearchText`、`showStarredOnly` 决定 `display`。

- **`showLogContent(item, fromBodyReady = false)`**:  
  展示指定请求日志的详细内容。  
  - **输入参数:** 日志项，是否由 `BODY_READY` 触发。  
  - **返回值:** 无。  
  - **关键逻辑:** 打开模态框；处理失败/取消请求、已缓存响应体、等待响应体、后台获取失败、空响应体、成功获取响应体等多种状态；同时展示请求头、请求体、状态码、响应体等。

- **`getCookies()`**:  
  获取当前域 Cookie 并展示。  
  - **输入参数:** 无。  
  - **返回值:** 无。  
  - **关键逻辑:** 向后台发送 `FETCH_COOKIES`，将 Cookie 名和值渲染到模态框。

- **`exportData()`**:  
  导出当前抓包日志。  
  - **输入参数:** 无。  
  - **返回值:** 无。  
  - **关键逻辑:** 将 `logsMap` 转数组并序列化为 JSON，通过 Blob 和临时 `<a>` 下载。

- **`togglePickerMode()`**:  
  开关页面元素吸管模式。  
  - **输入参数:** 无。  
  - **返回值:** 无。  
  - **关键逻辑:** 开启时改变鼠标样式，监听 `mouseover` 和 `click`，隐藏主面板；关闭时恢复样式和面板。

- **`handleHover(e)`**:  
  吸管模式下处理鼠标悬停。  
  - **输入参数:** 鼠标事件。  
  - **返回值:** 无。  
  - **关键逻辑:** 为当前悬停元素添加红色虚线 outline。

- **`handleClick(e)`**:  
  吸管模式下处理元素点击。  
  - **输入参数:** 点击事件。  
  - **返回值:** 无。  
  - **关键逻辑:** 阻止页面默认行为，计算 CSS Selector 和 XPath，展示结果并退出吸管模式。

- **`getCssSelector(el)`**:  
  生成元素 CSS Selector。  
  - **输入参数:** DOM 元素。  
  - **返回值:** CSS Selector 字符串。  
  - **关键逻辑:** 自底向上拼接标签、ID 或 `nth-of-type` 路径。

- **`getXpath(el)`**:  
  生成元素 XPath。  
  - **输入参数:** DOM 元素。  
  - **返回值:** XPath 字符串。  
  - **关键逻辑:** 若元素有 ID，返回 `//*[@id="..."]`；否则逐级计算同标签兄弟索引。

- **`createOverlay()`**:  
  创建吸管结果展示浮层。  
  - **输入参数:** 无。  
  - **返回值:** 无。  
  - **关键逻辑:** 创建固定定位浮层，包含 CSS Selector、XPath 输入框和关闭按钮。

- **`showResult(css, xpath)`**:  
  展示吸管选中元素的 Selector 和 XPath。  
  - **输入参数:** CSS Selector 和 XPath。  
  - **返回值:** 无。  
  - **关键逻辑:** 确保 overlay 存在并设置输入框值。

- **`phantomMD5(str)`**:  
  前端纯 JavaScript MD5 实现。  
  - **输入参数:** 字符串。  
  - **返回值:** MD5 十六进制字符串。  
  - **关键逻辑:** 内部实现 MD5 四轮运算，包括 `ff`、`gg`、`hh`、`ii`、`md5cycle`、`md5blk`、`add32` 等辅助函数。

### 3.2 类/结构体 (Classes/Structs)
- 本文件未定义 JavaScript `class`。
- 但存在多个以普通对象形式使用的数据结构：
  - **网络日志项 `item`**:
    - **主要属性:** `id`、`url`、`method`、`type`、`status`、`duration`、`postData`、`requestHeaders`、`content`、`base64Encoded`、`tabId`、`targetId` 等。
    - **用途:** 表示 background 捕获到的一条请求/响应记录。
  - **Mock 规则 `mockRules[]` 元素**:
    - **主要属性:** `urlKeyword`、`responseBody`、`enabled`。
    - **用途:** 根据 URL 关键字替换响应。
  - **本地文件替换规则 `localFileRules[]` 元素**:
    - **主要属性:** `urlKeyword`、`content`、`fileName`、`enabled`。
    - **用途:** 将线上 JS/CSS 等资源替换成本地文件内容。
  - **密钥库项 `keyVault[]` 元素**:
    - **主要属性:** `id`、`type`、`value`、`source`、`category`、`time`、`lastSeen`、`count`、`pinned`、`tag`。
    - **用途:** 存储自动捕获或手动入库的密钥、敏感字段、加密参数。
  - **WebSocket 改写规则 `wsModifyRules[]` 元素**:
    - **主要属性:** `urlKeyword`、`direction`、`rewriteBody`、`enabled`。
    - **用途:** 控制页面脚本对 WebSocket 帧的改写。
  - **告警规则 `localAlertRules[]` 元素**:
    - **主要属性:** `id`、`name`、`type`、`value`、`enabled`。
    - **用途:** 定义状态码、耗时、URL、响应体等条件告警。

### 3.3 接口/Traits (Interfaces/Traits)
- 本文件未定义 TypeScript 接口、JavaScript类接口或 Rust Trait。
- 存在若干隐式消息协议接口：
  - **`chrome.runtime.onMessage` 接收协议**:
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
  - **`window.postMessage` 页面消息协议**:
    - 接收：
      - `REQUEST_PAUSED_INTERNAL`
      - `STORAGE_EVENT`
      - `STORAGE_DUMP_RESULT`
      - `WS_HOOK_SENT`
      - `WS_HOOK_RECV`
      - `WS_HOOK_MODIFIED`
      - `CRYPTO_REPORT`
      - `PARAM_TRACE`
      - `SIGN_FIELD_FOUND`
    - 发送：
      - `ADD_REDIRECT_RULE`
      - `UPDATE_MOCK_RULES`
      - `UPDATE_DYNAMIC_SCRIPT`
      - `UPDATE_LOCAL_FILE_RULES`
      - `TOGGLE_BREAKPOINT`
      - `ABORT_REQUEST`
      - `RESUME_REQUEST`
      - `REPLAY_REQUEST`
      - `DUMP_STORAGE`
      - `UPDATE_WS_RULES`
      - `WS_FRAME_RESUME`
      - `WS_FRAME_ABORT`

### 3.4 常量/枚举 (Constants/Enums)
- **`s`**: 页面脚本注入用 `<script>` 元素，加载 `page-script.js`。
- **`panelRoot`**: ShadowRoot 引用。
- **`panelHost`**: 主面板宿主 DOM 节点。
- **`isPanelOpen`**: 面板打开状态。
- **`logsMap`**: 请求日志缓存，`Map<requestId, logItem>`。
- **`currentTypeFilter`**: 当前抓包类型过滤器，默认 `ALL`。
- **`currentSearchText`**: 当前 URL 搜索文本。
- **`mockRules`**: 静态 Mock 规则数组。
- **`dynamicScript`**: 动态 Hook 脚本文本。
- **`localFileRules`**: 本地文件替换规则数组。
- **`cssInjections`**: CSS 注入规则数组。
- **`isBreakpointEnabled`**: 请求断点总开关。
- **`breakpointFilter`**: 请求断点关键字。
- **`showStarredOnly`**: 是否仅显示收藏请求。
- **`starredSet`**: 收藏请求 ID 集合。
- **`diffTargetA` / `diffTargetB`**: Diff 对比目标请求。
- **`keyVault`**: 密钥库数组。
- **`keyVaultPinned`**: 置顶密钥集合；代码中声明但实际主要使用 `entry.pinned`，该 Set 未明显发挥作用。
- **`wsModifyRules`**: WebSocket 改写规则。
- **`wsBreakpointEnabled`**: WebSocket 帧断点开关。
- **`wsBreakpointKeyword`**: WebSocket 帧断点关键字。
- **`openAIKey`**: AI API Key。
- **`aiModel`**: 通用 AI 模型，默认 `gpt-3.5-turbo`。
- **`codeModel`**: 代码审计/反汇编模型，默认 `claude-haiku-4.5-20251001`。
- **`apiHost`**: AI 服务 Base URL，默认 `https://api.openai.com`。
- **`tracer2Count`**: 参数追踪结果计数。
- **`isInspecting`**: 吸管模式状态。
- **`hoveredElement`**: 当前吸管悬停元素。
- **`overlayElement`**: 吸管结果浮层。

## 4. 依赖关系 (Dependencies)

### 4.1 内部依赖 (Internal Dependencies)
- `page-script.js`
  - 通过 `chrome.runtime.getURL('page-script.js')` 注入页面环境。
  - 负责底层 Hook、网络拦截、Storage 监控、WebSocket Hook、加密 Hook 等页面上下文能力。
- `dashboard.css`
  - 通过 Shadow DOM 内 `<link rel="stylesheet">` 加载，用于面板样式。
- `background.js`
  - 本文件未直接 import，但大量依赖 `chrome.runtime.sendMessage` 与后台通信。
  - 依赖后台提供日志存储、响应体获取、Cookie 获取、AI 请求、HAR、Schema、安全扫描、配置导入导出等能力。
- `manifest.json`
  - 未直接引用文件内容，但该脚本显然依赖 Chrome 扩展运行环境、权限、content_scripts 配置和资源声明。

### 4.2 外部依赖 (External Dependencies)
- `chrome.runtime`
- `chrome.storage.local`
- `navigator.clipboard`
- `crypto.subtle`
- `fetch`
- `Blob`
- `URL.createObjectURL`
- `FileReader`
- `TextEncoder`
- `TextDecoder`
- `CanvasRenderingContext2D`
- 浏览器 DOM API：
  - `document`
  - `window`
  - `ShadowRoot`
  - `Element`
  - `Node`
  - `localStorage/sessionStorage` 的数据由页面脚本采集后传入
- AI 服务 API：
  - 默认 `https://api.openai.com`
  - 具体调用实际由后台处理，本文件只传递 `apiHost`、`apiKey`、`model`、`promptType`、`content`。

## 5. 暴露的接口/API (Exposed Interfaces/APIs)
- **`chrome.runtime.onMessage.addListener(...)`**: 类型为消息监听器。接收后台脚本发送的控制、日志、审计、WS、HAR、Schema、告警等消息。
- **`window.addEventListener('message', ...)`**: 类型为页面消息监听器。接收 `page-script.js` 从页面上下文发送的底层 Hook 数据。
- **`window.showBreakpointModal`**: 类型为函数。挂载到 `window` 上，用于展示请求断点弹窗；由本文件内部在收到 `REQUEST_PAUSED_INTERNAL` 时调用，也可能被其他上下文访问。
- **`window.__phantom_retry_item__`**: 类型为全局变量。用于响应体等待 UI 中的重试按钮保存当前请求项。
- **`window.__phantom_retry__`**: 类型为全局函数。用于响应体等待 UI 中的重试按钮调用 `showLogContent`。
- **`document.addEventListener('keydown', ...)`**: 类型为快捷键监听。按 `Ctrl + \`` 切换 Dashboard。
- **页面侧 `window.postMessage` 协议**: 类型为隐式 API。向 `page-script.js` 暴露 Mock、动态脚本、断点、WS、Storage、重放等控制命令。

## 6. 关键算法/逻辑流分析 (Key Algorithm/Logic Flow Analysis)

### 6.1 内容脚本初始化流程
1. 尝试通过 `Object.defineProperty(navigator, 'webdriver', { get: () => undefined })` 隐藏自动化/调试环境特征。
2. 创建 `<script>` 标签，加载扩展资源 `page-script.js`。
3. 脚本加载完成后移除标签，避免页面 DOM 中长期保留注入痕迹。
4. 初始化大量全局状态变量。
5. 注册 `chrome.runtime.onMessage`，接收后台消息。
6. 注册 `window.message`，接收页面脚本消息。
7. 从 `chrome.storage.local` 读取持久化配置。
8. 延迟调用 `syncRulesToPage()` 将规则同步给页面脚本。

### 6.2 Dashboard UI 构建流程
1. `toggleDashboard()` 被快捷键或后台消息触发。
2. 若面板不存在，调用 `createDashboardUI()`。
3. `createDashboardUI()` 创建宿主 `div#chacha-dashboard-host`。
4. 对宿主调用 `attachShadow({ mode: 'open' })`。
5. 在 Shadow DOM 中加载 `dashboard.css`。
6. 通过一个大型 `container.innerHTML` 模板生成所有功能面板。
7. 将 `panelHost` 挂载到 `document.body`。
8. 调用 `initEvents()` 绑定所有按钮、输入框、Tab、模态框、工具事件。
9. 使主面板、源码模态框、断点模态框可拖拽。
10. 打开面板时从后台拉取历史日志并重新渲染。

### 6.3 网络日志处理流程
1. 后台发送 `SYNC_LOG` 消息。
2. 若面板打开，调用 `processLog(msg.data)`。
3. `processLog()` 将日志写入 `logsMap`。
4. 如果日志 DOM 已存在，则更新状态码/耗时。
5. 如果不存在，则创建新的 `.log-item`：
   - 显示 method、type、URL、GraphQL 标记、payload 预览等。
   - 绑定收藏、Diff A/B、重放、复制、查看按钮。
6. 插入到抓包列表顶部。
7. 调用 `applyFilterSingle()` 根据类型、搜索、收藏状态决定是否显示。

### 6.4 响应体查看流程
1. 用户点击日志项或查看按钮。
2. 调用 `showLogContent(item)`。
3. 若请求失败或取消，直接展示请求信息和失败原因。
4. 若本地已有 `logData.content`，直接调用 `renderContentInModal()` 或组合请求体/响应体展示。
5. 若响应体未缓存：
   - 在模态框中显示等待 UI。
   - 设置 `codeContent.dataset.waitingId = item.id`。
   - 向后台发送 `FETCH_BODY`。
6. 后台可能返回：
   - 空结果：提示 Service Worker 可能休眠。
   - `fetchFailed`：展示失败解释。
   - `empty`：展示空响应体说明。
   - `error`：展示请求信息作为回退。
   - 正常 body：缓存到 `logData.content` 并渲染。
7. 若后台后续发送 `BODY_READY`，并且当前模态框正在等待对应 requestId，则自动刷新展示。

### 6.5 请求断点流程
1. 用户在面板顶部启用断点，并设置关键字。
2. 内容脚本通过 `window.postMessage({ type: 'TOGGLE_BREAKPOINT', ... })` 通知页面脚本。
3. 页面脚本拦截请求后发送 `REQUEST_PAUSED_INTERNAL`。
4. 内容脚本调用 `showBreakpointModal(details)`。
5. 弹窗展示 URL、Headers、Body、AI 建议 Tab。
6. 用户可：
   - 编辑完整 URL。
   - 编辑 Query 参数并自动同步 URL。
   - 编辑 Headers JSON。
   - 编辑 Body。
   - 使用 AI 场景生成越权、SQL 注入、IDOR 等测试建议。
7. 用户点击“丢弃请求”时发送 `ABORT_REQUEST`。
8. 用户点击“修改并放行”时发送 `RESUME_REQUEST`，携带修改后的 URL、Body、Headers。

### 6.6 Mock / 动态脚本 / 本地文件替换流程
1. 用户在伪造或脚本面板中配置规则。
2. 规则保存到 `chrome.storage.local`。
3. 调用 `syncRulesToPage()` 或直接 `window.postMessage()`。
4. 页面脚本接收：
   - `UPDATE_MOCK_RULES`
   - `UPDATE_DYNAMIC_SCRIPT`
   - `UPDATE_LOCAL_FILE_RULES`
5. 实际请求/响应改写逻辑不在本文件中实现，而在 `page-script.js` 中完成。

### 6.7 WebSocket 拦截流程
1. 用户添加 WS 改写规则，规则包含 URL 关键字、方向、JSON Patch 内容。
2. `syncWsRules()` 将规则发送给页面脚本。
3. 页面脚本 Hook WebSocket 后通过 `window.message` 返回：
   - `WS_HOOK_SENT`
   - `WS_HOOK_RECV`
   - `WS_HOOK_MODIFIED`
4. 本文件将帧渲染到 WS 拦截日志。
5. 若开启 WS 断点且命中关键字，日志项显示“放行”和“丢弃”按钮。
6. 用户操作后发送：
   - `WS_FRAME_RESUME`
   - `WS_FRAME_ABORT`

### 6.8 密钥库与审计流程
1. 后台发现响应中的密钥时发送 `KEY_FOUND`。
2. 内容脚本遍历密钥并调用 `addToKeyVault()` 入库。
3. 若审计面板打开，渲染告警卡片。
4. 页面脚本发现加密调用时发送 `CRYPTO_REPORT`。
5. 内容脚本提取 key 或输入值，加入密钥库，并生成加密拦截卡片。
6. 用户可：
   - 复制密钥。
   - 手动入库并置顶。
   - 请求 AI 进行签名/加密逆向分析。
7. 密钥库支持分类过滤、导出、清空、复制、标记、删除、标签。

### 6.9 参数来源追踪流程
1. 页面脚本通过 Hook fetch/XHR 上报 `PARAM_TRACE`。
2. 内容脚本转发给后台：`PARAM_TRACE_EVENT`。
3. 后台分析后发送 `PARAM_ANALYZED`。
4. 内容脚本调用 `renderParamAnalysis(trace, analysis)` 渲染。
5. 分析结果区分：
   - 来自接口响应。
   - 来自其他请求参数。
   - JS 动态计算。
6. 用户点击详情后，再向后台请求 `ANALYZE_PARAM_SOURCE` 并展开详细来源。

### 6.10 JSON 深度 Diff 算法
1. `runDiff()` 获取两个请求响应体。
2. 尝试分别 `JSON.parse`。
3. 若均解析成功，调用 `jsonDeepDiff()`。
4. `jsonDeepDiff()` 的规则：
   - 类型不同：记录 `type`。
   - 对象：合并双方 key 集合，递归比较每个 key。
   - 数组：按最大长度逐项递归，超出部分记录新增/删除。
   - 基本类型：值不同则记录 `changed`。
5. 渲染统计：新增、删除、值变更、类型变化。
6. 若不是 JSON，则回退到 `renderTextDiff()` 的行级比较。

### 6.11 安全扫描与辅助工具流
- 安全头检测、端点提取、漏洞扫描、参数挖掘均由内容脚本发消息给后台：
  - `SCAN_SECURITY_HEADERS`
  - `EXTRACT_ENDPOINTS`
  - `SCAN_VULNS`
  - `MINE_PARAMS`
- 本文件主要负责：
  - 发起扫描。
  - 接收结果。
  - 格式化展示。
  - 导出结果。
- 编解码工具箱在本文件前端直接实现：
  - Base64 编解码。
  - URL 编解码。
  - Hex 编解码。
  - Unicode 编解码。
  - HTML 编解码。
  - MD5。
  - SHA-256。

### 6.12 潜在风险与注意点
1. **大量使用 `innerHTML`**  
   虽然部分位置使用了 `escHtml()`，但并非所有动态数据都严格转义。例如部分 URL、响应预览、字段值、AI 返回内容会进入 HTML。若输入源可控，存在 XSS/HTML 注入风险，尤其是在 Shadow DOM 内仍可能影响扩展 UI 行为。

2. **全局变量污染**  
   文件向 `window` 写入 `showBreakpointModal`、`__phantom_retry_item__`、`__phantom_retry__`，还使用 `window[dedupKey]` 做签名字段去重。页面脚本或站点脚本理论上可能与这些命名冲突。

3. **`window.postMessage('*')` 使用宽泛**  
   多处发送消息 targetOrigin 为 `'*'`。虽然部分消息带 `__phantom_origin` 标识，但整体仍需依赖 `page-script.js` 侧严格校验，否则可能被页面伪造消息干扰。

4. **敏感信息处理风险**  
   文件会捕获、展示、导出 Cookie、密钥、Token、加密参数、请求体、响应体、Storage 等敏感数据。若导出文件或 AI 分析内容被泄露，会产生安全风险。

5. **AI 分析数据外发**  
   用户点击 AI 分析、反汇编、Fuzz、签名逆向时，请求内容、源码、密钥、调用栈等会被发送到配置的 AI 服务。代码中有确认弹窗或 API Key 校验，但仍应视为敏感数据外传路径。

6. **动态脚本执行风险**  
   动态 Hook 脚本通过 `new Function` 进行语法校验，并下发给页面脚本执行。若脚本来源不可信，可能导致页面行为被任意修改。

7. **直接 `fetch` 回放和 Fuzz**  
   请求构造器、HAR 回放、Fuzz 批量发送会在当前页面上下文发出请求，可能触发真实业务操作。代码中部分操作有 confirm，但并不对危险请求进行语义保护。

8. **大型单文件维护复杂度高**  
   该文件集成了 UI、状态管理、消息协议、渲染、工具算法、AI、扫描和导出逻辑，职责非常集中，后续维护和安全审计成本较高。

## 7. 标签/关键词 (Tags/Keywords)
- `Chrome扩展内容脚本`
- `网络抓包`
- `请求拦截`
- `WebSocket拦截`
- `动态Mock`
- `安全审计`
- `AI代码分析`
- `密钥泄露检测`

---


### 📄 `page-script.js`

# 代码文件分析报告: `F:\pac-master\Neural-Phantom使用claude开发\page-script.js`

## 1. 文件元数据 (File Metadata)
- **文件路径:** `F:\pac-master\Neural-Phantom使用claude开发\page-script.js`
- **语言类型:** JavaScript
- **代码行数:** 大致 670 行

## 2. 核心功能摘要 (Core Functionality Summary)
该文件是 Neural Phantom 浏览器扩展注入到页面上下文中的核心 Hook 脚本，主要用于拦截、审计和改写网页中的网络请求、加密调用、存储操作以及 WebSocket 通信。它通过重写 `fetch`、`XMLHttpRequest`、`WebSocket`、`localStorage/sessionStorage`、`IndexedDB`、`CryptoJS` 和 `WebCrypto` 等浏览器 API，实现请求 Mock、本地文件替换、断点调试、动态响应修改、参数追踪、签名字段嗅探和加密审计等能力。

## 3. 主要结构与组件 (Main Structures & Components)

### 3.1 函数/方法 (Functions/Methods)
- **`generateId`**:  
  生成唯一 ID，用于断点请求的标识。
  - **输入参数:** 无。
  - **返回值:** 字符串 ID，由当前时间戳的 36 进制字符串与随机字符串拼接组成。
  - **关键逻辑:** 使用 `Date.now().toString(36)` 与 `Math.random().toString(36).substr(2, 5)` 生成较短的随机请求 ID。

- **`makeNative(mockFunc, originalFunc)`**:  
  对被 Hook 后的函数进行“原生函数伪装”，使其在被调用 `toString()` 时返回原始函数的源码表现。
  - **输入参数:**
    - `mockFunc`: 替换后的 Hook 函数。
    - `originalFunc`: 原始浏览器 API 函数。
  - **返回值:** 一个 `Proxy` 包装后的函数。
  - **关键逻辑:**
    - 使用 `Proxy` 代理 `apply`、`construct`、`get` 行为。
    - 当访问 `toString` 时，返回原始函数的 `toString` 绑定结果。
    - 使用 `Object.defineProperty` 重写代理函数自身的 `toString` 方法，使其返回原始函数字符串。
  - **作用:** 降低页面脚本通过 `Function.prototype.toString` 检测 Hook 的概率。

- **`reportCrypto(algo, plaintext, keyInfo, extra, traceDepth)`**:  
  上报加密、签名、摘要等相关调用信息。
  - **输入参数:**
    - `algo`: 算法名称或 Hook 点名称。
    - `plaintext`: 明文、输入数据或摘要输入。
    - `keyInfo`: 密钥、Key 信息或无密钥说明。
    - `extra`: 附加信息。
    - `traceDepth`: 调用栈截取起始深度。
  - **返回值:** 无。
  - **关键逻辑:**
    - 通过 `new Error().stack` 获取调用栈。
    - 截取部分调用栈作为 trace。
    - 通过 `window.postMessage` 发送 `CRYPTO_REPORT` 消息。
    - 对明文和密钥信息分别做长度截断，避免上报过大内容。

- **`hookCryptoJS`**:  
  Hook 页面中的 `CryptoJS` 加密、HMAC 和哈希函数。
  - **输入参数:** 无。
  - **返回值:** 无。
  - **关键逻辑:**
    - 检查 `window.CryptoJS` 是否存在。
    - Hook `CryptoJS.AES.encrypt`。
    - Hook `HmacSHA1`、`HmacSHA256`、`HmacSHA512`、`HmacMD5`。
    - Hook `MD5`、`SHA1`、`SHA256`、`SHA512`。
    - 每次调用时先通过 `reportCrypto` 上报输入和密钥信息，再调用原始函数。
    - 使用 `_isHooked` 标记避免重复 Hook。
    - 使用 `makeNative` 伪装 Hook 后函数。

- **`hookWebCrypto`**:  
  Hook 浏览器原生 `window.crypto.subtle` 的签名、加密和摘要方法。
  - **输入参数:** 无。
  - **返回值:** 无。
  - **关键逻辑:**
    - 检查 `window.crypto.subtle` 是否可用且未 Hook。
    - 重写 `subtle.sign`，在原始 Promise 完成后上报算法、输入数据长度、数据前 32 字节十六进制预览和 Key 类型。
    - 重写 `subtle.encrypt`，在原始 Promise 完成后上报算法、数据长度、Key 算法和 IV。
    - 重写 `subtle.digest`，在原始 Promise 完成后上报算法、输入长度和摘要结果前缀。
    - 使用 `_isHooked` 防止重复 Hook。
  - **注意:** 该 Hook 是在原始加密/签名/摘要完成后上报，不会阻止原始调用。

- **`sniffSignatureFields(text)`**:  
  从 URL、请求体或文本中嗅探常见签名字段。
  - **输入参数:**
    - `text`: 待扫描字符串。
  - **返回值:** 无。
  - **关键逻辑:**
    - 使用 `SIG_PATTERNS` 中的正则匹配 `sign`、`signature`、`sig`、`nonce`、`timestamp`、`_t`、`_sign`、`hmac`、`access_token` 等字段。
    - 匹配到后通过 `window.postMessage` 发送 `SIGN_FIELD_FOUND` 消息。
    - 上报字段名、字段值前 60 个字符以及附近上下文。

- **`ParamTracer.getStack()`**:  
  获取参数来源调用栈。
  - **输入参数:** 无。
  - **返回值:** 过滤后的调用栈字符串，失败时返回 `'unknown'`。
  - **关键逻辑:**
    - 使用 `new Error().stack` 生成调用栈。
    - 截取第 3 到第 8 层调用。
    - 过滤包含 `page-script`、`inject.js`、`extensions` 的栈帧。
    - 使用 ` → ` 拼接调用链。

- **`ParamTracer.extractUrlParams(url)`**:  
  从 URL 中提取查询参数。
  - **输入参数:** `url`。
  - **返回值:** 参数对象。
  - **关键逻辑:**
    - 使用 `new URL(url, location.href)` 兼容相对 URL。
    - 遍历 `searchParams` 写入普通对象。
    - 解析异常时返回空对象。

- **`ParamTracer.extractBodyParams(body)`**:  
  从请求体字符串中提取参数。
  - **输入参数:** `body`。
  - **返回值:** 参数对象。
  - **关键逻辑:**
    - 非字符串、空值或超过 200000 字符的 body 直接返回空对象。
    - 优先尝试 `JSON.parse`。
    - 对 JSON 对象进行递归扁平化，嵌套字段以 `.` 拼接。
    - JSON 解析失败后尝试用 `URLSearchParams` 解析表单格式。
    - 参数值会被转为字符串并截断到 200 字符。

- **`ParamTracer.report(params, url, method, source, headers)`**:  
  上报参数追踪结果。
  - **输入参数:**
    - `params`: 参数对象。
    - `url`: 请求 URL。
    - `method`: 请求方法。
    - `source`: 参数来源，如 `fetch_url`、`fetch_body`、`xhr_header`。
    - `headers`: 额外请求头信息。
  - **返回值:** 无。
  - **关键逻辑:**
    - 过滤空参数。
    - 忽略 `_t`、`_`、`page`、`size`、`limit`、`offset`、`pageSize`、`pageNum`、`callback` 等通用参数。
    - 忽略空值或长度不大于 1 的值。
    - 通过 `window.postMessage` 发送 `PARAM_TRACE` 消息，包含参数、URL、方法、来源、调用栈、headers 和时间戳。

- **`XMLHttpRequest.prototype.setRequestHeader` Hook 函数**:  
  捕获 XHR 设置的请求头。
  - **输入参数:** `name`, `value`。
  - **返回值:** 原始 `setRequestHeader` 的返回值。
  - **关键逻辑:**
    - 将请求头保存到当前 XHR 实例的 `_capturedHeaders` 对象中。
    - 调用原始 `setRequestHeader`。

- **消息监听回调 `window.addEventListener('message', ...)`**:  
  监听来自扩展注入层或页面消息通道的控制指令。
  - **输入参数:** `event`。
  - **返回值:** 无。
  - **关键逻辑:**
    - `UPDATE_MOCK_RULES`: 更新静态 Mock 规则。
    - `UPDATE_LOCAL_FILE_RULES`: 更新本地文件替换规则。
    - `UPDATE_WS_RULES`: 此处只保留注释，实际更新在 WebSocket 模块的另一个监听器中。
    - `DUMP_STORAGE`: 导出 `localStorage` 和 `sessionStorage`。
    - `ABORT_REQUEST`: 中止断点挂起请求。
    - `UPDATE_DYNAMIC_SCRIPT`: 使用 `new Function` 编译动态响应处理脚本。
    - `TOGGLE_BREAKPOINT`: 更新断点开关和 URL 关键词过滤器。
    - `RESUME_REQUEST`: 恢复并修改断点挂起请求。
    - `ADD_REDIRECT_RULE`: 添加 URL 重定向替换映射。
    - `REPLAY_REQUEST`: 执行请求重放。

- **`replayRequest(url, method, body)`**:  
  使用 `fetch` 重放指定请求。
  - **输入参数:**
    - `url`: 请求 URL。
    - `method`: 请求方法。
    - `body`: 请求体。
  - **返回值:** 无。
  - **关键逻辑:**
    - 构造请求选项，默认设置 `Content-Type: application/json`。
    - 如果存在 body 则加入请求体。
    - 使用 `window.fetch` 发起请求。
    - 将响应文本打印到控制台。
  - **注意:** 此处调用的是已被 Hook 的 `window.fetch`，可能再次触发该文件中的 Mock、断点、追踪或动态脚本逻辑。

- **`waitForBreakpoint(url, method, body, type)`**:  
  根据断点开关和关键词判断是否挂起请求。
  - **输入参数:**
    - `url`: 请求 URL。
    - `method`: 请求方法。
    - `body`: 请求体。
    - `type`: 请求类型，如 `fetch` 或 `xhr`。
  - **返回值:**  
    - 不需要断点时返回 `null`。
    - 命中断点时返回一个等待 UI 恢复的 `Promise`。
  - **关键逻辑:**
    - 如果断点未启用，直接放行。
    - 如果设置了过滤关键词且 URL 不包含关键词，直接放行。
    - 生成 `requestId`。
    - 发送 `REQUEST_PAUSED_INTERNAL` 消息通知 UI。
    - 将 Promise 的 `resolve` 保存到 `_breakpointResolvers`，等待 `RESUME_REQUEST` 或 `ABORT_REQUEST` 消息处理。

- **`hookStorage(storageObj, storageName)`**:  
  Hook `localStorage` 或 `sessionStorage` 的写操作。
  - **输入参数:**
    - `storageObj`: Storage 对象。
    - `storageName`: 存储名称。
  - **返回值:** 无。
  - **关键逻辑:**
    - 保存原始 `setItem`、`removeItem`、`clear`。
    - 重写 `setItem`，上报新增或修改事件。
    - 重写 `removeItem`，上报删除事件。
    - 重写 `clear`，上报清空事件。
    - 通过 `window.postMessage` 发送 `STORAGE_EVENT`。
  - **注意:** 该实现只 Hook 方法调用，不覆盖直接属性式访问如 `localStorage.foo = 'bar'`。

- **`window.indexedDB.open` Hook 函数**:  
  监控 IndexedDB 打开后 readwrite 事务中的 `put` 与 `delete` 操作。
  - **输入参数:** `name`, `version`。
  - **返回值:** 原始 `indexedDB.open` 返回的 `IDBOpenDBRequest`。
  - **关键逻辑:**
    - 调用原始 `indexedDB.open`。
    - 在 `success` 事件中获取数据库实例。
    - Hook 数据库实例的 `transaction` 方法。
    - 当事务模式为 `readwrite` 时，尝试获取 objectStore 并重写其 `put` 与 `delete` 方法。
    - `put` 和 `delete` 操作通过 `STORAGE_EVENT` 上报。
  - **注意:** 只对通过被 Hook 后 `open` 获得的数据库实例生效；对已有 DB 实例不生效。

- **`hookedFetch(...args)`**:  
  Hook 后的 `window.fetch` 主逻辑。
  - **输入参数:** 与原生 `fetch` 相同，支持 `RequestInfo` 和 `RequestInit`。
  - **返回值:** `Promise<Response>`。
  - **关键逻辑:**
    1. 解析 URL、options、method、body。
    2. 优先匹配 `_mockRules`，命中后返回静态 `Response`。
    3. 匹配 `_localFileRules`，命中后返回本地文件内容 `Response`。
    4. 对 URL 和字符串 body 进行签名字段嗅探。
    5. 追踪 URL 参数、body 参数和关键请求头。
    6. 调用 `waitForBreakpoint`，可在请求发送前暂停。
    7. 如果用户中止请求，返回伪造的中止响应。
    8. 如果用户修改请求，应用修改后的 URL、body、headers。
    9. 调用原始 `fetch`。
    10. 如果存在动态脚本 `_dynamicHandler`，且响应类型是 JSON 或文本，则读取 clone 响应文本。
    11. 响应体小于 2MB 时交给动态脚本处理。
    12. 动态脚本返回非 `null/undefined` 时，用修改后的 body 构造新 `Response`。
    13. 返回原始或修改后的响应。
  - **注意:** 对 `args[0]` 是 `Request` 对象的情况，仅简单读取 `args[0].url`，修改 URL 时可能不能完整保留原 Request 的其他属性。

- **`hookedOpen(method, url)`**:  
  Hook 后的 `XMLHttpRequest.prototype.open`。
  - **输入参数:** 与原生 XHR `open` 类似，至少包含 `method`, `url`。
  - **返回值:** 原始 `open` 的返回值。
  - **关键逻辑:**
    - 将 URL 和方法保存到 XHR 实例的 `_requestUrl` 和 `_method`。
    - 将 `arguments` 转为数组，避免严格模式下直接修改 `arguments` 引发问题。
    - 如果 `_replaceMap[url]` 存在，则将请求 URL 替换为映射后的 URL。
    - 调用原始 `open`。

- **`hookedSend(body)`**:  
  Hook 后的 `XMLHttpRequest.prototype.send`。
  - **输入参数:** 请求体 `body`。
  - **返回值:** 原始 `send` 返回值或无返回。
  - **关键逻辑:**
    1. 检查静态 Mock 规则，命中后通过 `Object.defineProperty` 设置 `responseText`、`response`、`status`、`readyState`，并异步触发 `onreadystatechange` 和 `onload`。
    2. 检查本地文件替换规则，命中后以类似方式伪造响应。
    3. 追踪 URL 参数、body 参数和关键请求头。
    4. 如果断点开启，调用 `waitForBreakpoint`，在 Promise 回调中修改 body、设置 XHR 响应 Hook 并调用原始 `send`。
    5. 如果未断点但存在动态脚本，则设置响应 Hook。
    6. 调用原始 `send`。
  - **注意:** XHR 的断点判断只检查 `_breakpointEnabled`，实际 URL 关键词过滤仍由 `waitForBreakpoint` 内部处理。

- **`setupXhrHook(xhr)`**:  
  为指定 XHR 实例注入响应内容修改逻辑。
  - **输入参数:** `xhr` 实例。
  - **返回值:** 无。
  - **关键逻辑:**
    - 保存原始 `onreadystatechange` 和 `onload`。
    - 重写 `onreadystatechange`。
    - 在 `readyState === 4` 时，如果响应类型为空或 `text`，读取 `responseText`。
    - 响应体小于 2MB 时调用 `_dynamicHandler` 处理。
    - 如果动态脚本返回非空值，使用 `Object.defineProperty` 覆盖只读的 `responseText` 和 `response`。
    - 最后调用原始 `onreadystatechange`。
    - 如果原先设置了 `onload`，也包装 `onload`。
  - **潜在问题:** `handleStateChange` 是箭头函数，内部使用的 `arguments` 并不是该函数自己的参数；不过这里传递给原始回调的 `arguments` 实际意义有限。

- **`HookedWebSocket.constructor(url, protocols)`**:  
  自定义 WebSocket 子类构造函数，用于创建被 Hook 的 WebSocket 实例。
  - **输入参数:**
    - `url`: WebSocket URL。
    - `protocols`: 协议参数。
  - **返回值:** WebSocket 实例。
  - **关键逻辑:**
    - 调用 `super(url, protocols)` 创建原生 WebSocket 连接。
    - 设置 `_wsUrl`、`_wsId`、`_paused`、`_pendingFrames`。
    - 发送 `WS_HOOK_CREATED` 消息。
    - 注册一个内部 `message` 事件监听器，用于上报接收帧。
    - 根据 `_wsModifyRules` 对接收方向的字符串 JSON 消息尝试进行改写。
  - **注意:** 对接收消息的改写依赖修改 `MessageEvent.data`，该属性是否可重新定义取决于浏览器实现。

- **`HookedWebSocket.send(data)`**:  
  Hook 后的 WebSocket 发送方法。
  - **输入参数:** `data`，可以是字符串或二进制。
  - **返回值:** 无。
  - **关键逻辑:**
    - 上报发送帧 `WS_HOOK_SENT`。
    - 如果 `_paused` 为真，将帧加入 `_pendingFrames` 并上报 `WS_FRAME_PAUSED`，不立即发送。
    - 查找发送方向改写规则。
    - 如果匹配且数据是字符串，尝试按 JSON 解析，并将规则中的 `rewriteBody` 合并到原始消息。
    - 上报 `WS_HOOK_MODIFIED`。
    - 调用 `super.send(finalData)` 发送最终数据。
  - **注意:** 当前代码没有看到设置 `_paused = true` 的外部入口，因此 WebSocket 帧断点暂停功能在本文件中未完整闭环。

- **`HookedWebSocket._resumeFrames(modifiedData)`**:  
  恢复发送被暂停的 WebSocket 帧。
  - **输入参数:** `modifiedData`，可选的替换帧数据。
  - **返回值:** 无。
  - **关键逻辑:**
    - 将 `_paused` 设为 `false`。
    - 取出 `_pendingFrames` 中所有帧。
    - 若传入 `modifiedData`，所有暂存帧都用该数据发送；否则发送原始帧。

- **第二个消息监听回调 `window.addEventListener('message', function(event) {...})`**:  
  处理 WebSocket 相关规则和帧恢复/丢弃消息。
  - **输入参数:** `event`。
  - **返回值:** 无。
  - **关键逻辑:**
    - 忽略带 `__phantom_origin` 的消息。
    - `UPDATE_WS_RULES`: 更新 `_wsModifyRules`。
    - `WS_FRAME_RESUME`: 查找 WebSocket 实例并调用 `_resumeFrames`。
    - `WS_FRAME_ABORT`: 清空实例的 `_pendingFrames`。
  - **注意:** WebSocket 实例通过 `window.__phantom_ws_instances` 进行管理。

### 3.2 类/结构体 (Classes/Structs)
- **`ParamTracer`**:  
  类型为普通对象，用于参数来源追踪和上报。
  - **主要属性/方法:**
    - **`getStack`** - 获取经过过滤的调用栈。
    - **`extractUrlParams`** - 从 URL 查询字符串提取参数。
    - **`extractBodyParams`** - 从 JSON 或表单格式请求体提取参数。
    - **`report`** - 对参数进行过滤并通过 `window.postMessage` 上报。

- **`HookedWebSocket`**:  
  继承自原生 `WebSocket` 的类，用于拦截 WebSocket 连接、发送帧和接收帧。
  - **主要属性:**
    - **`_wsUrl`** - 当前 WebSocket 连接 URL。
    - **`_wsId`** - 当前 WebSocket 实例 ID。
    - **`_paused`** - 当前发送是否处于暂停状态。
    - **`_pendingFrames`** - 暂停期间暂存的待发送帧。
  - **核心方法:**
    - **`constructor`** - 初始化连接并注册接收消息监听器。
    - **`send`** - 上报和可选改写发送帧。
    - **`_resumeFrames`** - 恢复发送暂存帧。

### 3.3 接口/Traits (Interfaces/Traits)
- 本文件未定义 TypeScript 接口、JavaScript 接口类或类似 Rust Trait 的结构。
- 但它隐式依赖以下浏览器 API 契约：
  - **`window.fetch` / `Response`**
  - **`XMLHttpRequest`**
  - **`WebSocket`**
  - **`Storage`**
  - **`IndexedDB`**
  - **`CryptoJS`**
  - **`WebCrypto API`**
  - **`window.postMessage`**

### 3.4 常量/枚举 (Constants/Enums)
- **`SIG_PATTERNS`**:  
  签名字段嗅探正则数组。
  - 第一条匹配 URL 查询字符串中的 `sign`、`signature`、`sig`、`nonce`、`timestamp`、`_t`、`_sign`、`hmac`。
  - 第二条匹配 JSON 字符串中的 `sign`、`signature`、`nonce`、`timestamp`、`_sign`、`access_token`。

- **`_replaceMap`**:  
  URL 重定向映射表，用于在 XHR `open` 阶段替换请求 URL。它是 `const` 对象，但内部键值可变。

- **`originalFetch`**:  
  保存原始 `window.fetch` 函数引用。

- **`originalOpen`**:  
  保存原始 `XMLHttpRequest.prototype.open` 函数引用。

- **`originalSend`**:  
  保存原始 `XMLHttpRequest.prototype.send` 函数引用。

- **`originalSetRequestHeader`**:  
  保存原始 `XMLHttpRequest.prototype.setRequestHeader` 函数引用。

- **`_NativeWebSocket`**:  
  保存原始 `window.WebSocket` 构造函数。

- **`_OrigHookedWS`**:  
  保存自定义 `HookedWebSocket` 类引用，用于 Proxy 构造阶段创建实例。

- **闭包状态变量**:
  - **`_dynamicHandler`** - 动态响应处理函数，由 `UPDATE_DYNAMIC_SCRIPT` 编译生成。
  - **`_mockRules`** - 静态 Mock 规则数组。
  - **`_localFileRules`** - 本地文件替换规则数组。
  - **`_breakpointEnabled`** - 断点功能总开关。
  - **`_breakpointFilter`** - 断点 URL 关键词过滤器。
  - **`_breakpointResolvers`** - 挂起请求的 resolver 映射表。
  - **`_wsModifyRules`** - WebSocket 改写规则数组。

## 4. 依赖关系 (Dependencies)

### 4.1 内部依赖 (Internal Dependencies)
该文件没有使用 ES Module、CommonJS 或其他显式导入语句，因此没有直接的源码级内部依赖。

但从消息类型和注释可知，它与项目中的其他脚本存在运行时通信关系：
- `inject.js`
  - 通过 `window.postMessage` 下发规则、断点控制、动态脚本、请求重放等指令。
  - 接收本文件上报的请求、加密、存储、WebSocket、参数追踪等事件。
- `background.js`
  - 代码中未直接引用，但作为浏览器扩展项目的一部分，可能通过 `inject.js` 间接参与消息转发；具体实现不能从本文件确认。
- `rules.json`
  - 代码中未直接读取，但 `_mockRules`、`_localFileRules`、`_wsModifyRules` 的数据可能由扩展其他部分加载后下发；具体来源不能从本文件确认。

### 4.2 外部依赖 (External Dependencies)
该文件没有通过包管理器导入第三方库，但依赖浏览器运行时 API 和页面上可能存在的全局库：

- `Browser DOM API`
  - `window`
  - `window.postMessage`
  - `window.addEventListener`
  - `setInterval`
  - `console`
- `Fetch API`
  - `window.fetch`
  - `Response`
  - `Headers`
- `XMLHttpRequest`
- `WebSocket`
- `WebCrypto API`
  - `window.crypto.subtle`
  - `SubtleCrypto.sign`
  - `SubtleCrypto.encrypt`
  - `SubtleCrypto.digest`
  - `CryptoKey`
- `Storage API`
  - `localStorage`
  - `sessionStorage`
- `IndexedDB API`
  - `window.indexedDB`
  - `IDBDatabase.transaction`
  - `IDBObjectStore.put`
  - `IDBObjectStore.delete`
- `URL API`
  - `URL`
  - `URLSearchParams`
- `CryptoJS`
  - 可选依赖，只有页面已加载 `window.CryptoJS` 时才 Hook。
  - 使用到 `CryptoJS.AES.encrypt`、`CryptoJS.HmacSHA*`、`CryptoJS.MD5/SHA*`。

## 5. 暴露的接口/API (Exposed Interfaces/APIs)
该文件整体被包裹在立即执行函数表达式 IIFE 中，大部分内部变量和函数不直接暴露到全局作用域。但它通过重写浏览器全局 API 和注册消息协议向外提供能力。

- **`window.fetch`**:  
  类型: 函数。  
  被替换为带 Mock、本地替换、断点、参数追踪、签名嗅探、动态响应修改能力的 Hook 函数。

- **`XMLHttpRequest.prototype.open`**:  
  类型: 方法。  
  被替换为记录请求 URL/方法并支持 `_replaceMap` 重定向的 Hook 方法。

- **`XMLHttpRequest.prototype.send`**:  
  类型: 方法。  
  被替换为支持 Mock、本地替换、断点、参数追踪和动态响应修改的 Hook 方法。

- **`XMLHttpRequest.prototype.setRequestHeader`**:  
  类型: 方法。  
  被替换为捕获 XHR 请求头并保留原行为的 Hook 方法。

- **`window.WebSocket`**:  
  类型: 构造函数。  
  被替换为 Proxy 包装的构造器，创建 `HookedWebSocket` 实例，用于上报和改写 WebSocket 通信。

- **`window.localStorage.setItem/removeItem/clear`**:  
  类型: 方法。  
  被替换为会产生 `STORAGE_EVENT` 上报的 Hook 方法。

- **`window.sessionStorage.setItem/removeItem/clear`**:  
  类型: 方法。  
  被替换为会产生 `STORAGE_EVENT` 上报的 Hook 方法。

- **`window.indexedDB.open`**:  
  类型: 方法。  
  被替换为在数据库打开成功后 Hook readwrite 事务写操作的函数。

- **`window.__phantom_ws_instances`**:  
  类型: 全局对象。  
  用于保存当前 Hooked WebSocket 实例，键为 `wsId`。这是本文件明确写入 `window` 的全局状态。

- **`window.postMessage` 消息输出接口**:  
  类型: 消息协议。  
  本文件向外发送多类事件：
  - `CRYPTO_REPORT`
  - `SIGN_FIELD_FOUND`
  - `PARAM_TRACE`
  - `STORAGE_EVENT`
  - `STORAGE_DUMP_RESULT`
  - `REQUEST_PAUSED_INTERNAL`
  - `WS_HOOK_CREATED`
  - `WS_HOOK_RECV`
  - `WS_HOOK_SENT`
  - `WS_FRAME_PAUSED`
  - `WS_HOOK_MODIFIED`

- **`window.addEventListener('message')` 消息输入接口**:  
  类型: 消息协议。  
  本文件接收并处理以下指令：
  - `UPDATE_MOCK_RULES`
  - `UPDATE_LOCAL_FILE_RULES`
  - `UPDATE_WS_RULES`
  - `DUMP_STORAGE`
  - `ABORT_REQUEST`
  - `UPDATE_DYNAMIC_SCRIPT`
  - `TOGGLE_BREAKPOINT`
  - `RESUME_REQUEST`
  - `ADD_REDIRECT_RULE`
  - `REPLAY_REQUEST`
  - `WS_FRAME_RESUME`
  - `WS_FRAME_ABORT`

## 6. 关键算法/逻辑流分析 (Key Algorithm/Logic Flow Analysis)

### 6.1 整体初始化流程
1. 使用 IIFE 创建闭包作用域，保护内部状态变量。
2. 定义原生伪装函数 `makeNative`。
3. 定义并立即安装加密审计 Hook：
   - 立即调用 `hookCryptoJS()` 和 `hookWebCrypto()`。
   - 每 2 秒再次尝试 Hook，适配页面后续动态加载 `CryptoJS` 的情况。
4. Hook `XMLHttpRequest.prototype.setRequestHeader`，用于后续参数追踪中的请求头捕获。
5. 注册主消息监听器，接收 Mock、断点、动态脚本、Storage 导出、请求重放等控制指令。
6. Hook Storage 和 IndexedDB 写操作。
7. Hook `fetch`。
8. Hook `XMLHttpRequest.open/send`。
9. 定义并安装 WebSocket Hook。
10. 注册 WebSocket 专用消息监听器。

### 6.2 Fetch 请求处理流程
1. 页面调用 `fetch`。
2. `hookedFetch` 解析 URL、method、body。
3. 静态 Mock 规则优先匹配：
   - 命中则直接返回 `new Response(staticRule.responseBody, { status: 200 })`。
4. 本地文件替换规则匹配：
   - 命中则返回本地内容，Content-Type 固定为 `text/javascript`。
5. 对 URL 和字符串 body 进行签名字段嗅探。
6. 提取并上报：
   - URL 查询参数。
   - JSON 或表单格式 body 参数。
   - 关键请求头，如 `auth/token/sign/key/secret/x-*`。
7. 进入断点判断：
   - 未开启断点或 URL 不命中过滤器则继续。
   - 命中则发送 `REQUEST_PAUSED_INTERNAL`，并等待 UI 消息恢复。
8. 如果 UI 返回中止标记，返回伪造的中止响应。
9. 如果 UI 修改 URL、body 或 headers，则应用修改。
10. 调用原始 `fetch` 发出真实请求。
11. 响应返回后，如果存在动态处理脚本：
   - 仅处理 JSON 或文本响应。
   - clone 响应并读取文本。
   - 超过 2MB 不处理。
   - 调用 `_dynamicHandler(url, method, bodyText)`。
   - 如果返回值非 `null/undefined`，构造新 `Response` 替换响应体。
12. 返回最终响应。

### 6.3 XHR 请求处理流程
1. 页面调用 `xhr.open(method, url, ...)`。
2. `hookedOpen` 保存 `_requestUrl` 和 `_method`。
3. 如果 `_replaceMap[url]` 存在，替换实际请求 URL。
4. 页面调用 `xhr.setRequestHeader` 时，捕获 header 到 `_capturedHeaders`。
5. 页面调用 `xhr.send(body)`。
6. `hookedSend` 检查静态 Mock：
   - 命中则强制定义响应属性，并异步触发回调。
7. 检查本地文件替换：
   - 命中则以本地内容伪造响应。
8. 执行参数追踪：
   - URL 参数。
   - body 参数。
   - 关键请求头。
9. 如果断点开启：
   - 调用 `waitForBreakpoint` 等待恢复。
   - 恢复后可替换 body。
   - 如果动态脚本存在，设置响应 Hook。
   - 调用原始 `send`。
10. 如果未断点：
   - 动态脚本存在时设置响应 Hook。
   - 调用原始 `send`。
11. 响应完成后，`setupXhrHook` 在 `readyState === 4` 时尝试修改 `responseText/response`。

### 6.4 断点挂起与恢复机制
1. 用户或扩展通过 `TOGGLE_BREAKPOINT` 开启断点，并设置可选关键词。
2. Fetch 或 XHR 请求进入 `waitForBreakpoint`。
3. 如果命中条件：
   - 生成 `requestId`。
   - 发送 `REQUEST_PAUSED_INTERNAL`，携带请求详情。
   - 将 Promise resolver 存入 `_breakpointResolvers[requestId]`。
4. 外部 UI 可发送：
   - `RESUME_REQUEST`: 使用 `modifiedData` 恢复请求。
   - `ABORT_REQUEST`: 返回 `{ aborted: true }`。
5. Fetch 对 `aborted` 有明确处理；XHR 当前只处理 `modifiedData.body`，没有显式处理中止标记，因此 XHR 的 `ABORT_REQUEST` 在当前实现中可能不会真正中止 XHR 发送，而是仍会继续执行 `originalSend.call(this, body)`。

### 6.5 动态响应修改机制
1. 外部通过 `UPDATE_DYNAMIC_SCRIPT` 下发脚本字符串。
2. 文件使用：
   ```js
   new Function('url', 'method', 'response', data.script)
   ```
   生成 `_dynamicHandler`。
3. Fetch 响应返回后：
   - 读取文本响应。
   - 调用动态函数。
   - 根据返回值决定是否替换响应。
4. XHR 响应完成后：
   - 调用同一个动态函数。
   - 使用 `Object.defineProperty` 替换 `responseText` 和 `response`。
5. 空脚本会将 `_dynamicHandler` 置为 `null`。

### 6.6 加密审计逻辑
1. 对 CryptoJS:
   - Hook AES 加密、HMAC 和常见 Hash。
   - 在原始加密/摘要函数执行前上报输入、密钥和调用栈。
2. 对 WebCrypto:
   - Hook `sign`、`encrypt`、`digest`。
   - 在 Promise resolve 后上报输入长度、结果摘要、算法和 Key 信息。
3. 输出统一走 `CRYPTO_REPORT` 消息。
4. `setInterval` 周期性重试 Hook，适配动态加载的加密库。

### 6.7 参数追踪与签名嗅探逻辑
1. Fetch 请求:
   - URL 进入 `sniffSignatureFields`。
   - 字符串 body 进入 `sniffSignatureFields`。
   - URL/body/header 进入 `ParamTracer.report`。
2. XHR 请求:
   - URL/body/header 进入 `ParamTracer.report`。
3. 参数追踪会过滤常见分页、时间戳和 callback 参数。
4. 上报时附加调用栈，用于定位参数构造来源。

### 6.8 存储审计逻辑
1. `localStorage` 和 `sessionStorage`:
   - Hook `setItem/removeItem/clear`。
   - 上报增、改、删、清空操作。
2. `IndexedDB`:
   - Hook `indexedDB.open`。
   - 数据库打开成功后 Hook 该 DB 实例的 `transaction`。
   - 对 `readwrite` 事务中的 objectStore `put/delete` 进行上报。
3. `DUMP_STORAGE`:
   - 一次性导出当前页面可访问的 `localStorage` 和 `sessionStorage`。

### 6.9 WebSocket Hook 逻辑
1. 保存原始 `window.WebSocket` 为 `_NativeWebSocket`。
2. 定义 `HookedWebSocket extends _NativeWebSocket`。
3. 用 `Proxy` 替换 `window.WebSocket` 构造器。
4. 页面创建 WebSocket 时：
   - 实际创建 `HookedWebSocket`。
   - 注册到 `window.__phantom_ws_instances`。
   - 上报连接创建。
5. 发送帧时：
   - 上报帧内容。
   - 如命中发送方向改写规则，尝试 JSON 合并改写。
   - 调用原生发送。
6. 接收帧时：
   - 内部监听器上报收到的消息。
   - 如命中接收方向改写规则，尝试 JSON 合并改写 `event.data`。
7. WebSocket 关闭后，从实例表删除。

### 6.10 潜在风险与实现隐患
- **动态脚本执行风险:**  
  `UPDATE_DYNAMIC_SCRIPT` 使用 `new Function` 执行外部传入脚本，具有完整页面上下文执行能力。如果消息来源未严格校验，存在严重代码注入风险。

- **消息来源缺乏严格校验:**  
  主消息监听器没有校验 `event.source`、`event.origin` 或自定义可信标记。页面自身脚本理论上也可能发送相同类型消息影响 Hook 行为。

- **敏感信息泄露风险:**  
  加密审计、请求头追踪、Storage 导出会捕获 token、签名、密钥、明文、Storage 数据等敏感信息。该行为应严格限定在授权调试环境中。

- **Fetch 中止响应状态异常:**  
  代码中返回：
  ```js
  new Response('{"error":"request aborted by Phantom"}', { status: 0, statusText: 'Aborted' })
  ```
  Fetch `Response` 构造函数通常要求状态码在合法范围内，`status: 0` 可能抛出异常或不符合预期。

- **XHR 中止处理不完整:**  
  `ABORT_REQUEST` resolver 返回 `{ aborted: true }`，但 `hookedSend` 的断点恢复逻辑没有检查 `modifiedData.aborted`，因此可能仍发送请求。

- **WebSocket 暂停功能不完整:**  
  `send` 方法中支持 `_paused`，但本文件没有处理开启某个 WS 实例 `_paused = true` 的消息或逻辑，因此暂停功能看起来未完整实现。

- **WebSocket 接收改写可能无效:**  
  `MessageEvent.data` 通常是只读属性，虽然代码尝试 `Object.defineProperty(event, 'data', ...)`，但是否成功取决于运行环境。

- **XHR Mock 事件模拟不完整:**  
  静态 Mock 和本地替换只设置了部分属性并触发 `onreadystatechange/onload`，没有完整模拟 `loadend`、`progress`、`responseURL`、`getResponseHeader` 等行为。

- **Storage Hook 兼容性问题:**  
  某些浏览器环境下直接覆盖 `localStorage.setItem` 等方法可能失败或不生效，因此代码使用 `try/catch` 包裹，但失败后不会上报错误。

- **IndexedDB Hook 覆盖范围有限:**  
  只 Hook `open` 成功后的 DB 实例和 `readwrite` 模式下通过 `transaction` 获取的 store。已有实例、其他写方法如 `add/clear` 未覆盖。

- **性能风险:**  
  虽然响应动态处理有 2MB 限制，body 参数解析也有 200KB 限制，但频繁 Hook、正则扫描、调用栈生成和大量 `postMessage` 仍可能影响页面性能。

- **原生伪装不完全:**  
  `makeNative` 主要伪装 `toString`，但高级反 Hook 检测仍可通过属性描述符、函数名称、长度、错误栈、性能特征、Proxy 行为等方式发现异常。

## 7. 标签/关键词 (Tags/Keywords)
- `浏览器扩展`
- `网络请求拦截`
- `Fetch Hook`
- `XHR Hook`
- `WebSocket Hook`
- `加密审计`
- `参数追踪`
- `Storage监控`

---


---

## ✅ 分析完成

**总计分析文件数:** 3
**完成时间:** 2026/5/3 22:40:51

---
*本报告由 ProjectAnalyst 插件自动生成*
