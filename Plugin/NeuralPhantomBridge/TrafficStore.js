/**
 * TrafficStore.js — NeuralPhantomBridge 内存流量存储
 * 
 * 环形缓冲区设计，自动淘汰旧数据，支持多维查询。
 * 存储四类数据：HTTP请求、安全告警、加密事件、WebSocket帧。
 * 
 * @author Rosa
 * @version 1.0.0
 */

class TrafficStore {
    constructor(options = {}) {
        this.maxRequests = options.maxRequests || 1000;
        this.maxAlerts = options.maxAlerts || 200;
        this.maxCryptoEvents = options.maxCryptoEvents || 500;
        this.maxWsFrames = options.maxWsFrames || 500;

        this.requests = [];
        this.alerts = [];
        this.cryptoEvents = [];
        this.wsFrames = [];

        // 统计计数器（不随淘汰重置）
        this.stats = {
            totalRequests: 0,
            totalAlerts: 0,
            totalCryptoEvents: 0,
            totalWsFrames: 0,
            startTime: Date.now()
        };
    }

    // ══════════ HTTP请求 ══════════

    /**
     * 存入一条HTTP请求记录
     * @param {Object} req - REQUEST_CAPTURED schema
     */
    addRequest(req) {
        req._storeTime = Date.now();
        this.stats.totalRequests++;

        // NP may push the same request multiple times: Pending metadata first,
        // then body-ready enriched data. Merge by requestId/id to avoid duplicates.
        const key = req.requestId || req.id;
        if (key) {
            const idx = this.requests.findIndex(r => (r.requestId || r.id) === key);
            if (idx >= 0) {
                this.requests[idx] = { ...this.requests[idx], ...req };
                return;
            }
        }

        this.requests.push(req);
        if (this.requests.length > this.maxRequests) {
            this.requests.shift();
        }
    }

    /**
     * 多维过滤查询请求
     * @param {Object} filter
     * @param {string} [filter.urlContains] - URL包含关键词
     * @param {string} [filter.method] - HTTP方法
     * @param {string} [filter.tags] - 逗号分隔标签
     * @param {number} [filter.statusCode] - 状态码
     * @param {number} [filter.limit=30] - 返回数量
     * @returns {Object} { total, filtered, requests }
     */
    queryRequests(filter = {}) {
        let results = [...this.requests];

        if (filter.urlContains) {
            const kw = filter.urlContains.toLowerCase();
            results = results.filter(r => r.url && r.url.toLowerCase().includes(kw));
        }

        if (filter.method) {
            const m = filter.method.toUpperCase();
            results = results.filter(r => r.method === m);
        }

        if (filter.statusCode) {
            const code = parseInt(filter.statusCode);
            results = results.filter(r => r.status === code);
        }

        if (filter.tags) {
            const tagList = filter.tags.split(',').map(t => t.trim().toLowerCase());
            results = results.filter(r => {
                if (!r.tags || !Array.isArray(r.tags)) return false;
                return tagList.some(tag => r.tags.includes(tag));
            });
        }

        const limit = parseInt(filter.limit) || 30;
        const sliced = results.slice(-limit);

        return {
            total: this.requests.length,
            filtered: results.length,
            returned: sliced.length,
            requests: sliced
        };
    }

    /**
     * 全文搜索流量（URL + Header键值 + Body预览）
     * @param {string} keyword
     * @returns {Array}
     */
    searchTraffic(keyword) {
        if (!keyword) return [];
        const kw = keyword.toLowerCase();
        return this.requests.filter(r => {
            // 搜索URL
            if (r.url && r.url.toLowerCase().includes(kw)) return true;
            // 搜索Body预览
            if (r.bodyPreview && r.bodyPreview.toLowerCase().includes(kw)) return true;
            // 搜索请求头
            if (r.requestHeaders) {
                const headerStr = JSON.stringify(r.requestHeaders).toLowerCase();
                if (headerStr.includes(kw)) return true;
            }
            // 搜索响应头
            if (r.responseHeaders) {
                const headerStr = JSON.stringify(r.responseHeaders).toLowerCase();
                if (headerStr.includes(kw)) return true;
            }
            return false;
        });
    }

    // ══════════ 安全告警 ══════════

    addAlert(alert) {
        alert._storeTime = Date.now();
        this.alerts.push(alert);
        this.stats.totalAlerts++;
        if (this.alerts.length > this.maxAlerts) {
            this.alerts.shift();
        }
    }

    getAlerts(since) {
        if (since) {
            const ts = parseInt(since);
            return this.alerts.filter(a => a._storeTime >= ts);
        }
        return [...this.alerts];
    }

    // ══════════ 加密事件 ══════════

    addCryptoEvent(event) {
        event._storeTime = Date.now();
        this.cryptoEvents.push(event);
        this.stats.totalCryptoEvents++;
        if (this.cryptoEvents.length > this.maxCryptoEvents) {
            this.cryptoEvents.shift();
        }
    }

    getCryptoEvents(since) {
        if (since) {
            const ts = parseInt(since);
            return this.cryptoEvents.filter(e => e._storeTime >= ts);
        }
        return [...this.cryptoEvents];
    }

    // ══════════ WebSocket帧 ══════════

    addWsFrame(frame) {
        frame._storeTime = Date.now();
        this.wsFrames.push(frame);
        this.stats.totalWsFrames++;
        if (this.wsFrames.length > this.maxWsFrames) {
            this.wsFrames.shift();
        }
    }

    getWsFrames(limit) {
        const n = parseInt(limit) || 50;
        return this.wsFrames.slice(-n);
    }

    // ══════════ 统计 ══════════

    getStats() {
        return {
            uptime: Math.floor((Date.now() - this.stats.startTime) / 1000),
            cached: {
                requests: this.requests.length,
                alerts: this.alerts.length,
                cryptoEvents: this.cryptoEvents.length,
                wsFrames: this.wsFrames.length
            },
            total: {
                requests: this.stats.totalRequests,
                alerts: this.stats.totalAlerts,
                cryptoEvents: this.stats.totalCryptoEvents,
                wsFrames: this.stats.totalWsFrames
            },
            limits: {
                maxRequests: this.maxRequests,
                maxAlerts: this.maxAlerts,
                maxCryptoEvents: this.maxCryptoEvents,
                maxWsFrames: this.maxWsFrames
            }
        };
    }

    // ══════════ 管理 ══════════

    clear() {
        this.requests = [];
        this.alerts = [];
        this.cryptoEvents = [];
        this.wsFrames = [];
    }

    clearRequests() {
        this.requests = [];
    }
}

module.exports = TrafficStore;