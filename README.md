# Notion API Hub on Vercel

This project provides serverless endpoints for various Notion integrations:

## Calendar & Map APIs
- `/api/calendar` — Reads a Notion database and returns a subscribable **.ics** calendar feed (uses `ical-generator`).
- `/api/notion-geojson` — Reads the same Notion database and returns **GeoJSON** suitable for Mapbox/Leaflet.
- `/public/index.html` — A minimal Mapbox GL JS page that fetches from `/api/notion-geojson` and displays markers; designed to be embedded in Notion.

## Content Generation APIs
- `/api/spanish-tips` — Generates Spanish language learning tips using OpenAI and saves them to a Notion database.
- `/api/recipes` — Generates detailed cooking recipes with AI-generated images and saves them to a Notion database.

## Quick start

1. **Create a Notion internal integration** and copy its secret.
2. **Share** your target Notion database(s) with that integration.
3. **Set environment variables** in Vercel Project Settings (or in `.env` for local development):
   - `NOTION_TOKEN` — Required for all endpoints
   - `OPENAI_API_KEY` — Required for `/api/spanish-tips` and `/api/recipes`
   - `MAPBOX_PUBLIC_TOKEN` — (Optional) For map functionality. You will still need to place this public token in `public/index.html` or pass it via the `token` URL param (see below). Without Next.js there is no automatic env injection into static HTML.
4. Deploy:
   ```bash
   npm i
   vercel
   vercel --prod
   ```
5. Calendar subscribe (Apple Calendar / Google Calendar):
   ```
   https://<your-app>.vercel.app/api/calendar?db=<DATABASE_ID>
   ```
   You can create a pretty URL `/calendar.ics?db=...` thanks to `vercel.json`.

6. Map (embed in Notion):
   - URL:
     ```
     https://<your-app>.vercel.app/map?db=<DATABASE_ID>&token=<YOUR_PUBLIC_MAPBOX_TOKEN>
     ```
   - In Notion, use **/Embed** and paste the URL.

## Content Generation APIs

### Spanish Tips (`/api/spanish-tips`)

Generates Spanish language learning tips using OpenAI and creates structured pages in your Notion database.

**Required Query Parameters:**
- `db` — Notion database ID (e.g., `22028e1a435d807cb1a3fca3e2675d1f`)
- `prompt` — Your Spanish tip request (e.g., "What are different ways to greet someone in the evening?")

**Example:**
```
GET /api/spanish-tips?db=22028e1a435d807cb1a3fca3e2675d1f&prompt=What%20are%20different%20ways%20to%20greet%20someone%20in%20the%20evening%3F
```

**Response:**
```json
{
  "message": "Spanish tip created successfully",
  "title": "Evening Greetings in Spanish"
}
```

**Required Notion Database Properties:**
- `Name` (title) — The tip title
- `Category` (select) — One of: Core Grammar & Verb Use, Vocabulary & Word Use, Conversation & Usage, Pronunciation & Listening, Cultural / Regional Variation
- `Subcategory` (select) — Various subcategories like Verb Conjugation, Vocabulary, Idiomatic Expressions, etc.
- `CEFR Level` (select) — A1 through C2 proficiency levels
- `Last Reviewed` (date) — Automatically set to the current date

**Generated Content:**
- Practice link to ChatGPT
- Detailed explanation in markdown
- Example sentences/phrases
- Practice prompts

### Recipes (`/api/recipes`)

Generates detailed cooking recipes with AI-generated food photography and comprehensive nutritional information.

**Required Query Parameters:**
- `db` — Notion database ID for recipes
- `prompt` — Your recipe request (e.g., "Give me a recipe for chicken tacos")

**Example:**
```
GET /api/recipes?db=YOUR_RECIPE_DB_ID&prompt=Give%20me%20a%20recipe%20for%20chicken%20tacos
```

**Response:**
```json
{
  "message": "Recipe created successfully",
  "title": "Authentic Chicken Tacos"
}
```

**Required Notion Database Properties:**
- `Name` (title) — Recipe name
- `Description` (rich_text) — Recipe description
- `Country of Origin` (select) — Origin country/region
- `Difficulty` (select) — Easy, Medium, or Hard
- `Prep Time (min)` (number) — Preparation time
- `Cook Time (min)` (number) — Cooking time
- `Serving Size` (rich_text) — Number of servings
- `Ingredients` (rich_text) — Formatted ingredient list
- `Meal Type` (multi_select) — Breakfast, Lunch, Dinner, Snack, Dessert
- `Diet` (multi_select) — Diet types (Keto, Vegan, Vegetarian, etc.)
- `Allergies` (multi_select) — Common allergens
- `Protein Type` (multi_select) — None, Chicken, Beef, Pork, Tofu, Fish, Seafood, Other
- `Calories (cal)` (number) — Total calories
- `Protein (g)` (number) — Protein in grams
- `Carbs (g)` (number) — Carbohydrates in grams
- `Fat (g)` (number) — Fat in grams
- `Fiber (g)` (number) — Fiber in grams
- `Nutrition Facts` (rich_text) — Additional nutrition information

**Generated Content:**
- AI-generated food photography (set as page cover)
- Step-by-step preparation instructions
- Step-by-step cooking instructions
- Complete nutritional breakdown

### Environment Variables

In addition to `NOTION_TOKEN`, the content generation APIs require:
- `OPENAI_API_KEY` — Your OpenAI API key for GPT and image generation

## Calendar & Map Configuration

## Notion property names (defaults & overrides)

The endpoints try to work with sensible defaults, but you can override via query params.

Expected fields in your Notion database:
- **Event name** (title) → default: first Title property found or `nameProp` param
- **Start date** (date) → default: property named `Start` or via `startProp`
- **End date** (date) → default: property named `End` or via `endProp` (fallback to Start.end)
- **All Day** (checkbox) → default: property named `AllDay` or `allDayProp` param
- **Location name** (rich_text/text) → default: `Location` or `locationProp`
- **Coordinates** (text) `"lat,lon"` → default: `LocationCoords` or `coordsProp`
- **URL** (url) → default: `URL` or `urlProp`

Examples:
- `GET /api/calendar?db=xxxxx&startProp=Begin&endProp=Finish&coordsProp=Coords`
- `GET /api/notion-geojson?db=xxxxx&locationProp=Place&urlProp=Link`

## Alarms

- Timed events: a `VALARM` 1 hour before start.
- All-day events: a `VALARM` 1 day before (00:00 of the event’s day minus 1 day).

## Mapbox token

- This project ships a static `public/index.html`. Static HTML **cannot** read server env vars.
- Provide your **public** Mapbox token either:
  - by **adding it directly** into `public/index.html` (search for `YOUR_MAPBOX_PUBLIC_TOKEN`), or
  - via the URL param `?token=YOUR_PUBLIC_MAPBOX_TOKEN`.
- Use a **public (non-secret)** token restricted by domain in Mapbox dashboard.

## Security
- Anyone with the URL can view the map/ICS. For private use, add a `key=...` query param check in the API handlers and pass it in your URLs.
