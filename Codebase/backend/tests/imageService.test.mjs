// Unit tests for the Image Service internals: the Google response mapping,
// caching, and error handling (with a mocked global fetch), plus the external
// image URL validator. No server or database is started here.

import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import {
  isImageSearchConfigured,
  searchIngredientImages,
  clearImageSearchCache,
} from "../services/imageService.js";
import { isValidExternalImageUrl } from "../helpers/imageHelper.js";

const realFetch = global.fetch;

function fakeGoogleResponse(items) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ items }),
  };
}

const SAMPLE_ITEMS = [
  {
    title: "Fresh Tomato",
    link: "https://cdn.example.com/tomato.jpg",
    displayLink: "example.com",
    image: {
      thumbnailLink: "https://cdn.example.com/tomato-thumb.jpg",
      contextLink: "https://example.com/tomato",
    },
  },
  {
    title: "Tomato 2",
    link: "https://cdn.example.com/tomato2.jpg",
    displayLink: "example.org",
    image: {},
  },
];

beforeEach(() => {
  process.env.GOOGLE_SEARCH_API_KEY = "test-key";
  process.env.GOOGLE_SEARCH_ENGINE_ID = "test-cx";
  clearImageSearchCache();
});

afterEach(() => {
  global.fetch = realFetch;
  delete process.env.GOOGLE_SEARCH_API_KEY;
  delete process.env.GOOGLE_SEARCH_ENGINE_ID;
});

test("isImageSearchConfigured reflects presence of both env vars", () => {
  assert.equal(isImageSearchConfigured(), true);
  delete process.env.GOOGLE_SEARCH_API_KEY;
  assert.equal(isImageSearchConfigured(), false);
});

test("maps Google items into the stable image shape", async () => {
  global.fetch = async () => fakeGoogleResponse(SAMPLE_ITEMS);

  const { images, cached } = await searchIngredientImages("tomato", 6);

  assert.equal(cached, false);
  assert.equal(images.length, 2);
  assert.deepEqual(images[0], {
    title: "Fresh Tomato",
    url: "https://cdn.example.com/tomato.jpg",
    thumbnailUrl: "https://cdn.example.com/tomato-thumb.jpg",
    source: "example.com",
    contextLink: "https://example.com/tomato",
  });
  // Missing thumbnail/context fields fall back to null.
  assert.equal(images[1].thumbnailUrl, null);
  assert.equal(images[1].contextLink, null);
});

test("respects the requested limit", async () => {
  global.fetch = async () => fakeGoogleResponse(SAMPLE_ITEMS);
  const { images } = await searchIngredientImages("tomato", 1);
  assert.equal(images.length, 1);
});

test("caches results for identical query + limit", async () => {
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    return fakeGoogleResponse(SAMPLE_ITEMS);
  };

  const first = await searchIngredientImages("tomato", 6);
  const second = await searchIngredientImages("tomato", 6);

  assert.equal(first.cached, false);
  assert.equal(second.cached, true);
  assert.equal(calls, 1, "fetch should only be called once due to caching");
});

test("throws a 502-tagged error when Google returns a non-ok response", async () => {
  global.fetch = async () => ({ ok: false, status: 403, json: async () => ({}) });

  await assert.rejects(
    () => searchIngredientImages("tomato", 6),
    (err) => err.status === 502
  );
});

test("throws a 502-tagged error when the network call fails", async () => {
  global.fetch = async () => {
    throw new Error("network down");
  };

  await assert.rejects(
    () => searchIngredientImages("tomato", 6),
    (err) => err.status === 502
  );
});

test("isValidExternalImageUrl accepts http/https and rejects everything else", () => {
  assert.equal(isValidExternalImageUrl("https://example.com/a.jpg"), true);
  assert.equal(isValidExternalImageUrl("http://example.com/a.jpg"), true);

  assert.equal(isValidExternalImageUrl("javascript:alert(1)"), false);
  assert.equal(isValidExternalImageUrl("data:image/png;base64,AAAA"), false);
  assert.equal(isValidExternalImageUrl("file:///etc/passwd"), false);
  assert.equal(isValidExternalImageUrl("not a url"), false);
  assert.equal(isValidExternalImageUrl(""), false);
  assert.equal(isValidExternalImageUrl(null), false);
  assert.equal(isValidExternalImageUrl(`https://x/${"a".repeat(2100)}`), false);
});
