// Server-only. Surfaces Brevo's own remaining send quota in the admin Posts
// page, so an admin can see "how much room is left" before queuing a large
// announcement — separate from our own internal DAILY_SEND_CAP (75/24h,
// see src/lib/admin/posts.functions.ts), which throttles OUR pacing and is
// unrelated to what Brevo itself is willing to accept.
export type BrevoEmailUsage = {
  credits: number;
  planType: string;
  // Brevo's Account API returns remaining credits but not the plan's total
  // — 300/day is the documented Free-plan limit, so it's filled in only
  // for that plan type; other plan types show remaining credits without a
  // denominator, since they aren't a fixed daily allowance that resets.
  dailyLimit: number | null;
};

export async function getBrevoEmailUsage(): Promise<BrevoEmailUsage> {
  const { BrevoClient } = await import("@getbrevo/brevo");
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error("Email sender not configured (missing BREVO_API_KEY)");
  const brevo = new BrevoClient({ apiKey });

  const account = await brevo.account.getAccount();
  const sendPlan = account.plan.find((p) => p.creditsType === "sendLimit") ?? account.plan[0];
  if (!sendPlan) throw new Error("Brevo account has no send-limit plan info");

  return {
    credits: sendPlan.credits,
    planType: sendPlan.type,
    dailyLimit: sendPlan.type === "free" ? 300 : null,
  };
}
