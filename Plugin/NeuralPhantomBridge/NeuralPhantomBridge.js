/**
 * NeuralPhantomBridge.js — VCP ↔ Neural Phantom 4.7 WebSocket桥接插件
 *
 * hybridservice类型：
 *   - registerRoutes(): 启动WebSocket服务端，注册管理API
 *   - processToolCall(params): 处理41个指令（本地查询 或 转发NP）
 *
 * 通信架构：
 *   NP(Chrome Extension) ←WebSocket:6006→ VCP(本插件) ←processToolCall→ Rosa/Agent
 *
 * @author Rosa
 * @version 1.1.0  (v1.0 → v1.1: 修复 hybridservice 导出格式)
 */

const WebSocket = require('ws');
const TrafficStore = require('./TrafficStore');
const path = require('path');
const fs = require('fs');

// ═══════════════════════════════════════
//  常量
// ═══════════════════════════════════════

const LONG_TIMEOUT = 60000;
const DEFAULT_TIMEOUT = 30000;
const SHORT_TIMEOUT = 10000;

const LONG_TIMEOUT_COMMANDS = new Set([
    'ScanSecurity', 'ExtractEndpoints', 'MineParams',
    'AnalyzeParamSource', 'AnalyzeAuth', 'GetSourceCode'
]);
const SHORT_TIMEOUT_COMMANDS = new Set([
    'GetPrehookStatus', 'SetPrehook', 'GetAttachedTabs', 'GetPerfStats',
    'ClearLogs', 'ResetChain', 'GetCookies', 'DumpStorage'
]);

// 需要转发到NP的指令集
const FORWARD_COMMANDS = new Set([
    'GetFullBody', 'GetCookies', 'DumpStorage', 'GetSourceCode',
    'AnalyzeParamSource', 'AnalyzeAuth', 'GetParamTraces',
    'GetFuncTraces', 'GetChainState',
    'ScanSecurity', 'ExtractEndpoints', 'MineParams',
    'SetBreakpoint', 'ResumeRequest', 'AbortRequest',
    'AddMockRule', 'RemoveMockRule', 'SetDynamicScript',
    'SetHeaderOverride', 'AddUrlReplace', 'SetLocalFileRule',
    'InjectScript', 'ReplayRequest',
    'SetWsRules', 'ResumeWsFrame', 'AbortWsFrame',
    'HarControl', 'ResetChain',
    'GetPrehookStatus', 'SetPrehook', 'GetAttachedTabs', 'GetPerfStats',
    'SetAlertRules', 'TraceFunctions',
    'SearchTraffic'
]);

// ═══════════════════════════════════════
//  模块级状态
// ═══════════════════════════════════════

let config = {};
let store = null;
const clients = new Map();
const pendingRequests = new Map();
let wss = null;
let heartbeatInterval = null;

// ═══════════════════════════════════════
//  配置加载
// ═══════════════════════════════════════

function loadConfig() {
    const defaults = {
        authToken: 'np_bridge_secret_token_change_me',
        wsPort: 6006,
        wsPath: '/np-bridge',
        maxRequests: 1000,
        maxAlerts: 200,
        maxCryptoEvents: 500,
        maxWsFrames: 500,
        maxBodyPreview: 2000
    };

    try {
        const envPath = path.join(__dirname, 'config.env');
        const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
        for (const line of lines) {
            const t = line.trim().replace(/\r/g, '');
            if (!t || t.startsWith('#')) continue;
            const eq = t.indexOf('=');
            if (eq === -1) continue;
            const k = t.slice(0, eq).trim();
            const v = t.slice(eq + 1).trim();

            const map = {
                'NP_AUTH_TOKEN':        () => { defaults.authToken = v; },
                'NP_WS_PORT':           () => { defaults.wsPort = parseInt(v) || 6006; },
                'NP_WS_PATH':           () => { defaults.wsPath = v; },
                'NP_MAX_REQUESTS':      () => { defaults.maxRequests = parseInt(v) || 1000; },
                'NP_MAX_ALERTS':        () => { defaults.maxAlerts = parseInt(v) || 200; },
                'NP_MAX_CRYPTO_EVENTS': () => { defaults.maxCryptoEvents = parseInt(v) || 500; },
                'NP_MAX_WS_FRAMES':     () => { defaults.maxWsFrames = parseInt(v) || 500; },
                'NP_MAX_BODY_PREVIEW':  () => { defaults.maxBodyPreview = parseInt(v) || 2000; }
            };
            if (map[k]) map[k]();
        }
    } catch (e) {
        console.error('[NP-Bridge] Failed to load config.env:', e.message);
    }

    return defaults;
}

