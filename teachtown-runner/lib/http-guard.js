'use strict';
/*
 * Which requests the local UI server (ui-server.js) answers.
 *
 * The server listens on 127.0.0.1 only, so nothing on the school network can
 * reach it. A website open in a browser on THIS computer still can, because
 * the browser sends the request for it. checkRequest refuses those before any
 * route runs:
 *
 *  1. Host must be 127.0.0.1:<port> or localhost:<port>. DNS rebinding points
 *     another site's name at 127.0.0.1, but the browser still sends that name
 *     as Host, so the site can't read /api/config (display names) or
 *     /api/stream.
 *  2. Origin, when a request has one, must be this server's own page.
 *     Browsers add Origin to every POST and to every cross-site fetch, so a
 *     form or fetch from another site can't start a run, stop one, or save
 *     config.json. A POST with no Origin comes from a program on this
 *     computer (Node, curl): browsers always send one.
 *  3. Anything other than GET or HEAD must be Content-Type: application/json.
 *     A site can send text/plain, form, or multipart requests without asking
 *     the browser first. JSON makes the browser ask (a CORS preflight), and
 *     this server never says yes.
 *
 * PAGE_HEADERS go on the HTML pages, so another site can't show them in a
 * hidden frame and trick a click on one of their buttons (clickjacking).
 */

const LOOPBACK_NAMES = ['127.0.0.1', 'localhost'];

const PAGE_HEADERS = Object.freeze({
  'content-security-policy': "frame-ancestors 'none'",
  'x-frame-options': 'DENY',
});

const text = (v) => (Array.isArray(v) ? v.join(', ') : v == null ? '' : String(v));

// null: answer the request. Otherwise { status, check, seen, error }: send
// status and error back; check and seen are for the console line.
function checkRequest(req, port) {
  const headers = req.headers || {};
  const hosts = LOOPBACK_NAMES.map((n) => `${n}:${port}`);

  const host = text(headers.host).trim().toLowerCase();
  if (!hosts.includes(host)) {
    return {
      status: 403,
      check: 'host',
      seen: host,
      error: `Refused: open this page at http://127.0.0.1:${port}/ (it only answers on this computer).`,
    };
  }

  if (headers.origin !== undefined) {
    const origin = text(headers.origin).trim().toLowerCase();
    if (!hosts.some((h) => origin === `http://${h}`)) {
      return { status: 403, check: 'origin', seen: origin, error: 'Refused: this request came from another website.' };
    }
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const type = text(headers['content-type']).split(';')[0].trim().toLowerCase();
    if (type !== 'application/json') {
      return {
        status: 415,
        check: 'content-type',
        seen: type,
        error: 'Refused: not sent as JSON. If this shows on a TeachTown page, reload the page and try again.',
      };
    }
  }

  return null;
}

// The helper window's line for a refusal. Everything in it came from the
// request, so it is cut down to printable ASCII and kept short.
function describeRefusal(req, refused) {
  const clean = (s, n) => text(s).replace(/[^\x20-\x7e]/g, '?').slice(0, n);
  const where = clean(text(req.url).split('?')[0], 60);
  return `ui-server: refused ${clean(req.method, 10)} ${where} (${refused.check}: ${clean(refused.seen, 60) || 'none'})`;
}

module.exports = { checkRequest, describeRefusal, PAGE_HEADERS, LOOPBACK_NAMES };
