import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";

interface HookCardProps {
  hook: {
    id: number;
    text: string;
    formula: string | null;
    score: number | null;
    status: string;
    slideTexts: string[] | null;
  };
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (id: number) => void;
}

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  untested: "bg-blue-100 text-blue-800",
  winner: "bg-green-100 text-green-800",
  loser: "bg-red-100 text-red-800",
};

export function HookCard({ hook, selectable, selected, onSelect }: HookCardProps) {
  return (
    <Card
      className={`cursor-pointer transition-colors ${selected ? "ring-2 ring-primary" : ""}`}
      onClick={() => selectable && onSelect?.(hook.id)}
    >
      <CardHeader className="pb-2 flex flex-row items-start gap-3">
        {selectable && (
          <Checkbox
            checked={selected}
            onCheckedChange={() => onSelect?.(hook.id)}
            className="mt-1"
          />
        )}
        <div className="flex-1 space-y-1">
          <p className="font-medium leading-snug">{hook.text}</p>
          <div className="flex gap-2 flex-wrap">
            {hook.formula && (
              <Badge variant="outline" className="text-xs">
                {hook.formula}
              </Badge>
            )}
            <Badge className={statusColors[hook.status] ?? ""}>
              {hook.status}
            </Badge>
            {hook.score !== null && hook.score > 0 && (
              <Badge variant="secondary">{hook.score}/10</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      {hook.slideTexts && hook.slideTexts.length > 0 && (
        <CardContent className="pt-0">
          <div className="flex gap-1 flex-wrap">
            {hook.slideTexts.map((t, i) => (
              <span
                key={i}
                className="text-xs bg-muted px-2 py-0.5 rounded"
              >
                {i + 1}. {t}
              </span>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
