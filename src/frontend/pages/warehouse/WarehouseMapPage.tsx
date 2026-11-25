import { ArrowLeft, DoorOpen, Map as MapIcon, MapPin } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";
import type { CapacityStatus } from "@/shared/constants";
import type { BinDetailDto, LevelDto, LocationSearchResultDto, RackDto, ZoneDto } from "@/shared/types";
import { PageHeader, SearchInput } from "../../components/common";
import { CAPACITY_STYLE, CapacityBadge, ExpiryBadge, StatusBadge, capacityTone } from "../../components/StatusBadge";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { EmptyState, LoadingBlock, Progress, Skeleton } from "../../components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "../../components/ui/table";
import { useApiQuery, useDebounced } from "../../hooks/useApi";
import { cn } from "../../utils/cn";
import { formatDate, formatNumber, formatPercent } from "../../utils/format";

type MapZone = ZoneDto & { racks: RackDto[] };

function Legend() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs">
      <span className="font-medium text-muted-foreground">{t("map.legend")}:</span>
      {(["AVAILABLE", "NEAR_CAPACITY", "FULL", "INACTIVE"] as CapacityStatus[]).map((s) => (
        <span key={s} className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm" style={{ background: CAPACITY_STYLE[s].fill }} />
          {t(`capacity.${s}`)}
        </span>
      ))}
    </div>
  );
}

