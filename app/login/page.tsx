import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function signIn(formData: FormData) {
  "use server";
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  redirect("/dashboard");
}

async function signUp(formData: FormData) {
  "use server";
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const companyName = formData.get("companyName") as string;
  const supabase = createClient();

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error || !data.user) redirect(`/login?mode=signup&error=${encodeURIComponent(error?.message || "Erreur")}`);

  // Crée l'entreprise associée (le plan comptable par défaut est ajouté automatiquement par un trigger SQL)
  await supabase.from("companies").insert({ owner_id: data.user!.id, name: companyName });

  redirect("/dashboard");
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: { mode?: string; error?: string };
}) {
  const isSignup = searchParams.mode === "signup";

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="card w-full max-w-sm">
        <h1 className="text-2xl mb-1">{isSignup ? "Créer votre compte" : "Se connecter"}</h1>
        <p className="text-sm text-ink/50 mb-6">
          {isSignup ? "Un compte, une entreprise, un abonnement." : "Ravi de vous revoir."}
        </p>

        {searchParams.error && (
          <p className="text-sm text-clay mb-4">{searchParams.error}</p>
        )}

        <form action={isSignup ? signUp : signIn} className="space-y-4">
          {isSignup && (
            <div>
              <label className="text-xs text-ink/50">Nom de l&apos;entreprise</label>
              <input name="companyName" required className="input" placeholder="Ma société" />
            </div>
          )}
          <div>
            <label className="text-xs text-ink/50">Email</label>
            <input name="email" type="email" required className="input" placeholder="vous@exemple.fr" />
          </div>
          <div>
            <label className="text-xs text-ink/50">Mot de passe</label>
            <input name="password" type="password" required minLength={6} className="input" />
          </div>
          <button type="submit" className="btn-primary w-full">
            {isSignup ? "Créer mon compte" : "Se connecter"}
          </button>
        </form>

        <p className="text-xs text-ink/50 mt-6 text-center">
          {isSignup ? (
            <>
              Déjà un compte ? <a href="/login" className="underline">Se connecter</a>
            </>
          ) : (
            <>
              Pas encore de compte ?{" "}
              <a href="/login?mode=signup" className="underline">S&apos;inscrire</a>
            </>
          )}
        </p>
      </div>
    </main>
  );
}
