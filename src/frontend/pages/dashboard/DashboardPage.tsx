import { AlarmClock, Boxes, Gauge, Layers, LayoutDashboard, MapPin, Package, PackageX, Tags, TrendingDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DashboardDto } from "@/shared/types";
import { KpiCard, PageHeader } from "../../components/common";
import { CAPACITY_STYLE, EXPIRY_COLOR, ExpiryBadge } from "../../components/StatusBadge";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { EmptyState, Progress, Skeleton } from "../../components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "../../components/ui/table";
import { useApiQuery } from "../../hooks/useApi";
import { formatDate, formatDateTime, formatNumber, formatPercent } from "../../utils/format";

const CATEGORY_COLORS = ["#1d4ed8", "#0ea5e9", "#16a34a", "#f97316", "#a855f7", "#14b8a6", "#e11d48", "#64748b"];

function ChartCard({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent className="h-72">{children}</CardContent>
    </Card>
  );
}

export function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading } = useApiQuery<DashboardDto>(["dashboard"], "/api/dashboard");

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
          {Array.from({ length: 10 }, (_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  const tt = data.totals;
  const tooltipNumber = (v: unknown) => formatNumber(Number(v));
  const expiryData = data.expiryBreakdown.filter((e) => e.quantity > 0).map((e) => ({ ...e, name: t(`expiry.${e.status}`) }));
  const binData = data.binUtilization.map((b) => ({ ...b, name: t(`capacity.${b.status}`) }));

  return (
    <div className="space-y-5">
      <PageHeader title={t("dashboard.title")} subtitle={t("dashboard.subtitle", { date: formatDate(data.businessDate) })} icon={<LayoutDashboard />} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        <KpiCard label={t("dashboard.totalQuantity")} value={formatNumber(tt.quantity)} icon={<Boxes />} onClick={() => navigate("/inventory")} />
        <KpiCard label={t("dashboard.skuCount")} value={formatNumber(tt.skuCount)} icon={<Package />} tone="navy" onClick={() => navigate("/products")} />
        <KpiCard label={t("dashboard.categoryCount")} value={formatNumber(tt.categoryCount)} icon={<Tags />} tone="navy" onClick={() => navigate("/categories")} />
        <KpiCard label={t("dashboard.lotCount")} value={formatNumber(tt.lotCount)} icon={<Layers />} tone="navy" onClick={() => navigate("/lots")} />
        <KpiCard label={t("dashboard.binCount")} value={formatNumber(tt.binCount)} icon={<MapPin />} tone="navy" onClick={() => navigate("/warehouse/bins")} />
        <KpiCard
          label={t("dashboard.utilization")}
          value={formatPercent(tt.utilization)}
          icon={<Gauge />}
          tone={tt.utilization >= 90 ? "danger" : tt.utilization >= 80 ? "warning" : "success"}
          sub={<Progress value={tt.utilization} className="mt-1.5" tone={tt.utilization >= 90 ? "danger" : tt.utilization >= 80 ? "caution" : "success"} />}
          onClick={() => navigate("/warehouse/map")}
        />
        <KpiCard label={t("dashboard.expiringSoon")} value={formatNumber(tt.expiringSoonQuantity)} sub={t("dashboard.lots", { count: tt.expiringSoonLots })} icon={<AlarmClock />} tone="warning" onClick={() => navigate("/alerts/expiring")} />
        <KpiCard label={t("dashboard.expired")} value={formatNumber(tt.expiredQuantity)} sub={t("dashboard.lots", { count: tt.expiredLots })} icon={<PackageX />} tone="danger" onClick={() => navigate("/alerts/expired")} />
        <KpiCard label={t("dashboard.lowStock")} value={formatNumber(tt.lowStockProducts)} icon={<TrendingDown />} tone={tt.lowStockProducts ? "warning" : "success"} onClick={() => navigate("/products?lowStock=1")} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ChartCard title={t("dashboard.movements")}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.movements} margin={{ left: -10, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1d4ed8" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#1d4ed8" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gOut" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tickFormatter={(d: string) => formatDate(d).slice(0, 5)} fontSize={11} interval="preserveStartEnd" />
                <YAxis fontSize={11} tickFormatter={(v: number) => formatNumber(v)} />
                <Tooltip labelFormatter={(d) => formatDate(String(d))} formatter={tooltipNumber} />
                <Legend />
                <Area type="monotone" dataKey="inbound" name={t("dashboard.inbound")} stroke="#1d4ed8" fill="url(#gIn)" strokeWidth={2} />
                <Area type="monotone" dataKey="outbound" name={t("dashboard.outbound")} stroke="#f97316" fill="url(#gOut)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
        <ChartCard title={t("dashboard.expiryStatus")}>
          {expiryData.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={expiryData} dataKey="quantity" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                  {expiryData.map((e) => (
                    <Cell key={e.status} fill={EXPIRY_COLOR[e.status]} />
                  ))}
                </Pie>
                <Tooltip formatter={tooltipNumber} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState />
          )}
        </ChartCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard title={t("dashboard.byCategory")}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.byCategory} layout="vertical" margin={{ left: 10, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
              <XAxis type="number" fontSize={11} tickFormatter={(v: number) => formatNumber(v)} />
              <YAxis type="category" dataKey="name" width={120} fontSize={11} />
              <Tooltip formatter={tooltipNumber} />
              <Bar dataKey="quantity" name={t("common.quantity")} radius={[0, 4, 4, 0]}>
                {data.byCategory.map((_, i) => (
                  <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title={t("dashboard.byZone")}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.byZone} margin={{ left: -10, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="code" fontSize={11} />
              <YAxis fontSize={11} tickFormatter={(v: number) => formatNumber(v)} />
              <Tooltip formatter={tooltipNumber} labelFormatter={(code) => data.byZone.find((z) => z.code === code)?.name ?? String(code)} />
              <Legend />
              <Bar dataKey="quantity" name={t("common.quantity")} fill="#1d4ed8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="capacity" name={t("common.capacity")} fill="#cbd5e1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title={t("dashboard.binUtilization")}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={binData} dataKey="count" nameKey="name" outerRadius={90} label={({ value }) => formatNumber(Number(value))}>
                {binData.map((b) => (
                  <Cell key={b.status} fill={CAPACITY_STYLE[b.status].fill} />
                ))}
              </Pie>
              <Tooltip formatter={tooltipNumber} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlarmClock className="size-4 text-danger" />
              {t("dashboard.alerts")}
            </CardTitle>
            <Link to="/alerts/expiring" className="text-sm text-primary hover:underline">
              {t("dashboard.viewAll")}
            </Link>
          </CardHeader>
          {data.alerts.length ? (
            <Table>
              <THead>
                <TR>
                  <TH>{t("common.product")}</TH>
                  <TH>{t("common.lot")}</TH>
                  <TH>{t("common.location")}</TH>
                  <TH className="text-right">{t("common.quantity")}</TH>
                  <TH>{t("common.expirationDate")}</TH>
                </TR>
              </THead>
              <TBody>
                {data.alerts.map((a) => (
                  <TR key={a.balanceId}>
                    <TD>
                      <p className="font-medium">{a.productSku}</p>
                      <p className="max-w-48 truncate text-xs text-muted-foreground">{a.productName}</p>
                    </TD>
                    <TD className="font-mono text-xs">{a.lotNumber}</TD>
                    <TD className="font-mono text-xs">{a.locationCode}</TD>
                    <TD className="text-right tabular-nums">{formatNumber(a.quantity)}</TD>
                    <TD>
                      <div className="flex flex-col items-start gap-1">
                        <span className="text-xs">{formatDate(a.expirationDate)}</span>
                        <ExpiryBadge status={a.expiryStatus} days={a.daysToExpiry} />
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          ) : (
            <EmptyState />
          )}
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="size-4 text-warning" />
                {t("dashboard.lowStockList")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.lowStock.length === 0 && <EmptyState />}
              {data.lowStock.map((p) => (
                <Link key={p.id} to={`/products/${p.id}`} className="block rounded-md p-1 hover:bg-muted">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate">
                      <span className="font-medium">{p.sku}</span> · {p.name}
                    </span>
                    <span className="shrink-0 tabular-nums text-warning">
                      {formatNumber(p.quantity)} / {formatNumber(p.minStock)} {p.unit}
                    </span>
                  </div>
                  <Progress value={(p.quantity / p.minStock) * 100} tone="caution" className="mt-1.5" />
                </Link>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("dashboard.recent")}</CardTitle>
              <Link to="/inventory?tab=transactions" className="text-sm text-primary hover:underline">
                {t("dashboard.viewAll")}
              </Link>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.recentTransactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate">
                      <Badge variant={tx.quantityChange > 0 ? "success" : "warning"} className="mr-2">
                        {t(`txnType.${tx.transactionType}`)}
                      </Badge>
                      {tx.productSku} · <span className="font-mono text-xs">{tx.lotNumber}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {tx.referenceNumber} · {formatDateTime(tx.createdAt)}
                    </p>
                  </div>
                  <span className={tx.quantityChange > 0 ? "font-semibold text-success" : "font-semibold text-warning"}>
                    {tx.quantityChange > 0 ? "+" : ""}
                    {formatNumber(tx.quantityChange)}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
