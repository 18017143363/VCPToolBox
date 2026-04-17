# T7 - DailyNote.js 占位符解析分析

**说明：本文档中 {*2 = {{，}*2 = }}，[*2 = [[，]*2 = ]]**

## 📋 文件信息

| 项目 | 值 |
|------|-----|
| 文件路径 | E:\VCP\Plugin\DailyNote\dailynote.js |
| 文件大小 | 19.04 KB |
| 插件类型 | synchronous (同步插件，通过stdin/stdout通信) |
| 分析时间 | 2026-02-07 00:28 |
| 分析人 | Rosa |

---

## 🏗️ 模块架构

DailyNote是一个**同步插件**，通过stdin接收JSON参数，stdout输出结果。

### 核心函数

| 函数 | 功能 |
|------|------|
| `handleCreateCommand(args)` | 创建新日记 |
| `handleUpdateCommand(args)` | 更新现有日记 |
| `processTags(contentText, externalTag)` | 处理Tag标签 |
| `sanitizePathComponent(name)` | 路径安全净化 |
| `isPathWithinBase(targetPath, basePath)` | 路径遍历防护 |

---

## 🔍 内容处理分析

### 1. Create命令 - 创建日记

```javascript
async function handleCreateCommand(args) {
    const maid = args.maid || args.maidName || args.Maid || args.MAID;
    const dateString = args.dateString || args.Date;
    const contentText = args.contentText || args.Content;
    const tag = args.Tag || args.tag;

    // Tag处理
    const processedContent = await processTags(contentText, tag);
    
    // 直接写入文件，无占位符处理！
    const fileContent = `[${datePart}] - ${actualMaidName}\n${processedContent}`;
    await fs.writeFile(filePath, fileContent);
}
```

**关键发现**：
- ✅ **无占位符解析** - 内容直接写入文件
- ✅ **只处理Tag格式** - 规范化Tag行格式
- ✅ **路径安全检查** - `isPathWithinBase()` 防止路径遍历
- ✅ **文件名净化** - `sanitizePathComponent()` 移除危险字符

### 2. Update命令 - 更新日记

```javascript
async function handleUpdateCommand(args) {
    const { target, replace, maid } = args;

    // 安全检查：target必须>=15字符
    if (target.length < 15) {
        return { status: "error", error: `Security check failed: 'target' must be at least 15 characters long.` };
    }

    // 在文件中查找target并替换
    const index = content.indexOf(target);
    if (index !== -1) {
        const newContent = content.substring(0, index) + replace + content.substring(index + target.length);
        await fs.writeFile(filePath, newContent, 'utf-8');
    }
}
```

**关键发现**：
- ✅ **无占位符解析** - 纯文本查找替换
- ✅ **target长度限制** - 必须>=15字符，防止误替换
- ✅ **路径安全检查** - 每个目录都检查 `isPathWithinBase()`
- ✅ **优先级搜索** - 根据maid参数优先搜索对应文件夹

### 3. Tag处理

```javascript
async function processTags(contentText, externalTag) {
    // 优先使用外部Tag参数
    if (externalTag && typeof externalTag === 'string' && externalTag.trim() !== '') {
        const fixedTag = fixTagFormat(externalTag);
        return contentText.trimEnd() + '\n' + fixedTag;
    }
    
    // 否则检测内容末尾的Tag行
    const detection = detectTagLine(contentText);
    if (detection.hasTag) {
        const fixedTag = fixTagFormat(detection.lastLine);
        return detection.contentWithoutLastLine.trimEnd() + '\n' + fixedTag;
    }
    
    // 都没有则报错
    throw new Error("Tag is missing...");
}
```

**关键发现**：
- ✅ Tag只做格式规范化，不解析占位符
- ✅ 支持中文逗号、顿号转换为英文逗号

---

## 📦 存储格式分析

### 文件命名规则

```
{日期}-{时分秒}.{扩展名}
```

示例：`2026-02-07-00_28_30.txt`

如果文件已存在，会添加序号：`2026-02-07-00_28_30(2).txt`

### 文件内容格式

```
[日期] - 作者名
内容正文...
Tag: 标签1, 标签2, 标签3
```

### 存储路径

```
dailynote/
├── Rosa/                    ← maid="Rosa"
│   └── 2026-02-07-00_28_30.txt
├── vcp文档/                 ← maid="[vcp文档]Rosa"
│   └── 2026-02-07-00_28_30.txt
└── rosa的私密日记/          ← maid="[rosa的私密日记]Rosa"
    └── 2026-02-07-00_28_30.txt
```

### maid参数解析

