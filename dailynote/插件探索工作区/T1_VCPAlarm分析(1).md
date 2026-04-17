# T1 - VCPAlarm 插件深度分析

**分析时间**: 2026-02-07 21:45
**分析者**: Rosa

---

## 概述

VCPAlarm是VChat分布式服务器的闹钟插件，采用**双脚本分离设计**实现定时提醒功能。

## 插件信息

| 属性 | 值 |
|------|-----|
| 路径 | VCPDistributedServer/Plugin/VCPAlarm |
| 类型 | synchronous |
| 协议 | stdio |
| 入口 | python set_alarm.py |
| 超时 | 10秒 |
| 版本 | 1.0.0 |

## 架构设计：双脚本分离模式

### 为什么需要分离？

| 问题 | 解决方案 |
|------|----------|
| 插件超时限制（10秒） | set_alarm.py 立即返回 |
| 闹钟需要长时间等待 | run_alarm.py 后台独立运行 |
| 进程生命周期 | DETACHED_PROCESS 确保独立 |

### 执行流程

```
用户调用 VCPAlarm(time_description="5分钟后")
    ↓
set_alarm.py
    ├── 1. 从stdin读取JSON参数
    ├── 2. 准备资源路径（音频、图片）
    ├── 3. subprocess.Popen启动run_alarm.py
    │      └── creationflags=DETACHED_PROCESS (Windows)
    └── 4. 立即返回成功消息
    
run_alarm.py (独立后台进程)
    ├── 1. dateparser解析自然语言时间
    ├── 2. time.sleep()等待到目标时间
    ├── 3. 创建tkinter GUI窗口
    ├── 4. pygame播放铃声（循环）
    └── 5. 用户点击关闭按钮结束
```

## set_alarm.py 分析 (2.55 KB)

### 核心逻辑

```python
# 启动后台进程
command = [
    sys.executable,      # 当前Python解释器
    run_alarm_script_path,
    time_description,    # 时间描述
    audio_path,          # 铃声路径
    image_path           # 头像路径
]

# Windows独立进程
if sys.platform == "win32":
    creation_flags = subprocess.DETACHED_PROCESS

subprocess.Popen(command, creationflags=creation_flags, close_fds=True)
```

### 返回格式

```json
{
    "status": "success",
    "result": "好的，您的闹钟已经设定成功。时间：5分钟后"
}
```

## run_alarm.py 分析 (18.63 KB)

### 依赖库

| 库 | 用途 |
|----|------|
| dateparser | 自然语言时间解析 |
| pygame | 音频播放 |
| Pillow | 图像处理 |
| tkinter | GUI框架 |

### 时间解析

```python
target_dt = dateparser.parse(
    time_description, 
    settings={'PREFER_DATES_FROM': 'future'}
)
```

支持的时间格式：
- 相对时间："5分钟后"、"1小时后"、"明天"
- 绝对时间："晚上10点30分"、"22:30"
- 混合格式："明天早上8点"

### 日夜主题系统

```python
is_day = 6 <= now.hour < 18

if is_day:
    # 浅色主题
    theme = {
        "bg": (240, 240, 240, 255),
        "accent": "#3498db",  # 蓝色
        ...
    }
else:
    # 深色主题
    theme = {
        "bg": (45, 45, 58, 255),
        "accent": "#8a74f9",  # 紫色
        ...
    }
```

### GUI特性

| 特性 | 实现方式 |
|------|----------|
| 圆角窗口 | Pillow绘制 + transparentcolor |
| 阴影效果 | 多层渐变 + GaussianBlur |
| 呼吸动画 | sin函数控制scale |
| 淡入效果 | alpha透明度渐变 |
| 可拖动 | 鼠标事件绑定 |
| 实时时钟 | 每秒更新 |

### AlarmWindow类核心方法

| 方法 | 功能 |
|------|------|
| set_theme() | 根据时间设置日/夜主题 |
| create_rounded_window() | 创建圆角阴影窗口 |
| load_agent_image() | 加载圆形头像+发光边框 |
| create_ui_elements() | 创建时间、日期、按钮 |
| animate() | 呼吸动画（30ms间隔） |
| update_time() | 更新时钟（1秒间隔） |
| fade_in() | 淡入动画（15ms间隔） |
| play_sound() | pygame循环播放铃声 |

## 文件结构

```
VCPDistributedServer/Plugin/VCPAlarm/
├── plugin-manifest.json  (1.16 KB) - 插件清单
├── set_alarm.py          (2.55 KB) - 入口脚本
├── run_alarm.py          (18.63 KB) - GUI主程序
├── AlarmRing.mp3         - 铃声文件
└── VCPAgent.png          - 闹钟头像
```

## 调用示例

```
tool_name: VCPAlarm
time_description: 5分钟后提醒我
```

## 设计亮点

1. **双脚本分离** - 完美解决插件超时与长时等待的矛盾
2. **自然语言时间** - dateparser支持多种时间表达
3. **日夜主题** - 根据时间自动切换视觉风格
4. **精美GUI** - 圆角、阴影、动画一应俱全
5. **进程独立** - DETACHED_PROCESS确保闹钟不受VCP影响

## 注意事项

1. 需要安装依赖：`pip install dateparser pygame Pillow`
2. 过去的时间不会设置闹钟（有警告提示）
3. 铃声循环播放直到用户关闭
4. Windows使用DETACHED_PROCESS，Linux/macOS使用默认行为

---

**分析完成** ✅