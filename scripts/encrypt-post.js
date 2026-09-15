// Local-only authoring tool: encrypts a plaintext post/note body and writes
// the result as a stub file (public frontmatter, empty body) ready to
// commit into the content submodule.
//
// The real body never touches that repo -- run this against a source file
// that lives outside `content/`, and delete/move the source once you're done.
//
// See CLAUDE.md's "Password-protected posts" section for the full authoring workflow.
import fs from "node:fs";
import { encrypt } from "./lib/encrypted-post-crypto.js";

function splitFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    throw new Error("source file must start with YAML frontmatter (---...---)");
  }
  return { frontmatterText: match[1], body: match[2] };
}

async function main() {
  const [, , sourcePath, destPath] = process.argv;
  if (!sourcePath || !destPath) {
    console.error("Usage: npm run encrypt-post -- <source.md> <dest.md>");
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
  const { frontmatterText, body } = splitFrontmatter(raw);

  const { salt, iv, ciphertext } = await encrypt(password, body.trim());

  const output =
    "---\n" +
    frontmatterText.replace(/\n+$/, "") +
    "\n" +
    "encrypted: true\n" +
    `encrypted_salt: "${salt}"\n` +
    `encrypted_iv: "${iv}"\n` +
    `encrypted_data: "${ciphertext}"\n` +
    "---\n";

  fs.writeFileSync(destPath, output);

  console.log(`Wrote encrypted post to ${destPath}`);
  console.log(
    `Reminder: please delete or move the plaintext source file (${sourcePath}) now. Do not commit it to any repo.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
