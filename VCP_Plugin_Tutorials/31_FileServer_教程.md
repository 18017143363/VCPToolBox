# 🔒 FileServer (私有文件柜) 插件小白教程

## 1. 这是什么？
你有一些私密文件（照片、文档）想给 AI 看，但又不想上传到云端？
**FileServer** 会在你的电脑上开一个**带密码保护**的小型网站。
只有拥有密码的人（比如你的 AI）才能访问里面的文件。

## 2. 怎么配置？
打开 `E:\VCP\Plugin\FileServer\config.env`：

```ini
# 设置一个访问密码
File_Key=MySecretPassword123
```

## 3. 怎么使用？
1.  把你想分享的文件放到 `E:\VCP\file` 文件夹里。
2.  告诉 AI 文件的链接格式：`/pw=MySecretPassword123/files/你的文件名`

**配合 FileListGenerator 使用效果更佳：**
AI 会自动知道链接格式，你只需要说：
> **你**：把 `photo.jpg` 发给我看看。
> **AI**：好的，点击这里查看：[photo.jpg](http://localhost/pw=xxx/files/photo.jpg)