import { convexAuthNextjsMiddleware } from "@convex-dev/auth/nextjs/server";

// Auth state is refreshed here; access control itself lives in the Convex
// functions (registrations are registrant-scoped, organizer views check the
// ORGANIZER_EMAILS allowlist server-side).
export default convexAuthNextjsMiddleware();

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
