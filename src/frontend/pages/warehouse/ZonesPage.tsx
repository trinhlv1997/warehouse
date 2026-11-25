import { zodResolver } from "@hookform/resolvers/zod";
import { Grid3x3, Pencil, Plus, Trash2 } from "lucide-react";
import * as React from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { z } from "zod";
import { ACTIVE_STATUSES, ZONE_TYPES } from "@/shared/constants";
import { zoneInputSchema } from "@/shared/schemas";
import type { WarehouseDto, ZoneDto } from "@/shared/types";
import { ConfirmDialog, PageHeader } from "../../components/common";
import { CapacityBadge, StatusBadge, capacityTone } from "../../components/StatusBadge";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Field, Input, Select, Textarea } from "../../components/ui/form";
import { EmptyState, LoadingBlock, Progress } from "../../components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "../../components/ui/table";
import { applyServerErrors, useApiMutation, useApiQuery } from "../../hooks/useApi";
import { useAuth } from "../../hooks/useAuth";
import { api } from "../../services/api";
import { formatNumber, formatPercent } from "../../utils/format";

type FormIn = z.input<typeof zoneInputSchema>;
type FormOut = z.output<typeof zoneInputSchema>;

function ZoneDialog({ zone, warehouseId, open, onOpenChange }: { zone: ZoneDto | null; warehouseId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation();
  const form = useForm<FormIn, unknown, FormOut>({ resolver: zodResolver(zoneInputSchema) });
  React.useEffect(() => {
    if (open)
      form.reset(
        zone
          ? { ...zone, warehouseId: zone.warehouseId }
          : { warehouseId, code: "", name: "", zoneType: "GENERAL", description: "", status: "ACTIVE", mapX: 0, mapY: 0, mapWidth: 20, mapHeight: 20 },
      );
  }, [open, zone, warehouseId, form]);
  const save = useApiMutation((v: FormOut) => (zone ? api.put(`/api/zones/${zone.id}`, v) : api.post("/api/zones", v)), {
    invalidate: [["zones"], ["warehouse-map"]],
    success: t("common.saved"),
    onSuccess: () => onOpenChange(false),
    onError: (e) => applyServerErrors(e, form.setError as never),
  });
  const err = form.formState.errors;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={form.handleSubmit((v) => save.mutate(v))}>
          <DialogHeader>
            <DialogTitle>{zone ? t("zones.edit") : t("zones.new")}</DialogTitle>
          </DialogHeader>
          <DialogBody className="grid gap-4 sm:grid-cols-2">
            <Field label={t("common.code")} required error={err.code?.message}>
              <Input {...form.register("code")} disabled={!!zone} placeholder="F" />
            </Field>
            <Field label={t("common.name")} required error={err.name?.message}>
              <Input {...form.register("name")} />
            </Field>
            <Field label={t("zones.type")}>
              <Select {...form.register("zoneType")}>
                {ZONE_TYPES.map((z) => (
                  <option key={z} value={z}>
                    {t(`zoneType.${z}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("common.status")}>
              <Select {...form.register("status")}>
                {ACTIVE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(`status.${s}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("common.description")} className="sm:col-span-2">
              <Textarea {...form.register("description")} rows={2} />
            </Field>
            <div className="sm:col-span-2">
              <p className="mb-2 text-sm font-medium">{t("zones.mapPosition")}</p>
              <div className="grid grid-cols-4 gap-2">
                {(["mapX", "mapY", "mapWidth", "mapHeight"] as const).map((k) => (
                  <Field key={k} label={t(`zones.${k}`)} error={err[k]?.message}>
                    <Input type="number" {...form.register(k)} />
                  </Field>
                ))}
              </div>
            </div>
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

export function ZonesPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const canManage = can("warehouse.manage");
  const { data: zones, isLoading } = useApiQuery<ZoneDto[]>(["zones"], "/api/zones");
  const { data: warehouses } = useApiQuery<WarehouseDto[]>(["warehouses"], "/api/warehouses");
  const [editing, setEditing] = React.useState<ZoneDto | null>(null);
  const [open, setOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState<ZoneDto | null>(null);
  const del = useApiMutation((id: string) => api.delete(`/api/zones/${id}`), { invalidate: [["zones"], ["warehouse-map"]], success: t("common.deleted"), onSuccess: () => setDeleting(null) });

  return (
    <div>
      <PageHeader
        title={t("zones.title")}
        subtitle={t("zones.subtitle")}
        icon={<Grid3x3 />}
        actions={
          canManage && (
            <Button
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              <Plus /> {t("zones.new")}
            </Button>
          )
        }
      />
      <Card>
        {isLoading ? (
          <LoadingBlock />
        ) : !zones?.length ? (
          <EmptyState />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>{t("common.code")}</TH>
                <TH>{t("common.name")}</TH>
                <TH>{t("zones.type")}</TH>
                <TH className="text-right">{t("zones.rackCount")}</TH>
                <TH className="text-right">{t("zones.binCount")}</TH>
                <TH className="w-56">{t("common.utilization")}</TH>
                <TH>{t("common.status")}</TH>
                {canManage && <TH className="text-right">{t("common.actions")}</TH>}
              </TR>
            </THead>
            <TBody>
              {zones.map((z) => (
                <TR key={z.id}>
                  <TD>
                    <Badge variant="navy">{z.code}</Badge>
                  </TD>
                  <TD>
                    <Link to={`/warehouse/map?zone=${z.id}`} className="font-medium hover:text-primary">
                      {z.name}
                    </Link>
                    {z.description && <p className="text-xs text-muted-foreground">{z.description}</p>}
                  </TD>
                  <TD>{t(`zoneType.${z.zoneType}`)}</TD>
                  <TD className="text-right tabular-nums">{z.rackCount}</TD>
                  <TD className="text-right tabular-nums">{z.binCount}</TD>
                  <TD>
                    <div className="flex items-center gap-2">
                      <Progress value={z.utilization} tone={capacityTone(z.capacityStatus)} />
                      <span className="w-14 text-right text-xs tabular-nums">{formatPercent(z.utilization)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatNumber(z.used)} / {formatNumber(z.capacity)}
                    </p>
                  </TD>
                  <TD>
                    <div className="flex flex-col items-start gap-1">
                      <StatusBadge status={z.status} />
                      <CapacityBadge status={z.capacityStatus} />
                    </div>
                  </TD>
                  {canManage && (
                    <TD className="text-right">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                          setEditing(z);
                          setOpen(true);
                        }}
                        aria-label={t("common.edit")}
                      >
                        <Pencil />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => setDeleting(z)} disabled={z.rackCount > 0} aria-label={t("common.delete")}>
                        <Trash2 className="text-danger" />
                      </Button>
                    </TD>
                  )}
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
      {warehouses?.[0] && <ZoneDialog zone={editing} warehouseId={warehouses[0].id} open={open} onOpenChange={setOpen} />}
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
