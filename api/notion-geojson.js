import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_TOKEN });

function getTitle(props, titleProp) {
  if (titleProp && props[titleProp]?.title) {
    return props[titleProp].title.map(t => t.plain_text).join("") || "Untitled";
  }
  for (const [k, v] of Object.entries(props)) {
    if (v?.type === "title") {
      return (v.title || []).map(t => t.plain_text).join("") || "Untitled";
    }
  }
  return "Untitled";
}

function getRichTextAsString(rtArr) {
  if (!Array.isArray(rtArr)) return "";
  return rtArr.map(t => t.plain_text).join("");
}

function parseCoords(s) {
  if (!s) return null;
  const parts = ("" + s).split(",").map(x => x.trim());
  if (parts.length !== 2) return null;
  const lat = parseFloat(parts[0]);
  const lon = parseFloat(parts[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}

async function fetchAllPages(database_id, filter = undefined, sorts = undefined) {
  const pages = [];
  let cursor = undefined;
  do {
    const resp = await notion.databases.query({
      database_id,
      start_cursor: cursor,
      filter,
      sorts
    });
    pages.push(...resp.results);
    cursor = resp.has_more ? resp.next_cursor : undefined;
  } while (cursor);
  return pages;
}

export default async function handler(req, res) {
  try {
    const {
      db: database_id,
      titleProp,
      startProp = "Start",
      endProp = "End",
      locationProp = "Location",
      coordsProp = "LocationCoords",
      urlProp = "URL"
    } = req.query;

    if (!database_id) {
      res.status(400).json({ error: "Missing required query param: db (Notion database ID)" });
      return;
    }

    const pages = await fetchAllPages(database_id, undefined, [{ property: startProp, direction: "ascending" }]);

    const features = [];

    for (const p of pages) {
      const props = p.properties || {};
      const title = getTitle(props, titleProp);

      let coordsRaw = "";
      if (props[coordsProp]?.rich_text) {
        coordsRaw = getRichTextAsString(props[coordsProp]?.rich_text);
      } else if (props[coordsProp]?.formula?.string) {
        coordsRaw = props[coordsProp]?.formula?.string;
      } else if (typeof props[coordsProp]?.plain_text === "string") {
        coordsRaw = props[coordsProp]?.plain_text;
      }
      const coords = parseCoords(coordsRaw);
      if (!coords) continue;

      const locStr =
        getRichTextAsString(props[locationProp]?.rich_text) ||
        props[locationProp]?.title?.map(t => t.plain_text).join("") ||
        "";

      const url = props[urlProp]?.url || p.url;

      const startField = props[startProp]?.date;
      const endField = props[endProp]?.date;

      const start = startField?.start || null;
      const end = endField?.start || startField?.end || null;

      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [coords.lon, coords.lat] },
        properties: {
          id: p.id,
          name: title,
          location: locStr,
          url,
          start,
          end
        }
      });
    }

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "public, max-age=300");
    res.status(200).json({ type: "FeatureCollection", features });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Internal error", detail: String(e) });
  }
}
