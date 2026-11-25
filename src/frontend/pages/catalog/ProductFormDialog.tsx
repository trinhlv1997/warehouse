import { zodResolver } from "@hookform/resolvers/zod";
import * as React from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import type { z } from "zod";
import { PRODUCT_STATUSES } from "@/shared/constants";
import { productInputSchema } from "@/shared/schemas";
import type { CategoryDto, ProductDto } from "@/shared/types";
import { Button } from "../../components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Field, Input, Select, Textarea } from "../../components/ui/form";
import { applyServerErrors, useApiMutation, useApiQuery } from "../../hooks/useApi";
import { api } from "../../services/api";

type FormIn = z.input<typeof productInputSchema>;
type FormOut = z.output<typeof productInputSchema>;

export function ProductFormDialog({ product, open, onOpenChange }: { product: ProductDto | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation();
  const { data: categories = [] } = useApiQuery<CategoryDto[]>(["categories"], "/api/categories");
  const form = useForm<FormIn, unknown, FormOut>({ resolver: zodResolver(productInputSchema) });
  React.useEffect(() => {
    if (!open) return;
    form.reset(
      product
        ? {
            sku: product.sku,
            name: product.name,
            categoryId: product.categoryId ?? "",
            barcode: product.barcode ?? "",
            unit: product.unit,
            description: product.description ?? "",
            minStock: product.minStock,
            maxStock: product.maxStock ?? "",
            status: product.status,
          }
        : { sku: "", name: "", categoryId: "", barcode: "", unit: "", description: "", minStock: 0, maxStock: "", status: "ACTIVE" },
    );
  }, [open, product, form]);

  const save = useApiMutation((v: FormOut) => (product ? api.put(`/api/products/${product.id}`, v) : api.post("/api/products", v)), {
    invalidate: [["products"], ["product"], ["dashboard"]],
    success: t("common.saved"),
    onSuccess: () => onOpenChange(false),
    onError: (e) => applyServerErrors(e, form.setError as never),
  });
  const err = form.formState.errors;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <form onSubmit={form.handleSubmit((v) => save.mutate(v))}>
          <DialogHeader>
            <DialogTitle>{product ? t("products.edit") : t("products.new")}</DialogTitle>
          </DialogHeader>
          <DialogBody className="grid gap-4 sm:grid-cols-2">
            <Field label={t("products.sku")} required error={err.sku?.message}>
              <Input {...form.register("sku")} aria-invalid={!!err.sku} placeholder="SP033" />
            </Field>
            <Field label={t("products.barcode")} error={err.barcode?.message}>
              <Input {...form.register("barcode")} />
            </Field>
            <Field label={t("products.name")} required error={err.name?.message} className="sm:col-span-2">
              <Input {...form.register("name")} aria-invalid={!!err.name} />
            </Field>
            <Field label={t("common.category")} error={err.categoryId?.message}>
              <Select {...form.register("categoryId")}>
                <option value="">{t("common.select")}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("common.unit")} required error={err.unit?.message}>
              <Input {...form.register("unit")} aria-invalid={!!err.unit} placeholder="Thùng" />
            </Field>
            <Field label={t("products.minStock")} error={err.minStock?.message}>
              <Input type="number" min={0} {...form.register("minStock")} />
            </Field>
            <Field label={t("products.maxStock")} error={err.maxStock?.message}>
              <Input type="number" min={0} {...form.register("maxStock")} />
            </Field>
            <Field label={t("common.status")}>
              <Select {...form.register("status")}>
                {PRODUCT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(`status.${s}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("common.description")} className="sm:col-span-2">
              <Textarea rows={3} {...form.register("description")} />
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
