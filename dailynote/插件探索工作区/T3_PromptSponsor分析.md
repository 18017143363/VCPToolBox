# PromptSponsor 插件技术文档

**分析时间**: 2026-02-07 21:46
**分析者**: Rosa

---

## 概述

PromptSponsor是VChat分布式服务器的提示词管理插件，允许AI完全控制和管理Agent的系统提示词。支持三种模式：原始富文本、模块化积木块、临时与预制。

## 插件信息

| 属性 | 值 |
|------|-----|
| 路径 | `E:\VCPCHAT\VCPDistributedServer\Plugin\PromptSponsor` |
| 类型 | synchronous |
| 协议 | stdio |
| 入口 | node prompt-sponsor.js |
| 超时 | 30秒 |
| 版本 | 1.0.0 |
| 大小 | prompt-sponsor.js (32KB) + README.md (16.66KB) |

## 三种提示词模式

| 模式 | 标识 | 功能特点 |
|------|------|----------|
| 原始富文本 | `original` | 简单直接的文本编辑 |
| 模块化积木块 | `modular` | 积木块式管理，支持拖拽、禁用、多内容条目、小仓库 |
| 临时与预制 | `preset` | 从预设文件夹加载模板，支持占位符 |

## 22个命令详解

### 模式管理（4个）

| 命令 | 功能 | 关键参数 |
|------|------|----------|
| GetPromptMode | 获取当前模式 | agentId |
| SetPromptMode | 切换模式 | agentId, mode |
| GetActivePrompt | 获取格式化后的提示词 | agentId |
| SetOriginalPrompt | 设置原始模式内容 | agentId, content |

### 积木块操作（5个）

| 命令 | 功能 | 关键参数 |
|------|------|----------|
| GetModularBlocks | 获取所有积木块 | agentId |
| AddBlock | 添加积木块 | agentId, type, content, name, position |
| UpdateBlock | 更新积木块 | agentId, blockId, content/name/disabled |
| DeleteBlock | 删除积木块 | agentId, blockId |
| MoveBlock | 移动积木块 | agentId, blockId, newPosition |

### 多版本管理（4个）

| 命令 | 功能 | 关键参数 |
|------|------|----------|
| AddVariant | 添加内容条目 | agentId, blockId, content |
| UpdateVariant | 更新内容条目 | agentId, blockId, variantIndex, content |
| DeleteVariant | 删除内容条目 | agentId, blockId, variantIndex |
| SelectVariant | 选择显示的条目 | agentId, blockId, variantIndex |

### 仓库管理（6个）

| 命令 | 功能 | 关键参数 |
|------|------|----------|
| HideBlock | 隐藏到仓库 | agentId, blockId, warehouse |
| RestoreBlock | 从仓库恢复 | agentId, warehouse, blockIndex, position |
| GetWarehouses | 获取所有仓库 | agentId |
| CreateWarehouse | 创建仓库 | agentId, warehouseName |
| RenameWarehouse | 重命名仓库 | agentId, oldName, newName |
| DeleteWarehouse | 删除仓库 | agentId, warehouseName |

### 预设管理（3个）

| 命令 | 功能 | 关键参数 |
|------|------|----------|
| ListPresets | 列出所有预设 | agentId |
| SetPreset | 应用预设文件 | agentId, presetPath |
| SetPresetContent | 直接设置预设内容 | agentId, content |

## 核心机制

### Agent配置路径

```javascript
const AGENT_DIR = path.join(__dirname, '..', '..', '..', 'AppData', 'Agents');
// 支持两种格式：
// 1. 目录结构: AppData/Agents/{agentId}/config.json
// 2. 扁平结构: AppData/Agents/{agentId}.json
```

### 积木块数据结构

```json
{
  "id": "block_1234567890_abc123",
  "type": "text",
  "content": "当前显示的内容",
  "name": "积木块名称",
  "disabled": false,
  "variants": ["版本1", "版本2", "版本3"],
  "selectedVariant": 0
}
```

### 积木块类型

| 类型 | 标识 | 说明 |
|------|------|------|
| 文本块 | `text` | 可编辑内容，支持多版本 |
| 换行块 | `newline` | 强制换行，格式化时转为 `\n` |

### 仓库系统

```json
{
  "hiddenBlocks": {
    "default": [],
    "常用模板": [],
    "实验性内容": []
  },
  "warehouseOrder": ["default", "常用模板", "实验性内容"]
}
```

- `default` 仓库不可删除/重命名
- 隐藏的积木块可以随时恢复
- 支持多仓库分类管理

### 模式切换时的同步

```javascript
// SetPromptMode 会自动更新 systemPrompt 字段
config.promptMode = mode;
config.systemPrompt = formatPromptByMode(mode);
await saveAgentConfig(agentId, config);
```

## 使用场景

### 场景1: 动态调整Agent身份

```
1. SetPromptMode → modular
2. AddBlock → "你是专业编程助手"
3. AddBlock → "你精通Python, JavaScript"
4. AddBlock → newline
5. AddBlock → "回答简洁明了"
```

### 场景2: 管理多版本提示词

```
1. AddVariant → "严肃专业的顾问"
2. AddVariant → "轻松幽默的伙伴"
3. SelectVariant(0) → 使用专业版本
4. SelectVariant(1) → 使用轻松版本
```

### 场景3: 使用小仓库管理模板

```
1. CreateWarehouse → "角色扮演"
2. CreateWarehouse → "技术文档"
3. HideBlock → 分类存储
4. RestoreBlock → 需要时恢复
```

## 注意事项

1. **使用agentId而非中文名** - 格式如 `_Agent_1761774023391_1761774023392`
2. **default仓库受保护** - 不可删除/重命名
3. **至少保留一个variant** - 不能删除最后一个内容条目
4. **积木块数量建议<100** - 避免性能问题
5. **单块内容建议<1000字符** - 保持可读性

## 设计亮点

1. **AI自主控制提示词** - 可以动态修改自己的人格
2. **多版本管理** - 同一积木块多个变体快速切换
3. **仓库分类** - 模板复用和管理
4. **模式切换自动同步** - systemPrompt实时更新
5. **完善的README文档** - 开发者友好

---

Tag: VChat文档, PromptSponsor, 提示词管理, 分布式插件, AI自主性