import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildToc, slugify } from "@/frontend/utils/guideToc";

const guide = readFileSync(join(process.cwd(), "src/frontend/content/user-guide.vi.md"), "utf8");

describe("in-app user guide", () => {
  it("has the 15 chapters in order with unique anchors", () => {
    const toc = buildToc(guide);
    const chapters = toc.filter((e) => e.level === 2).map((e) => e.title);
    expect(chapters).toHaveLength(15);
    expect(chapters[0]).toMatch(/^1\. Giới thiệu/);
    expect(chapters[14]).toMatch(/^15\. Phụ lục/);
    const slugs = toc.map((e) => e.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("makes ASCII anchors from Vietnamese headings", () => {
    expect(slugify("7. Xuất kho theo FEFO")).toBe("7-xuat-kho-theo-fefo");
    expect(slugify("Đăng nhập")).toBe("dang-nhap");
  });

  it("only references images that ship with the app", () => {
    const images = [...guide.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map((m) => m[1]);
    expect(images.length).toBeGreaterThan(0);
    for (const src of images) expect(existsSync(join(process.cwd(), "public", src))).toBe(true);
    expect(guide).not.toMatch(/embedded content/);
  });
});
