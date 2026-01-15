import {
  type BlockObjectRequest,
  Client,
  type CreatePageParameters,
} from "@notionhq/client";
import type { Block } from "@tryfabric/martian/build/src/notion/blocks.js";
import { slugify } from "./utils.js";
import undici from "undici";

const { FormData } = undici;

export const getNotionClient = (): Client =>
  new Client({ auth: String(process.env.NOTION_TOKEN) });

// Need to find a way to ensure type safety here
// There's a mismatch between the Block type from Martian and the BlockObjectRequest type from Notion SDK
// Due to the version mismatch of the Notion API
export const convertToBlockObjectRequest = (
  blocks: Block[],
): BlockObjectRequest[] => blocks as BlockObjectRequest[];

const createFileUpload = async (
  notion: Client,
  filename: string,
): Promise<{ id: string }> => {
  const created = await notion.fileUploads.create({
    content_type: "image/png",
    filename,
  });
  return created;
};

const uploadFileToNotion = async (
  fileUploadId: string,
  imageBuffer: Buffer,
  filename: string,
): Promise<void> => {
  const form = new FormData();
  form.append(
    "file",
    new Blob([new Uint8Array(imageBuffer)], { type: "image/png" }),
    filename,
  );

  const res = await fetch(
    `https://api.notion.com/v1/file_uploads/${fileUploadId}/send`,
    {
      body: form,
      headers: {
        Authorization: `Bearer ${process.env.NOTION_TOKEN}`,
        "Notion-Version": "2022-06-28",
      },
      method: "POST",
    },
  );
  if (!res.ok) {
    throw new Error(await res.text());
  }
};

export const uploadImageToNotion = async (
  b64: string,
  title: string,
): Promise<string> => {
  try {
    const notion = getNotionClient();
    const imageBuffer = Buffer.from(b64, "base64");
    const filename = `${Date.now()}-${slugify(title) || "recipe"}.png`;
    const created = await createFileUpload(notion, filename);
    await uploadFileToNotion(created.id, imageBuffer, filename);
    return created.id;
  } catch (err) {
    throw new Error(`Failed to upload image to Notion`, { cause: err });
  }
};

export const createNotionPage = async ({
  children,
  database_id,
  properties,
  cover,
}: {
  database_id: string;
  children: BlockObjectRequest[];
  properties: NonNullable<
    Parameters<typeof Client.prototype.pages.create>[0]["properties"]
  >;
  cover?: CreatePageParameters["cover"];
}): Promise<string> => {
  try {
    const notion = getNotionClient();
    const created = await notion.pages.create({
      children,
      cover: cover ?? null,
      parent: { database_id },
      properties,
    });
    return created.id;
  } catch (err) {
    throw new Error(`Failed to create Notion page`, { cause: err });
  }
};

export const addCommentToNotionPage = async ({
  pageId,
  mentionUserId,
  message,
}: {
  pageId: string;
  mentionUserId: string;
  message: string;
}): Promise<void> => {
  try {
    const notion = getNotionClient();
    await notion.comments.create({
      parent: { page_id: pageId },
      rich_text: [
        { text: { content: "Hey " }, type: "text" },
        {
          mention: { type: "user", user: { id: mentionUserId } },
          type: "mention",
        },
        { text: { content: `, ${message}` }, type: "text" },
      ],
    });
  } catch (err) {
    throw new Error(`Failed to add Notion comment`, { cause: err });
  }
};
