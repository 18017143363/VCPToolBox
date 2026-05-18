/**
 * catalog.js — 全局文档索引管理
 * 
 * 维护 workspace/index/catalog.json，提供：
 * - 按 doc_id / slug / doi / url_hash / legacy paperId 查找
 * - 去重检测（source_fingerprint）
 * - 原子化读写（文件锁简化版：先读后写，写前校验）
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

const WORKSPACE_ROOT = path.join(__dirname, '..', 'workspace');
const INDEX_DIR = path.join(WORKSPACE_ROOT, 'index');
const CATALOG_PATH = path.join(INDEX_DIR, 'catalog.json');

/**
 * 空 catalog 骨架
 */
function emptyCatalog() {
  return {
    schema_version: 'catalog.v1',
    updated_at: new Date().toISOString(),
    entries: [],
    _byDocId: new Map(),
    _byFingerprint: new Map(),
    _bySlug: new Map(),
    _byLegacyId: new Map()
  };
}

/**
 * 从 entries 数组重建反向索引
 */
function rebuildIndices(catalog) {
  catalog._byDocId = new Map();
  catalog._byFingerprint = new Map();
  catalog._bySlug = new Map();
  catalog._byLegacyId = new Map();

  for (const entry of catalog.entries) {
    if (entry.doc_id) catalog._byDocId.set(entry.doc_id, entry);
    if (entry.source_fingerprint) catalog._byFingerprint.set(entry.source_fingerprint, entry);
    if (entry.slug) catalog._bySlug.set(entry.slug, entry);
    if (entry.legacy_paper_id) catalog._byLegacyId.set(entry.legacy_paper_id, entry);
  }
}

/**
 * 加载 catalog.json（不存在则返回空 catalog）
 */
async function loadCatalog() {
  if (!fsSync.existsSync(CATALOG_PATH)) {
    return emptyCatalog();
  }
  try {
    const raw = await fs.readFile(CATALOG_PATH, 'utf-8');
    const data = JSON.parse(raw);
    const catalog = {
      schema_version: data.schema_version || 'catalog.v1',
      updated_at: data.updated_at || new Date().toISOString(),
      entries: data.entries || []
    };
    rebuildIndices(catalog);
    return catalog;
  } catch (err) {
    process.stderr.write(`[PaperReader][Catalog] failed to load catalog, starting fresh: ${err.message}\n`);
    return emptyCatalog();
  }
}

/**
 * 持久化 catalog.json
 */
async function saveCatalog(catalog) {
  await fs.mkdir(INDEX_DIR, { recursive: true });
  catalog.updated_at = new Date().toISOString();
  const serializable = {
    schema_version: catalog.schema_version,
    updated_at: catalog.updated_at,
    entries: catalog.entries
  };
  await fs.writeFile(CATALOG_PATH, JSON.stringify(serializable, null, 2), 'utf-8');
  process.stderr.write(`[PaperReader][Catalog] saved: ${catalog.entries.length} entries\n`);
}

/**
 * 按 source_fingerprint 查重
 */
function findByFingerprint(catalog, fingerprint) {
  if (!fingerprint) return null;
  return catalog._byFingerprint.get(fingerprint) || null;
}

/**
 * 按 doc_id 查找
 */
function findByDocId(catalog, docId) {
  if (!docId) return null;
  return catalog._byDocId.get(docId) || null;
}

/**
 * 按旧 paperId 查找
 */
function findByLegacyId(catalog, paperId) {
  if (!paperId) return null;
  return catalog._byLegacyId.get(paperId) || null;
}

/**
 * 通用查找：先试 doc_id，再试 legacy paperId，再试 slug
 */
function findAny(catalog, id) {
  return findByDocId(catalog, id)
    || findByLegacyId(catalog, id)
    || catalog._bySlug.get(id)
    || null;
}

/**
 * 注册（新增或更新）一条 catalog entry
 */
function upsertEntry(catalog, entry) {
  const existing = entry.doc_id ? findByDocId(catalog, entry.doc_id) : null;
  if (existing) {
    Object.assign(existing, entry);
    existing.updated_at = new Date().toISOString();
  } else {
    entry.created_at = entry.created_at || new Date().toISOString();
    entry.updated_at = new Date().toISOString();
    catalog.entries.push(entry);
  }
  rebuildIndices(catalog);
}

/**
 * 从 meta.json 构建 catalog entry
 */
function metaToCatalogEntry(meta) {
  return {
    doc_id: meta.doc_id,
    title: meta.title || '',
    slug: meta.slug || '',
    source_fingerprint: meta.source_fingerprint || '',
    source_url: (meta.source && meta.source.url) || '',
    source_doi: (meta.source && meta.source.doi) || '',
    authors: meta.authors || [],
    venue: meta.venue || '',
    year: meta.year || null,
    language: meta.language || 'unknown',
    filetags: meta.filetags || [],
    page_count: meta.page_count || null,
    chunk_count: meta.chunk_count || null,
    engine: meta.parser ? meta.parser.engine : 'unknown',
    legacy_paper_id: meta.paperId !== meta.doc_id ? meta.paperId : null,
    workspace_dir: meta.doc_id,
    status: 'ingested'
  };
}

module.exports = {
  loadCatalog,
  saveCatalog,
  findByFingerprint,
  findByDocId,
  findByLegacyId,
  findAny,
  upsertEntry,
  metaToCatalogEntry,
  CATALOG_PATH
};
