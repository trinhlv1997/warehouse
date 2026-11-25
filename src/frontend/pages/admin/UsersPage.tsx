import { Pencil, Plus, ShieldCheck, UserCog } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { ACTIVE_STATUSES, ROLES, type ActiveStatus, type RoleCode } from "@/shared/constants";
import type { AuditLogDto, UserDto } from "@/shared/types";
import { FilterBar, PageHeader, SearchInput } from "../../components/common";
import { StatusBadge } from "../../components/StatusBadge";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Field, Input, Select } from "../../components/ui/form";
import { EmptyState, LoadingBlock, Pagination, Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "../../components/ui/table";
import { useApiMutation, useDebounced, usePagedQuery } from "../../hooks/useApi";
import { useAuth } from "../../hooks/useAuth";
import { api } from "../../services/api";
import { formatDateTime } from "../../utils/format";

function UserDialog({ user, open, onOpenChange }: { user: UserDto | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation();
  const [email, setEmail] = React.useState("");
  const [fullName, setFullName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [roles, setRoles] = React.useState<RoleCode[]>(["WAREHOUSE_STAFF"]);
  const [status, setStatus] = React.useState<ActiveStatus>("ACTIVE");
  React.useEffect(() => {
    if (!open) return;
    setEmail(user?.email ?? "");
    setFullName(user?.fullName ?? "");
    setPhone(user?.phone ?? "");
    setPassword("");
    setRoles(user?.roles ?? ["WAREHOUSE_STAFF"]);
    setStatus(user?.status ?? "ACTIVE");
  }, [open, user]);
  const save = useApiMutation(
    () => (user ? api.put(`/api/users/${user.id}`, { fullName, phone, roles, status, password }) : api.post("/api/users", { email, fullName, phone, password, roles, status })),
    { invalidate: [["users"]], success: t("common.saved"), onSuccess: () => onOpenChange(false) },
  );
  const passwordInvalid = (!user && password.length < 8) || (!!user && password.length > 0 && password.length < 8);
  const valid = fullName.trim() && roles.length && !passwordInvalid && (user || /\S+@\S+\.\S+/.test(email));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{user ? t("users.edit") : t("users.new")}</DialogTitle>
        </DialogHeader>
        <DialogBody className="grid gap-4 sm:grid-cols-2">
          <Field label={t("users.email")} required className="sm:col-span-2">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!!user} />
          </Field>
          <Field label={t("users.fullName")} required>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </Field>
          <Field label={t("users.phone")}>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Field label={user ? t("users.resetPassword") : t("users.password")} required={!user} hint={t("validation.passwordMin")} className="sm:col-span-2">
            <Input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={password.length > 0 && passwordInvalid} />
          </Field>
          <div className="space-y-2 sm:col-span-2">
            <p className="text-sm font-medium">{t("users.roles")}</p>
            {ROLES.map((r) => (
              <label key={r} className="flex cursor-pointer items-start gap-3 rounded-md border p-3 hover:bg-muted">
                <input type="checkbox" className="mt-0.5 size-4 accent-primary" checked={roles.includes(r)} onChange={(e) => setRoles((rs) => (e.target.checked ? [...rs, r] : rs.filter((x) => x !== r)))} />
                <span>
                  <span className="block text-sm font-medium">{t(`roles.${r}`)}</span>
                  <span className="block text-xs text-muted-foreground">{t(`users.permissions.${r}`)}</span>
                </span>
              </label>
            ))}
          </div>
          <Field label={t("common.status")}>
            <Select value={status} onChange={(e) => setStatus(e.target.value as ActiveStatus)}>
              {ACTIVE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`status.${s}`)}
                </option>
              ))}
            </Select>
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => save.mutate(undefined)} loading={save.isPending} disabled={!valid}>
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AuditTab() {
  const { t } = useTranslation();
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const debounced = useDebounced(search);
  React.useEffect(() => setPage(1), [debounced]);
  const { data, isLoading } = usePagedQuery<AuditLogDto>(["audit"], "/api/audit-logs", { search: debounced, page, pageSize: 30 });
  return (
    <>
      <FilterBar>
        <SearchInput value={search} onChange={setSearch} />
      </FilterBar>
      {isLoading ? (
        <LoadingBlock />
      ) : !data?.items.length ? (
        <EmptyState />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>{t("common.date")}</TH>
              <TH>{t("users.auditUser")}</TH>
              <TH>{t("users.auditAction")}</TH>
              <TH>{t("users.auditEntity")}</TH>
              <TH>{t("users.auditDetails")}</TH>
              <TH>{t("users.auditIp")}</TH>
            </TR>
          </THead>
          <TBody>
            {data.items.map((a) => (
              <TR key={a.id}>
                <TD className="whitespace-nowrap text-xs">{formatDateTime(a.createdAt)}</TD>
                <TD className="text-sm">{a.userName ?? "—"}</TD>
                <TD>
                  <Badge variant={a.action.includes("failed") ? "danger" : "outline"} className="font-mono">
                    {a.action}
                  </Badge>
                </TD>
                <TD className="text-xs">{a.entityType}</TD>
                <TD className="max-w-md truncate font-mono text-[11px] text-muted-foreground" title={a.details ?? ""}>
                  {a.details ?? "—"}
                </TD>
                <TD className="text-xs">{a.ipAddress ?? "—"}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
      <Pagination meta={data?.meta} onPageChange={setPage} />
    </>
  );
}

export function UsersPage() {
  const { t } = useTranslation();
  const { user: me } = useAuth();
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const debounced = useDebounced(search);
  const { data, isLoading } = usePagedQuery<UserDto>(["users"], "/api/users", { search: debounced, page, pageSize: 20 });
  const [editing, setEditing] = React.useState<UserDto | null>(null);
  const [open, setOpen] = React.useState(false);

  return (
    <div>
      <PageHeader
        title={t("users.title")}
        subtitle={t("users.subtitle")}
        icon={<UserCog />}
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus /> {t("users.new")}
          </Button>
        }
      />
      <Tabs defaultValue="accounts">
        <TabsList className="mb-3">
          <TabsTrigger value="accounts">{t("users.accounts")}</TabsTrigger>
          <TabsTrigger value="audit">{t("users.audit")}</TabsTrigger>
        </TabsList>
        <Card>
          <TabsContent value="accounts">
            <FilterBar>
              <SearchInput value={search} onChange={setSearch} />
            </FilterBar>
            {isLoading ? (
              <LoadingBlock />
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>{t("users.fullName")}</TH>
                    <TH>{t("users.email")}</TH>
                    <TH>{t("users.roles")}</TH>
                    <TH>{t("users.lastLogin")}</TH>
                    <TH>{t("common.status")}</TH>
                    <TH />
                  </TR>
                </THead>
                <TBody>
                  {data?.items.map((u) => (
                    <TR key={u.id}>
                      <TD className="font-medium">
                        {u.fullName}
                        {u.id === me?.id && <ShieldCheck className="ml-1 inline size-4 text-primary" />}
                        {u.phone && <p className="text-xs font-normal text-muted-foreground">{u.phone}</p>}
                      </TD>
                      <TD>{u.email}</TD>
                      <TD>
                        <div className="flex flex-wrap gap-1">
                          {u.roles.map((r) => (
                            <Badge key={r} variant={r === "ADMIN" ? "navy" : r === "WAREHOUSE_MANAGER" ? "default" : "muted"}>
                              {t(`roles.${r}`)}
                            </Badge>
                          ))}
                        </div>
                      </TD>
                      <TD className="text-xs">{formatDateTime(u.lastLoginAt)}</TD>
                      <TD>
                        <StatusBadge status={u.status} />
                      </TD>
                      <TD className="text-right">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => {
                            setEditing(u);
                            setOpen(true);
                          }}
                          aria-label={t("common.edit")}
                        >
                          <Pencil />
                        </Button>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
            <Pagination meta={data?.meta} onPageChange={setPage} />
          </TabsContent>
          <TabsContent value="audit">
            <AuditTab />
          </TabsContent>
        </Card>
      </Tabs>
      <UserDialog user={editing} open={open} onOpenChange={setOpen} />
    </div>
  );
}
