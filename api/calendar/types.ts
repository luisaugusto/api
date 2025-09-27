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
  Location = "Location",
  URL = "URL",
  Notes = "Notes",
  Name = "Name",
}

export type NotionPropertyValue = PageObjectResponse["properties"][string];
export type NotionDate = Extract<NotionPropertyValue, { type: "date" }>["date"];
export type NotionResponse =
  | PageObjectResponse
  | PartialPageObjectResponse
  | PartialDataSourceObjectResponse
  | DataSourceObjectResponse;

export interface Props {
  allDay: boolean;
  category: string | undefined;
  date: NotionDate | undefined;
  location: string;
  notes: string;
  status: string;
  url: string | null;
  title: string;
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
