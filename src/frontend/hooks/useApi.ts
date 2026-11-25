import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { PageMeta } from "@/shared/types";
import { ApiError, api } from "../services/api";

/** Translates an API error (by code) into a user-facing Vietnamese message. */
export function useErrorMessage() {
  const { t } = useTranslation();
  return React.useCallback(
    (error: unknown) => {
      if (error instanceof ApiError) {
        if (error.status === 0) return t("errors.network");
        return t(`errors.${error.code}`, { defaultValue: t("errors.INTERNAL_ERROR") });
      }
      return t("errors.INTERNAL_ERROR");
    },
    [t],
  );
}

type Query = Record<string, string | number | boolean | null | undefined>;

export function usePagedQuery<T>(key: QueryKey, path: string, query: Query, enabled = true) {
  return useQuery<{ items: T[]; meta: PageMeta }>({
    queryKey: [...key, query],
    queryFn: () => api.getPaged<T>(path, query),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useApiQuery<T>(key: QueryKey, path: string, query?: Query, enabled = true) {
  return useQuery<T>({ queryKey: [...key, query ?? {}], queryFn: () => api.get<T>(path, query), enabled });
}

/** Mutation with toast feedback and cache invalidation. */
export function useApiMutation<TInput, TResult = unknown>(
  fn: (input: TInput) => Promise<TResult>,
  options: { invalidate?: QueryKey[]; success?: string; onSuccess?: (result: TResult) => void; onError?: (error: unknown) => void } = {},
) {
  const queryClient = useQueryClient();
  const message = useErrorMessage();
  return useMutation({
    mutationFn: fn,
    onSuccess: (result) => {
      for (const key of options.invalidate ?? []) void queryClient.invalidateQueries({ queryKey: key });
      if (options.success) toast.success(options.success);
      options.onSuccess?.(result);
    },
    onError: (error) => {
      toast.error(message(error));
      options.onError?.(error);
    },
  });
}

export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

/** Applies server-side field errors (details[].field) to a react-hook-form instance. */
export function applyServerErrors(error: unknown, setError: (name: never, e: { message: string }) => void) {
  if (error instanceof ApiError && Array.isArray(error.details)) {
    for (const d of error.details as { field?: string; message?: string }[]) {
      if (d.field) setError(d.field as never, { message: d.message ?? "invalid" });
    }
  }
}
