import { Card, CardContent } from "./ui/Card";
import { Skeleton } from "./ui/Skeleton";

export const FormSkeleton = ({ rows = 4 }: { rows?: number }) => (
  <div className="space-y-6">
    <div className="flex gap-2">
      <Skeleton className="h-8 w-8" />
      <Skeleton className="h-8 w-64" />
    </div>
    <Card>
      <CardContent className="flex flex-col gap-4">
        {Array.from({ length: rows }, (_, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder list
          <div key={index} className="flex flex-col gap-4">
            <Skeleton className="h-5 max-w-50" />
            <Skeleton className="h-9" />
          </div>
        ))}
      </CardContent>
    </Card>
  </div>
);
