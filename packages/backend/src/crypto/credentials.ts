import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Get the encryption key from the environment.
 * Must be a 64-character hex string (32 bytes).
 */
function getKey(): Buffer {
  const keyHex =
    process.env["CREDENTIAL_ENCRYPTION_KEY"] ||
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  return Buffer.from(keyHex, "hex");
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns a base64 string of: IV (16 bytes) + AuthTag (16 bytes) + ciphertext.
 * Decrypted material is NEVER logged or returned to the frontend.
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Pack: IV + AuthTag + Ciphertext
  const packed = Buffer.concat([iv, authTag, encrypted]);
  return packed.toString("base64");
}

/**
 * Decrypt a base64-encoded AES-256-GCM ciphertext.
 * The result is held in memory only — never log, never return to frontend.
 */
export function decrypt(encryptedBase64: string): string {
  const key = getKey();
  const packed = Buffer.from(encryptedBase64, "base64");

  const iv = packed.subarray(0, IV_LENGTH);
  const authTag = packed.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = packed.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
