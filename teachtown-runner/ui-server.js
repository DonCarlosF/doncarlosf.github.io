#!/usr/bin/env node
/*
 * npm run ui — local button interface over the existing runner.
 *
 * Architecture rules (deliberate, keep them):
 *  - Node built-ins only, zero new npm dependencies.
 *  - Binds to 127.0.0.1 ONLY. This page shows student names and its buttons
 *    log into student accounts — on a school LAN, binding wider would serve
 *    that to the whole network. Loopback is a hard requirement with a test.
 *  - Thin layer: every button spawns `node runner.js` with existing flags.
 *    Per-run tweaks (Custom Run, Set-up vs Live) travel in the
 *    TT_UI_OVERRIDES environment variable — never argv (process lists are
 *    world-readable), never a temp file (names live in gitignored
 *    config.json and nowhere else on disk).
 *  - STOP writes "stop" to the child's stdin: the same clean shutdown as
 *    Ctrl+C, portable to Windows where kill('SIGINT') would terminate the
 *    child without running its cleanup.
 *  - The server writes exactly two files, both gitignored: config.json and
 *    config.json.bak. No logs, caches, or session files of its own.
 *
 * Test hooks (used by the mock suite, harmless otherwise):
 *   TT_UI_PORT     fixed port instead of 4317+scan
 *   TT_UI_NO_OPEN  don't launch a browser
 *   TT_UI_RUNNER   spawn this script instead of runner.js (test harness)
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn, execSync, execFileSync } = require('child_process');

const DIR = __dirname;
const CONFIG = path.join(DIR, 'config.json');
const CONFIG_BAK = path.join(DIR, 'config.json.bak');
const TEMPLATE = path.join(DIR, 'config.template.json');
const DISTRICTS_DIR = path.join(DIR, 'config', 'districts');
const RUNNER = process.env.TT_UI_RUNNER || path.join(DIR, 'runner.js');
const HOST = '127.0.0.1'; // loopback ONLY — see header
const BASE_PORT = Number(process.env.TT_UI_PORT) || 4317;
const PORT_IS_FIXED = !!process.env.TT_UI_PORT_STRICT; // default: busy port → try the next one

/* ------------------------------ version ----------------------------- */

