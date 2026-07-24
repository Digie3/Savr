# Savr Image Service

## Purpose

The project design includes an Image Service for retrieving ingredient-related images through an external image API. This implementation uses the **Google Custom Search API** to let users search the web for an ingredient image while creating a recipe, instead of only uploading their own files.

Local uploads for recipe, ingredient, and step images already exist. The Image Service adds **external image search** on top of that: a backend search endpoint, a frontend picker in the Create Recipe form, and persistence of a selected external image URL alongside uploaded images.

The service runs in one of two modes automatically:

- **Google mode** — when the Google API keys are configured, it uses the Google Custom Search API (`provider: "google"`).
- **Fallback mode** — when the keys are absent, it returns built-in ingredient image suggestions generated locally (`provider: "fallback"`), so image search works immediately after cloning with **no configuration required**. The frontend treats both the same way; the backend decides.

## Current Implementation

The Image Service is implemented through:

- backend search endpoint in `Codebase/backend/routes/imageRoutes.js`
- controller in `Codebase/backend/controllers/imageController.js` (validation, mock-safe responses)
- service in `Codebase/backend/services/imageService.js` (Google call, result mapping, in-memory cache)
- fallback library + locally generated SVG tiles in `Codebase/backend/services/fallbackImageService.js`
- public fallback image route `GET /images/fallback/:file` (serves the SVG tiles)
- external URL validation in `Codebase/backend/helpers/imageHelper.js` (`isValidExternalImageUrl`)
- recipe persistence in `Codebase/backend/services/recipeService.js` (stores a selected URL as a `Media` row)
- frontend API helper in `Codebase/frontend/src/lib/imageService.js`
- ingredient image picker in `Codebase/frontend/src/components/IngredientImageSearch.jsx`, used by `CreateRecipeButton.jsx`

No database schema change was required: `Media.media_url` is a text column, so an external `https://…` URL is stored the same way as a local `/uploads/…` path.

## Environment Variables

The Image Service reads its configuration from environment variables (see `Codebase/backend/.env.example`). Copy `.env.example` to `.env` and set any you need (all are optional):

All variables are **optional** — with none set, the service runs in fallback mode.

| Variable | Required | Description |
| --- | --- | --- |
| `GOOGLE_SEARCH_API_KEY` | optional (enables Google mode) | Google Custom Search API key |
| `GOOGLE_SEARCH_ENGINE_ID` | optional (enables Google mode) | Programmable Search Engine ID (the `cx` value), with Image search enabled |
| `IMAGE_SEARCH_CACHE_TTL_MS` | optional | How long (ms) to cache Google results in memory. Default `600000` (10 minutes). |

Both `GOOGLE_SEARCH_API_KEY` and `GOOGLE_SEARCH_ENGINE_ID` must be set to use Google mode; otherwise the service uses fallback mode.

### Getting the keys

1. In Google Cloud Console, enable the **Custom Search API** and create an **API key** → `GOOGLE_SEARCH_API_KEY`.
2. At the Programmable Search Engine control panel, create a search engine, turn on **Image search** (and "Search the entire web"), and copy the **Search engine ID** → `GOOGLE_SEARCH_ENGINE_ID`.

Keys live only in `.env`, which is git-ignored. Never commit real keys.

## Running Without Keys (Fallback Mode)

If the keys are missing, the endpoint automatically returns **built-in ingredient image suggestions** instead of an error. These are lightweight SVG tiles (an ingredient emoji on a coloured background) generated locally by the backend and served from `GET /images/fallback/:file` — no external network, third-party API, or bundled photo assets are required.

The fallback matches the search term against a practical library of common ingredients (exact, `startsWith`, and `contains` matching) and always returns at least one suggestion. From the user's perspective, search works normally: they can search, see suggestions, select one, save the recipe, and reopen it later — all without any configuration. A subtle "Using local image suggestions" label is shown in the picker. Manual image upload is unaffected.

## Backend Endpoint

### Search ingredient images

```http
GET /images/search?ingredient=tomato&limit=6
Authorization: Bearer <token>
```

