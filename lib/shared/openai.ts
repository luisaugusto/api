import type {
  ParsedResponse,
  ResponseFormatTextConfig,
} from "openai/resources/responses/responses.mjs";
import type { ExtractParsedContentFromParams } from "openai/lib/ResponsesParser.mjs";
import OpenAI from "openai";

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export const generateImage = async (prompt: string): Promise<string> => {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const imageResult = await openai.images.generate({
      model: "gpt-image-1.5",
      prompt,
      size: "1024x1024",
    });
    const b64 = imageResult?.data?.[0]?.b64_json;
    if (!b64) {
      throw new Error("OpenAI did not return b64_json.");
    }
    return b64;
  } catch (err) {
    throw new Error("Failed to generate image (base64)", { cause: err });
  }
};

export const generateData = async <T extends ResponseFormatTextConfig>({
  input,
  instructions,
  format,
}: {
  input: string;
  instructions: string;
  format: T;
}): Promise<
  NonNullable<
    ParsedResponse<
      ExtractParsedContentFromParams<{
        input: string;
        instructions: string;
        model: "gpt-5-mini";
        text: { format: T };
      }>
    >["output_parsed"]
  >
> => {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  try {
    const response = await openai.responses.parse({
      input,
      instructions,
      model: "gpt-5-mini",
      text: { format },
    });

    if (!response?.output_parsed) {
      throw new Error("No parsed data returned.");
    }
    return response.output_parsed;
  } catch (err) {
    throw new Error("Failed to generate data", { cause: err });
  }
};

interface BatchRequest {
  custom_id: string;
  method: string;
  url: string;
  body: Record<string, unknown>;
}

// This function will be used in Task 3 (generateDataAndImageBatch method)
// @ts-expect-error - TS6133: Function will be used in upcoming task
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const createBatchJsonl = (requests: BatchRequest[]): string =>
  requests.map((req) => JSON.stringify(req)).join("\n");

// This function will be used in Task 3 (generateDataAndImageBatch method)
// @ts-expect-error - TS6133: Function will be used in upcoming task
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const pollBatchUntilComplete = async (
  openai: OpenAI,
  batchId: string,
  options: { maxPollTimeMs?: number; pollIntervalMs?: number } = {},
): Promise<string> => {
  const maxPollTimeMs = options.maxPollTimeMs ?? 5 * 60 * 1000;
  const pollIntervalMs = options.pollIntervalMs ?? 10 * 1000;
  const startTime = Date.now();

  while (Date.now() - startTime < maxPollTimeMs) {
    // eslint-disable-next-line no-await-in-loop
    const batch = await openai.batches.retrieve(batchId);

    // Terminal status: success
    if (batch.status === "completed") {
      if (!batch.output_file_id) {
        throw new Error("Batch completed but no output file ID");
      }
      return batch.output_file_id;
    }

    // Terminal statuses: errors
    if (batch.status === "failed") {
      const errors = batch.errors
        ? JSON.stringify(batch.errors)
        : "Unknown error";
      throw new Error(`Batch failed: ${errors}`);
    }

    if (batch.status === "expired") {
      throw new Error("Batch expired before completion");
    }

    if (batch.status === "cancelled") {
      throw new Error("Batch was cancelled");
    }

    // Non-terminal statuses: validating, in_progress, cancelling
    // Continue polling for these states

    // eslint-disable-next-line no-await-in-loop
    await sleep(pollIntervalMs);
  }

  throw new Error("Batch timeout - taking longer than expected");
};
