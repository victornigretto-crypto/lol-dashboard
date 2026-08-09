import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: getUser() revalide le token aupres de Supabase (contrairement
  // a getSession()) et rafraichit les cookies si besoin.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoginRoute = request.nextUrl.pathname.startsWith("/login");
  // /auth/* traite les liens de confirmation d'email.
  // /reset-password recoit le lien de recuperation Supabase : le token
  // arrive dans le fragment d'URL (#access_token=...), invisible cote
  // serveur. La session n'est etablie que cote client (detectSessionInUrl),
  // donc la route doit rester accessible sans session le temps que ca se
  // fasse.
  const isAuthRoute = request.nextUrl.pathname.startsWith("/auth");
  const isResetPasswordRoute = request.nextUrl.pathname.startsWith("/reset-password");
  // Porte d'entrée publique : analyse gratuite (accueil) + les pages de
  // motivation qui servent de pont vers l'inscription. Accessibles sans
  // compte ; app/page.tsx redirige lui-même les users connectés vers /suivi.
  // /api/riot/import doit rester public aussi : c'est l'API que l'accueil
  // appelle pour l'analyse gratuite d'un visiteur non connecté (route
  // handler, pas une page — une redirection HTML ici casserait le fetch()
  // côté client). /api/profile/link reste protégée : elle écrit sur LE
  // profil d'un user connecté, pas de sens pour un visiteur anonyme.
  const isPublicRoute =
    request.nextUrl.pathname === "/" ||
    request.nextUrl.pathname.startsWith("/decouvrir") ||
    request.nextUrl.pathname.startsWith("/rejoindre") ||
    request.nextUrl.pathname.startsWith("/api/riot/import");

  if (!user && !isLoginRoute && !isAuthRoute && !isResetPasswordRoute && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isLoginRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
