import { NextResponse } from "next/server";

// Cookie Names
const ADMIN_TOKEN = "admin_auth_token";
const CUSTOMER_TOKEN = "customer_auth_token";

// Public routes (don’t require user auth)
const publicPages = [
  "/auth",
  "/signup",
  "/admin/auth",
  "/api/admin",
  "/api/customers",
];

// Public API routes (no mailer token required)
const publicApiRoutes = ["/api/customers", "/api/admin", "/api/processer"];

export function middleware(request) {
  const { pathname } = request.nextUrl;

  const isApiRoute = pathname.startsWith("/api/");
  const isPublicPage = publicPages.some((path) => pathname.startsWith(path));
  const isPublicApiRoute = publicApiRoutes.some((route) =>
    pathname.startsWith(route)
  );

  console.log(`[Auth Middleware] Path: ${pathname}`);
  console.log(`[Auth Middleware] API route: ${isApiRoute}`);
  console.log(`[Auth Middleware] Public page: ${isPublicPage}`);
  console.log(`[Auth Middleware] Public API route: ${isPublicApiRoute}`);

  // ─── API ROUTES ──────────────────────────────────────
  if (isApiRoute) {
    if (!isPublicApiRoute) {
      // Require mailer token (header OR cookie)
      const headerToken = request.headers.get("mailer-auth-token");
      const cookieToken = request.cookies.get("mailer_auth_token")?.value;
      const mailerToken = headerToken || cookieToken;

      console.log("[Auth Middleware] mailer-auth-token (header):", headerToken);
      console.log("[Auth Middleware] mailer_auth_token (cookie):", cookieToken);

      if (!mailerToken) {
        return new NextResponse(
          JSON.stringify({ error: "Missing mailer authentication token" }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // ✅ API route is allowed
    return NextResponse.next();
  }

  // ─── WEB PAGES ──────────────────────────────────────
  const userData =
    request.cookies.get(ADMIN_TOKEN)?.value ||
    request.cookies.get(CUSTOMER_TOKEN)?.value;

  console.log(`[Auth Middleware] Auth cookie exists: ${!!userData}`);

  // If page is NOT public and no cookie → redirect to /auth
  if (!isPublicPage && !userData) {
    console.log(
      "[Auth Middleware] Unauthorized page access → redirect to /auth"
    );
    return NextResponse.redirect(new URL("/auth", request.url));
  }

  // If trying to access login/signup while already authenticated → redirect to dashboard
  if (
    isPublicPage &&
    userData &&
    ["/auth", "/signup", "/admin/auth"].some((p) => pathname.startsWith(p))
  ) {
    console.log(
      "[Auth Middleware] Already authenticated → redirect to /dashboard"
    );
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // ✅ Page is allowed
  return NextResponse.next();
}

// Run middleware on ALL routes (except static assets & Next.js internals)
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
