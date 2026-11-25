import * as TabsPrimitive from "@radix-ui/react-tabs";
import { ChevronLeft, ChevronRight, Inbox, Loader2 } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";
import type { PageMeta } from "@/shared/types";
import { cn } from "../../utils/cn";
import { formatNumber } from "../../utils/format";
import { Button } from "./button";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-slate-200/70", className)} />;
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("size-5 animate-spin text-primary", className)} />;
}

export function LoadingBlock({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-8 w-full" />
      ))}
    </div>
  );
}

export function EmptyState({ title, description, icon }: { title?: string; description?: string; icon?: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
      <div className="rounded-full bg-muted p-3 text-muted-foreground">{icon ?? <Inbox className="size-6" />}</div>
      <p className="font-medium">{title ?? t("common.noData")}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}

export function Pagination({ meta, onPageChange }: { meta?: PageMeta; onPageChange: (page: number) => void }) {
  const { t } = useTranslation();
  if (!meta) return null;
  return (
    <div className="flex items-center justify-between gap-3 border-t px-4 py-3 text-sm">
      <span className="text-muted-foreground">{t("common.showing", { total: formatNumber(meta.total) })}</span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon-sm" disabled={meta.page <= 1} onClick={() => onPageChange(meta.page - 1)} aria-label={t("common.previous")}>
          <ChevronLeft />
        </Button>
        <span className="tabular-nums">{t("common.page", { page: meta.page, totalPages: meta.totalPages })}</span>
        <Button variant="outline" size="icon-sm" disabled={meta.page >= meta.totalPages} onClick={() => onPageChange(meta.page + 1)} aria-label={t("common.next")}>
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}

export const Tabs = TabsPrimitive.Root;

export function TabsList({ className, ...props }: React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List className={cn("inline-flex flex-wrap items-center gap-1 rounded-lg bg-muted p-1", className)} {...props} />;
}

export function TabsTrigger({ className, ...props }: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm cursor-pointer",
        className,
      )}
      {...props}
    />
  );
}

export const TabsContent = TabsPrimitive.Content;

export function Progress({ value, className, tone }: { value: number; className?: string; tone?: "success" | "caution" | "danger" | "muted" | "primary" }) {
  const color = { success: "bg-success", caution: "bg-caution", danger: "bg-danger", muted: "bg-slate-400", primary: "bg-primary" }[tone ?? "primary"];
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-slate-100", className)}>
      <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}
