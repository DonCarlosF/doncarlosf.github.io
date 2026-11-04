'use strict';
/*
 * lib/http-guard.js: the local UI server answers only its own pages and the
 * programs on this computer. First the rules on their own, then a temp copy
 * of the real server (test/ui-harness.js: stub runner, placeholder config)
 * getting what a website open in the same browser could send it.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { checkRequest, describeRefusal } = require('../lib/http-guard');
const { makeTempProject, request, startServer, sleep } = require('./ui-harness');

const PORT = 4317;
const OWN = { host: '127.0.0.1:4317', origin: 'http://127.0.0.1:4317', 'content-type': 'application/json' };
const check = (method, headers) => checkRequest({ method, url: '/api/run', headers }, PORT);

/* ------------------------------- rules -------------------------------- */

test('Host must be 127.0.0.1 or localhost on this port, on every request', () => {
  for (const host of ['127.0.0.1:4317', 'localhost:4317', 'LocalHost:4317']) {
    assert.equal(check('GET', { host }), null, host);
  }
  // DNS rebinding sends the other site's own name; the rest are near misses.
  for (const host of ['evil.example:4317', 'evil.example', '127.0.0.1', '127.0.0.1:4318', '127.0.0.1:4317.evil.example', '10.0.0.5:4317', '']) {
    const r = check('GET', { host });
    assert.equal(r && r.status, 403, `Host "${host}"`);
    assert.equal(r.check, 'host');
  }
  assert.equal(check('GET', {}).check, 'host', 'no Host at all');
});

test('a request from another website is refused: foreign, other-port, https, or null Origin', () => {
  for (const origin of ['https://evil.example', 'http://evil.example:4317', 'http://127.0.0.1:4318', 'https://127.0.0.1:4317', 'null', '']) {
    for (const method of ['POST', 'GET']) {
      const r = check(method, { ...OWN, origin });
      assert.equal(r && r.status, 403, `${method} with Origin "${origin}"`);
      assert.equal(r.check, 'origin');
    }
  }
});

test("the server's own pages, and programs with no Origin, get through", () => {
  assert.equal(check('POST', OWN), null);
  assert.equal(
    check('POST', { host: 'localhost:4317', origin: 'http://localhost:4317', 'content-type': 'application/json; charset=utf-8' }),
    null
  );
  assert.equal(check('POST', { host: '127.0.0.1:4317', 'content-type': 'application/json' }), null, 'Node or curl: no Origin');
  assert.equal(check('GET', { host: '127.0.0.1:4317' }), null, 'a page load or EventSource: no Origin, no type');
});

test('a POST must be JSON: the kinds a site can send without asking the browser are refused', () => {
  for (const type of ['text/plain;charset=UTF-8', 'application/x-www-form-urlencoded', 'multipart/form-data; boundary=x', '']) {
    const r = check('POST', { ...OWN, 'content-type': type });
    assert.equal(r && r.status, 415, `Content-Type "${type}"`);
    assert.equal(r.check, 'content-type');
  }
  const noType = { host: OWN.host, origin: OWN.origin };
  assert.equal(check('POST', noType).status, 415, 'no Content-Type at all');
});

test('the console line names the route and the reason, in printable ASCII only', () => {
  const req = { method: 'POST', url: '/api/run?x=1', headers: { ...OWN, origin: 'https://evil.example\u001b[2J' } };
  assert.equal(describeRefusal(req, checkRequest(req, PORT)), 'ui-server: refused POST /api/run (origin: https://evil.example?[2j)');
});

test('every POST the pages make says it is JSON', () => {
  for (const file of ['ui.html', 'para.html']) {
    const src = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    assert.match(src, /const JSON_HEADERS = \{ 'content-type': 'application\/json' \};/, file);
    const posts = (src.match(/method:\s*['"]POST['"]/gi) || []).length;
    const withJson = (src.match(/method:\s*['"]POST['"],\s*headers:\s*JSON_HEADERS\b/gi) || []).length;
    assert.ok(posts > 0, `${file}: found its POSTs`);
    assert.equal(withJson, posts, `${file}: every POST passes headers: JSON_HEADERS`);
  }
});

/* ---------------------------- real server ----------------------------- */

test('the real server: a forged request starts nothing, saves nothing, and reads nothing', async (t) => {
  const { dir, marker, stub } = makeTempProject();
  const stderr = [];
  const port = await startServer(t, dir, stub, { stderr });
  const configPath = path.join(dir, 'config.json');
  const before = fs.readFileSync(configPath, 'utf8');
  const math = { action: 'studentled-subject', subject: 'math' };

  // A fetch or form from another site: the browser adds that site's Origin.
  const fromSite = await request(port, 'POST', '/api/run', math, { origin: 'https://evil.example' });
  assert.equal(fromSite.status, 403);
  // The kind that needs no browser permission: text/plain, which the pages
  // themselves used to send.
  const plain = await request(port, 'POST', '/api/config', JSON.parse(before), { 'content-type': 'text/plain;charset=UTF-8' });
  assert.equal(plain.status, 415);
  const stop = await request(port, 'POST', '/api/stop', undefined, { origin: 'null' });
  assert.equal(stop.status, 403);
  // DNS rebinding: another site's name pointed at 127.0.0.1.
  for (const url of ['/', '/para', '/api/config', '/api/para', '/api/status', '/api/stream']) {
    const r = await request(port, 'GET', url, undefined, { host: `evil.example:${port}` });
    assert.equal(r.status, 403, url);
    assert.deepEqual(Object.keys(r.body), ['error'], `${url} sends back the refusal and nothing else`);
  }

  await sleep(300);
  assert.equal(fs.existsSync(marker), false, 'no run was started');
  assert.equal(fs.readFileSync(configPath, 'utf8'), before, 'config.json is unchanged');
  assert.equal(fs.existsSync(path.join(dir, 'config.json.bak')), false, 'and no .bak was written');
  assert.match(stderr.join(''), /refused POST \/api\/run \(origin: https:\/\/evil\.example\)/);
});

test("the real server: its own pages still work, and can't be framed", async (t) => {
  const { dir, marker, stub } = makeTempProject();
  const port = await startServer(t, dir, stub);

  const page = await request(port, 'GET', '/para');
  assert.equal(page.status, 200);
  assert.equal(page.headers['content-security-policy'], "frame-ancestors 'none'");
  assert.equal(page.headers['x-frame-options'], 'DENY');

  const run = await request(port, 'POST', '/api/run', { action: 'studentled-subject', subject: 'math' }, { origin: `http://127.0.0.1:${port}` });
  assert.equal(run.status, 200, JSON.stringify(run.body));
  for (let i = 0; i < 40 && !fs.existsSync(marker); i++) await sleep(100);
  assert.match(fs.readFileSync(marker, 'utf8'), /--student-led --subject math/);

  const viaLocalhost = await request(port, 'POST', '/api/stop', undefined, { host: `localhost:${port}`, origin: `http://localhost:${port}` });
  assert.equal(viaLocalhost.status, 200);
});
