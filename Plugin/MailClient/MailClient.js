#!/usr/bin/env node
'use strict';

const { ImapFlow } = require('imapflow');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');

// ==================== 配置加载 ====================

function loadConfig() {
    const envPath = path.join(__dirname, 'config.env');
    const config = {};
    if (fs.existsSync(envPath)) {
        const lines = fs.readFileSync(envPath, 'utf8').split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const eqIdx = trimmed.indexOf('=');
            if (eqIdx === -1) continue;
            const key = trimmed.substring(0, eqIdx).trim();
            const val = trimmed.substring(eqIdx + 1).trim().replace(/\r/g, '');
            config[key] = val;
        }
    }
    return {
        imap: {
            host: config.IMAP_HOST || 'imap.163.com',
            port: parseInt(config.IMAP_PORT) || 993,
            secure: true,
            auth: {
                user: config.EMAIL_ADDRESS || '',
                pass: config.EMAIL_AUTH_CODE || ''
            },
            logger: false
        },
        smtp: {
            host: config.SMTP_HOST || 'smtp.163.com',
            port: parseInt(config.SMTP_PORT) || 465,
            secure: true,
            auth: {
                user: config.EMAIL_ADDRESS || '',
                pass: config.EMAIL_AUTH_CODE || ''
            }
        },
        address: config.EMAIL_ADDRESS || '',
        senderName: config.EMAIL_SENDER_NAME || 'Rosa'
    };
}

// ==================== IMAP 操作 ====================

async function createImapClient() {
    const config = loadConfig();
    if (!config.imap.auth.user || !config.imap.auth.pass) {
        throw new Error('邮箱地址或授权码未配置，请编辑 config.env');
    }
    const client = new ImapFlow(config.imap);
    await client.connect();
    return client;
}

async function listFolders() {
    const client = await createImapClient();
    try {
        const folders = await client.list();
        const result = folders.map(f => ({
            name: f.name,
            path: f.path,
            specialUse: f.specialUse || null,
            messages: f.status ? f.status.messages : null
        }));
        return { success: true, folders: result };
    } finally {
        await client.logout();
    }
}

async function listMails(folder = 'INBOX', limit = 20, page = 1) {
    const client = await createImapClient();
    try {
        const lock = await client.getMailboxLock(folder);
        try {
            const mailbox = client.mailbox;
            const total = mailbox.exists || 0;
            if (total === 0) {
                return { success: true, total: 0, page, limit, mails: [] };
            }

            // 计算分页范围（从最新到最旧）
            const startIdx = Math.max(1, total - (page * limit) + 1);
            const endIdx = Math.max(1, total - ((page - 1) * limit));
            const range = `${startIdx}:${endIdx}`;

            const mails = [];
            for await (const msg of client.fetch(range, {
                uid: true,
                envelope: true,
                flags: true,
                bodyStructure: true,
                size: true
            })) {
                const env = msg.envelope || {};
                mails.push({
                    uid: msg.uid,
                    seq: msg.seq,
                    date: env.date ? env.date.toISOString() : null,
                    subject: env.subject || '(无主题)',
                    from: env.from ? env.from.map(a => `${a.name || ''} <${a.address}>`).join(', ') : '(未知)',
                    to: env.to ? env.to.map(a => `${a.name || ''} <${a.address}>`).join(', ') : '',
                    flags: Array.from(msg.flags || []),
                    size: msg.size || 0
                });
            }

            // 按日期倒序（最新在前）
            mails.sort((a, b) => new Date(b.date) - new Date(a.date));

            return {
                success: true,
                total,
                page,
                limit,
                mails
            };
        } finally {
            lock.release();
        }
    } finally {
        await client.logout();
    }
}

