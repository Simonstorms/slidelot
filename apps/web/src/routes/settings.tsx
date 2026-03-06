import { useQuery, useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import { trpc, queryClient } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(
      context.trpc.settings.getAll.queryOptions()
    ),
  component: SettingsPage,
});

function SettingsPage() {
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
    <div className="container mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <Card>
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

            <form.Field name="productDescription">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor="productDescription">
                    Product Description
                  </Label>
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
                  <Label htmlFor="ctaStyle">CTA Style</Label>
                  <Input
                    id="ctaStyle"
                    placeholder="e.g. soft, direct, curiosity-driven"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </div>
              )}
            </form.Field>

            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving..." : "Save Settings"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
