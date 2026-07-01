export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/rooms/:path*",
    "/session/:path*",
    // /report/:path* intentionally excluded — public reports are viewable without auth.
    // The backend enforces ownership on private reports; the page handles 403 gracefully.
    "/library/:path*",
    "/profile/:path*",
    "/settings/:path*",
    "/notifications/:path*",
  ],
};