// ═══════════════════════════════════════
//  hybridservice 导出: initialize
// ═══════════════════════════════════════

function initialize(pluginConfig) {
    config = loadConfig();
    store = new TrafficStore({
        maxRequests: config.maxRequests,
        maxAlerts: config.maxAlerts,
        maxCryptoEvents: config.maxCryptoEvents,
        maxWsFrames: config.maxWsFrames
    });
    console.log('[NP-Bridge] Initialized with config:', {
        wsPort: config.wsPort, wsPath: config.wsPath,
        maxRequests: config.maxRequests
    });
}

// ═══════════════════════════════════════
//  hybridservice 导出: registerRoutes
// ═══════════════════════════════════════

function registerRoutes(app, pluginConfig, projectBasePath) {
    // VCP hybridservice signature matches ChromeBridge:
    // registerRoutes(app, config, projectBasePath)
    if (!store) initialize(pluginConfig || {});

    startWebSocketServer();
    startHeartbeatCheck();

    // Optional lightweight status endpoint on Express app.
    // Do not assume the second argument is an admin router.
    if (app && typeof app.get === 'function') {
        try {
            app.get('/np-bridge/status', (req, res) => {
                res.json(getStatus());
            });
        } catch (e) {
            console.warn('[NP-Bridge] status route registration skipped:', e.message);
        }
    }

    console.log(`[NP-Bridge] Registered | WebSocket: ws://localhost:${config.wsPort}${config.wsPath}`);
}

// ═══════════════════════════════════════
//  hybridservice 导出: processToolCall
// ═══════════════════════════════════════

async function processToolCall(params) {
    // 确保已初始化
    if (!store) initialize({});

    const command = params.command || params.Command || '';
    if (!command) {
        return { status: 'error', message: 'Missing "command" parameter' };
    }

    try {
        return await dispatchCommand(command, params);
    } catch (err) {
        return {
            status: 'error',
            command: command,
            message: err.message || String(err)
        };
    }
}

// ═══════════════════════════════════════
//  WebSocket 服务端
// ═══════════════════════════════════════

function startWebSocketServer() {
    if (wss) {
        console.log('[NP-Bridge] WebSocket server already started, skip.');
        return;
    }

    wss = new WebSocket.Server({
        port: config.wsPort,
        path: config.wsPath
    });

    wss.on('listening', () => {
        console.log(`[NP-Bridge] WebSocket listening on :${config.wsPort}${config.wsPath}`);
    });

    wss.on('connection', (ws, req) => {
        handleConnection(ws, req);
    });

    wss.on('error', (err) => {
        console.error('[NP-Bridge] WebSocket server error:', err.message);
    });
}

function startHeartbeatCheck() {
    heartbeatInterval = setInterval(() => {
        const now = Date.now();
        for (const [id, client] of clients) {
            if (now - client.lastHeartbeat > 90000) {
                console.log(`[NP-Bridge] Heartbeat timeout: ${id}`);
                client.ws.close(4002, 'Heartbeat timeout');
                clients.delete(id);
            }
        }
    }, 30000);
}

// ═══════════════════════════════════════
//  连接管理 + 认证握手
// ═══════════════════════════════════════

