import { NextResponse, type NextRequest } from "next/server";

// Optimistic gate only (cookie present). Real checks: requireUser() in every admin page/action/route.
export function proxy(req: NextRequest) {
  if (!req.cookies.has("td_admin")) return NextResponse.redirect(new URL("/admin/login", req.url));
}

export const config = { matcher: ["/admin", "/admin/((?!login).*)"] };
