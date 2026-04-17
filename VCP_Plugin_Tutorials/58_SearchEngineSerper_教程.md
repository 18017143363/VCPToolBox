# 🚀 SearchEngineSerper (Serper搜索) 插件小白教程

## 1. 这是什么？
**Serper** 是目前最受 AI 开发者欢迎的搜索 API。
它其实是把 Google 的搜索结果包装了一下，变得**更快、更便宜、更适合 AI 阅读**。
如果你的 Google API 额度用完了，或者配置太麻烦，Serper 是完美的替代品。

## 2. 怎么配置？
1.  去 [serper.dev](https://serper.dev/) 注册（送免费额度）。
2.  打开 `config.env`：
    ```ini
    SERPER_API_KEY=你的Key
    ```

## 3. 怎么使用？
和 GoogleSearch 一样。
> **你**：搜一下最近的 AI 新闻。
> **AI**：(调用 Serper) 搜索结果如下...

**优点：**
它能返回结构化的数据（比如“知识图谱”、“相关问题”），这让 AI 的回答更有条理。