async function readMail(uid, folder = 'INBOX') {
    const client = await createImapClient();
    try {
        const lock = await client.getMailboxLock(folder);
        try {
            const msg = await client.fetchOne(uid, {
                uid: true,
                envelope: true,
                source: true,
                flags: true
            }, { uid: true });

            if (!msg) {
                return { success: false, error: `未找到UID为 ${uid} 的邮件` };
            }

            // 解析邮件内容
            const { simpleParser } = require('mailparser');
            const parsed = await simpleParser(msg.source);

            // 标记为已读
            await client.messageFlagsAdd({ uid: parseInt(uid) }, ['\\Seen'], { uid: true });

            return {
                success: true,
                mail: {
                    uid: msg.uid,
                    subject: parsed.subject || '(无主题)',
                    from: parsed.from ? parsed.from.text : '(未知)',
                    to: parsed.to ? parsed.to.text : '',
                    cc: parsed.cc ? parsed.cc.text : '',
                    date: parsed.date ? parsed.date.toISOString() : null,
                    text: parsed.text || '',
                    html: parsed.html || '',
                    attachments: (parsed.attachments || []).map(a => ({
                        filename: a.filename,
                        contentType: a.contentType,
                        size: a.size
                    }))
                }
            };
        } finally {
            lock.release();
        }
    } finally {
        await client.logout();
    }
}

async function searchMails(query, folder = 'INBOX', searchIn = 'all', limit = 20) {
    const client = await createImapClient();
    try {
        const lock = await client.getMailboxLock(folder);
        try {
            // 构建搜索条件
            let searchCriteria;
            switch (searchIn) {
                case 'subject':
                    searchCriteria = { subject: query };
                    break;
                case 'from':
                    searchCriteria = { from: query };
                    break;
                case 'to':
                    searchCriteria = { to: query };
                    break;
                case 'body':
                    searchCriteria = { body: query };
                    break;
                case 'all':
                default:
                    searchCriteria = { or: [
                        { subject: query },
                        { from: query },
                        { to: query },
                        { body: query }
                    ]};
                    break;
            }

            const results = await client.search(searchCriteria, { uid: true });

            if (!results || results.length === 0) {
                return { success: true, total: 0, mails: [] };
            }

            // 取最新的limit条
            const uidList = results.slice(-limit);
            const mails = [];

            for await (const msg of client.fetch(
                { uid: uidList.join(',') },
                { uid: true, envelope: true, flags: true, size: true },
                { uid: true }
            )) {
                const env = msg.envelope || {};
                mails.push({
                    uid: msg.uid,
                    date: env.date ? env.date.toISOString() : null,
                    subject: env.subject || '(无主题)',
                    from: env.from ? env.from.map(a => `${a.name || ''} <${a.address}>`).join(', ') : '(未知)',
                    flags: Array.from(msg.flags || [])
                });
            }

            mails.sort((a, b) => new Date(b.date) - new Date(a.date));

            return { success: true, total: results.length, showing: mails.length, mails };
        } finally {
            lock.release();
        }
    } finally {
        await client.logout();
    }
}

async function deleteMail(uid, folder = 'INBOX') {
    const client = await createImapClient();
    try {
        const lock = await client.getMailboxLock(folder);
        try {
            await client.messageFlagsAdd({ uid: parseInt(uid) }, ['\\Deleted'], { uid: true });
            await client.expunge({ uid: parseInt(uid) });
            return { success: true, message: `邮件 UID:${uid} 已删除` };
        } finally {
            lock.release();
        }
    } finally {
        await client.logout();
    }
}

// ==================== SMTP 操作 ====================

