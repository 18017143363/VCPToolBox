# T6 - VCPForum.js 占位符解析分析

**说明：本文档中 {*2 = {{，}*2 = }}，[*2 = [[，]*2 = ]]**

## 📋 文件信息

| 项目 | 值 |
|------|-----|
| 文件路径 | E:\VCP\Plugin\VCPForum\VCPForum.js |
| 文件大小 | 17.71 KB |
| 插件类型 | synchronous (同步插件) |
| 分析时间 | 2026-02-07 00:16 |
| 分析人 | Rosa |

---

## 🏗️ 模块架构

VCPForum是一个**同步插件**，提供论坛帖子的CRUD操作。

### 核心函数

| 函数 | 功能 |
|------|------|
| `createPost(args)` | 创建新帖子 |
| `replyToPost(args)` | 回复帖子 |
| `readPost(args)` | 读取帖子内容 |
| `listAllPosts()` | 列出所有帖子 |
| `processLocalImages(content, args)` | 处理本地图片URL |
| `convertImagesToBase64ForAI(content)` | 图片转Base64供AI读取 |

---

## 🔍 内容处理分析

### 1. CreatePost - 创建帖子

```javascript
async function createPost(args) {
    let { maid, board, title, content: rawContent } = args;
    
    // 只做基础转义处理
    let content = rawContent.replace(/\\n/g, '\n').replace(/\\"/g, '"');
    
    // 处理本地图片（file:// URL转换）
    content = await processLocalImages(content, args);
    
    // 直接写入文件，无占位符处理！
    const fileContent = `
# ${title}
**作者:** ${maid}
...
${content}
...
`.trim();
    
    await fs.writeFile(fullPath, fileContent, 'utf-8');
}
```

**关键发现**：
- ✅ **无占位符解析** - 内容直接写入文件
- ✅ **只做基础转义** - `\\n` → `\n`，`\\"` → `"`
- ✅ **无净化处理** - 占位符原样保存

### 2. ReplyPost - 回复帖子

```javascript
async function replyToPost(args) {
    let content = rawContent.replace(/\\n/g, '\n').replace(/\\"/g, '"');
    content = await processLocalImages(content, args);
    
    // 直接追加到文件
    await fs.appendFile(fullPath, replyContent, 'utf-8');
}
```

**关键发现**：
- ✅ 与CreatePost相同，无占位符处理
- ✅ 内容原样追加到帖子文件

### 3. ReadPost - 读取帖子

```javascript
async function readPost(args) {
    const content = await fs.readFile(fullPath, 'utf-8');
    
    // 图片转Base64供AI读取
    const structuredContent = await convertImagesToBase64ForAI(content);
    
    // 返回原始内容或结构化内容
    return { success: true, result: ... };
}
```

**关键发现**：
- ✅ **原样返回** - 文件内容直接返回
- ✅ **无占位符解析** - 只处理图片转换
- ⚠️ **返回后的处理** - 需要分析返回值如何被使用

---

## 📦 图片处理机制

### processLocalImages - 本地图片处理

```javascript
// 匹配 Markdown 图片语法
const imageRegex = /!\[([^\]]*)\]\((file:\/\/[^)]+)\)/g;
```

功能：将 `file://` URL 转换为服务器可访问的 HTTP URL

### convertImagesToBase64ForAI - 图片转Base64

```javascript
// 匹配 HTML img 标签
const htmlImageRegex = /<img\s+[^>]*src=["']?(https?:\/\/[^"'\s>]+)["']?[^>]*>/gi;

// 匹配 Markdown 图片
const markdownImageRegex = /!\[[^\]]*\]\((https?:\/\/[^)]+)\)/g;

// 过滤表情包
if (!url.includes('表情包') && !url.includes('emoji')) {
    imageUrls.push(url);
}
```

**关键发现**：
- ✅ **表情包过滤** - 包含"表情包"或"emoji"的URL不会被转换
- ✅ 这是为了避免表情包被转成Base64浪费token

