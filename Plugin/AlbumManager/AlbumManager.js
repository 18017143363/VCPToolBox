const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');

const PROJECT_BASE_PATH = process.env.PROJECT_BASE_PATH || path.join(__dirname, '..', '..');
const IMAGE_ROOT = path.join(PROJECT_BASE_PATH, 'image');
const DAILYNOTE_ROOT = process.env.KNOWLEDGEBASE_ROOT_PATH || path.join(PROJECT_BASE_PATH, 'dailynote');

const VCHAT_GENERATED_LISTS_PATH = process.env.VCHAT_GENERATED_LISTS_PATH || 'E:\\VCPCHAT\\AppData\\generated_lists';
const EMOTICON_LIBRARY_PATH = process.env.EMOTICON_LIBRARY_PATH || path.join(VCHAT_GENERATED_LISTS_PATH, 'emoticon_library.json');
const EMOTICON_SERVER_HOST = process.env.EMOTICON_SERVER_HOST || '127.0.0.1';
const EMOTICON_SERVER_PORT = process.env.EMOTICON_SERVER_PORT || '6005';
const EMOTICON_FILE_KEY = process.env.EMOTICON_FILE_KEY || '147258369plm';

const DEFAULT_ALBUM_NAME = 'Rosa相册表情包';
const DEFAULT_MAID = 'Rosa';

