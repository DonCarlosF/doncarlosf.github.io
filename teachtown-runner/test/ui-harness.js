'use strict';
/*
 * Shared by the tests that run the real ui-server.js: a temp copy of the
 * project (placeholder config from the template, temp profileDir) with
 * TT_UI_RUNNER pointing at a stub that only writes its argv to a marker
 * file. No real runner, browser, or config.json is touched.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');

function makeTempProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ttui-'));
  for (const f of ['ui-server.js', 'ui.html', 'para.html', 'package.json', 'config.template.json']) {
    fs.copyFileSync(path.join(ROOT, f), path.join(dir, f));
  }
  fs.cpSync(path.join(ROOT, 'lib'), path.join(dir, 'lib'), { recursive: true });
  fs.cpSync(path.join(ROOT, 'config', 'districts'), path.join(dir, 'config', 'districts'), { recursive: true });
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.template.json'), 'utf8'));
  const profileDir = path.join(dir, 'profile-under-test');
  cfg.profileDir = profileDir;
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify(cfg, null, 2));
  const marker = path.join(dir, 'stub-ran.txt');
  const stub = path.join(dir, 'stub-runner.js');
  fs.writeFileSync(stub, `require('fs').writeFileSync(${JSON.stringify(marker)}, process.argv.slice(2).join(' '));\n`);
  return { dir, profileDir, marker, stub };
}

// One request to the server under test, sent as JSON the way the pages send
// it. `headers` adds to or replaces those; the guard tests forge Host,
// Origin, and Content-Type with it. An HTML reply comes back as a string.
function request(port, method, url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        method,
        path: url,
        headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data), ...headers },
      },
      (res) => {
        let out = '';
        res.on('data', (d) => (out += d));
        res.on('end', () => {
          let parsed = null;
          try {
            parsed = out ? JSON.parse(out) : null;
          } catch {
            parsed = out;
          }
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        });
      }
    );
    req.on('error', reject);
    req.end(data);
  });
}

// Starts the temp copy on a random port and resolves with that port once it
// is listening. opts.stderr: an array that collects the server's stderr.
async function startServer(t, dir, stub, opts = {}) {
  const port = 45000 + Math.floor(Math.random() * 2000);
  const env = { ...process.env, TT_UI_PORT: String(port), TT_UI_PORT_STRICT: '1', TT_UI_NO_OPEN: '1', TT_UI_RUNNER: stub };
  const proc = spawn(process.execPath, [path.join(dir, 'ui-server.js')], { cwd: dir, env, stdio: 'pipe' });
  t.after(() => proc.kill());
  if (opts.stderr) proc.stderr.on('data', (d) => opts.stderr.push(String(d)));
  await new Promise((resolve, reject) => {
    let out = '';
    proc.stdout.on('data', (d) => {
      out += d;
      if (/Serving on/.test(out)) resolve();
    });
    proc.on('exit', (c) => reject(new Error(`ui-server exited ${c}: ${out}`)));
  });
  return port;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = { makeTempProject, request, startServer, sleep };
