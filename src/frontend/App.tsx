import * as React from "react";
import { useTranslation } from "react-i18next";
import { createBrowserRouter, Link, Navigate, Outlet, RouterProvider, useLocation } from "react-router";
import type { Permission } from "@/shared/constants";
import { Button } from "./components/ui/button";
import { Spinner } from "./components/ui/misc";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { AppLayout } from "./layouts/AppLayout";
import { LoginPage } from "./pages/auth/LoginPage";

// Route-level code splitting keeps the initial bundle small.
const lazy = <T,>(loader: () => Promise<T>, name: keyof T) =>
  React.lazy(async () => ({ default: (await loader())[name] as unknown as React.ComponentType }));

const DashboardPage = lazy(() => import("./pages/dashboard/DashboardPage"), "DashboardPage");
const WarehouseMapPage = lazy(() => import("./pages/warehouse/WarehouseMapPage"), "WarehouseMapPage");
const ZonesPage = lazy(() => import("./pages/warehouse/ZonesPage"), "ZonesPage");
const RacksPage = lazy(() => import("./pages/warehouse/RacksPage"), "RacksPage");
const BinsPage = lazy(() => import("./pages/warehouse/BinsPage"), "BinsPage");
const ProductsPage = lazy(() => import("./pages/catalog/ProductsPage"), "ProductsPage");
const ProductDetailPage = lazy(() => import("./pages/catalog/ProductDetailPage"), "ProductDetailPage");
const CategoriesPage = lazy(() => import("./pages/catalog/CategoriesPage"), "CategoriesPage");
const SuppliersPage = lazy(() => import("./pages/catalog/SuppliersPage"), "SuppliersPage");
const LotsPage = lazy(() => import("./pages/inventory/LotsPage"), "LotsPage");
const InventoryPage = lazy(() => import("./pages/inventory/InventoryPage"), "InventoryPage");
const AlertsPage = lazy(() => import("./pages/inventory/AlertsPage"), "AlertsPage");
const ReceiptsPage = lazy(() => import("./pages/operations/ReceiptsPage"), "ReceiptsPage");
const ReceiptFormPage = lazy(() => import("./pages/operations/ReceiptFormPage"), "ReceiptFormPage");
const ReceiptDetailPage = lazy(() => import("./pages/operations/ReceiptDetailPage"), "ReceiptDetailPage");
const IssuesPage = lazy(() => import("./pages/operations/IssuesPage"), "IssuesPage");
const IssueCreatePage = lazy(() => import("./pages/operations/IssueCreatePage"), "IssueCreatePage");
const IssueDetailPage = lazy(() => import("./pages/operations/IssueDetailPage"), "IssueDetailPage");
const TransfersPage = lazy(() => import("./pages/operations/TransfersPage"), "TransfersPage");
const TransferCreatePage = lazy(() => import("./pages/operations/TransferCreatePage"), "TransferCreatePage");
const TransferDetailPage = lazy(() => import("./pages/operations/TransferDetailPage"), "TransferDetailPage");
const StocktakingPage = lazy(() => import("./pages/operations/StocktakingPage"), "StocktakingPage");
const StocktakingDetailPage = lazy(() => import("./pages/operations/StocktakingDetailPage"), "StocktakingDetailPage");
const ReportsPage = lazy(() => import("./pages/reports/ReportsPage"), "ReportsPage");
const UsersPage = lazy(() => import("./pages/admin/UsersPage"), "UsersPage");
const SettingsPage = lazy(() => import("./pages/admin/SettingsPage"), "SettingsPage");
const GuidePage = lazy(() => import("./pages/guide/GuidePage"), "GuidePage");

function FullScreenLoader() {
  return (
    <div className="flex h-full items-center justify-center">
      <Spinner className="size-8" />
    </div>
  );
}

function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <Outlet />;
}

function Guard({ permission, children }: { permission: Permission; children: React.ReactNode }) {
  const { t } = useTranslation();
  const { can } = useAuth();
  if (!can(permission)) return <p className="rounded-lg border bg-white p-6 text-sm text-muted-foreground">{t("common.noPermission")}</p>;
  return <React.Suspense fallback={<FullScreenLoader />}>{children}</React.Suspense>;
}

function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center gap-4 py-20 text-center">
      <p className="text-6xl font-bold text-primary">404</p>
      <p className="text-lg font-semibold">{t("notFound.title")}</p>
      <Button asChild>
        <Link to="/">{t("notFound.back")}</Link>
      </Button>
    </div>
  );
}

const g = (permission: Permission, element: React.ReactNode) => <Guard permission={permission}>{element}</Guard>;

const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: g("dashboard.view", <DashboardPage />) },
          { path: "warehouse/map", element: g("warehouse.view", <WarehouseMapPage />) },
          { path: "warehouse/zones", element: g("warehouse.view", <ZonesPage />) },
          { path: "warehouse/racks", element: g("warehouse.view", <RacksPage />) },
          { path: "warehouse/bins", element: g("warehouse.view", <BinsPage />) },
          { path: "products", element: g("product.view", <ProductsPage />) },
          { path: "products/:id", element: g("product.view", <ProductDetailPage />) },
          { path: "categories", element: g("product.view", <CategoriesPage />) },
          { path: "suppliers", element: g("product.view", <SuppliersPage />) },
          { path: "lots", element: g("inventory.view", <LotsPage />) },
          { path: "inventory", element: g("inventory.view", <InventoryPage />) },
          { path: "alerts/:type", element: g("inventory.view", <AlertsPage />) },
          { path: "receipts", element: g("inventory.view", <ReceiptsPage />) },
          { path: "receipts/new", element: g("receipt.create", <ReceiptFormPage />) },
          { path: "receipts/:id/edit", element: g("receipt.create", <ReceiptFormPage />) },
          { path: "receipts/:id", element: g("inventory.view", <ReceiptDetailPage />) },
          { path: "issues", element: g("inventory.view", <IssuesPage />) },
          { path: "issues/new", element: g("issue.create", <IssueCreatePage />) },
          { path: "issues/:id", element: g("inventory.view", <IssueDetailPage />) },
          { path: "transfers", element: g("inventory.view", <TransfersPage />) },
          { path: "transfers/new", element: g("transfer.create", <TransferCreatePage />) },
          { path: "transfers/:id", element: g("inventory.view", <TransferDetailPage />) },
          { path: "stocktaking", element: g("inventory.view", <StocktakingPage />) },
          { path: "stocktaking/:id", element: g("inventory.view", <StocktakingDetailPage />) },
          { path: "reports", element: g("report.view", <ReportsPage />) },
          { path: "users", element: g("user.manage", <UsersPage />) },
          { path: "settings", element: g("dashboard.view", <SettingsPage />) },
          {
            path: "guide",
            element: (
              <React.Suspense fallback={<FullScreenLoader />}>
                <GuidePage />
              </React.Suspense>
            ),
          },
          { path: "*", element: <NotFound /> },
        ],
      },
    ],
  },
]);

export function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
