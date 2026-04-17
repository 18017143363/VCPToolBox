## 2026-02-09T22:58:30+08:00
（说明：本文中 {*2 = {{，}*2 = }}，用于避免误触发）

### HeartbeatSystem 模板占位符来源
- HeartbeatSystem 使用自定义模板占位符：{agentName}/{time}/{timeSlot}/{planningContext}
- 规定位置：
  - E:\VCP\Plugin\HeartbeatSystem\heartbeat_prompt.txt
  - E:\VCP\Plugin\HeartbeatSystem\HeartbeatSystem.js
    - DEFAULT_PROMPT_TEMPLATE
    - generatePrompt() 正则替换逻辑

### 系统 {*2...}*2（即{{}}）占位符能否在心跳 prompt 中注入？
- HeartbeatSystem 不解析 {*2...}*2。
- 当前实现把 prompt 写入 VCPTimedContacts 的 tool_call.arguments.prompt；该“工具执行链路”通常不经过 messageProcessor，因此 {*2Date}*2/{*2Festival}*2 等不会自动展开。
- 若要支持：
  1) 插件侧显式调用 messageProcessor（并处理静态占位符、detectors 等依赖）；或
  2) 把该 prompt 以 system 消息形式走一次 chatCompletionHandler 的完整预处理链。

### VCP 注入/预处理顺序（概括）
- VCPTavern（system 内 {*2VCPTavern::preset}*2 注入预设）
- messageProcessor（解析系统 {*2...}*2 占位符体系，含角色限制）
- RAGDiaryPlugin（日记注入）
- roleDivider(可选) + 上游模型请求 + vcpLoop 工具循环
- 响应末尾：chatCompletionHandler 刷新 RAG 区块## 2026-02-09 - 如何修改 HeartbeatSystem 的 { } 占位符（开发口径）
（说明：本文中 {*2 = {{，}*2 = }}，用于避免误触发）

### 两层结构
- 模板层：E:\VCP\Plugin\HeartbeatSystem\heartbeat_prompt.txt 决定 prompt 结构与出现哪些 {key}
- 代码层：E:\VCP\Plugin\HeartbeatSystem\HeartbeatSystem.js 决定哪些 {key} 会被替换、各自的值如何计算

### 关键定位点
- readPromptTemplate()：读取 heartbeat_prompt.txt（或回退 DEFAULT_PROMPT_TEMPLATE）
- generatePrompt(template, agentName, extra)
  - 固定替换：{agentName}/{time}
  - extra 替换：{timeSlot}/{planningContext}（以及未来新增的其它 key）
- triggerHeartbeat(agentName)
  - 决定 timeSlot/planningContext 的内容（plannedSlots 分支）
- HB_CONFIG.timeSlots
  - 决定时段名称与边界（凌晨/上午/下午/晚上）

### 新增占位符规范
- 在模板中新增 {newKey}
- 在 triggerHeartbeat 生成 prompt 时，把 newKey 加入 extra
- 未提供值的 {xxx} 将原样保留（便于发现遗漏）