function handleConnection(ws, req) {
    const clientId = `np_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    console.log(`[NP-Bridge] New connection: ${clientId} from ${req.socket.remoteAddress}`);

    ws._authenticated = false;
    ws._clientId = clientId;

    const authTimer = setTimeout(() => {
        if (!ws._authenticated) {
            console.log(`[NP-Bridge] Auth timeout: ${clientId}`);
            ws.close(4001, 'Authentication timeout');
        }
    }, 10000);

    ws.on('message', (raw) => {
        let msg;
        try {
            msg = JSON.parse(raw.toString());
        } catch (e) {
            console.error(`[NP-Bridge] JSON parse error from ${clientId}`);
            return;
        }

        if (!ws._authenticated) {
            if (msg.type === 'HANDSHAKE' && msg.data) {
                if (msg.data.authToken === config.authToken) {
                    ws._authenticated = true;
                    clearTimeout(authTimer);

                    clients.set(clientId, {
                        ws,
                        info: {
                            npVersion: msg.data.version || 'unknown',
                            userAgent: msg.data.userAgent || '',
                            capabilities: msg.data.capabilities || [],
                            connectedAt: Date.now()
                        },
                        lastHeartbeat: Date.now()
                    });

                    sendMsg(ws, {
                        type: 'HANDSHAKE_ACK',
                        direction: 'vcp2np',
                        data: { clientId, status: 'authenticated' }
                    });

                    console.log(`[NP-Bridge] Authenticated: ${clientId} (NP v${msg.data.version || '?'})`);
                } else {
                    console.log(`[NP-Bridge] Auth failed: ${clientId}`);
                    ws.close(4003, 'Invalid auth token');
                }
            }
            return;
        }

        handleMessage(clientId, msg);
    });

    ws.on('close', (code) => {
        clearTimeout(authTimer);
        clients.delete(clientId);
        console.log(`[NP-Bridge] Disconnected: ${clientId} (code=${code})`);
    });

    ws.on('error', (err) => {
        console.error(`[NP-Bridge] Client error ${clientId}:`, err.message);
    });
}

// ═══════════════════════════════════════
//  消息处理（NP → VCP 推送事件）
// ═══════════════════════════════════════

function handleMessage(clientId, msg) {
    const client = clients.get(clientId);
    if (client) client.lastHeartbeat = Date.now();

    switch (msg.type) {
        case 'REQUEST_CAPTURED':
            if (msg.data) store.addRequest(msg.data);
            break;

        case 'SECURITY_ALERT':
            if (msg.data) {
                store.addAlert(msg.data);
                console.log(`[NP-Bridge] Alert [${msg.data.severity}]: ${msg.data.title}`);
            }
            break;

        case 'CRYPTO_EVENT':
            if (msg.data) store.addCryptoEvent(msg.data);
            break;

        case 'WS_FRAME':
            if (msg.data) store.addWsFrame(msg.data);
            break;

        case 'HEARTBEAT':
            if (client) {
                sendMsg(client.ws, {
                    type: 'HEARTBEAT_ACK',
                    direction: 'vcp2np',
                    timestamp: Date.now()
                });
            }
            break;

        default:
            // 指令响应（id配对回调）
            if (msg.id && pendingRequests.has(msg.id)) {
                const pending = pendingRequests.get(msg.id);
                clearTimeout(pending.timer);
                pendingRequests.delete(msg.id);
                pending.resolve({
                    status: 'ok',
                    command: msg.type ? msg.type.replace('_RESPONSE', '') : 'unknown',
                    data: msg.data || {}
                });
            }
            break;
    }
}

// ═══════════════════════════════════════
//  指令调度中心（41个指令）
// ═══════════════════════════════════════

async function dispatchCommand(commandName, params) {

    // ── 本地查询（不需要NP在线） ──
    switch (commandName) {
        case 'Status':
            return getStatus();

        case 'GetTraffic':
            return store.queryRequests(params);

        case 'GetCryptoEvents':
            return {
                status: 'ok',
                events: store.getCryptoEvents(params.since),
                count: store.getCryptoEvents(params.since).length
            };

        case 'GetAlerts':
            return {
                status: 'ok',
                alerts: store.getAlerts(params.since),
                count: store.getAlerts(params.since).length
            };

        case 'GetWsLogs':
            return {
                status: 'ok',
                frames: store.getWsFrames(params.limit),
                count: store.getWsFrames(params.limit).length
            };
    }

    // ── 混合指令（本地+转发） ──
    if (commandName === 'ClearLogs') {
        store.clearRequests();
        const npResult = await forwardToNP('ClearLogs', params).catch(() => null);
        return {
            status: 'ok',
            message: 'Local cache cleared' + (npResult ? ', NP logs cleared' : ', NP not connected')
        };
    }

    // ── SearchTraffic: 默认转发NP，mode=local时搜本地 ──
    if (commandName === 'SearchTraffic') {
        if (!params.keyword) {
            return { status: 'error', message: 'keyword is required' };
        }
        if (params.mode === 'local') {
            const results = store.searchTraffic(params.keyword);
            return { status: 'ok', source: 'local', keyword: params.keyword, results, count: results.length };
        }
        // 默认转发NP（搜完整响应体）
    }

    // ── 需要转发到NP的指令 ──
    if (FORWARD_COMMANDS.has(commandName)) {
        let timeout = DEFAULT_TIMEOUT;
        if (LONG_TIMEOUT_COMMANDS.has(commandName)) timeout = LONG_TIMEOUT;
        if (SHORT_TIMEOUT_COMMANDS.has(commandName)) timeout = SHORT_TIMEOUT;

        return await forwardToNP(commandName, params, timeout);
    }

    return { status: 'error', message: `Unknown command: ${commandName}` };
}

// ═══════════════════════════════════════
//  转发到NP（请求-响应配对）
// ═══════════════════════════════════════

async function forwardToNP(commandName, params, timeout) {
    timeout = timeout || DEFAULT_TIMEOUT;
    const client = getActiveClient();
    if (!client) {
        return {
            status: 'error',
            message: 'Neural Phantom is not connected. Ensure NP is running and bridge is enabled.'
        };
    }

    const msgId = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    return new Promise((resolve) => {
        const timer = setTimeout(() => {
            pendingRequests.delete(msgId);
            resolve({
                status: 'error',
                message: `Command "${commandName}" timed out after ${timeout / 1000}s`
            });
        }, timeout);

        pendingRequests.set(msgId, { resolve, timer });

        sendMsg(client.ws, {
            id: msgId,
            type: commandName,
            direction: 'vcp2np',
            timestamp: Date.now(),
            data: params
        });
    });
}

// ═══════════════════════════════════════
//  工具方法
// ═══════════════════════════════════════

function getActiveClient() {
    for (const [id, client] of clients) {
        if (client.ws.readyState === WebSocket.OPEN) {
            return client;
        }
    }
    return null;
}

function getStatus() {
    const clientList = [];
    for (const [id, client] of clients) {
        clientList.push({
            clientId: id,
            npVersion: client.info.npVersion,
            connectedAt: new Date(client.info.connectedAt).toISOString(),
            lastHeartbeat: new Date(client.lastHeartbeat).toISOString(),
            uptimeSeconds: Math.floor((Date.now() - client.info.connectedAt) / 1000),
            state: client.ws.readyState === WebSocket.OPEN ? 'connected' : 'closing'
        });
    }

    return {
        status: 'ok',
        bridge: {
            wsUrl: `ws://localhost:${config.wsPort}${config.wsPath}`,
            state: clientList.some(c => c.state === 'connected') ? 'connected' : 'waiting',
            connectedClients: clientList.length
        },
        clients: clientList,
        store: store ? store.getStats() : {},
        pendingRequests: pendingRequests.size
    };
}

function sendMsg(ws, msg) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        try {
            ws.send(JSON.stringify(msg));
        } catch (e) {
            console.error('[NP-Bridge] Send error:', e.message);
        }
    }
}

function shutdown() {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }

    for (const [id, pending] of pendingRequests) {
        clearTimeout(pending.timer);
        pending.resolve({ status: 'error', message: 'Plugin shutting down' });
    }
    pendingRequests.clear();

    for (const [id, client] of clients) {
        try { client.ws.close(1001, 'Server shutting down'); } catch (e) { /* ignore */ }
    }
    clients.clear();

    if (wss) {
        wss.close();
        wss = null;
    }

    console.log('[NP-Bridge] Plugin destroyed.');
}

// ═══════════════════════════════════════
//  模块导出（匹配VCP hybridservice规范）
// ═══════════════════════════════════════

module.exports = {
    initialize,
    registerRoutes,
    processToolCall,
    shutdown
};