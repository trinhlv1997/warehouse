import { ArrowUpFromLine, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { IssueDto } from "@/shared/types";
import { DocumentList } from "../../components/DocumentList";
import { PageHeader } from "../../components/common";
import { StatusBadge } from "../../components/StatusBadge";
import { Button } from "../../components/ui/button";
import { useAuth } from "../../hooks/useAuth";
import { formatDate, formatNumber } from "../../utils/format";

export function IssuesPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  return (
    <div>
      <PageHeader
        title={t("issues.title")}
        subtitle={t("issues.subtitle")}
        icon={<ArrowUpFromLine />}
        actions={
          can("issue.create") && (
            <Button asChild>
              <Link to="/issues/new">
                <Plus /> {t("issues.new")}
              </Link>
            </Button>
          )
        }
      />
      <DocumentList<IssueDto>
        queryKey="issues"
        path="/api/stock-issues"
        linkPrefix="/issues"
        statuses={["CONFIRMED", "CANCELLED"]}
        columns={[
          { header: t("issues.number"), cell: (r) => <span className="font-mono text-xs font-semibold text-primary">{r.issueNumber}</span> },
          { header: t("issues.date"), cell: (r) => formatDate(r.issueDate) },
          { header: t("issues.recipient"), cell: (r) => <span className="text-sm">{r.recipient ?? "—"}</span> },
          { header: t("common.reason"), cell: (r) => t(`issueReason.${r.reason}`) },
          { header: t("common.items"), cell: (r) => r.itemCount, className: "text-right" },
          { header: t("common.quantity"), cell: (r) => <b className="tabular-nums">{formatNumber(r.totalQuantity)}</b>, className: "text-right" },
          { header: t("common.createdBy"), cell: (r) => <span className="text-xs">{r.createdByName ?? "—"}</span> },
          { header: t("common.status"), cell: (r) => <StatusBadge status={r.status} /> },
        ]}
      />
    </div>
  );
}
