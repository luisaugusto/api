import {
  type BlockObjectRequest,
  Client,
  type CreatePageParameters,
  PageObjectResponse,
  RichTextItemResponse,
  UpdatePageParameters,
  isFullBlock,
  isFullComment,
  isFullPage,
} from "@notionhq/client";
import type { Block } from "@tryfabric/martian/build/src/notion/blocks.js";
import { slugify } from "./utils.js";
import undici from "undici";

const { FormData } = undici;

const richTextToString = (richText: RichTextItemResponse[]): string =>
  richText.map((rt) => (rt.type === "text" ? rt.text?.content : "")).join("");

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
  message,
}: {
  pageId: string;
  message: string;
}): Promise<void> => {
  const userId = process.env.NOTION_USER_ID;
  if (userId === undefined) {
    throw new Error("NOTION_USER_ID is not defined in environment variables");
  }

  try {
    const notion = getNotionClient();
    await notion.comments.create({
      parent: { page_id: pageId },
      rich_text: [
        { text: { content: "Hey " }, type: "text" },
        {
          mention: { type: "user", user: { id: userId } },
          type: "mention",
        },
        { text: { content: `, ${message}` }, type: "text" },
      ],
    });
  } catch (err) {
    throw new Error(`Failed to add Notion comment`, { cause: err });
  }
};

export const fetchPageBlocks = async (pageId: string): Promise<string> => {
  try {
    const notion = getNotionClient();
    const blocks = await notion.blocks.children.list({ block_id: pageId });

    const blockTexts: string[] = [];

    for (const block of blocks.results) {
      if (isFullBlock(block)) {
        switch (block.type) {
          case "paragraph":
            blockTexts.push(richTextToString(block.paragraph.rich_text));
            break;
          case "heading_1":
            blockTexts.push(richTextToString(block.heading_1.rich_text));
            break;
          case "heading_2":
            blockTexts.push(richTextToString(block.heading_2.rich_text));
            break;
          case "heading_3":
            blockTexts.push(richTextToString(block.heading_3.rich_text));
            break;
          case "numbered_list_item":
            blockTexts.push(
              richTextToString(block.numbered_list_item.rich_text),
            );
            break;
          case "bulleted_list_item":
            blockTexts.push(
              richTextToString(block.bulleted_list_item.rich_text),
            );
            break;
          default:
            break;
        }
      }
    }

    return blockTexts.join("\n");
  } catch (err) {
    throw new Error(`Failed to fetch page blocks`, { cause: err });
  }
};

export const updatePage = async (
  pageId: string,
  cover: UpdatePageParameters["cover"],
  properties: NonNullable<
    Parameters<typeof Client.prototype.pages.update>[0]["properties"]
  >,
): Promise<void> => {
  try {
    const notion = getNotionClient();
    await notion.pages.update({
      cover: cover ?? null,
      page_id: pageId,
      properties,
    });
  } catch (err) {
    throw new Error(`Failed to update Notion page`, { cause: err });
  }
};

export const updatePageBlocks = async (
  pageId: string,
  blocks: Block[],
): Promise<void> => {
  try {
    const notion = getNotionClient();

    // Get existing blocks
    const existingBlocks = await notion.blocks.children.list({
      block_id: pageId,
    });

    // Delete existing blocks
    await Promise.all(
      existingBlocks.results
        .filter((block) => "id" in block)
        .map((block) => notion.blocks.delete({ block_id: block.id })),
    );

    // Add new blocks
    const blockObjectRequests = convertToBlockObjectRequest(blocks);
    await notion.blocks.children.append({
      block_id: pageId,
      children: blockObjectRequests,
    });
  } catch (err) {
    throw new Error(`Failed to update page blocks`, { cause: err });
  }
};

export const fetchComment = async (commentId: string): Promise<string> => {
  try {
    const notion = getNotionClient();
    const comment = await notion.comments.retrieve({ comment_id: commentId });
    if (!isFullComment(comment)) {
      throw new Error("Fetched comment is not a full comment object");
    }

    return richTextToString(comment.rich_text);
  } catch (err) {
    throw new Error(`Failed to fetch Notion comment`, { cause: err });
  }
};

export const postComment = async (
  pageId: string,
  message: string,
): Promise<void> => {
  try {
    const notion = getNotionClient();
    await notion.comments.create({
      parent: { page_id: pageId },
      rich_text: [{ text: { content: message }, type: "text" }],
    });
  } catch (err) {
    throw new Error(`Failed to post Notion comment`, { cause: err });
  }
};

export const verifyDatabaseAccess = async (
  pageId: string,
): Promise<PageObjectResponse | null> => {
  try {
    const notion = getNotionClient();
    const page = await notion.pages.retrieve({ page_id: pageId });

    if (!isFullPage(page)) {
      throw new Error("Fetched page is not a full page object");
    }

    const pageDatabase =
      page.parent.type === "data_source_id" ? page.parent.database_id : null;

    return pageDatabase === process.env.NOTION_RECIPES_DATABASE_ID
      ? page
      : null;
  } catch (err) {
    throw new Error(`Failed to verify database access`, { cause: err });
  }
};
