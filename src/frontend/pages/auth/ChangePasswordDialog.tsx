import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { changePasswordSchema, type ChangePasswordInput } from "@/shared/schemas";
import { Button } from "../../components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Field, Input } from "../../components/ui/form";
import { useErrorMessage } from "../../hooks/useApi";
import { useAuth } from "../../hooks/useAuth";
import { api } from "../../services/api";

export function ChangePasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation();
  const { clear } = useAuth();
  const message = useErrorMessage();
  const form = useForm<ChangePasswordInput>({ resolver: zodResolver(changePasswordSchema), defaultValues: { currentPassword: "", newPassword: "" } });
  const submit = form.handleSubmit(async (values) => {
    try {
      await api.post("/api/auth/change-password", values);
      toast.success(t("auth.passwordChanged"));
      onOpenChange(false);
      clear();
    } catch (e) {
      toast.error(message(e));
    }
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{t("auth.changePassword")}</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <Field label={t("auth.currentPassword")} error={form.formState.errors.currentPassword?.message}>
              <Input type="password" autoComplete="current-password" {...form.register("currentPassword")} />
            </Field>
            <Field label={t("auth.newPassword")} error={form.formState.errors.newPassword ? "passwordMin" : undefined} hint={t("validation.passwordMin")}>
              <Input type="password" autoComplete="new-password" {...form.register("newPassword")} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" loading={form.formState.isSubmitting}>
              {t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
