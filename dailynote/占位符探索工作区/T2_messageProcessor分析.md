# T2 - messageProcessor.js 占位符解析分析

**说明：本文档中 {*2 = {{，}*2 = }}，[*2 = [[，]*2 = ]]**

## 📋 文件信息

| 项目 | 值 |
|------|-----|
| 文件路径 | E:\VCP\modules\messageProcessor.js |
| 文件大小 | 16.24 KB |
| 分析时间 | 2026-02-06 22:35 |
| 分析人 | Rosa |

---

## 🏗️ 模块架构

### 核心函数调用链

```
resolveAllVariables() ← 主入口，对外导出为 replaceAgentVariables
│
├── 1. Agent占位符处理（递归）
│   └── 正则: /\{*2([a-zA-Z0-9_:]+)}*2/g
│   └── 递归调用自身解析Agent内容中的嵌套占位符
│   └── 循环依赖检测（processingStack）
│
├── 2. replacePriorityVariables() ← 优先处理
│   ├── 表情包: /\{*2([^{}]+?表情包)}*2/g
│   └── 日记本: /\{*2([^{}]+?)日记本}*2/g
│
└── 3. replaceOtherVariables() ← 其他变量
    ├── SarPrompt预设
    ├── Tar/Var环境变量
    ├── 时间变量 (Date/Time/Today/Festival)
    ├── 静态插件占位符
    ├── 插件描述占位符
    ├── VCPAllTools
    ├── Port/Image_Key
    ├── Detectors规则替换
    ├── SuperDetectors规则替换
    └── 异步结果占位符
```

---

## 🔍 正则表达式完整清单

### 1. Agent占位符（resolveAllVariables）

| 属性 | 值 |
|------|-----|
| **正则** | `/\{*2([a-zA-Z0-9_:]+)}*2/g` |
| **匹配示例** | `{*2Rosa}*2`, `{*2agent:Rosa}*2` |
| **不匹配** | `{*2小雨}*2`（中文不匹配！） |
| **角色限制** | **无限制**（所有角色都会处理） |
| **递归风险** | ⚠️ **有**（会递归解析Agent内容） |
| **循环检测** | ✅ 有（processingStack防止循环引用） |

**关键代码**：
```javascript
const placeholderRegex = /\{*2([a-zA-Z0-9_:]+)}*2/g;
// 注意：只匹配英文、数字、下划线、冒号
// 中文Agent名不会被这个正则匹配！
```

**⚠️ 重要发现**：
- Agent占位符正则**不支持中文**！
- 这意味着 `{*2Rosa}*2` 会被解析，但 `{*2小雨}*2` 不会
- 这是一个**安全特性**，避免中文内容被误解析

---

### 2. 表情包占位符（replacePriorityVariables）

| 属性 | 值 |
|------|-----|
| **正则** | `/\{*2([^{}]+?表情包)}*2/g` |
| **匹配示例** | `{*2Rosa表情包}*2`, `{*2通用表情包}*2` |
| **角色限制** | **仅 system** |
| **递归风险** | ❌ 无 |

**关键代码**：
```javascript
if (role !== 'system') {
    return processedText; // 非system角色直接返回
}
const emojiPlaceholderRegex = /\{*2([^{}]+?表情包)}*2/g;
```

**安全分析**：
- `[^{}]+?` 匹配任意非大括号字符（包括中文）
- 必须以"表情包"三个字结尾
- **只在system角色生效**，user/assistant消息中不会被解析

---

### 3. 日记本占位符（replacePriorityVariables）

| 属性 | 值 |
|------|-----|
| **正则** | `/\{*2([^{}]+?)日记本}*2/g` |
| **匹配示例** | `{*2Rosa日记本}*2`, `{*2小雨日记本}*2` |
| **角色限制** | **仅 system** |
| **递归风险** | ❌ 无（已修复循环风险） |

**关键代码**：
```javascript
// Step 1: Find all unique diary placeholders in the original text to avoid loops.
const matches = [...processedText.matchAll(diaryPlaceholderRegex)];
const uniquePlaceholders = [...new Set(matches.map(match => match[0]))];
```

**安全分析**：
- 代码注释明确提到"已修复循环风险"
- 使用预先收集所有占位符的方式，避免替换后重新扫描
- **只在system角色生效**

---

### 4. SarPrompt预设占位符（replaceOtherVariables）

| 属性 | 值 |
|------|-----|
| **正则** | `/\{*2(SarPrompt\d+)}*2/g` |
| **匹配示例** | `{*2SarPrompt1}*2`, `{*2SarPrompt4}*2` |
| **角色限制** | **system** 或 **特殊user**（以"[系统"开头） |
| **递归风险** | ⚠️ 有（如果值是.txt文件，会递归解析） |

**关键代码**：
```javascript
if (role === 'system' || (role === 'user' && processedText.startsWith('[系统'))) {
    const sarPlaceholderRegex = /\{*2(SarPrompt\d+)}*2/g;
    // ...
    if (typeof promptValue === 'string' && promptValue.toLowerCase().endsWith('.txt')) {
        // 递归解析文件内容
        promptValue = await replaceOtherVariables(fileContent, model, role, context);
    }
}
```

---

### 5. 时间变量占位符（replaceOtherVariables）

| 占位符 | 正则 | 角色限制 |
|--------|------|----------|
| `{*2Date}*2` | `/\{*2Date}*2/g` | system |
| `{*2Time}*2` | `/\{*2Time}*2/g` | system |
| `{*2Today}*2` | `/\{*2Today}*2/g` | system |
| `{*2Festival}*2` | `/\{*2Festival}*2/g` | system |

