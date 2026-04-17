# 📚 CrossRefDailyPapers (全科文献日报) 插件小白教程

## 1. 这是什么？
这是之前的 Arxiv 插件的**“加强版兄弟”**。
Arxiv 主要偏向计算机和物理数学，而 **CrossRef** 涵盖了医学、生物、社会科学等几乎所有学科。
它同样会每天自动抓取最新的论文，喂给你的 AI。

## 2. 怎么配置？
你需要告诉它你想看哪个领域的书。

1.  打开 `E:\VCP\Plugin\CrossRefDailyPapers`
2.  将 `config.env.example` 重命名为 `config.env`。
3.  修改查询关键词 `CROSSREF_QUERY_BIBLIOGRAPHIC`：

**如果你关注医学：**
```ini
CROSSREF_QUERY_BIBLIOGRAPHIC='"cancer immunotherapy" OR "T-cell"'
```

**如果你关注心理学：**
```ini
CROSSREF_QUERY_BIBLIOGRAPHIC='"cognitive behavioral therapy" OR "depression"'
```

## 3. 怎么使用？
这也是一个**被动技能**。
设置好后，它每 30 分钟刷新一次数据。

**植入记忆：**
在 AI 的角色卡或 System Prompt 里加入：
> `{{CrossRefDailyPapersData}}`

**使用示例：**
> **你**：最近在癌症免疫疗法方面有什么新进展吗？
> **AI**：(读取变量里的数据) 根据 CrossRef 的最新收录，昨天有一篇关于 CAR-T 细胞治疗的论文...

**小贴士：**
你可以同时开启 Arxiv 和 CrossRef 两个插件，让 AI 变成全知全能的超级学者！