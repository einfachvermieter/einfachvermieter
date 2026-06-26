import { cva, type VariantProps } from "class-variance-authority";
import { Tabs as TabsPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-horizontal:flex-col",
        className,
      )}
      {...props}
    />
  );
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground group-data-horizontal/tabs:h-9 group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col data-[variant=pills]:rounded-none",
  {
    variants: {
      variant: {
        default:
          "gap-0.5 rounded-[13px] border border-border bg-muted p-1 group-data-horizontal/tabs:h-auto",
        pills:
          "w-full flex-wrap justify-start gap-2 bg-transparent p-0 group-data-horizontal/tabs:h-auto",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function TabsList({
  className,
  variant = "default",
  ...props
}: ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  );
}

function TabsTrigger({
  className,
  ...props
}: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "group/tabs-trigger relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap text-foreground/60 transition-all group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 dark:text-muted-foreground dark:hover:text-foreground group-data-[variant=default]/tabs-list:data-active:shadow-[0_1px_3px_rgba(15,23,42,0.12)] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "group-data-[variant=default]/tabs-list:h-auto group-data-[variant=default]/tabs-list:flex-none group-data-[variant=default]/tabs-list:border-0 group-data-[variant=default]/tabs-list:gap-1.75 group-data-[variant=default]/tabs-list:rounded-[10px] group-data-[variant=default]/tabs-list:px-4.5 group-data-[variant=default]/tabs-list:py-2 group-data-[variant=default]/tabs-list:text-[13.5px] group-data-[variant=default]/tabs-list:leading-4.5 group-data-[variant=default]/tabs-list:font-semibold",
        "group-data-[variant=pills]/tabs-list:h-auto group-data-[variant=pills]/tabs-list:flex-none group-data-[variant=pills]/tabs-list:rounded-full group-data-[variant=pills]/tabs-list:border-border group-data-[variant=pills]/tabs-list:bg-card group-data-[variant=pills]/tabs-list:px-3.75 group-data-[variant=pills]/tabs-list:py-1.75 group-data-[variant=pills]/tabs-list:text-[13px] group-data-[variant=pills]/tabs-list:font-semibold group-data-[variant=pills]/tabs-list:text-slate-600 group-data-[variant=pills]/tabs-list:hover:border-slate-400 group-data-[variant=pills]/tabs-list:hover:text-foreground group-data-[variant=pills]/tabs-list:data-active:border-sky-100 group-data-[variant=pills]/tabs-list:data-active:bg-sky-50 group-data-[variant=pills]/tabs-list:data-active:text-sky-700 group-data-[variant=pills]/tabs-list:data-active:shadow-none dark:group-data-[variant=pills]/tabs-list:data-active:bg-sky-900/30 dark:group-data-[variant=pills]/tabs-list:data-active:text-sky-400",
        "data-active:bg-card data-active:text-foreground dark:data-active:border-input dark:data-active:bg-input/30 dark:data-active:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Kleine Zähl-Kennzeichnung neben einem Tab-Label (z. B. "Zahlungen 2")
 */
function TabCount({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      data-slot="tab-count"
      className={cn(
        "text-[11px] font-bold text-slate-400 group-data-active/tabs-trigger:text-sky-600",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({
  className,
  ...props
}: ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 text-sm outline-none", className)}
      {...props}
    />
  );
}

export { TabCount, Tabs, TabsContent, TabsList, TabsTrigger, tabsListVariants };
