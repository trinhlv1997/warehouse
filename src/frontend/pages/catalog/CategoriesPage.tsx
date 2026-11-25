import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus, Tags, Trash2 } from "lucide-react";
import * as React from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { z } from "zod";
import { ACTIVE_STATUSES } from "@/shared/constants";
import { categoryInputSchema } from "@/shared/schemas";
import type { CategoryDto } from "@/shared/types";
import { ConfirmDialog, PageHeader } from "../../components/common";
import { StatusBadge } from "../../components/StatusBadge";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Field, Input, Select, Textarea } from "../../components/ui/form";
import { EmptyState, LoadingBlock } from "../../components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "../../components/ui/table";
import { applyServerErrors, useApiMutation, useApiQuery } from "../../hooks/useApi";
import { useAuth } from "../../hooks/useAuth";
import { api } from "../../services/api";

type FormIn = z.input<typeof categoryInputSchema>;
type FormOut = z.output<typeof categoryInputSchema>;

function CategoryDialog({ category, open, onOpenChange }: { category: CategoryDto | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation();
  const form = useForm<FormIn, unknown, FormOut>({ resolver: zodResolver(categoryInputSchema) });
  React.useEffect(() => {
    if (open) form.reset(category ? { code: category.code, name: category.name, description: category.description ?? "", status: category.status } : { code: "", name: "", description: "", status: "ACTIVE" });
  }, [open, category, form]);
  const save = useApiMutation((v: FormOut) => (category ? api.put(`/api/categories/${category.id}`, v) : api.post("/api/categories", v)), {
    invalidate: [["categories"]],
    success: t("common.saved"),
    onSuccess: () => onOpenChange(false),
    onError: (e) => applyServerErrors(e, form.setError as never),
  });
  const err = form.formState.errors;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <form onSubmit={form.handleSubmit((v) => save.mutate(v))}>
          <DialogHeader>
            <DialogTitle>{category ? t("categories.edit") : t("categories.new")}</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <Field label={t("common.code")} required error={err.code?.message}>
              <Input {...form.register("code")} />
            </Field>
            <Field label={t("common.name")} required error={err.name?.message}>
              <Input {...form.register("name")} />
            </Field>
            <Field label={t("common.description")}>
              <Textarea rows={2} {...form.register("description")} />
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

export function CategoriesPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const manage = can("product.manage");
  const { data, isLoading } = useApiQuery<CategoryDto[]>(["categories"], "/api/categories");
  const [editing, setEditing] = React.useState<CategoryDto | null>(null);
  const [open, setOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState<CategoryDto | null>(null);
  const del = useApiMutation((id: string) => api.delete(`/api/categories/${id}`), { invalidate: [["categories"]], success: t("common.deleted"), onSuccess: () => setDeleting(null), onError: () => setDeleting(null) });

  return (
    <div>
      <PageHeader
        title={t("categories.title")}
        subtitle={t("categories.subtitle")}
        icon={<Tags />}
        actions={
          manage && (
            <Button
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              <Plus /> {t("categories.new")}
            </Button>
          )
        }
      />
      <Card>
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
                <TH>{t("common.description")}</TH>
                <TH className="text-right">{t("categories.productCount")}</TH>
                <TH>{t("common.status")}</TH>
                {manage && <TH />}
              </TR>
            </THead>
            <TBody>
              {data.map((c) => (
                <TR key={c.id}>
                  <TD className="font-mono text-xs font-semibold">{c.code}</TD>
                  <TD className="font-medium">
                    <Link to={`/products?categoryId=${c.id}`} className="hover:text-primary">
                      {c.name}
                    </Link>
                  </TD>
                  <TD className="text-muted-foreground">{c.description ?? "—"}</TD>
                  <TD className="text-right">{c.productCount}</TD>
                  <TD>
                    <StatusBadge status={c.status} />
                  </TD>
                  {manage && (
                    <TD className="text-right whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                          setEditing(c);
                          setOpen(true);
                        }}
                        aria-label={t("common.edit")}
                      >
                        <Pencil />
                      </Button>
                      <Button variant="ghost" size="icon-sm" disabled={c.productCount > 0} onClick={() => setDeleting(c)} aria-label={t("common.delete")}>
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
      <CategoryDialog category={editing} open={open} onOpenChange={setOpen} />
      <ConfirmDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)} title={t("common.areYouSure")} description={t("common.deleteConfirm")} variant="destructive" confirmLabel={t("common.delete")} loading={del.isPending} onConfirm={() => deleting && del.mutate(deleting.id)} />
    </div>
  );
}
