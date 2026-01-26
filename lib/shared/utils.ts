export const slugify = (str: string): string =>
  String(str)
    .replace(/[^a-z0-9]+/giu, "-")
    .toLowerCase()
    .replace(/(?:^-|-$)/gu, "");
