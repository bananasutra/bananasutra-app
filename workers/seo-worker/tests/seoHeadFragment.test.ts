import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildBotLinkPreviewHeadFragment,
  escapeHtmlAttributeValue,
} from "../src/seoHeadFragment.ts";

test("escapeHtmlAttributeValue escapes &, quotes, and <", () => {
  assert.equal(
    escapeHtmlAttributeValue(`a&b"c<d`),
    "a&amp;b&quot;c&lt;d",
  );
});

test("buildBotLinkPreviewHeadFragment omits image tags when image absent", () => {
  const html = buildBotLinkPreviewHeadFragment({
    title: "Ego Ain't Your Amigo · Song · BANANASUTRA",
    description: "Hello & welcome to \"quotes\".",
    canonical: "https://bananasutra.com/songs/ego-ain-t-your-amigo",
    type: "website",
  });
  assert.match(html, /property="og:title" content="Ego Ain't Your Amigo · Song · BANANASUTRA"/);
  assert.match(
    html,
    /property="og:description" content="Hello &amp; welcome to &quot;quotes&quot;\./,
  );
  assert.match(
    html,
    /property="og:url" content="https:\/\/bananasutra\.com\/songs\/ego-ain-t-your-amigo"/,
  );
  assert.match(html, /rel="canonical" href="https:\/\/bananasutra\.com\/songs\/ego-ain-t-your-amigo"/);
  assert.doesNotMatch(html, /og:image/);
  assert.doesNotMatch(html, /twitter:image/);
});

test("buildBotLinkPreviewHeadFragment includes image when set", () => {
  const html = buildBotLinkPreviewHeadFragment({
    title: "T",
    description: "D",
    canonical: "https://bananasutra.com/x",
    image: "https://bananasutra.com/og/x.png",
  });
  assert.match(html, /property="og:image" content="https:\/\/bananasutra\.com\/og\/x\.png"/);
  assert.match(html, /name="twitter:image" content="https:\/\/bananasutra\.com\/og\/x\.png"/);
});
