import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="min-h-screen">
      <header className="max-w-5xl mx-auto flex items-center justify-between px-6 py-6">
        <span className="font-display text-xl tracking-tight">Facturis</span>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/login" className="hover:underline">
            Se connecter
          </Link>
          <Link href="/login?mode=signup" className="btn-primary">
            Essayer gratuitement
          </Link>
        </nav>
      </header>

      <section className="max-w-5xl mx-auto px-6 pt-16 pb-24 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <p className="uppercase tracking-widest text-xs text-moss font-medium mb-4">
            Facturation · Comptabilité · Trésorerie
          </p>
          <h1 className="text-4xl md:text-5xl leading-tight mb-6">
            Chaque facture s&apos;écrit&nbsp;
            <span className="italic text-clay">toute seule</span>&nbsp;dans vos comptes.
          </h1>
          <p className="text-lg text-ink/70 mb-8 max-w-md">
            Créez vos factures clients, encaissez, et laissez Facturis tenir votre journal
            comptable en partie double, votre bilan et votre rapprochement bancaire — en
            temps réel.
          </p>
          <div className="flex items-center gap-4">
            <Link href="/login?mode=signup" className="btn-primary">
              Créer mon compte
            </Link>
            <span className="text-sm text-ink/50">Sans carte bancaire pour commencer</span>
          </div>
        </div>

        {/* Signature element: a live-looking ledger line that always balances */}
        <div className="card font-mono text-sm">
          <div className="flex justify-between text-xs text-ink/40 uppercase tracking-widest mb-4">
            <span>Journal</span>
            <span>Facture #2026-014</span>
          </div>
          <div className="space-y-2">
            <Row label="411 · Clients" value="1 200,00" side="debit" />
            <Row label="706 · Prestations de services" value="1 000,00" side="credit" />
            <Row label="445710 · TVA collectée" value="200,00" side="credit" />
          </div>
          <div className="border-t border-line mt-4 pt-4 flex justify-between text-xs text-ink/50">
            <span>Équilibré</span>
            <span>1 200,00 = 1 200,00</span>
          </div>
        </div>
      </section>

      <section className="border-t border-line bg-white/60">
        <div className="max-w-5xl mx-auto px-6 py-16 grid md:grid-cols-3 gap-8">
          <Feature
            title="Factures"
            text="Devis, factures, relances et statut de paiement pour chaque client, au même endroit."
          />
          <Feature
            title="Comptabilité"
            text="Chaque facture émise ou encaissée génère automatiquement l'écriture comptable correspondante."
          />
          <Feature
            title="Rapprochement bancaire"
            text="Importez le relevé de votre banque et faites correspondre chaque ligne à une facture en un clic."
          />
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 py-20 text-center">
        <h2 className="text-3xl mb-4">Un seul abonnement, tout inclus</h2>
        <div className="card max-w-sm mx-auto text-left">
          <p className="text-sm text-ink/50 mb-1">Abonnement mensuel</p>
          <p className="text-4xl font-display mb-4">
            29€<span className="text-base text-ink/50"> / mois</span>
          </p>
          <ul className="text-sm space-y-2 mb-6 text-ink/70">
            <li>— Clients et factures illimités</li>
            <li>— Journal, grand livre et bilan automatiques</li>
            <li>— Import bancaire et rapprochement</li>
          </ul>
          <Link href="/login?mode=signup" className="btn-primary w-full">
            Commencer
          </Link>
        </div>
      </section>

      <footer className="border-t border-line py-8 text-center text-xs text-ink/40">
        Facturis — fait pour les indépendants et petites entreprises.
      </footer>
    </main>
  );
}

function Row({ label, value, side }: { label: string; value: string; side: "debit" | "credit" }) {
  return (
    <div className="flex justify-between">
      <span className="text-ink/70">{label}</span>
      <span className={side === "debit" ? "" : "pl-8"}>{side === "debit" ? value : ""}</span>
      <span className={side === "credit" ? "" : "pl-8"}>{side === "credit" ? value : ""}</span>
    </div>
  );
}

function Feature({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <h3 className="text-lg mb-2">{title}</h3>
      <p className="text-sm text-ink/60">{text}</p>
    </div>
  );
}
