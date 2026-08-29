import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function getCompany(supabase: ReturnType<typeof createClient>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: company } = await supabase
    .from("companies")
    .select("id")
    .eq("owner_id", user!.id)
    .single();
  return company!;
}

async function addClient(formData: FormData) {
  "use server";
  const supabase = createClient();
  const company = await getCompany(supabase);
  await supabase.from("clients").insert({
    company_id: company.id,
    name: formData.get("name") as string,
    email: formData.get("email") as string,
    address: formData.get("address") as string,
    siret: formData.get("siret") as string,
  });
  redirect("/dashboard/clients");
}

export default async function ClientsPage() {
  const supabase = createClient();
  const company = await getCompany(supabase);
  const { data: clients } = await supabase
    .from("clients")
    .select("*")
    .eq("company_id", company.id)
    .order("created_at", { ascending: false });

  return (
    <div className="grid md:grid-cols-[1fr_320px] gap-8">
      <div>
        <h1 className="text-2xl mb-6">Clients</h1>
        {!clients?.length && (
          <p className="text-sm text-ink/50">
            Aucun client pour l&apos;instant. Ajoutez-en un pour créer votre première facture.
          </p>
        )}
        <div className="space-y-3">
          {clients?.map((c) => (
            <div key={c.id} className="card flex items-center justify-between">
              <div>
                <p className="font-medium">{c.name}</p>
                <p className="text-sm text-ink/50">{c.email}</p>
              </div>
              <a href={`/dashboard/invoices/new?client=${c.id}`} className="btn-secondary">
                Nouvelle facture
              </a>
            </div>
          ))}
        </div>
      </div>

      <div className="card h-fit">
        <h2 className="text-lg mb-4">Ajouter un client</h2>
        <form action={addClient} className="space-y-3">
          <input name="name" required placeholder="Nom / raison sociale" className="input" />
          <input name="email" type="email" placeholder="Email" className="input" />
          <input name="address" placeholder="Adresse" className="input" />
          <input name="siret" placeholder="SIRET (optionnel)" className="input" />
          <button type="submit" className="btn-primary w-full">
            Ajouter
          </button>
        </form>
      </div>
    </div>
  );
}
