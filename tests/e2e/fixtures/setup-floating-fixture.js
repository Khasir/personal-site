// Writes a throwaway post with two {% floating %} sections for the e2e suite.
import fs from "node:fs";
import path from "node:path";
import { FLOATING_FIXTURE_CONTENTS, FLOATING_FIXTURE_PATH } from "./floating-fixture-constants.js";

fs.mkdirSync(path.dirname(FLOATING_FIXTURE_PATH), { recursive: true });
fs.writeFileSync(FLOATING_FIXTURE_PATH, FLOATING_FIXTURE_CONTENTS);
console.log(`[e2e] wrote floating fixture post to ${FLOATING_FIXTURE_PATH}`);
