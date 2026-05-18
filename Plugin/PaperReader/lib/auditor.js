/**
 * Auditor 审核员模块 (v0.4)
 * 
 * 去污染的独立审核：不携带 Rolling Context，只看原文 vs 摘要偏差。
 * 对抗 Context Momentum Bias（上下文惯性偏见）。
 * 
 * 三种抽样策略：
 * 1. 矛盾信号：包含转折词的 chunk
 * 2. 高压缩率：token_count 高但 summary 短
 * 3. Triage 边界：skim 节点中信息密度最高的
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { callLLMJson } = require('./llm');
const { countTokens } = require('./chunker');

const WORKSPACE_ROOT = path.join(__dirname, '..', 'workspace');
const MAX_AUDIT_CHUNKS = parseInt(process.env.PaperReaderMaxAuditChunks || '8', 10);
const MIN_AUDIT_CHUNKS = 3;

// 转折/矛盾信号关键词
const CONTRADICTION_SIGNALS = [
  'however', 'but', 'although', 'nevertheless', 'despite', 'limitation',
  'drawback', 'caveat', 'failed', 'inconsistent', 'contradicts',
  '但是', '然而', '尽管', '不足', '局限', '失败', '矛盾', '相反',
  '不一致', '缺陷', '问题在于', '值得注意的是'
];

/**
 * 从 chunk 摘要列表中选择需要审核的 chunk
 * 
 * @param {Array} summaries - Chunk_Summaries.json 中的 summaries 数组
 * @param {Array} chunkPlan - triage 产出的 chunkPlan（含 readMode）
 * @param {string} chunksDir - chunks 目录路径
 * @returns {Promise<Array<{chunkIndex: number, reason: string, strategy: string}>>}
 */
async function selectAuditSamples(summaries, chunkPlan, chunksDir) {
  const candidates = [];

  // 只审核 deep 模式处理过的 chunk（skim 的摘要本来就是粗略的）
  const deepSummaries = summaries.filter(s => s.readMode === 'deep');

  // ── Strategy 1: 矛盾信号 ──
  for (const s of deepSummaries) {
    const chunkPath = path.join(chunksDir, `chunk_${s.chunkIndex}.md`);
    if (!fsSync.existsSync(chunkPath)) continue;
    const chunkText = await fs.readFile(chunkPath, 'utf-8');
    const lowerText = chunkText.toLowerCase();
    
    const matchedSignals = CONTRADICTION_SIGNALS.filter(sig => lowerText.includes(sig.toLowerCase()));
    if (matchedSignals.length > 0) {
      candidates.push({
        chunkIndex: s.chunkIndex,
        reason: `Contains contradiction signals: ${matchedSignals.slice(0, 3).join(', ')}`,
        strategy: 'contradiction',
        score: matchedSignals.length * 2  // 越多转折词越值得审核
      });
    }
  }

  // ── Strategy 2: 高压缩率（原文长但摘要短） ──
  for (const s of deepSummaries) {
    const chunkPath = path.join(chunksDir, `chunk_${s.chunkIndex}.md`);
    if (!fsSync.existsSync(chunkPath)) continue;
    const chunkText = await fs.readFile(chunkPath, 'utf-8');
    const originalTokens = countTokens(chunkText);
    const summaryTokens = countTokens(s.summary || '');
    
    if (originalTokens > 500 && summaryTokens > 0) {
      const compressionRatio = originalTokens / summaryTokens;
      if (compressionRatio > 15) {  // 压缩比 > 15x 视为异常
        candidates.push({
          chunkIndex: s.chunkIndex,
          reason: `High compression ratio: ${compressionRatio.toFixed(1)}x (${originalTokens} → ${summaryTokens} tokens)`,
          strategy: 'high_compression',
          score: Math.min(compressionRatio / 5, 5)
        });
      }
    }
  }

  // ── Strategy 3: Triage 边界（被 skim 但升级的，或 skim 中最长的） ──
  if (chunkPlan) {
    const skimPlan = chunkPlan.filter(p => p.readMode === 'skim');
    // 找到被 skim 但实际内容很长的 chunk（Triage 可能误判）
    for (const p of skimPlan) {
      const chunkPath = path.join(chunksDir, `chunk_${p.chunkIndex}.md`);
      if (!fsSync.existsSync(chunkPath)) continue;
      const chunkText = await fs.readFile(chunkPath, 'utf-8');
      const tokens = countTokens(chunkText);
      if (tokens > 800) {
        candidates.push({
          chunkIndex: p.chunkIndex,
          reason: `Triage boundary: skim'd chunk with ${tokens} tokens (may contain missed detail)`,
          strategy: 'triage_boundary',
          score: tokens / 400
        });
      }
    }
  }

  // 去重（同一 chunk 可能命中多个策略，取最高分）
  const deduped = new Map();
  for (const c of candidates) {
    const existing = deduped.get(c.chunkIndex);
    if (!existing || c.score > existing.score) {
      deduped.set(c.chunkIndex, c);
    }
  }

  // 按 score 降序，取 top N
  const sorted = [...deduped.values()].sort((a, b) => b.score - a.score);
  const limit = Math.max(MIN_AUDIT_CHUNKS, Math.min(MAX_AUDIT_CHUNKS, sorted.length));
  return sorted.slice(0, limit);
}

