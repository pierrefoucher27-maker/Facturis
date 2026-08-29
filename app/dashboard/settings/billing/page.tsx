import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";

async function getCompany(supabase: ReturnType<typeof createClient>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: company } = await supabase
    .from("companies")
    .select("*")
    .eq("owner_id", user!.id)
    .single();
  return { company: company!, user: user! };
}

async function startCheckout(formData: FormData) {
  "use server";
  const supabase = createClient();
  const { company, user } = await getCompany(supabase);

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("company_id", company.id)
    .maybeSingle();

  let customerId = sub?.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: company.name,
      metadata: { company_id: company.id },
    });
    customerId = customer.id;
    await supabase
      .from("subscriptions")
      .upsert(
        { company_id: company.id, stripe_customer_id: customerId, status: "inactive" },
        { onConflict: "company_id" }
      );
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: process.env.STRIPE_PRICE_ID_MONTHLY!, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/settings/billing?success=1`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/settings/billing?cancelled=1`,
    metadata: { company_id: company.id },
  });

  redirect(session.url!);
}

async function openPortal() {
  "use server";
  const supabase = createClient();
  const { company } = await getCompany(supabase);

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("company_id", company.id)
    .maybeSingle();

  if (!sub?.stripe_customer_id) redirect("/dashboard/settings/billing");

  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/settings/billing`,
  });

  redirect(session.url);
}

const STATUS_LABEL: Record<string, string> = {
  inactive: "Aucun abonnement actif",
  active: "Actif",
  past_due: "Paiement en retard",
  canceled: "Résilié",
};

export default async function BillingPage({
  searchParams,
}: {
  searchParams: { success?: string; cancelled?: string };
}) {
  const supabase = createClient();
  const { company } = await getCompany(supabase);

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("company_id", company.id)
    .maybeSingle();

  const isActive = sub?.status === "active";

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl mb-6">Abonnement</h1>

      {searchParams.success && (
        <p className="text-sm text-moss mb-4">
          Paiement confirmé — l&apos;activation apparaît ici dès que Stripe a validé l&apos;abonnement.
        </p>
      )}
      {searchParams.cancelled && (
        <p className="text-sm text-ink/50 mb-4">Paiement annulé, vous pouvez réessayer.</p>
      )}

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-ink/50 mb-1">Statut</p>
            <p className="text-lg">{STATUS_LABEL[sub?.status ?? "inactive"]}</p>
          </div>
          <span
            className={`text-xs px-3 py-1 rounded-full border ${
              isActive ? "border-moss text-moss" : "border-line text-ink/50"
            }`}
          >
            {isActive ? "Abonné" : "Non abonné"}
          </span>
        </div>

        {sub?.current_period_end && (
          <p className="text-sm text-ink/50 mb-4">
            Renouvellement le {new Date(sub.current_period_end).toLocaleDateString("fr-FR")}
          </p>
        )}

        <p className="text-3xl font-display mb-4">
          29€<span className="text-base text-ink/50"> / mois</span>
        </p>

        {isActive ? (
          <form action={openPortal}>
            <button className="btn-secondary w-full">Gérer l&apos;abonnement</button>
          </form>
        ) : (
          <form action={startCheckout}>
            <button className="btn-primary w-full">S&apos;abonner</button>
          </form>
        )}
      </div>

      <p className="text-xs text-ink/40 mt-4">
        Paiement sécurisé par Stripe. Vous pouvez résilier à tout moment depuis le portail de
        gestion.
      </p>
    </div>
  );
}
