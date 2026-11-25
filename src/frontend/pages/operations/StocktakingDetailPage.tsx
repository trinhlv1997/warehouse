import { ArrowLeft, CheckCircle2, ClipboardCheck, RotateCcw, Save, Send, XCircle } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";
import type { StocktakingDto } from "@/shared/types";
import { ConfirmDialog, FilterBar, PageHeader, SearchInput } from "../../components/common";
import { StatusBadge } from "../../components/StatusBadge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/form";
import { LoadingBlock, Progress } from "../../components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "../../components/ui/table";
import { useApiMutation, useApiQuery } from "../../hooks/useApi";
import { useAuth } from "../../hooks/useAuth";
import { api } from "../../services/api";
import { cn } from "../../utils/cn";
import { formatDate, formatDateTime, formatNumber } from "../../utils/format";

function useSessionAction(id: string | undefined, name: string, success: string, invalidate: unknown[][], done: () => void) {
  return useApiMutation(() => api.post(`/api/stocktaking/${id}/${name}`), { invalidate, success, onSuccess: done, onError: done });
}

export function StocktakingDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const { can } = useAuth();
  const { data: s, isLoading } = useApiQuery<StocktakingDto>(["stocktaking-session", id], `/api/stocktaking/${id}`);
  const [counts, setCounts] = React.useState<Record<string, string>>({});
  const [search, setSearch] = React.useState("");
  const [onlyDiff, setOnlyDiff] = React.useState(false);
  const [approveOpen, setApproveOpen] = React.useState(false);
  const [cancelOpen, setCancelOpen] = React.useState(false);

  React.useEffect(() => {
    if (s?.items) setCounts(Object.fromEntries(s.items.map((i) => [i.id, i.countedQuantity === null ? "" : String(i.countedQuantity)])));
  }, [s]);

  const invalidate = [["stocktaking-session", id], ["stocktaking"], ["inventory"], ["dashboard"], ["lots"]];
  const dirty = (s?.items ?? []).filter((i) => (counts[i.id] ?? "") !== (i.countedQuantity === null ? "" : String(i.countedQuantity)));
  const saveCounts = useApiMutation(
    () => api.put(`/api/stocktaking/${id}/counts`, { counts: dirty.map((i) => ({ itemId: i.id, countedQuantity: counts[i.id] === "" ? null : Number(counts[i.id]), notes: i.notes })) }),
    { invalidate, success: t("stocktaking.countsSaved") },
  );
  const closeDialogs = () => {
    setApproveOpen(false);
    setCancelOpen(false);
  };
  const submit = useSessionAction(id, "submit", t("common.saved"), invalidate, closeDialogs);
  const reopen = useSessionAction(id, "reopen", t("common.saved"), invalidate, closeDialogs);
  const approve = useSessionAction(id, "approve", t("stocktaking.approved"), invalidate, closeDialogs);
  const cancel = useSessionAction(id, "cancel", t("common.saved"), invalidate, closeDialogs);

  if (isLoading || !s) return <LoadingBlock rows={8} />;
  const counting = s.status === "COUNTING" && can("stocktaking.count");
  const q = search.trim().toLowerCase();
  const rows = (s.items ?? []).filter((i) => {
    if (q && ![i.productSku, i.productName, i.lotNumber, i.locationCode].some((v) => v.toLowerCase().includes(q))) return false;
    const c = counts[i.id];
    if (onlyDiff) return c !== "" && c !== undefined && Number(c) !== i.systemQuantity;
    return true;
  });
  const progress = s.itemCount ? (s.countedCount / s.itemCount) * 100 : 0;

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${t("stocktaking.title")} ${s.sessionNumber}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={s.status} />
            {t(`stocktaking.scopeType.${s.scopeType}`)}
            {s.scopeLabel && `: ${s.scopeLabel}`} · {formatDateTime(s.createdAt)}
          </span>
        }
        icon={<ClipboardCheck />}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/stocktaking">
                <ArrowLeft /> {t("common.back")}
              </Link>
            </Button>
            {counting && (
              <>
                <Button variant="outline" onClick={() => saveCounts.mutate(undefined)} loading={saveCounts.isPending} disabled={!dirty.length}>
                  <Save /> {t("stocktaking.saveCounts")}
                </Button>
                <Button onClick={() => submit.mutate(undefined)} loading={submit.isPending} disabled={dirty.length > 0 || s.countedCount === 0}>
                  <Send /> {t("stocktaking.submit")}
                </Button>
              </>
            )}
            {s.status === "SUBMITTED" && can("stocktaking.approve") && (
              <>
                <Button variant="outline" onClick={() => reopen.mutate(undefined)} loading={reopen.isPending}>
                  <RotateCcw /> {t("stocktaking.reopen")}
                </Button>
                <Button variant="success" onClick={() => setApproveOpen(true)}>
                  <CheckCircle2 /> {t("stocktaking.approve")}
                </Button>
              </>
            )}
            {(s.status === "COUNTING" || s.status === "SUBMITTED") && can("stocktaking.approve") && (
              <Button variant="outline" onClick={() => setCancelOpen(true)}>
                <XCircle className="text-danger" /> {t("stocktaking.cancelSession")}
              </Button>
            )}
          </>
        }
      />
      <Card>
        <CardContent className="grid gap-4 pt-5 sm:grid-cols-3">
          <div>
            <p className="text-sm text-muted-foreground">{t("stocktaking.progress", { counted: s.countedCount, total: s.itemCount })}</p>
            <Progress value={progress} className="mt-2" tone={progress === 100 ? "success" : "primary"} />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{t("stocktaking.difference")}</p>
            <p className="text-lg font-semibold text-warning">{t("stocktaking.discrepancies", { count: s.discrepancyCount })}</p>
          </div>
          <div className="text-sm">
            <p className="text-muted-foreground">{t("common.createdBy")}: {s.createdByName ?? "—"}</p>
            {s.approvedByName && (
              <p className="text-muted-foreground">
                {t("status.APPROVED")}: {s.approvedByName} · {formatDateTime(s.approvedAt)}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
      <Card>
        <FilterBar>
          <SearchInput value={search} onChange={setSearch} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-primary" checked={onlyDiff} onChange={(e) => setOnlyDiff(e.target.checked)} />
            {t("stocktaking.onlyDifferences")}
          </label>
          {counting && (
            <Button variant="ghost" size="sm" className="sm:ml-auto" onClick={() => setCounts((c) => Object.fromEntries((s.items ?? []).map((i) => [i.id, c[i.id] === "" ? String(i.systemQuantity) : c[i.id]])))}>
              {t("stocktaking.fillSystem")}
            </Button>
          )}
        </FilterBar>
        <Table>
          <THead>
            <TR>
              <TH>{t("common.location")}</TH>
              <TH>{t("common.product")}</TH>
              <TH>{t("common.lot")}</TH>
              <TH>{t("common.expirationDate")}</TH>
              <TH className="text-right">{t("stocktaking.systemQty")}</TH>
              <TH className="w-32 text-right">{t("stocktaking.countedQty")}</TH>
              <TH className="text-right">{t("stocktaking.difference")}</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((i) => {
              const c = counts[i.id] ?? "";
              const diff = c === "" ? null : Number(c) - i.systemQuantity;
              return (
                <TR key={i.id} className={cn(diff !== null && diff !== 0 && "bg-warning-soft/40")}>
                  <TD className="font-mono text-xs font-semibold">{i.locationCode}</TD>
                  <TD>
                    <p className="font-medium">{i.productSku}</p>
                    <p className="max-w-56 truncate text-xs text-muted-foreground">{i.productName}</p>
                  </TD>
                  <TD className="font-mono text-xs">{i.lotNumber}</TD>
                  <TD className="text-xs">{formatDate(i.expirationDate)}</TD>
                  <TD className="text-right tabular-nums">{formatNumber(i.systemQuantity)}</TD>
                  <TD className="text-right">
                    {counting ? (
                      <Input type="number" min={0} value={c} onChange={(e) => setCounts((m) => ({ ...m, [i.id]: e.target.value }))} className="h-8 w-28 text-right" />
                    ) : (
                      <span className="tabular-nums">{formatNumber(i.countedQuantity)}</span>
                    )}
                  </TD>
                  <TD className={cn("text-right font-semibold tabular-nums", diff ? (diff > 0 ? "text-success" : "text-danger") : "")}>
                    {diff === null ? "—" : `${diff > 0 ? "+" : ""}${formatNumber(diff)}`}
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </Card>
      <ConfirmDialog open={approveOpen} onOpenChange={setApproveOpen} title={t("stocktaking.approve")} description={t("stocktaking.approveText")} variant="success" loading={approve.isPending} onConfirm={() => approve.mutate(undefined)} />
      <ConfirmDialog open={cancelOpen} onOpenChange={setCancelOpen} title={t("stocktaking.cancelSession")} description={t("common.areYouSure")} variant="destructive" loading={cancel.isPending} onConfirm={() => cancel.mutate(undefined)} />
    </div>
  );
}
