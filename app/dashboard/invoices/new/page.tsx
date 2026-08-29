import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { postInvoiceIssuedEntry, computeTotals } from "@/lib/accounting";
import InvoiceForm from "@/components/InvoiceForm";

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

async function nextInvoiceNumber(supabase: ReturnType<typeof createClient>, companyId: string) {
  const year = new Date().getFullYear();
  const { count } = await supabase
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .like("number", `${year}-%`);
  const n = (count ?? 0) + 1;
  return `${year}-${String(n).padStart(3, "0")}`;
}

async function createInvoice(formData: FormData) {
  "use server";
  const supabase = createClient();
  const company = await getCompany(supabase);

  const clientId = formData.get("clientId") as string;
  const tvaRate = parseFloat((formData.get("tvaRate") as string) || "0");
  const issueDate = (formData.get("issueDate") as string) || undefined;
  const dueDate = (formData.get("dueDate") as string) || null;
  const lines = JSON.parse(formData.get("linesJson") as string) as {
    description: string;
    quantity: string;
    unit_price: string;
  }[];

  const cleanLines = lines
    .filter((l) => l.description && parseFloat(l.unit_price) >= 0)
    .map((l) => ({
      description: l.description,
      quantity: parseFloat(l.quantity) || 1,
      unit_price: parseFloat(l.unit_price) || 0,
    }));

  if (!clientId || cleanLines.length === 0) {
    redirect("/dashboard/invoices/new?error=Formulaire+incomplet");
  }

  const number = await nextInvoiceNumber(supabase, company.id);

  const { data: invoice, error } = await supabase
    .from("invoices")
    .insert({
      company_id: company.id,
      client_id: clientId,
      number,
      status: "sent",
      issue_date: issueDate,
      due_date: dueDate,
      tva_rate: tvaRate,
    })
    .select()
    .single();

  if (error || !invoice) {
    redirect(`/dashboard/invoices/new?error=${encodeURIComponent(error?.message || "Erreur")}`);
  }

  await supabase
    .from("invoice_items")
    .insert(cleanLines.map((l) => ({ ...l, invoice_id: invoice!.id })));

  const { data: client } = await supabase
    .from("clients")
    .select("name")
    .eq("id", clientId)
    .single();

  const totals = computeTotals(cleanLines, tvaRate);
  await postInvoiceIssuedEntry(
    supabase,
    company.id,
    invoice!.id,
    `Facture ${number} — ${client?.name ?? ""}`,
    totals
  );

  redirect("/dashboard/invoices");
}

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: { client?: string; error?: string };
}) {
  const supabase = createClient();
  const company = await getCompany(supabase);
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name")
    .eq("company_id", company.id)
    .order("name");

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl mb-6">Nouvelle facture</h1>
      {searchParams.error && <p className="text-sm text-clay mb-4">{searchParams.error}</p>}
      {!clients?.length ? (
        <p className="text-sm text-ink/50">
          Ajoutez d&apos;abord un client dans{" "}
          <a href="/dashboard/clients" className="underline">
            Clients
          </a>
          .
        </p>
      ) : (
        <InvoiceForm clients={clients} defaultClientId={searchParams.client} action={createInvoice} />
      )}
    </div>
  );
}
