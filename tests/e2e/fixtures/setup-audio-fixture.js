import fs from "node:fs";
import path from "node:path";
import {
  AUDIO_DESCRIBED_FIXTURE,
  AUDIO_DIR,
  AUDIO_FILE_PATH,
  AUDIO_PLAIN_FIXTURE,
  NO_AUDIO_FIXTURE,
  makeWav,
} from "./audio-fixture-constants.js";

fs.mkdirSync(AUDIO_DIR, { recursive: true });
fs.writeFileSync(AUDIO_FILE_PATH, makeWav());
for (const f of [AUDIO_DESCRIBED_FIXTURE, AUDIO_PLAIN_FIXTURE, NO_AUDIO_FIXTURE]) {
  fs.mkdirSync(path.dirname(f.path), { recursive: true });
  fs.writeFileSync(f.path, f.contents);
}
console.log("Wrote audio fixtures");
