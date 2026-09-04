import { RiUploadCloud2Line } from "@remixicon/react";
import { type ReactNode, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

/**
 * Fläche zum Hochladen: Schaltfläche für den Dateidialog, dazu ein Ziel zum
 * Hineinziehen von Dateien.
 */
export const FileDropZone = ({
  accept,
  buttonLabel,
  hint,
  disabled = false,
  onFiles,
}: {
  accept: string;
  buttonLabel: string;
  hint: ReactNode;
  disabled?: boolean;
  onFiles: (files: FileList) => void;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isOver, setIsOver] = useState(false);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: reines Drop-Ziel, bedient wird über die Schaltfläche
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-3 rounded-lg border border-dashed border-input px-4 py-4 transition-colors",
        isOver && "border-azur-700 bg-azur-50",
        disabled && "opacity-60",
      )}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) {
          setIsOver(true);
        }
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsOver(false);
        if (!disabled && event.dataTransfer.files.length > 0) {
          onFiles(event.dataTransfer.files);
        }
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={true}
        className="hidden"
        onChange={(event) => {
          if (event.target.files) {
            onFiles(event.target.files);
          }
          event.target.value = "";
        }}
      />
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        <RiUploadCloud2Line aria-hidden={true} />
        {buttonLabel}
      </Button>
      <div className="min-w-0 flex-1 text-sm text-muted-foreground">{hint}</div>
    </div>
  );
};
