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
}

// @TODO: When Notion adds official Place property support, remove this custom type
export interface NotionPlace {
  lat: number;
  lon: number;
  name: string;
  address: string;
  aws_place_id: string | null;
  google_place_id: string | null;
}

export interface PlacePropertyValue {
  id: string;
  type: "place";
  place: NotionPlace | null;
}

type CoreNotionPropertyValue = PageObjectResponse["properties"][string];
export type NotionPropertyValue = CoreNotionPropertyValue | PlacePropertyValue;
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
  place: NotionPlace | null | undefined;
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
