/**
 * HeartbeatSystem - 统一心跳系统 v1.0.0
 *
 * 融合来源：
 * - 1.txt：SafeFileManager（原子写入 WriteTemp→Rename）+ 四时段规划思路
 * - 2.txt：最完整的命令处理器 + HTTP API + env覆盖 + trigger-heartbeat路由 + 调度器状态
 * - 3.txt：自动扫描 Agent 并启动调度（当未配置 ENABLED_AGENTS 时）
 *
 * 插件类型：hybridservice
 * 必备接口：
 * - processToolCall(args)
 * - registerRoutes(app, adminApiRouter, pluginConfig, projectBasePath)
 */

const schedule = require('node-schedule');
const fs = require('fs').promises;
const path = require('path');

// ============ 目录配置（支持 env 覆盖） ============
const SCHEDULES_DIR = process.env.SCHEDULES_DIR || path.join(__dirname, '..', '..', 'AgentSchedules');
const TIMED_CONTACTS_DIR = process.env.TIMED_CONTACTS_DIR || path.join(__dirname, '..', '..', 'VCPTimedContacts');
const CONFIG_ENV_PATH = path.join(__dirname, 'config.env');

// ============ 热加载配置函数 ============
/**
 * 将 HH:MM 格式转换为当日分钟数
 * @param {string} timeStr - 时间字符串，如 "06:30" 或 "24:00"
 * @returns {number} 分钟数 (0-1440)
 */
function parseTimeToMinutes(timeStr) {
  const parts = timeStr.trim().split(':');
  if (parts.length !== 2) return NaN;
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes)) return NaN;
  return hours * 60 + minutes;
}

/**
 * 将分钟数转换为 HH:MM 格式（用于日志显示）
 * @param {number} minutes - 分钟数
 * @returns {string} HH:MM 格式
 */
function minutesToTimeStr(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * 从 config.env 文件热加载配置
 * 每次调度时调用，实现配置热更新
 * 支持分钟级时间段配置，格式: TIME_SLOT_N=名称:HH:MM-HH:MM
 */
function loadConfigEnv() {
  const config = {
    timeSlots: [
      { name: '凌晨', startMinutes: 0, endMinutes: 360 },      // 00:00-06:00
      { name: '上午', startMinutes: 360, endMinutes: 720 },    // 06:00-12:00
      { name: '下午', startMinutes: 720, endMinutes: 1080 },   // 12:00-18:00
      { name: '晚上', startMinutes: 1080, endMinutes: 1440 }   // 18:00-24:00
    ],
    // 活动时间窗口（支持热加载）
    startHour: 8,
    endHour: 23,

    // 方案B：fixed任务是否自动投递为 timed-contact（热加载）
    enableFixedTaskTimedContact: false,
    // fixed任务投递时提前唤醒分钟数（例如1表示在任务时间前1分钟唤醒）
    fixedTaskLeadMinutes: 0
  };

  try {
    const fs = require('fs');
    if (fs.existsSync(CONFIG_ENV_PATH)) {
      const content = fs.readFileSync(CONFIG_ENV_PATH, 'utf-8');
      const lines = content.split('\n');
      
      const timeSlotMap = {};
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex === -1) continue;
        
        const key = trimmed.slice(0, eqIndex).trim();
        const value = trimmed.slice(eqIndex + 1).trim();
        
        // 解析 TIME_SLOT_N 格式: 名称:HH:MM-HH:MM
        const slotMatch = key.match(/^TIME_SLOT_(\d+)$/);
        if (slotMatch && value) {
          // 先按第一个冒号分割出名称
          const firstColonIndex = value.indexOf(':');
          if (firstColonIndex === -1) continue;
          
          const name = value.slice(0, firstColonIndex).trim();
          const timeRange = value.slice(firstColonIndex + 1).trim();
          
          // 解析时间范围 HH:MM-HH:MM
          const rangeParts = timeRange.split('-');
          if (rangeParts.length === 2) {
            const startMinutes = parseTimeToMinutes(rangeParts[0]);
            const endMinutes = parseTimeToMinutes(rangeParts[1]);
            
            if (!isNaN(startMinutes) && !isNaN(endMinutes)) {
              const slotIndex = parseInt(slotMatch[1], 10);
              timeSlotMap[slotIndex] = {
                name: name,
                startMinutes: startMinutes,
                endMinutes: endMinutes
              };
            }
          }
        }
      }
      
      // 如果有自定义时间段配置，覆盖默认值
      const customSlots = Object.keys(timeSlotMap)
        .map(k => parseInt(k, 10))
        .sort((a, b) => a - b)
        .map(k => timeSlotMap[k])
        .filter(s => s && !isNaN(s.startMinutes) && !isNaN(s.endMinutes));
      
      if (customSlots.length > 0) {
        config.timeSlots = customSlots;
        if (HB_CONFIG.debug) {
          console.log('[HeartbeatSystem] 热加载时间段配置:', customSlots.map(s => 
            `${s.name}(${minutesToTimeStr(s.startMinutes)}-${minutesToTimeStr(s.endMinutes)})`
          ).join(', '));
        }
      }
      
      // 解析活动时间窗口配置
      const content2 = fs.readFileSync(CONFIG_ENV_PATH, 'utf-8');
      for (const line of content2.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex === -1) continue;
        
        const key = trimmed.slice(0, eqIndex).trim();
        const value = trimmed.slice(eqIndex + 1).trim();
        
        if (key === 'START_HOUR') {
          const parsed = parseInt(value, 10);
          if (!isNaN(parsed)) config.startHour = parsed;
        }
        if (key === 'END_HOUR') {
          const parsed = parseInt(value, 10);
          if (!isNaN(parsed)) config.endHour = parsed;
        }

        if (key === 'ENABLE_FIXED_TASK_TIMEDCONTACT') {
          const v = String(value).trim().toLowerCase();
          config.enableFixedTaskTimedContact = (v === 'true' || v === '1' || v === 'yes');
        }

        if (key === 'FIXED_TASK_LEAD_MINUTES') {
          const parsed = parseInt(value, 10);
          if (!isNaN(parsed)) config.fixedTaskLeadMinutes = parsed;
        }
      }
      
      if (HB_CONFIG.debug) {
        console.log('[HeartbeatSystem] 热加载活动窗口:', `${config.startHour}:00-${config.endHour}:00`);
      }
    }
  } catch (err) {
    console.warn('[HeartbeatSystem] 读取config.env失败，使用默认配置:', err.message);
  }
  
  return config;
}

