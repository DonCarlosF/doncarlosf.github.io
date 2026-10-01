'use strict';
/*
 * Actually EXECUTES the windows/*.cmd launchers through cmd.exe. Every other
 * check on these files (CRLF, ASCII-only, content greps) is static — none of
 * them catch a cmd.exe *parse* error, because none of them run the file.
 *
 * That gap was real: an unescaped "(LTS)" inside an `if errorlevel 1 ( ... )`
 * block in _student-led.cmd (present since the very first Windows launcher
 * commit) made cmd.exe fail with "then was unexpected at this time." and
 * exit 255 — a parse-time failure, so it happened whether or not the block's
 * condition was even true. Every one of the six Desktop shortcuts funnels
 * through this file or through TeachTown-Buttons.cmd (which had the same
 * line, copied from it), so this silently broke all of them: double-click →
 * a console flashes open, prints one line, and closes before anyone can read
 * it — "did not execute anything." cmd.exe's batch parser treats ANY literal
 * `(` or `)` inside an already-open `if (...)`/`for (...)` block as trying to
 * nest another block, even when balanced and even when the enclosing block's
 * condition is false and the body never runs — the parse happens regardless.
 * The fix is `^(` / `^)` (caret-escaped), same convention already used for
 * `|` elsewhere in these files.
 *
 * These tests never touch node_modules, config.json, or start real
 * automation: node is hidden from PATH so every launcher deterministically
 * stops at its own "Node.js was not found" check — the same block that broke
 * — before anything that would open a browser runs.
 *
 * Windows-only (these are Windows launchers); skips with a notice elsewhere.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

const WIN_DIR = path.join(__dirname, '..', 'windows');
const SUBJECT_FILES = {
  ela: 'Luis-ELA.cmd',
  math: 'Luis-Math.cmd',
  science: 'Luis-Science.cmd',
  'social-studies': 'Luis-Social-Studies.cmd',
  'social-skills': 'Luis-Social-Skills.cmd',
};

const isWindows = process.platform === 'win32';

// PATH with every directory that actually contains node.exe filtered out —
// deterministically triggers each launcher's own "Node.js was not found"
// branch, regardless of what's installed on the machine running the test.
function pathWithoutNode() {
  const dirs = (process.env.PATH || process.env.Path || '').split(path.delimiter);
  return dirs.filter((d) => {
    try {
      return !fs.existsSync(path.join(d, 'node.exe'));
    } catch {
      return true;
    }
  }).join(path.delimiter);
}

// Runs a .cmd through real cmd.exe (never a shell string — argv only, so a
// path with spaces in "Install Desktop Shortcuts.cmd" is never misparsed as
// two arguments). The FULL ABSOLUTE PATH is passed, matching exactly what a
// real Desktop .lnk does (its TargetPath is always absolute) — cmd.exe's
// bare-relative-filename search rules under `/c` are not the same as an
// interactive prompt's and are not what a real shortcut ever exercises.
// input:'' closes stdin immediately, so `pause` proceeds instead of
// hanging, the same as `< NUL` on a real console.
function runCmd(file, args, env) {
  try {
    const stdout = execFileSync('cmd.exe', ['/c', path.join(WIN_DIR, file), ...args], {
      cwd: WIN_DIR,
      env: env || process.env,
      input: '',
      encoding: 'utf8',
      timeout: 15_000,
    });
    return { code: 0, stdout };
  } catch (err) {
    return { code: err.status, stdout: String(err.stdout || '') };
  }
}

// exit 255 with this text is cmd.exe's own parse-error signature — the
// single most important thing every one of these assertions rules out.
function assertParsedCleanly(result) {
  assert.notEqual(result.code, 255, `cmd.exe parse error (exit 255):\n${result.stdout}`);
  assert.doesNotMatch(result.stdout, /was unexpected at this time/i);
}

test('windows/*.cmd launchers parse and run through real cmd.exe', { skip: !isWindows && 'Windows-only launchers' }, async (t) => {
  const noNode = { ...process.env, PATH: pathWithoutNode(), Path: pathWithoutNode() };

  await t.test('_student-led.cmd with no subject: usage message, not a parse crash', () => {
    const r = runCmd('_student-led.cmd', [], process.env);
    assertParsedCleanly(r);
    assert.equal(r.code, 1);
    assert.match(r.stdout, /usage: _student-led\.cmd/);
  });

  await t.test('_student-led.cmd with node hidden: the exact block that broke, verified end to end', () => {
    const r = runCmd('_student-led.cmd', ['ela'], noNode);
    assertParsedCleanly(r);
    assert.equal(r.code, 1);
    assert.match(r.stdout, /Node\.js was not found on PATH\./);
    // The escaped parens must still DISPLAY as literal "(LTS)" — ^( only
    // changes how cmd.exe parses the line, never what it prints.
    assert.match(r.stdout, /nodejs\.org \(LTS\)/);
  });

  await t.test('TeachTown-Buttons.cmd with node hidden: it had the identical bug, independently', () => {
    const r = runCmd('TeachTown-Buttons.cmd', [], noNode);
    assertParsedCleanly(r);
    assert.equal(r.code, 1);
    assert.match(r.stdout, /Node\.js was not found on PATH\./);
    assert.match(r.stdout, /nodejs\.org \(LTS\)/);
  });

  for (const [subject, file] of Object.entries(SUBJECT_FILES)) {
    await t.test(`${file}: the real Desktop-shortcut entry point for "${subject}" parses`, () => {
      const r = runCmd(file, [], noNode);
      assertParsedCleanly(r);
      assert.equal(r.code, 1);
      assert.match(r.stdout, /Node\.js was not found on PATH\./, `${file} should reach the shared node check`);
    });
  }

  // The exit-code branch after the runner, through real cmd.exe. A temp copy
  // of _student-led.cmd sits next to a STUB runner.js that just exits with
  // the code it's told to — the real runner, config.json, and browser
  // profile are never involved.
  const stubTree = () => {
    const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'ttcmd-'));
    fs.mkdirSync(path.join(dir, 'windows'));
    fs.copyFileSync(path.join(WIN_DIR, '_student-led.cmd'), path.join(dir, 'windows', '_student-led.cmd'));
    fs.mkdirSync(path.join(dir, 'node_modules', 'playwright'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'config.json'), '{}');
    fs.writeFileSync(
      path.join(dir, 'runner.js'),
      "console.log('STUB RUNNER'); process.exit(Number(process.env.STUB_EXIT || 0));\n"
    );
    return dir;
  };
  const runStub = (dir, code) => {
    const withNode = [path.dirname(process.execPath), process.env.PATH || process.env.Path || ''].join(path.delimiter);
    try {
      const stdout = execFileSync('cmd.exe', ['/c', path.join(dir, 'windows', '_student-led.cmd'), 'math'], {
        cwd: dir,
        env: { ...process.env, PATH: withNode, Path: withNode, STUB_EXIT: String(code) },
        input: '',
        encoding: 'utf8',
        timeout: 15_000,
      });
      return { code: 0, stdout };
    } catch (err) {
      return { code: err.status, stdout: String(err.stdout || '') };
    }
  };

  await t.test('_student-led.cmd exit 3 (already running / kept it): no "Details" line, still pauses', () => {
    const r = runStub(stubTree(), 3);
    assertParsedCleanly(r);
    assert.equal(r.code, 3);
    assert.match(r.stdout, /STUB RUNNER/);
    assert.doesNotMatch(r.stdout, /Details are in the logs/);
    assert.match(r.stdout, /Press any key/i, 'the pause keeps the message on screen');
  });

  await t.test('_student-led.cmd exit 1: points at the logs and pauses', () => {
    const r = runStub(stubTree(), 1);
    assertParsedCleanly(r);
    assert.equal(r.code, 1);
    assert.match(r.stdout, /The runner exited with code 1\. Details are in the logs\\ folder\./);
    assert.match(r.stdout, /Press any key/i);
  });

  await t.test('_student-led.cmd exit 0 (incl. a switch): window closes without a pause', () => {
    const r = runStub(stubTree(), 0);
    assertParsedCleanly(r);
    assert.equal(r.code, 0);
    assert.doesNotMatch(r.stdout, /Press any key|Details are in the logs/i);
  });
});

// "Install Desktop Shortcuts.cmd" is deliberately not run here: its whole
// job is `powershell ... -File install-shortcuts.ps1`, which creates real
// Desktop shortcuts — an `npm test` run must never do that as a side effect.
// It has no if-blocks of its own (nothing to parse-crash on; confirmed by
// grepping every .cmd file here for unescaped parens inside a block), so
// there is no parse risk in it worth an execution test.
