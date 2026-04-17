# 🔍 GoogleSearch (谷歌搜索) 插件小白教程

## 1. 这是什么？
最经典的**联网插件**。
当 AI 遇到不知道的事情（比如今天的汇率、刚才发生的新闻），它会去 Google 搜一下。

## 2. 怎么配置？
这个配置稍微麻烦一点，需要两个东西：
1.  **API Key**: 在 Google Cloud Console 申请 Custom Search API。
2.  **CX (搜索引擎ID)**: 在 Google Programmable Search Engine 网站创建一个搜索引擎。

打开 `config.env`：
```ini
GOOGLE_SEARCH_API=你的Key
GOOGLE_CX=你的CX ID
# 如果你在国内，可能需要配置代理端口
GOOGLE_PROXY_PORT=7890
```

## 3. 怎么使用？
直接问 AI 任何需要联网的问题。

> **你**：VCP 插件开发文档在哪里？
> **AI**：(调用 GoogleSearch 搜索 "VCP 插件开发文档")
> **AI**：我找到了官方文档的链接...

> **你**：今天美元兑人民币汇率是多少？
> **AI**：(搜索 "USD to CNY rate") 今天的汇率是 7.25。

**为什么有了 DeepSearch 还要它？**
GoogleSearch 响应快、便宜，适合查简单的事实。DeepSearch 适合做复杂的深度调研。