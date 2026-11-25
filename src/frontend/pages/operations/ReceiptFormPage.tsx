import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowDownToLine, ArrowLeft, Plus, Trash2 } from "lucide-react";
import * as React from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router";
import type { z } from "zod";
import { receiptInputSchema } from "@/shared/schemas";
import type { ReceiptDto, SupplierDto } from "@/shared/types";
import { PageHeader } from "../../components/common";
import { BinPicker, ProductPicker } from "../../components/Pickers";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Field, Input, Select, Textarea, useFieldError } from "../../components/ui/form";
import { LoadingBlock } from "../../components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "../../components/ui/table";
import { applyServerErrors, useApiMutation, useApiQuery } from "../../hooks/useApi";
import { api } from "../../services/api";
import { todayVn } from "../../utils/format";

type FormIn = z.input<typeof receiptInputSchema>;
type FormOut = z.output<typeof receiptInputSchema>;

const emptyItem = { productId: "", lotNumber: "", manufacturingDate: "", expirationDate: "", binId: "", quantity: 1 } as FormIn["items"][number];

function CellError({ message }: { message?: string }) {
  const text = useFieldError(message);
  return text ? <p className="mt-0.5 text-[11px] text-danger">{text}</p> : null;
}

export function ReceiptFormPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const editing = !!id;
  const { data: existing, isLoading } = useApiQuery<ReceiptDto>(["receipt", id], `/api/stock-receipts/${id}`, undefined, editing);
  const { data: suppliers = [] } = useApiQuery<SupplierDto[]>(["suppliers"], "/api/suppliers");
  // display labels keyed by id (not by row index), so removing a row never shifts them
  const [productLabels, setProductLabels] = React.useState<Record<string, { label: string; unit: string }>>({});
  const [binLabels, setBinLabels] = React.useState<Record<string, string>>({});

  const form = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(receiptInputSchema),
    defaultValues: { supplierId: "", receiptDate: todayVn(), referenceNo: "", notes: "", items: [emptyItem] },
  });
  const items = useFieldArray({ control: form.control, name: "items" });

  React.useEffect(() => {
    if (!existing) return;
    form.reset({
      supplierId: existing.supplierId ?? "",
      receiptDate: existing.receiptDate,
      referenceNo: existing.referenceNo ?? "",
      notes: existing.notes ?? "",
      items: (existing.items ?? []).map((i) => ({ productId: i.productId, lotNumber: i.lotNumber, manufacturingDate: i.manufacturingDate ?? "", expirationDate: i.expirationDate ?? "", binId: i.binId, quantity: i.quantity })),
    });
    setProductLabels(Object.fromEntries((existing.items ?? []).map((i) => [i.productId, { label: `${i.productSku} — ${i.productName}`, unit: i.unit }])));
    setBinLabels(Object.fromEntries((existing.items ?? []).map((i) => [i.binId, i.locationCode])));
  }, [existing, form]);

  const save = useApiMutation((v: FormOut) => (editing ? api.put<ReceiptDto>(`/api/stock-receipts/${id}`, v) : api.post<ReceiptDto>("/api/stock-receipts", v)), {
    invalidate: [["receipts"], ["receipt"]],
    success: editing ? t("common.saved") : t("receipts.created"),
    onSuccess: (r) => navigate(`/receipts/${r.id}`),
    onError: (e) => applyServerErrors(e, form.setError as never),
  });

  if (editing && (isLoading || !existing)) return <LoadingBlock rows={8} />;
  const err = form.formState.errors;

  return (
    <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-4">
      <PageHeader
        title={editing ? `${t("receipts.edit")} ${existing?.receiptNumber ?? ""}` : t("receipts.new")}
        subtitle={t("receipts.lotHint")}
        icon={<ArrowDownToLine />}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to={editing ? `/receipts/${id}` : "/receipts"}>
                <ArrowLeft /> {t("common.back")}
              </Link>
            </Button>
            <Button type="submit" loading={save.isPending}>
              {t("receipts.saveDraft")}
            </Button>
          </>
        }
      />
      <Card>
        <CardContent className="grid gap-4 pt-5 sm:grid-cols-2 lg:grid-cols-4">
          <Field label={t("common.supplier")}>
            <Select {...form.register("supplierId")}>
              <option value="">{t("common.select")}</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("receipts.date")} required error={err.receiptDate?.message}>
            <Input type="date" {...form.register("receiptDate")} />
          </Field>
          <Field label={t("receipts.referenceNo")}>
            <Input {...form.register("referenceNo")} />
          </Field>
          <Field label={t("common.notes")}>
            <Textarea rows={1} {...form.register("notes")} className="min-h-9" />
          </Field>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("receipts.items")}</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={() => items.append(emptyItem)}>
            <Plus /> {t("common.addLine")}
          </Button>
        </CardHeader>
        <Table>
          <THead>
            <TR>
              <TH className="w-8">#</TH>
              <TH className="min-w-64">{t("common.product")} *</TH>
              <TH className="min-w-36">{t("lots.lotNumber")} *</TH>
              <TH>{t("common.manufacturingDate")}</TH>
              <TH>{t("common.expirationDate")}</TH>
              <TH className="min-w-52">{t("common.location")} *</TH>
              <TH className="w-28">{t("common.quantity")} *</TH>
              <TH />
            </TR>
          </THead>
          <TBody>
            {items.fields.map((field, index) => {
              const e = err.items?.[index];
              const productId = form.watch(`items.${index}.productId`);
              const binId = form.watch(`items.${index}.binId`);
              return (
                <TR key={field.id} className="align-top">
                  <TD className="pt-4 text-muted-foreground">{index + 1}</TD>
                  <TD>
                    <ProductPicker
                      value={productId || null}
                      valueLabel={productId ? productLabels[productId]?.label : undefined}
                      invalid={!!e?.productId}
                      onChange={(p) => {
                        form.setValue(`items.${index}.productId`, p.id, { shouldValidate: true });
                        setProductLabels((l) => ({ ...l, [p.id]: { label: `${p.sku} — ${p.name}`, unit: p.unit } }));
                      }}
                    />
                    {productId && productLabels[productId] && <p className="mt-0.5 text-[11px] text-muted-foreground">{t("common.unit")}: {productLabels[productId].unit}</p>}
                    <CellError message={e?.productId?.message} />
                  </TD>
                  <TD>
                    <Input {...form.register(`items.${index}.lotNumber`)} aria-invalid={!!e?.lotNumber} className="uppercase" />
                    <CellError message={e?.lotNumber?.message} />
                  </TD>
                  <TD>
                    <Input type="date" {...form.register(`items.${index}.manufacturingDate`)} className="w-36" />
                  </TD>
                  <TD>
                    <Input type="date" {...form.register(`items.${index}.expirationDate`)} aria-invalid={!!e?.expirationDate} className="w-36" />
                    <CellError message={e?.expirationDate?.message} />
                  </TD>
                  <TD>
                    <BinPicker
                      value={binId || null}
                      valueLabel={binId ? binLabels[binId] : undefined}
                      invalid={!!e?.binId}
                      onChange={(b) => {
                        form.setValue(`items.${index}.binId`, b.id, { shouldValidate: true });
                        setBinLabels((l) => ({ ...l, [b.id]: b.locationCode }));
                      }}
                    />
                  </TD>
                  <TD>
                    <Input type="number" min={1} {...form.register(`items.${index}.quantity`)} aria-invalid={!!e?.quantity} />
                    <CellError message={e?.quantity?.message} />
                  </TD>
                  <TD>
                    <Button type="button" variant="ghost" size="icon-sm" disabled={items.fields.length === 1} onClick={() => items.remove(index)} aria-label={t("common.remove")}>
                      <Trash2 className="text-danger" />
                    </Button>
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </Card>
    </form>
  );
}
