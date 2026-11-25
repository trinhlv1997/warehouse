import { useQueryClient } from "@tanstack/react-query";
import { BookOpen, DatabaseZap, RotateCcw, Settings } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";
import type { TenantSettingsDto, WarehouseDto } from "@/shared/types";
import { ConfirmDialog, InfoRow, PageHeader } from "../../components/common";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Field, Input, Select } from "../../components/ui/form";
import { LoadingBlock } from "../../components/ui/misc";
import { useApiMutation, useApiQuery } from "../../hooks/useApi";
import { useAuth } from "../../hooks/useAuth";
import { changeLanguage } from "../../i18n";
import { api, apiUrl } from "../../services/api";

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const manage = can("settings.manage");
  const { data: settings, isLoading } = useApiQuery<TenantSettingsDto>(["settings"], "/api/settings");
  const { data: warehouses } = useApiQuery<WarehouseDto[]>(["warehouses"], "/api/warehouses", undefined, can("warehouse.view"));
  const warehouse = warehouses?.[0];
  const [form, setForm] = React.useState({ companyName: "", slowMovingDays: 90, nearCapacityPercent: 80 });
  const [wh, setWh] = React.useState({ name: "", address: "" });
  const [resetOpen, setResetOpen] = React.useState(false);

  React.useEffect(() => {
    if (settings) setForm({ companyName: settings.companyName, slowMovingDays: settings.slowMovingDays, nearCapacityPercent: settings.nearCapacityPercent });
  }, [settings]);
  React.useEffect(() => {
    if (warehouse) setWh({ name: warehouse.name, address: warehouse.address ?? "" });
  }, [warehouse]);

  const save = useApiMutation(
    async () => {
      await api.put("/api/settings", form);
      if (warehouse && can("warehouse.manage")) await api.put(`/api/warehouses/${warehouse.id}`, wh);
    },
    { invalidate: [["settings"], ["warehouses"], ["zones"], ["warehouse-map"]], success: t("common.saved") },
  );
  const reset = useApiMutation(() => api.post("/api/demo/reset"), {
    success: t("settings.resetDone"),
    onSuccess: () => {
      setResetOpen(false);
      void queryClient.invalidateQueries();
    },
    onError: () => setResetOpen(false),
  });

  if (isLoading || !settings) return <LoadingBlock rows={6} />;

  return (
    <div className="space-y-4">
      <PageHeader title={t("settings.title")} subtitle={t("settings.subtitle")} icon={<Settings />} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("settings.company")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label={t("settings.companyName")}>
              <Input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} disabled={!manage} />
            </Field>
            <Field label={t("settings.warehouseName")}>
              <Input value={wh.name} onChange={(e) => setWh({ ...wh, name: e.target.value })} disabled={!manage} />
            </Field>
            <Field label={t("settings.warehouseAddress")}>
              <Input value={wh.address} onChange={(e) => setWh({ ...wh, address: e.target.value })} disabled={!manage} />
            </Field>
            <p className="pt-2 text-sm font-semibold">{t("settings.alertConfig")}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("settings.slowMovingDays")}>
                <Input type="number" min={7} max={720} value={form.slowMovingDays} onChange={(e) => setForm({ ...form, slowMovingDays: Number(e.target.value) })} disabled={!manage} />
              </Field>
              <Field label={t("settings.nearCapacityPercent")}>
                <Input type="number" min={50} max={99} value={form.nearCapacityPercent} onChange={(e) => setForm({ ...form, nearCapacityPercent: Number(e.target.value) })} disabled={!manage} />
              </Field>
            </div>
            {manage && (
              <Button onClick={() => save.mutate(undefined)} loading={save.isPending}>
                {t("common.save")}
              </Button>
            )}
          </CardContent>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("settings.preferences")}</CardTitle>
            </CardHeader>
            <CardContent>
              <Field label={t("common.language")}>
                <Select value={i18n.language} onChange={(e) => changeLanguage(e.target.value as "vi" | "en")}>
                  <option value="vi">{t("common.vietnamese")}</option>
                  <option value="en">{t("common.english")}</option>
                </Select>
              </Field>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("settings.system")}</CardTitle>
            </CardHeader>
            <CardContent className="divide-y">
              <InfoRow label={t("settings.environment")}>
                <Badge variant="outline">{settings.appEnv}</Badge>
              </InfoRow>
              <InfoRow label={t("settings.databaseProvider")}>{settings.databaseProvider}</InfoRow>
              <InfoRow label={t("settings.storageProvider")}>{settings.storageAvailable ? settings.storageProvider : `${settings.storageProvider} (${t("settings.storageOff")})`}</InfoRow>
              <InfoRow label={t("settings.timezone")}>Asia/Ho_Chi_Minh (UTC+7)</InfoRow>
              <InfoRow label={t("settings.apiDocs")}>
                <a href={apiUrl("/api/docs")} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                  <BookOpen className="size-4" /> /api/docs
                </a>
              </InfoRow>
            </CardContent>
          </Card>
          {manage && settings.demoMode && (
            <Card className="border-warning/40">
              <CardHeader>
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <DatabaseZap className="size-4 text-warning" /> {t("settings.demo")}
                  </CardTitle>
                  <CardDescription>{t("settings.demoText")}</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <Button variant="warning" onClick={() => setResetOpen(true)}>
                  <RotateCcw /> {t("settings.resetDemo")}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      <ConfirmDialog open={resetOpen} onOpenChange={setResetOpen} title={t("settings.resetDemo")} description={t("settings.demoText")} variant="destructive" loading={reset.isPending} onConfirm={() => reset.mutate(undefined)} />
    </div>
  );
}
