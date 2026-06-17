// 本机 CLI 驱动器：用 claude / codex 的无头模式起一个实例和它对话，作为微信消息的「大脑」。
// 用户文本一律走 stdin（不进命令行，零转义/长度风险）；claude 用 session_id 续上下文。
// 复用本机已登录的 claude/codex 凭据，原生读 cwd 下的 CLAUDE.md / AGENTS.md。
const { spawn } = require('child_process');

const loginShell = () => process.env.SHELL || (process.platform === 'win32' ? 'powershell.exe' : '/bin/zsh');
function shellEnv() {
  const env = { ...process.env };
  if (!/UTF-8/i.test(env.LC_ALL || env.LC_CTYPE || env.LANG || '')) env.LANG = 'en_US.UTF-8';
  return env;
}

// 跑一条命令（login shell 带全 PATH，GUI 启动只继承精简 PATH），prompt 写 stdin
function run(cmd, stdinText, cwd, timeoutMs = 180000) {
  return new Promise((resolve) => {
    const child = spawn(loginShell(), ['-lc', cmd], { cwd: cwd || process.env.HOME, env: shellEnv() });
    let out = '', err = '', done = false;
    const finish = (r) => { if (done) return; done = true; resolve(r); };
    const timer = setTimeout(() => { try { child.kill('SIGKILL'); } catch { /* */ } finish({ ok: false, out, err: err + '\n[超时]' }); }, timeoutMs);
    child.stdout.on('data', (d) => { out += d.toString('utf8'); });
    child.stderr.on('data', (d) => { err += d.toString('utf8'); });
    child.on('error', (e) => { clearTimeout(timer); finish({ ok: false, out, err: String(e && e.message || e) }); });
    child.on('close', (code) => { clearTimeout(timer); finish({ ok: code === 0, code, out, err }); });
    try { child.stdin.write(stdinText || ''); child.stdin.end(); } catch { /* */ }
  });
}

// 检测本机有没有这个 CLI
function which(bin) {
  return run(`command -v ${bin} || true`, '', null, 8000).then((r) => !!(r.out || '').trim());
}

// claude 无头：续话靠「首轮自带 --session-id <我们生成的 uuid>，之后 --resume 同一 uuid」。
//  关键：不能让 claude 自动生成 session——print 模式自动建的会话 resume 不到（实测会报 No conversation found）。
async function runClaude(text, cwd, sessionId, persona) {
  const sid = sessionId || require('crypto').randomUUID();
  const flag = sessionId ? `--resume ${sid}` : `--session-id ${sid}`;
  const sys = persona ? `--append-system-prompt ${shq(persona)}` : '';
  const cmd = `claude -p --output-format json --dangerously-skip-permissions ${sys} ${flag}`;
  const r = await run(cmd, text, cwd);
  let result = '', outSid = sid;
  try {
    const j = JSON.parse((r.out || '').trim());
    result = j.result || j.text || '';
    outSid = j.session_id || sid;
  } catch {
    result = (r.out || '').trim(); // 非 JSON 兜底
  }
  // resume 的会话失效（旧 id / 过期）→ 自动起新会话重试一次，别把报错甩给用户
  if (sessionId && /No conversation found|session.*not found/i.test(result + ' ' + (r.err || ''))) {
    return runClaude(text, cwd, null);
  }
  if (!result && !r.ok) result = `（claude 出错）${(r.err || '').trim().slice(-300)}`;
  return { text: result || '（没有返回内容）', sessionId: outSid };
}

// codex 无头：首轮 `codex exec` 建会话并从 thread.started 抓 thread_id；之后 `codex exec resume <id> -` 续上下文（codex 0.139+）。
async function runCodex(text, cwd, persona, sessionId) {
  const flags = '--json --skip-git-repo-check --dangerously-bypass-approvals-and-sandbox';
  // 续话：prompt 走 stdin（结尾 `-`）；会话已含人格/记忆，不再前置。首轮：把人格+记忆前置到消息里（codex 无独立 system-prompt 入口）。
  const cmd = sessionId ? `codex exec resume ${sessionId} ${flags} -` : `codex exec ${flags}`;
  const stdin = sessionId ? text : (persona ? `${persona}\n\n---\n${text}` : text);
  const r = await run(cmd, stdin, cwd);
  // --json 输出 JSONL 事件：抓 thread_id + 最终 assistant 文本（后到的覆盖前面）
  let result = '', outSid = sessionId || '';
  for (const line of (r.out || '').split('\n')) {
    const t = line.trim(); if (!t || t[0] !== '{') continue;
    let o; try { o = JSON.parse(t); } catch { continue; }
    if (o.type === 'thread.started' && o.thread_id) outSid = o.thread_id;
    const item = o.item || o.msg || o;
    const ty = item.type || o.type || '';
    if (/agent_message|assistant|message\.completed|item\.completed/i.test(ty)) {
      const txt = item.text || item.message || (item.content && item.content.text) || '';
      if (txt && typeof txt === 'string') result = txt;
    }
  }
  // resume 的会话失效（旧 id / 落盘被清）→ 自动起新会话重试一次，别把报错甩给用户
  if (sessionId && !result && /No .*session|not found|no conversation|无.*会话/i.test(r.err || r.out || '')) {
    return runCodex(text, cwd, persona, null);
  }
  if (!result) { // 没解出 JSON → 取纯文本最后一段，剥掉 header 前言与 prompt 回显
    const parts = stripAnsi(r.out || '').split(/-{6,}/);
    result = (parts[parts.length - 1] || '').replace(/^\s*user[\s\S]*?\n/i, '').trim();
  }
  if (!result && !r.ok) result = `（codex 出错）${stripAnsi(r.err || r.out || '').trim().slice(-300)}`;
  return { text: result || '（没有返回内容）', sessionId: outSid };
}

function stripAnsi(s) { return s.replace(/\[[0-9;]*m/g, ''); }

// shell 单引号安全包裹（人格可能含引号/换行/中文）
function shq(s) { return `'${String(s).replace(/'/g, "'\\''")}'`; }

module.exports = { runClaude, runCodex, which };
