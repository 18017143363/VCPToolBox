# TopicSponsor 插件技术文档

**分析时间**: 2026-02-07 21:45
**分析者**: Rosa

---

## 概述

TopicSponsor是VChat分布式服务器的话题管理插件，允许AI主动创建话题、管理对话、查询状态。

## 插件信息

| 属性 | 值 |
|------|-----|
| 路径 | `E:\VCPCHAT\VCPDistributedServer\Plugin\TopicSponsor` |
| 类型 | synchronous |
| 协议 | stdio |
| 入口 | node topicCreator.js |
| 超时 | 15秒 |
| 版本 | 2.1.0 |
| 大小 | topicCreator.js (23.3KB) |

## 8个命令详解

### 1. CreateTopic - 创建话题

**功能**: 创建新话题并发送第一条消息

**参数**:
| 参数 | 必需 | 说明 |
|------|------|------|
| maid | 是 | Agent中文名 |
| topic_name | 是 | 话题名称 |
| initial_message | 是 | 第一条消息内容 |

**特性**:
- 话题默认 `locked: false`（未锁定）
- 话题默认 `unread: true`（未读）
- 自动设为当前话题 `current_topic_id`
- 创建备份 `config.topic.backup.json`

### 2. ReadUnlockedTopics - 读取未锁定话题

**功能**: 读取所有未锁定话题及其完整消息历史

**参数**:
| 参数 | 必需 | 说明 |
|------|------|------|
| maid | 是 | Agent中文名 |
| include_read | 否 | 是否包含已读话题（默认false）|

### 3. CheckNewTopics - 检查新话题

**功能**: 查询最近N天内创建的未锁定话题

**参数**:
| 参数 | 必需 | 说明 |
|------|------|------|
| maid | 是 | Agent中文名 |
| days | 否 | 天数（默认3天）|

### 4. CheckUnreadMessages - 检查未读消息

**功能**: 查询所有标记为未读的话题

**参数**:
| 参数 | 必需 | 说明 |
|------|------|------|
| maid | 是 | Agent中文名 |

### 5. ReplyToTopic - 回复话题

**功能**: 在指定话题中追加消息

**参数**:
| 参数 | 必需 | 说明 |
|------|------|------|
| maid | 是 | Agent中文名 |
| topic_id | 是 | 话题ID |
| message | 是 | 回复内容 |
| sender_name | 是 | 发送者名称 |

**限制**: 只能回复未锁定或标记为未读的话题

### 6. CheckTopicOwnership - 检查所有权

**功能**: 验证话题是否为指定调用者创建

**参数**:
| 参数 | 必需 | 说明 |
|------|------|------|
| maid | 是 | Agent中文名 |
| topic_id | 是 | 话题ID |
| caller_name | 是 | 调用者名称 |

### 7. ListUnlockedTopics - 列出未锁定话题

**功能**: 列出所有未锁定话题的基本信息（不含消息）

**参数**:
| 参数 | 必需 | 说明 |
|------|------|------|
| maid | 是 | Agent中文名 |

### 8. ReadTopicContent - 读取话题内容

**功能**: 读取指定话题的完整消息历史

**参数**:
| 参数 | 必需 | 说明 |
|------|------|------|
| maid | 是 | Agent中文名 |
| topic_id | 是 | 话题ID |

## 核心机制

### 路径计算

```javascript
const VchatDataURL = path.join(__dirname, '..', '..', '..', 'AppData');
```

插件位于 `VCPDistributedServer/Plugin/TopicSponsor/`，向上3级到达VChat根目录。

### Agent查找

```javascript
async function findAgentInfo(vchatPath, maidName) {
    const agentsDir = path.join(vchatPath, 'Agents');
    // 遍历所有Agent文件夹
    // 读取config.json
    // 模糊匹配 config.name.includes(maidName)
}
```

### 话题数据结构

**topic对象** (在config.json中):
```json
{
    "id": "topic_1234567890",
    "name": "话题名称",
    "createdAt": 1699999999999,
    "locked": false,
    "unread": true,
    "creatorSource": "plugin:TopicCreator",
    "_creator": {
        "agentName": "Rosa",
        "agentId": "_Agent_xxx",
        "timestamp": 1699999999999
    }
}
```

**消息对象** (在history.json中):
```json
{
    "role": "assistant",
    "name": "Rosa",
    "content": "消息内容",
    "timestamp": 1699999999999,
    "id": "msg_xxx_assistant_abc1234",
    "isThinking": false,
    "avatarUrl": "file://...",
    "avatarColor": "rgb(96,106,116)",
    "isGroupMessage": false,
    "agentId": "_Agent_xxx",
    "finishReason": "completed",
    "_metadata": {
        "topicCreator": "Rosa",
        "creatorAgentId": "_Agent_xxx",
        "createdBy": "plugin",
        "createdAt": 1699999999999
    }
}
```

### locked/unread机制

| 状态 | locked | unread | 说明 |
|------|--------|--------|------|
| 新创建 | false | true | AI创建的话题 |
| 用户锁定 | true | - | 用户手动锁定 |
| 已读 | - | false | 用户已查看 |

## 存储路径

```
VCPCHAT/AppData/
├── Agents/{AgentId}/
│   └── config.json          # 包含topics数组
└── UserData/{AgentId}/
    └── topics/{TopicId}/
        └── history.json     # 消息历史
```

## 设计亮点

1. **AI主动性** - AI可以主动创建话题发起对话
2. **所有权验证** - 通过_metadata追踪创建者
3. **备份机制** - 修改config前自动备份
4. **模糊匹配** - Agent名称支持模糊匹配
5. **完整元数据** - 消息包含丰富的上下文信息

---

Tag: VChat文档, TopicSponsor, 话题管理, 分布式插件, AI主动性