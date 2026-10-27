// Writes throwaway interviews for the e2e suite. Runs as part of `npm run
// test:e2e:server`, before `jekyll build` -- like the other fixtures, never
// committed to the (public) content submodule; tests/e2e/global-teardown.js
// removes them once the suite finishes.
import fs from "node:fs";
import { HIDDEN_INTERVIEW_FIXTURE, INTERVIEW_FIXTURE, INTERVIEW_FIXTURE_DIR } from "./interview-fixture-constants.js";

fs.mkdirSync(INTERVIEW_FIXTURE_DIR, { recursive: true });
for (const fixture of [INTERVIEW_FIXTURE, HIDDEN_INTERVIEW_FIXTURE]) {
  fs.writeFileSync(fixture.path, fixture.contents);
  console.log(`[e2e] wrote interview fixture to ${fixture.path}`);
}
