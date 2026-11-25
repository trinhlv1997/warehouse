import { ArrowLeft, ArrowLeftRight, ArrowRight, CheckCircle2, XCircle } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";
import type { TransferDto } from "@/shared/types";
import { ConfirmDialog, InfoRow, PageHeader } from "../../components/common";
import { StatusBadge } from "../../components/StatusBadge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { LoadingBlock } from "../../components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "../../components/ui/table";
import { useApiMutation, useApiQuery } from "../../hooks/useApi";
import { useAuth } from "../../hooks/useAuth";
import { api } from "../../services/api";
import { formatDate, formatDateTime, formatNumber } from "../../utils/format";

export function TransferDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const { can } = useAuth();
  const { data: r, isLoading } = useApiQuery<TransferDto>(["transfer", id], `/api/stock-transfers/${id}`);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const invalidate = [["transfer", id], ["transfers"], ["inventory"], ["warehouse-map"], ["bins"], ["lots"]];
  const confirm = useApiMutation(() => api.post(`/api/stock-transfers/${id}/confirm`), { invalidate, success: t("transfers.confirmed"), onSuccess: () => setConfirmOpen(false), onError: () => setConfirmOpen(false) });
  const cancel = useApiMutation(() => api.post(`/api/stock-transfers/${id}/cancel`), { invalidate, success: t("common.saved"), onSuccess: () => setCancelOpen(false) });
  if (isLoading || !r) return <LoadingBlock rows={8} />;
  const draft = r.status === "DRAFT";
  return (
    <div className="space-y-4">
      <PageHeader
        title={`${t("transfers.title")} ${r.transferNumber}`}
        subtitle={<StatusBadge status={r.status} />}
        icon={<ArrowLeftRight />}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/transfers">
                <ArrowLeft /> {t("common.back")}
              </Link>
            </Button>
            {draft && can("transfer.create") && (
              <Button variant="outline" onClick={() => setCancelOpen(true)}>
                <XCircle className="text-danger" /> {t("transfers.cancelDoc")}
              </Button>
            )}
            {draft && can("transfer.confirm") && (
              <Button variant="success" onClick={() => setConfirmOpen(true)}>
                <CheckCircle2 /> {t("transfers.confirm")}
              </Button>
            )}
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardContent className="divide-y pt-4">
            <InfoRow label={t("transfers.date")}>{formatDate(r.transferDate)}</InfoRow>
            <InfoRow label={t("common.reason")}>{r.reason ?? "—"}</InfoRow>
            <InfoRow label={t("common.createdBy")}>{r.createdByName ?? "—"}</InfoRow>
            <InfoRow label={t("common.confirmedBy")}>{r.confirmedByName ?? "—"}</InfoRow>
            <InfoRow label={t("common.confirmedAt")}>{formatDateTime(r.confirmedAt)}</InfoRow>
            <InfoRow label={t("common.total")}>{formatNumber(r.totalQuantity)}</InfoRow>
            {r.notes && <p className="pt-2 text-sm text-muted-foreground">{r.notes}</p>}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("common.items")}</CardTitle>
          </CardHeader>
          <Table>
            <THead>
              <TR>
                <TH>{t("common.product")}</TH>
                <TH>{t("lots.lotNumber")}</TH>
                <TH>{t("transfers.source")}</TH>
                <TH />
                <TH>{t("transfers.destination")}</TH>
                <TH className="text-right">{t("common.quantity")}</TH>
              </TR>
            </THead>
            <TBody>
              {(r.items ?? []).map((i) => (
                <TR key={i.id}>
                  <TD>
                    <p className="font-medium">{i.productSku}</p>
                    <p className="max-w-48 truncate text-xs text-muted-foreground">{i.productName}</p>
                  </TD>
                  <TD className="font-mono text-xs">{i.lotNumber}</TD>
                  <TD className="font-mono text-xs">{i.fromLocationCode}</TD>
                  <TD>
                    <ArrowRight className="size-4 text-primary" />
                  </TD>
                  <TD className="font-mono text-xs font-semibold">{i.toLocationCode}</TD>
                  <TD className="text-right font-semibold tabular-nums">
                    {formatNumber(i.quantity)} <span className="text-xs font-normal text-muted-foreground">{i.unit}</span>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      </div>
      <ConfirmDialog open={confirmOpen} onOpenChange={setConfirmOpen} title={t("transfers.confirm")} description={t("transfers.confirmText")} variant="success" loading={confirm.isPending} onConfirm={() => confirm.mutate(undefined)} />
      <ConfirmDialog open={cancelOpen} onOpenChange={setCancelOpen} title={t("transfers.cancelDoc")} description={t("common.areYouSure")} variant="destructive" loading={cancel.isPending} onConfirm={() => cancel.mutate(undefined)} />
    </div>
  );
}
