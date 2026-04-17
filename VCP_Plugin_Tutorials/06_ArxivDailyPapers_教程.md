# 📑 ArxivDailyPapers (论文日报) 插件小白教程

## 1. 这是什么？
这是一个**“学霸插件”**。
它会自动去 arXiv（全球最大的论文预印本网站）上，把你感兴趣领域的最新论文抓取下来，塞给你的 AI。
这样，你的 AI 就不再是只会聊天的机器人，而是一个**紧跟科技前沿的研究员**。

## 2. 怎么配置？
你需要告诉插件：**你对什么感兴趣？**

1.  打开文件夹：`E:\VCP\Plugin\ArxivDailyPapers`
2.  把 `config.env.example` 复制并重命名为 `config.env`。
3.  用记事本打开，修改 `ARXIV_SEARCH_TERMS` 这一行：

**如果你是程序员，想看大模型：**
```ini
ARXIV_SEARCH_TERMS='all:("Large Language Models" OR "ChatGPT" OR "Llama")'
```

**如果你是生物学家，想看基因测序：**
```ini
ARXIV_SEARCH_TERMS='all:("Genomics" OR "DNA Sequencing")'
```

4.  保存文件，重启 VCP。

## 3. 怎么使用？
这个插件是**被动触发**的。
你不需要专门调用它。只要配置好了，每隔 30 分钟它就会自动更新一次论文列表。

你只需要在**角色卡**里写上一句：
> “请根据 {{ArxivDailyPapersData}} 里的最新论文，每天早上给我总结一下昨天有什么新发现。”

**效果：**
AI 会读取那个变量里的论文摘要，然后告诉你：“主人，昨天有篇关于 GPT-5 的新论文发布了，核心观点是……”