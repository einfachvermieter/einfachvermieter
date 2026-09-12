import { RiDownloadLine } from "@remixicon/react";
import { Description } from "@/components/common/Description";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { TabsContent } from "@/components/ui/Tabs";
import { ApiError } from "@/lib/api";
import { t } from "@/lib/i18n";
import {
  downloadStatementPdf,
  useStatementPdfPreview,
} from "./useStatementPdf";

/**
 * Reiter mit der PDF-Vorschau. Schlägt das Rendern fehl, steht hier der
 * Grund und eine Schaltfläche zum erneuten Versuch, statt einer leeren Fläche.
 */
export const StatementPdfTab = ({
  src,
  downloadSrc,
  cacheKey,
  filename,
}: {
  src: string;
  downloadSrc: string;
  cacheKey: string;
  filename: string;
}) => {
  const preview = useStatementPdfPreview(src, cacheKey);
  const serverMessage =
    preview.error instanceof ApiError ? preview.error.message : "";

  return (
    <TabsContent value="pdf">
      <Card className="h-225 overflow-hidden">
        <CardHeader>
          <CardTitle>{t("ui.statements.detail.tabs.pdf")}</CardTitle>
          <Description>
            {t("ui.statements.detail.pdfPreviewDescription")}
          </Description>
          <CardAction>
            <Button
              variant="outline"
              onClick={() => downloadStatementPdf(downloadSrc, filename)}
            >
              <RiDownloadLine data-icon="inline-start" />
              {t("ui.statements.detail.downloadPdf")}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="h-full p-0">
          <div className="h-full bg-white">
            {preview.isError ? (
              <div className="p-6">
                <Alert variant="error">
                  <AlertTitle>
                    {t("ui.statements.detail.pdfFailedTitle")}
                  </AlertTitle>
                  <AlertDescription>
                    <div className="flex flex-col items-start gap-2">
                      {serverMessage ? <span>{serverMessage}</span> : null}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => preview.refetch()}
                      >
                        {t("ui.statements.detail.pdfRetry")}
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              </div>
            ) : null}
            {preview.isSuccess ? (
              // Direkte Adresse statt der geholten Blob-Adresse: Chromiums
              // PDF-Betrachter zeigt `blob:` nicht an.
              <object
                data={src}
                type="application/pdf"
                width="100%"
                height="100%"
                aria-label={t("ui.statements.detail.tabs.pdf")}
              />
            ) : null}
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
};
