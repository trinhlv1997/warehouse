import { Eye, Pencil, Warehouse } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { ACTIVE_STATUSES } from "@/shared/constants";
import type { BinDto, RackDto, WarehouseDto, ZoneDto } from "@/shared/types";
import { FilterBar, PageHeader, SearchInput } from "../../components/common";
import { CapacityBadge, StatusBadge, capacityTone } from "../../components/StatusBadge";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Field, Input, Select } from "../../components/ui/form";
import { EmptyState, LoadingBlock, Pagination, Progress } from "../../components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "../../components/ui/table";
import { useApiMutation, useApiQuery, useDebounced, usePagedQuery } from "../../hooks/useApi";
import { useAuth } from "../../hooks/useAuth";
import { api } from "../../services/api";
import { formatNumber, formatPercent } from "../../utils/format";
import { BinDetailDialog } from "./WarehouseMapPage";

type BinRow = BinDto & { zoneCode: string; rackCode: string; levelCode: string };

function EditBinDialog({ bin, onClose }: { bin: BinRow | null; onClose: () => void }) {
  const { t } = useTranslation();
  const [capacity, setCapacity] = React.useState(0);
  const [status, setStatus] = React.useState("ACTIVE");
  React.useEffect(() => {
    if (bin) {
      setCapacity(bin.capacity);
      setStatus(bin.status);
    }
  }, [bin]);
  const save = useApiMutation(() => api.put(`/api/bins/${bin!.id}`, { capacity, status }), { invalidate: [["bins"], ["warehouse-map"], ["zones"]], success: t("common.saved"), onSuccess: onClose });
  const invalid = !!bin && capacity < bin.used;
  return (
    <Dialog open={!!bin} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>
            {t("bins.edit")} <span className="font-mono">{bin?.locationCode}</span>
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <Field label={t("common.capacity")} error={invalid ? "invalid" : undefined} hint={`${t("common.used")}: ${formatNumber(bin?.used ?? 0)}`}>
            <Input type="number" min={0} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} aria-invalid={invalid} />
          </Field>
          {invalid && <p className="text-xs text-danger">{t("bins.capacityBelowUsed")}</p>}
          <Field label={t("common.status")}>
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              {ACTIVE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`status.${s}`)}
                </option>
              ))}
            </Select>
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => save.mutate(undefined)} loading={save.isPending} disabled={invalid}>
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function BinsPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const [search, setSearch] = React.useState("");
  const [zoneId, setZoneId] = React.useState("");
  const [rackId, setRackId] = React.useState("");
  const [occupancy, setOccupancy] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [page, setPage] = React.useState(1);
  const debounced = useDebounced(search);
  React.useEffect(() => setPage(1), [debounced, zoneId, rackId, occupancy, status]);

  const { data: zones = [] } = useApiQuery<ZoneDto[]>(["zones"], "/api/zones");
  const { data: warehouses } = useApiQuery<WarehouseDto[]>(["warehouses"], "/api/warehouses");
  const { data: racks = [] } = useApiQuery<RackDto[]>(["racks"], "/api/racks", { zoneId }, !!zoneId);
  const { data, isLoading } = usePagedQuery<BinRow>(["bins"], "/api/bins", { search: debounced, zoneId, rackId, occupancy, status, page, pageSize: 25 });
  const [editing, setEditing] = React.useState<BinRow | null>(null);
  const [viewing, setViewing] = React.useState<string | null>(null);

  return (
    <div>
      <PageHeader title={t("bins.title")} subtitle={t("bins.subtitle")} icon={<Warehouse />} />
      <Card>
        <FilterBar>
          <SearchInput value={search} onChange={setSearch} placeholder={`${warehouses?.[0]?.code ?? ""}-A-A01...`} />
          <Select
            value={zoneId}
            onChange={(e) => {
              setZoneId(e.target.value);
              setRackId("");
            }}
            className="sm:w-48"
          >
            <option value="">{t("common.zone")}: {t("common.all")}</option>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.code} · {z.name}
              </option>
            ))}
          </Select>
          <Select value={rackId} onChange={(e) => setRackId(e.target.value)} className="sm:w-36" disabled={!zoneId}>
            <option value="">{t("common.rack")}: {t("common.all")}</option>
            {racks.map((r) => (
              <option key={r.id} value={r.id}>
                {r.code}
              </option>
            ))}
          </Select>
          <Select value={occupancy} onChange={(e) => setOccupancy(e.target.value)} className="sm:w-40">
            <option value="">{t("bins.occupancy")}: {t("common.all")}</option>
            {["EMPTY", "OCCUPIED", "NEAR_CAPACITY", "FULL"].map((o) => (
              <option key={o} value={o}>
                {t(`capacity.${o}`)}
              </option>
            ))}
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-40">
            <option value="">{t("common.status")}: {t("common.all")}</option>
            {ACTIVE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`status.${s}`)}
              </option>
            ))}
          </Select>
        </FilterBar>
        {isLoading ? (
          <LoadingBlock />
        ) : !data?.items.length ? (
          <EmptyState />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>{t("common.location")}</TH>
                <TH>{t("common.zone")}</TH>
                <TH>{t("common.rack")}</TH>
                <TH>{t("common.level")}</TH>
                <TH className="text-right">{t("bins.lotCount")}</TH>
                <TH className="text-right">{t("bins.productCount")}</TH>
                <TH className="w-52">{t("common.utilization")}</TH>
                <TH>{t("common.status")}</TH>
                <TH className="text-right">{t("common.actions")}</TH>
              </TR>
            </THead>
            <TBody>
              {data.items.map((b) => (
                <TR key={b.id}>
                  <TD className="font-mono text-xs font-semibold">{b.locationCode}</TD>
                  <TD>{b.zoneCode}</TD>
                  <TD>{b.rackCode}</TD>
                  <TD>{b.levelCode}</TD>
                  <TD className="text-right">{b.lotCount}</TD>
                  <TD className="text-right">{b.productCount}</TD>
                  <TD>
                    <div className="flex items-center gap-2">
                      <Progress value={b.utilization} tone={capacityTone(b.capacityStatus)} />
                      <span className="w-12 text-right text-xs tabular-nums">{formatPercent(b.utilization)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatNumber(b.used)} / {formatNumber(b.capacity)}
                    </p>
                  </TD>
                  <TD>
                    <div className="flex flex-col items-start gap-1">
                      <StatusBadge status={b.status} />
                      <CapacityBadge status={b.capacityStatus} />
                    </div>
                  </TD>
                  <TD className="text-right whitespace-nowrap">
                    <Button variant="ghost" size="icon-sm" onClick={() => setViewing(b.id)} aria-label={t("common.view")}>
                      <Eye />
                    </Button>
                    {can("warehouse.manage") && (
                      <Button variant="ghost" size="icon-sm" onClick={() => setEditing(b)} aria-label={t("common.edit")}>
                        <Pencil />
                      </Button>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
        <Pagination meta={data?.meta} onPageChange={setPage} />
      </Card>
      <EditBinDialog bin={editing} onClose={() => setEditing(null)} />
      <BinDetailDialog binId={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}
