// Writes a throwaway post with a {% gallery %} for the e2e suite. Runs as part
// of `npm run test:e2e:server`, before `jekyll build` -- like the encrypted
// fixture, never committed to the (public) content submodule;
// tests/e2e/global-teardown.js removes it once the suite finishes.
import fs from "node:fs";
import path from "node:path";
import { GALLERY_FIXTURE_CONTENTS, GALLERY_FIXTURE_PATH } from "./gallery-fixture-constants.js";

fs.mkdirSync(path.dirname(GALLERY_FIXTURE_PATH), { recursive: true });
fs.writeFileSync(GALLERY_FIXTURE_PATH, GALLERY_FIXTURE_CONTENTS);
console.log(`[e2e] wrote gallery fixture post to ${GALLERY_FIXTURE_PATH}`);
