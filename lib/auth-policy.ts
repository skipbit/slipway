/**
 * The pure rules behind sign-in decisions, kept out of the places that act on
 * them.
 *
 * A pure function in `lib/` rather than an `if` inside the disconnect action,
 * because two places need the same answer and they must not disagree: the
 * action has to refuse, and the settings page has to stop offering a button
 * that can only ever fail. Here it is also testable without mocking four
 * modules, which is how every other rule in `lib/` is written.
 */
export type SignInMethodSource = {
  passwordHash: string | null;
  accounts: { provider: string }[];
};

/** Every way this account can get back in — provider ids, plus "password". */
export function signInMethods(user: SignInMethodSource): string[] {
  return [
    ...(user.passwordHash ? ["password"] : []),
    ...user.accounts.map((account) => account.provider),
  ];
}

/**
 * Can `provider` be detached without locking the user out?
 *
 * An OAuth-only account has no password and no way to set one — password reset
 * only mails accounts that already have a hash — so removing its last provider
 * would be a locked door with no key.
 */
export function canDisconnect(
  user: SignInMethodSource,
  provider: string,
): boolean {
  return signInMethods(user).some((method) => method !== provider);
}

/**
 * Did the provider actually vouch for the address it is handing us?
 *
 * A provider that says outright it has NOT verified the address cannot be used
 * as an identity — it would let anyone claim any address by putting it in an
 * unverified profile. Google normally sets this true; Workspace domains and
 * providers added later are why it is checked.
 *
 * Both "oidc" and "oauth": Auth.js types Google as oidc, but GitHub, Discord
 * and every plain OAuth 2.0 provider as "oauth". Anything else (credentials,
 * email) makes no such claim and is not this rule's business.
 */
export function providerVouchedForEmail(
  account: { type?: string } | null | undefined,
  profile: { email_verified?: boolean | null } | null | undefined,
): boolean {
  if (!account || (account.type !== "oidc" && account.type !== "oauth")) {
    return true;
  }
  return profile?.email_verified !== false;
}

/**
 * Did the provider vouch for THIS account's address?
 *
 * `linkAccount` fires with the session's user and the provider's profile, and
 * on the connect-from-Settings path those are two different things. Google
 * proving `attacker@gmail.com` says nothing about the `victim@example.com` on
 * the row it is being attached to — and stamping that row confirmed on the
 * strength of it is the takeover this flow exists to close: sign up under
 * someone else's address, connect your own Google, and their address reads
 * "Confirmed" on your account.
 *
 * Compared case-insensitively and trimmed, because `emailField` normalises what
 * we store but a provider profile arrives however the provider sends it.
 */
export function providerVouchedForThisAccount(
  accountEmail: string | null | undefined,
  profileEmail: string | null | undefined,
): boolean {
  const account = accountEmail?.trim().toLowerCase();
  const vouched = profileEmail?.trim().toLowerCase();
  return Boolean(account && vouched && account === vouched);
}
