import { ArrowLeft, ArrowLeftRight, ArrowRight, Plus, Trash2 } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";
import type { InventoryPositionDto, TransferDto } from "@/shared/types";
import { PageHeader, SearchInput } from "../../components/common";
import { BinPicker, type BinOption } from "../../components/Pickers";
import { ExpiryBadge } from "../../components/StatusBadge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Field, Input, Textarea } from "../../components/ui/form";
import { EmptyState, LoadingBlock } from "../../components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "../../components/ui/table";
import { useApiMutation, useDebounced, usePagedQuery } from "../../hooks/useApi";
import { api } from "../../services/api";
import { newRequestKey } from "../../utils/cn";
import { formatDate, formatNumber, todayVn } from "../../utils/format";

interface Line {
  key: string;
  source: InventoryPositionDto;
  destination: BinOption | null;
  quantity: number;
}

function SourcePicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (p: InventoryPositionDto) => void }) {
  const { t } = useTranslation();
  const [search, setSearch] = React.useState("");
  const debounced = useDebounced(search);
  const { data, isLoading } = usePagedQuery<InventoryPositionDto>(["inventory", "picker"], "/api/inventory", { search: debounced, pageSize: 30, orderBy: "location" }, open);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>{t("transfers.pickSource")}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <SearchInput value={search} onChange={setSearch} className="mb-3 sm:w-96" />
          {isLoading ? (
            <LoadingBlock />
          ) : !data?.items.length ? (
            <EmptyState />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>{t("common.location")}</TH>
                  <TH>{t("common.product")}</TH>
                  <TH>{t("common.lot")}</TH>
                  <TH>{t("common.expirationDate")}</TH>
                  <TH className="text-right">{t("common.quantity")}</TH>
                </TR>
              </THead>
              <TBody>
                {data.items.map((p) => (
                  <TR
                    key={p.balanceId}
                    className="cursor-pointer"
                    onClick={() => {
                      onPick(p);
                      onClose();
                    }}
                  >
                    <TD className="font-mono text-xs font-semibold">{p.locationCode}</TD>
                    <TD>
                      <p className="font-medium">{p.productSku}</p>
                      <p className="max-w-64 truncate text-xs text-muted-foreground">{p.productName}</p>
                    </TD>
                    <TD className="font-mono text-xs">{p.lotNumber}</TD>
                    <TD>
                      <ExpiryBadge status={p.expiryStatus} days={p.daysToExpiry} />
                    </TD>
                    <TD className="text-right tabular-nums">{formatNumber(p.quantity)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

export function TransferCreatePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [lines, setLines] = React.useState<Line[]>([]);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [transferDate, setTransferDate] = React.useState(todayVn());
  const [reason, setReason] = React.useState("");
  const [notes, setNotes] = React.useState("");

  const save = useApiMutation(
    () =>
      api.post<TransferDto>("/api/stock-transfers", {
        transferDate,
        reason,
        notes,
        items: lines.map((l) => ({ lotId: l.source.lotId, fromBinId: l.source.binId, toBinId: l.destination!.id, quantity: l.quantity })),
      }),
    { invalidate: [["transfers"]], success: t("transfers.created"), onSuccess: (r) => navigate(`/transfers/${r.id}`) },
  );
  const valid = lines.length > 0 && lines.every((l) => l.destination && l.quantity > 0 && l.quantity <= l.source.quantity);
  const update = (key: string, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("transfers.new")}
        subtitle={t("transfers.subtitle")}
        icon={<ArrowLeftRight />}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/transfers">
                <ArrowLeft /> {t("common.back")}
              </Link>
            </Button>
            <Button onClick={() => save.mutate(undefined)} loading={save.isPending} disabled={!valid}>
              {t("receipts.saveDraft")}
            </Button>
          </>
        }
      />
      <Card>
        <CardContent className="grid gap-4 pt-5 sm:grid-cols-3">
          <Field label={t("transfers.date")} required>
            <Input type="date" value={transferDate} onChange={(e) => setTransferDate(e.target.value)} />
          </Field>
          <Field label={t("common.reason")}>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <Field label={t("common.notes")}>
            <Textarea rows={1} className="min-h-9" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("common.items")}</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
            <Plus /> {t("transfers.pickSource")}
          </Button>
        </CardHeader>
        {lines.length === 0 ? (
          <EmptyState />
        ) : (
          <CardContent className="space-y-3">
            {lines.map((l) => (
              <div key={l.key} className="grid items-center gap-3 rounded-lg border p-3 lg:grid-cols-[1fr_auto_1fr_auto_auto]">
                <div>
                  <p className="text-xs text-muted-foreground">{t("transfers.source")}</p>
                  <p className="font-mono text-sm font-semibold">{l.source.locationCode}</p>
                  <p className="text-xs">
                    {l.source.productSku} · {t("common.lot")} <span className="font-mono">{l.source.lotNumber}</span> · {formatDate(l.source.expirationDate)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("issues.available")}: {formatNumber(l.source.quantity)} {l.source.unit}
                  </p>
                </div>
                <ArrowRight className="hidden size-5 text-primary lg:block" />
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">{t("transfers.destination")}</p>
                  <BinPicker value={l.destination?.id ?? null} valueLabel={l.destination?.locationCode} excludeId={l.source.binId} onChange={(b) => update(l.key, { destination: b })} invalid={!l.destination} />
                </div>
                <Field label={t("common.quantity")}>
                  <Input type="number" min={1} max={l.source.quantity} value={l.quantity} onChange={(e) => update(l.key, { quantity: Number(e.target.value) })} className="w-28" aria-invalid={l.quantity > l.source.quantity || l.quantity < 1} />
                </Field>
                <Button variant="ghost" size="icon-sm" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} aria-label={t("common.remove")}>
                  <Trash2 className="text-danger" />
                </Button>
              </div>
            ))}
          </CardContent>
        )}
      </Card>
      <SourcePicker open={pickerOpen} onClose={() => setPickerOpen(false)} onPick={(p) => setLines((ls) => [...ls, { key: newRequestKey(), source: p, destination: null, quantity: p.quantity }])} />
    </div>
  );
}
