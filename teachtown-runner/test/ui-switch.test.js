'use strict';
/*
 * ui-server.js + the session lock: a session started from a Desktop
 * shortcut owns the browser profile, so the para page gets a 409 (and the
 * holder's subject/start time) instead of a second runner that would open a
 * blank window inside it. With {switch:true} the server writes the stop
 * request, waits for the lock to be released, then spawns.
 *
 * Runs a temp copy of the server (placeholder config, temp profileDir) with
 * TT_UI_RUNNER pointing at a stub — no real runner, browser, or config.json.
 * The harness is shared with http-guard.test.js (test/ui-harness.js).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { spawn } = require('child_process');
const lock = require('../lib/session-lock');
const { makeTempProject, request, startServer, sleep } = require('./ui-harness');

test('para page vs a shortcut session: 409 + holder, then switch, then spawn', async (t) => {
  const { dir, profileDir, marker, stub } = makeTempProject();
  const shortcut = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
  t.after(() => shortcut.kill());
  const startedAt = new Date().toISOString();
  fs.mkdirSync(profileDir, { recursive: true });
  fs.writeFileSync(
    lock.lockPathFor(profileDir),
    JSON.stringify({ pid: shortcut.pid, subject: 'science', mode: 'student-led', learner: 'Luis', source: 'shortcut', startedAt })
  );
  const port = await startServer(t, dir, stub);

  // Status shows the outside session.
  const st = await request(port, 'GET', '/api/status');
  assert.equal(st.body.elsewhere.label, 'Science');
  assert.equal(st.body.elsewhere.source, 'shortcut');

  // A plain tap: 409, nothing spawned, no stop request.
  const r1 = await request(port, 'POST', '/api/run', { action: 'studentled-subject', subject: 'math' });
  assert.equal(r1.status, 409);
  assert.equal(r1.body.elsewhere.label, 'Science');
  assert.equal(r1.body.elsewhere.startedAt, startedAt);
  assert.equal(fs.existsSync(lock.stopPathFor(profileDir)), false);
  assert.equal(fs.existsSync(marker), false);

  // Confirmed: the server asks Science to stop and waits for the lock.
  const pending = request(port, 'POST', '/api/run', { action: 'studentled-subject', subject: 'math', switch: true, switchPid: shortcut.pid });
  await sleep(700);
  assert.equal(lock.stopRequestedFor(profileDir, shortcut.pid), true, 'stop request names the shortcut session');
  assert.equal(fs.existsSync(marker), false, 'nothing spawned while Science still holds the lock');
  // The shortcut runner would now clean up and release — simulate that.
  fs.unlinkSync(lock.lockPathFor(profileDir));
  const r2 = await pending;
  assert.equal(r2.status, 200, JSON.stringify(r2.body));
  for (let i = 0; i < 40 && !fs.existsSync(marker); i++) await sleep(100);
  assert.match(fs.readFileSync(marker, 'utf8'), /--student-led --subject math/);
});

test('para STOP with no run of its own asks the shortcut session to stop', async (t) => {
  const { dir, profileDir, stub } = makeTempProject();
  const shortcut = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
  t.after(() => shortcut.kill());
  fs.mkdirSync(profileDir, { recursive: true });
  fs.writeFileSync(
    lock.lockPathFor(profileDir),
    JSON.stringify({ pid: shortcut.pid, subject: 'ela', mode: 'student-led', learner: 'Luis', source: 'shortcut', startedAt: new Date().toISOString() })
  );
  const port = await startServer(t, dir, stub);
  const r = await request(port, 'POST', '/api/stop');
  assert.equal(r.status, 200);
  assert.equal(lock.stopRequestedFor(profileDir, shortcut.pid), true);
});

test('a switch confirmed for a different session than the one on screen is refused (re-ask)', async (t) => {
  const { dir, profileDir, marker, stub } = makeTempProject();
  const shortcut = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
  t.after(() => shortcut.kill());
  fs.mkdirSync(profileDir, { recursive: true });
  fs.writeFileSync(
    lock.lockPathFor(profileDir),
    JSON.stringify({ pid: shortcut.pid, subject: 'ela', mode: 'student-led', learner: 'Luis', source: 'shortcut', startedAt: new Date().toISOString() })
  );
  const port = await startServer(t, dir, stub);
  // The para confirmed ending Science (some other pid); ELA holds the lock now.
  const r = await request(port, 'POST', '/api/run', { action: 'studentled-subject', subject: 'math', switch: true, switchPid: shortcut.pid + 1 });
  assert.equal(r.status, 409);
  assert.equal(r.body.elsewhere.label, 'ELA', 'hands back the real holder so the page can ask again');
  assert.equal(fs.existsSync(lock.stopPathFor(profileDir)), false, 'the unconfirmed session was NOT asked to stop');
  assert.equal(fs.existsSync(marker), false);
});

test('STOP pressed during a pending switch cancels it: the new run never starts', async (t) => {
  const { dir, profileDir, marker, stub } = makeTempProject();
  const shortcut = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
  t.after(() => shortcut.kill());
  fs.mkdirSync(profileDir, { recursive: true });
  fs.writeFileSync(
    lock.lockPathFor(profileDir),
    JSON.stringify({ pid: shortcut.pid, subject: 'science', mode: 'student-led', learner: 'Luis', source: 'shortcut', startedAt: new Date().toISOString() })
  );
  const port = await startServer(t, dir, stub);
  const pending = request(port, 'POST', '/api/run', { action: 'studentled-subject', subject: 'math', switch: true, switchPid: shortcut.pid });
  await sleep(600);
  await request(port, 'POST', '/api/stop'); // e.g. the teacher's dashboard STOP
  fs.unlinkSync(lock.lockPathFor(profileDir)); // Science finishes closing
  const r = await pending;
  assert.equal(r.status, 409);
  assert.match(r.body.error, /Cancelled/);
  await sleep(500);
  assert.equal(fs.existsSync(marker), false, 'Math was not started');
});
