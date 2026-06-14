import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import * as jose from "jose";
import type { NextAuthOptions } from "next-auth";
import type { JWT } from "next-auth/jwt";
import type { Session } from "next-auth";

// NextAuth v4 defaults to JWE (encrypted tokens) which PyJWT cannot decode.
// Override encode/decode to use plain HS256 signed JWT so the FastAPI backend
// can verify the token with PyJWT using the same NEXTAUTH_SECRET.
// Security: HS256 tokens are still signed — they cannot be forged without the
// secret. The payload (name, email, picture) is visible but not sensitive.
function secretBytes(secret: unknown): Uint8Array {
  if (typeof secret === "string") return new TextEncoder().encode(secret);
  if (Array.isArray(secret)) return new TextEncoder().encode(secret[0] as string);
  if (secret instanceof Uint8Array) return secret;
  // Buffer (Node.js) — treat as Uint8Array
  return new Uint8Array(secret as ArrayBuffer);
}

const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" as const },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID ?? "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
    }),
  ],
  jwt: {
    encode: async (params) => {
      const key = secretBytes(params.secret);
      return new jose.SignJWT((params.token ?? {}) as jose.JWTPayload)
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(params.maxAge ? `${params.maxAge}s` : "30d")
        .sign(key);
    },
    decode: async (params) => {
      if (!params.token) return null;
      const key = secretBytes(params.secret);
      try {
        const { payload } = await jose.jwtVerify(params.token, key, {
          algorithms: ["HS256"],
        });
        return payload as JWT;
      } catch {
        return null;
      }
    },
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.email = user.email;
        token.name = user.name;
        token.image = user.image;
      }
      return token;
    },
    session({ session, token }: { session: Session; token: JWT }) {
      if (session.user) {
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.image = token.image as string | undefined;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