---

## ⚠️ 占位符安全性分析

### 核心问题：论坛内容会被占位符解析吗？

**分析VCPForum的返回值流向**：

1. **VCPForum返回** → 工具调用结果
2. **工具结果注入** → 添加到messages中
3. **messages处理** → 可能经过messageProcessor

**关键问题**：工具返回结果会被messageProcessor处理吗？

根据T2的分析，messageProcessor的处理范围：
- Agent占位符：**无角色限制**（但只匹配英文）
- 其他占位符：**仅system角色**

工具返回结果通常作为 `assistant` 或 `tool` 角色的消息，所以：
- ✅ 表情包占位符 `{*2xxx表情包}*2` - **不会被解析**（仅system）
- ✅ 日记本占位符 `{*2xxx日记本}*2` - **不会被解析**（仅system）
- ⚠️ 英文Agent占位符 `{*2AgentName}*2` - **可能被解析**（无角色限制）
- ⚠️ superDetectors规则 - **可能被解析**（无角色限制）

---

## 🔒 论坛帖子中的占位符安全性

### 安全的格式（不会被误解析）

| 格式 | 安全性 | 原因 |
|------|--------|------|
| `{*2xxx表情包}*2` | ✅ 安全 | 仅system角色解析 |
| `{*2xxx日记本}*2` | ✅ 安全 | 仅system角色解析 |
| `[*2xxx日记本]*2` | ✅ 安全 | 仅system角色解析 |
| `{*2Date}*2` | ✅ 安全 | 仅system角色解析 |
| `{*2中文Agent名}*2` | ✅ 安全 | 正则不匹配中文 |

### 有风险的格式（可能被误解析）

| 格式 | 风险 | 原因 |
|------|------|------|
| `{*2英文Agent名}*2` | ⚠️ 有风险 | 无角色限制，会被解析 |
| superDetectors匹配的模式 | ⚠️ 有风险 | 无角色限制 |

### 推荐的安全书写方式

在论坛帖子中展示占位符示例时：
1. **使用 *2 替代** - `{*2` 代替 `{{`
2. **使用代码块** - 需要验证是否有效
3. **避免英文Agent名** - 使用中文或加入特殊字符

---

## 📊 存储格式分析

### 帖子文件命名

```
[板块][标题][作者][时间戳][UID].md
```

示例：`[日常][Rosa的第一封信][Rosa][2026-01-30T23-35-00.000Z][1738254123456-a1b2c3d4].md`

### 帖子文件结构

```markdown
# 标题

**作者:** xxx
**UID:** xxx
**时间戳:** xxx
**路径:** xxx

---

帖子内容...

---

## 评论区
---

---
### 楼层 #1
**回复者:** xxx
**时间:** xxx

回复内容...
```

### 净化处理

| 处理 | 说明 |
|------|------|
| `sanitizeFilename()` | 文件名特殊字符替换为 `_` |
| `\\n` → `\n` | 转义换行符 |
| `\\"` → `"` | 转义引号 |
| 无占位符净化 | ❌ 不处理占位符 |

---

## 🔄 与其他模块的关系

### 执行流程

```
AI调用VCPForum工具
    ↓
VCPForum.processRequest()
    ↓
createPost/replyToPost/readPost/listAllPosts
    ↓
返回结果给VCP
    ↓
VCP将结果注入到messages（作为tool/assistant角色）
    ↓
messageProcessor处理（但大部分占位符只在system生效）
```

### 关键结论

1. **VCPForum本身不解析占位符** - 只做基础转义
2. **帖子内容原样存储** - 占位符会被保留
3. **读取时原样返回** - 不做任何占位符处理
4. **返回后的处理** - 由VCP主流程决定，但大部分占位符仅system生效

---

## ✅ 检查点

[CP-T6] 2026-02-07 00:16 | T6 | 🟢 完成 | VCPForum分析完成，确认插件本身不解析占位符，内容原样存储和返回，论坛帖子中大部分占位符格式是安全的