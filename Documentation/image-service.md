# Savr Image Service

## Purpose

The project design includes an Image Service for retrieving ingredient-related images through an external image API. This implementation uses the **Google Custom Search API** to let users search the web for an ingredient image while creating a recipe, instead of only uploading their own files.

Local uploads for recipe, ingredient, and step images already exist. The Image Service adds **external image search** on top of that: a backend search endpoint, a frontend picker in the Create Recipe form, and persistence of a selected external image URL alongside uploaded images.

## Current Implementation

The Image Service is implemented through:

- backend search endpoint in `Codebase/backend/routes/imageRoutes.js`
- controller in `Codebase/backend/controllers/imageController.js` (validation, mock-safe responses)
- service in `Codebase/backend/services/imageService.js` (Google call, result mapping, in-memory cache)
- external URL validation in `Codebase/backend/helpers/imageHelper.js` (`isValidExternalImageUrl`)
- recipe persistence in `Codebase/backend/services/recipeService.js` (stores a selected URL as a `Media` row)
- frontend API helper in `Codebase/frontend/src/lib/imageService.js`
- ingredient image picker in `Codebase/frontend/src/components/IngredientImageSearch.jsx`, used by `CreateRecipeButton.jsx`

No database schema change was required: `Media.media_url` is a text column, so an external `https://…` URL is stored the same way as a local `/uploads/…` path.

## Environment Variables

The Image Service reads its configuration from environment variables (see `Codebase/backend/.env.example`). Copy `.env.example` to `.env` and fill these in:

| Variable | Required | Description |
| --- | --- | --- |
| `GOOGLE_SEARCH_API_KEY` | to enable search | Google Custom Search API key |
| `GOOGLE_SEARCH_ENGINE_ID` | to enable search | Programmable Search Engine ID (the `cx` value), with Image search enabled |
| `IMAGE_SEARCH_CACHE_TTL_MS` | optional | How long (ms) to cache search results in memory. Default `600000` (10 minutes). |

### Getting the keys

1. In Google Cloud Console, enable the **Custom Search API** and create an **API key** → `GOOGLE_SEARCH_API_KEY`.
2. At the Programmable Search Engine control panel, create a search engine, turn on **Image search** (and "Search the entire web"), and copy the **Search engine ID** → `GOOGLE_SEARCH_ENGINE_ID`.

Keys live only in `.env`, which is git-ignored. Never commit real keys.

## Running Without Keys

The service is **mock-safe**: if the keys are missing, the backend still starts and the endpoint responds normally with `configured: false` and an empty image list (see the example below). The Create Recipe page continues to work, and manual image upload is unaffected. This means the app runs out of the box without any Google setup.

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

### Example response (configured)

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
  "provider": "google-custom-search",
  "configured": true,
  "cached": false
}
```

`cached` is `true` when the result was served from the in-memory cache.

### Example response (no keys configured)

```json
{
  "query": "tomato",
  "images": [],
  "provider": "google-custom-search",
  "configured": false,
  "cached": false,
  "message": "Image search is not configured. Set GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_ENGINE_ID to enable it."
}
```

### Status codes

- `200` — success (including the not-configured response)
- `400` — missing/blank/over-long `ingredient`, or `limit` out of range
- `401` — missing or invalid token
- `502` — the image provider was unreachable or returned an error

## How Image Suggestions Are Used in Recipe Creation

On the Create Recipe page, each ingredient card has a **"Search web images"** control:

1. The user enters (or reuses the ingredient name as) a search term and clicks **Search web images**.
2. The frontend calls `GET /images/search` and shows suggested thumbnails (with loading, empty, error, and not-configured states).
3. Selecting a thumbnail stores its URL as the ingredient's `imageUrl` in the form.
4. On submit, the URL is sent as `ingredients[i][imageUrl]`. The backend validates it (`http`/`https` only) and stores it as a `Media` row of type `ingredient`.

Uploading a file and picking a web image are **mutually exclusive** per ingredient — an uploaded file takes precedence, and choosing one clears the other. Existing manual upload behavior is unchanged.

## Testing Locally

Automated backend tests (mocked Google API, no keys needed):

```text
cd Codebase/backend
npm test
```

This covers the response mapping, caching, error handling, URL validation, request validation, auth, the not-configured path, and external-URL persistence.

Manual check of the live endpoint:

```text
cd Codebase/backend
npm start
# then, with a bearer token from logging in:
curl "http://localhost:4000/images/search?ingredient=tomato" -H "Authorization: Bearer <token>"
```

Without keys you get the `configured: false` response; with keys you get mapped image results.

## Troubleshooting

- **Missing keys / `configured: false`** — set `GOOGLE_SEARCH_API_KEY` and `GOOGLE_SEARCH_ENGINE_ID` in `Codebase/backend/.env` and restart the backend.
- **Google quota exceeded** — the free Custom Search tier allows ~100 queries/day. When exceeded, Google returns an error and the endpoint responds with `502`. Results are cached to reduce repeat queries; wait for the daily quota to reset.
- **No images found** — a `200` with `configured: true` and `images: []` means the provider returned nothing; try a different or more specific search term.
- **`401 Unauthorized`** — you must be logged in; the endpoint requires a valid bearer token.
- **Backend not running** — the picker will show an error; make sure the backend is running on `http://localhost:4000`.
