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
          "gap-0.5 rounded-lg border border-border bg-muted p-1 group-data-horizontal/tabs:h-auto",
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
        "group/tabs-trigger relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap text-foreground/60 transition-all group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 group-data-[variant=default]/tabs-list:data-active:border-border [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "group-data-[variant=default]/tabs-list:h-auto group-data-[variant=default]/tabs-list:flex-none group-data-[variant=default]/tabs-list:gap-1.75 group-data-[variant=default]/tabs-list:rounded-md group-data-[variant=default]/tabs-list:px-4 group-data-[variant=default]/tabs-list:py-1.5 group-data-[variant=default]/tabs-list:text-sm group-data-[variant=default]/tabs-list:font-semibold",
        "group-data-[variant=pills]/tabs-list:h-auto group-data-[variant=pills]/tabs-list:flex-none group-data-[variant=pills]/tabs-list:rounded-full group-data-[variant=pills]/tabs-list:border-border group-data-[variant=pills]/tabs-list:bg-card group-data-[variant=pills]/tabs-list:px-3.5 group-data-[variant=pills]/tabs-list:py-1.5 group-data-[variant=pills]/tabs-list:text-sm group-data-[variant=pills]/tabs-list:font-semibold group-data-[variant=pills]/tabs-list:text-muted-foreground group-data-[variant=pills]/tabs-list:hover:border-schiefer-400 group-data-[variant=pills]/tabs-list:hover:text-foreground group-data-[variant=pills]/tabs-list:data-active:border-limette-200 group-data-[variant=pills]/tabs-list:data-active:bg-limette-100 group-data-[variant=pills]/tabs-list:data-active:text-limette-700",
        "data-active:bg-card data-active:text-foreground",
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
        "text-2xs font-bold text-schiefer-400 group-data-active/tabs-trigger:text-limette-700",
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
