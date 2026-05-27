import assert from "node:assert/strict";
import test from "node:test";
import { constantTimeEqual, isAuthorizedAdmin, parseBearerToken } from "./admin-auth";

test("parseBearerToken extracts bearer token", () => {
  assert.equal(parseBearerToken("Bearer abc123"), "abc123");
  assert.equal(parseBearerToken("Bearer   abc123   "), "abc123");
  assert.equal(parseBearerToken("Token abc123"), null);
  assert.equal(parseBearerToken(null), null);
});

test("constantTimeEqual compares equal-length strings safely", () => {
  assert.equal(constantTimeEqual("abc", "abc"), true);
  assert.equal(constantTimeEqual("abc", "abd"), false);
  assert.equal(constantTimeEqual("abc", "ab"), false);
});

test("isAuthorizedAdmin validates Authorization header token", () => {
  const authorized = new Request("https://example.com/api/bbb/admin/logs", {
    headers: { authorization: "Bearer super-secret" },
  });
  const unauthorized = new Request("https://example.com/api/bbb/admin/logs", {
    headers: { authorization: "Bearer no-thanks" },
  });

  assert.equal(isAuthorizedAdmin(authorized, "super-secret"), true);
  assert.equal(isAuthorizedAdmin(unauthorized, "super-secret"), false);
  assert.equal(isAuthorizedAdmin(authorized, ""), false);
});
