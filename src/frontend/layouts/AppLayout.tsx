import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  AlarmClock,
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  BookOpen,
  BarChart3,
  Boxes,
  ChevronDown,
  ClipboardCheck,
  Columns3,
  Grid3x3,
  Hourglass,
  KeyRound,
  Languages,
  LayoutDashboard,
  LogOut,
  Map,
  Menu,
  Package,
  PackageX,
  Settings,
  Tags,
  Truck,
  UserCog,
  Warehouse,
  X,
  Layers,
} from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { NavLink, Outlet, useLocation } from "react-router";
import type { Permission } from "@/shared/constants";
import { ChangePasswordDialog } from "../pages/auth/ChangePasswordDialog";
import { Badge } from "../components/ui/badge";
import { useAuth } from "../hooks/useAuth";
import { changeLanguage } from "../i18n";
import { cn } from "../utils/cn";

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  permission?: Permission;
}
interface NavGroup {
  label?: string;
  items: NavItem[];
}

function useNavigation(): NavGroup[] {
  const { t } = useTranslation();
  return [
    { items: [{ to: "/", label: t("nav.overview"), icon: <LayoutDashboard />, permission: "dashboard.view" }] },
    {
      label: t("nav.warehouse"),
      items: [
        { to: "/warehouse/map", label: t("nav.warehouseMap"), icon: <Map />, permission: "warehouse.view" },
        { to: "/warehouse/zones", label: t("nav.zones"), icon: <Grid3x3 />, permission: "warehouse.view" },
        { to: "/warehouse/racks", label: t("nav.racks"), icon: <Columns3 />, permission: "warehouse.view" },
        { to: "/warehouse/bins", label: t("nav.bins"), icon: <Warehouse />, permission: "warehouse.view" },
      ],
    },
    {
      label: t("nav.goods"),
      items: [
        { to: "/products", label: t("nav.products"), icon: <Package />, permission: "product.view" },
        { to: "/categories", label: t("nav.categories"), icon: <Tags />, permission: "product.view" },
        { to: "/suppliers", label: t("nav.suppliers"), icon: <Truck />, permission: "product.view" },
        { to: "/lots", label: t("nav.lots"), icon: <Layers />, permission: "inventory.view" },
        { to: "/inventory", label: t("nav.inventory"), icon: <Boxes />, permission: "inventory.view" },
      ],
    },
    {
      label: t("nav.operations"),
      items: [
        { to: "/receipts", label: t("nav.receipts"), icon: <ArrowDownToLine />, permission: "inventory.view" },
        { to: "/issues", label: t("nav.issues"), icon: <ArrowUpFromLine />, permission: "inventory.view" },
        { to: "/transfers", label: t("nav.transfers"), icon: <ArrowLeftRight />, permission: "inventory.view" },
        { to: "/stocktaking", label: t("nav.stocktaking"), icon: <ClipboardCheck />, permission: "inventory.view" },
      ],
    },
    {
      label: t("nav.alerts"),
      items: [
        { to: "/alerts/expiring", label: t("nav.expiring"), icon: <AlarmClock />, permission: "inventory.view" },
        { to: "/alerts/expired", label: t("nav.expired"), icon: <PackageX />, permission: "inventory.view" },
        { to: "/alerts/slow-moving", label: t("nav.slowMoving"), icon: <Hourglass />, permission: "inventory.view" },
      ],
    },
    {
      items: [
        { to: "/reports", label: t("nav.reports"), icon: <BarChart3 />, permission: "report.view" },
        { to: "/users", label: t("nav.users"), icon: <UserCog />, permission: "user.manage" },
        { to: "/settings", label: t("nav.settings"), icon: <Settings />, permission: "dashboard.view" },
        { to: "/guide", label: t("nav.guide"), icon: <BookOpen /> },
      ],
    },
  ];
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation();
  const { can } = useAuth();
  const groups = useNavigation()
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.permission || can(i.permission)) }))
    .filter((g) => g.items.length);

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center gap-2.5 border-b border-white/10 px-5">
        <div className="rounded-lg bg-primary p-1.5 text-white">
          <Warehouse className="size-5" />
        </div>
        <div>
          <p className="text-[15px] font-bold leading-tight text-white">{t("app.name")}</p>
          <p className="text-[11px] text-sidebar-muted">{t("app.tagline")}</p>
        </div>
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4 scrollbar-thin">
        {groups.map((g, gi) => (
          <div key={gi}>
            {g.label && <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted">{g.label}</p>}
            <ul className="space-y-0.5">
              {g.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === "/"}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors [&_svg]:size-4 [&_svg]:shrink-0",
                        isActive ? "bg-sidebar-active font-medium text-white shadow-sm" : "hover:bg-sidebar-hover hover:text-white",
                      )
                    }
                  >
                    {item.icon}
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </div>
  );
}

