import { todayIso } from "@einfachvermieter/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { RiBardFill, RiEditLine, RiUploadCloud2Line } from "@remixicon/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useId, useState } from "react";
import { useForm } from "react-hook-form";
import { DomainLink } from "@/components/common/DomainLink";
import { ChoiceTiles } from "@/components/form/ChoiceTiles";
import { FormSheet } from "@/components/form/FormSheet";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/Alert";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/Field";
import { Switch } from "@/components/ui/Switch";
import { useActiveBuilding } from "../../lib/activeBuilding";
import { aiConfigQueryOptions } from "../../lib/aiExtraction";
import { ApiError, api } from "../../lib/api";
import { uploadCostEntryAttachment } from "../../lib/attachments";
import { type CostEntry, costTypesQueryOptions } from "../../lib/costs";
import { domainVisuals } from "../../lib/domainVisuals";
import { t } from "../../lib/i18n";
import { PendingAttachments } from "./components/attachments/PendingAttachments";
import { CostEntryBaseFields } from "./components/baseData/CostEntryBaseFields";
import {
  type CostEntryFormValues,
  costEntryFormSchema,
  costEntryFormToDto,
} from "./components/baseData/costEntryForm.schema";

type EntrySource = "manual" | "upload";

export const CostEntryCreateSheet = ({
  costTypeId,
  onClose,
}: {
  costTypeId?: string;
  onClose: () => void;
}) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const autoExtractId = useId();

  const { buildingId } = useActiveBuilding();
  const { data: allCostTypes } = useQuery(costTypesQueryOptions);
  const { data: aiConfig } = useQuery(aiConfigQueryOptions);

  const sourceBuilding =
    allCostTypes?.find((costType) => costType.id === costTypeId)?.buildingId ??
    buildingId;
  const costTypes = (allCostTypes ?? []).filter(
    (costType) => costType.buildingId === sourceBuilding,
  );

  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [source, setSource] = useState<EntrySource>("manual");
  const [autoExtract, setAutoExtract] = useState(true);

  const form = useForm<CostEntryFormValues>({
    resolver: zodResolver(costEntryFormSchema),
    reValidateMode: "onSubmit",
    defaultValues: {
      buildingId: sourceBuilding ?? "",
      invoiceDate: todayIso(),
      invoiceNumber: "",
      vendor: "",
      items: [],
    },
  });

  const canExtract = aiConfig?.configured === true;

  return (
    <FormSheet
      form={form}
      icon={domainVisuals.invoices.icon}
      title={t("ui.invoices.createTitle")}
      submitLabel={t("ui.common.action.record")}
      onSubmit={async (values) => {
        if (source === "upload" && pendingFiles.length === 0) {
          throw new Error(t("ui.invoices.create.fileRequired"));
        }

        const created = await api.post<CostEntry>(
          "/costs",
          costEntryFormToDto(values, costTypes),
        );

        const failed: string[] = [];
        for (const file of pendingFiles) {
          try {
            await uploadCostEntryAttachment(created.id, file);
          } catch (err) {
            const message =
              err instanceof ApiError ? err.message : t("common.saveFailed");
            failed.push(`${file.name}: ${message}`);
          }
        }

        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["costs"] }),
          queryClient.invalidateQueries({ queryKey: ["stats"] }),

          // Entwürfe rechnen live aus den Stammdaten, der Vorschau-Cache
          // muss nach jeder Rechnungs-Mutation neu geladen werden.
          queryClient.invalidateQueries({ queryKey: ["statement-preview"] }),
          queryClient.invalidateQueries({
            queryKey: ["costEntry", created.id, "attachments"],
          }),
        ]);

        if (failed.length > 0) {
          throw new Error(
            t("ui.invoices.attachments.partialUploadFailed", {
              details: failed.join("; "),
            }),
          );
        }

        // Direkt zur Rechnung; der Routenwechsel schließt das Sheet
        const withExtraction = source === "upload" && canExtract && autoExtract;
        await navigate({
          to: "/rechnungen/$costEntryId",
          params: { costEntryId: created.id },
          search: {
            costTypeId: withExtraction ? undefined : costTypeId,
            extract: withExtraction ? true : undefined,
          },
        });
      }}
      onClose={onClose}
    >
      <div className="flex flex-col gap-2">
        <FieldLabel>{t("ui.invoices.create.sourceLabel")}</FieldLabel>
        <ChoiceTiles
          value={source}
          onValueChange={(value) => setSource(value as EntrySource)}
          options={[
            {
              value: "manual",
              icon: RiEditLine,
              title: t("ui.invoices.create.sourceManual"),
              description: t("ui.invoices.create.sourceManualDescription"),
            },
            {
              value: "upload",
              icon: RiUploadCloud2Line,
              title: t("ui.invoices.create.sourceUpload"),
              description: canExtract
                ? t("ui.invoices.create.sourceUploadDescription")
                : t("ui.invoices.create.sourceUploadDescriptionNoAi"),
            },
          ]}
        />
      </div>

      {source === "manual" ? (
        <CostEntryBaseFields form={form} />
      ) : (
        <>
          <PendingAttachments files={pendingFiles} onChange={setPendingFiles} />
          {canExtract ? (
            <Field orientation="horizontal">
              <Switch
                id={autoExtractId}
                checked={autoExtract}
                onCheckedChange={setAutoExtract}
              />
              <div className="min-w-0">
                <FieldLabel htmlFor={autoExtractId}>
                  <RiBardFill
                    aria-hidden={true}
                    className="size-4 shrink-0 text-azur-700"
                  />
                  {t("ui.invoices.aiExtract.autoLabel")}
                </FieldLabel>
                <FieldDescription>
                  {t("ui.invoices.aiExtract.autoDescription")}
                </FieldDescription>
              </div>
            </Field>
          ) : (
            <Alert variant="info">
              <RiBardFill aria-hidden={true} />
              <AlertTitle>
                {t("ui.invoices.aiExtract.notConfiguredTitle")}
              </AlertTitle>
              <AlertDescription>
                <span className="block">
                  {t("ui.invoices.aiExtract.notConfiguredText")}
                </span>
                <DomainLink to="/einstellungen/ki">
                  {t("ui.invoices.aiExtract.settingsLink")}
                </DomainLink>
              </AlertDescription>
            </Alert>
          )}
        </>
      )}
    </FormSheet>
  );
};
