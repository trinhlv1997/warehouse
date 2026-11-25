import * as React from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../../utils/cn";

const fieldBase =
  "flex w-full rounded-md border border-input bg-white px-3 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-danger";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(fieldBase, "h-9 py-1", className)} {...props} />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(fieldBase, "min-h-[72px] py-2", className)} {...props} />
));
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...props }, ref) => (
  <select ref={ref} className={cn(fieldBase, "h-9 py-1 pr-8", className)} {...props}>
    {children}
  </select>
));
Select.displayName = "Select";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-sm font-medium text-slate-700", className)} {...props} />;
}

/** Translates zod/server validation messages (codes) into the current language. */
export function useFieldError(message?: string) {
  const { t, i18n } = useTranslation();
  if (!message) return undefined;
  if (i18n.exists(`validation.${message}`)) return t(`validation.${message}`);
  if (/^[A-Z_]+$/.test(message)) return t(`errors.${message}`, { defaultValue: t("validation.invalid") });
  if (message.startsWith("Too small") || message.includes(">=")) return t("validation.too_small");
  if (message.startsWith("Too big") || message.includes("<=")) return t("validation.too_big");
  if (message.startsWith("Invalid input: expected")) return t("validation.required");
  return t("validation.invalid");
}

export function Field({ label, error, hint, required, className, children }: { label?: React.ReactNode; error?: string; hint?: React.ReactNode; required?: boolean; className?: string; children: React.ReactNode }) {
  const translated = useFieldError(error);
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <Label>
          {label}
          {required && <span className="text-danger"> *</span>}
        </Label>
      )}
      {children}
      {translated ? <p className="text-xs text-danger">{translated}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
