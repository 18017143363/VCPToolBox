# ✈️ TelegramBot (电报机器人) 插件小白教程

## 1. 这是什么？
它让你的 AI 能够登录 **Telegram**。
你可以把 AI 拉进你的群聊，或者直接私聊它。
这样，你出门在外，也能通过手机上的 Telegram 跟家里的 VCP 电脑对话。

## 2. 怎么配置？
1.  在 Telegram 上找 @BotFather 申请一个 Bot，拿到 Token。
2.  打开 `config.env`：
    ```ini
    TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
    ALLOWED_USER_IDS=12345678 (只允许你跟它说话，防止被蹭)
    ```

## 3. 怎么使用？
**功能一：远程聊天**
掏出手机，给你的 Bot 发消息：“家里电脑开着吗？”
AI 回复：“开着呢，CPU 温度 45 度。”

**功能二：群聊助手**
把它拉进群里。
大家问：“@MyBot 今天天气怎么样？”
AI 回复：“今天晴转多云。”

**这是实现 VCP“移动端访问”最简单的办法。**