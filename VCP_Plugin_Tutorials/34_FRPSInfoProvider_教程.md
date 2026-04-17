# 🌐 FRPSInfoProvider (内网穿透监控) 插件小白教程

## 1. 这是什么？
如果你是技术宅，家里肯定跑了 **FRP** (内网穿透) 服务。
这个插件能让 AI 实时监控你的 FRP 服务器状态。
AI 会知道：现在有几个设备连进来了？哪个端口是通的？流量用了多少？

## 2. 怎么配置？
打开 `config.env`，填入你的 FRPS 看板信息：

```ini
FRPSBaseUrl=https://frps.yourdomain.com
FRPSAdminUser=admin
FRPSAdminPassword=your_password
```

## 3. 怎么使用？
**被动技能。**
在 AI 的 Prompt 里加入 `{{FRPSAllProxyInfo}}`。

**场景：**
> **你**：我家里的 NAS 现在连上了吗？
> **AI**：(查看状态) 连上了，`nas_ssh` 代理在线，端口是 6000。

> **你**：现在有几个服务在线？
> **AI**：一共有 5 个服务在线，包括 Minecraft 服务器和 Web 网站。

**注意**：这需要你自己搭建了 FRP 服务器才能用。