// ============ 调度/模板配置（支持 env 覆盖） ============
const HB_CONFIG = {
  enabledAgentsEnv: (process.env.ENABLED_AGENTS || '').split(',').map(s => s.trim()).filter(Boolean), // 空则走自动扫描
  timeSlots: [
    { name: '凌晨', start: 0, end: 6 },
    { name: '上午', start: 6, end: 12 },
    { name: '下午', start: 12, end: 18 },
    { name: '晚上', start: 18, end: 24 }
  ],
  intervalWithPending: { min: Number(process.env.HB_BUSY_MIN || 20), max: Number(process.env.HB_BUSY_MAX || 40) },
  intervalAllComplete: { min: Number(process.env.HB_IDLE_MIN || 30), max: Number(process.env.HB_IDLE_MAX || 60) },
  enableStartupPlanning: String(process.env.ENABLE_STARTUP_PLANNING || 'false').toLowerCase() === 'true',
  promptTemplateName: process.env.HEARTBEAT_PROMPT_TEMPLATE || 'heartbeat_prompt', // 不带扩展名
  heartbeatTaskDelayMinutes: Number(process.env.HEARTBEAT_TASK_DELAY_MINUTES || 1),
  debug: String(process.env.HEARTBEAT_DEBUG || 'true').toLowerCase() === 'true'
};

// ============ 工具函数 ============
function log(...args) {
  if (HB_CONFIG.debug) console.log('[HeartbeatSystem]', ...args);
}

function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function ensureDir(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }
}

function getSchedulePath(agentName) {
  return path.join(SCHEDULES_DIR, agentName, 'schedule.json');
}

function getHistoryDir(agentName) {
  return path.join(SCHEDULES_DIR, agentName, 'history');
}

function generateTaskId(prefix = 'task') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
}

/**
 * 判断当前分钟数是否在指定时间段内（支持跨午夜）
 * @param {number} currentMinutes - 当前时间的分钟数 (0-1439)
 * @param {number} startMinutes - 时段开始分钟数
 * @param {number} endMinutes - 时段结束分钟数
 * @returns {boolean}
 */
function isInTimeSlot(currentMinutes, startMinutes, endMinutes) {
  if (startMinutes < endMinutes) {
    // 正常情况：如 06:00-12:00 (360-720)
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  } else {
    // 跨午夜：如 20:00-02:00 (1200-120)
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }
}

function getCurrentTimeSlot() {
  // 热加载时间段配置
  const hotConfig = loadConfigEnv();
  const timeSlots = hotConfig.timeSlots;
  
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  
  for (const slot of timeSlots) {
    if (isInTimeSlot(currentMinutes, slot.startMinutes, slot.endMinutes)) {
      return slot;
    }
  }
  return timeSlots[0];
}

function getFutureTimeString(minutesFromNow) {
  const future = new Date(Date.now() + minutesFromNow * 60 * 1000);
  return `${future.getFullYear()}-${pad2(future.getMonth() + 1)}-${pad2(future.getDate())}-${pad2(future.getHours())}:${pad2(future.getMinutes())}`;
}

/**
 * 解析 HH:mm（或 H:mm）格式为 {hour, minute}
 */
function parseHHmm(hhmm) {
  const m = String(hhmm).trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  if (hour < 0 || hour > 24) return null;
  if (minute < 0 || minute > 59) return null;
  if (hour === 24 && minute !== 0) return null; // 仅允许 24:00
  return { hour, minute };
}

/**
 * 将 Date 转为 TaskScheduler 使用的 scheduledLocalTime 字符串：YYYY-MM-DD-HH:mm
 */
