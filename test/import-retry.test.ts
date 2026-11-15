import assert from "node:assert/strict";
import test from "node:test";
import { sendImportBatch } from "../src/lib/import-retry.ts";

test("finishes 3,006 rows after batch 121 is rate limited without replaying successful batches", async () => {
  let now = 0;
  let windowStarted = 0;
  let requestsInWindow = 0;
  let processed = 0;
  const attempts: number[] = [];
  const countdown: number[] = [];

  for (let offset = 0; offset < 3006; offset += 25) {
    const batch = Math.floor(offset / 25) + 1;
    const response = await sendImportBatch(async () => {
      attempts.push(batch);
      if (now - windowStarted >= 60_000) {
        requestsInWindow = 0;
        windowStarted = now;
      }
      requestsInWindow += 1;
      if (requestsInWindow > 120) {
        return Response.json({ error: "Rate limited" }, { status: 429, headers: { "Retry-After": "60" } });
      }
      processed += Math.min(25, 3006 - offset);
      return Response.json({ success: true });
    }, (seconds) => countdown.push(seconds), async (ms) => { now += ms; });
    assert.equal(response.status, 200);
  }

  assert.equal(processed, 3006);
  assert.deepEqual(attempts, [...Array.from({ length: 121 }, (_, i) => i + 1), 121]);
  assert.equal(now, 60_000);
  assert.deepEqual(countdown, Array.from({ length: 61 }, (_, i) => 60 - i));
});

test("uses JSON retryAfter when the header is absent and preserves the final error body", async () => {
  let calls = 0;
  let waited = 0;
  const response = await sendImportBatch(async () => {
    calls += 1;
    return Response.json({ retryAfter: 2, error: "Still limited" }, { status: 429 });
  }, () => {}, async (ms) => { waited += ms; });

  assert.equal(calls, 4);
  assert.equal(waited, 6000);
  assert.equal(response.status, 429);
  assert.equal((await response.json()).error, "Still limited");
});

test("falls back to 60 seconds for malformed rate limit responses", async () => {
  let calls = 0;
  let waited = 0;
  await sendImportBatch(async () => ++calls === 1
    ? new Response("<html>limited</html>", { status: 429, headers: { "Retry-After": "invalid" } })
    : Response.json({ success: true }), () => {}, async (ms) => { waited += ms; });
  assert.equal(calls, 2);
  assert.equal(waited, 60_000);
});

test("supports HTTP-date Retry-After values", async (context) => {
  context.mock.method(Date, "now", () => Date.parse("2026-11-15T00:00:00Z"));
  let calls = 0;
  let waited = 0;
  await sendImportBatch(async () => ++calls === 1
    ? new Response(null, { status: 429, headers: { "Retry-After": "Sun, 15 Nov 2026 00:00:02 GMT" } })
    : Response.json({ success: true }), () => {}, async (ms) => { waited += ms; });
  assert.equal(waited, 2000);
});

test("does not retry server errors or ambiguous network failures", async () => {
  let calls = 0;
  const unexpectedWait = async () => { assert.fail("Must not wait or retry"); };
  const response = await sendImportBatch(async () => {
    calls += 1;
    return new Response("Failed", { status: 500 });
  }, () => {}, unexpectedWait);
  assert.equal(response.status, 500);
  assert.equal(calls, 1);

  await assert.rejects(sendImportBatch(async () => {
    calls += 1;
    throw new Error("Connection lost");
  }, () => {}, unexpectedWait), /Connection lost/);
  assert.equal(calls, 2);
});
