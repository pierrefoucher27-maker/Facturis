# Facturis

SaaS de facturation et comptabilité pour entreprises, avec abonnement Stripe.

## Ce qui est déjà fait

- Comptes utilisateurs (inscription, connexion) — une entreprise par compte
- Clients et factures (lignes, TVA, statut, marquage "payée")
- Journal comptable en partie double, généré automatiquement à l'émission et
  à l'encaissement des factures, plus saisie manuelle (achats, charges…)
- Bilan et compte de résultat calculés en temps réel depuis le journal
- Rapprochement bancaire : import CSV du relevé, lettrage avec les factures
- Abonnement Stripe (Checkout + portail de gestion), statut synchronisé par webhook

## Mise en route (10 minutes)

### 1. Base de données (Supabase, gratuit)

1. Créez un compte sur [supabase.com](https://supabase.com) et un nouveau projet
2. Dans l'éditeur SQL du projet, collez et exécutez le contenu de `supabase/schema.sql`
3. Dans Project Settings → API, récupérez l'URL du projet, la clé `anon` et la clé `service_role`

### 2. Paiements (Stripe)

1. Créez un compte sur [dashboard.stripe.com](https://dashboard.stripe.com)
2. Créez un produit "Abonnement Facturis" avec un prix récurrent mensuel, notez son `price_id`
3. Récupérez la clé secrète et la clé publiable (Developers → API keys)
4. Une fois déployé, créez un webhook pointant vers `https://votre-domaine.com/api/stripe/webhook`
   pour les événements `checkout.session.completed`, `customer.subscription.updated` et
   `customer.subscription.deleted` — copiez le secret de signature généré

### 3. Variables d'environnement

Copiez `.env.example` en `.env.local` et remplissez les valeurs récupérées ci-dessus.

### 4. Lancer en local

```bash
npm install
npm run dev
```

### 5. Déployer

Le plus simple est [Vercel](https://vercel.com) : connectez le dépôt, ajoutez les mêmes
variables d'environnement dans les réglages du projet, et déployez.

## Limites à connaître

- Le rapprochement bancaire se fait par import de fichier CSV exporté depuis votre banque
  (pas de connexion bancaire automatique — cela demanderait un agrégateur type Bridge/Budget
  Insight, avec ses propres frais et démarches d'agrément).
- Le plan comptable par défaut est simplifié (comptes courants pour freelances/TPE). Pour des
  besoins comptables plus poussés, un expert-comptable reste recommandé pour la validation finale.
