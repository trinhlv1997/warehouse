// Table of contents + anchors for the in-app user guide (markdown ## / ### headings).

/** Diacritic-insensitive key: "Kiểm kê" -> "kiem ke". */
export function fold(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
}

export function slugify(text: string): string {
  return fold(text)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

interface TocEntry {
  level: 2 | 3;
  title: string;
  slug: string;
  /** Plain text of the heading's own section, for search. */
  body: string;
}

/** Headings (## / ###) and the text under each, in document order. */
export function buildToc(markdown: string): TocEntry[] {
  const entries: TocEntry[] = [];
  let current: TocEntry | null = null;
  for (const line of markdown.split("\n")) {
    const match = /^(#{2,3})\s+(.*)$/.exec(line);
    if (match) {
      current = { level: match[1].length as 2 | 3, title: match[2].trim(), slug: slugify(match[2]), body: "" };
      entries.push(current);
    } else if (current) {
      current.body += `${line}\n`;
    }
  }
  return entries;
}
