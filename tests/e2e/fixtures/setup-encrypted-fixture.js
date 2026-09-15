// Regenerates a throwaway encrypted post for the e2e suite. Runs as part of
// `npm run test:e2e:server`, before `jekyll build` runs -- the content
// submodule is a public repo, so this fixture is never committed there;
// tests/e2e/global-teardown.js removes it again once the suite finishes.
import fs from "node:fs";
import path from "node:path";
import { encrypt } from "../../../scripts/lib/encrypted-post-crypto.js";
import { FIXTURE_PASSWORD, FIXTURE_PLAINTEXT, FIXTURE_PATH } from "./encrypted-fixture-constants.js";

async function main() {
  const { salt, iv, ciphertext } = await encrypt(FIXTURE_PASSWORD, FIXTURE_PLAINTEXT);
  const contents = [
    "---",
    'title: "E2E Encrypted Fixture"',
    "post_date: 2024-01-01",
    "hidden: true",
    'link_preview: "a throwaway post used by the e2e suite."',
    "encrypted: true",
    `encrypted_salt: "${salt}"`,
    `encrypted_iv: "${iv}"`,
    `encrypted_data: "${ciphertext}"`,
    "---",
    "",
  ].join("\n");

  fs.mkdirSync(path.dirname(FIXTURE_PATH), { recursive: true });
  fs.writeFileSync(FIXTURE_PATH, contents);
  console.log(`[e2e] wrote encrypted fixture post to ${FIXTURE_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
