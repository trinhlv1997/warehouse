import { BookOpen, Printer, Search } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import guideVi from "../../content/user-guide.vi.md?raw";
import { PageHeader } from "../../components/common";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input, Select } from "../../components/ui/form";
import { cn } from "../../utils/cn";
import { buildToc, fold, slugify } from "../../utils/guideToc";

function textOf(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) return textOf(node.props.children);
  return "";
}

const components: Components = {
  h2: ({ children }) => (
    <h2 id={slugify(textOf(children))} className="mt-10 scroll-mt-24 border-b pb-2 text-xl font-bold text-foreground first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 id={slugify(textOf(children))} className="mt-6 scroll-mt-24 text-base font-semibold text-foreground">
      {children}
    </h3>
  ),
  // an image paragraph renders a <figure>, which may not sit inside <p>
  p: ({ node, children }) =>
    node?.children.some((c) => c.type === "element" && c.tagName === "img") ? (
      <div className="my-3">{children}</div>
    ) : (
      <p className="my-3 leading-7 text-slate-700">{children}</p>
    ),
  ul: ({ children }) => <ul className="my-3 list-disc space-y-1.5 pl-6 leading-7 text-slate-700 marker:text-slate-400">{children}</ul>,
  ol: ({ children }) => <ol className="my-3 list-decimal space-y-1.5 pl-6 leading-7 text-slate-700 marker:font-semibold marker:text-primary">{children}</ol>,
  li: ({ children }) => <li className="pl-1 [&>ol]:my-1.5 [&>ul]:my-1.5">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  a: ({ href, children }) => (
    <a href={href} className="font-medium text-primary hover:underline">
      {children}
    </a>
  ),
  code: ({ children }) => <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em]">{children}</code>,
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto rounded-lg border scrollbar-thin">
      <table className="w-full text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-slate-50">{children}</thead>,
  th: ({ children }) => <th className="border-b px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</th>,
  td: ({ children }) => <td className="border-b px-3 py-2 align-top text-slate-700">{children}</td>,
  img: ({ src, alt }) => (
    <figure className="my-5">
      <img src={typeof src === "string" ? src : undefined} alt={alt ?? ""} className="w-full rounded-lg border bg-white" loading="lazy" />
      {alt && <figcaption className="mt-2 text-center text-xs text-muted-foreground">{alt}</figcaption>}
    </figure>
  ),
};

export function GuidePage() {
  const { t, i18n } = useTranslation();
  const toc = React.useMemo(() => buildToc(guideVi), []);
  const [search, setSearch] = React.useState("");
  const [active, setActive] = React.useState<string>(toc[0]?.slug ?? "");
  const term = fold(search.trim());
  const visible = term ? toc.filter((e) => fold(e.title).includes(term) || fold(e.body).includes(term)) : toc;

  // jump to the heading in the URL hash on first render (e.g. /guide#7-xuat-kho-theo-fefo)
  React.useEffect(() => {
    const hash = decodeURIComponent(window.location.hash.slice(1));
    if (hash) document.getElementById(hash)?.scrollIntoView();
  }, []);

  // highlight the section being read in the table of contents
  React.useEffect(() => {
    const headings = toc.map((e) => document.getElementById(e.slug)).filter((el): el is HTMLElement => !!el);
    const observer = new IntersectionObserver(
      (entries) => {
        const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (top) setActive(top.target.id);
      },
      { rootMargin: "-80px 0px -70% 0px" },
    );
    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [toc]);

  const go = (slug: string) => {
    document.getElementById(slug)?.scrollIntoView({ behavior: "smooth" });
    window.history.replaceState(null, "", `#${slug}`);
    setActive(slug);
  };

  return (
    <div>
      <PageHeader
        title={t("guide.title")}
        subtitle={t("guide.subtitle")}
        icon={<BookOpen />}
        actions={
          <Button variant="outline" onClick={() => window.print()} className="print:hidden">
            <Printer /> {t("guide.print")}
          </Button>
        }
      />
      {i18n.language !== "vi" && <p className="mb-4 rounded-md bg-primary-soft px-4 py-2 text-sm text-primary print:hidden">{t("guide.vietnameseOnly")}</p>}

      {/* phones: jump-to select instead of the side table of contents */}
      <div className="mb-4 lg:hidden print:hidden">
        <Select value="" onChange={(e) => e.target.value && go(e.target.value)} aria-label={t("guide.jumpTo")}>
          <option value="">{t("guide.jumpTo")}</option>
          {toc
            .filter((e) => e.level === 2)
            .map((e) => (
              <option key={e.slug} value={e.slug}>
                {e.title}
              </option>
            ))}
        </Select>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <Card className="px-5 py-6 sm:px-8 print:border-0 print:shadow-none">
          <article className="mx-auto max-w-3xl">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
              {guideVi}
            </ReactMarkdown>
          </article>
        </Card>

        <aside className="hidden lg:block print:hidden">
          <div className="sticky top-20 space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("guide.searchPlaceholder")} className="pl-8" />
            </div>
            <Card className="p-2">
              <p className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("guide.contents")}</p>
              <nav className="max-h-[calc(100vh-12rem)] overflow-y-auto scrollbar-thin">
                {visible.length === 0 && <p className="px-2 py-2 text-sm text-muted-foreground">{t("guide.noMatch")}</p>}
                {visible.map((e) => (
                  <button
                    key={e.slug}
                    onClick={() => go(e.slug)}
                    className={cn(
                      "block w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted",
                      e.level === 3 && "pl-5 text-[13px] text-muted-foreground",
                      e.level === 2 && "font-medium",
                      active === e.slug && "bg-primary-soft text-primary",
                    )}
                  >
                    {e.title}
                  </button>
                ))}
              </nav>
            </Card>
          </div>
        </aside>
      </div>
    </div>
  );
}
