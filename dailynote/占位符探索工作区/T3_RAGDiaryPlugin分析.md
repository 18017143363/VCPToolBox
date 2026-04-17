# T3 - RAGDiaryPlugin.js 占位符解析分析

**说明：本文档中 {*2 = {{，}*2 = }}，[*2 = [[，]*2 = ]]，<*2 = <<，>*2 = >>，《*2 = 《《，》*2 = 》》**

## 📋 文件信息

| 项目 | 值 |
|------|-----|
| 文件路径 | E:\VCP\Plugin\RAGDiaryPlugin\RAGDiaryPlugin.js |
| 文件大小 | 110.55 KB |
| 分析时间 | 2026-02-06 23:20 |
| 分析人 | Rosa |

---

## 🏗️ 模块架构

RAGDiaryPlugin是VCP记忆系统的核心插件，类型为 `messagePreprocessor`（消息预处理器）。

### 子模块依赖

```
RAGDiaryPlugin (110KB) ─── 主入口
├── TimeExpressionParser ─── 时间表达式解析
├── MetaThinkingManager ─── 元思考链管理
├── SemanticGroupManager ─── 语义组管理
├── ContextVectorManager ─── 上下文向量管理
└── AIMemoHandler ─── AI记忆处理器
```

---

## 🔍 四种日记调用语法的正则表达式

### 核心正则定义位置

在 `_processSingleSystemMessage()` 函数中（约第650行）：

```javascript
const ragDeclarations = [...processedContent.matchAll(/\[\[(.*?)日记本(.*?)\]\]/g)];
const fullTextDeclarations = [...processedContent.matchAll(/<<(.*?)日记本>>/g)];
const hybridDeclarations = [...processedContent.matchAll(/《《(.*?)日记本(.*?)》》/g)];
const metaThinkingDeclarations = [...processedContent.matchAll(/\[\[VCP元思考(.*?)\]\]/g)];
```

### 四种语法详解

| 语法 | 正则 | 模式名称 | 功能 |
|------|------|----------|------|
| `[*2xxx日记本...]*2` | `/\[\[(.*?)日记本(.*?)\]\]/g` | RAG模式 | 语义检索，支持修饰符 |
| `<*2xxx日记本>*2` | `/<<(.*?)日记本>>/g` | 全文模式 | 阈值判断后全文注入 |
| `《*2xxx日记本...》*2` | `/《《(.*?)日记本(.*?)》》/g` | 混合模式 | 阈值判断+RAG检索 |
| `[*2VCP元思考...]*2` | `/\[\[VCP元思考(.*?)\]\]/g` | 元思考链 | 思维链注入 |

### 正则捕获组说明

| 语法 | 捕获组1 | 捕获组2 |
|------|---------|---------|
| `[*2xxx日记本:1.5::Time]*2` | `xxx` (日记本名) | `:1.5::Time` (修饰符) |
| `<*2xxx日记本>*2` | `xxx` (日记本名) | 无 |
| `《*2xxx日记本::TagMemo》*2` | `xxx` (日记本名) | `::TagMemo` (修饰符) |

---

## 🔧 修饰符解析机制

### 修饰符提取正则

在 `_extractKMultiplier()` 函数中：
```javascript
const kMultiplierMatch = modifiers.match(/:(\\d+\\.?\\d*)/);
```

在 `_processRAGPlaceholder()` 函数中：
```javascript
const tagMemoMatch = modifiers.match(/::TagMemo([\\d.]+)/);
```

### 支持的修饰符列表

| 修饰符 | 检测方式 | 功能 |
|--------|----------|------|
| `:K乘数` | `modifiers.match(/:(\\d+\\.?\\d*)/)` | 动态调整检索数量 |
| `::Time` | `modifiers.includes('::Time')` | 时间感知检索 |
| `::Group` | `modifiers.includes('::Group')` | 语义组增强 |
| `::Rerank` | `modifiers.includes('::Rerank')` | 精排重排序 |
| `::TagMemo` | `modifiers.includes('::TagMemo')` | Tag记忆增强 |
| `::TagMemoN` | `modifiers.match(/::TagMemo([\\d.]+)/)` | 指定Tag权重 |
| `::AIMemo` | `modifiers.includes('::AIMemo')` | AI驱动记忆召回 |

### AIMemo许可证机制

```javascript
// 全局开关检测
if (m.content.includes('[[AIMemo=True]]')) {
    isAIMemoLicensed = true;
}

// 只有许可证存在时，::AIMemo才生效
const shouldUseAIMemo = isAIMemoLicensed && modifiers.includes('::AIMemo');
```

---

## 📍 解析时机与角色范围

### 触发条件

在 `processMessages()` 函数中（约第480行）：

```javascript
const targetSystemMessageIndices = messages.reduce((acc, m, index) => {
    if (m.role === 'system' && typeof m.content === 'string') {
        // 检查全局 AIMemo 开关
        if (m.content.includes('[[AIMemo=True]]')) {
            isAIMemoLicensed = true;
        }
        // 检查 RAG/Meta/AIMemo 占位符
        if (/\[\[.*日记本.*\]\]|<<.*日记本.*>>|《《.*日记本.*》》|\[\[VCP元思考.*\]\]|\[\[AIMemo=True\]\]/.test(m.content)) {
            if (!acc.includes(index)) {
                acc.push(index);
            }
        }
    }
    return acc;
}, []);
```

