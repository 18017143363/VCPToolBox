# T4 - VCPTavern.js 占位符解析分析

**说明：本文档中 {*2 = {{，}*2 = }}，[*2 = [[，]*2 = ]]**

## 📋 文件信息

| 项目 | 值 |
|------|-----|
| 文件路径 | E:\VCP\Plugin\VCPTavern\VCPTavern.js |
| 文件大小 | 10.32 KB |
| 插件类型 | messagePreprocessor + service (混合型) |
| 分析时间 | 2026-02-06 23:35 |
| 分析人 | Rosa |

---

## 🏗️ 模块架构

VCPTavern是一个**混合型插件**，同时具备两种能力：
1. **messagePreprocessor**：预处理消息，注入预设内容
2. **service**：提供HTTP API管理预设

### 核心类结构

```javascript
class VCPTavern {
    constructor() {
        this.presets = new Map();  // 预设缓存
        this.debugMode = false;
    }
    
    // messagePreprocessor 核心方法
    async processMessages(messages, config) { ... }
    
    // service 核心方法
    registerRoutes(app, adminApiRouter, config, projectBasePath) { ... }
}
```

---

## 🔍 触发器正则表达式

### 核心正则

```javascript
const triggerRegex = /\{*2VCPTavern::(.+?)}*2/;
```

| 属性 | 值 |
|------|-----|
| **正则** | `/\{*2VCPTavern::(.+?)}*2/` |
| **匹配示例** | `{*2VCPTavern::rosa}*2`, `{*2VCPTavern::dailychat}*2` |
| **捕获组** | `(.+?)` 捕获预设名称 |
| **角色限制** | **仅 system** |
| **匹配次数** | 只匹配第一个（非全局正则） |

### 检测逻辑

```javascript
const systemMessage = messages.find(m => m.role === 'system');
if (!systemMessage || typeof systemMessage.content !== 'string') {
    return messages;  // 没有system消息则直接返回
}

const match = systemMessage.content.match(triggerRegex);
if (!match) {
    return messages;  // 没有触发器则直接返回
}
```

**⭐ 重要结论**：
1. VCPTavern**只检测system角色**的消息
2. 只匹配**第一个**触发器（非全局正则）
3. 匹配后会**移除触发器文本**

---

## 📦 预设注入机制

### 注入时机

VCPTavern作为 `messagePreprocessor`，在请求处理流程中的位置：

```
用户请求到达VCP
    ↓
chatCompletionHandler.js 接收
    ↓
⭐ VCPTavern.processMessages() ← 在这里执行！
    ↓
其他 messagePreprocessor
    ↓
messageProcessor.resolveAllVariables() ← 占位符解析
    ↓
转发到上游AI
```

**关键发现**：VCPTavern在messageProcessor**之前**执行！

这意味着：**预设中的占位符会被messageProcessor解析！**

### 三种注入规则类型

| 类型 | 说明 | 处理顺序 |
|------|------|----------|
| **embed** | 嵌入注入，直接修改现有消息内容 | 第1步 |
| **relative** | 相对注入，在指定位置插入新消息 | 第2步 |
| **depth** | 深度注入，按消息深度插入 | 第3步 |

### 1. embed（嵌入注入）

```javascript
const embedRules = preset.rules.filter(r => r.enabled && r.type === 'embed');

// 支持的 target
- 'system': 修改system消息内容
- 'last_user': 修改最后一条user消息内容

// 支持的 position
- 'before': 在原内容之前插入
- 'after': 在原内容之后插入
```

### 2. relative（相对注入）

```javascript
const relativeRules = preset.rules.filter(r => r.enabled && r.type === 'relative')
    .sort((a, b) => (a.position === 'before' ? -1 : 1));

// 支持的 target
- 'system': 在system消息前后插入新消息
- 'last_user': 在最后一条user消息前后插入新消息

// 支持的 position
- 'before': 在目标消息之前插入
- 'after': 在目标消息之后插入
```

### 3. depth（深度注入）

```javascript
const depthRules = preset.rules.filter(r => r.enabled && r.type === 'depth')
    .sort((a, b) => b.depth - a.depth);

// depth值说明
- depth=1: 在倒数第1条消息之前插入
- depth=2: 在倒数第2条消息之前插入
- 如果depth超过消息数量，则插入到system之后
```

