# 🌳 FileTreeGenerator (目录树生成器) 插件小白教程

## 1. 这是什么？
如果你让 AI 帮你写代码，它首先得知道你的项目长什么样（有哪些文件夹、哪些文件）。
**FileTreeGenerator** 会自动扫描指定目录，生成一棵“目录树”，并实时喂给 AI。

## 2. 怎么配置？
打开 `E:\VCP\Plugin\FileTreeGenerator\config.env`：

```ini
# 你想让 AI 监控哪个文件夹？
TARGET_DIRECTORY=E:\MyProject

# 哪些文件夹不用看？(逗号分隔)
EXCLUDE_DIRS=.git,node_modules,dist
```

## 3. 怎么使用？
这是一个**被动技能**。
在 AI 的 Prompt 里加入 `{{VCPFilestructureInfo}}`。

**效果：**
AI 的脑子里会始终有一张最新的地图：
```
MyProject
├── src
│   ├── main.js
│   └── utils.js
└── README.md
```
当你问：“`utils.js` 在哪？”时，它不用搜就知道。