function buildVersion() {
  // No git on ZIP-installed Windows machines, so the primary identity is a
  // content hash: same code → same hash on every machine. Git SHA is
  // appended where a .git dir exists (nice to have, never required).
  const h = crypto.createHash('sha256');
  for (const f of ['runner.js', 'ui-server.js', 'ui.html', 'privacy-check.js', 'init-config.js']) {
    try {
      h.update(fs.readFileSync(path.join(DIR, f)));
    } catch {}
  }
  let pkgVersion = '0';
  try {
    pkgVersion = JSON.parse(fs.readFileSync(path.join(DIR, 'package.json'), 'utf8')).version;
  } catch {}
  let git = '';
  try {
    git = execSync('git rev-parse --short HEAD', { cwd: DIR, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {}
  return `v${pkgVersion} · code ${h.digest('hex').slice(0, 8)}${git ? ` · git ${git}` : ''}`;
}
const VERSION = buildVersion();

/* ---------------------------- child runner --------------------------- */

const child = {
  proc: null,
  action: null,
  startedAt: 0,
  exitCode: null,
  lines: [], // ring buffer replayed to (re)connecting pages
};
const sseClients = new Set();

function broadcast(obj) {
  const data = `data: ${JSON.stringify(obj)}\n\n`;
  for (const res of sseClients) res.write(data);
}

function pushLine(text) {
  child.lines.push(text);
  if (child.lines.length > 500) child.lines.shift();
  broadcast({ type: 'line', text });
}

function statusPayload() {
  return {
    type: 'status',
    running: !!child.proc,
    action: child.action,
    startedAt: child.startedAt,
    exitCode: child.exitCode,
  };
}

// Server-side mapping from button → flags + overrides. The client never
// supplies argv; it names an action and the whitelist here decides.
function buildRun(body) {
  const dry = body.dry === true;
  const flags = dry ? ['--dry-run'] : [];
  switch (body.action) {
    case 'playlist':
      return { args: flags, overrides: null };
    case 'custom': {
      const students = Array.isArray(body.students)
        ? body.students.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim())
        : [];
      if (!students.length) return { error: 'Custom Run needs at least one student selected.' };
      if (body.mode !== 'movie' && body.mode !== 'activity') return { error: 'Custom Run mode must be movie or activity.' };
      const target = typeof body.target === 'string' && body.target.trim() ? body.target.trim() : null;
      return {
        args: flags,
        overrides: { students, playlist: [], mode: body.mode, targetActivity: target },
      };
    }
    case 'teacherled-setup':
      return { args: ['--teacher-led', ...flags], overrides: { teacherLed: { autoBegin: false } } };
    case 'teacherled-live':
      // The ONLY path that clicks Begin Session (a real recorded session).
      return { args: ['--teacher-led', ...flags], overrides: { teacherLed: { autoBegin: true } } };
    case 'login':
      return { args: ['--login'] };
    case 'recon-roster':
      return { args: ['--recon-roster'] };
    case 'studentled-setup':
    case 'studentled-live':
      return { error: 'Student-Led automation is not built yet — the CLI stub only prints recon notes.' };
    default:
      return { error: `unknown action "${body.action}"` };
  }
}

function startRun(body) {
  if (child.proc) return { status: 409, error: 'A run is already in progress — STOP it first.' };
  const plan = buildRun(body);
  if (plan.error) return { status: 400, error: plan.error };

  const env = { ...process.env, TT_UI: '1' };
  if (plan.overrides) env.TT_UI_OVERRIDES = JSON.stringify(plan.overrides);
  else delete env.TT_UI_OVERRIDES;

  const proc = spawn(process.execPath, [RUNNER, ...plan.args], {
    cwd: DIR,
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  child.proc = proc;
  child.action = body.action + (body.dry ? ' (dry run)' : '');
  child.startedAt = Date.now();
  child.exitCode = null;
  child.lines = [];
  pushLine(`[ui] started: ${child.action}`);
  broadcast(statusPayload());

  let buf = { out: '', err: '' };
  const onData = (which) => (d) => {
    buf[which] += String(d);
    let i;
    while ((i = buf[which].indexOf('\n')) >= 0) {
      const line = buf[which].slice(0, i).replace(/\r$/, '');
      buf[which] = buf[which].slice(i + 1);
      if (line.trim()) pushLine(line);
    }
  };
  proc.stdout.on('data', onData('out'));
  proc.stderr.on('data', onData('err'));
  proc.on('exit', (code, signal) => {
    child.exitCode = code == null ? `signal ${signal}` : code;
    child.proc = null;
    clearTimeout(child.killTimer);
    pushLine(`[ui] runner exited (${child.exitCode})`);
    broadcast(statusPayload());
  });
  return { status: 200 };
}

function stopRun() {
  if (!child.proc) return { status: 200, note: 'nothing running' };
  pushLine('[ui] STOP — asking the runner to clean up (popup → logout → browser)…');
  try {
    child.proc.stdin.write('stop\n');
  } catch {}
  // Last resort only: if the cooperative stop hangs, hard-kill after 20s.
  clearTimeout(child.killTimer);
  child.killTimer = setTimeout(() => {
    if (child.proc) {
      pushLine('[ui] runner did not exit in 20s — force-killing (browser may need closing by hand).');
      try {
        child.proc.kill('SIGKILL');
      } catch {}
    }
  }, 20_000);
  child.killTimer.unref?.();
  return { status: 200 };
}

/* ------------------------------ config ------------------------------- */

// Enough validation to guarantee the runner's loadConfig will accept the
// file — never write something the next launch chokes on.
function validateConfig(cfg) {
  const errs = [];
  if (typeof cfg !== 'object' || cfg === null || Array.isArray(cfg)) return ['config must be a JSON object'];
  if (!Array.isArray(cfg.students) || cfg.students.some((s) => typeof s !== 'string' || !s.trim())) {
    errs.push('"students" must be an array of non-empty names (it may be empty only if you never run a rotation)');
  }
  if (!Array.isArray(cfg.roster)) errs.push('"roster" must be an array');
  else
    cfg.roster.forEach((r, i) => {
      if (typeof r === 'string') return;
      if (typeof r !== 'object' || r === null || typeof r.name !== 'string' || !r.name.trim())
        errs.push(`roster[${i}] needs a non-empty "name"`);
    });
  if (typeof cfg.district !== 'string' || !cfg.district.trim()) errs.push('"district" must be set');
  else if (!fs.existsSync(path.join(DISTRICTS_DIR, `${cfg.district}.json`))) errs.push(`unknown district "${cfg.district}"`);
  if (cfg.mode !== 'activity' && cfg.mode !== 'movie') errs.push('"mode" must be "activity" or "movie"');
  if (!['stop', 'repeat', 'teacherLed'].includes(cfg.afterRotation)) errs.push('"afterRotation" must be stop, repeat, or teacherLed');
  if (typeof cfg.autoSubmitPrefilledLogin !== 'boolean') errs.push('"autoSubmitPrefilledLogin" must be true or false');
  if (!Array.isArray(cfg.playlist)) errs.push('"playlist" must be an array');
  else
    cfg.playlist.forEach((e, i) => {
      if (typeof e !== 'object' || e === null) return errs.push(`playlist[${i}] must be an object`);
      if (e.mode !== 'movie' && e.mode !== 'activity') errs.push(`playlist[${i}].mode must be "movie" or "activity"`);
      const hasTarget = typeof e.target === 'string' && e.target.trim();
      const hasCount = Number.isInteger(e.count) && e.count > 0;
      if (hasTarget && hasCount) errs.push(`playlist[${i}]: use "target" OR "count", not both`);
      if (e.count != null && !hasCount) errs.push(`playlist[${i}].count must be a positive whole number`);
    });
  const tl = cfg.teacherLed;
  if (typeof tl !== 'object' || tl === null) errs.push('"teacherLed" must be an object');
  else {
    if (typeof tl.sessionLengthMin !== 'number' || tl.sessionLengthMin <= 0) errs.push('teacherLed.sessionLengthMin must be a positive number');
    if (typeof tl.autoBegin !== 'boolean') errs.push('teacherLed.autoBegin must be true or false');
  }
  return errs;
}

function readConfigForUi() {
  if (fs.existsSync(CONFIG)) {
    return { missing: false, config: JSON.parse(fs.readFileSync(CONFIG, 'utf8')) };
  }
  const tpl = JSON.parse(fs.readFileSync(TEMPLATE, 'utf8'));
  return { missing: true, config: tpl };
}

function writeConfigFromUi(cfg) {
  const errs = validateConfig(cfg);
  if (errs.length) return { status: 400, errors: errs };
  const json = JSON.stringify(cfg, null, 2) + '\n';
  JSON.parse(json); // belt and braces: never write unparseable output
  if (fs.existsSync(CONFIG)) fs.copyFileSync(CONFIG, CONFIG_BAK); // .bak is gitignored like config.json
  fs.writeFileSync(CONFIG, json);
  return { status: 200 };
}

/* ------------------------------ server ------------------------------- */

function json(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(body) });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (d) => {
      data += d;
      if (data.length > 1_000_000) reject(new Error('body too large'));
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = req.url.split('?')[0];
    if (req.method === 'GET' && (url === '/' || url === '/index.html')) {
      const html = fs.readFileSync(path.join(DIR, 'ui.html'));
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(html);
    }
    if (req.method === 'GET' && url === '/api/version') return json(res, 200, { version: VERSION });
    if (req.method === 'GET' && url === '/api/status') return json(res, 200, statusPayload());
    if (req.method === 'GET' && url === '/api/config') {
      try {
        return json(res, 200, readConfigForUi());
      } catch (err) {
        return json(res, 500, { error: `config.json is unreadable: ${err.message}` });
      }
    }
    if (req.method === 'GET' && url === '/api/districts') {
      const list = fs.existsSync(DISTRICTS_DIR)
        ? fs.readdirSync(DISTRICTS_DIR).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''))
        : [];
      return json(res, 200, { districts: list });
    }
    if (req.method === 'GET' && url === '/api/stream') {
      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      });
      res.write(`data: ${JSON.stringify(statusPayload())}\n\n`);
      for (const text of child.lines) res.write(`data: ${JSON.stringify({ type: 'line', text })}\n\n`);
      sseClients.add(res);
      req.on('close', () => sseClients.delete(res));
      return;
    }
    if (req.method === 'POST' && url === '/api/run') {
      const body = JSON.parse((await readBody(req)) || '{}');
      const r = startRun(body);
      return json(res, r.status, r.status === 200 ? statusPayload() : { error: r.error });
    }
    if (req.method === 'POST' && url === '/api/stop') {
      const r = stopRun();
      return json(res, 200, { ok: true, note: r.note || null });
    }
    if (req.method === 'POST' && url === '/api/config') {
      let cfg;
      try {
        cfg = JSON.parse(await readBody(req));
      } catch (err) {
        return json(res, 400, { errors: [`not valid JSON: ${err.message}`] });
      }
      const r = writeConfigFromUi(cfg);
      return json(res, r.status, r.status === 200 ? { ok: true } : { errors: r.errors });
    }
    json(res, 404, { error: 'not found' });
  } catch (err) {
    json(res, 500, { error: err.message });
  }
});

