export const ALLOWED_EMAIL = 'alfonso.locsin@gmail.com';

export function isOwnerAccount(user: {
  email: string | null;
  emailVerified: boolean;
  providerData: { providerId: string }[];
} | null): boolean {
  return !!user && user.emailVerified &&
    user.email?.toLowerCase() === ALLOWED_EMAIL &&
    user.providerData.some(provider => provider.providerId === 'google.com');
}
