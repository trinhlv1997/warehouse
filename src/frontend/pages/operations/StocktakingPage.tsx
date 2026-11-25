import { ClipboardCheck, Plus } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import type { RackDto, StocktakingDto, ZoneDto } from "@/shared/types";
import { DocumentList } from "../../components/DocumentList";
import { PageHeader } from "../../components/common";
import { StatusBadge } from "../../components/StatusBadge";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Field, Select, Textarea } from "../../components/ui/form";
import { useApiMutation, useApiQuery } from "../../hooks/useApi";
import { useAuth } from "../../hooks/useAuth";
import { api } from "../../services/api";
import { formatDateTime } from "../../utils/format";

function CreateDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [scopeType, setScopeType] = React.useState<"ALL" | "ZONE" | "RACK">("ZONE");
  const [scopeIds, setScopeIds] = React.useState<string[]>([]);
  const [notes, setNotes] = React.useState("");
  const { data: zones = [] } = useApiQuery<ZoneDto[]>(["zones"], "/api/zones", undefined, open);
  const { data: racks = [] } = useApiQuery<RackDto[]>(["racks"], "/api/racks", {}, open && scopeType === "RACK");
  const create = useApiMutation(() => api.post<StocktakingDto>("/api/stocktaking", { scopeType, scopeIds, notes }), {
    invalidate: [["stocktaking"]],
    success: t("stocktaking.created"),
    onSuccess: (s) => navigate(`/stocktaking/${s.id}`),
  });
  const options = scopeType === "ZONE" ? zones.map((z) => ({ id: z.id, label: `${z.code} · ${z.name}` })) : racks.map((r) => ({ id: r.id, label: `${r.zoneCode}-${r.code}` }));
  const toggle = (id: string) => setScopeIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("stocktaking.new")}</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <Field label={t("stocktaking.scope")}>
            <Select
              value={scopeType}
              onChange={(e) => {
                setScopeType(e.target.value as "ALL" | "ZONE" | "RACK");
                setScopeIds([]);
              }}
            >
              {(["ALL", "ZONE", "RACK"] as const).map((s) => (
                <option key={s} value={s}>
                  {t(`stocktaking.scopeType.${s}`)}
                </option>
              ))}
            </Select>
          </Field>
          {scopeType !== "ALL" && (
            <div className="flex max-h-56 flex-wrap gap-2 overflow-y-auto">
              {options.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => toggle(o.id)}
                  className={`rounded-md border px-3 py-1.5 text-sm ${scopeIds.includes(o.id) ? "border-primary bg-primary-soft text-primary" : "hover:bg-muted"}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}
          <Field label={t("common.notes")}>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => create.mutate(undefined)} loading={create.isPending} disabled={scopeType !== "ALL" && scopeIds.length === 0}>
            {t("common.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function StocktakingPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const [open, setOpen] = React.useState(false);
  return (
    <div>
      <PageHeader
        title={t("stocktaking.title")}
        subtitle={t("stocktaking.subtitle")}
        icon={<ClipboardCheck />}
        actions={
          can("stocktaking.count") && (
            <Button onClick={() => setOpen(true)}>
              <Plus /> {t("stocktaking.new")}
            </Button>
          )
        }
      />
      <DocumentList<StocktakingDto>
        queryKey="stocktaking"
        path="/api/stocktaking"
        linkPrefix="/stocktaking"
        statuses={["COUNTING", "SUBMITTED", "APPROVED", "CANCELLED"]}
        columns={[
          { header: t("stocktaking.number"), cell: (r) => <span className="font-mono text-xs font-semibold text-primary">{r.sessionNumber}</span> },
          { header: t("stocktaking.scope"), cell: (r) => `${t(`stocktaking.scopeType.${r.scopeType}`)}${r.scopeLabel ? `: ${r.scopeLabel}` : ""}` },
          { header: t("common.items"), cell: (r) => t("stocktaking.progress", { counted: r.countedCount, total: r.itemCount }) },
          { header: t("stocktaking.difference"), cell: (r) => (r.discrepancyCount ? <Badge variant="warning">{t("stocktaking.discrepancies", { count: r.discrepancyCount })}</Badge> : "—") },
          { header: t("common.createdBy"), cell: (r) => <span className="text-xs">{r.createdByName ?? "—"}</span> },
          { header: t("common.createdAt"), cell: (r) => <span className="text-xs">{formatDateTime(r.createdAt)}</span> },
          { header: t("common.status"), cell: (r) => <StatusBadge status={r.status} /> },
        ]}
      />
      <CreateDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
