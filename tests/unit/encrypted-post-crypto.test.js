import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { encrypt, decrypt } from "../../scripts/lib/encrypted-post-crypto.js";

describe("encrypted-post-crypto", () => {
  test("round-trips plaintext with the correct password", async () => {
    const { salt, iv, ciphertext } = await encrypt("correct horse battery staple", "hello, world");
    const plaintext = await decrypt("correct horse battery staple", { salt, iv, ciphertext });
    assert.equal(plaintext, "hello, world");
  });

  test("fails to decrypt with the wrong password", async () => {
    const { salt, iv, ciphertext } = await encrypt("right password", "secret text");
    await assert.rejects(() => decrypt("wrong password", { salt, iv, ciphertext }));
  });

  test("uses a fresh salt and iv on each call, so ciphertext differs even for identical input", async () => {
    const a = await encrypt("same password", "same text");
    const b = await encrypt("same password", "same text");
    assert.notEqual(a.salt, b.salt);
    assert.notEqual(a.iv, b.iv);
    assert.notEqual(a.ciphertext, b.ciphertext);
  });
});
