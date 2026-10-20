import { Alert, AlertDescription, AlertTitle } from "@/components/ui/Alert";

/**
 * Ergebnis eines SubSheets: was aus den Antworten folgt
 */
export const ResultNote = ({
  title,
  text,
}: {
  title: string;
  text: string;
}) => (
  <Alert variant="info">
    <AlertTitle>{title}</AlertTitle>
    <AlertDescription>{text}</AlertDescription>
  </Alert>
);
