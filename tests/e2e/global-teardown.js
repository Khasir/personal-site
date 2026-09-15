import fs from "node:fs";
import { FIXTURE_PATH } from "./fixtures/encrypted-fixture-constants.js";

export default async function globalTeardown() {
  fs.rmSync(FIXTURE_PATH, { force: true });
}
