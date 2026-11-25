import { BarChart3, FileSpreadsheet } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { ReportDto, ZoneDto } from "@/shared/types";
import { FilterBar, PageHeader } from "../../components/common";
import { ExpiryBadge, StatusBadge } from "../../components/StatusBadge";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input, Select } from "../../components/ui/form";
import { EmptyState, LoadingBlock } from "../../components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "../../components/ui/table";
import { useApiQuery } from "../../hooks/useApi";
import { useAuth } from "../../hooks/useAuth";
import { downloadReportExcel, reportFileName } from "../../utils/excel/reportExcel";
import { cn } from "../../utils/cn";
import { addDaysIso, formatDate, formatNumber, todayVn } from "../../utils/format";
import type { ExpiryStatus } from "@/shared/constants";

const REPORT_TYPES = ["inventory", "product", "lot", "location", "receipts", "issues", "expiring", "expired", "transfers", "stocktaking"] as const;
type ReportType = (typeof REPORT_TYPES)[number];
const DATE_RANGE_REPORTS: ReportType[] = ["receipts", "issues", "transfers", "stocktaking"];
const MAX_RENDERED_ROWS = 500;

export function ReportsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [type, setType] = React.useState<ReportType>("inventory");
  const [from, setFrom] = React.useState(addDaysIso(todayVn(), -30));
  const [to, setTo] = React.useState(todayVn());
  const [zoneId, setZoneId] = React.useState("");
  const [downloading, setDownloading] = React.useState(false);
  const { data: zones = [] } = useApiQuery<ZoneDto[]>(["zones"], "/api/zones");
  const usesDates = DATE_RANGE_REPORTS.includes(type);
  const query = { from: usesDates ? from : "", to: usesDates ? to : "", zoneId: usesDates ? "" : zoneId };
  const { data, isLoading } = useApiQuery<ReportDto>(["report", type], `/api/reports/${type}`, query);

  const exportExcel = async () => {
    if (!data) return;
    setDownloading(true);
    try {
      const title = t(`reports.types.${type}`);
      const zone = zones.find((z) => z.id === zoneId);
      const scope = usesDates
        ? t("reports.excel.period", { from: formatDate(from), to: formatDate(to) })
        : ["inventory", "location", "expiring", "expired"].includes(type)
          ? `${t("reports.excel.zone", { zone: zone ? `${zone.code} - ${zone.name}` : t("reports.excel.allZones") })} · ${t("reports.excel.asOf", { date: formatDate(todayVn()) })}`
          : t("reports.excel.asOf", { date: formatDate(todayVn()) });
      await downloadReportExcel(
        data,
        title,
        { companyName: user?.tenantName ?? "", scope, exportedBy: user?.fullName ?? "", exportedAt: new Date() },
        (key, options) => String(t(key, options as never)),
        reportFileName(title, todayVn()),
      );
      toast.success(t("reports.excel.done"));
    } catch (e) {
      console.error(e);
      toast.error(t("errors.excel"));
    } finally {
      setDownloading(false);
    }
  };

  const renderCell = (value: unknown, kind?: string, key?: string) => {
    if (value === null || value === undefined || value === "") return "—";
    if (key === "expiryStatus") return <ExpiryBadge status={value as ExpiryStatus} />;
    if (key === "reason") return t(`issueReason.${value}`, { defaultValue: String(value) });
    if (kind === "status") return <StatusBadge status={String(value)} />;
    if (kind === "date") return formatDate(String(value));
    if (kind === "number") {
      const n = Number(value);
      return <span className={cn("tabular-nums", key === "difference" && n !== 0 && (n > 0 ? "text-success" : "text-danger"))}>{formatNumber(n, 1)}</span>;
    }
    return String(value);
  };

  return (
    <div className="space-y-4">
      <PageHeader title={t("reports.title")} subtitle={t("reports.subtitle")} icon={<BarChart3 />} />
      <div className="flex flex-wrap gap-2">
        {REPORT_TYPES.map((r) => (
          <button
            key={r}
            onClick={() => setType(r)}
            className={cn("flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition", type === r ? "border-primary bg-primary text-white shadow-sm" : "bg-white hover:border-primary hover:text-primary")}
          >
            <FileSpreadsheet className="size-4" />
            {t(`reports.types.${r}`)}
          </button>
        ))}
      </div>
      <Card>
        <FilterBar>
          <p className="font-semibold">{t(`reports.types.${type}`)}</p>
          {usesDates ? (
            <>
              <label className="flex items-center gap-2 text-sm">
                {t("common.from")}
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
              </label>
              <label className="flex items-center gap-2 text-sm">
                {t("common.to")}
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
              </label>
            </>
          ) : (
            ["inventory", "location", "expiring", "expired"].includes(type) && (
              <Select value={zoneId} onChange={(e) => setZoneId(e.target.value)} className="sm:w-56">
                <option value="">{t("common.zone")}: {t("common.all")}</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.code} · {z.name}
                  </option>
                ))}
              </Select>
            )
          )}
          <div className="flex items-center gap-3 sm:ml-auto">
            {data && (
              <span className="text-sm text-muted-foreground">
                {t("reports.rows", { count: data.rows.length })}
                {data.summary?.quantity !== undefined && ` · ${t("reports.summary", { quantity: formatNumber(data.summary.quantity) })}`}
              </span>
            )}
            <Button variant="success" onClick={exportExcel} loading={downloading} disabled={!data?.rows.length}>
              {!downloading && <FileSpreadsheet />} {downloading ? t("reports.excel.exporting") : t("common.exportExcel")}
            </Button>
          </div>
        </FilterBar>
        {isLoading ? (
          <LoadingBlock rows={8} />
        ) : !data?.rows.length ? (
          <EmptyState />
        ) : (
          <Table>
            <THead>
              <TR>
                {data.columns.map((c) => (
                  <TH key={c.key} className={c.type === "number" ? "text-right" : undefined}>
                    {t(`reports.columns.${c.label}`, { defaultValue: c.label })}
                  </TH>
                ))}
              </TR>
            </THead>
            <TBody>
              {data.rows.slice(0, MAX_RENDERED_ROWS).map((row, i) => (
                <TR key={i}>
                  {data.columns.map((c) => (
                    <TD key={c.key} className={cn("text-sm", c.type === "number" && "text-right", ["sku", "lotNumber", "locationCode", "documentNumber", "fromLocation", "toLocation"].includes(c.key) && "font-mono text-xs")}>
                      {renderCell(row[c.key], c.type, c.key)}
                    </TD>
                  ))}
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
