// See lib/prisma.ts: this marks the boundary so a client component that
// imports from here fails with a message about the boundary rather than about
// a transitive dependency's use of `dns`.
import "server-only";

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { providerVouchedForEmail } from "@/lib/auth-policy";
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
      // app/dashboard/actions.ts#connectGoogleAction uses.
      //
      // This paragraph is the argument; everywhere else points here rather than
      // restating it, and eslint.config.mjs refuses the flag outright so a
      // provider copied from the Auth.js docs cannot bring it back.
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
     * when a provider is attached from Settings. It is the documented seam for
     * marking the address verified: the provider's `profile()` return type has
     * no room for `emailVerified`, and this event's `profile` is the mapped
     * user, not the raw OIDC claims.
     *
     * Those two are the only ways here, which is what makes trusting the
     * provider sound — in both, the person holds the account AND the provider
     * vouches for the address. See the note on the Google provider above for
     * the third way that used to exist.
     *
     * `emailVerified: null` stays: an existing timestamp records when the
     * address was FIRST proved and should not move. Whether the provider
     * vouched at all is checked in the `signIn` callback below, which is where
     * the raw profile lives.
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
    /** The rule, and its reasoning, live in lib/auth-policy.ts — with tests. */
    signIn({ account, profile }) {
      return providerVouchedForEmail(account, profile);
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
