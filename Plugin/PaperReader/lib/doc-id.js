/**
 * doc-id.js — xray.v1 文档身份与元信息模块
 * 
 * 职责：
 * - doc_id 生成（xray-{YYYYMMDDTHHMMSS}-{slug8}）
 * - slug 生成（从标题提取人类可读短名）
 * - source_fingerprint 计算（DOI > URL hash > 文件 hash）
 * - meta.json xray.v1 schema 构建
 * - full_text.md YAML front matter 注入
 */

const crypto = require('crypto');

const SCHEMA_VERSION = 'xray.v1';

// ─── slug 生成 ───

/**
 * 从标题生成 URL-safe 短名（slug）
 * 规则：小写、去标点、空格转连字符、截断到 maxLen 字符
 */
function generateSlug(title, maxLen = 48) {
  if (!title || typeof title !== 'string') return 'untitled';

  let slug = title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')  // 保留字母、数字、空格、连字符（含中文）
    .replace(/[\s_]+/g, '-')              // 空格/下划线 → 连字符
    .replace(/-{2,}/g, '-')              // 多连字符 → 单连字符
    .replace(/^-|-$/g, '');              // 去首尾连字符

  if (slug.length > maxLen) {
    slug = slug.slice(0, maxLen);
    const lastDash = slug.lastIndexOf('-');
    if (lastDash > maxLen * 0.5) {
      slug = slug.slice(0, lastDash);
    }
  }

  return slug || 'untitled';
}

/**
 * 生成 8 字符的 slug 摘要（用于 doc_id 后缀）
 */
function slugDigest(slug) {
  return crypto.createHash('sha1').update(slug).digest('hex').slice(0, 8);
}

// ─── source fingerprint ───

/**
 * 计算来源指纹。优先级：DOI > URL hash > 文件内容 hash > 文件路径 hash
 */
function computeFingerprint({ doi, url, fileContent, filePath }) {
  if (doi && typeof doi === 'string' && doi.trim()) {
    const normalized = doi.trim().toLowerCase().replace(/^https?:\/\/doi\.org\//i, '');
    return { fingerprint: `doi:${normalized}`, method: 'doi' };
  }

  if (url && typeof url === 'string' && url.trim()) {
    const hash = crypto.createHash('sha256').update(url.trim()).digest('hex').slice(0, 16);
    return { fingerprint: `url:${hash}`, method: 'url_hash' };
  }

  if (fileContent) {
    const buf = Buffer.isBuffer(fileContent) ? fileContent : Buffer.from(fileContent);
    const hash = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16);
    return { fingerprint: `file:${hash}`, method: 'file_hash' };
  }

  if (filePath && typeof filePath === 'string') {
    const hash = crypto.createHash('sha1').update(filePath).digest('hex').slice(0, 16);
    return { fingerprint: `path:${hash}`, method: 'path_hash' };
  }

  return { fingerprint: `unknown:${Date.now()}`, method: 'path_hash' };
}

// ─── doc_id 生成 ───

/**
 * 生成 xray.v1 格式的 doc_id
 * 格式：xray-{YYYYMMDDTHHMMSS}-{slug8}
 */
function generateDocId(title, date) {
  const d = date || new Date();
  const ts = d.getFullYear().toString()
    + String(d.getMonth() + 1).padStart(2, '0')
    + String(d.getDate()).padStart(2, '0')
    + 'T'
    + String(d.getHours()).padStart(2, '0')
    + String(d.getMinutes()).padStart(2, '0')
    + String(d.getSeconds()).padStart(2, '0');

  const slug = generateSlug(title);
  const digest = slugDigest(slug);

  return `xray-${ts}-${digest}`;
}

// ─── meta.json schema ───

/**
 * 构建 xray.v1 标准化 meta.json 对象
 */
function buildMeta({
  docId, title, slug, source, sourceFingerprint,
  authors, venue, year, language, filetags,
  pageCount, textLength, chunkCount, engine, sourceFilePath
}) {
  const now = new Date().toISOString();
  return {
    schema_version: SCHEMA_VERSION,
    doc_id: docId,
    title: title || '',
    slug: slug || '',
    date_ingested: now,
    identifier: docId.replace('xray-', '').split('-')[0],
    source: {
      url: (source && source.url) || '',
      type: (source && source.type) || 'unknown',
      doi: (source && source.doi) || ''
    },
    source_fingerprint: sourceFingerprint || '',
    authors: authors || [],
    venue: venue || '',
    year: year || null,
    language: language || 'unknown',
    filetags: filetags || ['read', 'xray'],
    page_count: pageCount || null,
    text_length: textLength || null,
    chunk_count: chunkCount || null,
    parser: {
      engine: engine || 'unknown',
      fallback_used: engine === 'pdf-parse'
    },
    source_file_path: sourceFilePath || '',
    // 向后兼容：保留旧 paperId 字段（过渡期）
    paperId: docId
  };
}

// ─── YAML front matter ───

function escapeYamlString(str) {
  if (!str) return '';
  return String(str).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * 生成 YAML front matter 字符串
 */
function generateFrontMatter(meta) {
  const lines = [
    '---',
    `schema_version: ${meta.schema_version}`,
    `doc_id: ${meta.doc_id}`,
    `title: "${escapeYamlString(meta.title)}"`,
    `slug: ${meta.slug}`,
    `date_ingested: ${meta.date_ingested}`,
    `filetags: [${meta.filetags.join(', ')}]`,
    `identifier: ${meta.identifier}`,
    `source:`,
    `  url: "${escapeYamlString(meta.source.url)}"`,
    `  type: ${meta.source.type}`,
    `  doi: "${escapeYamlString(meta.source.doi)}"`,
    `source_fingerprint: ${meta.source_fingerprint}`,
    `authors: [${meta.authors.map(a => `"${escapeYamlString(a)}"`).join(', ')}]`,
    `venue: "${escapeYamlString(meta.venue)}"`,
    `year: ${meta.year || 'null'}`,
    `language: ${meta.language}`,
    `page_count: ${meta.page_count || 'null'}`,
    `chunk_count: ${meta.chunk_count || 'null'}`,
    `parser:`,
    `  engine: ${meta.parser.engine}`,
    `  fallback_used: ${meta.parser.fallback_used}`,
    '---'
  ];
  return lines.join('\n');
}

/**
 * 从 Markdown 文本提取标题（第一个 # 标题或前 200 字符）
 */
function extractTitleFromMarkdown(markdown) {
  if (!markdown) return 'Untitled Document';
  const lines = markdown.split('\n');
  for (const line of lines) {
    const match = line.match(/^#\s+(.+)$/);
    if (match) {
      return match[1].trim();
    }
  }
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && trimmed.length > 3) {
      return trimmed.slice(0, 120);
    }
  }
  return 'Untitled Document';
}

/**
 * 判断一个 ID 是新格式（xray-*）还是旧格式（paper-*）
 */
function classifyId(id) {
  if (!id) return 'custom';
  if (id.startsWith('xray-')) return 'xray';
  if (id.startsWith('paper-')) return 'legacy';
  return 'custom';
}

module.exports = {
  SCHEMA_VERSION,
  generateSlug,
  slugDigest,
  computeFingerprint,
  generateDocId,
  buildMeta,
  generateFrontMatter,
  escapeYamlString,
  extractTitleFromMarkdown,
  classifyId
};