function sanitizeFileName(name = '') {
  return String(name).replace(/[\\/:*?"<>|]/g, '_').trim();
}

function normalizeTags(tags) {
  if (!tags) return '';
  if (Array.isArray(tags)) return tags.join(', ');
  return String(tags);
}

function ensureExt(ext, fallback = '.jpg') {
  if (!ext) return fallback;
  return ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`;
}

function extFromUrl(url) {
  try {
    const clean = url.split('?')[0].split('#')[0];
    const ext = path.extname(clean);
    return ensureExt(ext || '.jpg');
  } catch {
    return '.jpg';
  }
}

function extFromContentType(contentType = '') {
  const ct = String(contentType).toLowerCase();
  if (ct.includes('png')) return '.png';
  if (ct.includes('webp')) return '.webp';
  if (ct.includes('gif')) return '.gif';
  if (ct.includes('bmp')) return '.bmp';
  if (ct.includes('jpeg') || ct.includes('jpg')) return '.jpg';
  return '.jpg';
}

function resolveFileUrl(source) {
  if (source.startsWith('file:///')) return source.replace('file:///', '');
  if (source.startsWith('file://')) return source.replace('file://', '');
  return source;
}

async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function uniquePath(fullPath) {
  if (!(await fileExists(fullPath))) return fullPath;
  const dir = path.dirname(fullPath);
  const ext = path.extname(fullPath);
  const base = path.basename(fullPath, ext);
  let i = 1;
  while (true) {
    const candidate = path.join(dir, `${base}(${i})${ext}`);
    if (!(await fileExists(candidate))) return candidate;
    i++;
  }
}

async function saveFromHttp(source, targetPath) {
  const resp = await axios.get(source, { responseType: 'arraybuffer', timeout: 60000 });
  const contentType = resp.headers['content-type'] || '';
  const guessedExt = extFromContentType(contentType);
  let finalPath = targetPath;
  if (!path.extname(finalPath)) finalPath += guessedExt;
  finalPath = await uniquePath(finalPath);
  await fs.writeFile(finalPath, Buffer.from(resp.data));
  return finalPath;
}

async function saveFromLocal(source, targetPath) {
  const localPath = resolveFileUrl(source).replaceAll('/', path.sep);
  let finalPath = targetPath;
  if (!path.extname(finalPath)) finalPath += ensureExt(path.extname(localPath) || '.jpg');
  finalPath = await uniquePath(finalPath);
  await fs.copyFile(localPath, finalPath);
  return finalPath;
}

async function updateGeneratedList(albumName, finalFileName) {
  await fs.mkdir(VCHAT_GENERATED_LISTS_PATH, { recursive: true });
  const listPath = path.join(VCHAT_GENERATED_LISTS_PATH, `${albumName}.txt`);

  let old = '';
  if (await fileExists(listPath)) {
    old = await fs.readFile(listPath, 'utf8');
  }

  let content = old.replace(/^\uFEFF/, '').trim();
  const items = content ? content.split('|').map(s => s.trim()).filter(Boolean) : [];

  if (!items.includes(finalFileName)) items.push(finalFileName);

  const next = items.join('|');
  await fs.writeFile(listPath, next, 'utf8');
  return listPath;
}

async function updateEmoticonLibrary(albumName, finalFileName) {
  let library = [];
  try {
    if (await fileExists(EMOTICON_LIBRARY_PATH)) {
      const raw = await fs.readFile(EMOTICON_LIBRARY_PATH, 'utf8');
      library = JSON.parse(raw.replace(/^\uFEFF/, ''));
    }
  } catch (e) {
    library = [];
  }

  const encodedAlbum = encodeURIComponent(albumName);
  const encodedFile = encodeURIComponent(finalFileName);
  const newUrl = `http://${EMOTICON_SERVER_HOST}:${EMOTICON_SERVER_PORT}/pw=${EMOTICON_FILE_KEY}/images/${encodedAlbum}/${encodedFile}`;
  const newSearchKey = `${albumName.toLowerCase()}/${finalFileName.toLowerCase()}`;

  const exists = library.some(item => item.filename === finalFileName && item.category === albumName);
  if (exists) return true;

  const newEntry = {
    url: newUrl,
    category: albumName,
    filename: finalFileName,
    searchKey: newSearchKey
  };

  // 找到同category的最后一个条目位置，插入到其后面保持分组
  let insertIndex = -1;
  for (let i = library.length - 1; i >= 0; i--) {
    if (library[i].category === albumName) {
      insertIndex = i + 1;
      break;
    }
  }

  if (insertIndex === -1) {
    // 该category不存在，追加到末尾
    library.push(newEntry);
  } else {
    library.splice(insertIndex, 0, newEntry);
  }

  await fs.writeFile(EMOTICON_LIBRARY_PATH, JSON.stringify(library, null, 2), 'utf8');
  return true;
}

async function writeMetadataDiary({
  maid,
  albumName,
  finalFileName,
  localPath,
  publicUrl,
  title,
  description,
  prompt,
  tags
}) {
  const diaryDir = path.join(DAILYNOTE_ROOT, `${maid}相册索引`);
  await fs.mkdir(diaryDir, { recursive: true });

  const now = new Date();
  const fileStamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}_${String(now.getMinutes()).padStart(2, '0')}_${String(now.getSeconds()).padStart(2, '0')}`;
  const diaryPath = path.join(diaryDir, `${fileStamp}.txt`);

  const body = [
    `[${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}] - 相册入库记录`,
    `文件名: ${finalFileName}`,
    `相册: ${albumName}`,
    `本地路径: ${localPath}`,
    `URL: ${publicUrl}`,
    `标题: ${title || '(未提供)'}`,
    `描述: ${description || '(未提供)'}`,
    `Prompt: ${prompt || '(未提供)'}`,
    `Tag: 相册, 自动入库, ${normalizeTags(tags) || '未打标'}`
  ].join('\n');

  await fs.writeFile(diaryPath, body, 'utf8');
  return diaryPath;
}

function buildPublicUrl(albumName, fileName) {
  const base = process.env.VarHttpUrl || 'http://localhost';
  const port = process.env.SERVER_PORT || '6005';
  const key = process.env.IMAGESERVER_IMAGE_KEY || '147258369plm';
  return `${base}:${port}/pw=${key}/images/${encodeURIComponent(albumName)}/${encodeURIComponent(fileName)}`;
}

async function saveImage(args) {
  const source = args.source || args.image_url || args.url || args.path;
  if (!source) throw new Error("SaveImage缺少必需参数: source");

  const maid = args.maid || DEFAULT_MAID;
  const albumName = sanitizeFileName(args.albumName || DEFAULT_ALBUM_NAME) || DEFAULT_ALBUM_NAME;
  const title = args.title || '';
  const description = args.description || '';
  const prompt = args.prompt || '';
  const tags = args.tags || '';

  const albumDir = path.join(IMAGE_ROOT, albumName);
  await fs.mkdir(albumDir, { recursive: true });

  const rawName = sanitizeFileName(args.fileName || title || `album_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`);
  const rawNameExt = path.extname(rawName || '');
  const baseNameSeed = rawNameExt ? path.basename(rawName, rawNameExt) : rawName;

  let ext = args.ext ? ensureExt(args.ext) : '';
  if (!ext) {
    if (rawNameExt) ext = ensureExt(rawNameExt);
    else if (source.startsWith('http://') || source.startsWith('https://')) ext = extFromUrl(source);
    else ext = ensureExt(path.extname(resolveFileUrl(source)) || '.jpg');
  }

  const desiredPath = path.join(albumDir, `${baseNameSeed}${ext}`);

  let finalPath;
  if (source.startsWith('http://') || source.startsWith('https://')) {
    finalPath = await saveFromHttp(source, desiredPath);
  } else {
    finalPath = await saveFromLocal(source, desiredPath);
  }

  const finalFileName = path.basename(finalPath);

  // 步骤1: 更新 generated_lists txt索引
  const listPath = await updateGeneratedList(albumName, finalFileName);

  // 步骤2: 更新 emoticon_library.json 磁盘缓存
  let libraryUpdated = false;
  try {
    libraryUpdated = await updateEmoticonLibrary(albumName, finalFileName);
  } catch (e) {
    // emoticon_library更新失败不影响主流程
    libraryUpdated = false;
  }

  // 步骤3: 构建公开URL
  const publicUrl = buildPublicUrl(albumName, finalFileName);

  // 步骤4: 写入元数据日记
  const diaryPath = await writeMetadataDiary({
    maid, albumName, finalFileName, localPath: finalPath, publicUrl, title, description, prompt, tags
  });

  return {
    success: true,
    result: {
      albumName,
      fileName: finalFileName,
      localPath: finalPath,
      publicUrl,
      listPath,
      diaryPath,
      libraryUpdated
    },
    messageForAI: `相册入库成功：${finalFileName} 已保存到 ${albumName}，索引、emoticon_library与元数据已更新。${libraryUpdated ? '' : '(注意: emoticon_library.json更新失败，VChat重启后可自愈)'}`
  };
}

async function processRequest(request) {
  const { command, ...args } = request;
  switch (command) {
    case 'SaveImage':
      return await saveImage(args);
    default:
      throw new Error(`未知指令: ${command}`);
  }
}

async function main() {
  let input = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) input += chunk;

  try {
    if (!input) throw new Error('没有从stdin接收到输入');
    const req = JSON.parse(input);
    const result = await processRequest(req);
    console.log(JSON.stringify({
      status: 'success',
      result: result.result,
      messageForAI: result.messageForAI
    }));
  } catch (e) {
    console.log(JSON.stringify({
      status: 'error',
      error: e.message || String(e)
    }));
    process.exit(1);
  }
}

main();