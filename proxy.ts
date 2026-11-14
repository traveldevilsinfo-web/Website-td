import { NextResponse, type NextRequest } from "next/server";

// Optimistic gates only (cookie present). Real checks: requireUser() in admin, requireOps() in ops.
// Website admin and ops have separate logins and separate cookies.
export function proxy(req: NextRequest) {
  const ops = req.nextUrl.pathname.startsWith("/ops");
  if (!req.cookies.has(ops ? "ops_session" : "td_admin")) return NextResponse.redirect(new URL(ops ? "/ops/login" : "/admin/login", req.url));
}

export const config = { matcher: ["/admin", "/admin/((?!login).*)", "/ops", "/ops/((?!login).*)"] };
