# Neural Phantom × VCP 深度融合架构书 v0.1

> **作者**: Rosa  
> **日期**: 2026-05-04  
> **状态**: Draft  
> **关联项目**: Neural Phantom 4.7 (F:\neural-phantom-4.7) + VCP (E:\VCP)

---

## 目录

1. [项目背景](#1-项目背景)
2. [总体架构](#2-总体架构)
3. [Phase 1: AI接管](#3-phase-1-ai接管)
4. [Phase 2: WebSocket桥接](#4-phase-2-websocket桥接)
5. [Phase 3: 深度知识融合](#5-phase-3-深度知识融合)
6. [实战场景](#6-实战场景)
7. [安全设计](#7-安全设计)
8. [实施路线图](#8-实施路线图)
9. [附录：NP能力全景](#9-附录np能力全景)

---

## 1. 项目背景

### 1.1 Neural Phantom 4.7 概况

Neural Phantom（以下简称NP）是一个嵌入Chrome浏览器的全栈网络逆向工程平台。

| 属性 | 值 |
|------|-----|
| 形态 | Chrome Extension (Manifest V3) |
| 代码量 | ~6300行纯手写JavaScript，零外部依赖 |
| 路径 | F:\neural-phantom-4.7 |
| 核心文件 | background.js(~1250行) / inject.js(~3200行) / page-script.js(~1150行) / console.js(~530行) / chain.js(~180行) |

### 1.2 NP核心能力矩阵

| 能力类别 | 具体功能 |
|---------|---------|
| 网络抓包 | CDP全事件捕获、响应体多级重试获取(即时2次+300/800/2000ms)、GraphQL识别 |
| 请求操控 | 断点暂停/修改/放行/丢弃、静态Mock、Header覆盖(DNR)、URL替换、本地文件替换、动态响应脚本 |
| WebSocket | 帧捕获、帧改写规则(_wsModifyRules)、帧断点(暂停/放行/丢弃) |
| 加密审计 | CryptoJS Hook(AES/HMAC/Hash)、WebCrypto全Hook(sign/encrypt/digest/decrypt+5种密钥操作)、签名字段嗅探、参数加密检测(JWT/Base64/Hex/URL编码/AES) |
| 安全扫描 | KeyHunter密钥扫描(OpenAI/AWS/GitHub/JWT/私钥等)、SecurityHeaders安全头评分、VulnScanner漏洞正则扫描、EndpointExtractor端点提取、ParamMiner参数挖掘 |
| 深度分析 | ParamSourceAnalyzer参数来源三级溯源(FROM_RESPONSE/FROM_REQUEST/JS_COMPUTED)、Cookie/Header鉴权全链路溯源(Set-Cookie/响应体/JS加密/客户端追踪/未知)、函数追踪+栈帧热点统计、TracerEngine全文流量搜索 |
| 链路追踪 | MediaChainEngine视频链路(M3U8/MP4/MPD/FLV)、音频(AudioContext/MediaRecorder)、文本(Clipboard/MutationObserver)、图片(Canvas/Image.src)、脚本归属分析 |
| AI分析 | 10种PromptType、双模型设计(aiModel通用+codeModel逆向)、SW保活(keepalive port) |
| HAR | 录制/停止/导出(HAR 1.2)/导入/回放(50ms间隔) |
| 数据管理 | Storage/Cookie/IndexedDB监控、Schema快照+变更检测、条件告警规则引擎、实时流量统计bucket、配置导入导出 |

### 1.3 NP四层通信架构

```
page-script.js (MAIN World)
  ├ 劫持 fetch/XHR/WebSocket/WebCrypto/Storage/Canvas/Audio/Clipboard/Image
  ├ makeNative() Proxy反检测伪装
  └ 请求断点/Mock/响应改写/URL替换/本地文件替换
       ↕ window.postMessage (30+消息类型)
inject.js (Isolated World Content Script)
  ├ Shadow DOM调试面板
  ├ 密钥库/POST缓存/全流量缓存/Cookie时间线
  └ 自实现Prism语法高亮 / 前端MD5
       ↕ chrome.runtime.sendMessage
background.js (Service Worker)
  ├ chrome.debugger CDP全事件捕获(六层预挂钩)
  ├ KeyHunter/VulnScanner/SecurityHeaders/EndpointExtractor/ParamMiner
  ├ ParamSourceAnalyzer/MediaChainEngine/TracerEngine
  ├ HAR录制/Schema快照/条件告警/M3U8净化
  └ callOpenAI() 10种promptType
       ↕ chrome.runtime.sendMessage
chain.js (独立弹窗) / console.js (独立控制台)
  ├ 链路卡片渲染(800ms轮询)
  └ Attach状态/事件流/函数热点/鉴权溯源(1s轮询)
```

### 1.4 融合目标

将NP从"独立的浏览器调试工具"升级为"VCP Agent生态的网络感知与操控层"：

1. Rosa和其他Agent可以**程序化调用**NP的全部能力（40个指令覆盖~98%功能）
2. NP捕获的数据自动**流入VCP RAG知识库**（安全报告/逆向知识结构化存储）
3. AI分析走VCP统一模型路由，**共享模型池**（不再需要单独配Key）
4. NP安全告警自动**推送到VCP桌面/Agent**（实时感知）

---

## 2. 总体架构

```
┌──────────────────────────────────────────────────────────────┐
│                     VCP (Node.js :6005)                       │
│  ┌───────────────┐  ┌───────────┐  ┌───────────────────────┐ │
│  │NeuralPhantom  │  │ Rosa/Agent│  │ RAG知识库              │ │
│  │Bridge插件     │  │ (消费者)   │  │ [网站逆向知识库]       │ │
│  │(hybridservice)│  │           │  │ (NP数据自动入库)       │ │
│  └───────┬───────┘  └─────┬─────┘  └──────────┬────────────┘ │
│          │WebSocket        │ AI请求             │ DailyNote   │
│          │ws://:6005/np    │                    │ 向量化      │
├──────────┼────────────────┼────────────────────┼─────────────┤
│  ┌───────┴────────────────┴────────────────────┴───────────┐ │
│  │                  Chrome 浏览器                            │ │
│  │  ┌────────────────────────────────────────────────────┐  │ │
│  │  │  Neural Phantom 4.7                                 │  │ │
│  │  │  background.js + VCPConnector (新增~300行)          │  │ │
│  │  │  inject.js / page-script.js (不改动)               │  │ │
│  │  │  console.js / chain.js (不改动)                    │  │ │
│  │  └────────────────────────────────────────────────────┘  │ │
│  └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### 设计原则

1. **NP最小侵入**: inject.js/page-script.js/console.js/chain.js完全不动，所有改动集中在background.js新增VCPConnector模块
2. **渐进式融合**: Phase 1→2→3各自独立可用，逐步深入
3. **双向通信**: NP推送数据(被动感知) + VCP下发指令(主动操控)
4. **安全第一**: 仅localhost、握手认证、body截断、密钥脱敏

---

## 3. Phase 1: AI接管

### 3.1 概要

| 项目 | 值 |
|------|-----|
| 改动量 | 4行代码 |
| 耗时 | 30分钟 |
| 改动文件 | background.js (默认配置) |
| 风险 | 零 |

### 3.2 改动内容

NP的callOpenAI()已是标准OpenAI /v1/chat/completions格式，只需修改默认配置指向VCP：

```javascript
// background.js — 修改默认AI配置
let apiHost = 'http://localhost:6005';           // 原: https://api.openai.com
let openAIKey = 'VCP_API_KEY';                   // VCP认证token
let aiModel = 'gemini-2.5-flash-preview';        // VCP路由的任意模型
let codeModel = 'claude-sonnet-4-20250514';              // 逆向专用也走VCP
```

### 3.3 效果

| 之前 | 之后 |
|------|------|
| NP直接调外部API | 走VCP统一模型路由 |
| 每个用户自己配API Key | 共享VCP的API池 |
| AI结果看完就没了 | VCP可拦截记录所有AI分析 |
| 固定模型 | 随时切换VCP支持的任意模型 |

### 3.4 可选增强：注入Rosa身份

在callOpenAI()的systemPrompt中前置注入：

```javascript
let systemPrompt = `You are Rosa, an elite Reverse Engineer within the VCP ecosystem.
You have access to historical analysis stored in your RAG knowledge base.
Current analysis mode: ${promptType}
---
` + originalSystemPrompt;
```

### 3.5 NP的10种AI分析能力（全部走VCP后可用）

| # | PromptType | 功能 | 使用模型 |
|---|-----------|------|---------|
| 1 | EXPLAIN | 解释HTTP响应业务逻辑+安全风险 | aiModel |
| 2 | TS_TYPE | 从JSON生成TypeScript interfaces+JSDoc | aiModel |
| 3 | MOCK_DATA | 生成5条逼真Mock数据 | aiModel |
| 4 | API_DOC | 生成Markdown接口文档(6节) | aiModel |
| 5 | DISASSEMBLE | 代码去混淆+重构ES6+安全审计 | codeModel |
| 6 | FUZZ | 生成10个Fuzz用例+可批量执行 | aiModel |
| 7 | CODE_GEN | 转换为5种语言代码(curl/py/js/go/java) | aiModel |
| 8 | SIGN_REVERSE | 加密逆向(算法识别/密钥分析/Python复现) | codeModel |
| 9 | BP_AI_SUGGEST | 断点攻击建议(bypass/sqli/idor/privilege) | aiModel |
| 10 | SCRIPT_GEN | 用自然语言生成Hook脚本 | aiModel |

---

## 4. Phase 2: WebSocket桥接

### 4.1 通信协议

#### 消息信封（所有消息共用）

```
{
    id: string,                        // UUID，请求-响应配对
    type: string,                      // 消息类型
    direction: "np2vcp" | "vcp2np",    // 方向
    timestamp: number,                 // 毫秒时间戳
    data: object                       // 具体payload
}
```

#### 指令的请求-响应配对

```
VCP发送: { id:"uuid-123", type:"GetTraffic", direction:"vcp2np", data:{...} }
NP返回: { id:"uuid-123", type:"GetTraffic_RESPONSE", direction:"np2vcp", data:{...} }
```

### 4.2 三层指令体系（40指令）

从NP的45+个msg.action路由中提取，按Rosa实战逆向场景分为三层。

#### Layer 1: 核心操控（14指令）— 远程改变流量

| # | 指令名 | NP对应机制 | 参数 | 说明 |
|---|--------|-----------|------|------|
| 1 | SetBreakpoint | TOGGLE_BREAKPOINT | { enabled:bool, urlFilter?:string } | 全局断点开关+过滤 |
| 2 | ResumeRequest | RESUME_REQUEST | { requestId, modifiedUrl?, modifiedBody?, modifiedHeaders? } | 修改后放行 |
| 3 | AbortRequest | ABORT_REQUEST | { requestId } | 丢弃请求 |
| 4 | AddMockRule | UPDATE_MOCK_RULES(追加) | { urlPattern, status?:200, body, headers? } | 伪造响应 |
| 5 | RemoveMockRule | UPDATE_MOCK_RULES(移除) | { urlPattern } 或 { index } | 删除Mock |
| 6 | SetDynamicScript | UPDATE_DYNAMIC_SCRIPT | { script:string } | 动态响应修改脚本 |
| 7 | SetHeaderOverride | UPDATE_HEADER_RULES (DNR) | { urlPattern, headers:{} } | 修改请求头 |
| 8 | AddUrlReplace | ADD_REDIRECT_RULE → _replaceMap | { originalUrl, replacementUrl } | URL重定向 |
| 9 | SetLocalFileRule | UPDATE_LOCAL_FILE_RULES | { urlKeyword, localContent } | 本地文件替换响应 |
| 10 | InjectScript | chrome.debugger Runtime.evaluate | { script:string, tabId? } | 注入任意JS |
| 11 | ReplayRequest | REPLAY_REQUEST | { url, method, headers?, body? } | 重放请求 |
| 12 | SetWsRules | UPDATE_WS_RULES | { rules:[] } | WebSocket帧改写规则 |
| 13 | ResumeWsFrame | WS_FRAME_RESUME | { wsId, modifiedData? } | 放行WS断点帧 |
| 14 | AbortWsFrame | WS_FRAME_ABORT | { wsId } | 丢弃WS断点帧 |

#### Layer 2: 数据查询与分析（17指令）— 获取NP抓包数据

| # | 指令名 | NP对应机制 | 参数 | 说明 |
|---|--------|-----------|------|------|
| 15 | GetTraffic | GET_LOGS + 过滤 | { urlContains?, method?, tags?, limit?:30 } | 流量快照 |
| 16 | GetFullBody | FETCH_BODY | { requestId } | 完整响应体 |
| 17 | GetWsLogs | GET_WS_LOGS | { limit? } | WebSocket帧日志 |
| 18 | GetCryptoEvents | 推送缓存 | { since? } | 加密拦截事件 |
| 19 | GetAlerts | 推送缓存 | { since? } | 安全告警列表 |
| 20 | AnalyzeParamSource | ANALYZE_PARAM_SOURCE | { paramKey, paramValue } | 单参数来源分析 |
| 21 | AnalyzeAuth | ANALYZE_REQUEST_AUTH | { requestId 或 url } | 鉴权头/Cookie全链路溯源 |
| 22 | ScanSecurity | SCAN_SECURITY_HEADERS + SCAN_VULNS | 无 | 一键安全扫描(合并) |
| 23 | ExtractEndpoints | EXTRACT_ENDPOINTS | 无 | 提取API端点 |
| 24 | MineParams | MINE_PARAMS | 无 | 挖掘参数 |
| 25 | SearchTraffic | SEARCH_TRACER | { keyword } | 全文搜索流量 |
| 26 | GetParamTraces | GET_PARAM_TRACES | { limit? } | 参数追踪记录 |
| 27 | GetFuncTraces | GET_FUNC_TRACES + GET_FRAME_HOTSPOTS | { limit? } | 函数追踪+热点(合并) |
| 28 | GetChainState | CHAIN_GET_STATE | 无 | 媒体链路状态 |
| 29 | GetSourceCode | GET_SOURCE_BY_URL | { url } | 页面JS源码 |
| 30 | GetCookies | FETCH_COOKIES | 无 | 当前域Cookie |
| 31 | DumpStorage | DUMP_STORAGE | 无 | 导出localStorage/sessionStorage |

#### Layer 3: 管理控制（9指令）— NP生命周期管理

| # | 指令名 | NP对应机制 | 参数 | 说明 |
|---|--------|-----------|------|------|
| 32 | HarControl | HAR_START/STOP/EXPORT/IMPORT | { action:"start"|"stop"|"export"|"import", data? } | HAR录制控制(合并) |
| 33 | ClearLogs | CLEAR_LOGS | 无 | 清空抓包日志 |
| 34 | ResetChain | CHAIN_RESET_*/CHAIN_CLEAR_ALL | { scope:"window"|"session"|"all" } | 重置链路(合并) |
| 35 | GetPrehookStatus | GET_PREHOOK_STATUS | 无 | 查看debugger预挂钩状态 |
| 36 | GetAttachedTabs | GET_ATTACHED_TABS | 无 | 查看已监控tab |
| 37 | GetPerfStats | GET_PERF_STATS + GET_TRAFFIC_TIMELINE | 无 | 性能统计+流量时间线(合并) |
| 38 | SetAlertRules | SAVE_ALERT_RULES | { rules:[] } | 设置条件告警规则 |
| 39 | TraceFunctions | TRACE_FUNCTION | { functionPath:string } | 追踪指定函数 |
| 40 | Status | 内部状态 | 无 | NP桥接连接状态 |

#### 覆盖率对比

| 维度 | 原方案(8指令) | 新方案(40指令) |
|------|:---:|:---:|
| 网络操控 | 63% | 100% |
| WS操控 | 0% | 100% |
| 安全扫描 | 0% | 100% |
| 深度分析 | 0% | 100% |
| 链路追踪 | 0% | 100% |
| HAR | 0% | 100% |
| 数据查询 | 25% | 100% |
| 管理控制 | 0% | 100% |
| **总覆盖率** | **~15%** | **~98%** |

#### 合并策略

- SCAN_SECURITY_HEADERS + SCAN_VULNS → **ScanSecurity**（一次扫描全出）
- HAR_START/STOP/EXPORT/IMPORT → **HarControl**（一个指令+子命令action）
- GET_FUNC_TRACES + GET_FRAME_HOTSPOTS → **GetFuncTraces**（一并返回）
- CHAIN_RESET_WINDOW/SESSION + CHAIN_CLEAR_ALL → **ResetChain**（scope参数区分）
- GET_PERF_STATS + GET_TRAFFIC_TIMELINE → **GetPerfStats**（合并返回）

#### 未暴露的NP内部消息（不需要VCP指令）

以下是NP面板UI的内部交互机制，不需要暴露给VCP：

- SYNC_LOG / BODY_READY — NP面板内数据刷新
- TOGGLE_PANEL — 打开NP面板UI
- ALERT_HIT / SCHEMA_CHANGED — NP内部通知，VCP走推送
- KEY_FOUND / SENSITIVE_FIELD_FOUND — NP内部密钥发现，VCP走推送
- TOGGLE_STAR / GET_STARRED — NP面板收藏功能
- EXPORT_CONFIG / IMPORT_CONFIG — NP本地配置管理

### 4.3 NP端改动：VCPConnector模块

#### 改动范围

- **新增**: background.js末尾追加VCPConnector类（~300行）
- **插入**: 现有代码3个位置各加1-3行推送调用
- **不动**: inject.js / page-script.js / console.js / chain.js / manifest.json

#### 插入点

```javascript
// 插入点1: fetchAndCacheBody()的响应体获取成功回调内
bodyCache.set(requestId, { body, base64Encoded });
vcpConnector.pushRequest({...}); // ← 新增1行

// 插入点2: scanBodyForKeys()发现密钥时
vcpConnector.pushAlert({...}); // ← 新增1行

// 插入点3: onMessage处理CRYPTO_INTERCEPT时
vcpConnector.pushCryptoEvent(request.data); // ← 新增1行
```

#### VCPConnector核心结构

```javascript
class VCPConnector {
    // === 连接管理 ===
    constructor()              // 初始化配置+缓存
    connect()                  // WebSocket连接+握手
    scheduleReconnect()        // 指数退避重连(5s→10s→20s→max60s)

    // === VCP→NP 指令处理 ===
    handleVCPCommand(msg)      // 40个指令的switch路由
    // Layer 1: 转发到page-script或chrome.debugger
    // Layer 2: 从NP内存缓存读取或调用NP内部函数
    // Layer 3: 调用NP管理API

    // === NP→VCP 事件推送 ===
    pushRequest(requestData)   // 推送抓包数据(带过滤+自动标签)
    pushAlert(alert)           // 推送安全告警
    pushCryptoEvent(event)     // 推送加密事件

    // === 工具方法 ===
    shouldFilter(req)          // 过滤静态资源/扩展请求
    autoTag(req)               // 自动标签(api/auth/graphql/media/error/key_leak)
    send(msg)                  // 统一发送
    request(type, data, timeout) // 带超时的请求-响应
}
```

#### 配置存储

```javascript
// chrome.storage.local中新增3个配置项
{
    vcpBridgeUrl: 'ws://localhost:6005/np-bridge',  // VCP WebSocket地址
    vcpAuthToken: '',                                // 认证token
    vcpBridgeEnabled: false                          // 开关（默认关闭）
}
```

#### 推送过滤规则

```javascript
pushFilter: {
    excludeMimeTypes: ['image/', 'font/'],
    excludeUrlPatterns: [
        /\.(png|jpg|gif|svg|ico|woff|ttf|eot)(\?|$)/i,
        /^chrome-extension:\/\//
    ],
    maxBodyPreview: 2000  // body只推前2000字符
}
```

### 4.4 VCP端新增：NeuralPhantomBridge插件

#### 目录结构

```
E:\VCP\Plugin\NeuralPhantomBridge\
├── ARCHITECTURE_v0.1.md         ← 本文档
├── plugin-manifest.json         ← hybridservice定义(40个指令)
├── NeuralPhantomBridge.js       ← WebSocket服务端 + 指令路由
├── TrafficStore.js              ← 内存流量/告警/加密事件存储
└── config.env                   ← 推送过滤/端口配置
```

#### 插件类型

hybridservice — 同时提供：
- WebSocket服务端（接收NP连接+推送）
- invocationCommands（40个指令供Rosa调用）

#### TrafficStore设计

```javascript
class TrafficStore {
    constructor(maxSize = 1000) {
        this.requests = [];       // 请求列表（环形缓冲）
        this.alerts = [];         // 安全告警
        this.cryptoEvents = [];   // 加密事件
        this.wsFrames = [];       // WebSocket帧
    }

    addRequest(req)              // 入库+自动淘汰
    query(filter)                // 多维过滤(url/method/tags/status/limit)
    getAlerts(since?)            // 按时间获取告警
    getCryptoEvents(since?)      // 按时间获取加密事件
    clear()                      // 清空所有数据
}
```

### 4.5 NP→VCP推送事件Schema

#### REQUEST_CAPTURED

```
{
    requestId: string,
    url: string,
    method: string,
    status: number,
    mimeType: string,
    requestHeaders: {},
    responseHeaders: {},
    bodyPreview: string|null,     // 前2000字符
    bodySize: number,
    timing: { startTime, responseTime, endTime, duration },
    initiator: string,
    resourceType: string,
    graphQLOperation: string|null,
    keysFound: [{ type, value(脱敏), location }],
    tags: string[]                // 自动标签
}
```

#### SECURITY_ALERT

```
{
    severity: "critical"|"high"|"medium"|"low",
    category: string,             // key_leak / vuln / security_header
    title: string,
    detail: string,
    requestId: string,
    url: string,
    evidence: string              // 脱敏后的证据
}
```

#### CRYPTO_EVENT

```
{
    cryptoType: string,           // CryptoJS.AES / WebCrypto.encrypt / hmac等
    algorithm: string,            // AES-CBC / HMAC-SHA256等
    operation: string,            // encrypt / decrypt / sign / hash
    inputPreview: string,         // 明文前200字符
    outputPreview: string,        // 密文前200字符
    keyPreview: string,           // 密钥前20字符(脱敏)
    ivPreview: string,
    stack: string,
    url: string
}
```

---

## 5. Phase 3: 深度知识融合

### 5.1 自动安全报告入库

NeuralPhantomBridge收到有价值的推送后，自动调用DailyNote入库：

```javascript
async onSecurityAlert(data) {
    if (data.severity === 'critical' || data.severity === 'high') {
        await DailyNote.create({
            maid: '[网站逆向知识库]Rosa',
            content: generateSecurityReport(data),
            tags: ['NP自动入库', extractDomain(data.url), data.category]
        });
    }
}
```

存储结构：

```
dailynote/
├── 网站逆向知识库/
│   ├── 2026-05-04_example.com_密钥泄露.md
│   ├── 2026-05-04_api.target.com_签名逆向.md
│   └── 2026-05-05_cdn.service.com_加密审计.md
```

### 5.2 VCPDesktop实时仪表盘

通过DESKTOP_PUSH推送NP状态挂件：

```html
<div style="padding:12px; background:rgba(10,15,30,0.85); color:#e0e6f0; border-radius:10px;">
  <h3 style="margin:0 0 8px;">Neural Phantom Live</h3>
  <div>请求: <span class="np-req-count">0</span> | 告警: <span class="np-alert-count">0</span></div>
  <div class="np-latest-alert" style="color:#ff6b6b;"></div>
</div>
```

### 5.3 知识图谱积累

每个分析过的网站，其鉴权方案/加密算法/参数来源/Cookie机制被结构化记录到RAG。Rosa在逆向时可用LightMemo搜索"这个网站之前分析过吗"。

---

## 6. 实战场景

### 6.1 场景A：API鉴权逆向

```
主人: "帮我看看这个网站怎么鉴权的"

Rosa操作链:
1. GetTraffic(tags:"auth", limit:20)
   → 返回20条带Authorization/Cookie/Token的请求
2. GetCryptoEvents()
   → 返回加密事件: HMAC-SHA256签名, key="app_secret_2024"
3. AnalyzeAuth(url:"https://api.target.com/data")
   → 返回Cookie/Header全链路溯源结果
4. SetBreakpoint(enabled:true, urlFilter:"/api/")
   → 拦截下一个API请求
5. ResumeRequest(requestId, modifiedHeaders:{X-Signature:"tampered"})
   → 修改签名后放行, 服务器返回403 → 确认签名校验
6. ReplayRequest(url, method, body)
   → 修改timestamp重放, 返回200 → 确认无时间戳过期
7. 输出完整鉴权分析报告 → DailyNote存入[网站逆向知识库]
```

### 6.2 场景B：被动安全监控

```
主人正常浏览网页

NP推送: SECURITY_ALERT { severity:"critical", category:"key_leak",
         detail:"发现OpenAI API Key: sk-proj-***" }

VCP NeuralPhantomBridge收到 → 自动:
  1. 桌面通知: "Neural Phantom安全告警：检测到OpenAI密钥泄露！"
  2. DailyNote入库: [网站逆向知识库]
  3. Rosa下次对话时RAG召回这条告警

Rosa: "主人，刚才浏览xxx.com时，NP检测到页面JS里硬编码了一个OpenAI API Key，
      这是严重安全隐患。要不要Rosa帮你分析一下这个网站的安全状况？"
```

### 6.3 场景C：视频网站逆向

```
主人: "帮我看看这个视频网站的播放链路"

Rosa操作链:
1. GetTraffic(tags:"media") → 发现M3U8请求
2. GetFullBody(requestId) → 获取完整M3U8内容
3. GetCryptoEvents() → 发现AES-128解密事件(TS切片加密)
4. GetChainState() → 获取MediaChainEngine自动推断的链路
5. InjectScript("拦截HLS的key请求并打印到console")
   → 抓到解密密钥的完整获取过程
6. GetSourceCode(url:"player.min.js") → 获取播放器源码
7. ScanSecurity() → 检查是否有其他安全问题
8. 完整链路报告:
   登录Cookie → Token接口 → 视频ID → M3U8 URL → AES Key URL → 解密播放
9. DailyNote入库[网站逆向知识库]
```

### 6.4 场景D：WebSocket协议逆向

```
主人: "这个聊天网站的WebSocket协议是什么结构"

Rosa操作链:
1. GetWsLogs(limit:50) → 获取最近50条WS帧
2. 分析帧结构: JSON格式, type/data/seq字段
3. SetWsRules([{ urlPattern:"wss://chat.target.com", field:"type", value:"heartbeat", replacement:"pong" }])
   → 自动改写心跳帧
4. SetBreakpoint(enabled:true, urlFilter:"") + WS断点
   → 拦截下一条发送帧, 修改data字段后放行
5. 输出完整WS协议文档
```

---

## 7. 安全设计

| 风险 | 防护措施 |
|------|---------|
| 恶意扩展冒充NP | 握手时验证authToken + NP版本号 + capabilities白名单 |
| 响应体数据泄露 | 推送时body只取前2000字符，完整body需主动GetFullBody |
| 密钥/Token泄露 | KeyHunter结果自动脱敏(只保留前4+后4字符) |
| NP被恶意页面攻击 | NP已有Shadow DOM隔离 + makeNative反检测 |
| WebSocket劫持 | 仅监听localhost:6005，不暴露到外部网络 |
| AI外传敏感数据 | Phase 1走VCP路由，VCP可拦截/记录/审计所有AI请求 |
| 内存溢出 | TrafficStore环形缓冲(maxSize=1000)，自动淘汰旧数据 |

---

## 8. 实施路线图

| 阶段 | 内容 | 改动文件 | 工作量 |
|------|------|---------|--------|
| **Phase 1** | AI端点指向VCP | NP background.js改4行 | 30分钟 |
| **Phase 2a** | NP端VCPConnector | NP background.js +~300行 | 3-4小时 |
| **Phase 2b** | VCP端Bridge插件(L1+L2) | 新建插件 ~600行 | 4-5小时 |
| **Phase 2c** | VCP端Bridge插件(L3) | 补充9个指令 ~200行 | 2小时 |
| **Phase 3a** | 自动安全报告入库 | Bridge增加DailyNote集成 | 2小时 |
| **Phase 3b** | VCPDesktop仪表盘 | Bridge增加Desktop推送 | 1小时 |
| **Phase 3c** | 知识图谱积累 | 使用中自然积累 | 持续 |

### 实施优先级

```
Phase 1 (30min) → 立即可做，零风险
    ↓
Phase 2a (NP端) → Phase 2b (VCP端L1+L2) → 覆盖95%场景
    ↓
Phase 2c (L3管理) → 锦上添花
    ↓
Phase 3 → 长期价值
```

---

## 9. 附录：NP能力全景

### 9.1 background.js msg.action完整清单

#### 网络数据类
- GET_LOGS — 获取全局网络日志
- CLEAR_LOGS — 清空日志+缓存
- FETCH_BODY — 获取响应体
- GET_WS_LOGS — WebSocket帧日志
- GET_PERF_STATS — 性能统计
- GET_TRAFFIC_TIMELINE — 实时流量时间线

#### 安全扫描类
- SCAN_SECURITY_HEADERS — 安全头评分
- SCAN_VULNS — 漏洞正则扫描
- EXTRACT_ENDPOINTS — 端点提取
- MINE_PARAMS — 参数挖掘

#### 参数/鉴权分析类
- PARAM_TRACE_EVENT — 接收参数追踪事件
- ANALYZE_PARAM_SOURCE — 参数来源分析
- GET_PARAM_TRACES — 获取参数追踪记录
- ANALYZE_REQUEST_AUTH — 鉴权头/Cookie溯源
- SEARCH_TRACER — 全文流量搜索

#### HAR类
- HAR_START / HAR_STOP / HAR_EXPORT / HAR_IMPORT / HAR_REPLAY

#### 链路追踪类
- CHAIN_PUSH_EVENT / CHAIN_GET_STATE / CHAIN_RESET_WINDOW / CHAIN_RESET_SESSION / CHAIN_CLEAR_ALL / CHAIN_OPEN_WINDOW

#### Header/规则类
- UPDATE_HEADER_RULES — 动态请求头规则(DNR)

#### AI类
- ANALYZE_WITH_AI / AI_FUZZ / GET_AI_MODELS / CHECK_AI_BALANCE

#### 管理控制类
- GET_PREHOOK_STATUS / SET_PREHOOK — 预挂钩控制
- GET_ATTACHED_TABS — 已attach tab
- GET_EARLY_REQUESTS — 早期请求
- ENTER_URL_IN_TAB / CONSOLE_ENTER_URL — URL导航
- OPEN_CONSOLE_WINDOW — 打开控制台
- GET_CONSOLE_STATS — 控制台统计
- EXPORT_CONFIG / IMPORT_CONFIG — 配置管理

#### Schema/告警类
- GET_SCHEMA_SNAPSHOTS / DELETE_SCHEMA_SNAPSHOT / FORCE_SNAPSHOT
- GET_ALERT_RULES / SAVE_ALERT_RULES

#### 函数追踪类
- FUNC_TRACE_PUSH / GET_FUNC_TRACES / GET_FRAME_HOTSPOTS

#### Cookie类
- FETCH_COOKIES

#### 源码类
- GET_SOURCE_BY_URL

#### 媒体类
- GET_RECENT_MEDIA_REQUESTS

#### 会话类
- GET_SESSION_INFO / RESET_VIDEO_SESSION

#### 收藏类
- TOGGLE_STAR / GET_STARRED

### 9.2 page-script.js postMessage类型清单

#### 上报事件（NP→inject.js）
- CRYPTO_REPORT — 加密/哈希/签名操作
- SIGN_FIELD_FOUND — 签名字段发现
- PARAM_TRACE — 参数追踪
- FUNC_TRACE — 函数调用追踪
- TRACE_FUNCTION_RESULT — 函数追踪结果
- DECRYPT_FOUND — 解密操作发现
- PARAM_CRYPTO_FOUND — 参数加密检测
- COOKIE_CHANGED — Cookie变化
- STORAGE_EVENT — Storage写入
- STORAGE_DUMP_RESULT — Storage导出结果
- WS_HOOK_CREATED / WS_HOOK_SENT / WS_HOOK_RECV / WS_HOOK_MODIFIED — WS帧事件
- WS_FRAME_PAUSED — WS帧暂停
- REQUEST_PAUSED_INTERNAL — 请求断点暂停
- AUDIO_TRACK / TEXT_TRACK / IMAGE_TRACK / DECRYPT_KEY_TRACK — 链路追踪

#### 控制指令（inject.js→NP）
- UPDATE_MOCK_RULES — 更新Mock规则
- UPDATE_DYNAMIC_SCRIPT — 更新动态响应脚本
- UPDATE_LOCAL_FILE_RULES — 更新本地文件替换规则
- TOGGLE_BREAKPOINT — 断点开关
- RESUME_REQUEST / ABORT_REQUEST — 请求放行/丢弃
- ADD_REDIRECT_RULE — URL重定向规则
- REPLAY_REQUEST — 重放请求
- DUMP_STORAGE — 导出Storage
- UPDATE_WS_RULES — WebSocket改写规则
- TRACE_FUNCTION — 追踪函数
- WS_FRAME_RESUME / WS_FRAME_ABORT — WS帧放行/丢弃

### 9.3 六层Debugger预挂钩

```
1. Service Worker启动 → scanAndAttachAllTabs()
2. chrome.alarms 每21秒 → 重新扫描attach
3. webNavigation.onBeforeNavigate → 导航前attach
4. tabs.onCreated → 新tab创建时attach
5. tabs.onUpdated → tab loading时attach
6. webRequest.onBeforeRequest → 兜底记录早期请求
```

---

> **文档版本历史**
> - v0.1 (2026-05-04): 初始版本，包含完整三层方案 + 40指令体系 + 实战场景