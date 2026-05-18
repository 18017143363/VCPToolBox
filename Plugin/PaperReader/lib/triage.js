/**
 * Triage 分诊模块 (v0.4)
 * 
 * 基于树索引 + 用户 goal + 已读记录，为每个节点分配阅读策略。
 * 产出 attentionMap：deep / skim / skip + 依赖拓扑 + 建议顺序。
 * 
 * 核心设计：Skim ≠ 跳过，Skim = 不写入 Rolling Context。
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { callLLMJson } = require('./llm');

const WORKSPACE_ROOT = path.join(__dirname, '..', 'workspace');

/**
 * 将树索引扁平化为节点列表（保留层级信息）
 */
function flattenTree(nodes, depth = 0) {
  const result = [];
  for (const n of nodes) {
    result.push({
      node_id: n.node_id,
      title: n.title,
      summary: n.summary || '',
      priority: n.priority || 'medium',
      token_count: n.token_count || 0,
      chunk_range: n.chunk_range,
      depth
    });
    if (n.nodes) {
      result.push(...flattenTree(n.nodes, depth + 1));
    }
  }
  return result;
}

/**
 * 执行 Triage 分诊
 * 
 * @param {string} paperId - 文档 ID
 * @param {object} options - { goal, readLog }
 * @returns {Promise<object>} attentionMap + triageMeta
 */
async function runTriage(paperId, options = {}) {
  const wsDir = path.join(WORKSPACE_ROOT, paperId);
  const notesDir = path.join(wsDir, 'reading_notes');
  const treeIndexPath = path.join(notesDir, 'tree_index.json');
  const globalMapPath = path.join(notesDir, 'Global_Map.md');

  if (!fsSync.existsSync(treeIndexPath)) {
    throw new Error(`tree_index.json not found: ${treeIndexPath}. Run ReadSkeleton first.`);
  }

  const treeData = JSON.parse(await fs.readFile(treeIndexPath, 'utf-8'));
  const treeNodes = treeData.nodes || [];
  const flatNodes = flattenTree(treeNodes);

  // 过滤掉没有 chunk_range 的节点（无法实际阅读）
  const actionableNodes = flatNodes.filter(n => n.chunk_range && n.chunk_range.length === 2);

  if (actionableNodes.length === 0) {
    process.stderr.write(`[PaperReader][Triage] no actionable nodes found, defaulting all to deep\n`);
    return { attentionMap: {}, triageMeta: { totalNodes: 0, deep: 0, skim: 0, skip: 0 } };
  }

  // 加载 Global Map（作为上下文）
  let globalMap = '';
  if (fsSync.existsSync(globalMapPath)) {
    globalMap = await fs.readFile(globalMapPath, 'utf-8');
  }

  // 已读记录：排除已深读的节点
  const readLog = options.readLog || [];
  const deepReadNodeIds = new Set(
    readLog.filter(r => r.readMode === 'deep').map(r => r.nodeId)
  );

  const goal = options.goal || '全面理解文档核心内容';

  // 构造 LLM prompt
  const system = [
    '你是一个阅读策略规划器。根据文档结构和用户的阅读目标，为每个章节分配阅读策略。',
    '',
    '输出 JSON 数组（纯 JSON，不要代码块），每个元素：',
    '{',
    '  "node_id": string,',
    '  "read_mode": "deep" | "skim" | "skip",',
    '  "reason": "为什么这样分配（一句话）",',
    '  "depends_on": [string]  // 依赖的前置节点 node_id（需要先读的章节）',
    '}',
    '',
    '策略规则：',
    '- deep：与 goal 直接相关、包含核心方法/结果/创新点的章节',
    '- skim：背景知识、相关工作、已知领域的综述性内容',
    '- skip：致谢、参考文献、与 goal 无关的附录、作者信息',
    '- depends_on：如果理解当前章节需要先读另一个章节，填入其 node_id',
    '  例如 Results 依赖 Methods（先读方法才能理解结果）',
    '- 注意：顺序可以打乱（比如先读 Results 再读 Discussion）'
  ].join('\n');

  const nodeDescriptions = actionableNodes.map(n => {
    const alreadyRead = deepReadNodeIds.has(n.node_id) ? ' [已深读]' : '';
    return `- ${n.node_id}: ${n.title} (priority=${n.priority}, tokens=${n.token_count})${alreadyRead}`;
  }).join('\n');

  const user = [
    `【阅读目标】${goal}`,
    '',
    `【文档结构（${actionableNodes.length} 个可阅读章节）】`,
    nodeDescriptions,
    '',
    globalMap ? `【全局地图摘要】\n${globalMap.slice(0, 3000)}` : ''
  ].filter(Boolean).join('\n');

  process.stderr.write(`[PaperReader][Triage] starting: ${actionableNodes.length} nodes, goal="${goal.slice(0, 50)}"\n`);

  let triageResult;
  try {
    triageResult = await callLLMJson([
      { role: 'system', content: system },
      { role: 'user', content: user }
    ], { temperature: 0.1, traceTag: 'Triage:plan' });
  } catch (err) {
    process.stderr.write(`[PaperReader][Triage] LLM call failed, defaulting all to deep: ${err.message}\n`);
    triageResult = actionableNodes.map(n => ({
      node_id: n.node_id,
      read_mode: 'deep',
      reason: 'Triage LLM failed, defaulting to deep',
      depends_on: []
    }));
  }

  // 构建 attentionMap
  const arr = Array.isArray(triageResult) ? triageResult : [];
  const attentionMap = {};
  const nodeIndex = new Map(actionableNodes.map(n => [n.node_id, n]));

  for (const item of arr) {
    if (!item.node_id || !nodeIndex.has(item.node_id)) continue;
    const node = nodeIndex.get(item.node_id);

    // 已深读的节点强制 skip
    let readMode = item.read_mode || 'deep';
    if (deepReadNodeIds.has(item.node_id)) {
      readMode = 'skip';
    }

    attentionMap[item.node_id] = {
      title: node.title,
      priority: readMode === 'deep' ? 'high' : readMode === 'skim' ? 'medium' : 'low',
      readMode,
      reason: item.reason || '',
      chunkRange: node.chunk_range,
      dependencies: (item.depends_on || []).filter(d => nodeIndex.has(d))
    };
  }

  // 补全未被 LLM 标注的节点（默认 deep）
  for (const n of actionableNodes) {
    if (!attentionMap[n.node_id]) {
      attentionMap[n.node_id] = {
        title: n.title,
        priority: deepReadNodeIds.has(n.node_id) ? 'low' : 'medium',
        readMode: deepReadNodeIds.has(n.node_id) ? 'skip' : 'deep',
        reason: 'Not annotated by Triage LLM, defaulting',
        chunkRange: n.chunk_range,
        dependencies: []
      };
    }
  }

  // 统计
  const counts = { deep: 0, skim: 0, skip: 0 };
  for (const entry of Object.values(attentionMap)) {
    counts[entry.readMode] = (counts[entry.readMode] || 0) + 1;
  }

  const triageMeta = {
    totalNodes: Object.keys(attentionMap).length,
    ...counts,
    goal
  };

  process.stderr.write(`[PaperReader][Triage] done: deep=${counts.deep}, skim=${counts.skim}, skip=${counts.skip}\n`);

  // 持久化 attention_map.json
  await fs.mkdir(notesDir, { recursive: true });
  const attentionMapPath = path.join(notesDir, 'attention_map.json');
  await fs.writeFile(attentionMapPath, JSON.stringify({
    generated_at: new Date().toISOString(),
    goal,
    meta: triageMeta,
    nodes: attentionMap
  }, null, 2), 'utf-8');

  return { attentionMap, triageMeta, attentionMapPath };
}

