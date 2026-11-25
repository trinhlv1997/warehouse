import { AlarmClock, Hourglass, PackageX } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useParams } from "react-router";
import type { InventoryPositionDto, RackDto, TenantSettingsDto, ZoneDto } from "@/shared/types";
import { FilterBar, PageHeader, SearchInput } from "../../components/common";
import { Card } from "../../components/ui/card";
import { Input, Select } from "../../components/ui/form";
import { LoadingBlock, Pagination } from "../../components/ui/misc";
import { useApiQuery, useDebounced, usePagedQuery } from "../../hooks/useApi";
import { formatNumber } from "../../utils/format";
import { PositionsTable } from "../catalog/ProductDetailPage";

const TYPES = ["expiring", "expired", "slow-moving"] as const;
type AlertType = (typeof TYPES)[number];

export function AlertsPage() {
  const { t } = useTranslation();
  const { type } = useParams();
  const [search, setSearch] = React.useState("");
  const [zoneId, setZoneId] = React.useState("");
  const [rackId, setRackId] = React.useState("");
  const [expiryStatus, setExpiryStatus] = React.useState("");
  const [expFrom, setExpFrom] = React.useState("");
  const [expTo, setExpTo] = React.useState("");
  const [page, setPage] = React.useState(1);
  const debounced = useDebounced(search);
  React.useEffect(() => setPage(1), [type, debounced, zoneId, rackId, expiryStatus, expFrom, expTo]);
  const { data: zones = [] } = useApiQuery<ZoneDto[]>(["zones"], "/api/zones");
  const { data: racks = [] } = useApiQuery<RackDto[]>(["racks"], "/api/racks", { zoneId }, !!zoneId);
  const { data: settings } = useApiQuery<TenantSettingsDto>(["settings"], "/api/settings");
  const valid = (TYPES as readonly string[]).includes(type ?? "");
  const { data, isLoading } = usePagedQuery<InventoryPositionDto>(
    ["alerts", type],
    `/api/alerts/${type}`,
    { search: debounced, zoneId, rackId, expiryStatus: type === "expiring" ? expiryStatus : "", expFrom, expTo, page, pageSize: 25 },
    valid,
  );
  if (!valid) return <Navigate to="/alerts/expiring" replace />;
  const alertType = type as AlertType;
  const total = data?.items.reduce((s, p) => s + p.quantity, 0) ?? 0;

  const header = {
    expiring: { title: t("alerts.expiringTitle"), subtitle: t("alerts.expiringSubtitle"), icon: <AlarmClock /> },
    expired: { title: t("alerts.expiredTitle"), subtitle: t("alerts.expiredSubtitle"), icon: <PackageX /> },
    "slow-moving": { title: t("alerts.slowTitle"), subtitle: t("alerts.slowSubtitle", { days: settings?.slowMovingDays ?? 90 }), icon: <Hourglass /> },
  }[alertType];

  return (
    <div>
      <PageHeader title={header.title} subtitle={header.subtitle} icon={header.icon} />
      <Card>
        <FilterBar>
          <SearchInput value={search} onChange={setSearch} />
          <Select
            value={zoneId}
            onChange={(e) => {
              setZoneId(e.target.value);
              setRackId("");
            }}
            className="sm:w-44"
          >
            <option value="">{t("common.zone")}: {t("common.all")}</option>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.code} · {z.name}
              </option>
            ))}
          </Select>
          <Select value={rackId} onChange={(e) => setRackId(e.target.value)} className="sm:w-32" disabled={!zoneId}>
            <option value="">{t("common.rack")}: {t("common.all")}</option>
            {racks.map((r) => (
              <option key={r.id} value={r.id}>
                {r.code}
              </option>
            ))}
          </Select>
          {alertType === "expiring" && (
            <Select value={expiryStatus} onChange={(e) => setExpiryStatus(e.target.value)} className="sm:w-56">
              <option value="">{t("alerts.bucket")}: {t("common.all")}</option>
              {(["CRITICAL", "WARNING", "NOTICE"] as const).map((s) => (
                <option key={s} value={s}>
                  {t(`expiry.${s}`)}
                </option>
              ))}
            </Select>
          )}
          {alertType !== "slow-moving" && (
            <>
              <label className="flex items-center gap-2 text-sm">
                {t("common.from")}
                <Input type="date" value={expFrom} onChange={(e) => setExpFrom(e.target.value)} className="w-40" />
              </label>
              <label className="flex items-center gap-2 text-sm">
                {t("common.to")}
                <Input type="date" value={expTo} onChange={(e) => setExpTo(e.target.value)} className="w-40" />
              </label>
            </>
          )}
          {data && (
            <span className="text-sm text-muted-foreground sm:ml-auto">
              {t("reports.summary", { quantity: formatNumber(total) })}
            </span>
          )}
        </FilterBar>
        {isLoading ? <LoadingBlock /> : <PositionsTable items={data?.items ?? []} />}
        <Pagination meta={data?.meta} onPageChange={setPage} />
      </Card>
    </div>
  );
}
