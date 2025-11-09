import {
  CalendarProp,
  NotionDate,
  NotionPropertyValue,
  NotionResponse,
  Props,
  emoji,
} from "./types.js";
import { Client } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints.js";

export const isValidEvent = (
  props: Props,
  date?: NotionDate,
): date is NonNullable<NotionDate> =>
  props.status !== "Cancelled" &&
  props.category !== "Flights" &&
  date?.start !== null;

export const getProp = <T extends NotionPropertyValue["type"]>(
  props: PageObjectResponse["properties"],
  prop: CalendarProp,
  type: T,
): Extract<NotionPropertyValue, { type: T }> | null =>
  props[prop]?.type === type
    ? (props[prop] as Extract<NotionPropertyValue, { type: T }>)
    : null;

const getEmoji = (category: string | undefined): string =>
  category && category in emoji
    ? `${emoji[category as keyof typeof emoji]} `
    : "";

export const getProps = (
  properties: PageObjectResponse["properties"],
): Props => {
  const status = String(
    getProp(properties, CalendarProp.Status, "status")?.status?.name,
  );
  const allDay = Boolean(
    getProp(properties, CalendarProp.AllDay, "checkbox")?.checkbox,
  );
  const date = getProp(properties, CalendarProp.Date, "date")?.date;
  const category = getProp(properties, CalendarProp.Category, "select")?.select
    ?.name;
  const place = getProp(properties, CalendarProp.Place, "place")?.place;
  const url = getProp(properties, CalendarProp.URL, "url")?.url ?? null;
  const notes =
    getProp(properties, CalendarProp.Notes, "rich_text")
      ?.rich_text.map((text) => text.plain_text)
      .join("") || "";
  const title =
    getEmoji(category) +
    (["Scheduled", "Reserved"].includes(status) ? "" : "[Pending] ") +
    String(
      getProp(properties, CalendarProp.Name, "title")
        ?.title.map((text) => text.plain_text)
        .join(""),
    );

  return {
    allDay,
    category,
    date,
    notes,
    place,
    status,
    title,
    url,
  };
};

export const fetchAllPages = async (
  database_id: string,
  pages: NotionResponse[] = [],
  start_cursor?: string,
): Promise<NotionResponse[]> => {
  const auth = process.env.NOTION_TOKEN;
  if (!auth) {
    throw new Error("Missing NOTION_TOKEN environment variable");
  }
  const notion = new Client({ auth });

  const resp = await notion.dataSources.query({
    data_source_id: database_id,
    ...(start_cursor ? { start_cursor } : {}),
  });

  if (resp.has_more && resp.next_cursor) {
    return fetchAllPages(
      database_id,
      pages.concat(resp.results),
      resp.next_cursor,
    );
  }

  return pages.concat(resp.results);
};

export const getDateRange = (
  date: NonNullable<NotionDate>,
  allDay: boolean,
): { startDate: Date; endDate: Date } => {
  let start = new Date(date.start);
  let end = new Date(date.end || start.getTime() + 60 * 60 * 1000);

  if (allDay) {
    start = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()),
    );

    const endBase = date.end
      ? new Date(
          Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()),
        )
      : start;

    // For all-day events, ICS DTEND is exclusive; add one day so the last day is included.
    end = new Date(endBase.getTime() + 24 * 60 * 60 * 1000);
  }

  return { endDate: end, startDate: start };
};
