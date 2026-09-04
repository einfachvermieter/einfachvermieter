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
    className={cn(
      "[&_tr]:border-b [&_tr]:border-border [&_tr]:hover:bg-transparent",
      className,
    )}
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
      "border-t border-border font-semibold [&>tr]:last:border-b-0",
      className,
    )}
    {...props}
  />
);

const TableRow = ({ className, ...props }: ComponentProps<"tr">) => (
  <tr
    data-slot="table-row"
    className={cn(
      "border-b border-schiefer-100 transition-colors hover:bg-muted has-aria-expanded:bg-muted data-[state=selected]:bg-muted",
      className,
    )}
    {...props}
  />
);

const TableHead = ({ className, ...props }: ComponentProps<"th">) => (
  <th
    data-slot="table-head"
    className={cn(
      "px-3.5 py-2.75 text-left align-middle text-2xs font-semibold tracking-[0.07em] whitespace-nowrap text-muted-foreground uppercase has-[[role=checkbox]]:pr-0",
      className,
    )}
    {...props}
  />
);

const TableCell = ({ className, ...props }: ComponentProps<"td">) => (
  <td
    data-slot="table-cell"
    className={cn(
      "px-3.5 py-3.5 align-middle text-sm whitespace-nowrap has-[[role=checkbox]]:pr-0",
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
