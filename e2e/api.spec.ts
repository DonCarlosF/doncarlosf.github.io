import { test, expect, type APIRequestContext } from "@playwright/test";

/**
 * POSTs a raw body with a JSON content-type (for malformed-JSON cases).
 * Sent as a Buffer on purpose: when `data` is a *string* under a JSON content-type,
 * Playwright JSON.stringify()s anything that isn't already valid JSON, which would
 * turn `{ not json` into a perfectly valid JSON string and defeat the test.
 */
function postRaw(request: APIRequestContext, path: string, body: string) {
  return request.post(path, { headers: { "content-type": "application/json" }, data: Buffer.from(body, "utf8") });
}

test.describe("POST /api/connect", () => {
  test("valid body → 200 ok", async ({ request }) => {
    const res = await request.post("/api/connect", {
      data: { name: "Test Visitor", email: "visitor@example.com", phone: "", visitDate: "This Sunday", message: "Hi!" },
    });
    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true });
  });

  test("honeypot `company` filled → 200 ok (silently accepted)", async ({ request }) => {
    const res = await request.post("/api/connect", {
      data: { name: "Bot", email: "bot@example.com", company: "Spam Inc" },
    });
    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true });
  });

  test("invalid email → 422", async ({ request }) => {
    const res = await request.post("/api/connect", { data: { name: "Test", email: "not-an-email" } });
    expect(res.status()).toBe(422);
    expect(await res.json()).toMatchObject({ ok: false });
  });

  test("missing name → 422", async ({ request }) => {
    const res = await request.post("/api/connect", { data: { email: "visitor@example.com" } });
    expect(res.status()).toBe(422);
  });

  test("malformed JSON → 400", async ({ request }) => {
    const res = await postRaw(request, "/api/connect", "{ not json");
    expect(res.status()).toBe(400);
    expect(await res.json()).toMatchObject({ ok: false });
  });

  test("GET → 405", async ({ request }) => {
    const res = await request.get("/api/connect");
    expect(res.status()).toBe(405);
  });
});

test.describe("POST /api/subscribe", () => {
  test("valid email → 200 ok", async ({ request }) => {
    const res = await request.post("/api/subscribe", { data: { email: "reader@example.com" } });
    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true });
  });

  test("invalid email → 422", async ({ request }) => {
    const res = await request.post("/api/subscribe", { data: { email: "nope" } });
    expect(res.status()).toBe(422);
    expect(await res.json()).toMatchObject({ ok: false });
  });

  test("missing email → 422", async ({ request }) => {
    const res = await request.post("/api/subscribe", { data: {} });
    expect(res.status()).toBe(422);
  });

  test("malformed JSON → 400", async ({ request }) => {
    const res = await postRaw(request, "/api/subscribe", "email=oops");
    expect(res.status()).toBe(400);
  });
});

test.describe("POST /api/volunteer", () => {
  // Schema: firstName (required), lastName (optional), email (required), phone (required), company (honeypot).
  test("valid body → 200 ok", async ({ request }) => {
    const res = await request.post("/api/volunteer", {
      data: { firstName: "Vol", lastName: "Unteer", email: "vol@example.com", phone: "510-555-0100" },
    });
    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true });
  });

  test("lastName is optional → 200 ok", async ({ request }) => {
    const res = await request.post("/api/volunteer", {
      data: { firstName: "Vol", email: "vol@example.com", phone: "510-555-0100" },
    });
    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true });
  });

  test("honeypot `company` filled → 200 ok (silently accepted)", async ({ request }) => {
    const res = await request.post("/api/volunteer", {
      data: { firstName: "Bot", email: "bot@example.com", phone: "000", company: "Spam Inc" },
    });
    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true });
  });

  test("missing phone → 422", async ({ request }) => {
    const res = await request.post("/api/volunteer", { data: { firstName: "Vol", email: "vol@example.com" } });
    expect(res.status()).toBe(422);
    expect(await res.json()).toMatchObject({ ok: false });
  });

  test("invalid email → 422", async ({ request }) => {
    const res = await request.post("/api/volunteer", { data: { firstName: "Vol", email: "vol@", phone: "510-555-0100" } });
    expect(res.status()).toBe(422);
  });

  test("malformed JSON → 400", async ({ request }) => {
    const res = await postRaw(request, "/api/volunteer", "<xml/>");
    expect(res.status()).toBe(400);
    expect(await res.json()).toMatchObject({ ok: false });
  });
});

test.describe("POST /api/revalidate", () => {
  test("without the shared secret → 401 and nothing revalidated", async ({ request }) => {
    const res = await request.post("/api/revalidate");
    expect(res.status()).toBe(401);
    expect(await res.json()).toMatchObject({ ok: false });
  });

  test("with a wrong secret → 401", async ({ request }) => {
    const res = await request.post("/api/revalidate", { headers: { "x-revalidate-secret": "nope" } });
    expect(res.status()).toBe(401);
  });
});

test.describe("cross-site POST guard", () => {
  test("a cross-site fetch is rejected with 403", async ({ request }) => {
    const res = await request.post("/api/subscribe", {
      headers: { "sec-fetch-site": "cross-site" },
      data: { email: "reader@example.com" },
    });
    expect(res.status()).toBe(403);
  });
});
