import { Layers, ShieldAlert } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { EXPIRY_STATUSES, LOT_STATUSES, type LotStatus } from "@/shared/constants";
import type { LotDto } from "@/shared/types";
import { FilterBar, PageHeader, SearchInput } from "../../components/common";
import { ExpiryBadge, StatusBadge } from "../../components/StatusBadge";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Field, Select, Textarea } from "../../components/ui/form";
import { EmptyState, LoadingBlock, Pagination, Progress } from "../../components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "../../components/ui/table";
import { useApiMutation, useDebounced, usePagedQuery } from "../../hooks/useApi";
import { useAuth } from "../../hooks/useAuth";
import { api } from "../../services/api";
import { formatDate, formatNumber } from "../../utils/format";

function LotStatusDialog({ lot, onClose }: { lot: LotDto | null; onClose: () => void }) {
  const { t } = useTranslation();
  const [status, setStatus] = React.useState<LotStatus>("AVAILABLE");
  const [notes, setNotes] = React.useState("");
  React.useEffect(() => {
    if (lot) {
      setStatus(lot.status);
      setNotes(lot.notes ?? "");
    }
  }, [lot]);
  const save = useApiMutation(() => api.patch(`/api/inventory/lots/${lot!.id}/status`, { status, notes }), {
    invalidate: [["lots"], ["inventory"], ["dashboard"], ["alerts"]],
    success: t("lots.statusChanged"),
    onSuccess: onClose,
  });
  return (
    <Dialog open={!!lot} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>
            {t("lots.changeStatus")} · <span className="font-mono">{lot?.lotNumber}</span>
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <Field label={t("common.status")}>
            <Select value={status} onChange={(e) => setStatus(e.target.value as LotStatus)}>
              {LOT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`status.${s}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("common.notes")}>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => save.mutate(undefined)} loading={save.isPending}>
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function LotsPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [expiryStatus, setExpiryStatus] = React.useState("");
  const [hasStock, setHasStock] = React.useState(true);
  const [page, setPage] = React.useState(1);
  const debounced = useDebounced(search);
  React.useEffect(() => setPage(1), [debounced, status, expiryStatus, hasStock]);
  const { data, isLoading } = usePagedQuery<LotDto>(["lots"], "/api/inventory/lots", { search: debounced, status, expiryStatus, hasStock, page, pageSize: 20 });
  const [editing, setEditing] = React.useState<LotDto | null>(null);

  return (
    <div>
      <PageHeader title={t("lots.title")} subtitle={t("lots.subtitle")} icon={<Layers />} />
      <Card>
        <FilterBar>
          <SearchInput value={search} onChange={setSearch} />
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-44">
            <option value="">{t("common.status")}: {t("common.all")}</option>
            {LOT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`status.${s}`)}
              </option>
            ))}
          </Select>
          <Select value={expiryStatus} onChange={(e) => setExpiryStatus(e.target.value)} className="sm:w-56">
            <option value="">{t("lots.expiryFilter")}: {t("common.all")}</option>
            {EXPIRY_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`expiry.${s}`)}
              </option>
            ))}
          </Select>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={hasStock} onChange={(e) => setHasStock(e.target.checked)} className="size-4 accent-primary" />
            {t("lots.withStock")}
          </label>
        </FilterBar>
        {isLoading ? (
          <LoadingBlock />
        ) : !data?.items.length ? (
          <EmptyState />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>{t("lots.lotNumber")}</TH>
                <TH>{t("common.product")}</TH>
                <TH>{t("common.supplier")}</TH>
                <TH>{t("common.manufacturingDate")}</TH>
                <TH>{t("common.expirationDate")}</TH>
                <TH className="w-36">{t("expiry.shelfLife")}</TH>
                <TH>{t("common.receivedDate")}</TH>
                <TH className="text-right">{t("common.quantity")}</TH>
                <TH>{t("lots.locations")}</TH>
                <TH>{t("common.status")}</TH>
                {can("lot.manage") && <TH />}
              </TR>
            </THead>
            <TBody>
              {data.items.map((l) => (
                <TR key={l.id}>
                  <TD className="font-mono text-xs font-semibold">{l.lotNumber}</TD>
                  <TD>
                    <Link to={`/products/${l.productId}`} className="font-medium hover:text-primary">
                      {l.productSku}
                    </Link>
                    <p className="max-w-52 truncate text-xs text-muted-foreground">{l.productName}</p>
                  </TD>
                  <TD className="max-w-40 truncate text-xs">{l.supplierName ?? "—"}</TD>
                  <TD className="text-xs">{formatDate(l.manufacturingDate)}</TD>
                  <TD>
                    <div className="flex flex-col items-start gap-1">
                      <span className="text-xs">{formatDate(l.expirationDate)}</span>
                      <ExpiryBadge status={l.expiryStatus} days={l.daysToExpiry} />
                    </div>
                  </TD>
                  <TD>
                    {l.shelfLifePercent !== null ? (
                      <div className="flex items-center gap-2">
                        <Progress value={l.shelfLifePercent} tone={l.shelfLifePercent <= 10 ? "danger" : l.shelfLifePercent <= 30 ? "caution" : "success"} />
                        <span className="w-9 text-right text-xs tabular-nums">{l.shelfLifePercent}%</span>
                      </div>
                    ) : (
                      "—"
                    )}
                  </TD>
                  <TD className="text-xs">{formatDate(l.receivedDate)}</TD>
                  <TD className="text-right font-semibold tabular-nums">
                    {formatNumber(l.quantity)} <span className="text-xs font-normal text-muted-foreground">{l.unit}</span>
                  </TD>
                  <TD>
                    <div className="flex max-w-48 flex-wrap gap-1">
                      {l.locations.map((loc) => (
                        <span key={loc} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                          {loc}
                        </span>
                      ))}
                    </div>
                  </TD>
                  <TD>
                    <StatusBadge status={l.status} />
                    {l.notes && <p className="mt-1 max-w-32 truncate text-[11px] text-muted-foreground" title={l.notes}>{l.notes}</p>}
                  </TD>
                  {can("lot.manage") && (
                    <TD>
                      <Button variant="ghost" size="icon-sm" onClick={() => setEditing(l)} aria-label={t("lots.changeStatus")}>
                        <ShieldAlert />
                      </Button>
                    </TD>
                  )}
                </TR>
              ))}
            </TBody>
          </Table>
        )}
        <Pagination meta={data?.meta} onPageChange={setPage} />
      </Card>
      <LotStatusDialog lot={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
