// 微信 ClawBot 编排层：把「消息来源」和「本机大脑」接起来，彻底不经 openclaw。
//  消息来源两条：① 桌面输入框（本地直连，方便不掏手机也能聊、也方便自测）② iLink 长轮询（手机微信）。
//  大脑：本机 claude / codex 无头实例（driver.js），工作目录 = FanBox 当前打开的项目目录。
//  会话按 conversationId 各自续上下文；全部落盘，重启不丢。
const path = require('path');
const os = require('os');
const fs = require('fs');
const ilink = require('./ilink');
const driver = require('./driver');
const memory = require('./memory');

let DATA_DIR = null;
function dataDir() {
  if (DATA_DIR) return DATA_DIR;
  try { DATA_DIR = path.join(require('electron').app.getPath('userData'), 'wechat'); }
  catch { DATA_DIR = path.join(os.homedir(), '.fanbox', 'wechat'); }
  return DATA_DIR;
}
const f = (name) => path.join(dataDir(), name);
const now = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

// 微信场景默认人格：claude/codex 桌面端很啰嗦，手机上刷屏难受——注入这条让回复适配手机。可自定义。
const WX_PERSONA_DEFAULT = '你正通过微信被花叔遥控，回复会显示在手机微信里。请：用中文、简洁直接、适合手机阅读；先给结论，细节按需再展开；除非花叔明确要求，别贴大段代码或长列表；做了改动用一两句话说清改了什么。';

// 发文件协议：让 agent 能把本机文件/图片发到微信。在回复末尾追加标记，系统解析后发送、并从展示里剥掉。
const WX_FILE_PROTOCOL = [
  '如果花叔要你把某个文件或图片发到微信，在回复的最末尾追加发送标记（每个文件一行，可多个）：',
  '<wxfile>文件的绝对路径</wxfile>',
  '路径用绝对路径（相对路径会按当前工作目录解析）。系统会把这些文件发到微信，所以正文里不要重复贴路径、也不要说“无法发送文件”。只有花叔明确要发文件时才加这个标记。',
].join('\n');

// 从回复里抽出 <wxfile> 路径，返回 { clean(剥掉标记的正文), files:[原始路径] }
function extractFiles(reply) {
  const files = [];
  const clean = String(reply || '').replace(/<wxfile>\s*([\s\S]*?)\s*<\/wxfile>/gi, (_, p) => { const s = p.trim(); if (s) files.push(s); return ''; }).trim();
  return { clean, files };
}

