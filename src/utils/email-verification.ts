export const RESEND_COOLDOWN_SECONDS = 60;

export function isValidVerificationEmail(email: string): boolean {
  return email.trim().length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function resendSecondsRemaining(availableAt: number, now = Date.now()): number {
  return Math.max(0, Math.ceil((availableAt - now) / 1000));
}
