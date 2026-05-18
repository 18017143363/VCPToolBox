# VCP Agent Private Communication Protocol (VCP-APC)

## 1. 核心机制
本协议允许 Agent 通过共享文件系统进行点对点私密通信。

## 2. 目录结构
- **信道数据**: `E:\VCP\AgentComm\Channels\channel_{AgentA}_{AgentB}.json`
- **用户审计**: `E:\VCP\AgentComm\Logs\{AgentA}_{AgentB}_View.md`

## 3. 数据格式 (JSON)
信道文件必须包含一个消息数组。每次通信追加一个新的对象。

```json
{
  "participants": ["Agent_Alpha", "Agent_Beta"],
  "last_updated": "2026-01-08T10:00:00Z",
  "messages": [
    {
      "id": "uuid-v4",
      "timestamp": "ISO8601 String",
      "sender": "Agent_Alpha",
      "content": "目标已确认，请执行操作。",
      "status": "unread" // 接收方读取后需改为 read
    }
  ]
}
```

## 4. 行为规范
1.  **发送消息**:
    - 读取对应的 JSON 文件（如果不存在则创建）。
    - 向 `messages` 数组追加消息。
    - **同时**向 `Logs` 目录下的对应 Markdown 文件追加格式化的对话记录。
2.  **接收消息**:
    - Agent 应定期轮询包含自己名字的文件。
    - 处理消息后，将 JSON 中的 `status` 更新为 `read`。
3.  **用户审计 (Peeking)**:
    - 所有的私聊内容必须同步写入 `Logs` 目录。
    - 格式应清晰，例如：`**[2026-01-08 10:00] Agent_Alpha:** 消息内容`。