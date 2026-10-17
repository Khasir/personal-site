import fs from "node:fs";
import { FIXTURE_PATH } from "./fixtures/encrypted-fixture-constants.js";
import { GALLERY_FIXTURE_PATH } from "./fixtures/gallery-fixture-constants.js";
import {
  HIDDEN_INTERVIEW_FIXTURE,
  INTERVIEW_FIXTURE,
  INTERVIEW_FIXTURE_DIR,
} from "./fixtures/interview-fixture-constants.js";

export default async function globalTeardown() {
  fs.rmSync(FIXTURE_PATH, { force: true });
  fs.rmSync(GALLERY_FIXTURE_PATH, { force: true });
  fs.rmSync(INTERVIEW_FIXTURE.path, { force: true });
  fs.rmSync(HIDDEN_INTERVIEW_FIXTURE.path, { force: true });
  // Remove the directory too if the fixtures were all that was in it (it may
  // not exist in the submodule yet); rmdir refuses a non-empty one.
  try {
    fs.rmdirSync(INTERVIEW_FIXTURE_DIR);
  } catch {
    // Missing or holds real interviews -- leave it.
  }
}