/**
 * 对单个 chunk 执行审核
 * 
 * @param {string} chunkText - chunk 原文
 * @param {object} chunkSummary - DeepDive 产出的摘要对象
 * @param {string} globalMap - 全局地图（仅供参考结构）
 * @param {number} chunkIndex
 * @returns {Promise<{match: string, findings: Array}>}
 */
async function auditChunk(chunkText, chunkSummary, globalMap, chunkIndex) {
  const system = [
    '你是一个独立审核员。你的任务是检查阅读摘要是否忠实反映了原文内容。',
    '你没有任何先入为主的上下文——只看原文和摘要的对照。',
    '',
    '输出 JSON（纯 JSON，不要代码块）：',
    '{',
    '  "match": "faithful" | "minor_gap" | "significant_bias",',
    '  "findings": [{',
    '    "type": "omission" | "downplay" | "misinterpret",',
    '    "original_quote": "原文中的关键段落",',
    '    "summary_quote": "摘要中对应的表述（或标注\'缺失\'）",',
    '    "correction": "修正后的准确表述",',
    '    "severity": "high" | "medium" | "low"',
    '  }]',
    '}',
    '',
    '判断标准：',
    '- omission：原文包含重要信息但摘要完全没提',
    '- downplay：原文语气强烈但摘要淡化（如"完全失效"→"有一定局限"）',
    '- misinterpret：摘要的理解与原文含义不一致',
    '- faithful：摘要准确反映了原文核心内容',
    '- minor_gap：有小遗漏但不影响理解',
    '- significant_bias：存在重大偏差需要修正'
  ].join('\n');

  const summaryText = [
    `Summary: ${chunkSummary.summary || ''}`,
    `Key facts: ${(chunkSummary.key_facts || []).join('; ')}`,
    `Claims: ${(chunkSummary.claims || []).join('; ')}`
  ].join('\n');

  const user = [
    `【原文片段 (chunk ${chunkIndex})】`,
    chunkText.slice(0, 8000),  // 限制输入长度
    '',
    `【对应摘要】`,
    summaryText,
    '',
    globalMap ? `【全局地图（仅供参考文档结构）】\n${globalMap.slice(0, 1500)}` : ''
  ].filter(Boolean).join('\n');

  const result = await callLLMJson([
    { role: 'system', content: system },
    { role: 'user', content: user }
  ], { temperature: 0.1, traceTag: `Auditor:chunk_${chunkIndex}` });

  return {
    match: result.match || 'faithful',
    findings: Array.isArray(result.findings) ? result.findings : []
  };
}

/**
 * 执行完整的审核流程
 * 
 * @param {string} paperId - 文档 ID
 * @param {object} options - { chunkPlan, goal }
 * @returns {Promise<{auditReport: object, patchNeeded: boolean, corrections: Array}>}
 */
