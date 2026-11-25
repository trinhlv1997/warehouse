import * as Popover from "@radix-ui/react-popover";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Loader2, Search } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { api } from "../services/api";
import { cn } from "../utils/cn";
import { formatNumber } from "../utils/format";
import { useDebounced } from "../hooks/useApi";

interface Option<T> {
  id: string;
  label: string;
  sub?: string;
  disabled?: boolean;
  /** The original API item, so selection never depends on a separate lookup cache. */
  item: T;
}

/**
 * Async search-as-you-type combobox. The list is rendered in a portal (Radix Popover), so it is
 * never clipped by scrolling tables or cards, and works inside dialogs. Keyboard: ↑ ↓ Enter Esc.
 */
function AsyncCombobox<T>({
  value,
  valueLabel,
  onChange,
  fetchItems,
  toOption,
  queryKey,
  placeholder,
  searchPlaceholder,
  invalid,
}: {
  value: string | null;
  valueLabel?: string;
  onChange: (item: T) => void;
  fetchItems: (search: string) => Promise<T[]>;
  toOption: (item: T) => Omit<Option<T>, "item">;
  queryKey: string;
  placeholder?: string;
  searchPlaceholder?: string;
  invalid?: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [active, setActive] = React.useState(0);
  const debounced = useDebounced(search.trim(), 250);
  const listRef = React.useRef<HTMLUListElement>(null);
  const { data: items = [], isFetching, isError } = useQuery({ queryKey: [queryKey, debounced], queryFn: () => fetchItems(debounced), enabled: open, staleTime: 10_000 });
  const options: Option<T>[] = items.map((item) => ({ ...toOption(item), item }));
  const [selectedLabel, setSelectedLabel] = React.useState<string | undefined>(valueLabel);

  React.useEffect(() => setSelectedLabel(valueLabel), [valueLabel]);
  React.useEffect(() => setActive(0), [debounced, items.length]);
  React.useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const choose = (option: Option<T> | undefined) => {
    if (!option || option.disabled) return;
    setSelectedLabel(option.label);
    onChange(option.item);
    setOpen(false);
    setSearch("");
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(options.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault(); // never submit the surrounding form
      choose(options[active]);
    }
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-invalid={invalid}
          aria-expanded={open}
          className="flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-input bg-white px-3 text-left text-sm transition-colors hover:border-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 aria-[invalid=true]:border-danger"
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>{value ? (selectedLabel ?? value) : (placeholder ?? t("common.select"))}</span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          collisionPadding={8}
          className="z-[60] w-[max(var(--radix-popover-trigger-width),300px)] max-w-[calc(100vw-16px)] rounded-md border bg-white shadow-lg"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="relative border-b">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              className="w-full rounded-t-md py-2 pl-8 pr-8 text-sm outline-none"
              placeholder={searchPlaceholder ?? t("common.typeToSearch")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={onKeyDown}
            />
            {isFetching && <Loader2 className="absolute right-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
          </div>
          <ul ref={listRef} role="listbox" className="max-h-72 overflow-y-auto py-1 scrollbar-thin">
            {isError && <li className="px-3 py-2 text-sm text-danger">{t("errors.INTERNAL_ERROR")}</li>}
            {!isError && isFetching && options.length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">{t("common.loading")}</li>}
            {!isError && !isFetching && options.length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">{t("common.noResults")}</li>}
            {options.map((o, index) => (
              <li key={o.id} role="option" aria-selected={o.id === value} aria-disabled={o.disabled}>
                <button
                  type="button"
                  data-index={index}
                  disabled={o.disabled}
                  className={cn(
                    "flex w-full items-start gap-2 px-3 py-1.5 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50",
                    index === active ? "bg-primary-soft" : "hover:bg-muted",
                  )}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(o)}
                >
                  <Check className={cn("mt-0.5 size-4 shrink-0", o.id === value ? "text-primary opacity-100" : "opacity-0")} />
                  <span className="min-w-0">
                    <span className="block truncate">{o.label}</span>
                    {o.sub && <span className="block text-xs text-muted-foreground">{o.sub}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export interface ProductOption {
  id: string;
  sku: string;
  name: string;
  unit: string;
  available: number;
}

export function ProductPicker({ value, valueLabel, onChange, invalid }: { value: string | null; valueLabel?: string; onChange: (p: ProductOption) => void; invalid?: boolean }) {
  const { t } = useTranslation();
  return (
    <AsyncCombobox<ProductOption>
      value={value}
      valueLabel={valueLabel}
      invalid={invalid}
      placeholder={t("common.pickProduct")}
      searchPlaceholder={t("common.productSearchHint")}
      queryKey="product-options"
      fetchItems={(search) => api.get<ProductOption[]>("/api/products/options", { search })}
      toOption={(p) => ({ id: p.id, label: `${p.sku} — ${p.name}`, sub: `${t("products.onHand")}: ${formatNumber(p.available)} ${p.unit}` })}
      onChange={onChange}
    />
  );
}

export interface BinOption {
  id: string;
  locationCode: string;
  capacity: number;
  used: number;
}

export function BinPicker({ value, valueLabel, onChange, invalid, excludeId }: { value: string | null; valueLabel?: string; onChange: (b: BinOption) => void; invalid?: boolean; excludeId?: string }) {
  const { t } = useTranslation();
  return (
    <AsyncCombobox<BinOption>
      value={value}
      valueLabel={valueLabel}
      invalid={invalid}
      placeholder={t("common.pickBin")}
      searchPlaceholder={t("common.binSearchHint")}
      queryKey={`bin-options:${excludeId ?? ""}`}
      fetchItems={async (search) => (await api.get<BinOption[]>("/api/bins/options", { search })).filter((b) => b.id !== excludeId)}
      toOption={(b) => ({
        id: b.id,
        label: b.locationCode,
        sub: `${t("map.free", { count: formatNumber(b.capacity - b.used) } as never)} / ${formatNumber(b.capacity)}`,
        disabled: b.used >= b.capacity,
      })}
      onChange={onChange}
    />
  );
}
