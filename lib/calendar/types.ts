import type {
  DataSourceObjectResponse,
  PageObjectResponse,
  PartialDataSourceObjectResponse,
  PartialPageObjectResponse,
} from "@notionhq/client/build/src/api-endpoints.js";

export enum CalendarProp {
  Status = "Status",
  AllDay = "AllDay",
  Date = "Date",
  Category = "Category",
  Place = "Place",
  URL = "URL",
  Notes = "Notes",
  Name = "Name",
  Event = "Event",
  Done = "Done",
}
export type NotionPropertyValue = PageObjectResponse["properties"][string];
export type NotionDate = Extract<NotionPropertyValue, { type: "date" }>["date"];
export type NotionPlace = Extract<
  NotionPropertyValue,
  { type: "place" }
>["place"];

export type NotionResponse =
  | PageObjectResponse
  | PartialPageObjectResponse
  | PartialDataSourceObjectResponse
  | DataSourceObjectResponse;

export interface Props {
  allDay: boolean;
  category: string | undefined;
  date: NotionDate | undefined;
  place: NotionPlace | null | undefined;
  notes: string;
  status: string | undefined;
  url: string | null;
  title: string;
  done: boolean;
}

export const emoji = {
  "Amusement Parks": "🎢",
  Bakeries: "🥐",
  Concerts: "🎵",
  Entertainment: "🎭",
  Flights: "✈️",
  Hotels: "🏨",
  Markets: "🛒",
  Museums: "🖼️",
  Parks: "🌳",
  "Places of Interest": "📍",
  Restaurants: "🍽️",
  Shopping: "🛍️",
  Tours: "🗺️",
  Transportation: "🚆",
} as const;
