import fs from "node:fs";
import { FIXTURE_PATH } from "./fixtures/encrypted-fixture-constants.js";
import { GALLERY_FIXTURE_PATH } from "./fixtures/gallery-fixture-constants.js";
import { FLOATING_FIXTURE_PATH } from "./fixtures/floating-fixture-constants.js";
import {
  HIDDEN_INTERVIEW_FIXTURE,
  INTERVIEW_FIXTURE,
  INTERVIEW_FIXTURE_DIR,
} from "./fixtures/interview-fixture-constants.js";

import {
  AUDIO_DESCRIBED_FIXTURE,
  AUDIO_DIR,
  AUDIO_FILE_PATH,
  AUDIO_PLAIN_FIXTURE,
  NO_AUDIO_FIXTURE,
} from "./fixtures/audio-fixture-constants.js";

export default async function globalTeardown() {
  fs.rmSync(AUDIO_DESCRIBED_FIXTURE.path, { force: true });
  fs.rmSync(AUDIO_PLAIN_FIXTURE.path, { force: true });
  fs.rmSync(NO_AUDIO_FIXTURE.path, { force: true });
  fs.rmSync(AUDIO_FILE_PATH, { force: true });
  try {
    fs.rmdirSync(AUDIO_DIR); // only if the fixture was all that was in it
  } catch {
    // Missing or holds real audio -- leave it.
  }
  fs.rmSync(FIXTURE_PATH, { force: true });
  fs.rmSync(GALLERY_FIXTURE_PATH, { force: true });
  fs.rmSync(FLOATING_FIXTURE_PATH, { force: true });
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
