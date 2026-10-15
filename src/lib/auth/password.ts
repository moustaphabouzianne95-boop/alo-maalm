import bcrypt from "bcryptjs";

/**
 * Password hashing.
 *
 * bcrypt with a work factor of 12 (~250ms on the reference hardware) is a
 * deliberate cost/latency trade-off for an interactive marketplace: slow
 * enough to make offline cracking expensive, fast enough not to dominate the
 * login request budget.
 */
const SALT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (!hash) return false;
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

/**
 * Password policy — validated by Zod at the edge *and* re-checked here so no
 * code path can persist a weak credential.
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: "weak" | "fair" | "good" | "strong";
  missing: string[];
}

export function assessPasswordStrength(password: string): PasswordStrength {
  const missing: string[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) missing.push("length");
  if (!/[a-z\u0600-\u06FF]/.test(password)) missing.push("lowercase");
  if (!/[A-Z]/.test(password)) missing.push("uppercase");
  if (!/\d/.test(password)) missing.push("number");
  if (!/[^A-Za-z0-9]/.test(password)) missing.push("symbol");

  const satisfied = 5 - missing.length;
  const score = Math.max(0, Math.min(4, satisfied - 1)) as PasswordStrength["score"];
  const label = score <= 1 ? "weak" : score === 2 ? "fair" : score === 3 ? "good" : "strong";
  return { score, label, missing };
}

export function isPasswordAcceptable(password: string): boolean {
  return password.length >= PASSWORD_MIN_LENGTH && password.length <= PASSWORD_MAX_LENGTH;
}
