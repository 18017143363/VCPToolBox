# 🎨 ComfyUIGen (AI绘画连接器) 插件小白教程

## 1. 这是什么？
这是一个**“遥控器”**。
它本身不画图，而是连接你电脑上安装的 **ComfyUI**（一种强大的 AI 绘画软件）。
通过这个插件，你的 AI 助手就可以指挥 ComfyUI 画出各种精美的图片。

## 2. 怎么配置？
**前提**：你电脑上必须已经安装并运行了 [ComfyUI](https://github.com/comfyanonymous/ComfyUI)。

1.  找到文件：`E:\VCP\Plugin\ComfyUIGen\comfyui-settings.json`
2.  修改连接地址：
    ```json
    {
      "serverUrl": "http://127.0.0.1:8188",  // 你的 ComfyUI 地址
      "workflow": "text2img_basic"           // 默认使用的工作流模板
    }
    ```
3.  **进阶**：如果你有自己调好的工作流（Workflow），可以把它保存为 `.json` 放到 `workflows` 文件夹里，让 AI 使用。

## 3. 怎么使用？
配置好后，AI 就拥有了画师的技能。

**基础画图：**
> **你**：用 ComfyUI 帮我画一个在雨中撑伞的赛博朋克少女。
> **AI**：(将提示词填入模板 -> 发送给 ComfyUI -> 获取图片)
> **AI**：画好了！图片保存在 Output 文件夹。

**指定参数：**
> **你**：画一只猫，宽高都要 512，步数 20。
> **AI**：收到，调整参数 `width=512`, `steps=20`... 开始生成。

**注意：**
这需要你的显卡足够强大，且 ComfyUI 必须在后台开着！