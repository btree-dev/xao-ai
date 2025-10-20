export interface AgreementInput {
  venueName: string;
  venueAddress: string;
  startTime: number; // unix seconds
  durationMinutes: number;
  artistSocialHandle: string;
  venueSocialHandle: string;
  artistWallet: string;
  venueWallet: string;
  paymentAmountUsdCents: number;
}

export function validateAgreementInput(a: AgreementInput): string[] {
  const errs: string[] = [];
  if (!a.venueName) errs.push('venueName required');
  if (!a.venueAddress) errs.push('venueAddress required');
  if (a.startTime <= 0) errs.push('startTime must be > 0');
  if (a.durationMinutes <= 0 || a.durationMinutes > 1440) errs.push('durationMinutes invalid');
  if (!a.artistWallet || !a.artistWallet.startsWith('0x')) errs.push('artistWallet invalid');
  if (!a.venueWallet || !a.venueWallet.startsWith('0x')) errs.push('venueWallet invalid');
  if (a.paymentAmountUsdCents <= 0) errs.push('paymentAmountUsdCents must be > 0');
  return errs;
}
