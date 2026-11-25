import { Archive, ArrowLeft, ImageUp, Package, Pencil, RotateCcw, Trash2 } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";
import type { InventoryPositionDto, InventoryTransactionDto, ProductDto } from "@/shared/types";
import { ConfirmDialog, InfoRow, PageHeader } from "../../components/common";
import { ExpiryBadge, StatusBadge } from "../../components/StatusBadge";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { EmptyState, LoadingBlock, Pagination, Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "../../components/ui/table";
import { useApiMutation, useApiQuery, usePagedQuery } from "../../hooks/useApi";
import { useAuth } from "../../hooks/useAuth";
import { api } from "../../services/api";
import { formatDate, formatDateTime, formatNumber } from "../../utils/format";
import { ProductFormDialog } from "./ProductFormDialog";
import { ProductThumb } from "./ProductsPage";

export function TransactionsTable({ items }: { items: InventoryTransactionDto[] }) {
  const { t } = useTranslation();
  if (!items.length) return <EmptyState />;
  return (
    <Table>
      <THead>
        <TR>
          <TH>{t("common.date")}</TH>
          <TH>{t("inventory.type")}</TH>
          <TH>{t("common.product")}</TH>
          <TH>{t("common.lot")}</TH>
          <TH>{t("common.location")}</TH>
          <TH className="text-right">{t("inventory.change")}</TH>
          <TH className="text-right">{t("inventory.balanceAfter")}</TH>
          <TH>{t("inventory.reference")}</TH>
          <TH>{t("common.createdBy")}</TH>
        </TR>
      </THead>
      <TBody>
        {items.map((tx) => {
          const link =
            tx.referenceType === "STOCK_RECEIPT" ? `/receipts/${tx.referenceId}` : tx.referenceType === "STOCK_ISSUE" ? `/issues/${tx.referenceId}` : tx.referenceType === "STOCK_TRANSFER" ? `/transfers/${tx.referenceId}` : `/stocktaking/${tx.referenceId}`;
          return (
            <TR key={tx.id}>
              <TD className="whitespace-nowrap text-xs">
                {formatDate(tx.transactionDate)}
                <p className="text-muted-foreground">{formatDateTime(tx.createdAt)}</p>
              </TD>
              <TD>
                <Badge variant={tx.quantityChange > 0 ? "success" : "warning"}>{t(`txnType.${tx.transactionType}`)}</Badge>
              </TD>
              <TD>
                <p className="font-medium">{tx.productSku}</p>
                <p className="max-w-48 truncate text-xs text-muted-foreground">{tx.productName}</p>
              </TD>
              <TD className="font-mono text-xs">{tx.lotNumber}</TD>
              <TD className="font-mono text-xs">{tx.locationCode}</TD>
              <TD className={`text-right font-semibold tabular-nums ${tx.quantityChange > 0 ? "text-success" : "text-warning"}`}>
                {tx.quantityChange > 0 ? "+" : ""}
                {formatNumber(tx.quantityChange)}
              </TD>
              <TD className="text-right tabular-nums">{formatNumber(tx.balanceAfter)}</TD>
              <TD>
                <Link to={link} className="font-mono text-xs text-primary hover:underline">
                  {tx.referenceNumber}
                </Link>
              </TD>
              <TD className="text-xs">{tx.createdByName ?? "—"}</TD>
            </TR>
          );
        })}
      </TBody>
    </Table>
  );
}

export function PositionsTable({ items, showProduct = true }: { items: InventoryPositionDto[]; showProduct?: boolean }) {
  const { t } = useTranslation();
  if (!items.length) return <EmptyState />;
  return (
    <Table>
      <THead>
        <TR>
          {showProduct && <TH>{t("common.product")}</TH>}
          <TH>{t("common.lot")}</TH>
          <TH>{t("common.location")}</TH>
          <TH>{t("common.manufacturingDate")}</TH>
          <TH>{t("common.expirationDate")}</TH>
          <TH>{t("common.status")}</TH>
          <TH className="text-right">{t("common.quantity")}</TH>
        </TR>
      </THead>
      <TBody>
        {items.map((p) => (
          <TR key={p.balanceId}>
            {showProduct && (
              <TD>
                <Link to={`/products/${p.productId}`} className="font-medium hover:text-primary">
                  {p.productSku}
                </Link>
                <p className="max-w-56 truncate text-xs text-muted-foreground">{p.productName}</p>
              </TD>
            )}
            <TD className="font-mono text-xs">{p.lotNumber}</TD>
            <TD>
              <p className="font-mono text-xs font-semibold">{p.locationCode}</p>
              <p className="text-xs text-muted-foreground">{p.zoneName}</p>
            </TD>
            <TD className="text-xs">{formatDate(p.manufacturingDate)}</TD>
            <TD>
              <div className="flex flex-col items-start gap-1">
                <span className="text-xs">{formatDate(p.expirationDate)}</span>
                <ExpiryBadge status={p.expiryStatus} days={p.daysToExpiry} />
              </div>
            </TD>
            <TD>
              <StatusBadge status={p.lotStatus} />
            </TD>
            <TD className="text-right font-semibold tabular-nums">
              {formatNumber(p.quantity)} <span className="text-xs font-normal text-muted-foreground">{p.unit}</span>
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}

export function ProductDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const { can } = useAuth();
  const { data: product, isLoading } = useApiQuery<ProductDto>(["product", id], `/api/products/${id}`);
  const { data: positions } = usePagedQuery<InventoryPositionDto>(["product-locations", id], `/api/products/${id}/locations`, {});
  const [histPage, setHistPage] = React.useState(1);
  const { data: history } = usePagedQuery<InventoryTransactionDto>(["product-history", id], `/api/products/${id}/history`, { page: histPage, pageSize: 20 });
  const [editOpen, setEditOpen] = React.useState(false);
  const [archiveOpen, setArchiveOpen] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const invalidate = [["product", id], ["products"]];
  const archive = useApiMutation(() => api.post(`/api/products/${id}/archive`), { invalidate, success: t("common.saved"), onSuccess: () => setArchiveOpen(false) });
  const restore = useApiMutation(() => api.post(`/api/products/${id}/restore`), { invalidate, success: t("common.saved") });
  const upload = useApiMutation(
    (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return api.upload(`/api/products/${id}/image`, form);
    },
    { invalidate, success: t("common.saved") },
  );
  const removeImage = useApiMutation(() => api.delete(`/api/products/${id}/image`), { invalidate, success: t("common.saved") });

  if (isLoading || !product) return <LoadingBlock rows={8} />;
  const manage = can("product.manage");

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${product.sku} · ${product.name}`}
        subtitle={product.categoryName ?? undefined}
        icon={<Package />}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/products">
                <ArrowLeft /> {t("common.back")}
              </Link>
            </Button>
            {manage && (
              <>
                <Button variant="outline" onClick={() => setEditOpen(true)}>
                  <Pencil /> {t("common.edit")}
                </Button>
                {product.status === "ARCHIVED" ? (
                  <Button variant="outline" onClick={() => restore.mutate(undefined)} loading={restore.isPending}>
                    <RotateCcw /> {t("products.restore")}
                  </Button>
                ) : (
                  <Button variant="outline" onClick={() => setArchiveOpen(true)}>
                    <Archive /> {t("products.archive")}
                  </Button>
                )}
              </>
            )}
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>{t("products.info")}</CardTitle>
            <StatusBadge status={product.status} />
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex items-center gap-4">
              <ProductThumb product={product} size="size-24" />
              {manage && (
                <div className="space-y-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) upload.mutate(f);
                      e.target.value = "";
                    }}
                  />
                  <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} loading={upload.isPending}>
                    <ImageUp /> {t("products.uploadImage")}
                  </Button>
                  {product.imageUrl && (
                    <Button size="sm" variant="ghost" onClick={() => removeImage.mutate(undefined)}>
                      <Trash2 className="text-danger" />
                    </Button>
                  )}
                  <p className="text-xs text-muted-foreground">{t("products.imageHint")}</p>
                </div>
              )}
            </div>
            <div className="divide-y">
              <InfoRow label={t("products.sku")}>{product.sku}</InfoRow>
              <InfoRow label={t("products.barcode")}>{product.barcode ?? "—"}</InfoRow>
              <InfoRow label={t("common.unit")}>{product.unit}</InfoRow>
              <InfoRow label={t("products.onHand")}>
                <span className={product.isLowStock ? "text-warning" : ""}>
                  {formatNumber(product.totalQuantity)} {product.unit}
                </span>
              </InfoRow>
              <InfoRow label={t("products.minStock")}>{formatNumber(product.minStock)}</InfoRow>
              <InfoRow label={t("products.maxStock")}>{formatNumber(product.maxStock)}</InfoRow>
              <InfoRow label={t("bins.lotCount")}>{product.lotCount}</InfoRow>
              <InfoRow label={t("common.createdAt")}>{formatDateTime(product.createdAt)}</InfoRow>
            </div>
            {product.description && <p className="mt-3 text-sm text-muted-foreground">{product.description}</p>}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <Tabs defaultValue="locations">
            <CardHeader>
              <TabsList>
                <TabsTrigger value="locations">{t("products.locations")}</TabsTrigger>
                <TabsTrigger value="history">{t("products.history")}</TabsTrigger>
              </TabsList>
            </CardHeader>
            <TabsContent value="locations">
              <PositionsTable items={positions?.items ?? []} showProduct={false} />
            </TabsContent>
            <TabsContent value="history">
              <TransactionsTable items={history?.items ?? []} />
              <Pagination meta={history?.meta} onPageChange={setHistPage} />
            </TabsContent>
          </Tabs>
        </Card>
      </div>
      <ProductFormDialog product={product} open={editOpen} onOpenChange={setEditOpen} />
      <ConfirmDialog open={archiveOpen} onOpenChange={setArchiveOpen} title={t("products.archive")} description={t("products.archiveConfirm")} loading={archive.isPending} onConfirm={() => archive.mutate(undefined)} />
    </div>
  );
}