**安全分析**：
- 固定字符串匹配，无通配符
- **只在system角色生效**
- 无递归风险

---

### 6. Tar/Var环境变量占位符（replaceOtherVariables）

| 属性 | 值 |
|------|-----|
| **匹配方式** | 遍历process.env中以Tar/Var开头的键 |
| **匹配示例** | `{*2TarXxx}*2`, `{*2VarYyy}*2` |
| **角色限制** | **仅 system** |
| **递归风险** | ⚠️ 有（如果值是.txt文件，会递归解析） |

**关键代码**：
```javascript
if (role === 'system') {
    for (const envKey in process.env) {
        if (envKey.startsWith('Tar') || envKey.startsWith('Var')) {
            // ...
            if (value.toLowerCase().endsWith('.txt')) {
                const resolvedContent = await replaceOtherVariables(fileContent, model, role, context);
            }
        }
    }
}
```

---

### 7. 异步结果占位符（replaceOtherVariables）

| 属性 | 值 |
|------|-----|
| **正则** | `/\{*2VCP_ASYNC_RESULT::([a-zA-Z0-9_.-]+)::([a-zA-Z0-9_-]+)}*2/g` |
| **匹配示例** | `{*2VCP_ASYNC_RESULT::PluginName::RequestId}*2` |
| **角色限制** | **无限制** |
| **递归风险** | ❌ 无 |

**⚠️ 重要发现**：
- 这是**唯一一个不受角色限制**的非Agent占位符
- 在所有消息角色中都会被解析
- 但格式非常特殊，误触发风险低

---

### 8. 其他固定占位符（replaceOtherVariables）

| 占位符 | 角色限制 | 说明 |
|--------|----------|------|
| `{*2VCPAllTools}*2` | system | 所有工具描述 |
| `{*2Port}*2` | system | 服务器端口 |
| `{*2Image_Key}*2` | system | 图片访问密钥 |
| 静态插件占位符 | system | 由pluginManager提供 |
| 插件描述占位符 | system | 由pluginManager提供 |

---

### 9. Detectors规则替换（replaceOtherVariables）

| 类型 | 角色限制 | 说明 |
|------|----------|------|
| detectors | system | 普通检测器规则 |
| superDetectors | **无限制** | 超级检测器规则 |

**⚠️ 重要发现**：
- `superDetectors` 不受角色限制，在所有消息中生效
- 这是一个**潜在的误触发风险点**

---

## 📊 角色限制汇总表

| 占位符类型 | system | user | assistant | 备注 |
|------------|--------|------|-----------|------|
| Agent占位符 | ✅ | ✅ | ✅ | 但只匹配英文 |
| 表情包 | ✅ | ❌ | ❌ | |
| 日记本 | ✅ | ❌ | ❌ | |
| SarPrompt | ✅ | ⚠️ | ❌ | user需以"[系统"开头 |
| 时间变量 | ✅ | ❌ | ❌ | |
| Tar/Var | ✅ | ❌ | ❌ | |
| 异步结果 | ✅ | ✅ | ✅ | 格式特殊，风险低 |
| Port/Image_Key | ✅ | ❌ | ❌ | |
| VCPAllTools | ✅ | ❌ | ❌ | |
| detectors | ✅ | ❌ | ❌ | |
| superDetectors | ✅ | ✅ | ✅ | ⚠️ 风险点 |

---

## ⚠️ 递归解析风险分析

### 存在递归的场景

1. **Agent占位符**
   - Agent内容会再次调用 `resolveAllVariables()`
   - 有循环检测机制（processingStack）
   - 风险等级：🟡 中（有保护）

2. **SarPrompt（.txt文件）**
   - 文件内容会调用 `replaceOtherVariables()`
   - 无循环检测
   - 风险等级：🟡 中

3. **Tar/Var（.txt文件）**
   - 文件内容会调用 `replaceOtherVariables()`
   - 无循环检测
   - 风险等级：🟡 中

### 不存在递归的场景

- 表情包、日记本、时间变量、异步结果等
- 这些占位符替换后不会再次扫描

---

## 🔒 安全书写建议（初步）

基于本模块分析，以下是初步的安全书写建议：

### 1. 在assistant消息中安全的占位符格式

由于大部分占位符只在system角色生效，assistant消息中以下格式是**相对安全**的：
- `{*2xxx表情包}*2` - 不会被解析（非system）
- `{*2xxx日记本}*2` - 不会被解析（非system）
- `{*2Date}*2` 等时间变量 - 不会被解析（非system）

### 2. 在assistant消息中有风险的格式

- `{*2英文Agent名}*2` - **会被解析**（无角色限制）
- `{*2VCP_ASYNC_RESULT::...}*2` - **会被解析**（无角色限制）
- superDetectors定义的任何模式 - **会被解析**

### 3. 通用安全措施

- 使用 `*2` 替代 `{` 来书写示例
- 或在占位符中间插入零宽字符
- 或使用代码块包裹（需验证是否有效）

---

## 📝 待验证问题

1. 代码块（```）中的占位符是否会被解析？
2. superDetectors的具体规则有哪些？
3. 静态插件占位符的完整列表是什么？
4. 其他模块（如RAGDiaryPlugin）是否有额外的解析逻辑？

---

## ✅ 检查点

[CP-T2] 2026-02-06 22:35 | T2 | 🟢 完成 | messageProcessor.js分析完成，发现9类占位符正则，识别出3个无角色限制的风险点