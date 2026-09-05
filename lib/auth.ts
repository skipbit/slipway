import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validations";

/**
 * Auth.js (NextAuth v5) configuration.
 *
 * - JWT session strategy: required for the Credentials provider, and keeps
 *   the dashboard fast (no DB hit per request just to read the session).
 * - PrismaAdapter still persists Users/Accounts for OAuth sign-ins.
 * - Google sign-in is enabled automatically when AUTH_GOOGLE_ID/SECRET are set.
 * - Linking an OAuth account marks the address verified (see `events` below).
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  // Errors land on /login rather than Auth.js's own page, so the one that
  // actually happens — OAuthAccountNotLinked, when a Google address matches an
  // existing account — can be explained in the app's own words.
  pages: { signIn: "/login", error: "/login" },
  trustHost: true,
  providers: [
    Google({
      // `allowDangerousEmailAccountLinking` is deliberately NOT set.
      //
      // With it on, a Google sign-in whose address matches an existing account
      // signs you into that account. Convenient, and an account takeover:
      // anyone can create a password account under someone else's address
      // (nothing gates signup on verification), and the real owner's first
      // Google sign-in then drops them into the squatter's row — password and
      // all. Email verification does not save it either, because the
      // confirmation mail goes to the victim, who may well click it and verify
      // the attacker's account for them.
      //
      // Linking is still supported, from the only place it is safe: an
      // already-authenticated session. Auth.js links accounts without going
      // near the address-matching branch when a session is present
      // (@auth/core handle-login.js), which is what
      // app/dashboard/actions.ts#connectOAuthAccountAction uses.
    }),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        // Already trimmed and lower-cased by loginSchema.
        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        });
        if (!user?.passwordHash) return null;

        const valid = await bcrypt.compare(
          parsed.data.password,
          user.passwordHash,
        );
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  events: {
    /**
     * Fires when an OAuth account is attached to a user — on first sign-in, and
     * again if a Google login links to an EXISTING email/password account
     * (allowDangerousEmailAccountLinking above). It is the documented seam for
     * this: the provider's `profile()` return type has no room for
     * `emailVerified`, and this event's `profile` is the mapped user, not the
     * raw OIDC claims.
     *
     * Google has already proved the address, so the account should not be asked
     * to prove it again. This is only sound because linking is now restricted:
     * with `allowDangerousEmailAccountLinking` off, the only ways to get here
     * are creating a brand new user, or attaching a provider from inside an
     * authenticated session — in both cases the person holds the account AND
     * the provider vouches for the address. While the flag was on there was a
     * third way, someone else's Google sign-in landing on a squatted password
     * account, which is why this used to also require `passwordHash: null`.
     *
     * `emailVerified: null` stays: an existing timestamp records when the
     * address was FIRST proved and should not move.
     *
     * Whether the provider vouched for the address at all is checked in the
     * `signIn` callback below, which is where the raw profile is available.
     */
    async linkAccount({ user }) {
      // `User.id` is optional on Auth.js's type, and Prisma DROPS an undefined
      // filter field rather than matching nothing — so an id-less user here
      // would turn this into "stamp emailVerified on every passwordless
      // unverified account". Adapter users always carry one today; this is the
      // guard for the day one does not.
      if (!user.id) return;

      await prisma.user.updateMany({
        where: { id: user.id, emailVerified: null },
        data: { emailVerified: new Date() },
      });
    },
  },
  callbacks: {
    /**
     * An OAuth provider that says outright it has NOT verified the address is
     * not an identity we can accept — it would let anyone claim any address by
     * putting it in an unverified profile. Google normally sets this true;
     * Workspace domains and any provider added later are why it is checked.
     */
    signIn({ account, profile }) {
      // "oidc" and "oauth" both: Auth.js types Google and friends as oidc, but
      // GitHub, Discord and every plain OAuth 2.0 provider as "oauth" — and the
      // comment above promises this covers providers added later.
      if (!account || (account.type !== "oidc" && account.type !== "oauth")) {
        return true;
      }
      return profile?.email_verified !== false;
    },
    jwt({ token, user }) {
      if (user?.id) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) ?? token.sub ?? "";
      }
      return session;
    },
  },
});

/**
 * The bcrypt work factor, in one place.
 *
 * Signup and password reset both mint hashes; raising this in only one of them
 * would leave account recovery quietly weaker than the front door, which is
 * the path that matters most after a breach.
 */
const BCRYPT_COST = 10;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export function isGoogleConfigured(): boolean {
  return Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
}