Authentication is **required**. The endpoint is only used from the (already authenticated) Create Recipe flow, and gating it keeps the shared Google API quota from anonymous use.

Query parameters:

- `ingredient` (required): the search term. Trimmed; max 100 characters. `q` is accepted as an alias.
- `limit` (optional): number of images, integer 1–10. Default `6`.

### Example response (Google mode — keys configured)

```json
{
  "query": "tomato",
  "images": [
    {
      "title": "Fresh Tomato",
      "url": "https://cdn.example.com/tomato.jpg",
      "thumbnailUrl": "https://cdn.example.com/tomato-thumb.jpg",
      "source": "example.com",
      "contextLink": "https://example.com/tomato"
    }
  ],
  "provider": "google",
  "configured": true,
  "cached": false
}
```

`cached` is `true` when the result was served from the in-memory cache.

### Example response (Fallback mode — no keys)

```json
{
  "query": "tomato",
  "images": [
    {
      "title": "Tomato",
      "url": "/images/fallback/tomato.svg",
      "thumbnailUrl": "/images/fallback/tomato.svg",
      "source": "Savr library",
      "contextLink": null
    }
  ],
  "provider": "fallback",
  "configured": false,
  "cached": false
}
```

Fallback URLs are **relative** (`/images/fallback/…`) — no host or port is embedded, so the stored value is portable. The frontend renders them through the existing `buildMediaUrl`/`API_BASE` logic (the same as `/uploads/…` paths). Google URLs remain absolute `https` URLs. The `images` array has the same shape in both modes, so the frontend does not need to know which mode produced them.

### Status codes

- `200` — success (Google or fallback)
- `400` — missing/blank/over-long `ingredient`, or `limit` out of range
- `401` — missing or invalid token
- `502` — Google mode only: the provider was unreachable or returned an error

## How Image Suggestions Are Used in Recipe Creation

On the Create Recipe page, each ingredient card has a **"Search web images"** control:

1. The user enters (or reuses the ingredient name as) a search term and clicks **Search web images**.
2. The frontend calls `GET /images/search` and shows suggested thumbnails (with loading, empty, and error states). It works identically in Google and fallback mode; in fallback mode it shows a subtle "Using local image suggestions" note.
3. Selecting a thumbnail stores its URL as the ingredient's `imageUrl` in the form.
4. On submit, the URL is sent as `ingredients[i][imageUrl]`. The backend validates it (`http`/`https` only) and stores it as a `Media` row of type `ingredient`.

Uploading a file and picking a web image are **mutually exclusive** per ingredient — an uploaded file takes precedence, and choosing one clears the other. Existing manual upload behavior is unchanged.

## Testing Locally

Automated backend tests (mocked Google API, no keys needed):

```text
cd Codebase/backend
npm test
```

This covers the Google response mapping, caching, error handling, URL validation, request validation, auth, the fallback library (matching + SVG rendering), and external-URL persistence.

Manual check of the live endpoint:

```text
cd Codebase/backend
npm start
# then, with a bearer token from logging in:
curl "http://localhost:4000/images/search?ingredient=tomato" -H "Authorization: Bearer <token>"
```

Without keys you get `provider: "fallback"` with built-in suggestions; with keys you get `provider: "google"` with web results.

## Troubleshooting

- **Want Google results instead of the fallback** — set `GOOGLE_SEARCH_API_KEY` and `GOOGLE_SEARCH_ENGINE_ID` in `Codebase/backend/.env` and restart the backend (`provider` switches to `"google"`).
- **Google quota exceeded** — the free Custom Search tier allows ~100 queries/day. When exceeded, Google returns an error and the endpoint responds with `502` (only in Google mode). Results are cached to reduce repeat queries; wait for the daily quota to reset.
- **No images found** — in Google mode, a `200` with `images: []` means the provider returned nothing; try a different term. Fallback mode always returns at least one suggestion.
- **`401 Unauthorized`** — the search endpoint requires a valid bearer token (the fallback image route `GET /images/fallback/:file` is public).
- **Backend not running** — the picker will show an error, and fallback image tiles won't load; make sure the backend is running on `http://localhost:4000`.
