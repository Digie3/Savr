// Built-in ingredient image fallback.
//
// Used automatically when the Google Custom Search API keys are not configured,
// so ingredient image search works out of the box for anyone who clones the
// project. Suggestions are generated locally as lightweight SVG tiles (an
// ingredient emoji on a coloured background) and served by the backend, so the
// fallback needs no external network, no third-party API, and no bundled photo
// assets.

// A practical library of common cooking ingredients and a representative emoji.
const LIBRARY = [
  { name: "tomato", emoji: "🍅" },
  { name: "onion", emoji: "🧅" },
  { name: "garlic", emoji: "🧄" },
  { name: "potato", emoji: "🥔" },
  { name: "carrot", emoji: "🥕" },
  { name: "broccoli", emoji: "🥦" },
  { name: "lettuce", emoji: "🥬" },
  { name: "spinach", emoji: "🥬" },
  { name: "cucumber", emoji: "🥒" },
  { name: "bell pepper", emoji: "🫑" },
  { name: "mushroom", emoji: "🍄" },
  { name: "corn", emoji: "🌽" },
  { name: "rice", emoji: "🍚" },
  { name: "pasta", emoji: "🍝" },
  { name: "chicken", emoji: "🍗" },
  { name: "beef", emoji: "🥩" },
  { name: "pork", emoji: "🥓" },
  { name: "salmon", emoji: "🐟" },
  { name: "shrimp", emoji: "🦐" },
  { name: "milk", emoji: "🥛" },
  { name: "cheese", emoji: "🧀" },
  { name: "butter", emoji: "🧈" },
  { name: "egg", emoji: "🥚" },
  { name: "flour", emoji: "🌾" },
  { name: "sugar", emoji: "🍬" },
  { name: "salt", emoji: "🧂" },
  { name: "pepper", emoji: "🌶️" },
  { name: "basil", emoji: "🌿" },
  { name: "parsley", emoji: "🌿" },
  { name: "cilantro", emoji: "🌿" },
  { name: "olive oil", emoji: "🫒" },
  { name: "lemon", emoji: "🍋" },
  { name: "lime", emoji: "🍈" },
  { name: "apple", emoji: "🍎" },
  { name: "banana", emoji: "🍌" },
  { name: "strawberry", emoji: "🍓" },
  { name: "blueberry", emoji: "🫐" },
];

const GENERIC_EMOJI = "🍽️";

function slugify(name) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function titleCase(name) {
  return name.replace(/\b\w/g, (c) => c.toUpperCase());
}

// Deterministic, varied tile colour derived from the name (no manual palette).
function colorFor(name) {
  let hue = 0;
  for (let i = 0; i < name.length; i += 1) {
    hue = (hue * 31 + name.charCodeAt(i)) % 360;
  }
  return `hsl(${hue}, 45%, 52%)`;
}

const BY_SLUG = new Map(LIBRARY.map((entry) => [slugify(entry.name), entry]));

// Match strategy: exact, then startsWith, then contains (either direction).
export function findFallbackMatches(query, limit) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return [];

  const scored = [];
  for (const entry of LIBRARY) {
    const name = entry.name;
    let score = null;

    if (name === q) score = 0;
    else if (name.startsWith(q) || q.startsWith(name)) score = 1;
    else if (name.includes(q) || q.includes(name)) score = 2;

    if (score !== null) scored.push({ entry, score });
  }

  scored.sort((a, b) => a.score - b.score || a.entry.name.localeCompare(b.entry.name));
  return scored.slice(0, limit).map((s) => s.entry);
}

function toImage(entry, origin) {
  const slug = slugify(entry.name);
  const url = `${origin}/images/fallback/${slug}.svg`;
  return {
    title: titleCase(entry.name),
    url,
    thumbnailUrl: url,
    source: "Savr library",
    contextLink: null,
  };
}

// Returns fallback image suggestions for a query. Always returns at least one
// suggestion (a generic tile for the query term) so the user can always pick
// something, matching the behaviour of a real search provider.
export function getFallbackImages(query, limit, origin) {
  let matches = findFallbackMatches(query, limit);

  if (matches.length === 0) {
    matches = [{ name: (query || "ingredient").trim(), emoji: GENERIC_EMOJI }];
  }

  return matches.map((entry) => toImage(entry, origin));
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Renders the SVG tile for a fallback image request (e.g. "tomato.svg").
// Unknown slugs render a generic tile labelled with the requested term.
export function renderFallbackSvg(fileParam) {
  const slug = String(fileParam || "").replace(/\.svg$/i, "");
  const entry = BY_SLUG.get(slug);

  const label = titleCase(entry ? entry.name : slug.replace(/-/g, " ") || "Ingredient");
  const emoji = entry ? entry.emoji : GENERIC_EMOJI;
  const color = colorFor(label.toLowerCase());
  const safeLabel = escapeXml(label);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240" role="img" aria-label="${safeLabel}">
  <rect width="240" height="240" fill="${color}"/>
  <text x="120" y="120" font-size="110" text-anchor="middle" dominant-baseline="central">${emoji}</text>
  <text x="120" y="210" font-size="22" font-family="Arial, Helvetica, sans-serif" fill="#ffffff" font-weight="bold" text-anchor="middle">${safeLabel}</text>
</svg>`;
}
