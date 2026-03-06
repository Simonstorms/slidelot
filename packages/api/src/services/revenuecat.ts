import { env } from "@marketing-ai/env/server";

interface ConversionMetrics {
  downloads: number;
  trials: number;
  conversions: number;
  revenue: number;
}

export async function getConversionMetrics(): Promise<ConversionMetrics | null> {
  if (!env.REVENUECAT_API_KEY) {
    return null;
  }

  const response = await fetch(
    "https://api.revenuecat.com/v2/projects/overview",
    {
      headers: {
        Authorization: `Bearer ${env.REVENUECAT_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    console.error(`RevenueCat API error: ${response.statusText}`);
    return null;
  }

  const data = (await response.json()) as {
    active_trials: number;
    active_subscribers: number;
    revenue: number;
    installs: number;
  };

  return {
    downloads: data.installs ?? 0,
    trials: data.active_trials ?? 0,
    conversions: data.active_subscribers ?? 0,
    revenue: data.revenue ?? 0,
  };
}
