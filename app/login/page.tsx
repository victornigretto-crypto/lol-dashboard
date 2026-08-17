"use client";
import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const supabase = createClient();
  const searchParams = useSearchParams();

  const [mode, setMode] = useState<"login" | "signup" | "forgot">(
    searchParams.get("mode") === "signup" ? "signup" : "login"
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setNeedsConfirmation(false);
    setLoading(true);

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      setLoading(false);
      if (error) {
        setError(error.message);
        if (error.message.toLowerCase().includes("email not confirmed")) {
          setNeedsConfirmation(true);
        }
        return;
      }
      router.push("/");
      router.refresh();
    } else if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({ email, password });
      setLoading(false);
      if (error) {
        setError(error.message);
        return;
      }
      // Si la confirmation d'email est désactivée côté Supabase, signUp ouvre
      // déjà une session : on enchaîne sans faire retaper quoi que ce soit.
      // "/" redirige alors vers l'onboarding, qui liera le Riot ID déjà saisi.
      if (data.session) {
        router.push("/");
        router.refresh();
        return;
      }
      setInfo("Compte créé. Vérifie tes emails pour confirmer ton adresse, puis connecte-toi.");
      setMode("login");
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setLoading(false);
      if (error) {
        setError(error.message);
        return;
      }
      setInfo("Si un compte existe avec cet email, un lien de réinitialisation vient d'être envoyé.");
      setMode("login");
    }
  };

  const handleResendConfirmation = async () => {
    setResendLoading(true);
    setError(null);
    const { error } = await supabase.auth.resend({ type: "signup", email });
    setResendLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setNeedsConfirmation(false);
    setInfo("Email de confirmation renvoyé. Vérifie ta boîte de réception.");
  };

  const title =
    mode === "login" ? "Connexion" : mode === "signup" ? "Créer un compte" : "Mot de passe oublié";

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-slate-950 p-4 text-slate-100">
      {/* Sortie de secours : arriver ici ne doit jamais être un cul-de-sac,
          l'analyse gratuite reste accessible sans compte. Placé en haut à
          gauche, hors de la carte, pour ne pas concurrencer le formulaire. */}
      <Link
        href="/"
        className="absolute top-4 left-4 rounded-full border border-slate-700 px-4 py-1.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-slate-100"
      >
        Continuer sans se connecter
      </Link>

      <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900/90 p-6 shadow-sm">
        <p className="text-sm uppercase tracking-[0.3em] text-slate-400">GG Dashboard</p>
        <h1 className="mt-2 text-2xl font-semibold">{title}</h1>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
          <label className="text-sm text-slate-300">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100"
              placeholder="toi@example.com"
            />
          </label>

          {mode !== "forgot" && (
            <label className="text-sm text-slate-300">
              Mot de passe
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100"
                placeholder="••••••••"
              />
            </label>
          )}

          {mode === "login" && (
            <button
              type="button"
              onClick={() => {
                setMode("forgot");
                setError(null);
                setInfo(null);
                setNeedsConfirmation(false);
              }}
              className="self-end text-xs text-slate-400 underline hover:text-slate-200"
            >
              Mot de passe oublié ?
            </button>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}
          {needsConfirmation && (
            <button
              type="button"
              onClick={handleResendConfirmation}
              disabled={resendLoading}
              className="text-left text-sm text-blue-400 underline hover:text-blue-300 disabled:opacity-50"
            >
              {resendLoading ? "Envoi..." : "Renvoyer l'email de confirmation"}
            </button>
          )}
          {info && <p className="text-sm text-green-400">{info}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {loading
              ? "..."
              : mode === "login"
                ? "Se connecter"
                : mode === "signup"
                  ? "S'inscrire"
                  : "Envoyer le lien"}
          </button>
        </form>

        {mode === "forgot" ? (
          <button
            onClick={() => {
              setMode("login");
              setError(null);
              setInfo(null);
            }}
            className="mt-4 text-sm text-slate-400 underline hover:text-slate-200"
          >
            Retour à la connexion
          </button>
        ) : (
          <button
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login");
              setError(null);
              setInfo(null);
              setNeedsConfirmation(false);
            }}
            className="mt-4 text-sm text-slate-400 underline hover:text-slate-200"
          >
            {mode === "login" ? "Pas encore de compte ? Inscris-toi" : "Déjà un compte ? Connecte-toi"}
          </button>
        )}
      </div>
    </main>
  );
}
