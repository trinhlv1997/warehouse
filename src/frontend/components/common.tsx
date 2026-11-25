import { Search } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../utils/cn";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/form";

export function PageHeader({ title, subtitle, actions, icon }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-center gap-3">
        {icon && <div className="hidden rounded-lg bg-primary-soft p-2.5 text-primary sm:block">{icon}</div>}
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder, className }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  const { t } = useTranslation();
  return (
    <div className={cn("relative w-full sm:w-72", className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder ?? t("common.searchPlaceholder")} className="pl-8" />
    </div>
  );
}

export function FilterBar({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex flex-col gap-2 border-b p-3 sm:flex-row sm:flex-wrap sm:items-center", className)}>{children}</div>;
}

export function KpiCard({ label, value, sub, icon, tone = "primary", onClick }: { label: string; value: React.ReactNode; sub?: React.ReactNode; icon: React.ReactNode; tone?: "primary" | "success" | "warning" | "danger" | "navy"; onClick?: () => void }) {
  const toneClass = {
    primary: "bg-primary-soft text-primary",
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
    danger: "bg-danger-soft text-danger",
    navy: "bg-slate-100 text-sidebar",
  }[tone];
  return (
    <Card className={cn("p-4", onClick && "cursor-pointer transition hover:shadow-md")} onClick={onClick}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
        </div>
        <div className={cn("rounded-lg p-2.5 [&_svg]:size-5", toneClass)}>{icon}</div>
      </div>
    </Card>
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  loading,
  variant = "default",
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
  loading?: boolean;
  variant?: "default" | "destructive" | "success";
  children?: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
          {children}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button variant={variant} loading={loading} onClick={onConfirm}>
            {confirmLabel ?? t("common.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  );
}
