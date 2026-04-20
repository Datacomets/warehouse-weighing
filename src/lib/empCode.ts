export const EMP_EMAIL_DOMAIN = "comets.local";

export function normalizeEmpCode(raw: string): string {
  return raw.trim().toUpperCase();
}

export function isValidEmpCode(code: string): boolean {
  return /^[A-Z0-9][A-Z0-9_-]{1,31}$/.test(code);
}

export function empCodeToEmail(code: string): string {
  return `${normalizeEmpCode(code)}@${EMP_EMAIL_DOMAIN}`;
}

export function emailToEmpCode(email: string): string | null {
  const suffix = `@${EMP_EMAIL_DOMAIN}`;
  if (!email.endsWith(suffix)) return null;
  return email.slice(0, -suffix.length);
}
