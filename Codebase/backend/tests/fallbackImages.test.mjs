// Unit tests for the built-in fallback image library (no server or DB needed).

import test from "node:test";
import assert from "node:assert/strict";

import {
  findFallbackMatches,
  getFallbackImages,
  renderFallbackSvg,
} from "../services/fallbackImageService.js";

test("exact match is returned first", () => {
  const matches = findFallbackMatches("tomato", 6);
  assert.ok(matches.length >= 1);
  assert.equal(matches[0].name, "tomato");
});

test("partial 'contains' query matches multiple ingredients", () => {
  const names = findFallbackMatches("berry", 6).map((m) => m.name);
  assert.ok(names.includes("strawberry"));
  assert.ok(names.includes("blueberry"));
});

test("startsWith query matches", () => {
  const names = findFallbackMatches("bell", 6).map((m) => m.name);
  assert.ok(names.includes("bell pepper"));
});

test("blank query matches nothing", () => {
  assert.deepEqual(findFallbackMatches("   ", 6), []);
});

test("respects the limit", () => {
  assert.ok(findFallbackMatches("e", 3).length <= 3);
});

test("getFallbackImages always returns at least one suggestion", () => {
  const images = getFallbackImages("nonexistent-food", 6);
  assert.ok(images.length >= 1);
  assert.match(images[0].url, /^\/images\/fallback\/.+\.svg$/);
});

test("getFallbackImages returns relative paths (no host or port)", () => {
  const images = getFallbackImages("tomato", 6);
  assert.equal(images[0].url, "/images/fallback/tomato.svg");
  assert.equal(images[0].thumbnailUrl, images[0].url);
  assert.equal(images[0].title, "Tomato");
});

test("renderFallbackSvg returns an SVG for a known slug", () => {
  const svg = renderFallbackSvg("tomato.svg");
  assert.match(svg, /<svg/);
  assert.match(svg, /🍅/u);
  assert.match(svg, /Tomato/);
});

test("renderFallbackSvg handles unknown slugs generically", () => {
  const svg = renderFallbackSvg("quinoa.svg");
  assert.match(svg, /<svg/);
  assert.match(svg, /Quinoa/);
});

test("renderFallbackSvg escapes XML-unsafe characters in the label", () => {
  const svg = renderFallbackSvg("a<b");
  assert.match(svg, /&lt;/);
  assert.ok(!svg.includes("<b>"), "raw markup should not be injected");
});
