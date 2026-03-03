export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { autoOnboardFromConfig } = await import("@/lib/config/auto-onboard");
    autoOnboardFromConfig().catch((err) => {
      console.error("[skynet] auto-onboard error:", err);
    });
  }
}