const bridge = {
  win: null,
  target: 'claude',                // 当前大脑：claude / codex（默认 claude——已验证无头 JSON 干净可用）
  persona: WX_PERSONA_DEFAULT,     // 微信 bot 人格（手机场景行为指令），可自定义
  cwd: os.homedir(),               // agent 工作目录（前端 navigate 时推过来）
  conversations: {},               // cid -> { id, label, messages:[{role,text,time}], claudeSession }
  activeCid: 'desktop',            // UI 当前展示的会话
  account: null,                   // iLink 账号 { token, baseUrl, accountId, userId }
  pollAbort: null,
  avail: null,                     // { codex, claude } CLI 可用性缓存

  init(win) {
    this.win = win;
    const st = ilink.readJson(f('state.json'), {}) || {};
    this.target = st.target || 'claude';
    this.cwd = st.cwd || os.homedir();
    if (typeof st.persona === 'string' && st.persona.trim()) this.persona = st.persona;
    this.conversations = ilink.readJson(f('conversations.json'), {}) || {};
    this.account = ilink.readJson(f('account.json'), null);
    if (this.account && this.account.token) this.startPolling(); // 已登录则自动恢复收消息
  },
  persistState() { ilink.writeJson(f('state.json'), { target: this.target, cwd: this.cwd, persona: this.persona }); },
  setPersona(p) { this.persona = (typeof p === 'string' && p.trim()) ? p : WX_PERSONA_DEFAULT; this.persistState(); return { ok: true, persona: this.persona }; },
  persistConvos() { ilink.writeJson(f('conversations.json'), this.conversations); },
  emit(ch, m) { if (this.win && !this.win.isDestroyed()) this.win.webContents.send(ch, m); },

  conv(cid) {
    if (!this.conversations[cid]) this.conversations[cid] = { id: cid, label: cid === 'desktop' ? '桌面' : cid, messages: [], claudeSession: '', codexSession: '' };
    return this.conversations[cid];
  },
  push(cid, role, text) {
    const c = this.conv(cid);
    c.messages.push({ role, text, time: now() });
    if (c.messages.length > 400) c.messages = c.messages.slice(-400);
    this.persistConvos();
    if (cid === this.activeCid) this.emit('wechat:message', { cid });
  },

  async targets() {
    if (!this.avail) this.avail = { codex: await driver.which('codex'), claude: await driver.which('claude') };
    return [
      { id: 'codex', label: 'Codex', available: this.avail.codex },
      { id: 'claude', label: 'Claude Code', available: this.avail.claude },
    ];
  },
  async env() {
    return {
      ok: true,
      connected: !!(this.account && this.account.token),
      account: this.account ? this.account.accountId : '',
      target: this.target,
      targets: await this.targets(),
      cwd: this.cwd,
      cwdName: path.basename(this.cwd || '') || '/',
      persona: this.persona,
      personaDefault: WX_PERSONA_DEFAULT,
    };
  },
  setTarget(t) { if (t === 'codex' || t === 'claude') { this.target = t; this.persistState(); } return { ok: true, target: this.target }; },
  setCwd(dir) { if (dir && typeof dir === 'string') { this.cwd = dir; this.persistState(); } return { ok: true }; },
  conversation(cid) { const c = this.conv(cid || this.activeCid); return { ok: true, id: c.id, messages: c.messages }; },

  // 跑一轮大脑：按 target 选 driver，带上该会话的工作目录与（claude 的）续话 session
  async runAgent(cid, text) {
    const c = this.conv(cid);
    // 系统提示 = 人格 + 注入记忆（FanBox 自己的 + 引用花叔全局）+ 记忆写入协议 + 发文件协议
    const sys = [this.persona, memory.inject(), memory.PROTOCOL, WX_FILE_PROTOCOL].filter(Boolean).join('\n\n');
    let raw;
    if (this.target === 'claude') {
      const r = await driver.runClaude(text, this.cwd, c.claudeSession, sys);
      if (r.sessionId) { c.claudeSession = r.sessionId; this.persistConvos(); }
      raw = r.text;
    } else {
      const r = await driver.runCodex(text, this.cwd, sys, c.codexSession);
      if (r.sessionId) { c.codexSession = r.sessionId; this.persistConvos(); }
      raw = r.text;
    }
    // 抽出 <memory> ops 确定性落盘（去污染），把记忆块从展示里剥掉
    const { clean, ops } = memory.extractOps(raw);
    if (ops.length) { try { memory.applyOps(ops); } catch (e) { console.error('[wechat] memory apply', e); } }
    return clean || raw;
  },

  // 桌面输入框 → 本机大脑（不经微信，纯本地）
  async sendDesktop(text) {
    const cid = 'desktop';
    this.activeCid = cid;
    this.push(cid, 'user', text);
    let reply;
    try { reply = await this.runAgent(cid, text); }
    catch (e) { reply = `（出错）${String(e && e.message || e).slice(0, 300)}`; }
    reply = extractFiles(reply).clean || reply; // 桌面无收件人，只剥掉发文件标记，不真发
    this.push(cid, 'assistant', reply);
    return { ok: true, messages: this.conv(cid).messages };
  },

  // ---------- iLink（手机微信）----------
  async login(onErr) {
    try {
      const qr = await ilink.fetchQrcode();
      const content = qr.qrcode_img_content || qr.qrcode || '';
      let dataUrl = '';
      try { dataUrl = await require('qrcode').toDataURL(content, { width: 240, margin: 1 }); } catch { /* 退回原始串 */ }
      this.emit('wechat:qr', { dataUrl, content });
      // 轮询扫码状态
      let base = ilink.LOGIN_BASE, verify = '', tries = 0;
      while (tries++ < 480) {
        const st = await ilink.pollQrStatus(base, qr.qrcode, verify);
        const s = st.status;
        if (s === 'confirmed') {
          this.account = { token: st.bot_token, baseUrl: st.baseurl || base, accountId: st.ilink_bot_id || '', userId: st.ilink_user_id || '' };
          ilink.writeJson(f('account.json'), this.account);
          this.emit('wechat:connected', { ok: true, account: this.account.accountId });
          this.startPolling();
          return { ok: true };
        }
        if (s === 'scaned_but_redirect' && st.redirect_host) { base = `https://${st.redirect_host}`; continue; }
        if (s === 'binded_redirect') { // 已绑过，当作成功（需已有 account）
          if (this.account) { this.emit('wechat:connected', { ok: true, account: this.account.accountId }); this.startPolling(); return { ok: true }; }
        }
        if (s === 'expired') { this.emit('wechat:qr', { expired: true }); return { ok: false, error: '二维码过期，请重试' }; }
      }
      return { ok: false, error: '登录超时' };
    } catch (e) { if (onErr) onErr(e); return { ok: false, error: String(e && e.message || e) }; }
  },
  startPolling() {
    if (this.pollAbort) return; // 已在跑
    const ac = new AbortController();
    this.pollAbort = ac;
    (async () => {
      let buf = (ilink.readJson(f('cursor.json'), {}) || {}).buf || '';
      let fails = 0, timeout = 35000;
      while (!ac.signal.aborted && this.account) {
        try {
          const resp = await ilink.getUpdates(this.account, buf, timeout, ac.signal);
          if (resp.longpolling_timeout_ms > 0) timeout = resp.longpolling_timeout_ms;
          if ((resp.ret && resp.ret !== 0) || (resp.errcode && resp.errcode !== 0)) {
            if (resp.errcode === -14 || resp.ret === -14) { this.emit('wechat:expired', {}); break; } // token 失效
            fails++; await sleep(fails >= 3 ? 30000 : 2000); continue;
          }
          fails = 0;
          if (resp.get_updates_buf) { buf = resp.get_updates_buf; ilink.writeJson(f('cursor.json'), { buf }); } // 先推进游标=去重
          for (const msg of resp.msgs || []) await this.onWechatMsg(msg);
        } catch (e) {
          if (ac.signal.aborted) break;
          fails++; await sleep(fails >= 3 ? 30000 : 2000);
        }
      }
    })();
  },
  async onWechatMsg(msg) {
    if (msg.message_type !== 1) return;           // 只处理用户发来的
    const from = msg.from_user_id;
    const text = ilink.textFromMsg(msg);
    if (!from || !text) return;
    this.activeCid = from;
    this.push(from, 'user', text);
    ilink.sendTyping(this.account, from, true);
    let reply;
    try { reply = await this.runAgent(from, text); }
    catch (e) { reply = `（出错）${String(e && e.message || e).slice(0, 300)}`; }
    const { clean, files } = extractFiles(reply);
    reply = clean || reply;
    ilink.sendTyping(this.account, from, false);
    if (reply) await ilink.sendText(this.account, from, reply, msg.context_token).catch(() => {});
    // 发文件：相对路径按工作目录解析，逐个发；失败/缺失回一句话，不闷掉
    const sent = [];
    for (const raw of files) {
      const fp = path.isAbsolute(raw) ? raw : path.join(this.cwd, raw);
      try {
        if (!fs.existsSync(fp)) { await ilink.sendText(this.account, from, `（找不到文件：${raw}）`, msg.context_token).catch(() => {}); continue; }
        await ilink.sendMedia(this.account, from, fp, msg.context_token);
        sent.push(path.basename(fp));
      } catch (e) { await ilink.sendText(this.account, from, `（发文件失败：${path.basename(fp)} — ${String(e && e.message || e).slice(0, 150)}）`, msg.context_token).catch(() => {}); }
    }
    this.push(from, 'assistant', reply + (sent.length ? `\n📎 已发送：${sent.join('、')}` : ''));
  },
  disconnect() {
    if (this.pollAbort) { try { this.pollAbort.abort(); } catch { /* */ } this.pollAbort = null; }
    this.account = null;
    ilink.writeJson(f('account.json'), null);
    return { ok: true };
  },
};

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

module.exports = bridge;
