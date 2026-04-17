# MediaShot 插件技术文档

**分析时间**: 2026-02-07 21:48
**分析者**: Rosa

---

## 概述

MediaShot是VChat分布式服务器的多媒体处理插件，支持视频片段截取、音频片段截取、图像区域截取和编辑等功能。

## 插件信息

| 属性 | 值 |
|------|-----|
| 路径 | `E:\VCPCHAT\VCPDistributedServer\Plugin\MediaShot` |
| 类型 | synchronous |
| 协议 | stdio |
| 入口 | python media_shot.py |
| 超时 | 60秒 |
| 版本 | 1.1.0 |
| 大小 | media_shot.py (55KB) |
| 依赖 | FFmpeg, PIL |

## 7个命令详解

### 1. CaptureFrame - 视频截图

**功能**: 从视频中捕获指定时间点的帧截图

**参数**:
| 参数 | 必需 | 说明 |
|------|------|------|
| videoPath | 是 | 视频文件路径 |
| timestampMs | 是 | 时间点（毫秒）|
| outputPath | 否 | 输出路径 |
| quality | 否 | 图片质量(1-100) |
| format | 否 | 输出格式(jpg/png) |

### 2. ExtractVideoClip - 视频片段截取

**功能**: 从视频中截取指定时间段的片段

**参数**:
| 参数 | 必需 | 说明 |
|------|------|------|
| videoPath | 是 | 视频文件路径 |
| startMs | 是 | 开始时间（毫秒）|
| endMs | 是 | 结束时间（毫秒）|
| outputPath | 否 | 输出路径 |
| quality | 否 | 质量(low/medium/high) |

### 3. ExtractAudioClip - 音频片段截取

**功能**: 从音频或视频中截取音频片段

**参数**:
| 参数 | 必需 | 说明 |
|------|------|------|
| audioPath | 是 | 音频/视频文件路径 |
| startMs | 是 | 开始时间（毫秒）|
| endMs | 是 | 结束时间（毫秒）|
| outputPath | 否 | 输出路径 |
| format | 否 | 格式(mp3/wav/aac) |

### 4. CropImage - 图片区域截取

**功能**: 截取图片的指定区域（按比例参数）

**参数**:
| 参数 | 必需 | 说明 |
|------|------|------|
| imagePath | 是 | 图片文件路径 |
| x | 是 | 左上角X比例(0.0-1.0) |
| y | 是 | 左上角Y比例(0.0-1.0) |
| width | 是 | 宽度比例(0.0-1.0) |
| height | 是 | 高度比例(0.0-1.0) |
| outputPath | 否 | 输出路径 |

### 5. EditImage - 图片编辑

**功能**: 在图片上绘制框、圆、箭头、文字或应用特效

**支持的编辑类型**:
| 类型 | 说明 | 特有参数 |
|------|------|----------|
| rectangle | 矩形框 | width, height |
| circle | 圆形框 | radius |
| text | 文字注释 | text, textPosition |
| arrow | 箭头 | arrowEndX, arrowEndY |
| resolution_reduction | 分辨率下降 | scaleRatio(0.1-1.0) |
| grayscale | 黑白特效 | 无 |
| crop_region | 区域截取 | width, height |

**通用参数**:
| 参数 | 说明 |
|------|------|
| color | 颜色(red/#FF0000) |
| fontSize | 字体大小比例(0.0-1.0) |
| strokeWidth | 线条宽度比例(0.0-1.0) |

### 6. BatchEditImage - 批量编辑

**功能**: 逐步应用多个编辑操作

**参数**:
| 参数 | 必需 | 说明 |
|------|------|------|
| imagePath | 是 | 图片文件路径 |
| edits | 是 | 编辑操作数组(JSON) |
| outputPath | 否 | 输出路径 |

**操作顺序原则**:
1. 先应用特效（resolution_reduction, grayscale）
2. 再绘制元素（rectangle, circle, text, arrow）
3. crop_region必须放最后

### 7. CombinedCapture - 组合功能

**功能**: 先从视频截图，然后立即编辑

**参数**: 结合CaptureFrame和EditImage的参数

## 核心技术机制

### 比例参数系统

所有坐标和尺寸都使用0.0-1.0的比例值：
- 0.0 = 左上角/最小值
- 1.0 = 右下角/最大值
- 自动适配不同分辨率的图片

### 智能尺寸计算

```python
def calculate_smart_stroke_width(image_width, image_height, stroke_ratio=0.002):
    diagonal = math.sqrt(image_width ** 2 + image_height ** 2)
    return max(1, int(diagonal * stroke_ratio))

def calculate_smart_font_size(image_width, image_height, font_ratio=0.03):
    min_dimension = min(image_width, image_height)
    return max(12, int(min_dimension * font_ratio))
```

### 跨平台字体支持

自动搜索系统字体：
- macOS: Hiragino Sans GB, PingFang
- Windows: 微软雅黑, 宋体
- Linux: Noto Sans CJK, 文泉驿

### FFmpeg集成

- 视频截图: `-ss` 定位 + `-vframes 1`
- 视频截取: `-ss` + `-t` + libx264编码
- 音频截取: `-ss` + `-t` + `-vn`

### 输出文件命名

```
{原文件名}_{操作类型}_{时间戳}.{扩展名}
```

## 配置项

| 配置 | 默认值 | 说明 |
|------|--------|------|
| OUTPUT_QUALITY | 90 | 输出图片质量 |
| OUTPUT_FORMAT | jpg | 输出图片格式 |
| DEFAULT_FONT_SIZE | 20 | 默认字体大小 |
| DEFAULT_STROKE_WIDTH | 2 | 默认线条宽度 |

## 使用场景

1. **视频教程制作** - 截取关键帧并添加标注
2. **图片标注** - 在截图上画框、加文字
3. **音频剪辑** - 从视频/音频中提取片段
4. **批量处理** - 一次性应用多个编辑

## 注意事项

1. **依赖FFmpeg** - 必须安装FFmpeg
2. **比例参数** - 所有坐标用0.0-1.0比例
3. **操作顺序** - 批量编辑时注意顺序
4. **超时60秒** - 大文件处理可能需要更长时间

---

Tag: VChat文档, MediaShot, 多媒体处理, 视频截图, 图片编辑, FFmpeg