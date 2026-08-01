"use client";
import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const exchanged = useRef(false);

  // Le lien recu par email contient un code PKCE (?code=...) qu'il faut
  // echanger contre une session avant de pouvoir changer le mot de passe.
  // Le code est a usage unique : en dev, le Strict Mode de React invoque cet
  // effet deux fois, donc on garde une ref pour n'echanger qu'une seule fois.
  useEffect(() => {
    if (exchanged.current) return;
    exchanged.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const urlErrorDescription = params.get("error_description");

    if (!code) {
      setError(
        urlErrorDescription
          ? `Lien invalide : ${decodeURIComponent(urlErrorDescription.replace(/\+/g, " "))}. Redemande un lien depuis la page de connexion (utilise le tout dernier email reçu).`
          : "Lien invalide ou expiré. Redemande un lien depuis la page de connexion."
      );
      return;
    }
    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) {
        setError(`Lien invalide : ${error.message}. Redemande un lien depuis la page de connexion.`);
        return;
      }
      setReady(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.push("/");
    router.refresh();
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-4 text-slate-100">
      <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900/90 p-6 shadow-sm">
        <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Dashboard League of Legends</p>
        <h1 className="mt-2 text-2xl font-semibold">Nouveau mot de passe</h1>

        {ready ? (
          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
            <label className="text-sm text-slate-300">
              Nouveau mot de passe
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
            <label className="text-sm text-slate-300">
              Confirmer le mot de passe
              <input
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100"
                placeholder="••••••••"
              />
            </label>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {loading ? "..." : "Mettre à jour le mot de passe"}
            </button>
          </form>
        ) : (
          <p className="mt-6 text-sm text-slate-400">{error ?? "Vérification du lien..."}</p>
        )}
      </div>
    </main>
  );
}
