# 🔖 KarakeepSearch (书签搜索) 插件小白教程

## 1. 这是什么？
如果你是 **Karakeep**（一个稍后读/书签管理工具）的用户，这个插件能让 AI 读取你的收藏夹。
AI 会变成你的**知识库管理员**。

## 2. 怎么配置？
打开 `config.env`：

```ini
# 你的 Karakeep 服务器地址
KARAKEEP_API_ADDR=https://karakeep.yourdomain.com
# API Key
KARAKEEP_API_KEY=xxxxxx
```

## 3. 怎么使用？
**场景：找回记忆**
> **你**：我记得我收藏过一篇关于“Rust 异步编程”的文章，帮我找找。
> **AI**：(调用 SearchBookmarks) 找到了，你收藏了《Rust Async: A Deep Dive》，链接是...

**场景：基于收藏回答**
> **你**：根据我收藏夹里关于“健康饮食”的内容，给我制定一个食谱。
> **AI**：根据你收藏的《地中海饮食指南》，建议你...

**高级搜索：**
支持 `is:fav` (只搜星标)、`#tag` (按标签搜) 等语法。