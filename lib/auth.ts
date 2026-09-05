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
  pages: { signIn: "/login" },
  trustHost: true,
  providers: [
    Google({
      // A Google sign-in with the same email as an existing
      // email/password account links to it instead of erroring.
      allowDangerousEmailAccountLinking: true,
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
     * Google has already proved the address, so a pure OAuth account should not
     * be asked to prove it again. But the conditions matter, and the where
     * clause carries them so they are checked atomically:
     *
     * - `passwordHash: null` — the account has no local credential. Without
     *   this, an attacker who signed up with password auth under someone else's
     *   address gets their row stamped "Confirmed" the moment the real owner
     *   signs in with Google, and every gate written against `emailVerified`
     *   then trusts an account the attacker still knows the password to. Such a
     *   user stays unverified and confirms by clicking the emailed link, which
     *   is the thing that actually proves control.
     * - `emailVerified: null` — don't move an existing timestamp.
     *
     * Whether Google vouched for the address at all is checked in the `signIn`
     * callback below, which is where the raw profile is available.
     */
    async linkAccount({ user }) {
      await prisma.user.updateMany({
        where: { id: user.id, emailVerified: null, passwordHash: null },
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
      if (!account || account.type !== "oidc") return true;
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