async function sendMail(to, subject, body, options = {}) {
    const config = loadConfig();
    if (!config.smtp.auth.user || !config.smtp.auth.pass) {
        throw new Error('邮箱地址或授权码未配置，请编辑 config.env');
    }

    const transporter = nodemailer.createTransport(config.smtp);

    const mailOptions = {
        from: `"${config.senderName}" <${config.address}>`,
        to: to,
        subject: subject
    };

    if (options.cc) mailOptions.cc = options.cc;
    if (options.bcc) mailOptions.bcc = options.bcc;

    // 处理附件和CID内嵌图片
    if (options.attachments) {
        const attachList = typeof options.attachments === 'string' 
            ? options.attachments.split(',').map(s => s.trim())
            : (Array.isArray(options.attachments) ? options.attachments : []);
        
        mailOptions.attachments = [];
        let cidIndex = 0;
        
        for (const filePath of attachList) {
            if (!filePath) continue;
            const absPath = path.resolve(filePath);
            if (!fs.existsSync(absPath)) {
                throw new Error(`附件文件不存在: ${absPath}`);
            }
            const filename = path.basename(absPath);
            const ext = path.extname(filename).toLowerCase();
            const isImage = ['.png','.jpg','.jpeg','.gif','.webp','.bmp'].includes(ext);
            
            if (isImage && (options.isHtml === true || options.isHtml === 'true')) {
                // 图片在HTML邮件中使用CID内嵌
                const cid = `img${cidIndex}@rosahpy`;
                cidIndex++;
                mailOptions.attachments.push({
                    filename: filename,
                    path: absPath,
                    cid: cid
                });
                // 自动替换body中的占位符 {{cid:N}} 或追加到末尾
                const placeholder = `{{cid:${cidIndex - 1}}}`;
                if (body.includes(placeholder)) {
                    body = body.replace(placeholder, `cid:${cid}`);
                }
            } else {
                // 普通附件
                mailOptions.attachments.push({
                    filename: filename,
                    path: absPath
                });
            }
        }
    }

    if (options.isHtml === true || options.isHtml === 'true') {
        mailOptions.html = body;
    } else {
        mailOptions.text = body;
    }

    const info = await transporter.sendMail(mailOptions);

    return {
        success: true,
        messageId: info.messageId,
        accepted: info.accepted,
        rejected: info.rejected,
        message: `邮件已发送至 ${to}`,
        attachmentCount: (mailOptions.attachments || []).length
    };
}

// ==================== 命令路由 ====================

async function processCommand(params) {
    const command = params.command || params.commandIdentifier;

    switch (command) {
        case 'ListFolders':
            return await listFolders();

        case 'ListMails':
            return await listMails(
                params.folder || 'INBOX',
                parseInt(params.limit) || 20,
                parseInt(params.page) || 1
            );

        case 'ReadMail':
            if (!params.uid) throw new Error('缺少必要参数: uid');
            return await readMail(params.uid, params.folder || 'INBOX');

        case 'SendMail':
            if (!params.to) throw new Error('缺少必要参数: to');
            if (!params.subject) throw new Error('缺少必要参数: subject');
            if (!params.body) throw new Error('缺少必要参数: body');
            return await sendMail(params.to, params.subject, params.body, {
                cc: params.cc,
                bcc: params.bcc,
                isHtml: params.isHtml,
                attachments: params.attachments
            });

        case 'SearchMails':
            if (!params.query) throw new Error('缺少必要参数: query');
            return await searchMails(
                params.query,
                params.folder || 'INBOX',
                params.searchIn || 'all',
                parseInt(params.limit) || 20
            );

        case 'DeleteMail':
            if (!params.uid) throw new Error('缺少必要参数: uid');
            return await deleteMail(params.uid, params.folder || 'INBOX');

        default:
            throw new Error(`未知命令: ${command}`);
    }
}

// ==================== stdio 入口 ====================

(async () => {
    let inputData = '';
    process.stdin.setEncoding('utf8');

    for await (const chunk of process.stdin) {
        inputData += chunk;
    }

    try {
        const params = JSON.parse(inputData.trim());
        const result = await processCommand(params);
        console.log(JSON.stringify({ status: "success", result: result }));
    } catch (err) {
        console.log(JSON.stringify({ status: "error", error: err.message || String(err) }));
        process.exit(1);
    }
})();