# VCPAlarm 插件技术文档

**分析时间**: 2026-02-07 21:43
**分析者**: Rosa

---

## 概述

VCPAlarm是VChat分布式服务器的闹钟插件，通过启动独立后台进程实现定时提醒功能。

## 插件信息

| 属性 | 值 |
|------|-----|
| 路径 | `E:\VCPCHAT\VCPDistributedServer\Plugin\VCPAlarm` |
| 类型 | synchronous |
| 协议 | stdio |
| 入口 | python set_alarm.py |
| 超时 | 10秒 |
| 版本 | 1.0.0 |

## 文件结构

| 文件 | 大小 | 说明 |
|------|------|------|
| plugin-manifest.json | 1.16 KB | 插件清单 |
| set_alarm.py | 2.55 KB | 入口脚本（设置闹钟）|
| run_alarm.py | 18.63 KB | 后台脚本（执行闹钟）|
| config.env | - | 配置文件 |
| AlarmRing.mp3 | - | 闹钟铃声 |
| VCPAgent.png | - | 闹钟窗口显示的图片 |

## 架构设计

### 双脚本分离模式

```
AI调用VCPAlarm
    ↓
set_alarm.py (入口脚本)
    ├── 解析time_description参数
    ├── 启动run_alarm.py作为独立进程
    └── 立即返回成功消息
    ↓
run_alarm.py (后台进程)
    ├── 使用dateparser解析时间
    ├── time.sleep()等待到目标时间
    └── 弹出GUI窗口 + 播放铃声
```

### 进程分离机制

```python
# Windows使用DETACHED_PROCESS标志
creation_flags = subprocess.DETACHED_PROCESS
subprocess.Popen(command, creationflags=creation_flags, close_fds=True)
```

这确保了：
- 父进程(set_alarm.py)可以立即退出
- 子进程(run_alarm.py)独立运行，不受父进程影响
- 闹钟进程在VCP重启后仍然有效

## 调用参数

| 参数 | 必需 | 说明 |
|------|------|------|
| time_description | 是 | 时间描述（自然语言或具体时间）|

### 支持的时间格式

| 格式类型 | 示例 |
|----------|------|
| 相对时间 | "5分钟后", "1小时后", "15分钟后" |
| 具体时间 | "晚上10点30分", "22:30", "下午3点" |
| 自然语言 | "明天早上8点", "今晚9点" |

## GUI界面特性

### 日夜主题自动切换

| 时间段 | 主题 | 主色调 |
|--------|------|--------|
| 6:00-18:00 | 浅色主题 | #3498db (蓝) |
| 18:00-6:00 | 深色主题 | #8a74f9 (紫) |

### 视觉效果

1. **圆角窗口** - 20px圆角 + 阴影效果
2. **渐变背景** - 顶部渐变装饰
3. **呼吸动画** - 图片周期性缩放 (±6%)
4. **淡入效果** - 窗口渐显
5. **发光边框** - 图片外圈发光效果

### 窗口功能

- 无边框设计 (overrideredirect)
- 始终置顶 (topmost)
- 可拖动 (绑定鼠标事件)
- 透明背景 (transparentcolor)

## 依赖库

| 库 | 用途 |
|----|------|
| dateparser | 自然语言时间解析 |
| pygame | 音频播放 |
| Pillow (PIL) | 图像处理 |
| tkinter | GUI界面 |

## 核心代码解析

### 时间解析 (run_alarm.py)

```python
target_dt = dateparser.parse(
    time_description, 
    settings={'PREFER_DATES_FROM': 'future'}
)
wait_seconds = (target_dt - now).total_seconds()
time.sleep(wait_seconds)
```

### 呼吸动画

```python
def animate(self):
    self.scale = 1.0 + 0.06 * math.sin(self.angle)
    self.angle += 0.06
    # 每30ms更新一次
    self.root.after(30, self.animate)
```

### 圆角矩形绘制

插件自定义了Canvas的`create_rounded_rectangle`方法，使用多边形逼近圆角。

## 调用示例

```
<<<[TOOL_REQUEST]>>>
tool_name:「始」VCPAlarm