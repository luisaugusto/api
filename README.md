# Notion → Calendar (ICS) and Mapbox (GeoJSON) on Vercel

This project provides:
- `/api/calendar` — Serverless endpoint that reads a Notion database and returns a subscribable **.ics** calendar feed (uses `ical-generator`).
- `/api/notion-geojson` — Serverless endpoint that reads the same Notion database and returns **GeoJSON** suitable for Mapbox/Leaflet.
- `/public/index.html` — A minimal Mapbox GL JS page that fetches from `/api/notion-geojson` and displays markers; designed to be embedded in Notion.

## Quick start

1. **Create a Notion internal integration** and copy its secret.
2. **Share** your target Notion database(s) with that integration.
3. **Set environment variables** in Vercel Project Settings:
   - `NOTION_TOKEN`
   - (Optional) `MAPBOX_PUBLIC_TOKEN` — You will still need to place this public token in `public/index.html` or pass it via the `token` URL param (see below). Without Next.js there is no automatic env injection into static HTML.
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