function openBrowser(url) {
  if (process.env.TT_UI_NO_OPEN) return;
  try {
    if (process.platform === 'darwin') execFileSync('open', [url], { stdio: 'ignore' });
    else if (process.platform === 'win32') execSync(`start "" "${url}"`, { stdio: 'ignore' }); // start is a cmd built-in
    else console.log('(open the URL above in your browser)');
  } catch {
    console.log('(could not auto-open a browser — use the URL above)');
  }
}

// The URL is printed from the socket's REAL bound address, never from the
// attempted port — a retry after EADDRINUSE must not announce the old port.
server.on('listening', () => {
  server.removeAllListeners('error');
  server.on('error', (err) => console.error(`ui-server error: ${err.message}`));
  const url = `http://${HOST}:${server.address().port}/`;
  console.log('');
  console.log(`TeachTown runner UI — ${VERSION}`);
  console.log(`Serving on ${url} (this machine only — never the network)`);
  console.log('Leave this window open; Ctrl+C here shuts the UI down.');
  console.log('');
  openBrowser(url);
});

function listen(port) {
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE' && !PORT_IS_FIXED && port < BASE_PORT + 20) {
      console.log(`port ${port} is busy — trying ${port + 1}`);
      listen(port + 1);
    } else {
      console.error(`could not start the UI server: ${err.message}`);
      process.exit(1);
    }
  });
  server.listen(port, HOST);
}

process.on('SIGINT', () => {
  if (child.proc) {
    try {
      child.proc.stdin.write('stop\n');
    } catch {}
  }
  setTimeout(() => process.exit(0), child.proc ? 3000 : 0);
});

listen(BASE_PORT);
