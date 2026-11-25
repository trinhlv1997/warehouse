import { useTranslation } from "react-i18next";
import type { CapacityStatus, ExpiryStatus } from "@/shared/constants";
import { Badge, type BadgeVariant } from "./ui/badge";

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  ACTIVE: "success",
  INACTIVE: "muted",
  ARCHIVED: "muted",
  AVAILABLE: "success",
  QUARANTINE: "warning",
  BLOCKED: "danger",
  DRAFT: "muted",
  CONFIRMED: "success",
  CANCELLED: "danger",
  COUNTING: "default",
  SUBMITTED: "warning",
  APPROVED: "success",
};

export function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  return <Badge variant={STATUS_VARIANT[status] ?? "muted"}>{t(`status.${status}`, { defaultValue: status })}</Badge>;
}

export const EXPIRY_VARIANT: Record<ExpiryStatus, BadgeVariant> = {
  EXPIRED: "danger",
  CRITICAL: "danger",
  WARNING: "warning",
  NOTICE: "caution",
  SAFE: "success",
  NO_EXPIRY: "muted",
};

export const EXPIRY_COLOR: Record<ExpiryStatus, string> = {
  EXPIRED: "#b91c1c",
  CRITICAL: "#ef4444",
  WARNING: "#f97316",
  NOTICE: "#eab308",
  SAFE: "#16a34a",
  NO_EXPIRY: "#94a3b8",
};

export function ExpiryBadge({ status, days }: { status: ExpiryStatus; days?: number | null }) {
  const { t } = useTranslation();
  let label = t(`expiry.${status}`);
  if (days !== null && days !== undefined && status !== "NO_EXPIRY") {
    label = days > 0 ? t("expiry.daysLeft", { count: days }) : days === 0 ? t("expiry.expiresToday") : t("expiry.expiredAgo", { count: -days });
  }
  return (
    <Badge variant={EXPIRY_VARIANT[status]} title={t(`expiry.${status}`)}>
      {label}
    </Badge>
  );
}

export const CAPACITY_VARIANT: Record<CapacityStatus, BadgeVariant> = {
  AVAILABLE: "success",
  NEAR_CAPACITY: "caution",
  FULL: "danger",
  INACTIVE: "muted",
};

export const CAPACITY_STYLE: Record<CapacityStatus, { bg: string; border: string; text: string; fill: string }> = {
  AVAILABLE: { bg: "bg-green-50", border: "border-green-300", text: "text-green-800", fill: "#22c55e" },
  NEAR_CAPACITY: { bg: "bg-yellow-50", border: "border-yellow-400", text: "text-yellow-800", fill: "#eab308" },
  FULL: { bg: "bg-red-50", border: "border-red-400", text: "text-red-800", fill: "#ef4444" },
  INACTIVE: { bg: "bg-slate-100", border: "border-slate-300", text: "text-slate-500", fill: "#94a3b8" },
};

export function CapacityBadge({ status }: { status: CapacityStatus }) {
  const { t } = useTranslation();
  return <Badge variant={CAPACITY_VARIANT[status]}>{t(`capacity.${status}`)}</Badge>;
}

export function capacityTone(status: CapacityStatus): "success" | "caution" | "danger" | "muted" {
  return status === "AVAILABLE" ? "success" : status === "NEAR_CAPACITY" ? "caution" : status === "FULL" ? "danger" : "muted";
}
