import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Meridian renders private, request-specific data. No R2 cache or image binding
// is provisioned for the initial Workers Free deployment.
const config = {
  ...defineCloudflareConfig({}),
  // Turbopack's traced package symlinks require privileges on Windows.
  buildCommand: "npx next build --webpack"
};

export default config;