| maid格式 | 文件夹 | 作者名 |
|----------|--------|--------|
| `Rosa` | Rosa/ | Rosa |
| `[vcp文档]Rosa` | vcp文档/ | Rosa |
| `[rosa的私密日记]Rosa` | rosa的私密日记/ | Rosa |

---

## ⚠️ 占位符安全性分析

### DailyNote本身不解析占位符！

DailyNote插件的核心职责是：
1. 接收内容
2. 处理Tag格式
3. 写入/更新文件

**整个过程不涉及任何占位符解析！**

### 日记内容中的占位符会被解析吗？

**分析完整链路**：

```
1. AI调用DailyNote.create → 内容写入文件（无解析）
2. 日记存储在 dailynote/ 目录
3. RAGDiaryPlugin检索日记 → 注入到system消息
4. messageProcessor处理system消息 → 可能解析占位符
```

**关键问题**：RAGDiaryPlugin注入的日记内容会被messageProcessor解析吗？

根据T3的分析，RAGDiaryPlugin有**内容净化机制**：

```javascript
const safeContent = diaryContent
    .replace(/\[\[.*日记本.*\]\]/g, '[循环占位符已移除]')
    .replace(/<<.*日记本>>/g, '[循环占位符已移除]')
    .replace(/《《.*日记本.*》》/g, '[循环占位符已移除]');
```

**但是**：这个净化只移除了**RAG语法**，没有移除其他占位符！

所以：
- `[*2xxx日记本]*2` → 会被净化为 `[循环占位符已移除]`
- `{*2xxx表情包}*2` → **不会被净化**，但仅在system角色解析
- `{*2英文Agent名}*2` → **不会被净化**，且无角色限制！

---

## 🔒 日记内容中的占位符安全性

### 安全的格式（不会被误解析）

| 格式 | 安全性 | 原因 |
|------|--------|------|
| `{*2xxx表情包}*2` | ✅ 安全 | 仅system角色解析，日记注入后在system中是预期行为 |
| `{*2xxx日记本}*2` | ✅ 安全 | 仅system角色解析 |
| `[*2xxx日记本]*2` | ✅ 安全 | 会被RAGDiaryPlugin净化 |
| `{*2中文Agent名}*2` | ✅ 安全 | 正则不匹配中文 |
| `VCP_R.A.G_BLOCK` | ✅ 安全 | 用点号破坏了正则匹配 |

### 有风险的格式（可能被误解析）

| 格式 | 风险 | 原因 |
|------|------|------|
| `{*2英文Agent名}*2` | ⚠️ 有风险 | 无角色限制，会被解析 |
| `VCP_RAG_BLOCK_START` | ⚠️ 有风险 | 会触发chatCompletionHandler的includes()检查 |
| superDetectors匹配的模式 | ⚠️ 有风险 | 无角色限制 |

### 推荐的安全书写方式

1. **使用 *2 替代** - `{*2` 代替 `{{`
2. **使用点号破坏** - `VCP_R.A.G_BLOCK` 代替 `VCP_RAG_BLOCK`
3. **避免英文Agent名** - 使用中文或加入特殊字符

---

## 📊 与RAGDiaryPlugin的完整链路

```
1. AI调用DailyNote
   ↓
2. DailyNote写入文件（无解析）
   ↓
3. 日记存储在 dailynote/{maid}/ 目录
   ↓
4. 用户发送消息，触发RAGDiaryPlugin
   ↓
5. RAGDiaryPlugin检索相关日记
   ↓
6. 日记内容被净化（移除RAG语法）
   ↓
7. 注入到system消息中
   ↓
8. messageProcessor处理system消息
   ↓
9. 占位符被解析（仅system角色生效的那些）
   ↓
10. 转发到上游AI
```

### 关键结论

1. **DailyNote本身不解析占位符** - 只做文件读写
2. **日记内容会被RAGDiaryPlugin部分净化** - 只净化RAG语法
3. **注入后的内容会被messageProcessor处理** - 但大部分占位符仅system生效
4. **英文Agent名占位符是唯一的风险点** - 无角色限制

---

## 🛡️ 安全机制总结

| 安全机制 | 位置 | 作用 |
|----------|------|------|
| `sanitizePathComponent()` | DailyNote | 移除路径危险字符 |
| `isPathWithinBase()` | DailyNote | 防止路径遍历攻击 |
| `target.length >= 15` | DailyNote.update | 防止误替换 |
| `IGNORED_FOLDERS` | DailyNote | 禁止写入特定文件夹 |
| RAG语法净化 | RAGDiaryPlugin | 移除循环引用风险 |

---

## ✅ 检查点

[CP-T7] 2026-02-07 00:30 | T7 | 🟢 完成 | DailyNote分析完成，确认插件本身不解析占位符，内容原样存储，日记被RAG检索后会经过部分净化，英文Agent名占位符是唯一风险点