import { Boxes } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";
import { EXPIRY_STATUSES, LOT_STATUSES, TRANSACTION_TYPES } from "@/shared/constants";
import type { InventoryPositionDto, InventoryTransactionDto, ZoneDto } from "@/shared/types";
import { FilterBar, PageHeader, SearchInput } from "../../components/common";
import { Card } from "../../components/ui/card";
import { Input, Select } from "../../components/ui/form";
import { LoadingBlock, Pagination, Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/misc";
import { useApiQuery, useDebounced, usePagedQuery } from "../../hooks/useApi";
import { PositionsTable, TransactionsTable } from "../catalog/ProductDetailPage";

function PositionsTab() {
  const { t } = useTranslation();
  const [search, setSearch] = React.useState("");
  const [zoneId, setZoneId] = React.useState("");
  const [lotStatus, setLotStatus] = React.useState("");
  const [expiryStatus, setExpiryStatus] = React.useState("");
  const [orderBy, setOrderBy] = React.useState("product");
  const [page, setPage] = React.useState(1);
  const debounced = useDebounced(search);
  React.useEffect(() => setPage(1), [debounced, zoneId, lotStatus, expiryStatus, orderBy]);
  const { data: zones = [] } = useApiQuery<ZoneDto[]>(["zones"], "/api/zones");
  const { data, isLoading } = usePagedQuery<InventoryPositionDto>(["inventory"], "/api/inventory", { search: debounced, zoneId, lotStatus, expiryStatus, orderBy, page, pageSize: 25 });
  return (
    <>
      <FilterBar>
        <SearchInput value={search} onChange={setSearch} />
        <Select value={zoneId} onChange={(e) => setZoneId(e.target.value)} className="sm:w-48">
          <option value="">{t("common.zone")}: {t("common.all")}</option>
          {zones.map((z) => (
            <option key={z.id} value={z.id}>
              {z.code} · {z.name}
            </option>
          ))}
        </Select>
        <Select value={lotStatus} onChange={(e) => setLotStatus(e.target.value)} className="sm:w-40">
          <option value="">{t("common.status")}: {t("common.all")}</option>
          {LOT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`status.${s}`)}
            </option>
          ))}
        </Select>
        <Select value={expiryStatus} onChange={(e) => setExpiryStatus(e.target.value)} className="sm:w-56">
          <option value="">{t("common.expirationDate")}: {t("common.all")}</option>
          {EXPIRY_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`expiry.${s}`)}
            </option>
          ))}
        </Select>
        <Select value={orderBy} onChange={(e) => setOrderBy(e.target.value)} className="sm:w-40">
          <option value="product">↕ {t("common.product")}</option>
          <option value="expiry">↕ {t("common.expirationDate")}</option>
          <option value="location">↕ {t("common.location")}</option>
        </Select>
      </FilterBar>
      {isLoading ? <LoadingBlock /> : <PositionsTable items={data?.items ?? []} />}
      <Pagination meta={data?.meta} onPageChange={setPage} />
    </>
  );
}

function TransactionsTab() {
  const { t } = useTranslation();
  const [type, setType] = React.useState("");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [page, setPage] = React.useState(1);
  React.useEffect(() => setPage(1), [type, from, to]);
  const { data, isLoading } = usePagedQuery<InventoryTransactionDto>(["transactions"], "/api/inventory/transactions", { type, from, to, page, pageSize: 25 });
  return (
    <>
      <FilterBar>
        <Select value={type} onChange={(e) => setType(e.target.value)} className="sm:w-48">
          <option value="">{t("inventory.type")}: {t("common.all")}</option>
          {TRANSACTION_TYPES.map((s) => (
            <option key={s} value={s}>
              {t(`txnType.${s}`)}
            </option>
          ))}
        </Select>
        <label className="flex items-center gap-2 text-sm">
          {t("common.from")}
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
        </label>
        <label className="flex items-center gap-2 text-sm">
          {t("common.to")}
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
        </label>
      </FilterBar>
      {isLoading ? <LoadingBlock /> : <TransactionsTable items={data?.items ?? []} />}
      <Pagination meta={data?.meta} onPageChange={setPage} />
    </>
  );
}

export function InventoryPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "transactions" ? "transactions" : "positions";
  return (
    <div>
      <PageHeader title={t("inventory.title")} subtitle={t("inventory.subtitle")} icon={<Boxes />} />
      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
        <TabsList className="mb-3">
          <TabsTrigger value="positions">{t("inventory.positions")}</TabsTrigger>
          <TabsTrigger value="transactions">{t("inventory.transactions")}</TabsTrigger>
        </TabsList>
        <Card>
          <TabsContent value="positions">
            <PositionsTab />
          </TabsContent>
          <TabsContent value="transactions">
            <TransactionsTab />
          </TabsContent>
        </Card>
      </Tabs>
    </div>
  );
}
