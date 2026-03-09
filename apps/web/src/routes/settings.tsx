import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import { trpc, queryClient } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/settings")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(
      context.trpc.settings.getAll.queryOptions()
    ),
  component: SettingsPage,
});

const CTA_OPTIONS = [
  { value: "soft", label: "Soft" },
  { value: "direct", label: "Direct" },
  { value: "curiosity-driven", label: "Curiosity-driven" },
  { value: "urgency", label: "Urgency" },
  { value: "social-proof", label: "Social proof" },
];

const API_KEYS_CONFIG = [
  { name: "ANTHROPIC_API_KEY" as const, label: "Anthropic API Key", required: true },
  { name: "FAL_API_KEY" as const, label: "FAL API Key", required: true },
  { name: "POSTIZ_API_KEY" as const, label: "Postiz API Key", required: false },
  { name: "POSTIZ_INTEGRATION_ID" as const, label: "Postiz Integration ID", required: false },
  { name: "REVENUECAT_API_KEY" as const, label: "RevenueCat API Key", required: false },
];

function SettingsPage() {
  return (
    <div className="container mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      <Tabs defaultValue="product">
        <TabsList variant="line">
          <TabsTrigger value="product">Product</TabsTrigger>
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
        </TabsList>
        <TabsContent value="product">
          <ProductTab />
        </TabsContent>
        <TabsContent value="api-keys">
          <ApiKeysTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ProductTab() {
  const { data: settings } = useQuery(trpc.settings.getAll.queryOptions());

  const saveMutation = useMutation({
    ...trpc.settings.bulkUpsert.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success("Settings saved");
    },
  });

  const form = useForm({
    defaultValues: {
      niche: settings?.niche ?? "",
      productName: settings?.productName ?? "",
      productDescription: settings?.productDescription ?? "",
      productUrl: settings?.productUrl ?? "",
      targetAudience: settings?.targetAudience ?? "",
      ctaStyle: settings?.ctaStyle ?? "soft",
    },
    onSubmit: ({ value }) => {
      saveMutation.mutate(value);
    },
  });

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Product Configuration</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
          className="space-y-4"
        >
          <p className="text-xs text-muted-foreground font-medium">Brand</p>

          <form.Field name="niche">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor="niche">Niche</Label>
                <Input
                  id="niche"
                  placeholder="e.g. productivity apps, fitness tech"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              </div>
            )}
          </form.Field>

          <form.Field name="productName">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor="productName">Product Name</Label>
                <Input
                  id="productName"
                  placeholder="e.g. FocusFlow"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              </div>
            )}
          </form.Field>

          <form.Field name="productUrl">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor="productUrl">Product URL</Label>
                <Input
                  id="productUrl"
                  placeholder="https://yourproduct.com"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              </div>
            )}
          </form.Field>

          <Separator />

          <p className="text-xs text-muted-foreground font-medium">
            Content Strategy
          </p>

          <form.Field name="productDescription">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor="productDescription">Product Description</Label>
                <Textarea
                  id="productDescription"
                  placeholder="What does your product do? Who is it for?"
                  rows={3}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              </div>
            )}
          </form.Field>

          <form.Field name="targetAudience">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor="targetAudience">Target Audience</Label>
                <Textarea
                  id="targetAudience"
                  placeholder="Describe your ideal viewer/customer"
                  rows={2}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              </div>
            )}
          </form.Field>

          <form.Field name="ctaStyle">
            {(field) => (
              <div className="space-y-2">
                <Label>CTA Style</Label>
                <Select
                  value={field.state.value}
                  onValueChange={(val) => val && field.handleChange(val)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a style" />
                  </SelectTrigger>
                  <SelectContent>
                    {CTA_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </form.Field>

          <Button type="submit" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Saving..." : "Save Settings"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function ApiKeysTab() {
  const { data: statuses } = useQuery(
    trpc.settings.getApiKeyStatuses.queryOptions()
  );

  const required = API_KEYS_CONFIG.filter((k) => k.required);
  const optional = API_KEYS_CONFIG.filter((k) => !k.required);

  const hasMissingRequired =
    statuses &&
    required.some((k) => statuses[k.name]?.source === "missing");

  return (
    <div className="mt-4 space-y-4">
      {hasMissingRequired && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Missing required API keys</AlertTitle>
          <AlertDescription>
            Anthropic and FAL keys are needed for hook generation and image
            creation. Add them below or set them in your .env file.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Required</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {required.map((key) => (
            <ApiKeyRow
              key={key.name}
              name={key.name}
              label={key.label}
              status={statuses?.[key.name]}
            />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Optional</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {optional.map((key) => (
            <ApiKeyRow
              key={key.name}
              name={key.name}
              label={key.label}
              required={false}
              status={statuses?.[key.name]}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function ApiKeyRow({
  name,
  label,
  required = true,
  status,
}: {
  name: (typeof API_KEYS_CONFIG)[number]["name"];
  label: string;
  required?: boolean;
  status?: { masked: string | null; source: "env" | "db" | "missing" };
}) {
  const [value, setValue] = useState("");

  const saveMutation = useMutation({
    ...trpc.settings.saveApiKey.mutationOptions(),
    onSuccess: () => {
      setValue("");
      queryClient.invalidateQueries();
      toast.success(`${label} saved`);
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const source = status?.source ?? "missing";

  function badgeVariant() {
    if (source === "env") return "secondary" as const;
    if (source === "db") return "default" as const;
    if (required) return "destructive" as const;
    return "outline" as const;
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <Badge variant={badgeVariant()}>
          {source === "missing" && !required ? "not set" : source}
        </Badge>
      </div>
      {status?.masked && (
        <p className="text-xs text-muted-foreground">Current: {status.masked}</p>
      )}
      <div className="flex gap-2">
        <Input
          type="password"
          placeholder={source === "env" ? "Overridden by .env" : "Enter key..."}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={source === "env"}
        />
        <Button
          size="sm"
          disabled={!value || saveMutation.isPending || source === "env"}
          onClick={() => saveMutation.mutate({ key: name, value })}
        >
          Save
        </Button>
      </div>
    </div>
  );
}
