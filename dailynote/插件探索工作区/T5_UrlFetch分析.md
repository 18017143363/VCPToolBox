# UrlFetch 插件技术文档（完整版）

**分析时间**: 2026-02-07 22:00
**分析者**: Rosa
**版本**: 重新分析（完整源码）

---

## 概述

UrlFetch是VCP的网页内容抓取插件，使用Puppeteer无头浏览器获取网页内容。支持两种模式：文本提取和网页截图。集成了反爬虫技术和智能内容提取。

## 插件信息

| 属性 | 值 |
|------|-----|
| 路径 | `E:\VCP\Plugin\UrlFetch` |
| 类型 | synchronous |
| 协议 | stdio |
| 入口 | node UrlFetch.js |
| 超时 | 60秒 |
| 版本 | 0.1.0 |
| 大小 | UrlFetch.js (15.57 KB) |
| 作者 | Lionsky |

## 文件结构

| 文件 | 大小 | 说明 |
|------|------|------|
| plugin-manifest.json | 1.69 KB | 插件清单 |
| UrlFetch.js | 15.57 KB | 主程序 |
| README.md | 7.43 KB | 详细使用说明 |
| config.env | - | 配置文件 |

## 两种模式

### 1. text 模式（默认）

**功能**: 智能提取网页的文本内容或链接列表

**提取策略**:
1. 优先尝试作为聚合页提取分类链接
2. 如果失败，使用Readability提取文章正文

**返回格式**:
- 聚合页: Markdown格式的分类链接列表
- 文章页: `标题: xxx\n\n正文内容`

### 2. snapshot 模式

**功能**: 获取网页的完整长截图

**返回内容**:
- Base64编码的PNG图片
- 可访问的图片URL
- 页面标题
- HTML img标签（可直接展示）

**存储路径**: `{PROJECT_BASE_PATH}/image/urlfetch/{uuid}.png`

## 调用参数

| 参数 | 必需 | 默认值 | 说明 |
|------|------|--------|------|
| url | 是 | - | 目标网页URL（必须以http://或https://开头）|
| mode | 否 | text | 模式：'text' 或 'snapshot' |

## 核心技术机制

### 1. 反爬虫技术栈

```javascript
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const AnonymizeUAPlugin = require('puppeteer-extra-plugin-anonymize-ua');

puppeteer.use(StealthPlugin());
puppeteer.use(AnonymizeUAPlugin());
```

| 插件 | 功能 |
|------|------|
| StealthPlugin | 隐藏Puppeteer特征，绕过反爬检测 |
| AnonymizeUAPlugin | 自动匿名化User-Agent |

### 2. 自动滚动加载

```javascript
async function autoScroll(page, mode = 'text') {
    const maxScrolls = mode === 'snapshot' ? 3 : 5;
    // 滚动到底部，等待懒加载内容
    // 检测页面高度变化，确保内容加载完成
}
```

| 模式 | 最大滚动次数 |
|------|-------------|
| text | 5次 |
| snapshot | 3次 |

### 3. 三种Cookie配置方式

**优先级**: FETCH_COOKIES_RAW_MULTI > FETCH_COOKIES_RAW > FETCH_COOKIES

#### 方式1: FETCH_COOKIES_RAW_MULTI（推荐）

多站点配置，自动根据URL匹配对应Cookie：

```env
FETCH_COOKIES_RAW_MULTI={"bilibili.com":"SESSDATA=xxx; bili_jct=yyy","twitter.com":"auth_token=aaa"}
```

#### 方式2: FETCH_COOKIES_RAW

单站点原始Cookie字符串：

```env
FETCH_COOKIES_RAW=SESSDATA=abc123; bili_jct=xyz789
```

#### 方式3: FETCH_COOKIES

JSON数组格式，精细控制：

```env
FETCH_COOKIES=[{"name":"session_id","value":"abc123","domain":".example.com"}]
```

### 4. 智能内容提取

#### 聚合页提取（优先）

```javascript
// 检测特征：span.text-xl.font-bold 作为分类标题
// 在最近的卡片容器中提取链接
// 过滤短链接（title.length > 5）
// 去重处理
```

#### 文章正文提取（回退）

```javascript
const { Readability } = require('@mozilla/readability');
const { JSDOM } = require('jsdom');

const doc = new JSDOM(pageContent, { url });
const reader = new Readability(doc.window.document);
const article = reader.parse();
```

### 5. 广告过滤选择器

```javascript
const AD_SELECTORS = [
    'script', 'style', 'iframe', 'ins', '.ads', '[class*="ads"]',
    '[id*="ads"]', '.advertisement', '.banner', '.popup',
    'nav', 'aside', 'footer', '[aria-hidden="true"]'
];
```

### 6. 代理重试机制

```javascript
try {
    fetchedData = await fetchWithPuppeteer(url, mode);
} catch (e) {
    const proxyPort = process.env.FETCH_PROXY_PORT;
    if (proxyPort) {
        // 通过代理重试
        fetchedData = await fetchWithPuppeteer(url, mode, proxyPort);
    }
}
```

## 配置项

| 配置 | 说明 |
|------|------|
| FETCH_PROXY_PORT | 代理端口（可选）|
| FETCH_COOKIES_RAW_MULTI | 多站点Cookie（JSON对象）|
| FETCH_COOKIES_RAW | 单站点Cookie（原始字符串）|
| FETCH_COOKIES | Cookie数组（JSON格式）|

## 依赖库

| 库 | 用途 |
|----|------|
| puppeteer-extra | Puppeteer增强版 |
| puppeteer-extra-plugin-stealth | 反检测 |
| puppeteer-extra-plugin-anonymize-ua | UA匿名 |
| @mozilla/readability | 正文提取 |
| jsdom | DOM解析 |
| uuid | 文件命名 |
| dotenv | 环境变量 |

## 调用示例

### 获取文本内容

```
<<<[TOOL_REQUEST]>>>
tool_name:「始」UrlFetch