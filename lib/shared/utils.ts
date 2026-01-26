import type { VercelRequestQuery, VercelResponse } from "@vercel/node";

export const slugify = (str: string): string =>
  String(str)
    .replace(/[^a-z0-9]+/giu, "-")
    .toLowerCase()
    .replace(/(?:^-|-$)/gu, "");

export const setResponse = ({
  status,
  message,
  error,
  res,
}: {
  status: number;
  message: string;
  error: unknown;
  res: VercelResponse;
}): void => {
  // eslint-disable-next-line no-console
  console.error(message, error);
  res.status(status);
};

export const verifyParam = (
  res: VercelResponse,
  param?: VercelRequestQuery[number],
  message = "Missing required parameter",
): string => {
  if (!param) {
    setResponse({
      error: null,
      message,
      res,
      status: 400,
    });
    throw new Error(message);
  }

  return String(param);
};