### 角色限制

| 占位符类型 | 角色限制 | 说明 |
|------------|----------|------|
| `[*2...日记本...]*2` | **仅 system** | 只在system消息中解析 |
| `<*2...日记本>*2` | **仅 system** | 只在system消息中解析 |
| `《*2...日记本...》*2` | **仅 system** | 只在system消息中解析 |
| `[*2VCP元思考...]*2` | **仅 system** | 只在system消息中解析 |
| `[*2AIMemo=True]*2` | **仅 system** | 只在system消息中检测 |

**⭐ 重要结论：RAGDiaryPlugin的所有占位符都只在system角色中解析！**

---

## 🔄 循环引用防护机制

### 全局去重Set

```javascript
const globalProcessedDiaries = new Set(); // 在最外层维护一个 Set

// 在处理每个占位符时检查
if (processedDiaries.has(dbName)) {
    console.warn(`[RAGDiaryPlugin] Detected circular reference to "${dbName}" in [[...]]. Skipping.`);
    processingPromises.push(Promise.resolve({ 
        placeholder, 
        content: `[检测到循环引用，已跳过"${dbName}日记本"的解析]` 
    }));
    continue;
}
processedDiaries.add(dbName);
```

### 内容净化（防止二次解析）

```javascript
const safeContent = diaryContent
    .replace(/\[\[.*日记本.*\]\]/g, '[循环占位符已移除]')
    .replace(/<<.*日记本>>/g, '[循环占位符已移除]')
    .replace(/《《.*日记本.*》》/g, '[循环占位符已移除]');
```

---

## 📦 RAG区块标记机制

### 区块格式

RAGDiaryPlugin会将检索结果包装在特殊的HTML注释中：

```javascript
const metadataString = JSON.stringify(metadata).replace(/-->/g, '--\\>');
return `<!-- VCP_RAG_BLOCK_START ${metadataString} -->${innerContent}<!-- VCP_RAG_BLOCK_END -->`;
```

### 元数据结构

```javascript
const metadata = {
    dbName: dbName,      // 日记本名称
    modifiers: modifiers, // 修饰符字符串
    k: finalK            // 检索数量
};
```

### 刷新机制

`refreshRagBlock()` 函数用于在VCP循环中刷新RAG区块：

```javascript
async refreshRagBlock(metadata, contextData, originalUserQuery) {
    // 使用新的上下文重新检索
    // 返回完整的、带有新元数据的新区块文本
}
```

**⚠️ 关键发现**：这个刷新机制由 `chatCompletionHandler.js` 调用，在工具调用后会刷新RAG区块！

---

## ⚠️ 递归解析风险分析

### 日记内容中的占位符会被解析吗？

**答案：不会！**

原因：
1. RAGDiaryPlugin只处理system角色的消息
2. 日记内容被注入到system消息后，**不会再次调用processMessages()**
3. 日记内容中的占位符会被 `safeContent` 替换机制移除

### 与messageProcessor的交互

**关键问题**：RAG检索结果注入后，会被messageProcessor二次解析吗？

**分析**：
1. RAGDiaryPlugin是 `messagePreprocessor` 类型
2. 它在 `messageProcessor.resolveAllVariables()` **之前**执行
3. 所以RAG注入的内容**会被messageProcessor处理**！

**但是**：
- messageProcessor的大部分占位符也只在system角色生效
- RAG注入的内容在system消息中
- 所以如果日记中包含 `{*2AgentName}*2`（英文），**理论上会被解析**！

### 安全措施

1. **循环引用检测**：`globalProcessedDiaries` Set防止同一日记本被多次解析
2. **内容净化**：日记内容中的RAG占位符会被替换为 `[循环占位符已移除]`
3. **角色限制**：只处理system角色

---

## 🔒 安全书写建议

### 在日记中安全的格式

| 格式 | 安全性 | 原因 |
|------|--------|------|
| `{*2xxx表情包}*2` | ✅ 安全 | 会被messageProcessor解析，但这是预期行为 |
| `{*2xxx日记本}*2` | ⚠️ 会被净化 | RAGDiaryPlugin会替换为 `[循环占位符已移除]` |
| `[*2xxx日记本]*2` | ⚠️ 会被净化 | 同上 |
| `{*2英文Agent名}*2` | ⚠️ 可能被解析 | messageProcessor会解析英文Agent占位符 |
| `{*2中文Agent名}*2` | ✅ 安全 | messageProcessor的正则不匹配中文 |

### 推荐的转义方式

1. **使用 *2 替代**：`{*2` 代替 `{{`
2. **插入零宽字符**：`{​{` (中间有零宽空格)
3. **使用代码块**：需要验证是否有效

---

## 📊 与T2发现的对比

| 发现 | messageProcessor (T2) | RAGDiaryPlugin (T3) |
|------|------------------------|---------------------|
| 角色限制 | 大部分仅system | **全部仅system** |
| 循环检测 | Agent占位符有 | 日记本占位符有 |
| 内容净化 | 无 | 有（替换为提示文本）|
| 递归风险 | Agent/SarPrompt/Tar有 | 无（内容被净化）|

---

## ✅ 检查点

[CP-T3] 2026-02-06 23:20 | T3 | 🟢 完成 | RAGDiaryPlugin分析完成，发现4种日记调用语法，确认全部仅在system角色解析，有完善的循环引用防护