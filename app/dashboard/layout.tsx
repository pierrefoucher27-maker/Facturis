import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const NAV = [
  { href: "/dashboard", label: "Vue d'ensemble" },
  { href: "/dashboard/clients", label: "Clients" },
  { href: "/dashboard/invoices", label: "Factures" },
  { href: "/dashboard/accounting/journal", label: "Journal" },
  { href: "/dashboard/accounting/balance-sheet", label: "Bilan" },
  { href: "/dashboard/accounting/bank", label: "Banque" },
  { href: "/dashboard/settings/billing", label: "Abonnement" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: company } = await supabase
    .from("companies")
    .select("*")
    .eq("owner_id", user.id)
    .single();

  if (!company) {
    // Sécurité : un compte sans entreprise ne devrait pas arriver via le flux d'inscription normal
    redirect("/login?error=Aucune+entreprise+trouvée+pour+ce+compte");
  }

  return (
    <div className="min-h-screen grid grid-cols-[220px_1fr]">
      <aside className="border-r border-line bg-white p-6 flex flex-col">
        <span className="font-display text-lg mb-8">Facturis</span>
        <nav className="space-y-1 text-sm flex-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-lg px-3 py-2 hover:bg-paper text-ink/70 hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="text-xs text-ink/40 pt-4 border-t border-line">
          <p className="font-medium text-ink/70">{company.name}</p>
          <p>{user.email}</p>
          <form action="/api/auth/signout" method="post" className="mt-2">
            <button className="underline">Déconnexion</button>
          </form>
        </div>
      </aside>
      <div className="p-8">{children}</div>
    </div>
  );
}
