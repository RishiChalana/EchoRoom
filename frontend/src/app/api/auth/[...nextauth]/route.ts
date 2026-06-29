import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import CredentialsProvider from "next-auth/providers/credentials";
import type { NextAuthOptions } from "next-auth";
import type { JWT } from "next-auth/jwt";
import type { Session } from "next-auth";

const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" as const },
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
          }),
        ]
      : []),
    ...(process.env.GITHUB_CLIENT_ID
      ? [
          GitHubProvider({
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
          }),
        ]
      : []),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
        const res = await fetch(`${apiUrl}/api/v1/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: credentials.email,
            password: credentials.password,
          }),
        });

        if (!res.ok) return null;

        const user = await res.json() as { id: string; email: string; name: string | null };
        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.email = user.email;
        token.name = user.name;
        token.image = user.image;
      }

      const isExpiredOrMissing =
        !token.backendAccessToken ||
        !token.backendTokenExpires ||
        (token.backendTokenExpires as number) < Date.now();

      if (isExpiredOrMissing && token.email) {
        try {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
          const res = await fetch(
            `${apiUrl}/api/v1/auth/internal/issue-token`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Internal-Secret": process.env.NEXTAUTH_SECRET ?? "",
              },
              body: JSON.stringify({ email: token.email }),
            }
          );
          if (res.ok) {
            const data = await res.json() as { access_token: string };
            token.backendAccessToken = data.access_token;
            // Refresh 1h before the backend's 24h expiry
            token.backendTokenExpires = Date.now() + 23 * 60 * 60 * 1000;
          } else {
            console.warn("Failed to issue backend access token, status:", res.status);
          }
        } catch (err) {
          console.warn("Error issuing backend access token:", err);
        }
      }

      return token;
    },
    session({ session, token }: { session: Session; token: JWT }) {
      if (session.user) {
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.image = token.image as string | undefined;
      }
      session.backendAccessToken = token.backendAccessToken as string | undefined;
      return session;
    },
  },
  pages: { signIn: "/login" },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
