import { ArrowLeftRight, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { TransferDto } from "@/shared/types";
import { DocumentList } from "../../components/DocumentList";
import { PageHeader } from "../../components/common";
import { StatusBadge } from "../../components/StatusBadge";
import { Button } from "../../components/ui/button";
import { useAuth } from "../../hooks/useAuth";
import { formatDate, formatNumber } from "../../utils/format";

export function TransfersPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  return (
    <div>
      <PageHeader
        title={t("transfers.title")}
        subtitle={t("transfers.subtitle")}
        icon={<ArrowLeftRight />}
        actions={
          can("transfer.create") && (
            <Button asChild>
              <Link to="/transfers/new">
                <Plus /> {t("transfers.new")}
              </Link>
            </Button>
          )
        }
      />
      <DocumentList<TransferDto>
        queryKey="transfers"
        path="/api/stock-transfers"
        linkPrefix="/transfers"
        statuses={["DRAFT", "CONFIRMED", "CANCELLED"]}
        columns={[
          { header: t("transfers.number"), cell: (r) => <span className="font-mono text-xs font-semibold text-primary">{r.transferNumber}</span> },
          { header: t("transfers.date"), cell: (r) => formatDate(r.transferDate) },
          { header: t("common.reason"), cell: (r) => r.reason ?? "—" },
          { header: t("common.items"), cell: (r) => r.itemCount, className: "text-right" },
          { header: t("common.quantity"), cell: (r) => <b className="tabular-nums">{formatNumber(r.totalQuantity)}</b>, className: "text-right" },
          { header: t("common.createdBy"), cell: (r) => <span className="text-xs">{r.createdByName ?? "—"}</span> },
          { header: t("common.status"), cell: (r) => <StatusBadge status={r.status} /> },
        ]}
      />
    </div>
  );
}
