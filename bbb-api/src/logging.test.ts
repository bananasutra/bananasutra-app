import assert from "node:assert/strict";
import test from "node:test";
import { hashActorId, hashIp, parseAdmin404LogsQuery, parseAdminLogsQuery, serializeBbbLogSignals } from "./logging";

test("parseAdminLogsQuery returns defaults", () => {
  const parsed = parseAdminLogsQuery(new URL("https://example.com/api/bbb/admin/logs"));
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.value.limit, 50);
  assert.equal(typeof parsed.value.before, "number");
  assert.equal(parsed.value.status, undefined);
});

test("parseAdminLogsQuery clamps limit and validates status", () => {
  const parsed = parseAdminLogsQuery(
    new URL("https://example.com/api/bbb/admin/logs?limit=999&status=ok&q=hope"),
  );
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.value.limit, 200);
  assert.equal(parsed.value.status, "ok");
  assert.equal(parsed.value.query, "hope");
});

test("parseAdminLogsQuery rejects invalid status and bad limit", () => {
  const badStatus = parseAdminLogsQuery(
    new URL("https://example.com/api/bbb/admin/logs?status=nope"),
  );
  assert.equal(badStatus.ok, false);
  if (!badStatus.ok) {
    assert.match(badStatus.error, /Invalid status/);
  }

  const badLimit = parseAdminLogsQuery(
    new URL("https://example.com/api/bbb/admin/logs?limit=0"),
  );
  assert.equal(badLimit.ok, false);
  if (!badLimit.ok) {
    assert.match(badLimit.error, /Invalid limit/);
  }
});

test("hashIp is stable for same input and salt", async () => {
  const hashA = await hashIp("1.2.3.4", "salty");
  const hashB = await hashIp("1.2.3.4", "salty");
  const hashC = await hashIp("1.2.3.4", "different");
  assert.equal(hashA, hashB);
  assert.notEqual(hashA, hashC);
});

test("hashIp returns null when missing required values", async () => {
  assert.equal(await hashIp("", "salt"), null);
  assert.equal(await hashIp("unknown", "salt"), null);
  assert.equal(await hashIp("1.2.3.4", ""), null);
});

test("serializeBbbLogSignals stores active flags and support keywords", () => {
  const serialized = serializeBbbLogSignals({
    pageType: "song-detail",
    intentFlags: ["soundLedIntent", "funIntent"],
    supportKeywords: ["hope"],
  });
  assert.equal(serialized.pageType, "song-detail");
  const parsed = JSON.parse(serialized.intentJson) as { flags: string[]; support: string[] };
  assert.deepEqual(parsed.flags, ["soundLedIntent", "funIntent"]);
  assert.deepEqual(parsed.support, ["hope"]);
});

test("hashActorId is stable for same input and salt", async () => {
  const hashA = await hashActorId("cee-laptop", "salty");
  const hashB = await hashActorId("cee-laptop", "salty");
  const hashC = await hashActorId("cee-laptop", "different");
  assert.equal(hashA, hashB);
  assert.notEqual(hashA, hashC);
});

test("parseAdmin404LogsQuery parses before, limit, and bad_path filter", () => {
  const parsed = parseAdmin404LogsQuery(
    new URL("https://example.com/api/bbb/admin/404?limit=25&before=111&bad_path=%2Foops"),
  );
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.value.limit, 25);
  assert.equal(parsed.value.before, 111);
  assert.equal(parsed.value.badPath, "/oops");
});

test("parseAdmin404LogsQuery rejects invalid bad_path and limit", () => {
  const badLimit = parseAdmin404LogsQuery(new URL("https://example.com/api/bbb/admin/404?limit=0"));
  assert.equal(badLimit.ok, false);
  if (!badLimit.ok) {
    assert.match(badLimit.error, /Invalid limit/);
  }

  const tooLong = parseAdmin404LogsQuery(
    new URL(`https://example.com/api/bbb/admin/404?bad_path=${"a".repeat(201)}`),
  );
  assert.equal(tooLong.ok, false);
  if (!tooLong.ok) {
    assert.match(tooLong.error, /Invalid bad_path/);
  }
});
