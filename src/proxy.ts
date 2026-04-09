import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const INTAKE_COMPLETE_PHASE = 6

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Always allow the auth callback page through — it handles its own session
  if (pathname.startsWith('/auth/')) {
    return supabaseResponse
  }

  // Demo pages and public profile pages are fully public
  if (pathname.startsWith('/demo') || pathname.startsWith('/p/')) {
    return supabaseResponse
  }

  // Gated app routes — everything under the (app) route group + /onboarding
  const appPaths = ['/dashboard', '/discover', '/signals', '/engage', '/pipeline', '/profile', '/intake']
  const isAppRoute = appPaths.some(p => pathname === p || pathname.startsWith(p + '/'))
  const isOnboarding = pathname === '/onboarding' || pathname.startsWith('/onboarding/')

  // Not logged in → /login for any gated route
  if ((isAppRoute || isOnboarding) && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Redirect logged-in users away from /login
  if (pathname === '/login' && user) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // For logged-in users hitting app/onboarding routes, enforce progression:
  //   not onboarded   → /onboarding
  //   intake pending  → /intake
  //   fully complete  → allow, but redirect away from /onboarding and /intake to /dashboard
  if (user && (isAppRoute || isOnboarding)) {
    const [{ data: profile }, { data: candidateModel }] = await Promise.all([
      supabase.from('profiles').select('onboarding_completed').eq('id', user.id).maybeSingle(),
      supabase.from('candidate_models').select('intake_phase').eq('user_id', user.id).maybeSingle(),
    ])

    const onboardingComplete = !!profile?.onboarding_completed
    const intakeComplete = (candidateModel?.intake_phase ?? 0) >= INTAKE_COMPLETE_PHASE

    // Step 1: not onboarded → force /onboarding
    if (!onboardingComplete && !isOnboarding) {
      const url = request.nextUrl.clone()
      url.pathname = '/onboarding'
      return NextResponse.redirect(url)
    }

    // Step 2: onboarded but intake pending → force /intake
    if (onboardingComplete && !intakeComplete && !pathname.startsWith('/intake')) {
      const url = request.nextUrl.clone()
      url.pathname = '/intake'
      return NextResponse.redirect(url)
    }

    // Step 3: fully complete but revisiting /onboarding or /intake → /dashboard
    if (onboardingComplete && intakeComplete && (isOnboarding || pathname.startsWith('/intake'))) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
