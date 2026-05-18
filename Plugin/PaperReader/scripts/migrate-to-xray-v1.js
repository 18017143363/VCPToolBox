/**
 * migrate-to-xray-v1.js — 旧 workspace 数据迁移到 xray.v1 规范
 * 
 * 三阶段：扫描 → 映射 → 执行
 * 支持 --dry-run 模式
 * 
 * 用法：
 *   node scripts/migrate-to-xray-v1.js              # dry-run（默认）
 *   node scripts/migrate-to-xray-v1.js --apply       # 真实执行
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

// 加载 lib 模块
const { generateDocId, generateSlug, computeFingerprint, buildMeta, generateFrontMatter, extractTitleFromMarkdown, classifyId } = require('../lib/doc-id');
const catalog = require('../lib/catalog');

const WORKSPACE_ROOT = path.join(__dirname, '..', 'workspace');

async function main() {
  const dryRun = !process.argv.includes('--apply');
  console.log(`\n=== PaperReader xray.v1 Migration ===${dryRun ? ' [DRY RUN]' : ' [APPLYING]'}\n`);

  // ── Phase 1: 扫描 ──
  console.log('Phase 1: Scanning workspace...');
  const entries = await fs.readdir(WORKSPACE_ROOT, { withFileTypes: true });
  const candidates = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === 'index') continue;       // 跳过索引目录
    if (entry.name.startsWith('_tmp_')) continue; // 跳过临时目录
    if (classifyId(entry.name) === 'xray') {
      console.log(`  SKIP (already xray): ${entry.name}`);
      continue;
    }

    const dirPath = path.join(WORKSPACE_ROOT, entry.name);
    const metaPath = path.join(dirPath, 'meta.json');
    const mdPath = path.join(dirPath, 'full_text.md');
    const manifestPath = path.join(dirPath, 'chunks', 'manifest.json');

    let meta = null;
    let markdown = '';
    let manifest = null;

    if (fsSync.existsSync(metaPath)) {
      try { meta = JSON.parse(await fs.readFile(metaPath, 'utf-8')); } catch {}
    }
    if (fsSync.existsSync(mdPath)) {
      try { markdown = await fs.readFile(mdPath, 'utf-8'); } catch {}
    }
    if (fsSync.existsSync(manifestPath)) {
      try { manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8')); } catch {}
    }

    candidates.push({
      oldDirName: entry.name,
      dirPath,
      meta,
      markdown,
      manifest,
      metaPath,
      mdPath
    });
  }

  console.log(`  Found ${candidates.length} candidate(s) for migration.\n`);
  if (candidates.length === 0) {
    console.log('Nothing to migrate.');
    return;
  }

  // ── Phase 2: 映射 ──
  console.log('Phase 2: Building migration plan...');
  const plan = [];

  for (const c of candidates) {
    // 推断标题
    const title = (c.meta && c.meta.title)
      || extractTitleFromMarkdown(c.markdown)
      || c.oldDirName;

    const slug = generateSlug(title);
    const docId = generateDocId(title);

    // 来源指纹
    const fpResult = computeFingerprint({
      doi: c.meta && c.meta.doi,
      url: c.meta && c.meta.url,
      filePath: (c.meta && c.meta.sourceFilePath) || c.dirPath
    });

    const newDirPath = path.join(WORKSPACE_ROOT, docId);

    plan.push({
      oldDirName: c.oldDirName,
      oldDirPath: c.dirPath,
      newDirName: docId,
      newDirPath,
      title,
      slug,
      docId,
      fingerprint: fpResult.fingerprint,
      oldMeta: c.meta,
      chunkCount: c.manifest ? c.manifest.chunkCount : null,
      engine: c.meta ? c.meta.engine : 'unknown',
      pageCount: c.meta ? (c.meta.pageCount || c.meta.page_count) : null,
      sourceFilePath: c.meta ? c.meta.sourceFilePath : '',
      mdPath: c.mdPath,
      metaPath: c.metaPath
    });

    console.log(`  ${c.oldDirName} → ${docId}`);
    console.log(`    title: ${title.slice(0, 60)}${title.length > 60 ? '...' : ''}`);
    console.log(`    slug: ${slug}`);
    console.log(`    fingerprint: ${fpResult.fingerprint}`);
  }

  // Save plan
  const planPath = path.join(WORKSPACE_ROOT, 'index', 'migration_plan.json');
  await fs.mkdir(path.join(WORKSPACE_ROOT, 'index'), { recursive: true });
  await fs.writeFile(planPath, JSON.stringify(plan, null, 2), 'utf-8');
  console.log(`\n  Plan saved to: ${planPath}`);

  if (dryRun) {
    console.log('\n[DRY RUN] No changes applied. Run with --apply to execute.');
    return;
  }

  // ── Phase 3: 执行 ──
  console.log('\nPhase 3: Executing migration...');
  const cat = await catalog.loadCatalog();
  const report = [];

  for (const item of plan) {
    try {
      // 3a: 重命名目录
      if (!fsSync.existsSync(item.newDirPath)) {
        await fs.rename(item.oldDirPath, item.newDirPath);
        console.log(`  RENAMED: ${item.oldDirName} → ${item.newDirName}`);
      } else {
        console.log(`  SKIP RENAME (target exists): ${item.newDirName}`);
        report.push({ ...item, status: 'skipped', reason: 'target exists' });
        continue;
      }

      // 3b: 写入新 meta.json
      const newMeta = buildMeta({
        docId: item.docId,
        title: item.title,
        slug: item.slug,
        source: { url: '', type: 'paper', doi: '' },
        sourceFingerprint: item.fingerprint,
        authors: (item.oldMeta && item.oldMeta.authors) || [],
        venue: (item.oldMeta && item.oldMeta.venue) || '',
        year: (item.oldMeta && item.oldMeta.year) || null,
        language: 'unknown',
        filetags: ['read', 'xray', 'migrated'],
        pageCount: item.pageCount,
        textLength: null,
        chunkCount: item.chunkCount,
        engine: item.engine,
        sourceFilePath: item.sourceFilePath
      });

      const newMetaPath = path.join(item.newDirPath, 'meta.json');
      await fs.writeFile(newMetaPath, JSON.stringify(newMeta, null, 2), 'utf-8');

      // 3c: 注入 front matter 到 full_text.md
      const newMdPath = path.join(item.newDirPath, 'full_text.md');
      if (fsSync.existsSync(newMdPath)) {
        let mdContent = await fs.readFile(newMdPath, 'utf-8');
        // 检查是否已有 front matter
        if (!mdContent.startsWith('---')) {
          const fm = generateFrontMatter(newMeta);
          mdContent = `${fm}\n\n${mdContent}`;
          await fs.writeFile(newMdPath, mdContent, 'utf-8');
          console.log(`  INJECTED front matter: ${item.newDirName}/full_text.md`);
        }
      }

      // 3d: 注册 catalog
      const entry = catalog.metaToCatalogEntry(newMeta);
      entry.legacy_paper_id = item.oldDirName;
      catalog.upsertEntry(cat, entry);

      report.push({ ...item, status: 'migrated' });
      console.log(`  DONE: ${item.oldDirName} → ${item.newDirName}`);

    } catch (err) {
      console.error(`  ERROR migrating ${item.oldDirName}: ${err.message}`);
      report.push({ ...item, status: 'error', error: err.message });
    }
  }

  // Save catalog
  await catalog.saveCatalog(cat);

  // Save report
  const reportLines = [
    '# PaperReader xray.v1 Migration Report',
    `Date: ${new Date().toISOString()}`,
    `Total: ${report.length}`,
    `Migrated: ${report.filter(r => r.status === 'migrated').length}`,
    `Skipped: ${report.filter(r => r.status === 'skipped').length}`,
    `Errors: ${report.filter(r => r.status === 'error').length}`,
    '',
    '## Details',
    '',
    '| Old ID | New doc_id | Title | Status |',
    '|--------|-----------|-------|--------|',
    ...report.map(r =>
      `| ${r.oldDirName} | ${r.docId} | ${r.title.slice(0, 40)} | ${r.status} |`
    )
  ];
  const reportPath = path.join(WORKSPACE_ROOT, 'index', 'migration_report.md');
  await fs.writeFile(reportPath, reportLines.join('\n'), 'utf-8');
  console.log(`\nReport saved to: ${reportPath}`);
  console.log('\nMigration complete.');
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
