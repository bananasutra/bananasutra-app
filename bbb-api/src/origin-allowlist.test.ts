import assert from "node:assert/strict";
import test from "node:test";
import { isAllowedBbbOrigin } from "./origin-allowlist";

const PROD = ["https://bananasutra.com"];

test("isAllowedBbbOrigin allows configured production origins", () => {
  assert.equal(isAllowedBbbOrigin("https://bananasutra.com", PROD), true);
});

test("isAllowedBbbOrigin allows R50 staging hosts", () => {
  assert.equal(isAllowedBbbOrigin("https://stage.bananasutra.com", PROD), true);
  assert.equal(isAllowedBbbOrigin("https://bananasutra-redesign.pages.dev", PROD), true);
  assert.equal(isAllowedBbbOrigin("https://6834ce13.bananasutra-redesign.pages.dev", PROD), true);
});

test("isAllowedBbbOrigin rejects unknown origins", () => {
  assert.equal(isAllowedBbbOrigin("https://evil.example", PROD), false);
  assert.equal(isAllowedBbbOrigin("http://stage.bananasutra.com", PROD), false);
});
