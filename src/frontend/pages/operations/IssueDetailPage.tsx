import { ArrowLeft, ArrowUpFromLine, FileDown } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Link, useParams } from "react-router";
import type { IssueDto, WarehouseDto } from "@/shared/types";
import { InfoRow, PageHeader } from "../../components/common";
import { StatusBadge } from "../../components/StatusBadge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { LoadingBlock } from "../../components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "../../components/ui/table";
import { useApiQuery } from "../../hooks/useApi";
import { useAuth } from "../../hooks/useAuth";
import { downloadIssuePdf } from "../../utils/pdf/issuePdf";
import { formatDate, formatDateTime, formatNumber } from "../../utils/format";

export function IssueDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const { user } = useAuth();
  const { data: r, isLoading } = useApiQuery<IssueDto>(["issue", id], `/api/stock-issues/${id}`);
  const { data: warehouses } = useApiQuery<WarehouseDto[]>(["warehouses"], "/api/warehouses");
  const [exporting, setExporting] = React.useState(false);
  if (isLoading || !r) return <LoadingBlock rows={8} />;

  const exportPdf = async () => {
    const warehouse = warehouses?.[0];
    setExporting(true);
    try {
      await downloadIssuePdf(
        r,
        {
          companyName: user?.tenantName ?? "",
          warehouseCode: warehouse?.code ?? "",
          warehouseName: warehouse?.name ?? "",
          warehouseAddress: warehouse?.address ?? null,
          printedBy: user?.fullName ?? "",
          printedAt: new Date(),
        },
        (key, options) => String(t(key, options as never)),
      );
      toast.success(t("issues.pdfDone"));
    } catch (e) {
      console.error(e);
      toast.error(t("errors.pdf"));
    } finally {
      setExporting(false);
    }
  };
  return (
    <div className="space-y-4">
      <PageHeader
        title={`${t("issues.title")} ${r.issueNumber}`}
        subtitle={<StatusBadge status={r.status} />}
        icon={<ArrowUpFromLine />}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/issues">
                <ArrowLeft /> {t("common.back")}
              </Link>
            </Button>
            <Button onClick={exportPdf} loading={exporting} disabled={!warehouses}>
              {!exporting && <FileDown />} {exporting ? t("issues.exportingPdf") : t("issues.exportPdf")}
            </Button>
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardContent className="divide-y pt-4">
            <InfoRow label={t("issues.date")}>{formatDate(r.issueDate)}</InfoRow>
            <InfoRow label={t("issues.recipient")}>{r.recipient ?? "—"}</InfoRow>
            <InfoRow label={t("common.reason")}>{t(`issueReason.${r.reason}`)}</InfoRow>
            <InfoRow label={t("common.createdBy")}>{r.createdByName ?? "—"}</InfoRow>
            <InfoRow label={t("common.confirmedAt")}>{formatDateTime(r.confirmedAt)}</InfoRow>
            <InfoRow label={t("common.total")}>{formatNumber(r.totalQuantity)}</InfoRow>
            {r.notes && <p className="pt-2 text-sm text-muted-foreground">{r.notes}</p>}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("issues.pickList")}</CardTitle>
          </CardHeader>
          <Table>
            <THead>
              <TR>
                <TH>{t("common.product")}</TH>
                <TH>{t("lots.lotNumber")}</TH>
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
                  <TD className="text-xs">{formatDate(i.expirationDate)}</TD>
                  <TD className="font-mono text-xs font-semibold text-primary">{i.locationCode}</TD>
                  <TD className="text-right font-semibold tabular-nums">
                    {formatNumber(i.quantity)} <span className="text-xs font-normal text-muted-foreground">{i.unit}</span>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
