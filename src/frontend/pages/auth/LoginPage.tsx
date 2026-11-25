import { zodResolver } from "@hookform/resolvers/zod";
import { BellRing, Map as MapIcon, Timer, Warehouse } from "lucide-react";
import * as React from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Navigate, useLocation, useNavigate } from "react-router";
import { loginSchema, type LoginInput } from "@/shared/schemas";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Field, Input } from "../../components/ui/form";
import { useErrorMessage } from "../../hooks/useApi";
import { useAuth } from "../../hooks/useAuth";

const DEMO_PASSWORD = "Demo@123";
const DEMO_ACCOUNTS = [
  { email: "admin@demo.vn", role: "ADMIN" },
  { email: "manager@demo.vn", role: "WAREHOUSE_MANAGER" },
  { email: "staff@demo.vn", role: "WAREHOUSE_STAFF" },
] as const;

export function LoginPage() {
  const { t } = useTranslation();
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const errorMessage = useErrorMessage();
  const [serverError, setServerError] = React.useState<string | null>(null);
  const form = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });

  if (user) return <Navigate to={(location.state as { from?: string } | null)?.from ?? "/"} replace />;

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    try {
      await login(values.email, values.password);
      navigate((location.state as { from?: string } | null)?.from ?? "/", { replace: true });
    } catch (e) {
      setServerError(errorMessage(e));
    }
  });

  return (
    <div className="grid min-h-full lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-10 text-white lg:flex">
        <div className="absolute -right-24 -top-24 size-96 rounded-full bg-primary/30 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="rounded-lg bg-primary p-2">
            <Warehouse className="size-6" />
          </div>
          <div>
            <p className="text-xl font-bold">{t("app.name")}</p>
            <p className="text-sm text-slate-400">{t("app.tagline")}</p>
          </div>
        </div>
        <div className="relative space-y-6">
          <h2 className="max-w-md text-3xl font-bold leading-tight">{t("auth.subtitle")}</h2>
          <ul className="space-y-3 text-slate-300">
            {[
              { icon: <Timer className="size-5 text-blue-400" />, text: t("auth.features.fefo") },
              { icon: <MapIcon className="size-5 text-green-400" />, text: t("auth.features.map") },
              { icon: <BellRing className="size-5 text-orange-400" />, text: t("auth.features.alerts") },
            ].map((f) => (
              <li key={f.text} className="flex items-center gap-3">
                {f.icon}
                {f.text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-slate-500">© {new Date().getFullYear()} {t("app.name")}</p>
      </div>

      <div className="flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md space-y-6">
          <div className="flex items-center gap-3 lg:hidden">
            <div className="rounded-lg bg-primary p-2 text-white">
              <Warehouse className="size-6" />
            </div>
            <p className="text-xl font-bold">{t("app.name")}</p>
          </div>
          <div>
            <h1 className="text-2xl font-bold">{t("auth.title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground lg:hidden">{t("auth.subtitle")}</p>
          </div>
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <Field label={t("auth.email")} error={form.formState.errors.email?.message}>
              <Input type="email" autoComplete="username" {...form.register("email")} aria-invalid={!!form.formState.errors.email} />
            </Field>
            <Field label={t("auth.password")} error={form.formState.errors.password?.message}>
              <Input type="password" autoComplete="current-password" {...form.register("password")} aria-invalid={!!form.formState.errors.password} />
            </Field>
            {serverError && <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-red-800">{serverError}</p>}
            <Button type="submit" className="w-full" size="lg" loading={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? t("auth.loggingIn") : t("auth.login")}
            </Button>
          </form>

          <Card className="p-4">
            <p className="text-sm font-semibold">{t("auth.demoAccounts")}</p>
            <p className="mb-3 text-xs text-muted-foreground">{t("auth.demoHint", { password: DEMO_PASSWORD })}</p>
            <div className="space-y-2">
              {DEMO_ACCOUNTS.map((a) => (
                <div key={a.email} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{a.email}</p>
                    <p className="text-xs text-muted-foreground">{t(`roles.${a.role}`)}</p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      form.setValue("email", a.email);
                      form.setValue("password", DEMO_PASSWORD);
                    }}
                  >
                    {t("auth.useAccount")}
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
