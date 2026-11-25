import { zodResolver } from "@hookform/resolvers/zod";
import { Columns3, Map as MapIcon, Pencil, Plus, Trash2 } from "lucide-react";
import * as React from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { z } from "zod";
import { ACTIVE_STATUSES } from "@/shared/constants";
import { rackCreateSchema } from "@/shared/schemas";
import type { RackDto, WarehouseDto, ZoneDto } from "@/shared/types";
import { ConfirmDialog, FilterBar, PageHeader } from "../../components/common";
import { CapacityBadge, StatusBadge, capacityTone } from "../../components/StatusBadge";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Field, Input, Select } from "../../components/ui/form";
import { EmptyState, LoadingBlock, Progress } from "../../components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "../../components/ui/table";
import { applyServerErrors, useApiMutation, useApiQuery } from "../../hooks/useApi";
import { useAuth } from "../../hooks/useAuth";
import { api } from "../../services/api";
import { formatNumber, formatPercent } from "../../utils/format";

type CreateIn = z.input<typeof rackCreateSchema>;
type CreateOut = z.output<typeof rackCreateSchema>;

function CreateRackDialog({ zones, open, onOpenChange }: { zones: ZoneDto[]; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation();
  const form = useForm<CreateIn, unknown, CreateOut>({
    resolver: zodResolver(rackCreateSchema),
    defaultValues: { zoneId: zones[0]?.id ?? "", code: "", name: "", levelCount: 4, binsPerLevel: 5, binCapacity: 200 },
  });
  const save = useApiMutation((v: CreateOut) => api.post("/api/racks", v), {
    invalidate: [["racks"], ["zones"], ["warehouse-map"]],
    success: t("common.saved"),
    onSuccess: () => {
      onOpenChange(false);
      form.reset();
    },
    onError: (e) => applyServerErrors(e, form.setError as never),
  });
  const err = form.formState.errors;
  const zone = zones.find((z) => z.id === form.watch("zoneId"));
  const { data: warehouses } = useApiQuery<WarehouseDto[]>(["warehouses"], "/api/warehouses");
  const whCode = warehouses?.[0]?.code ?? "WH";
  const code = form.watch("code") || "A05";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={form.handleSubmit((v) => save.mutate(v))}>
          <DialogHeader>
            <DialogTitle>{t("racks.new")}</DialogTitle>
          </DialogHeader>
          <DialogBody className="grid gap-4 sm:grid-cols-2">
            <Field label={t("common.zone")} required className="sm:col-span-2">
              <Select {...form.register("zoneId")}>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.code} · {z.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("common.code")} required error={err.code?.message}>
              <Input {...form.register("code")} placeholder={`${zone?.code ?? "A"}05`} />
            </Field>
            <Field label={t("common.name")} required error={err.name?.message}>
              <Input {...form.register("name")} />
            </Field>
            <Field label={t("racks.levelCount")} error={err.levelCount?.message}>
              <Input type="number" {...form.register("levelCount")} />
            </Field>
            <Field label={t("racks.binsPerLevel")} error={err.binsPerLevel?.message}>
              <Input type="number" {...form.register("binsPerLevel")} />
            </Field>
            <Field label={t("racks.binCapacity")} error={err.binCapacity?.message} className="sm:col-span-2" hint={t("racks.generateHint", { example: `${whCode}-${zone?.code ?? "A"}-${code.toUpperCase()}-L01-B01` })}>
              <Input type="number" {...form.register("binCapacity")} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" loading={save.isPending}>
              {t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditRackDialog({ rack, onClose }: { rack: RackDto | null; onClose: () => void }) {
  const { t } = useTranslation();
  const [name, setName] = React.useState("");
  const [status, setStatus] = React.useState<string>("ACTIVE");
  React.useEffect(() => {
    if (rack) {
      setName(rack.name);
      setStatus(rack.status);
    }
  }, [rack]);
  const save = useApiMutation(() => api.put(`/api/racks/${rack!.id}`, { name, status }), { invalidate: [["racks"], ["zones"], ["warehouse-map"]], success: t("common.saved"), onSuccess: onClose });
  return (
    <Dialog open={!!rack} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{t("racks.edit")}</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <Field label={t("common.name")}>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label={t("common.status")}>
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              {ACTIVE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`status.${s}`)}
                </option>
              ))}
            </Select>
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button loading={save.isPending} onClick={() => save.mutate(undefined)} disabled={!name.trim()}>
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RacksPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const canManage = can("warehouse.manage");
  const [zoneId, setZoneId] = React.useState("");
  const { data: zones = [] } = useApiQuery<ZoneDto[]>(["zones"], "/api/zones");
  const { data: racks, isLoading } = useApiQuery<RackDto[]>(["racks"], "/api/racks", { zoneId });
  const [creating, setCreating] = React.useState(false);
  const [editing, setEditing] = React.useState<RackDto | null>(null);
  const [deleting, setDeleting] = React.useState<RackDto | null>(null);
  const del = useApiMutation((id: string) => api.delete(`/api/racks/${id}`), { invalidate: [["racks"], ["zones"], ["warehouse-map"]], success: t("common.deleted"), onSuccess: () => setDeleting(null), onError: () => setDeleting(null) });

  return (
    <div>
      <PageHeader
        title={t("racks.title")}
        subtitle={t("racks.subtitle")}
        icon={<Columns3 />}
        actions={
          canManage && (
            <Button onClick={() => setCreating(true)} disabled={!zones.length}>
              <Plus /> {t("racks.new")}
            </Button>
          )
        }
      />
      <Card>
        <FilterBar>
          <Select value={zoneId} onChange={(e) => setZoneId(e.target.value)} className="sm:w-64">
            <option value="">
              {t("common.all")} — {t("common.zone").toLowerCase()}
            </option>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.code} · {z.name}
              </option>
            ))}
          </Select>
        </FilterBar>
        {isLoading ? (
          <LoadingBlock />
        ) : !racks?.length ? (
          <EmptyState />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>{t("common.zone")}</TH>
                <TH>{t("common.code")}</TH>
                <TH>{t("common.name")}</TH>
                <TH className="text-right">{t("racks.levelCount")}</TH>
                <TH className="text-right">{t("zones.binCount")}</TH>
                <TH className="w-56">{t("common.utilization")}</TH>
                <TH>{t("common.status")}</TH>
                <TH className="text-right">{t("common.actions")}</TH>
              </TR>
            </THead>
            <TBody>
              {racks.map((r) => (
                <TR key={r.id}>
                  <TD className="font-semibold">{r.zoneCode}</TD>
                  <TD className="font-mono">{r.code}</TD>
                  <TD>{r.name}</TD>
                  <TD className="text-right">{r.levelCount}</TD>
                  <TD className="text-right">{r.binCount}</TD>
                  <TD>
                    <div className="flex items-center gap-2">
                      <Progress value={r.utilization} tone={capacityTone(r.capacityStatus)} />
                      <span className="w-14 text-right text-xs tabular-nums">{formatPercent(r.utilization)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatNumber(r.used)} / {formatNumber(r.capacity)}
                    </p>
                  </TD>
                  <TD>
                    <div className="flex flex-col items-start gap-1">
                      <StatusBadge status={r.status} />
                      <CapacityBadge status={r.capacityStatus} />
                    </div>
                  </TD>
                  <TD className="text-right whitespace-nowrap">
                    <Button variant="ghost" size="icon-sm" asChild aria-label={t("racks.layout")}>
                      <Link to={`/warehouse/map?zone=${r.zoneId}&rack=${r.id}`}>
                        <MapIcon />
                      </Link>
                    </Button>
                    {canManage && (
                      <>
                        <Button variant="ghost" size="icon-sm" onClick={() => setEditing(r)} aria-label={t("common.edit")}>
                          <Pencil />
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => setDeleting(r)} aria-label={t("common.delete")}>
                          <Trash2 className="text-danger" />
                        </Button>
                      </>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
      {creating && <CreateRackDialog zones={zones} open={creating} onOpenChange={setCreating} />}
      <EditRackDialog rack={editing} onClose={() => setEditing(null)} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={t("common.areYouSure")}
        description={t("common.deleteConfirm")}
        variant="destructive"
        confirmLabel={t("common.delete")}
        loading={del.isPending}
        onConfirm={() => deleting && del.mutate(deleting.id)}
      />
    </div>
  );
}
