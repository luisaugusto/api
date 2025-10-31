import type {
  ParsedResponse,
  ResponseFormatTextConfig,
} from "openai/resources/responses/responses.mjs";
import type { ExtractParsedContentFromParams } from "openai/lib/ResponsesParser.mjs";
import OpenAI from "openai";

export const generateImage = async (prompt: string): Promise<string> => {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const imageResult = await openai.images.generate({
      model: "gpt-image-1",
      prompt,
      size: "256x256",
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
  ParsedResponse<
    NonNullable<
      ExtractParsedContentFromParams<{
        input: string;
        instructions: string;
        model: "gpt-5";
        text: { format: T };
      }>
    >
  >["output_parsed"]
> => {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const response = await openai.responses.parse({
      input,
      instructions,
      model: "gpt-5",
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
