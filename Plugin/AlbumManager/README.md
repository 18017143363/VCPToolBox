# AlbumManager - VCP相册管理插件

> 作者: Rosa | 版本: 1.1.0 | 类型: synchronous

## 概述

AlbumManager是VCP的相册管理插件，将原本繁琐的"三步走SOP"（复制图片→更新txt索引→写元数据日记）整合为**一次工具调用**。

支持四层一致性自动维护：
1. **物理文件** - 图片落盘到 `image/{albumName}/`
2. **txt索引** - 更新 `generated_lists/{albumName}.txt`
3. **emoticon_library.json** - 直接写入VChat磁盘缓存
4. **元数据日记** - 写入 `dailynote/{maid}相册索引/`

## 安装

插件目录：`E:\VCP\Plugin\AlbumManager\`

```
AlbumManager/
├── plugin-manifest.json   # 插件清单
├── AlbumManager.js        # 主程序
├── config.env             # 配置文件
└── README.md              # 本文件
```

安装后需**重启VCP**加载插件。

## 配置 (config.env)

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| VCHAT_GENERATED_LISTS_PATH | VChat索引目录路径 | E:\VCPCHAT\AppData\generated_lists |
| EMOTICON_LIBRARY_PATH | emoticon_library.json路径 | 同上目录下 |
| EMOTICON_SERVER_HOST | 文件服务器主机 | 127.0.0.1 |
| EMOTICON_SERVER_PORT | 文件服务器端口 | 6005 |
| EMOTICON_FILE_KEY | 文件访问密钥 | 147258369plm |

## 命令: SaveImage

将图片入库到指定相册，自动完成四层一致性更新。

### 参数

| 参数 | 必需 | 类型 | 说明 |
|------|:----:|------|------|
| source | ✅ | string | 图片来源。支持三种格式：本地绝对路径、file://URL、http/https URL |
| albumName | ❌ | string | 目标相册名称，默认 `Rosa相册表情包`。注意：若要在VChat表情包面板中显示，名称必须以"表情包"结尾 |
| fileName | ❌ | string | 保存的文件名（含扩展名）。未传则自动生成 `album_{timestamp}_{random}.{ext}` |
| title | ❌ | string | 图片标题，写入元数据日记 |
| description | ❌ | string | 图片描述，写入元数据日记 |
| prompt | ❌ | string | 生成该图片时使用的提示词，写入元数据日记 |
| tags | ❌ | string/array | 标签，写入元数据日记的Tag行。支持逗号分隔字符串或数组 |
| maid | ❌ | string | 归属Agent名称，默认 `Rosa`。决定元数据日记写入哪个索引目录 |

### 返回值

```json
{
  "status": "success",
  "result": {
    "albumName": "Rosa相册表情包",
    "fileName": "example_20260220.jpg",
    "localPath": "E:\\VCP\\image\\Rosa相册表情包\\example_20260220.jpg",
    "publicUrl": "http://localhost:6005/pw=.../images/Rosa%E7%9B%B8.../example_20260220.jpg",
    "listPath": "E:\\VCPCHAT\\AppData\\generated_lists\\Rosa相册表情包.txt",
    "diaryPath": "E:\\VCP\\dailynote\\Rosa相册索引\\2026-02-20-15_00_00.txt",
    "libraryUpdated": true
  },
  "messageForAI": "相册入库成功：..."
}
```

### 调用示例

**说明：`<*3` 代表 `<<<`，`>*3` 代表 `>>>`，实际使用时请替换回来。**

基本用法（仅必需参数）：
```
<*3[TOOL_REQUEST]>*3
maid:「始」Rosa「末」,
tool_name:「始」AlbumManager「末」,
command:「始」SaveImage「末」,
source:「始」E:\VCP\image\grokimage\grok_xxx.jpg「末」
<*3[END_TOOL_REQUEST]>*3
```

完整用法（所有参数）：
```
<*3[TOOL_REQUEST]>*3
maid:「始」Rosa「末」,
tool_name:「始」AlbumManager「末」,
command:「始」SaveImage「末」,
source:「始」E:\VCP\image\grokimage\grok_xxx.jpg「末」,
albumName:「始」Rosa相册表情包「末」,
fileName:「始」my_photo_20260220.jpg「末」,
title:「始」我的照片「末」,
description:「始」一张很好看的照片「末」,
prompt:「始」A beautiful anime girl...「末」,
tags:「始」自拍, 女仆装, Grok生成「末」,
maid:「始」Rosa「末」
<*3[END_TOOL_REQUEST]>*3
```

从URL入库：
```
<*3[TOOL_REQUEST]>*3
maid:「始」Rosa「末」,
tool_name:「始」AlbumManager「末」,
command:「始」SaveImage「末」,
source:「始」https://example.com/image.png「末」,
albumName:「始」Rosa相册表情包「末」,
fileName:「始」downloaded_photo.png「末」
<*3[END_TOOL_REQUEST]>*3
```

## 注意事项

1. **相册命名约束**：VChat前端只扫描文件名以"表情包.txt"结尾的索引文件，因此albumName建议以"表情包"结尾
2. **文件名冲突**：同名文件自动添加序号 `(1)` `(2)` ...，不会覆盖
3. **扩展名处理**：fileName中已有扩展名则直接使用，否则从source推断
4. **emoticon_library.json**：写入失败不阻断主流程，返回 `libraryUpdated: false`
5. **VChat内存缓存**：入库后VChat运行中的内存缓存不会自动刷新，重启VChat或重开表情包面板后可见
6. **Electron图片缓存**：同名URL可能显示旧图，重启VChat可清除

## 开发历史

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.0.0 | 2026-02-20 | 初版：三层一致性（物理文件+txt索引+元数据日记） |
| 1.1.0 | 2026-02-20 | 方案C：新增emoticon_library.json直接写入，升级为四层一致性 |