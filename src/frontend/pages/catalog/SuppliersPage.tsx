import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus, Trash2, Truck } from "lucide-react";
import * as React from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import type { z } from "zod";
import { ACTIVE_STATUSES } from "@/shared/constants";
import { supplierInputSchema } from "@/shared/schemas";
import type { SupplierDto } from "@/shared/types";
import { ConfirmDialog, FilterBar, PageHeader, SearchInput } from "../../components/common";
import { StatusBadge } from "../../components/StatusBadge";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Field, Input, Select } from "../../components/ui/form";
import { EmptyState, LoadingBlock } from "../../components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "../../components/ui/table";
import { applyServerErrors, useApiMutation, useApiQuery, useDebounced } from "../../hooks/useApi";
import { useAuth } from "../../hooks/useAuth";
import { api } from "../../services/api";

type FormIn = z.input<typeof supplierInputSchema>;
type FormOut = z.output<typeof supplierInputSchema>;

function SupplierDialog({ supplier, open, onOpenChange }: { supplier: SupplierDto | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation();
  const form = useForm<FormIn, unknown, FormOut>({ resolver: zodResolver(supplierInputSchema) });
  React.useEffect(() => {
    if (open)
      form.reset(
        supplier
          ? { ...supplier, contactName: supplier.contactName ?? "", phone: supplier.phone ?? "", email: supplier.email ?? "", address: supplier.address ?? "" }
          : { code: "", name: "", contactName: "", phone: "", email: "", address: "", status: "ACTIVE" },
      );
  }, [open, supplier, form]);
  const save = useApiMutation((v: FormOut) => (supplier ? api.put(`/api/suppliers/${supplier.id}`, v) : api.post("/api/suppliers", v)), {
    invalidate: [["suppliers"]],
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
            <DialogTitle>{supplier ? t("suppliers.edit") : t("suppliers.new")}</DialogTitle>
          </DialogHeader>
          <DialogBody className="grid gap-4 sm:grid-cols-2">
            <Field label={t("common.code")} required error={err.code?.message}>
              <Input {...form.register("code")} />
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
            <Field label={t("common.name")} required error={err.name?.message} className="sm:col-span-2">
              <Input {...form.register("name")} />
            </Field>
            <Field label={t("suppliers.contactName")}>
              <Input {...form.register("contactName")} />
            </Field>
            <Field label={t("suppliers.phone")}>
              <Input {...form.register("phone")} />
            </Field>
            <Field label={t("suppliers.email")} error={err.email?.message} className="sm:col-span-2">
              <Input type="email" {...form.register("email")} />
            </Field>
            <Field label={t("suppliers.address")} className="sm:col-span-2">
              <Input {...form.register("address")} />
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

export function SuppliersPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const manage = can("product.manage");
  const [search, setSearch] = React.useState("");
  const debounced = useDebounced(search);
  const { data, isLoading } = useApiQuery<SupplierDto[]>(["suppliers"], "/api/suppliers", { search: debounced });
  const [editing, setEditing] = React.useState<SupplierDto | null>(null);
  const [open, setOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState<SupplierDto | null>(null);
  const del = useApiMutation((id: string) => api.delete(`/api/suppliers/${id}`), { invalidate: [["suppliers"]], success: t("common.deleted"), onSuccess: () => setDeleting(null) });

  return (
    <div>
      <PageHeader
        title={t("suppliers.title")}
        subtitle={t("suppliers.subtitle")}
        icon={<Truck />}
        actions={
          manage && (
            <Button
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              <Plus /> {t("suppliers.new")}
            </Button>
          )
        }
      />
      <Card>
        <FilterBar>
          <SearchInput value={search} onChange={setSearch} />
        </FilterBar>
        {isLoading ? (
          <LoadingBlock />
        ) : !data?.length ? (
          <EmptyState />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>{t("common.code")}</TH>
                <TH>{t("common.name")}</TH>
                <TH>{t("suppliers.contactName")}</TH>
                <TH>{t("suppliers.phone")}</TH>
                <TH>{t("suppliers.email")}</TH>
                <TH>{t("common.status")}</TH>
                {manage && <TH />}
              </TR>
            </THead>
            <TBody>
              {data.map((s) => (
                <TR key={s.id}>
                  <TD className="font-mono text-xs font-semibold">{s.code}</TD>
                  <TD>
                    <p className="font-medium">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.address}</p>
                  </TD>
                  <TD>{s.contactName ?? "—"}</TD>
                  <TD className="whitespace-nowrap">{s.phone ?? "—"}</TD>
                  <TD>{s.email ?? "—"}</TD>
                  <TD>
                    <StatusBadge status={s.status} />
                  </TD>
                  {manage && (
                    <TD className="text-right whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                          setEditing(s);
                          setOpen(true);
                        }}
                        aria-label={t("common.edit")}
                      >
                        <Pencil />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => setDeleting(s)} aria-label={t("common.delete")}>
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
      <SupplierDialog supplier={editing} open={open} onOpenChange={setOpen} />
      <ConfirmDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)} title={t("common.areYouSure")} description={t("common.deleteConfirm")} variant="destructive" confirmLabel={t("common.delete")} loading={del.isPending} onConfirm={() => deleting && del.mutate(deleting.id)} />
    </div>
  );
}
