# 🖼️ ImageServer (私有图床) 插件小白教程

## 1. 这是什么？
这是一个**安全的图片仓库**。
当 AI 画了一张图，或者你上传了一张私密照片，这些图片需要一个地方存着。
ImageServer 就在你的电脑上搭建了一个受**密码保护**的图片网站，外人无法偷看。

## 2. 怎么配置？
打开 `plugin-manifest.json` 或 `config.env` 查看配置：

```ini
# 设置访问密码
Image_Key=MySecretImageKey
```

## 3. 怎么使用？
通常是**其他插件自动调用**它。
比如 `GeminiImageGen` 画完图后，会把图存在这里，然后发给你一个链接：
`http://localhost/pw=MySecretImageKey/images/drawing.png`

**手动使用：**
把图片扔进 `E:\VCP\image` 文件夹，然后用上面的链接格式访问。

**安全提示：**
只要不把 `Image_Key` 泄露给别人，你的图片就是安全的。