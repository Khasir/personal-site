// Local-only authoring tool: the reverse of scripts/encrypt-post.js.
// Decrypts an already-encrypted post/note back to plaintext (e.g. for editing).
// Write the output somewhere outside `content/`, edit it, then run
// encrypt-post.js again (which picks a fresh salt/iv) to produce a new
// stub to commit.
//
// See CLAUDE.md's "Password-protected posts" section for the full authoring workflow.
import fs from "node:fs";
import { load } from "js-yaml";
import { decrypt } from "./lib/encrypted-post-crypto.js";

function splitFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    throw new Error("source file must start with YAML frontmatter (---...---)");
  }
  return { frontmatterText: match[1] };
}

async function main() {
  const [, , sourcePath, destPath] = process.argv;
  if (!sourcePath || !destPath) {
    console.error("Usage: npm run decrypt-post -- <encrypted.md> <dest.md>");
    process.exit(1);
  }

  const password = process.env.ENCRYPTED_POST_PASSWORD;
  if (!password || password.trim() === "") {
    console.error(
      "ENCRYPTED_POST_PASSWORD is not set. Export it in your local shell before " +
        "running this script."
    );
    process.exit(1);
  }

  const raw = fs.readFileSync(sourcePath, "utf8");
  const { frontmatterText } = splitFrontmatter(raw);
  const data = load(frontmatterText) || {};

  if (!data.encrypted) {
    console.error(`${sourcePath} doesn't look like an encrypted post (no "encrypted: true" in frontmatter).`);
    process.exit(1);
  }
  if (!data.encrypted_salt || !data.encrypted_iv || !data.encrypted_data) {
    console.error(`${sourcePath} is missing encrypted_salt/encrypted_iv/encrypted_data.`);
    process.exit(1);
  }

  let plaintext;
  try {
    plaintext = await decrypt(password, {
      salt: data.encrypted_salt,
      iv: data.encrypted_iv,
      ciphertext: data.encrypted_data,
    });
  } catch {
    console.error("Decryption failed. Check ENCRYPTED_POST_PASSWORD is correct.");
    process.exit(1);
  }

  // Strip the encrypted_* fields back out, so the result is a normal-looking
  // source file ready to hand back to encrypt-post.js after editing.
  const cleanedFrontmatter = frontmatterText
    .replace(/^encrypted:.*$\n?/m, "")
    .replace(/^encrypted_salt:.*$\n?/m, "")
    .replace(/^encrypted_iv:.*$\n?/m, "")
    .replace(/^encrypted_data:.*$\n?/m, "")
    .replace(/\n+$/, "");

  fs.writeFileSync(destPath, `---\n${cleanedFrontmatter}\n---\n${plaintext}\n`);

  console.log(`Decrypted ${sourcePath} to ${destPath}`);
  console.log(
    `Reminder: ${destPath} now holds the real plaintext. Do not commit it, and delete/move it once you're done editing.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