async function runAudit(paperId, options = {}) {
  const wsDir = path.join(WORKSPACE_ROOT, paperId);
  const chunksDir = path.join(wsDir, 'chunks');
  const notesDir = path.join(wsDir, 'reading_notes');
  const summariesPath = path.join(notesDir, 'Chunk_Summaries.json');
  const globalMapPath = path.join(notesDir, 'Global_Map.md');

  if (!fsSync.existsSync(summariesPath)) {
    throw new Error(`Chunk_Summaries.json not found. Run Read/ReadDeep first.`);
  }

  const summariesData = JSON.parse(await fs.readFile(summariesPath, 'utf-8'));
  const summaries = summariesData.summaries || [];

  const globalMap = fsSync.existsSync(globalMapPath)
    ? await fs.readFile(globalMapPath, 'utf-8')
    : '';

  // ── Step 1: 选择审核样本 ──
  const samples = await selectAuditSamples(summaries, options.chunkPlan || null, chunksDir);
  process.stderr.write(`[PaperReader][Auditor] selected ${samples.length} chunks for audit\n`);

  if (samples.length === 0) {
    const emptyReport = {
      sampledChunks: 0,
      findings: [],
      overallBias: 'none',
      correctedFacts: [],
      generatedAt: new Date().toISOString()
    };
    return { auditReport: emptyReport, patchNeeded: false, corrections: [] };
  }

  // ── Step 2: 逐 chunk 审核 ──
  const allFindings = [];
  const summaryMap = new Map(summaries.map(s => [s.chunkIndex, s]));

  for (const sample of samples) {
    const chunkPath = path.join(chunksDir, `chunk_${sample.chunkIndex}.md`);
    if (!fsSync.existsSync(chunkPath)) continue;

    const chunkText = await fs.readFile(chunkPath, 'utf-8');
    const chunkSummary = summaryMap.get(sample.chunkIndex);
    if (!chunkSummary) continue;

    process.stderr.write(`[PaperReader][Auditor] auditing chunk ${sample.chunkIndex} (${sample.strategy}: ${sample.reason.slice(0, 60)})\n`);

    try {
      const auditResult = await auditChunk(chunkText, chunkSummary, globalMap, sample.chunkIndex);

      for (const finding of auditResult.findings) {
        allFindings.push({
          chunkIndex: sample.chunkIndex,
          auditStrategy: sample.strategy,
          ...finding
        });
      }

      if (auditResult.match !== 'faithful') {
        process.stderr.write(`[PaperReader][Auditor] chunk ${sample.chunkIndex}: ${auditResult.match} (${auditResult.findings.length} findings)\n`);
      }
    } catch (err) {
      process.stderr.write(`[PaperReader][Auditor] chunk ${sample.chunkIndex} audit failed: ${err.message}\n`);
    }
  }

  // ── Step 3: 评估整体偏差 ──
  const highFindings = allFindings.filter(f => f.severity === 'high');
  const mediumFindings = allFindings.filter(f => f.severity === 'medium');
  
  let overallBias = 'none';
  if (highFindings.length >= 2 || (highFindings.length >= 1 && mediumFindings.length >= 3)) {
    overallBias = 'significant';
  } else if (highFindings.length >= 1 || mediumFindings.length >= 2) {
    overallBias = 'mild';
  }

  // ── Step 4: 提取修正项 ──
  const corrections = highFindings.map(f => ({
    chunkIndex: f.chunkIndex,
    type: f.type,
    correction: f.correction,
    originalQuote: f.original_quote
  }));

  const correctedFacts = corrections.map(c => c.correction).filter(Boolean);

  // ── Step 5: 构建审核报告 ──
  const auditReport = {
    sampledChunks: samples.length,
    totalFindings: allFindings.length,
    findings: allFindings,
    overallBias,
    correctedFacts,
    samples: samples.map(s => ({ chunkIndex: s.chunkIndex, strategy: s.strategy, reason: s.reason })),
    generatedAt: new Date().toISOString()
  };

  // 持久化
  const reportPath = path.join(notesDir, 'audit_report.json');
  await fs.writeFile(reportPath, JSON.stringify(auditReport, null, 2), 'utf-8');
  process.stderr.write(`[PaperReader][Auditor] report saved: ${allFindings.length} findings, overallBias=${overallBias}\n`);

  return {
    auditReport,
    patchNeeded: overallBias === 'significant' || highFindings.length > 0,
    corrections
  };
}

/**
 * PatchContext：将审核修正注入到 Rolling Context 和 Chunk_Summaries
 * 
 * @param {string} paperId
 * @param {Array} corrections - runAudit 产出的 corrections
 * @returns {Promise<{patched: number}>}
 */
async function patchContext(paperId, corrections) {
  if (!corrections || corrections.length === 0) return { patched: 0 };

  const wsDir = path.join(WORKSPACE_ROOT, paperId);
  const notesDir = path.join(wsDir, 'reading_notes');
  const summariesPath = path.join(notesDir, 'Chunk_Summaries.json');

  // 更新 Chunk_Summaries.json
  if (fsSync.existsSync(summariesPath)) {
    const data = JSON.parse(await fs.readFile(summariesPath, 'utf-8'));
    const summaryMap = new Map((data.summaries || []).map(s => [s.chunkIndex, s]));

    for (const corr of corrections) {
      const summary = summaryMap.get(corr.chunkIndex);
      if (summary) {
        summary.audited = true;
        summary.auditCorrection = corr.correction;
        // 将修正追加到 key_facts
        if (corr.correction) {
          summary.key_facts = summary.key_facts || [];
          summary.key_facts.push(`[AUDIT CORRECTION] ${corr.correction}`);
        }
      }
    }

    data.summaries = [...summaryMap.values()];
    await fs.writeFile(summariesPath, JSON.stringify(data, null, 2), 'utf-8');
  }

  process.stderr.write(`[PaperReader][Auditor] PatchContext: ${corrections.length} corrections applied\n`);
  return { patched: corrections.length };
}

module.exports = { runAudit, patchContext, selectAuditSamples, auditChunk };
