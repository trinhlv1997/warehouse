import { Package, Pencil, Plus } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";
import type { CategoryDto, ProductDto } from "@/shared/types";
import { FilterBar, PageHeader, SearchInput } from "../../components/common";
import { StatusBadge } from "../../components/StatusBadge";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Select } from "../../components/ui/form";
import { EmptyState, LoadingBlock, Pagination } from "../../components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "../../components/ui/table";
import { useApiQuery, useDebounced, usePagedQuery } from "../../hooks/useApi";
import { useAuth } from "../../hooks/useAuth";
import { formatNumber } from "../../utils/format";
import { ProductFormDialog } from "./ProductFormDialog";

export function ProductThumb({ product, size = "size-10" }: { product: Pick<ProductDto, "imageUrl" | "name">; size?: string }) {
  return product.imageUrl ? (
    <img src={product.imageUrl} alt={product.name} className={`${size} shrink-0 rounded-md border object-cover`} loading="lazy" />
  ) : (
    <div className={`${size} flex shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary`}>
      <Package className="size-1/2" />
    </div>
  );
}

export function ProductsPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = React.useState(params.get("search") ?? "");
  const [page, setPage] = React.useState(1);
  const categoryId = params.get("categoryId") ?? "";
  const status = params.get("status") ?? "";
  const lowStock = params.get("lowStock") === "1";
  const debounced = useDebounced(search);
  React.useEffect(() => setPage(1), [debounced, categoryId, status, lowStock]);

  const setParam = (k: string, v: string) => {
    const p = new URLSearchParams(params);
    if (v) p.set(k, v);
    else p.delete(k);
    setParams(p, { replace: true });
  };

  const { data: categories = [] } = useApiQuery<CategoryDto[]>(["categories"], "/api/categories");
  const { data, isLoading } = usePagedQuery<ProductDto>(["products"], "/api/products", { search: debounced, categoryId, status, lowStock, page, pageSize: 20 });
  const [editing, setEditing] = React.useState<ProductDto | null>(null);
  const [open, setOpen] = React.useState(false);

  return (
    <div>
      <PageHeader
        title={t("products.title")}
        subtitle={t("products.subtitle")}
        icon={<Package />}
        actions={
          can("product.manage") && (
            <Button
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              <Plus /> {t("products.new")}
            </Button>
          )
        }
      />
      <Card>
        <FilterBar>
          <SearchInput value={search} onChange={setSearch} />
          <Select value={categoryId} onChange={(e) => setParam("categoryId", e.target.value)} className="sm:w-52">
            <option value="">{t("common.category")}: {t("common.all")}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select value={status} onChange={(e) => setParam("status", e.target.value)} className="sm:w-44">
            <option value="">{t("common.status")}: {t("common.all")}</option>
            {["ACTIVE", "INACTIVE", "ARCHIVED"].map((s) => (
              <option key={s} value={s}>
                {t(`status.${s}`)}
              </option>
            ))}
          </Select>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={lowStock} onChange={(e) => setParam("lowStock", e.target.checked ? "1" : "")} className="size-4 accent-primary" />
            {t("products.lowStockOnly")}
          </label>
        </FilterBar>
        {isLoading ? (
          <LoadingBlock />
        ) : !data?.items.length ? (
          <EmptyState />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>{t("common.product")}</TH>
                <TH>{t("products.barcode")}</TH>
                <TH>{t("common.category")}</TH>
                <TH>{t("common.unit")}</TH>
                <TH className="text-right">{t("products.onHand")}</TH>
                <TH className="text-right">{t("products.minStock")}</TH>
                <TH className="text-right">{t("bins.lotCount")}</TH>
                <TH>{t("common.status")}</TH>
                {can("product.manage") && <TH />}
              </TR>
            </THead>
            <TBody>
              {data.items.map((p) => (
                <TR key={p.id}>
                  <TD>
                    <Link to={`/products/${p.id}`} className="flex items-center gap-3 hover:text-primary">
                      <ProductThumb product={p} />
                      <span className="min-w-0">
                        <span className="block font-semibold">{p.sku}</span>
                        <span className="block max-w-xs truncate text-xs text-muted-foreground">{p.name}</span>
                      </span>
                    </Link>
                  </TD>
                  <TD className="font-mono text-xs">{p.barcode ?? "—"}</TD>
                  <TD>{p.categoryName ?? "—"}</TD>
                  <TD>{p.unit}</TD>
                  <TD className="text-right tabular-nums">
                    <span className={p.isLowStock ? "font-semibold text-warning" : "font-semibold"}>{formatNumber(p.totalQuantity)}</span>
                    {p.isLowStock && (
                      <Badge variant="warning" className="ml-2">
                        {t("products.lowStock")}
                      </Badge>
                    )}
                  </TD>
                  <TD className="text-right tabular-nums text-muted-foreground">{formatNumber(p.minStock)}</TD>
                  <TD className="text-right">{p.lotCount}</TD>
                  <TD>
                    <StatusBadge status={p.status} />
                  </TD>
                  {can("product.manage") && (
                    <TD className="text-right">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                          setEditing(p);
                          setOpen(true);
                        }}
                        aria-label={t("common.edit")}
                      >
                        <Pencil />
                      </Button>
                    </TD>
                  )}
                </TR>
              ))}
            </TBody>
          </Table>
        )}
        <Pagination meta={data?.meta} onPageChange={setPage} />
      </Card>
      <ProductFormDialog product={editing} open={open} onOpenChange={setOpen} />
    </div>
  );
}
