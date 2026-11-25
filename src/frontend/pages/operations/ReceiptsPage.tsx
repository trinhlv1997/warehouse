import { ArrowDownToLine, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { ReceiptDto } from "@/shared/types";
import { DocumentList } from "../../components/DocumentList";
import { PageHeader } from "../../components/common";
import { StatusBadge } from "../../components/StatusBadge";
import { Button } from "../../components/ui/button";
import { useAuth } from "../../hooks/useAuth";
import { formatDate, formatNumber } from "../../utils/format";

export function ReceiptsPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  return (
    <div>
      <PageHeader
        title={t("receipts.title")}
        subtitle={t("receipts.subtitle")}
        icon={<ArrowDownToLine />}
        actions={
          can("receipt.create") && (
            <Button asChild>
              <Link to="/receipts/new">
                <Plus /> {t("receipts.new")}
              </Link>
            </Button>
          )
        }
      />
      <DocumentList<ReceiptDto>
        queryKey="receipts"
        path="/api/stock-receipts"
        linkPrefix="/receipts"
        statuses={["DRAFT", "CONFIRMED", "CANCELLED"]}
        columns={[
          { header: t("receipts.number"), cell: (r) => <span className="font-mono text-xs font-semibold text-primary">{r.receiptNumber}</span> },
          { header: t("receipts.date"), cell: (r) => formatDate(r.receiptDate) },
          { header: t("common.supplier"), cell: (r) => <span className="text-sm">{r.supplierName ?? "—"}</span> },
          { header: t("receipts.referenceNo"), cell: (r) => r.referenceNo ?? "—" },
          { header: t("common.items"), cell: (r) => r.itemCount, className: "text-right" },
          { header: t("common.quantity"), cell: (r) => <b className="tabular-nums">{formatNumber(r.totalQuantity)}</b>, className: "text-right" },
          { header: t("common.createdBy"), cell: (r) => <span className="text-xs">{r.createdByName ?? "—"}</span> },
          { header: t("common.status"), cell: (r) => <StatusBadge status={r.status} /> },
        ]}
      />
    </div>
  );
}