---

## ⚠️ 递归解析风险分析

### 预设中的占位符会被解析吗？

**答案：会！**

原因分析：
1. VCPTavern在messageProcessor**之前**执行
2. 预设内容被注入到messages中
3. 然后messageProcessor会处理整个messages
4. 所以预设中的 `{*2xxx}*2` 格式占位符**会被解析**

### 这是Bug还是Feature？

**这是Feature！** 这正是VCPTavern的设计意图：

```
预设JSON中写：{*2Rosa日记本}*2
    ↓
VCPTavern注入到system消息
    ↓
messageProcessor解析 → 替换为日记内容
    ↓
AI收到完整的角色设定+记忆
```

### 循环引用风险

**问题**：如果预设中包含 `{*2VCPTavern::xxx}*2` 会怎样？

**答案**：不会循环！

原因：
1. VCPTavern只执行一次（messagePreprocessor只调用一次）
2. 注入后的内容不会再次经过VCPTavern
3. 即使预设中有触发器，也不会被VCPTavern解析

### 与messageProcessor的交互

| 预设中的内容 | 是否会被解析 | 解析者 |
|--------------|--------------|--------|
| `{*2Rosa}*2` | ✅ 会（如果是英文Agent名）| messageProcessor |
| `{*2Rosa日记本}*2` | ✅ 会 | messageProcessor |
| `{*2Date}*2` | ✅ 会 | messageProcessor |
| `{*2VCPTavern::xxx}*2` | ❌ 不会 | VCPTavern已执行完毕 |
| `[*2xxx日记本]*2` | ✅ 会 | RAGDiaryPlugin |

---

## 🔒 安全书写建议

### 在预设JSON中安全的格式

由于预设内容会被后续处理器解析，以下情况需要注意：

| 格式 | 安全性 | 说明 |
|------|--------|------|
| `{*2Rosa日记本}*2` | ⚠️ 会被解析 | 这是预期行为，用于注入记忆 |
| `{*2Date}*2` | ⚠️ 会被解析 | 这是预期行为，用于注入时间 |
| `{*2英文Agent名}*2` | ⚠️ 会被解析 | 可能导致Agent提示词嵌套 |
| 占位符示例文本 | ⚠️ 危险 | 需要用 *2 替代 |

### 在预设中写占位符示例的安全方法

如果需要在预设中**展示**占位符语法（而非触发），应该：

1. **使用 *2 替代**：`{*2` 代替 `{{`
2. **使用零宽字符**：`{​{` (中间有零宽空格)
3. **使用代码块**：需要验证是否有效

---

## 📊 与T2/T3发现的对比

| 模块 | 角色限制 | 执行顺序 | 递归风险 |
|------|----------|----------|----------|
| VCPTavern (T4) | 仅system | 第1步 | 无（只执行一次）|
| RAGDiaryPlugin (T3) | 仅system | 第2步 | 有保护机制 |
| messageProcessor (T2) | 大部分仅system | 第3步 | Agent/SarPrompt有 |

### 执行顺序确认

```
1. VCPTavern.processMessages()     ← 预设注入
2. RAGDiaryPlugin.processMessages() ← RAG检索注入
3. messageProcessor.resolveAllVariables() ← 占位符解析
```

这个顺序意味着：
- VCPTavern注入的内容会被RAGDiaryPlugin和messageProcessor处理
- RAGDiaryPlugin注入的内容会被messageProcessor处理
- messageProcessor是最后一道处理

---

## 🔌 API路由

VCPTavern同时提供HTTP API用于管理预设：

| 方法 | 端点 | 功能 |
|------|------|------|
| GET | /vcptavern/presets | 获取所有预设名称 |
| GET | /vcptavern/presets/:name | 获取预设详情 |
| POST | /vcptavern/presets/:name | 保存/更新预设 |
| DELETE | /vcptavern/presets/:name | 删除预设 |

---

## ✅ 检查点

[CP-T4] 2026-02-06 23:35 | T4 | 🟢 完成 | VCPTavern分析完成，确认触发器仅在system角色检测，预设内容会被后续处理器解析，无循环引用风险