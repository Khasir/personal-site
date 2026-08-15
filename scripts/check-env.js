// Run as part of the Cloudflare Pages build command so a deploy fails fast
// instead of silently falling back to the insecure default salt at runtime
// (see `env.IP_HASH_SALT || "dev-salt"` in functions/api/*.js).
if (!process.env.IP_HASH_SALT || process.env.IP_HASH_SALT.trim() === "") {
  console.error(
    "IP_HASH_SALT is not set (or is empty). Set it as an environment " +
      "variable/secret on the Cloudflare Pages project before deploying."
  );
  process.exit(1);
}
