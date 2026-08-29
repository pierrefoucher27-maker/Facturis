-- ============================================================
-- Facturis - schéma de base de données (Supabase / Postgres)
-- À exécuter dans Supabase: Dashboard > SQL Editor > New query
-- ============================================================

create extension if not exists "uuid-ossp";

-- ---------- Entreprises (une entreprise = un abonnement) ----------
create table companies (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  siret text,
  tva_intra text,
  address text,
  created_at timestamptz not null default now()
);

-- ---------- Clients des entreprises ----------
create table clients (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  email text,
  address text,
  siret text,
  created_at timestamptz not null default now()
);

-- ---------- Plan comptable (chargé par défaut par entreprise) ----------
create table chart_of_accounts (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  code text not null,
  label text not null,
  type text not null check (type in ('actif','passif','charge','produit')),
  unique(company_id, code)
);

-- ---------- Factures ----------
create table invoices (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  client_id uuid not null references clients(id) on delete restrict,
  number text not null,
  status text not null default 'draft' check (status in ('draft','sent','paid','late','cancelled')),
  issue_date date not null default current_date,
  due_date date,
  tva_rate numeric(5,2) not null default 20.00,
  paid_at date,
  created_at timestamptz not null default now(),
  unique(company_id, number)
);

create table invoice_items (
  id uuid primary key default uuid_generate_v4(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  description text not null,
  quantity numeric(10,2) not null default 1,
  unit_price numeric(12,2) not null default 0
);

-- ---------- Comptabilité: journal en partie double ----------
create table journal_entries (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  entry_date date not null default current_date,
  label text not null,
  source_type text, -- 'invoice_issued' | 'invoice_paid' | 'manual' | 'bank_import'
  source_id uuid,
  created_at timestamptz not null default now()
);

create table journal_lines (
  id uuid primary key default uuid_generate_v4(),
  entry_id uuid not null references journal_entries(id) on delete cascade,
  account_code text not null,
  debit numeric(12,2) not null default 0,
  credit numeric(12,2) not null default 0
);

-- ---------- Rapprochement bancaire (import CSV du relevé) ----------
create table bank_transactions (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  txn_date date not null,
  label text not null,
  amount numeric(12,2) not null, -- positif = encaissement, négatif = décaissement
  matched_invoice_id uuid references invoices(id) on delete set null,
  matched_journal_entry_id uuid references journal_entries(id) on delete set null,
  imported_at timestamptz not null default now()
);

-- ---------- Abonnement Stripe de l'entreprise ----------
create table subscriptions (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null unique references companies(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text not null default 'inactive', -- inactive | active | past_due | canceled
  current_period_end timestamptz
);

-- ============================================================
-- Row Level Security : chaque utilisateur ne voit que ses données
-- ============================================================
alter table companies enable row level security;
alter table clients enable row level security;
alter table chart_of_accounts enable row level security;
alter table invoices enable row level security;
alter table invoice_items enable row level security;
alter table journal_entries enable row level security;
alter table journal_lines enable row level security;
alter table bank_transactions enable row level security;
alter table subscriptions enable row level security;

create policy "own companies" on companies
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "own clients" on clients
  for all using (company_id in (select id from companies where owner_id = auth.uid()))
  with check (company_id in (select id from companies where owner_id = auth.uid()));

create policy "own accounts" on chart_of_accounts
  for all using (company_id in (select id from companies where owner_id = auth.uid()))
  with check (company_id in (select id from companies where owner_id = auth.uid()));

create policy "own invoices" on invoices
  for all using (company_id in (select id from companies where owner_id = auth.uid()))
  with check (company_id in (select id from companies where owner_id = auth.uid()));

create policy "own invoice items" on invoice_items
  for all using (invoice_id in (
    select i.id from invoices i join companies c on c.id = i.company_id where c.owner_id = auth.uid()
  ))
  with check (invoice_id in (
    select i.id from invoices i join companies c on c.id = i.company_id where c.owner_id = auth.uid()
  ));

create policy "own journal entries" on journal_entries
  for all using (company_id in (select id from companies where owner_id = auth.uid()))
  with check (company_id in (select id from companies where owner_id = auth.uid()));

create policy "own journal lines" on journal_lines
  for all using (entry_id in (
    select e.id from journal_entries e join companies c on c.id = e.company_id where c.owner_id = auth.uid()
  ))
  with check (entry_id in (
    select e.id from journal_entries e join companies c on c.id = e.company_id where c.owner_id = auth.uid()
  ));

create policy "own bank transactions" on bank_transactions
  for all using (company_id in (select id from companies where owner_id = auth.uid()))
  with check (company_id in (select id from companies where owner_id = auth.uid()));

create policy "own subscription" on subscriptions
  for all using (company_id in (select id from companies where owner_id = auth.uid()))
  with check (company_id in (select id from companies where owner_id = auth.uid()));

-- ============================================================
-- Plan comptable par défaut, inséré automatiquement à la création
-- d'une entreprise (trigger)
-- ============================================================
create or replace function seed_chart_of_accounts()
returns trigger as $$
begin
  insert into chart_of_accounts (company_id, code, label, type) values
    (new.id, '411', 'Clients', 'actif'),
    (new.id, '512', 'Banque', 'actif'),
    (new.id, '530', 'Caisse', 'actif'),
    (new.id, '401', 'Fournisseurs', 'passif'),
    (new.id, '445660', 'TVA déductible', 'actif'),
    (new.id, '445710', 'TVA collectée', 'passif'),
    (new.id, '706', 'Prestations de services', 'produit'),
    (new.id, '707', 'Ventes de marchandises', 'produit'),
    (new.id, '606', 'Achats non stockés', 'charge'),
    (new.id, '613', 'Locations', 'charge'),
    (new.id, '622', 'Honoraires', 'charge');
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_seed_chart_of_accounts
  after insert on companies
  for each row execute function seed_chart_of_accounts();
