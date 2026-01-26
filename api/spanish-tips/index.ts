import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  addCommentToNotionPage,
  convertToBlockObjectRequest,
  createNotionPage,
} from "../../lib/shared/notion.js";
import { setResponse, verifyParam } from "../../lib/shared/utils.js";
import type { Block } from "@tryfabric/martian/build/src/notion/blocks.js";
import Tip from "../../lib/spanish-tips/schema.js";
import { generateData } from "../../lib/shared/openai.js";
import { markdownToBlocks } from "@tryfabric/martian";
import { waitUntil } from "@vercel/functions";
import { zodTextFormat } from "openai/helpers/zod";

const format = zodTextFormat(Tip, "tip");

const createBlocks = (response: typeof format.__output): Block[] => {
  const chatQuery = encodeURIComponent(
    `You are a Spanish language tutor that provides tips to help people learn Spanish. I am currently studying the topic "${response.title}", and I want to practice it. Please provide me with practice prompts that I can use to improve my understanding of this topic.`,
  );
  return markdownToBlocks(`[Practice with ChatGPT](https://chat.openai.com/?q=${chatQuery})
# Explanation
${response.explanation}
# Examples
${response.uses}
# Practice Prompt
${response.practicePrompt}`);
};

const createTip = async (
  response: typeof format.__output,
  database_id: string,
): Promise<void> => {
  const blocks = createBlocks(response);

  const pageId = await createNotionPage({
    children: convertToBlockObjectRequest(blocks),
    database_id,
    properties: {
      "CEFR Level": {
        select: {
          name: response.level,
        },
      },
      Category: {
        select: {
          name: response.category,
        },
      },
      "Last Reviewed": {
        date: {
          start: new Date().toISOString(),
        },
      },
      Name: {
        title: [
          {
            text: {
              content: response.title,
            },
          },
        ],
      },
      Subcategory: {
        select: {
          name: response.subcategory,
        },
      },
    },
  });

  await addCommentToNotionPage({
    message: "your Spanish tip has been created!",
    pageId,
  });
};

const generateTip = async (prompt: string): Promise<typeof format.__output> => {
  const response = await generateData({
    format,
    input: prompt,
    instructions:
      "You are a positive and cheerful spanish language tutor that provides tips to help people learn Spanish. Each tip should be clear, and practical with enough information for me to learn the concept that is being discussed.",
  });

  if (!response) {
    throw new Error("No parsed data returned.");
  }

  return response;
};

export default function handler(req: VercelRequest, res: VercelResponse): void {
  try {
    const db = verifyParam(
      res,
      req.query.db,
      "Missing required query param: db",
    );
    const prompt = verifyParam(
      res,
      req.query.prompt,
      "Missing required query param: prompt",
    );

    waitUntil(generateTip(prompt).then((tip) => createTip(tip, db)));

    res.status(200);
  } catch (error) {
    setResponse({
      error,
      message: "Failed to create Spanish tip",
      res,
      status: 500,
    });
  }
}
