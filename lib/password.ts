/**
 * Password and access-code hashing (NFR-SEC-03, FR-AUTH-02).
 *
 * The legacy app compared the camp PIN in client-side JavaScript and stored admin
 * passwords in plaintext (L-01, L-09). Both are fixed here: secrets are only ever
 * compared on the server, and only their hashes are stored.
 *
 * scrypt is used because it is memory-hard (resistant to GPU cracking) and built into
 * Node, so there is no native module to compile. bcrypt or argon2 would be equally
 * defensible choices.
 */
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

/** Hash a secret. Each call produces a different result — the salt is random. */
export async function hashSecret(plain: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derived = await scrypt(plain, salt, KEY_LENGTH);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

/**
 * Verify a secret against a stored hash.
 *
 * Uses timingSafeEqual rather than `===`. A plain comparison returns as soon as it finds
 * a differing byte, so response time leaks how much of the guess was correct, which is
 * enough to recover a short code like a camp PIN one character at a time.
 */
export async function verifySecret(plain: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, hashHex] = stored.split('$');

  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;

  const expected = Buffer.from(hashHex, 'hex');
  const actual = await scrypt(plain, Buffer.from(saltHex, 'hex'), expected.length);

  // Lengths must match before timingSafeEqual, which throws on mismatched buffers.
  if (actual.length !== expected.length) return false;

  return timingSafeEqual(actual, expected);
}
