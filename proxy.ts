import { NextResponse, type NextRequest } from 'next/server';

/* A first, quick gate: the console and the account pages need their session
   cookie, or the visitor is sent to sign in. It only looks for the cookie; the
   page itself (and every API route) checks the signature, the account and the
   role on each request, so this is about a good redirect, not security. */

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const staff = pathname === '/dashboard' || pathname.startsWith('/dashboard/');
  const cookie = staff ? 'brewns_staff' : 'brewns_customer';
  if (req.cookies.has(cookie)) return NextResponse.next();
  const to = req.nextUrl.clone();
  to.pathname = staff ? '/staff/signin' : '/account/signin';
  to.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(to);
}

export const config = {
  matcher: ['/dashboard', '/dashboard/:path*', '/account'],
};
