export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/rooms/:path*",
    "/session/:path*",
    "/report/:path*",
    "/library/:path*",
    "/profile/:path*",
    "/settings/:path*",
    "/notifications/:path*",
  ],
};