/**
 * 从 attentionMap 生成拓扑排序的阅读顺序
 * 尊重 dependencies 约束：依赖的节点先读
 * 
 * @param {object} attentionMap
 * @returns {string[]} 按拓扑排序的 node_id 列表（仅 deep + skim）
 */
function topoSortReadOrder(attentionMap) {
  const nodes = Object.entries(attentionMap)
    .filter(([_, v]) => v.readMode !== 'skip')
    .map(([id, v]) => ({ id, deps: v.dependencies || [], mode: v.readMode }));

  const nodeSet = new Set(nodes.map(n => n.id));
  const adjList = new Map();
  const inDegree = new Map();

  for (const n of nodes) {
    adjList.set(n.id, []);
    inDegree.set(n.id, 0);
  }

  for (const n of nodes) {
    for (const dep of n.deps) {
      if (nodeSet.has(dep)) {
        adjList.get(dep).push(n.id);
        inDegree.set(n.id, (inDegree.get(n.id) || 0) + 1);
      }
    }
  }

  // Kahn's algorithm
  const queue = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  // Within the same level, prioritize deep over skim
  const modeOrder = { deep: 0, skim: 1 };
  const modeMap = new Map(nodes.map(n => [n.id, n.mode]));
  queue.sort((a, b) => (modeOrder[modeMap.get(a)] || 0) - (modeOrder[modeMap.get(b)] || 0));

  const sorted = [];
  while (queue.length > 0) {
    const current = queue.shift();
    sorted.push(current);
    for (const neighbor of (adjList.get(current) || [])) {
      const newDeg = (inDegree.get(neighbor) || 1) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) {
        queue.push(neighbor);
        queue.sort((a, b) => (modeOrder[modeMap.get(a)] || 0) - (modeOrder[modeMap.get(b)] || 0));
      }
    }
  }

  // Handle cycles: append any remaining nodes (O(n) with Set)
  const sortedSet = new Set(sorted);
  for (const n of nodes) {
    if (!sortedSet.has(n.id)) {
      sorted.push(n.id);
    }
  }

  return sorted;
}

/**
 * 从 attentionMap 展开为 chunk 级别的阅读计划
 * 
 * @param {object} attentionMap
 * @param {string[]} readOrder - topoSortReadOrder 产出
 * @returns {Array<{chunkIndex: number, readMode: string, nodeId: string, section: string}>}
 */
function expandToChunkPlan(attentionMap, readOrder) {
  const plan = [];
  const seen = new Set();

  // First: add nodes in topo-sorted read order (deep + skim)
  for (const nodeId of readOrder) {
    const entry = attentionMap[nodeId];
    if (!entry || !entry.chunkRange) continue;

    const [start, end] = entry.chunkRange;
    for (let i = start; i <= end; i++) {
      if (seen.has(i)) continue;
      seen.add(i);
      plan.push({
        chunkIndex: i,
        readMode: entry.readMode,
        nodeId,
        section: entry.title
      });
    }
  }

  // Then: add skip nodes so deep-reader can track accurate skip stats
  for (const [nodeId, entry] of Object.entries(attentionMap)) {
    if (entry.readMode !== 'skip' || !entry.chunkRange) continue;
    const [start, end] = entry.chunkRange;
    for (let i = start; i <= end; i++) {
      if (seen.has(i)) continue;
      seen.add(i);
      plan.push({
        chunkIndex: i,
        readMode: 'skip',
        nodeId,
        section: entry.title
      });
    }
  }

  return plan;
}

module.exports = { runTriage, topoSortReadOrder, expandToChunkPlan, flattenTree };
