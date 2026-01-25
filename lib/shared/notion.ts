import {
  type BlockObjectRequest,
  Client,
  type CreatePageParameters,
  PageObjectResponse,
  isFullComment,
  isFullPage,
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

// Generic helpers for reuse across features

export const fetchPage = async (
  pageId: string,
): Promise<PageObjectResponse> => {
  try {
    const notion = getNotionClient();
    const page = await notion.pages.retrieve({ page_id: pageId });
    if (!isFullPage(page)) {
      throw new Error("Fetched page is not a full page object");
    }
    return page;
  } catch (err) {
    throw new Error(`Failed to fetch Notion page`, { cause: err });
  }
};

export const fetchPageBlocks = async (pageId: string): Promise<string> => {
  try {
    const notion = getNotionClient();
    const blocks = await notion.blocks.children.list({ block_id: pageId });

    const blockTexts: string[] = [];
    for (const block of blocks.results) {
      if (!("type" in block)) {
        // Skip blocks without type
      } else if (block.type === "heading_2" && "heading_2" in block) {
        const heading = block.heading_2;
        const text = heading.rich_text
          .map((rt) => (rt.type === "text" ? rt.text?.content : ""))
          .join("");
        blockTexts.push(`# ${text}`);
      } else if (
        block.type === "numbered_list_item" &&
        "numbered_list_item" in block
      ) {
        const item = block.numbered_list_item;
        const text = item.rich_text
          .map((rt) => (rt.type === "text" ? rt.text?.content : ""))
          .join("");
        blockTexts.push(`- ${text}`);
      }
    }

    return blockTexts.join("\n");
  } catch (err) {
    throw new Error(`Failed to fetch page blocks`, { cause: err });
  }
};

export const updatePage = async (
  pageId: string,
  properties: NonNullable<
    Parameters<typeof Client.prototype.pages.update>[0]["properties"]
  >,
): Promise<void> => {
  try {
    const notion = getNotionClient();
    await notion.pages.update({ page_id: pageId, properties });
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
    for (const block of existingBlocks.results) {
      if ("id" in block) {
        // eslint-disable-next-line no-await-in-loop
        await notion.blocks.delete({ block_id: block.id });
      }
    }

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

    // Extract plain text from rich_text array
    const textContent = comment.rich_text
      .map((rt) => (rt.type === "text" ? rt.text?.content : ""))
      .join("");

    return textContent;
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
  expectedDatabaseId: string,
): Promise<boolean> => {
  try {
    const notion = getNotionClient();
    const page = await notion.pages.retrieve({ page_id: pageId });
    if (!isFullPage(page)) {
      throw new Error("Fetched page is not a full page object");
    }
    // eslint-disable-next-line no-console
    console.log(page);
    const pageDatabase =
      page.parent.type === "data_source_id" ? page.parent.database_id : null;
    // eslint-disable-next-line no-console
    console.log(pageDatabase, expectedDatabaseId);
    return pageDatabase === expectedDatabaseId;
  } catch (err) {
    throw new Error(`Failed to verify database access`, { cause: err });
  }
};
