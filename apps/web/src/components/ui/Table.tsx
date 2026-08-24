import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const Table = ({ className, ...props }: ComponentProps<"table">) => (
  <div
    data-slot="table-container"
    className="scroll-shadow-x relative w-full overflow-x-auto"
  >
    <table
      data-slot="table"
      className={cn("w-full caption-bottom text-sm", className)}
      {...props}
    />
  </div>
);

const TableHeader = ({ className, ...props }: ComponentProps<"thead">) => (
  <thead
    data-slot="table-header"
    className={cn("[&_tr]:border-b", className)}
    {...props}
  />
);

const TableBody = ({ className, ...props }: ComponentProps<"tbody">) => (
  <tbody
    data-slot="table-body"
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
);

const TableFooter = ({ className, ...props }: ComponentProps<"tfoot">) => (
  <tfoot
    data-slot="table-footer"
    className={cn(
      "border-t bg-muted/50 font-semibold [&>tr]:last:border-b-0",
      className,
    )}
    {...props}
  />
);

const TableRow = ({ className, ...props }: ComponentProps<"tr">) => (
  <tr
    data-slot="table-row"
    className={cn(
      "border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
      className,
    )}
    {...props}
  />
);

const TableHead = ({ className, ...props }: ComponentProps<"th">) => (
  <th
    data-slot="table-head"
    className={cn(
      "px-4.5 py-3.75 text-left align-middle text-xs font-semibold tracking-wider whitespace-nowrap text-slate-400 uppercase has-[[role=checkbox]]:pr-0",
      className,
    )}
    {...props}
  />
);

const TableCell = ({ className, ...props }: ComponentProps<"td">) => (
  <td
    data-slot="table-cell"
    className={cn(
      "px-4.5 py-3.25 align-middle whitespace-nowrap has-[[role=checkbox]]:pr-0",
      className,
    )}
    {...props}
  />
);

const TableCaption = ({ className, ...props }: ComponentProps<"caption">) => (
  <caption
    data-slot="table-caption"
    className={cn("mt-4 text-sm text-muted-foreground", className)}
    {...props}
  />
);

export {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
};
