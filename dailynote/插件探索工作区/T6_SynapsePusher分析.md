# SynapsePusher 插件技术文档

**分析时间**: 2026-02-07 21:56
**分析者**: Rosa

---

## 概述

SynapsePusher是VCP的日志推送服务插件，将VCP工具调用日志实时推送到指定的Synapse(Matrix)聊天房间，实现远程监控AI工具调用。

## 插件信息

| 属性 | 值 |
|------|-----|
| 路径 | `E:\VCP\Plugin\SynapsePusher` |
| 类型 | service |
| 协议 | direct (常驻内存) |
| 入口 | SynapsePusher.js |
| 版本 | 1.0.0 |
| 大小 | SynapsePusher.js (16KB) |
| 依赖 | ws, axios |

## 配置项

| 配置 | 类型 | 说明 |
|------|------|------|
| DebugMode | boolean | 调试模式 |
| VCP_Key | string | VCP密钥(用于连接VCPLog) |
| SynapseHomeserver | string | Matrix服务器地址 |
| SynapseRoomID | string | 目标房间ID |
| MaidAccessTokensJSON | string | Maid访问令牌映射(JSON) |
| MaidToolWhitelistJSON | string | Maid工具白名单(JSON) |
| BypassWhitelistForTesting | boolean | 测试模式(跳过白名单) |
| SynapseAccessTokenForTestingOnly | string | 测试用统一令牌 |

## 工作流程

### 1. 初始化阶段

```javascript
function registerRoutes(app, config, projectBasePath) {
    // 解析MaidAccessTokensJSON
    parsedMaidAccessTokens = JSON.parse(config.MaidAccessTokensJSON);
    // 解析MaidToolWhitelistJSON
    parsedMaidToolWhitelists = JSON.parse(config.MaidToolWhitelistJSON);
    // 连接WebSocket日志源
    connectToWebSocketLogSource();
}
```

### 2. WebSocket连接

连接到VCPLog WebSocket获取实时日志：
```
ws://localhost:{PORT}/VCPlog/VCP_Key={VCP_Key}
```

### 3. 日志过滤

收到`vcp_log`类型消息后：
1. 从`message.data.content`提取`MaidName`
2. 检查Maid是否在`MaidAccessTokensJSON`中有令牌
3. 检查工具是否在该Maid的白名单中
4. 通过所有检查才推送

### 4. 推送到Synapse

使用Matrix Client-Server API发送消息：
```
PUT /_matrix/client/r0/rooms/{roomId}/send/m.room.message/{txnId}
```

## 消息格式

推送到Synapse的消息格式：
```
**VCP Log Event (source)** [timestamp] (Maid: xxx)
**Tool:** tool_name
**Status:** success/error
**Content:**
```json
{内容，最多3000字符}
```
```

## 配置示例

### MaidAccessTokensJSON
```json
{
    "Rosa": "syt_xxxx_access_token_for_rosa",
    "小元": "syt_xxxx_access_token_for_xiaoyuan"
}
```

### MaidToolWhitelistJSON
```json
{
    "Rosa": ["FileOperator", "VSearch", "DailyNote"],
    "小元": ["VSearch", "BilibiliFetch"]
}
```

## 严格模式 vs 测试模式

| 模式 | 条件 | 行为 |
|------|------|------|
| 严格模式 | BypassWhitelistForTesting=false | 必须在白名单中才推送 |
| 测试模式 | BypassWhitelistForTesting=true | 使用统一测试令牌，跳过白名单 |

## 重连机制

| 事件 | 重连延迟 |
|------|----------|
| 配置缺失 | 15秒 |
| 连接关闭 | 5秒 |
| 连接错误 | 7秒 |

## 使用场景

1. **远程监控** - 在手机Matrix客户端查看AI工具调用
2. **调试辅助** - 实时查看工具调用日志
3. **安全审计** - 记录AI的所有操作
4. **多Maid管理** - 不同Maid推送到不同房间/使用不同令牌

## 与其他插件关系

| 插件 | 关系 |
|------|------|
| AgentMessage | 主动推送消息给用户 |
| VCPForum | 异步留言板 |
| SynapsePusher | 日志监控推送 |

## 注意事项

1. **需要Matrix账号** - 每个Maid需要独立的Matrix账号和AccessToken
2. **白名单配置** - 严格模式下必须配置白名单
3. **内容截断** - 超过3000字符的内容会被截断
4. **服务类插件** - 常驻内存，VCP启动时自动加载

---

Tag: VCP文档, SynapsePusher, Matrix, 日志推送, 监控, 服务插件