export function BinDetailDialog({ binId, onClose }: { binId: string | null; onClose: () => void }) {
  const { t } = useTranslation();
  const { data, isLoading } = useApiQuery<BinDetailDto>(["bin", binId], `/api/bins/${binId}`, undefined, !!binId);
  return (
    <Dialog open={!!binId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <MapPin className="size-5 text-primary" />
            {t("map.binDetail", { code: data?.locationCode ?? "" })}
            {data && <CapacityBadge status={data.capacityStatus} />}
          </DialogTitle>
        </DialogHeader>
        <DialogBody>
          {isLoading || !data ? (
            <LoadingBlock rows={4} />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  [t("common.zone"), `${data.zoneCode} · ${data.zoneName}`],
                  [t("common.rack"), data.rackCode],
                  [t("common.level"), data.levelCode],
                  [t("common.bin"), data.code],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-muted p-2.5">
                    <p className="text-xs text-muted-foreground">{k}</p>
                    <p className="truncate text-sm font-semibold">{v}</p>
                  </div>
                ))}
              </div>
              <div>
                <div className="mb-1 flex justify-between text-sm">
                  <span>
                    {t("common.used")}: <b>{formatNumber(data.used)}</b> / {formatNumber(data.capacity)}
                  </span>
                  <span className="font-semibold">{formatPercent(data.utilization)}</span>
                </div>
                <Progress value={data.utilization} tone={capacityTone(data.capacityStatus)} />
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold">{t("map.lotsInBin")}</p>
                {data.positions.length === 0 ? (
                  <EmptyState title={t("map.emptyBin")} />
                ) : (
                  <div className="rounded-lg border">
                    <Table>
                      <THead>
                        <TR>
                          <TH>{t("common.product")}</TH>
                          <TH>{t("common.lot")}</TH>
                          <TH>{t("common.expirationDate")}</TH>
                          <TH>{t("common.status")}</TH>
                          <TH className="text-right">{t("common.quantity")}</TH>
                        </TR>
                      </THead>
                      <TBody>
                        {data.positions.map((p) => (
                          <TR key={p.balanceId}>
                            <TD>
                              <p className="font-medium">{p.productSku}</p>
                              <p className="text-xs text-muted-foreground">{p.productName}</p>
                            </TD>
                            <TD className="font-mono text-xs">{p.lotNumber}</TD>
                            <TD>
                              <div className="flex flex-col items-start gap-1">
                                <span className="text-xs">{formatDate(p.expirationDate)}</span>
                                <ExpiryBadge status={p.expiryStatus} days={p.daysToExpiry} />
                              </div>
                            </TD>
                            <TD>
                              <StatusBadge status={p.lotStatus} />
                            </TD>
                            <TD className="text-right tabular-nums">
                              {formatNumber(p.quantity)} {p.unit}
                            </TD>
                          </TR>
                        ))}
                      </TBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

function ZoneMap({ zones, selectedZone, highlight, onSelect }: { zones: MapZone[]; selectedZone: string | null; highlight: Set<string>; onSelect: (id: string) => void }) {
  const { t } = useTranslation();
  return (
    <div className="relative w-full overflow-hidden rounded-lg border-2 border-slate-300 bg-[repeating-linear-gradient(0deg,#f8fafc,#f8fafc_19px,#eef2f7_20px),repeating-linear-gradient(90deg,#f8fafc,#f8fafc_19px,#eef2f7_20px)]" style={{ aspectRatio: "100 / 62" }}>
      {zones.map((z) => {
        const style = CAPACITY_STYLE[z.capacityStatus];
        const isSelected = z.id === selectedZone;
        return (
          <button
            key={z.id}
            onClick={() => onSelect(z.id)}
            className={cn(
              "absolute flex flex-col overflow-hidden rounded-md border-2 p-1.5 text-left shadow-sm transition hover:shadow-md sm:p-2",
              style.bg,
              style.border,
              isSelected && "ring-4 ring-primary/40",
              highlight.has(z.id) && "animate-pulse ring-4 ring-primary",
            )}
            style={{ left: `${z.mapX}%`, top: `${(z.mapY / 62) * 100}%`, width: `${z.mapWidth}%`, height: `${(z.mapHeight / 62) * 100}%` }}
          >
            <div className="flex items-start justify-between gap-1">
              <span className={cn("text-[11px] font-bold leading-tight sm:text-sm", style.text)}>
                {z.code}
                <span className="hidden font-medium md:inline"> · {z.name.replace(/^Khu [A-Z] - /, "")}</span>
              </span>
              <span className={cn("text-[10px] font-semibold sm:text-xs", style.text)}>{formatPercent(z.utilization)}</span>
            </div>
            <div className="mt-1 hidden flex-1 gap-1 sm:flex">
              {z.racks.map((r) => (
                <div key={r.id} className="flex flex-1 flex-col justify-end rounded-sm border border-white/70 bg-white/60" title={`${r.code}: ${formatPercent(r.utilization)}`}>
                  <div className="rounded-sm" style={{ height: `${Math.max(4, Math.min(100, r.utilization))}%`, background: CAPACITY_STYLE[r.capacityStatus].fill, opacity: 0.85 }} />
                </div>
              ))}
            </div>
            <span className="mt-0.5 hidden text-[10px] text-muted-foreground lg:block">
              {t("map.racks", { count: z.rackCount })} · {t("map.bins", { count: z.binCount })}
            </span>
          </button>
        );
      })}
      <div className="absolute bottom-0 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-t-md bg-sidebar px-3 py-0.5 text-[10px] text-white sm:text-xs">
        <DoorOpen className="size-3.5" />
        {t("map.entrance")}
      </div>
    </div>
  );
}

function RackLayout({ rackId, highlight, onBin }: { rackId: string; highlight: Set<string>; onBin: (id: string) => void }) {
  const { t } = useTranslation();
  const { data, isLoading } = useApiQuery<{ rack: RackDto; levels: LevelDto[] }>(["rack-layout", rackId], `/api/racks/${rackId}/layout`);
  if (isLoading || !data) return <LoadingBlock rows={4} />;
  return (
    <div className="space-y-2">
      {data.levels.map((level) => (
        <div key={level.id} className="flex items-stretch gap-2">
          <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-md bg-sidebar text-white">
            <span className="text-xs font-bold">{level.code}</span>
            <span className="text-[10px] opacity-75">{formatPercent(level.utilization)}</span>
          </div>
          <div className="grid flex-1 gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.max(1, level.bins.length)}, minmax(0, 1fr))` }}>
            {level.bins.map((b) => {
              const s = CAPACITY_STYLE[b.capacityStatus];
              return (
                <button
                  key={b.id}
                  onClick={() => onBin(b.id)}
                  title={`${b.locationCode}\n${formatNumber(b.used)}/${formatNumber(b.capacity)}`}
                  className={cn("flex min-h-16 flex-col justify-between rounded-md border-2 p-1.5 text-left transition hover:scale-[1.03] hover:shadow", s.bg, s.border, highlight.has(b.id) && "ring-4 ring-primary animate-pulse")}
                >
                  <span className={cn("text-xs font-bold", s.text)}>{b.code}</span>
                  <span className="text-[10px] text-slate-600">
                    {formatNumber(b.used)}/{formatNumber(b.capacity)}
                  </span>
                  <div className="h-1 w-full overflow-hidden rounded bg-white">
                    <div className="h-full" style={{ width: `${Math.min(100, b.utilization)}%`, background: s.fill }} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <p className="text-xs text-muted-foreground">{t("racks.layout")}: {data.rack.zoneCode}-{data.rack.code}</p>
    </div>
  );
}

export function WarehouseMapPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const zoneId = params.get("zone");
  const rackId = params.get("rack");
  const [binId, setBinId] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const debounced = useDebounced(search.trim(), 350);

  const { data, isLoading } = useApiQuery<{ zones: MapZone[] }>(["warehouse-map"], "/api/warehouse-map");
  const { data: results = [] } = useApiQuery<LocationSearchResultDto[]>(["location-search", debounced], "/api/inventory/locations", { search: debounced }, debounced.length >= 2);

  const highlight = React.useMemo(() => new Set(results.flatMap((r) => [r.zoneId, r.rackId, r.binId])), [results]);
  const zone = data?.zones.find((z) => z.id === zoneId) ?? null;
  const rack = zone?.racks.find((r) => r.id === rackId) ?? null;

  const select = (next: { zone?: string | null; rack?: string | null }) => {
    const p = new URLSearchParams(params);
    for (const key of ["zone", "rack"] as const) {
      const value = next[key];
      if (value === undefined) continue;
      if (value) p.set(key, value);
      else p.delete(key);
    }
    setParams(p, { replace: true });
  };

  return (
    <div className="space-y-4">
      <PageHeader title={t("map.title")} subtitle={t("map.subtitle")} icon={<MapIcon />} actions={<SearchInput value={search} onChange={setSearch} placeholder={t("map.searchPlaceholder")} className="sm:w-96" />} />

      {debounced.length >= 2 && (
        <Card>
          <CardContent className="pt-4">
            <p className="mb-2 text-sm font-medium">{t("map.found", { count: results.length })}</p>
            <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto">
              {results.map((r) => (
                <button
                  key={`${r.binId}-${r.lotNumber}`}
                  className="rounded-md border bg-white px-2 py-1 text-left text-xs hover:border-primary hover:bg-primary-soft"
                  onClick={() => {
                    select({ zone: r.zoneId, rack: r.rackId });
                    setBinId(r.binId);
                  }}
                >
                  <span className="font-mono font-semibold">{r.locationCode}</span> · {r.productSku} · {r.lotNumber} · <b>{formatNumber(r.quantity)}</b>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader className="flex-col sm:flex-row sm:items-center">
            <CardTitle>{data?.zones.length ? `WH001 · ${t("nav.warehouseMap")}` : t("nav.warehouseMap")}</CardTitle>
            <Legend />
          </CardHeader>
          <CardContent>{isLoading || !data ? <Skeleton className="aspect-[100/62] w-full" /> : <ZoneMap zones={data.zones} selectedZone={zoneId} highlight={highlight} onSelect={(id) => select({ zone: id, rack: null })} />}</CardContent>
        </Card>

        <Card className="xl:col-span-2">
          {!zone ? (
            <EmptyState title={t("map.selectZone")} icon={<MapIcon className="size-6" />} />
          ) : !rack ? (
            <>
              <CardHeader>
                <div>
                  <CardTitle>{zone.name}</CardTitle>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">{t(`zoneType.${zone.zoneType}`)}</Badge>
                    {formatNumber(zone.used)} / {formatNumber(zone.capacity)} · {formatPercent(zone.utilization)}
                  </p>
                </div>
                <CapacityBadge status={zone.capacityStatus} />
              </CardHeader>
              <CardContent className="grid gap-2 sm:grid-cols-2">
                {zone.racks.map((r) => (
                  <button key={r.id} onClick={() => select({ rack: r.id })} className={cn("rounded-lg border-2 p-3 text-left transition hover:shadow-md", CAPACITY_STYLE[r.capacityStatus].bg, CAPACITY_STYLE[r.capacityStatus].border, highlight.has(r.id) && "ring-4 ring-primary")}>
                    <div className="flex items-center justify-between">
                      <span className="font-bold">{r.name}</span>
                      <span className="text-sm font-semibold">{formatPercent(r.utilization)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {r.levelCount} {t("map.levels").toLowerCase()} · {t("map.bins", { count: r.binCount })}
                    </p>
                    <Progress value={r.utilization} tone={capacityTone(r.capacityStatus)} className="mt-2" />
                  </button>
                ))}
                {zone.racks.length === 0 && <EmptyState />}
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon-sm" onClick={() => select({ rack: null })} aria-label={t("common.back")}>
                    <ArrowLeft />
                  </Button>
                  <div>
                    <CardTitle>
                      {zone.code} › {rack.name}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {formatNumber(rack.used)} / {formatNumber(rack.capacity)} · {formatPercent(rack.utilization)}
                    </p>
                  </div>
                </div>
                <CapacityBadge status={rack.capacityStatus} />
              </CardHeader>
              <CardContent>
                <RackLayout rackId={rack.id} highlight={highlight} onBin={setBinId} />
              </CardContent>
            </>
          )}
        </Card>
      </div>
      <BinDetailDialog binId={binId} onClose={() => setBinId(null)} />
    </div>
  );
}
