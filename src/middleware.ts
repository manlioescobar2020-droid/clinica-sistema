import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

const PORTAL_ROLES = ["PATIENT", "PROSPECT"]

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const pathname = req.nextUrl.pathname
    const role = token?.role as string | undefined

    // Login con sesión activa → redirigir según rol
    if (pathname === "/login" && token) {
      const dest = role && PORTAL_ROLES.includes(role) ? "/portal" : "/dashboard"
      return NextResponse.redirect(new URL(dest, req.url))
    }

    // PATIENT / PROSPECT intentan acceder al dashboard → redirigir al portal
    if (pathname.startsWith("/dashboard") && role && PORTAL_ROLES.includes(role)) {
      return NextResponse.redirect(new URL("/portal", req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const pathname = req.nextUrl.pathname
        // Rutas públicas
        if (pathname === "/login") return true
        // Todo lo demás requiere token
        return !!token
      },
    },
  }
)

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}