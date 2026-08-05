import crypto from "crypto";

/**
 * Compares two strings in constant time, so an attacker can't guess your
 * passphrase/secret faster by measuring how long a "wrong" response takes
 * (a timing attack). Regular `===` comparison exits early on the first
 * mismatched character, which leaks tiny timing differences; this doesn't.
 */
export function safeCompare(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;

  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);

  // Buffers must be equal length for timingSafeEqual — pad the shorter one
  // so the length itself doesn't leak info, then still fail if truly unequal.
  const maxLen = Math.max(bufA.length, bufB.length);
  const paddedA = Buffer.alloc(maxLen);
  const paddedB = Buffer.alloc(maxLen);
  bufA.copy(paddedA);
  bufB.copy(paddedB);

  return crypto.timingSafeEqual(paddedA, paddedB) && bufA.length === bufB.length;
}
