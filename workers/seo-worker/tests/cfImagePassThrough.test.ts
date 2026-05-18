import assert from "node:assert/strict";
import test from "node:test";
import { parseCdnCgiImageRequest, parseImageOptionString } from "../src/cfImagePassThrough.ts";

test("parseImageOptionString parses width format quality", () => {
  assert.deepEqual(parseImageOptionString("width=400,format=auto,quality=80"), {
    width: 400,
    format: "auto",
    quality: 80,
  });
});

test("parseCdnCgiImageRequest extracts source URL and options", () => {
  const url = new URL(
    "https://bananasutra.com/cdn-cgi/image/width=400,format=auto,quality=80/https://i1.sndcdn.com/artworks-x-t500x500.png",
  );
  const parsed = parseCdnCgiImageRequest(url);
  assert.ok(parsed);
  assert.equal(parsed.sourceUrl, "https://i1.sndcdn.com/artworks-x-t500x500.png");
  assert.equal(parsed.image.width, 400);
});

test("parseCdnCgiImageRequest returns null for normal paths", () => {
  assert.equal(parseCdnCgiImageRequest(new URL("https://bananasutra.com/songs/")), null);
});
