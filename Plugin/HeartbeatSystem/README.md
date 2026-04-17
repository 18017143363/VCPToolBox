# HeartbeatSystem（统一心跳系统插件）

## 这是什么
HeartbeatSystem 是一个 **hybridservice** 插件，用于把“心跳调度 + 日程任务 + 心跳活动记录 + HTTP API + 前端面板”整合到同一个系统里。

融合来源：
- 1.txt：SafeFileManager 原子写入（WriteTemp→Rename）
- 2.txt：命令处理器与HTTP API主干、env覆盖能力
- 3.txt：自动扫描 Agent 目录作为默认启用列表

## 目录结构
- 插件：
  - `E:\VCP\Plugin\HeartbeatSystem\HeartbeatSystem.js`
  - `E:\VCP\Plugin\HeartbeatSystem\plugin-manifest.json`
  - `E:\VCP\Plugin\HeartbeatSystem\heartbeat_prompt.txt`
  - `E:\VCP\Plugin\HeartbeatSystem\config.env.example`（示例）
- 前端面板（AdminPanel静态页）：
  - `E:\VCP\AdminPanel\HeartbeatSystem_Panel.html`

## 前端怎么打开
在浏览器访问（与现有AdminPanel同域）：
- `/HeartbeatSystem_Panel.html`

该页面使用 Basic Auth 登录，并调用 `/admin_api/heartbeat/*` 的接口。

## HTTP API（Admin API）
说明：以下路径是相对于 `/admin_api` 的子路径

- `GET  /heartbeat/agents`：列出 Agent 目录
- `GET  /heartbeat/:agent`：获取 schedule.json
- `GET  /heartbeat/:agent/tasks`：仅获取 tasks+stats
- `GET  /heartbeat/:agent/heartbeats`：仅获取 heartbeats
- `POST /heartbeat/:agent/trigger`：创建一个“普通”唤醒任务（scheduled task）
- `POST /heartbeat/:agent/trigger-heartbeat`：触发“调度器逻辑心跳”（四时段规划判定 + 生成 timed-contact + 重新调度）
- `POST /heartbeat/:agent/pause`：暂停
- `POST /heartbeat/:agent/resume`：恢复
- `GET  /heartbeat-scheduler/status`：调度器状态

## Tool 命令（给AI调用）
- GetSchedule / AddTask / UpdateTaskStatus / RemoveTask / GetTodayTasks
- RecordHeartbeat / SetSettings / CreateScheduledTask
- GetPlannedSlots / MarkSlotPlanned
- TriggerHeartbeat / SchedulerStatus / StartScheduler / StopScheduler

## 数据文件（默认）
默认日程目录（可用环境变量覆盖）：
- `SCHEDULES_DIR` 默认指向：`E:\VCP\AgentSchedules\{AgentName}\schedule.json`
- `TIMED_CONTACTS_DIR` 默认指向：`E:\VCP\VCPTimedContacts\`

## 下一步建议
1) 冒烟测试：访问 `/admin_api/heartbeat-scheduler/status`
2) 面板测试：打开 `/HeartbeatSystem_Panel.html`，触发一次“调度器逻辑心跳”
3) 若要把面板加入“控制中心首页导航”，需要改 `AdminPanel/script.js` 的页面注册逻辑（下一轮处理）