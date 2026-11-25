import { AlertTriangle, ArrowLeft, ArrowUpFromLine, Calculator, CheckCircle2, Plus, Trash2 } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { ISSUE_REASONS, type IssueReason } from "@/shared/constants";
import type { FefoPreviewDto, IssueDto } from "@/shared/types";
import { ConfirmDialog, PageHeader } from "../../components/common";
import { ProductPicker, type ProductOption } from "../../components/Pickers";
import { ExpiryBadge } from "../../components/StatusBadge";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Field, Input, Select, Textarea } from "../../components/ui/form";
import { Table, TBody, TD, TH, THead, TR } from "../../components/ui/table";
import { useErrorMessage } from "../../hooks/useApi";
import { ApiError, api } from "../../services/api";
import { newRequestKey } from "../../utils/cn";
import { formatDate, formatNumber, todayVn } from "../../utils/format";
import { useQueryClient } from "@tanstack/react-query";

interface Line {
  key: string;
  product: ProductOption | null;
  quantity: number;
}

const newLine = (): Line => ({ key: newRequestKey(), product: null, quantity: 1 });

export function IssueCreatePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();
  const [lines, setLines] = React.useState<Line[]>([newLine()]);
  const [issueDate, setIssueDate] = React.useState(todayVn());
  const [recipient, setRecipient] = React.useState("");
  const [reason, setReason] = React.useState<IssueReason>("SALE");
  const [notes, setNotes] = React.useState("");
  const [preview, setPreview] = React.useState<FefoPreviewDto | null>(null);
  const [previewing, setPreviewing] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  // one idempotency key per confirmation attempt: double clicks / retries never deduct twice
  const requestKey = React.useRef(newRequestKey());

  const validLines = lines.filter((l) => l.product && l.quantity > 0);
  const payloadLines = validLines.map((l) => ({ productId: l.product!.id, quantity: Math.floor(l.quantity) }));

  const update = (key: string, patch: Partial<Line>) => {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
    setPreview(null);
  };

  const runPreview = async () => {
    if (!payloadLines.length) return;
    setPreviewing(true);
    try {
      setPreview(await api.post<FefoPreviewDto>("/api/stock-issues/fefo-preview", { lines: payloadLines }));
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setPreviewing(false);
    }
  };

  const confirm = async () => {
    if (!preview) return;
    setSubmitting(true);
    try {
      const issue = await api.post<IssueDto>("/api/stock-issues", {
        requestKey: requestKey.current,
        issueDate,
        recipient,
        reason,
        notes,
        lines: payloadLines,
        previewFingerprint: preview.fingerprint,
      });
      toast.success(t("issues.issued"));
      for (const k of ["issues", "dashboard", "inventory", "lots", "products", "alerts", "warehouse-map", "bins"]) void queryClient.invalidateQueries({ queryKey: [k] });
      navigate(`/issues/${issue.id}`);
    } catch (e) {
      setConfirmOpen(false);
      if (e instanceof ApiError && e.code === "STOCK_CHANGED") {
        const fresh = (e.details as { preview?: FefoPreviewDto } | undefined)?.preview;
        setPreview(fresh ?? null);
        requestKey.current = newRequestKey();
      }
      toast.error(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("issues.new")}
        subtitle={t("issues.fefoHint")}
        icon={<ArrowUpFromLine />}
        actions={
          <Button variant="outline" asChild>
            <Link to="/issues">
              <ArrowLeft /> {t("common.back")}
            </Link>
          </Button>
        }
      />
      <Card>
        <CardContent className="grid gap-4 pt-5 sm:grid-cols-2 lg:grid-cols-4">
          <Field label={t("issues.date")} required>
            <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
          </Field>
          <Field label={t("issues.recipient")}>
            <Input value={recipient} onChange={(e) => setRecipient(e.target.value)} />
          </Field>
          <Field label={t("common.reason")}>
            <Select value={reason} onChange={(e) => setReason(e.target.value as IssueReason)}>
              {ISSUE_REASONS.map((r) => (
                <option key={r} value={r}>
                  {t(`issueReason.${r}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("common.notes")}>
            <Textarea rows={1} className="min-h-9" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("issues.requestLines")}</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setLines((l) => [...l, newLine()])}>
            <Plus /> {t("common.addLine")}
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {lines.map((l, i) => (
            <div key={l.key} className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <span className="w-6 text-sm text-muted-foreground">{i + 1}</span>
              <div className="flex-1">
                <ProductPicker value={l.product?.id ?? null} valueLabel={l.product ? `${l.product.sku} — ${l.product.name}` : undefined} onChange={(p) => update(l.key, { product: p })} />
              </div>
              <div className="flex items-center gap-2">
                <Input type="number" min={1} className="w-32" value={l.quantity} onChange={(e) => update(l.key, { quantity: Number(e.target.value) })} />
                <span className="w-16 text-xs text-muted-foreground">{l.product?.unit}</span>
                <Button variant="ghost" size="icon-sm" disabled={lines.length === 1} onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} aria-label={t("common.remove")}>
                  <Trash2 className="text-danger" />
                </Button>
              </div>
            </div>
          ))}
          <div className="pt-2">
            <Button onClick={runPreview} loading={previewing} disabled={!payloadLines.length}>
              <Calculator /> {t("issues.previewFefo")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {preview && (
        <Card className="border-primary/40">
          <CardHeader>
            <div>
              <CardTitle>{t("issues.fefoTitle")}</CardTitle>
              <CardDescription>{t("issues.fefoHint")}</CardDescription>
            </div>
            {preview.fulfillable ? (
              <Button variant="success" onClick={() => setConfirmOpen(true)}>
                <CheckCircle2 /> {t("issues.confirmIssue")}
              </Button>
            ) : (
              <Badge variant="danger" className="text-sm">
                <AlertTriangle className="size-4" /> {t("issues.notFulfillable")}
              </Badge>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {preview.lines.map((line) => (
              <div key={line.productId} className="rounded-lg border">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-slate-50 px-3 py-2">
                  <p className="font-semibold">
                    {line.productSku} · <span className="font-normal">{line.productName}</span>
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline">
                      {t("issues.requested")}: {formatNumber(line.requestedQuantity)} {line.unit}
                    </Badge>
                    <Badge variant="success">
                      {t("issues.allocated")}: {formatNumber(line.allocatedQuantity)}
                    </Badge>
                    {line.shortageQuantity > 0 && (
                      <Badge variant="danger">
                        {t("issues.shortage")}: {formatNumber(line.shortageQuantity)}
                      </Badge>
                    )}
                  </div>
                </div>
                <Table>
                  <THead>
                    <TR>
                      <TH>#</TH>
                      <TH>{t("lots.lotNumber")}</TH>
                      <TH>{t("common.expirationDate")}</TH>
                      <TH>{t("common.location")}</TH>
                      <TH className="text-right">{t("issues.available")}</TH>
                      <TH className="text-right">{t("issues.allocated")}</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {line.allocations.map((a, i) => (
                      <TR key={a.balanceId}>
                        <TD className="text-muted-foreground">{i + 1}</TD>
                        <TD className="font-mono text-xs font-semibold">{a.lotNumber}</TD>
                        <TD>
                          <div className="flex items-center gap-2">
                            <span className="text-xs">{formatDate(a.expirationDate)}</span>
                            <ExpiryBadge status={a.expiryStatus} days={a.daysToExpiry} />
                          </div>
                        </TD>
                        <TD className="font-mono text-xs font-semibold text-primary">{a.locationCode}</TD>
                        <TD className="text-right tabular-nums text-muted-foreground">{formatNumber(a.availableQuantity)}</TD>
                        <TD className="text-right text-base font-bold tabular-nums">{formatNumber(a.allocatedQuantity)}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
                {(line.excluded.expired > 0 || line.excluded.quarantine > 0 || line.excluded.blocked > 0) && (
                  <p className="border-t px-3 py-2 text-xs text-warning">
                    <AlertTriangle className="mr-1 inline size-3.5" />
                    {t("issues.excluded", { expired: formatNumber(line.excluded.expired), quarantine: formatNumber(line.excluded.quarantine), blocked: formatNumber(line.excluded.blocked) })}
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <ConfirmDialog open={confirmOpen} onOpenChange={setConfirmOpen} title={t("issues.confirmIssue")} description={t("issues.confirmText")} variant="success" loading={submitting} onConfirm={confirm} />
    </div>
  );
}
