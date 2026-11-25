import { ArrowDownToLine, ArrowLeft, CheckCircle2, Pencil, Printer, XCircle } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";
import type { ReceiptDto } from "@/shared/types";
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

export function ReceiptDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const { can } = useAuth();
  const { data: r, isLoading } = useApiQuery<ReceiptDto>(["receipt", id], `/api/stock-receipts/${id}`);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const invalidate = [["receipt", id], ["receipts"], ["dashboard"], ["inventory"], ["lots"], ["products"], ["warehouse-map"], ["bins"]];
  const confirm = useApiMutation(() => api.post(`/api/stock-receipts/${id}/confirm`), { invalidate, success: t("receipts.confirmed"), onSuccess: () => setConfirmOpen(false), onError: () => setConfirmOpen(false) });
  const cancel = useApiMutation(() => api.post(`/api/stock-receipts/${id}/cancel`), { invalidate, success: t("common.saved"), onSuccess: () => setCancelOpen(false) });

  if (isLoading || !r) return <LoadingBlock rows={8} />;
  const draft = r.status === "DRAFT";

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${t("receipts.title")} ${r.receiptNumber}`}
        subtitle={<StatusBadge status={r.status} />}
        icon={<ArrowDownToLine />}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/receipts">
                <ArrowLeft /> {t("common.back")}
              </Link>
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer /> {t("common.print")}
            </Button>
            {draft && can("receipt.create") && (
              <>
                <Button variant="outline" asChild>
                  <Link to={`/receipts/${id}/edit`}>
                    <Pencil /> {t("common.edit")}
                  </Link>
                </Button>
                <Button variant="outline" onClick={() => setCancelOpen(true)}>
                  <XCircle className="text-danger" /> {t("receipts.cancelDoc")}
                </Button>
              </>
            )}
            {draft && can("receipt.confirm") && (
              <Button variant="success" onClick={() => setConfirmOpen(true)}>
                <CheckCircle2 /> {t("receipts.confirm")}
              </Button>
            )}
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardContent className="divide-y pt-4">
            <InfoRow label={t("receipts.date")}>{formatDate(r.receiptDate)}</InfoRow>
            <InfoRow label={t("common.supplier")}>{r.supplierName ?? "—"}</InfoRow>
            <InfoRow label={t("receipts.referenceNo")}>{r.referenceNo ?? "—"}</InfoRow>
            <InfoRow label={t("common.createdBy")}>{r.createdByName ?? "—"}</InfoRow>
            <InfoRow label={t("common.createdAt")}>{formatDateTime(r.createdAt)}</InfoRow>
            <InfoRow label={t("common.confirmedBy")}>{r.confirmedByName ?? "—"}</InfoRow>
            <InfoRow label={t("common.confirmedAt")}>{formatDateTime(r.confirmedAt)}</InfoRow>
            <InfoRow label={t("common.total")}>{formatNumber(r.totalQuantity)}</InfoRow>
            {r.notes && <p className="pt-2 text-sm text-muted-foreground">{r.notes}</p>}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("receipts.items")}</CardTitle>
          </CardHeader>
          <Table>
            <THead>
              <TR>
                <TH>{t("common.product")}</TH>
                <TH>{t("lots.lotNumber")}</TH>
                <TH>{t("common.manufacturingDate")}</TH>
                <TH>{t("common.expirationDate")}</TH>
                <TH>{t("common.location")}</TH>
                <TH className="text-right">{t("common.quantity")}</TH>
              </TR>
            </THead>
            <TBody>
              {(r.items ?? []).map((i) => (
                <TR key={i.id}>
                  <TD>
                    <p className="font-medium">{i.productSku}</p>
                    <p className="max-w-56 truncate text-xs text-muted-foreground">{i.productName}</p>
                  </TD>
                  <TD className="font-mono text-xs">{i.lotNumber}</TD>
                  <TD className="text-xs">{formatDate(i.manufacturingDate)}</TD>
                  <TD className="text-xs">{formatDate(i.expirationDate)}</TD>
                  <TD className="font-mono text-xs">{i.locationCode}</TD>
                  <TD className="text-right font-semibold tabular-nums">
                    {formatNumber(i.quantity)} <span className="text-xs font-normal text-muted-foreground">{i.unit}</span>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      </div>
      <ConfirmDialog open={confirmOpen} onOpenChange={setConfirmOpen} title={t("receipts.confirm")} description={t("receipts.confirmText")} variant="success" loading={confirm.isPending} onConfirm={() => confirm.mutate(undefined)} />
      <ConfirmDialog open={cancelOpen} onOpenChange={setCancelOpen} title={t("receipts.cancelDoc")} description={t("common.areYouSure")} variant="destructive" loading={cancel.isPending} onConfirm={() => cancel.mutate(undefined)} />
    </div>
  );
}