function UserMenu() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const [pwOpen, setPwOpen] = React.useState(false);
  if (!user) return null;
  const initials = user.fullName
    .split(" ")
    .slice(-2)
    .map((s) => s[0])
    .join("");
  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted cursor-pointer">
          <span className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">{initials}</span>
          <span className="hidden text-left sm:block">
            <span className="block text-sm font-medium leading-tight">{user.fullName}</span>
            <span className="block text-xs text-muted-foreground">{user.roles.map((r) => t(`roles.${r}`)).join(", ")}</span>
          </span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content align="end" sideOffset={6} className="z-50 min-w-56 rounded-lg border bg-white p-1 shadow-lg">
            <div className="px-3 py-2">
              <p className="text-sm font-medium">{user.fullName}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
            <DropdownMenu.Separator className="my-1 h-px bg-border" />
            <DropdownMenu.Item className="flex cursor-pointer items-center gap-2 rounded px-3 py-2 text-sm outline-none hover:bg-muted" onSelect={() => changeLanguage(i18n.language === "vi" ? "en" : "vi")}>
              <Languages className="size-4" />
              {i18n.language === "vi" ? t("common.english") : t("common.vietnamese")}
            </DropdownMenu.Item>
            <DropdownMenu.Item className="flex cursor-pointer items-center gap-2 rounded px-3 py-2 text-sm outline-none hover:bg-muted" onSelect={() => setPwOpen(true)}>
              <KeyRound className="size-4" />
              {t("auth.changePassword")}
            </DropdownMenu.Item>
            <DropdownMenu.Item className="flex cursor-pointer items-center gap-2 rounded px-3 py-2 text-sm text-danger outline-none hover:bg-danger-soft" onSelect={() => void logout()}>
              <LogOut className="size-4" />
              {t("auth.logout")}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <ChangePasswordDialog open={pwOpen} onOpenChange={setPwOpen} />
    </>
  );
}

export function AppLayout() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const location = useLocation();
  React.useEffect(() => setMobileOpen(false), [location.pathname]);

  return (
    <div className="flex h-full">
      <aside className="hidden w-64 shrink-0 lg:block print:hidden">
        <div className="fixed inset-y-0 w-64">
          <Sidebar />
        </div>
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 shadow-xl">
            <Sidebar onNavigate={() => setMobileOpen(false)} />
            <button className="absolute right-3 top-4 rounded p-1 text-white/80 hover:bg-white/10" onClick={() => setMobileOpen(false)} aria-label={t("common.close")}>
              <X className="size-5" />
            </button>
          </div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 print:hidden items-center justify-between gap-3 border-b bg-white/95 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <button className="rounded-md p-2 hover:bg-muted lg:hidden" onClick={() => setMobileOpen(true)} aria-label="menu">
              <Menu className="size-5" />
            </button>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{user?.tenantName}</p>
            </div>
            {user?.tenantId === "tenant_demo" && <Badge variant="warning">{t("app.demoBadge")}</Badge>}
          </div>
          <UserMenu />
        </header>
        <main className="flex-1 bg-background px-4 py-5 sm:px-6 lg:px-8 print:bg-white print:p-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
