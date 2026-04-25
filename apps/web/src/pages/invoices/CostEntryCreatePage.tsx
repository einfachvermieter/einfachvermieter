import { todayIso } from "@einfachvermieter/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { RiBillLine } from "@remixicon/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { FormPage } from "../../components/common/FormPage";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/Alert";
import {
  aiConfigQueryOptions,
  extractCostEntryFromFile,
} from "../../lib/aiExtraction";
import { ApiError, api } from "../../lib/api";
import { uploadCostEntryAttachment } from "../../lib/attachments";
import { type CostEntry, costTypesQueryOptions } from "../../lib/costs";
import { t } from "../../lib/i18n";
import { unitsQueryOptions } from "../../lib/units";
import { useGoBack } from "../../lib/useGoBack";
import { applyExtractionToForm } from "./components/aiExtract/applyExtractionToForm";
import { PendingAttachments } from "./components/attachments/PendingAttachments";
import { CostEntryForm } from "./components/baseData/CostEntryForm";
import {
  type CostEntryFormValues,
  type CostEntrySubmitValues,
  costEntryFormSchema,
} from "./components/baseData/costEntryForm.schema";

export const CostEntryCreatePage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: costTypes } = useQuery(costTypesQueryOptions);
  const { data: units } = useQuery(unitsQueryOptions);
  const { data: aiConfig } = useQuery(aiConfigQueryOptions);

  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extractWarnings, setExtractWarnings] = useState<string[]>([]);
  const [extractingFile, setExtractingFile] = useState<File | null>(null);

  // OCR-Text pro File aus einer ggf. vorab durchgeführten KI-Extraktion;
  // wird beim Upload des Anhangs mitgeschickt, damit `ocr_text` in der
  // neuen Anhangs-Zeile direkt gefüllt ist (kein zweiter OCR-Call nötig).
  const [ocrTextByFile, setOcrTextByFile] = useState<Map<File, string>>(
    () => new Map(),
  );

  const defaultValues: CostEntryFormValues = {
    invoiceDate: todayIso(),
    invoiceNumber: "",
    vendor: "",
    items: [],
  };

  const form = useForm<CostEntryFormValues>({
    resolver: zodResolver(costEntryFormSchema),
    reValidateMode: "onSubmit",
    defaultValues,
  });

  const goBack = useGoBack("/rechnungen");

  const submit = async (values: CostEntrySubmitValues) => {
    setUploadError(null);
    const created = await api.post<CostEntry>("/costs", values);
    const failed: string[] = [];
    for (const file of pendingFiles) {
      try {
        await uploadCostEntryAttachment(created.id, file, {
          ocrText: ocrTextByFile.get(file),
        });
      } catch (err) {
        const message = err instanceof ApiError ? err.message : String(err);
        failed.push(`${file.name}: ${message}`);
      }
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["costs"] }),
      queryClient.invalidateQueries({ queryKey: ["stats"] }),

      // Draft-Statements rechnen live aus den Stammdaten. Preview-Cache
      // muss daher nach jeder Rechnungs-Mutation invalidiert werden.
      queryClient.invalidateQueries({ queryKey: ["statement-preview"] }),

      queryClient.invalidateQueries({
        queryKey: ["costEntry", created.id, "attachments"],
      }),
    ]);
    if (failed.length > 0) {
      setUploadError(
        t("ui.invoices.attachments.partialUploadFailed", {
          details: failed.join("; "),
        }),
      );

      navigate({
        to: "/rechnungen/$costEntryId",
        params: { costEntryId: created.id },
      }).catch(() => undefined);
      return;
    }

    goBack();
  };

  const handleExtract = async (file: File) => {
    setExtractError(null);
    setExtractWarnings([]);
    setExtractingFile(file);
    try {
      const result = await extractCostEntryFromFile(file);

      applyExtractionToForm(form, result, costTypes ?? []);
      setExtractWarnings(result.warnings);

      if (result.ocrText) {
        setOcrTextByFile((prev) => {
          const next = new Map(prev);
          next.set(file, result.ocrText);
          return next;
        });
      }
    } catch (err) {
      setExtractError(
        err instanceof ApiError
          ? err.message
          : t("ui.invoices.aiExtract.failed"),
      );
    } finally {
      setExtractingFile(null);
    }
  };

  return (
    <FormPage icon={<RiBillLine />} title={t("ui.invoices.createTitle")}>
      <CostEntryForm
        mode="create"
        form={form}
        costTypes={costTypes ?? []}
        units={units ?? []}
        onSubmit={submit}
        onCancel={goBack}
      />
      <PendingAttachments
        files={pendingFiles}
        onChange={(next) => {
          setPendingFiles(next);
          setOcrTextByFile((prev) => {
            const present = new Set(next);
            const cleaned = new Map<File, string>();
            for (const [file, text] of prev) {
              if (present.has(file)) {
                cleaned.set(file, text);
              }
            }
            return cleaned;
          });
        }}
        onExtract={aiConfig?.mistralConfigured ? handleExtract : undefined}
        extractingFile={extractingFile}
      />
      {extractError ? (
        <Alert variant="error">
          <AlertDescription>{extractError}</AlertDescription>
        </Alert>
      ) : null}
      {extractWarnings.length > 0 ? (
        <Alert variant="warning">
          <AlertTitle>{t("ui.invoices.aiExtract.warnings.title")}</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-5">
              {extractWarnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}
      {uploadError ? (
        <p className="text-sm text-destructive">{uploadError}</p>
      ) : null}
    </FormPage>
  );
};
