import { isValidVerificationEmail } from './email-verification';

export function validateEmailChange(email: string, current?: string): string | null {
  if (!isValidVerificationEmail(email)) return 'auth.invalidEmail';
  return email.trim().toLowerCase() === current?.trim().toLowerCase() ? 'account.sameEmail' : null;
}
export function canConfirmAccountDeletion(acknowledged: boolean, confirmation: string): boolean {
  return acknowledged && confirmation === 'DELETE';
}