function toScheduledLocalTimeString(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}-${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/**
 * 根据 "HH:mm" 计算下一次触发的本地时间点（默认：今天该时刻；若已过去则改为 now+1min）
 * 并支持 leadMinutes（提前唤醒）
 */
function computeFixedTaskFireTime(hhmm, leadMinutes = 0) {
  const parsed = parseHHmm(hhmm);
  if (!parsed) return null;

  const now = new Date();
  let base = new Date(now.getFullYear(), now.getMonth(), now.getDate(), parsed.hour === 24 ? 0 : parsed.hour, parsed.minute, 0, 0);
  if (parsed.hour === 24) {
    // 24:00 视作次日 00:00
    base = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  }

  // leadMinutes：提前唤醒
  if (leadMinutes && !Number.isNaN(Number(leadMinutes)) && Number(leadMinutes) > 0) {
    base = new Date(base.getTime() - Number(leadMinutes) * 60 * 1000);
  }

  // 若已过去，则兜底改为 now+1min（避免写一个永远不会触发的过去时间）
  if (base.getTime() <= Date.now()) {
    base = new Date(Date.now() + 60 * 1000);
  }
  return base;
}

// ============ SafeFileManager：内存锁 + 原子写入 ============
class SafeFileManager {
  constructor() {
    this.locks = new Map();   // key -> boolean
    this.queues = new Map();  // key -> resolvers[]
  }

  async acquire(key) {
    if (!this.locks.get(key)) {
      this.locks.set(key, true);
      return;
    }
    return new Promise(resolve => {
      if (!this.queues.has(key)) this.queues.set(key, []);
      this.queues.get(key).push(resolve);
    });
  }

  release(key) {
    const q = this.queues.get(key);
    if (q && q.length > 0) {
      const next = q.shift();
      next();
    } else {
      this.locks.set(key, false);
    }
  }

  async readJson(filePath) {
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  async writeJsonAtomic(filePath, data) {
    const tempPath = `${filePath}.tmp.${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await ensureDir(path.dirname(filePath));
    try {
      await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf-8');
      await fs.rename(tempPath, filePath);
      return true;
    } catch (e) {
      await fs.unlink(tempPath).catch(() => {});
      throw e;
    }
  }

  createDefaultSchedule(agentName, inheritSettings = null) {
    const base = {
      agentName,
      date: getTodayDate(),
      todayTasks: [],
      heartbeats: [],
      plannedSlots: [],
      settings: {
        heartbeatInterval: 10, // 兼容旧字段
        fixedTaskInterval: 30,
        enabled: true,
        startHour: 8,
        endHour: 23
      },
      stats: {
        totalHeartbeats: 0,
        tasksCompleted: 0,
        tasksTotal: 0
      },
      lastUpdated: new Date().toISOString()
    };
    if (inheritSettings) base.settings = { ...base.settings, ...inheritSettings };
    return base;
  }

  async archiveSchedule(agentName, scheduleObj) {
    if (!scheduleObj || !scheduleObj.date) return;
    const historyDir = getHistoryDir(agentName);
    await ensureDir(historyDir);
    const historyPath = path.join(historyDir, `${scheduleObj.date}.json`);
    await fs.writeFile(historyPath, JSON.stringify(scheduleObj, null, 2), 'utf-8');
  }

  async updateSchedule(agentName, updateFn) {
    await this.acquire(agentName);
    const schedulePath = getSchedulePath(agentName);

    try {
      let data = await this.readJson(schedulePath);
      if (!data) data = this.createDefaultSchedule(agentName);

      // 日期切换：归档 + 重置（继承 settings）
      const today = getTodayDate();
      let didRollover = false;
      if (data.date !== today) {
        await this.archiveSchedule(agentName, data);
        data = this.createDefaultSchedule(agentName, data.settings || null);
        didRollover = true;
      }

      const result = await updateFn(data);
      data.lastUpdated = new Date().toISOString();

      // 方案B：跨天重置发生时必须落盘；否则仍遵循“纯读不写”的约定
      if (didRollover || result !== false) await this.writeJsonAtomic(schedulePath, data);

      return data;
    } finally {
      this.release(agentName);
    }
  }

  async readSchedule(agentName) {
    // 对外读也用 updateSchedule 锁串行，保证读取时也会处理日期归档
    return await this.updateSchedule(agentName, async (data) => {
      // 纯读不改也要保存吗？这里不强制保存，减少写入
      return false;
    });
  }
}

const fileManager = new SafeFileManager();

// ============ 提示词模板（多模板支持） ============

/**
 * 多模板配置
 * - 四个时段的首次规划使用不同的模板（planning.*）
 * - 常规心跳使用统一的routine模板
 * 
 * 模板文件命名规范：
 * - heartbeat_planning_dawn.txt    凌晨(0-6点)首次规划
 * - heartbeat_planning_morning.txt 上午(6-12点)首次规划
 * - heartbeat_planning_afternoon.txt 下午(12-18点)首次规划
 * - heartbeat_planning_evening.txt 晚上(18-24点)首次规划
 * - heartbeat_routine.txt          常规心跳（非首次规划）
 */
const PROMPT_TEMPLATES = {
  planning: {
    '凌晨': process.env.PROMPT_TEMPLATE_PLANNING_DAWN || 'heartbeat_planning_dawn',
    '上午': process.env.PROMPT_TEMPLATE_PLANNING_MORNING || 'heartbeat_planning_morning',
    '下午': process.env.PROMPT_TEMPLATE_PLANNING_AFTERNOON || 'heartbeat_planning_afternoon',
    '晚上': process.env.PROMPT_TEMPLATE_PLANNING_EVENING || 'heartbeat_planning_evening'
  },
  routine: process.env.PROMPT_TEMPLATE_ROUTINE || 'heartbeat_routine'
};

const DEFAULT_PROMPT_TEMPLATE = `
当前时间: {time}
当前时段: {timeSlot}
Agent: {agentName}

{planningContext}

请检查你的日程表，根据当前时间段和任务状态，决定下一步行动。
如果是新时段，请规划该时段的任务。
如果有待办任务，请尝试执行。
如果无事可做，可以休息或进行自主思考。
`.trim();

async function readPromptTemplate(templateName = 'heartbeat_prompt') {
  const templatePath = path.join(__dirname, `${templateName}.txt`);
  try {
    return await fs.readFile(templatePath, 'utf-8');
  } catch {
    return DEFAULT_PROMPT_TEMPLATE;
  }
}

function generatePrompt(template, agentName, extra = {}) {
  let prompt = (template || DEFAULT_PROMPT_TEMPLATE)
    .replace(/\{agentName\}/g, agentName)
    .replace(/\{time\}/g, new Date().toLocaleString('zh-CN'));

  for (const [key, value] of Object.entries(extra)) {
    prompt = prompt.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
  }
  return prompt;
}

// ============ 调度器 ============
const schedulerJobs = new Map(); // agentName -> schedule.Job
let isSchedulerInitialized = false;

async function getAllAgents() {
  try {
    await ensureDir(SCHEDULES_DIR);
    const entries = await fs.readdir(SCHEDULES_DIR, { withFileTypes: true });
    return entries.filter(e => e.isDirectory()).map(e => e.name);
  } catch {
    return [];
  }
}

async function getEnabledAgents() {
  if (HB_CONFIG.enabledAgentsEnv.length > 0) return HB_CONFIG.enabledAgentsEnv;
  const scanned = await getAllAgents();
  if (scanned.length > 0) return scanned;
  return ['Rosa']; // 兜底
}

async function hasPendingTasks(agentName) {
  const scheduleObj = await fileManager.readSchedule(agentName);
  const tasks = scheduleObj?.todayTasks || [];
  return tasks.some(t => t.status === 'pending' || t.status === 'running');
}

async function scheduleNextHeartbeat(agentName) {
  if (schedulerJobs.has(agentName)) {
    try { schedulerJobs.get(agentName).cancel(); } catch {}
    schedulerJobs.delete(agentName);
  }

  const scheduleObj = await fileManager.readSchedule(agentName);
  if (!scheduleObj || !scheduleObj.settings?.enabled) {
    log(`${agentName} 心跳已禁用或无日程`);
    return;
  }

  const now = new Date();
  const currentHour = now.getHours();
  
  // 热加载活动时间窗口配置（优先使用config.env，回退到schedule.json）
  const hotConfig = loadConfigEnv();
  const startHour = hotConfig.startHour ?? scheduleObj.settings?.startHour ?? 8;
  const endHour = hotConfig.endHour ?? scheduleObj.settings?.endHour ?? 23;

  /**
   * 判断是否在活动时间窗口内（支持跨午夜）
   * 例如: startHour=12, endHour=3 表示中午12点到凌晨3点
   */
  function isInActiveWindow(hour, start, end) {
    if (start < end) {
      // 正常情况：如 8-23
      return hour >= start && hour < end;
    } else {
      // 跨午夜：如 12-3（意思是12:00到次日03:00）
      return hour >= start || hour < end;
    }
  }

  // 睡眠：调度到下一次 startHour，并加随机分钟防并发
  if (!isInActiveWindow(currentHour, startHour, endHour)) {
    const nextStart = new Date();
    nextStart.setDate(nextStart.getDate() + (currentHour >= endHour ? 1 : 0));
    nextStart.setHours(startHour, getRandomInt(0, 10), 0, 0);

    const job = schedule.scheduleJob(nextStart, () => {
      triggerHeartbeat(agentName).catch(err => console.error('[HeartbeatSystem] triggerHeartbeat error:', err));
    });
    schedulerJobs.set(agentName, job);
    log(`${agentName} 不在活动时间(${startHour}-${endHour})，下次唤醒: ${nextStart.toLocaleString('zh-CN')}`);
    return;
  }

  // ============ 时段检测触发点（plannedSlots） ============
  // 触发点1：当前时段未规划 → 1~3分钟内提前触发一次心跳，避免等随机间隔
  const timeSlotsForDetection = Array.isArray(hotConfig.timeSlots) ? hotConfig.timeSlots : [];
  const plannedSlots = Array.isArray(scheduleObj.plannedSlots) ? scheduleObj.plannedSlots : [];
  if (timeSlotsForDetection.length > 0) {
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const currentSlot = timeSlotsForDetection.find(s => isInTimeSlot(nowMinutes, s.startMinutes, s.endMinutes)) || timeSlotsForDetection[0];

    if (!plannedSlots.includes(currentSlot.name)) {
      const quickDelay = getRandomInt(1, 3);
      const quickTime = new Date(Date.now() + quickDelay * 60 * 1000);

      const job = schedule.scheduleJob(quickTime, () => {
        triggerHeartbeat(agentName).catch(err => console.error('[HeartbeatSystem] triggerHeartbeat error:', err));
      });
      schedulerJobs.set(agentName, job);

      log(`${agentName} 当前时段「${currentSlot.name}」未规划，提前心跳: ${quickDelay}分钟后 (${quickTime.toLocaleString('zh-CN')})`);
      return;
    }
  }

  const pending = await hasPendingTasks(agentName);
  const cfg = pending ? HB_CONFIG.intervalWithPending : HB_CONFIG.intervalAllComplete;
  const intervalMinutes = getRandomInt(cfg.min, cfg.max);

  let nextTime = new Date(Date.now() + intervalMinutes * 60 * 1000);

  // 触发点2：如果“即将进入的下一时段”未规划，且边界早于随机间隔，则在边界附近提前触发
  const timeSlotsForDetection2 = Array.isArray(hotConfig.timeSlots) ? hotConfig.timeSlots : [];
  const plannedSlots2 = Array.isArray(scheduleObj.plannedSlots) ? scheduleObj.plannedSlots : [];

  if (timeSlotsForDetection2.length > 0) {
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const currentSlot = timeSlotsForDetection2.find(s => isInTimeSlot(nowMinutes, s.startMinutes, s.endMinutes)) || timeSlotsForDetection2[0];
    const idx = timeSlotsForDetection2.findIndex(s => s.name === currentSlot.name);
    const nextSlot = idx >= 0 ? timeSlotsForDetection2[(idx + 1) % timeSlotsForDetection2.length] : null;

    function minutesUntilSlotEnd(slot) {
      // 正常时段
      if (slot.startMinutes < slot.endMinutes) {
        let diff = slot.endMinutes - nowMinutes; // 可能是 1440 - nowMinutes
        if (diff <= 0) diff += 1440;
        return diff;
      }
      // 跨午夜时段：start> end
      if (nowMinutes >= slot.startMinutes) {
        return (1440 - nowMinutes) + slot.endMinutes;
      }
      return slot.endMinutes - nowMinutes;
    }

    if (nextSlot && !plannedSlots2.includes(nextSlot.name)) {
      const minutesToBoundary = minutesUntilSlotEnd(currentSlot);
      const boundaryTime = new Date(Date.now() + minutesToBoundary * 60 * 1000);

      // 只有当边界发生在活动窗口内，且确实早于随机下一跳，才提前
      if (boundaryTime < nextTime && isInActiveWindow(boundaryTime.getHours(), startHour, endHour)) {
        const nearBoundaryDelay = getRandomInt(1, 3);
        nextTime = new Date(boundaryTime.getTime() + nearBoundaryDelay * 60 * 1000);
        log(`${agentName} 即将进入未规划时段「${nextSlot.name}」，改为边界触发: ${nearBoundaryDelay}分钟后 (${nextTime.toLocaleString('zh-CN')})`);
      }
    }
  }

  const job = schedule.scheduleJob(nextTime, () => {
    triggerHeartbeat(agentName).catch(err => console.error('[HeartbeatSystem] triggerHeartbeat error:', err));
  });
  schedulerJobs.set(agentName, job);
  log(`${agentName} ${pending ? '有任务' : '无任务'}，下次心跳: ${Math.round((nextTime.getTime() - Date.now()) / 60000)}分钟后 (${nextTime.toLocaleString('zh-CN')})`);
}

async function createHeartbeatTimedContact(agentName, prompt, delayMinutes = 1) {
  const taskId = `heartbeat_${agentName}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const scheduledTime = getFutureTimeString(delayMinutes);

  const taskContent = {
    taskId,
    scheduledLocalTime: scheduledTime,
    tool_call: {
      tool_name: 'AgentAssistant',
      arguments: {
        agent_name: agentName,
        prompt,
        temporary_contact: true
      }
    }
  };

  await ensureDir(TIMED_CONTACTS_DIR);
  const taskPath = path.join(TIMED_CONTACTS_DIR, `${taskId}.json`);
  await fs.writeFile(taskPath, JSON.stringify(taskContent, null, 2), 'utf-8');
  log(`[TimedContact] created: ${taskId} @ ${scheduledTime}`);
  return { taskId, taskPath, scheduledTime };
}

/**
 * 方案B：为 fixed 任务创建 timed-contact（到点唤醒执行）
 * @param {string} agentName
 * @param {object} task - schedule.json 中的任务对象
 * @param {string} scheduledLocalTime - YYYY-MM-DD-HH:mm
 */
async function createFixedTaskTimedContact(agentName, task, scheduledLocalTime) {
  const timedContactId = `fixed_${task.id}`;
  const prompt = [
    `[固定任务到点执行]`,
    `任务ID: ${task.id}`,
    `任务名称: ${task.name}`,
    task.description ? `任务描述: ${task.description}` : '',
    '',
    `请在现在执行该任务。执行前可先将该任务标记为 running，完成后必须回写状态：`,
    `- 调用 HeartbeatSystem.UpdateTaskStatus(agentName=${agentName}, taskId=${task.id}, status=completed, result=执行结果简述)`,
    `- 如无法执行或决定跳过：status=skipped，并在 result 中说明原因。`
  ].filter(Boolean).join('\n');

  const taskFile = {
    taskId: timedContactId,
    scheduledLocalTime,
    tool_call: {
      tool_name: 'AgentAssistant',
      arguments: {
        agent_name: agentName,
        prompt,
        temporary_contact: true
      }
    }
  };

  await ensureDir(TIMED_CONTACTS_DIR);
  const filePath = path.join(TIMED_CONTACTS_DIR, `${timedContactId}.json`);
  await fs.writeFile(filePath, JSON.stringify(taskFile, null, 2), 'utf-8');
  log(`[TimedContact] created: ${timedContactId} @ ${scheduledLocalTime} (fixed task: ${task.id})`);
  return { timedContactId, filePath, scheduledLocalTime };
}

async function triggerHeartbeat(agentName) {
  log(`===== 触发 ${agentName} 心跳 =====`);

  const currentSlot = getCurrentTimeSlot();
  let prompt = null;
  let templateName = null;

  // 用 updateSchedule 原子化：判定时段规划 + 标记 plannedSlots
  await fileManager.updateSchedule(agentName, async (scheduleObj) => {
    const plannedSlots = scheduleObj.plannedSlots || [];
    const isSlotPlanning = !plannedSlots.includes(currentSlot.name);

    if (isSlotPlanning) {
      scheduleObj.plannedSlots = plannedSlots.concat([currentSlot.name]);
    }

    const planningContext = isSlotPlanning
      ? `这是新的“${currentSlot.name}”时段，请先规划本时段的任务。`
      : `当前处于“${currentSlot.name}”时段，请进行常规检查或执行待办任务。`;

    // 根据是否首次规划选择不同模板
    templateName = isSlotPlanning
      ? PROMPT_TEMPLATES.planning[currentSlot.name]
      : PROMPT_TEMPLATES.routine;
    
    const template = await readPromptTemplate(templateName);
    log(`使用模板: ${templateName}.txt (${isSlotPlanning ? '时段规划' : '常规心跳'})`);

    prompt = generatePrompt(template, agentName, {
      timeSlot: currentSlot.name,
      planningContext,
      isPlanning: isSlotPlanning ? 'true' : 'false'
    });

    return true;
  });

  if (prompt) {
    await createHeartbeatTimedContact(agentName, prompt, HB_CONFIG.heartbeatTaskDelayMinutes);
  } else {
    console.warn('[HeartbeatSystem] 未生成 prompt（模板缺失？）');
  }

  await scheduleNextHeartbeat(agentName);
}

async function initializeScheduler() {
  if (isSchedulerInitialized) return;
  isSchedulerInitialized = true;

  await ensureDir(SCHEDULES_DIR);
  await ensureDir(TIMED_CONTACTS_DIR);

  const agents = await getEnabledAgents();
  log(`Scheduler init, agents=${agents.join(', ')}, startupPlanning=${HB_CONFIG.enableStartupPlanning}`);

  for (const agentName of agents) {
    try {
      if (HB_CONFIG.enableStartupPlanning) {
        await triggerHeartbeat(agentName);
      } else {
        await scheduleNextHeartbeat(agentName);
      }
    } catch (e) {
      console.error('[HeartbeatSystem] initialize agent failed:', agentName, e.message);
    }
  }
}

function shutdownScheduler() {
  for (const [agentName, job] of schedulerJobs) {
    try { job.cancel(); } catch {}
    log(`cancel job: ${agentName}`);
  }
  schedulerJobs.clear();
  isSchedulerInitialized = false;
}

// ============ 命令处理器（沿用2.txt的接口集合） ============
async function handleGetSchedule(args) {
  const { agentName } = args;
  if (!agentName) return { status: 'error', error: '缺少agentName参数' };
  const scheduleObj = await fileManager.readSchedule(agentName);

  return {
    status: 'success',
    result: scheduleObj,
    messageForAI: `已获取${agentName}的日程，今日有${scheduleObj.todayTasks.length}个任务，${scheduleObj.heartbeats.length}次心跳记录`
  };
}

async function handleAddTask(args) {
  const { agentName, name, time, description } = args;
  if (!agentName || !name || !time) return { status: 'error', error: '缺少必需参数: agentName, name, time' };

  const task = {
    id: generateTaskId('task'),
    name,
    scheduledTime: time,
    status: 'pending',
    type: 'fixed',
    description: description || '',
    result: null,
    createdAt: new Date().toISOString(),
    completedAt: null,

    // 方案B：投递信息（若开启则写入）
    timedContact: null
  };

  await fileManager.updateSchedule(agentName, async (scheduleObj) => {
    scheduleObj.todayTasks.push(task);
    scheduleObj.stats.tasksTotal = scheduleObj.todayTasks.length;
    scheduleObj.stats.tasksCompleted = scheduleObj.todayTasks.filter(t => t.status === 'completed').length;
    return true;
  });

  // 方案B：创建 timed-contact（热加载开关）
  try {
    const hotConfig = loadConfigEnv();
    if (hotConfig.enableFixedTaskTimedContact) {
      const fireTime = computeFixedTaskFireTime(time, hotConfig.fixedTaskLeadMinutes || 0);
      if (!fireTime) {
        log(`[FixedTask] 无法解析时间: ${time}，跳过 timed-contact 投递`);
      } else {
        const scheduledLocalTime = toScheduledLocalTimeString(fireTime);

        // 去重：如果任务对象上已经记录过 timedContactId，则不重复投递
        let already = false;
        await fileManager.updateSchedule(agentName, async (scheduleObj) => {
          const t = scheduleObj.todayTasks.find(x => x.id === task.id);
          if (t && t.timedContact && t.timedContact.timedContactId) already = true;
          return false; // 纯读
        });

        if (!already) {
          const tc = await createFixedTaskTimedContact(agentName, task, scheduledLocalTime);
          await fileManager.updateSchedule(agentName, async (scheduleObj) => {
            const t = scheduleObj.todayTasks.find(x => x.id === task.id);
            if (t) {
              t.timedContact = {
                timedContactId: tc.timedContactId,
                filePath: tc.filePath,
                scheduledLocalTime: tc.scheduledLocalTime,
                createdAt: new Date().toISOString()
              };
            }
            return true;
          });
        }
      }
    }
  } catch (e) {
    console.warn('[HeartbeatSystem] fixed task timed-contact create failed:', e.message);
  }

  const enabledHint = loadConfigEnv().enableFixedTaskTimedContact ? '（已投递定时唤醒）' : '';
  return { status: 'success', result: { taskId: task.id, task }, messageForAI: `已添加任务\"${name}\"，计划执行时间: ${time}${enabledHint}` };
}

async function handleUpdateTaskStatus(args) {
  const { agentName, taskId, status, result } = args;
  if (!agentName || !taskId || !status) return { status: 'error', error: '缺少必需参数: agentName, taskId, status' };

  let updatedTask = null;

  await fileManager.updateSchedule(agentName, async (scheduleObj) => {
    const task = scheduleObj.todayTasks.find(t => t.id === taskId);
    if (!task) throw new Error(`未找到任务: ${taskId}`);

    task.status = status;
    if (result) task.result = result;
    if (status === 'completed' || status === 'skipped') task.completedAt = new Date().toISOString();

    scheduleObj.stats.tasksCompleted = scheduleObj.todayTasks.filter(t => t.status === 'completed').length;
    updatedTask = task;
    return true;
  });

  return { status: 'success', result: { task: updatedTask }, messageForAI: `任务\"${updatedTask.name}\"状态已更新为: ${status}` };
}

async function handleRemoveTask(args) {
  const { agentName, taskId } = args;
  if (!agentName || !taskId) return { status: 'error', error: '缺少必需参数: agentName, taskId' };

  let removed = null;

  await fileManager.updateSchedule(agentName, async (scheduleObj) => {
    const index = scheduleObj.todayTasks.findIndex(t => t.id === taskId);
    if (index === -1) throw new Error(`未找到任务: ${taskId}`);

    removed = scheduleObj.todayTasks.splice(index, 1)[0];
    scheduleObj.stats.tasksTotal = scheduleObj.todayTasks.length;
    scheduleObj.stats.tasksCompleted = scheduleObj.todayTasks.filter(t => t.status === 'completed').length;
    return true;
  });

  // 若该任务尚未被消费，尝试删除 timed-contact 文件（忽略不存在）
  try {
    const timedContactId = removed?.timedContact?.timedContactId;
    if (timedContactId) {
      const filePath = path.join(TIMED_CONTACTS_DIR, `${timedContactId}.json`);
      await fs.unlink(filePath).catch(() => {});
    }
  } catch {}

  return { status: 'success', result: { removed }, messageForAI: `已删除任务\"${removed.name}\"` };
}

async function handleGetTodayTasks(args) {
  const { agentName } = args;
  if (!agentName) return { status: 'error', error: '缺少agentName参数' };

  const scheduleObj = await fileManager.readSchedule(agentName);
  return { status: 'success', result: { tasks: scheduleObj.todayTasks, stats: scheduleObj.stats }, messageForAI: `今日共${scheduleObj.todayTasks.length}个任务，已完成${scheduleObj.stats.tasksCompleted}个` };
}

async function handleRecordHeartbeat(args) {
  const { agentName, action, note } = args;
  if (!agentName || !action) return { status: 'error', error: '缺少必需参数: agentName, action' };

  const now = new Date();
  const heartbeat = {
    time: now.toTimeString().slice(0, 5),
    timestamp: now.toISOString(),
    status: 'completed',
    action,
    note: note || ''
  };

  await fileManager.updateSchedule(agentName, async (scheduleObj) => {
    scheduleObj.heartbeats.push(heartbeat);
    scheduleObj.stats.totalHeartbeats = scheduleObj.heartbeats.length;
    return true;
  });

  return { status: 'success', result: { heartbeat }, messageForAI: `已记录心跳: ${action}` };
}

async function handleGetPlannedSlots(args) {
  const { agentName } = args;
  if (!agentName) return { status: 'error', error: '缺少agentName参数' };

  const scheduleObj = await fileManager.readSchedule(agentName);
  // 热加载时间段配置
  const hotConfig = loadConfigEnv();
  const allSlots = hotConfig.timeSlots.map(s => s.name);
  const plannedSlots = scheduleObj.plannedSlots || [];
  const unplannedSlots = allSlots.filter(s => !plannedSlots.includes(s));
  return { status: 'success', result: { plannedSlots, unplannedSlots, allSlots }, messageForAI: `今日已规划时段: ${plannedSlots.join(', ') || '无'}, 未规划: ${unplannedSlots.join(', ') || '无'}` };
}

async function handleMarkSlotPlanned(args) {
  const { agentName, slotName } = args;
  if (!agentName || !slotName) return { status: 'error', error: '缺少必需参数: agentName, slotName' };

  // 热加载时间段配置
  const hotConfig = loadConfigEnv();
  const validSlots = hotConfig.timeSlots.map(s => s.name);
  if (!validSlots.includes(slotName)) return { status: 'error', error: `无效的时段名: ${slotName}, 有效值: ${validSlots.join(', ')}` };

  let alreadyPlanned = false;
  let resultSlots = [];

  await fileManager.updateSchedule(agentName, async (scheduleObj) => {
    if (!Array.isArray(scheduleObj.plannedSlots)) scheduleObj.plannedSlots = [];
    if (scheduleObj.plannedSlots.includes(slotName)) alreadyPlanned = true;
    else scheduleObj.plannedSlots.push(slotName);

    resultSlots = scheduleObj.plannedSlots;
    return true;
  });

  return { status: 'success', result: { plannedSlots: resultSlots }, messageForAI: alreadyPlanned ? `${slotName}时段已经规划过了` : `已标记${slotName}时段为已规划` };
}

async function handleSetSettings(args) {
  const { agentName, settings } = args;
  if (!agentName || !settings) return { status: 'error', error: '缺少必需参数: agentName, settings' };

  let settingsObj = settings;
  if (typeof settings === 'string') {
    try { settingsObj = JSON.parse(settings); } catch (e) { return { status: 'error', error: 'settings参数JSON解析失败: ' + e.message }; }
  }

  let resultSettings = null;

  await fileManager.updateSchedule(agentName, async (scheduleObj) => {
    scheduleObj.settings = { ...scheduleObj.settings, ...settingsObj };
    resultSettings = scheduleObj.settings;
    return true;
  });

  // 设置改变可能影响调度
  await scheduleNextHeartbeat(agentName);

  return { status: 'success', result: { settings: resultSettings }, messageForAI: `已更新${agentName}的心跳设置` };
}

async function handleCreateScheduledTask(args) {
  const { agentName, time, prompt } = args;
  if (!agentName || !time || !prompt) return { status: 'error', error: '缺少必需参数: agentName, time, prompt' };

  await ensureDir(TIMED_CONTACTS_DIR);

  const taskId = `heartbeat_${agentName}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const taskFile = {
    taskId,
    scheduledLocalTime: time,
    tool_call: {
      tool_name: 'AgentAssistant',
      arguments: {
        agent_name: agentName,
        prompt,
        ...(args.temporary_contact ? { temporary_contact: true } : {})
      }
    }
  };

  const filePath = path.join(TIMED_CONTACTS_DIR, `${taskId}.json`);
  await fs.writeFile(filePath, JSON.stringify(taskFile, null, 2), 'utf-8');

  // 同步到任务面板（schedule.json）
  const task = {
    id: taskId,
    name: prompt.slice(0, 50) + (prompt.length > 50 ? '...' : ''),
    scheduledTime: time,
    status: 'pending',
    type: 'scheduled',
    description: prompt,
    result: null,
    createdAt: new Date().toISOString(),
    completedAt: null
  };

  await fileManager.updateSchedule(agentName, async (scheduleObj) => {
    scheduleObj.todayTasks.push(task);
    scheduleObj.stats.tasksTotal = scheduleObj.todayTasks.length;
    return true;
  });

  return { status: 'success', result: { taskId, filePath, task }, messageForAI: `已创建定时任务，将在${time}唤醒${agentName}，已同步到任务面板` };
}

async function handleTriggerHeartbeat(args) {
  const { agentName } = args;
  if (!agentName) return { status: 'error', error: '缺少agentName参数' };
  await triggerHeartbeat(agentName);
  return { status: 'success', result: { agentName }, messageForAI: `已触发 ${agentName} 心跳（调度器逻辑）` };
}

function handleSchedulerStatus() {
  const runningAgents = Array.from(schedulerJobs.keys());
  return { status: 'success', result: { runningAgents, config: HB_CONFIG }, messageForAI: `调度器运行中：${runningAgents.join(', ') || '无'}` };
}

async function handleStartScheduler() {
  await initializeScheduler();
  return { status: 'success', result: { runningAgents: Array.from(schedulerJobs.keys()) }, messageForAI: '调度器已启动(幂等)' };
}

function handleStopScheduler() {
  shutdownScheduler();
  return { status: 'success', result: { runningAgents: [] }, messageForAI: '调度器已停止' };
}

const COMMAND_HANDLERS = {
  GetSchedule: handleGetSchedule,
  AddTask: handleAddTask,
  UpdateTaskStatus: handleUpdateTaskStatus,
  RemoveTask: handleRemoveTask,
  GetTodayTasks: handleGetTodayTasks,
  RecordHeartbeat: handleRecordHeartbeat,
  SetSettings: handleSetSettings,
  CreateScheduledTask: handleCreateScheduledTask,
  GetPlannedSlots: handleGetPlannedSlots,
  MarkSlotPlanned: handleMarkSlotPlanned,

  TriggerHeartbeat: handleTriggerHeartbeat,
  SchedulerStatus: handleSchedulerStatus,
  StartScheduler: handleStartScheduler,
  StopScheduler: handleStopScheduler
};

async function processToolCall(args) {
  try {
    const command = args.command;
    if (!command) return { status: 'error', error: '缺少command参数' };
    const handler = COMMAND_HANDLERS[command];
    if (!handler) return { status: 'error', error: `未知命令: ${command}` };
    return await handler(args);
  } catch (err) {
    return { status: 'error', error: err.message };
  }
}

// ============ HTTP API ============
function registerRoutes(app, adminApiRouter, pluginConfig, projectBasePath) {
  console.log('[HeartbeatSystem] registerRoutes...');
  // 关键：在插件被加载并注册路由时初始化调度器（融合3.txt的做法）
  initializeScheduler().catch(e => console.error('[HeartbeatSystem] initializeScheduler failed:', e));

  adminApiRouter.get('/heartbeat/agents', async (req, res) => {
    try {
      const agents = await getAllAgents();
      res.json({ status: 'success', agents });
    } catch (err) {
      res.status(500).json({ status: 'error', error: err.message });
    }
  });

  adminApiRouter.get('/heartbeat/:agent', async (req, res) => {
    try {
      const scheduleObj = await fileManager.readSchedule(req.params.agent);
      res.json({ status: 'success', schedule: scheduleObj });
    } catch (err) {
      res.status(500).json({ status: 'error', error: err.message });
    }
  });

  adminApiRouter.get('/heartbeat/:agent/tasks', async (req, res) => {
    try {
      const scheduleObj = await fileManager.readSchedule(req.params.agent);
      res.json({ status: 'success', tasks: scheduleObj.todayTasks, stats: scheduleObj.stats });
    } catch (err) {
      res.status(500).json({ status: 'error', error: err.message });
    }
  });

  adminApiRouter.get('/heartbeat/:agent/heartbeats', async (req, res) => {
    try {
      const scheduleObj = await fileManager.readSchedule(req.params.agent);
      res.json({ status: 'success', heartbeats: scheduleObj.heartbeats, total: scheduleObj.stats.totalHeartbeats });
    } catch (err) {
      res.status(500).json({ status: 'error', error: err.message });
    }
  });

  // 手动触发（创建一个普通 scheduled task）
  adminApiRouter.post('/heartbeat/:agent/trigger', async (req, res) => {
    try {
      const agentName = req.params.agent;
      const now = new Date();
      const time = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}-${pad2(now.getHours())}:${pad2(now.getMinutes() + 1)}`;
      const result = await handleCreateScheduledTask({
        agentName,
        time,
        prompt: `[手动触发心跳] 现在是${now.toLocaleTimeString()}，请自主决定是否有需要做的事情。`
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({ status: 'error', error: err.message });
    }
  });

  // 触发“调度器逻辑心跳”（四时段规划）
  adminApiRouter.post('/heartbeat/:agent/trigger-heartbeat', async (req, res) => {
    try {
      const agentName = req.params.agent;
      await triggerHeartbeat(agentName);
      res.json({ status: 'success', message: `已触发 ${agentName} 心跳(调度器逻辑)` });
    } catch (err) {
      res.status(500).json({ status: 'error', error: err.message });
    }
  });

  adminApiRouter.post('/heartbeat/:agent/pause', async (req, res) => {
    try {
      const result = await handleSetSettings({ agentName: req.params.agent, settings: { enabled: false } });
      res.json(result);
    } catch (err) {
      res.status(500).json({ status: 'error', error: err.message });
    }
  });

  adminApiRouter.post('/heartbeat/:agent/resume', async (req, res) => {
    try {
      const result = await handleSetSettings({ agentName: req.params.agent, settings: { enabled: true } });
      res.json(result);
    } catch (err) {
      res.status(500).json({ status: 'error', error: err.message });
    }
  });

  adminApiRouter.get('/heartbeat-scheduler/status', (req, res) => {
    res.json({ status: 'success', runningAgents: Array.from(schedulerJobs.keys()), config: HB_CONFIG });
  });

  console.log('[HeartbeatSystem] HTTP API routes registered');
}

// ============ exports ============
module.exports = {
  processToolCall,
  registerRoutes,

  // 额外导出：便于调试
  initializeScheduler,
  shutdownScheduler,
  triggerHeartbeat,
  scheduleNextHeartbeat
};