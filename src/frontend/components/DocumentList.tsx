import * as React from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { FilterBar, SearchInput } from "./common";
import { Card } from "./ui/card";
import { Input, Select } from "./ui/form";
import { EmptyState, LoadingBlock, Pagination } from "./ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "./ui/table";
import { useDebounced, usePagedQuery } from "../hooks/useApi";

export interface DocColumn<T> {
  header: string;
  cell: (row: T) => React.ReactNode;
  className?: string;
}

/** Paged list of stock documents with search, status and date-range filters. */
export function DocumentList<T extends { id: string }>({ queryKey, path, statuses, columns, linkPrefix }: { queryKey: string; path: string; statuses: string[]; columns: DocColumn<T>[]; linkPrefix: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [page, setPage] = React.useState(1);
  const debounced = useDebounced(search);
  React.useEffect(() => setPage(1), [debounced, status, from, to]);
  const { data, isLoading } = usePagedQuery<T>([queryKey], path, { search: debounced, status, from, to, page, pageSize: 20 });

  return (
    <Card>
      <FilterBar>
        <SearchInput value={search} onChange={setSearch} />
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-44">
          <option value="">{t("common.status")}: {t("common.all")}</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {t(`status.${s}`)}
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
      {isLoading ? (
        <LoadingBlock />
      ) : !data?.items.length ? (
        <EmptyState />
      ) : (
        <Table>
          <THead>
            <TR>
              {columns.map((c, i) => (
                <TH key={i} className={c.className}>
                  {c.header}
                </TH>
              ))}
            </TR>
          </THead>
          <TBody>
            {data.items.map((row) => (
              <TR key={row.id} className="cursor-pointer" onClick={() => navigate(`${linkPrefix}/${row.id}`)}>
                {columns.map((c, i) => (
                  <TD key={i} className={c.className}>
                    {c.cell(row)}
                  </TD>
                ))}
              </TR>
            ))}
          </TBody>
        </Table>
      )}
      <Pagination meta={data?.meta} onPageChange={setPage} />
    </Card>
  );
}
