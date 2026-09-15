// AES-256-GCM with a PBKDF2-SHA256 derived key, used to encrypt password-
// protected post bodies before they're ever committed to the (public)
// content submodule. The browser-side decrypt in assets/js/encrypted-post.js
// duplicates these same parameters via the native Web Crypto API -- there's
// no bundler in this repo to share the module between Node and the browser,
// so if you change PBKDF2_ITERATIONS or the algorithm here, update it there
// too.
import { webcrypto } from "node:crypto";

// getRandomValues is a native method that requires `webcrypto` itself as
// its `this` -- destructuring it off would break that binding.
const subtle = webcrypto.subtle;
const getRandomValues = webcrypto.getRandomValues.bind(webcrypto);

export const PBKDF2_ITERATIONS = 600000;
const SALT_LENGTH_BYTES = 16;
const IV_LENGTH_BYTES = 12;

function bytesToBase64(bytes) {
  return Buffer.from(bytes).toString("base64");
}

function base64ToBytes(b64) {
  return new Uint8Array(Buffer.from(b64, "base64"));
}

async function deriveKey(password, saltBytes, usage) {
  const keyMaterial = await subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return subtle.deriveKey(
    { name: "PBKDF2", salt: saltBytes, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    [usage]
  );
}

export async function encrypt(password, plaintext) {
  const salt = getRandomValues(new Uint8Array(SALT_LENGTH_BYTES));
  const iv = getRandomValues(new Uint8Array(IV_LENGTH_BYTES));
  const key = await deriveKey(password, salt, "encrypt");
  const ciphertextBuf = await subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext)
  );
  return {
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertextBuf)),
  };
}

export async function decrypt(password, { salt, iv, ciphertext }) {
  const key = await deriveKey(password, base64ToBytes(salt), "decrypt");
  const plaintextBuf = await subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(iv) },
    key,
    base64ToBytes(ciphertext)
  );
  return new TextDecoder().decode(plaintextBuf);
}
