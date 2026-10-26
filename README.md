# Digi Gold

Monorepo structure for a digital gold and silver platform: customer mobile app, web-based operations/admin panel, and Node.js API. The structure follows the supplied planning document and customer workflow diagram.

## Repository layout

```text
apps/
  api/       Node.js + Express + TypeScript API, divided by business domain
  mobile/    React Native + Expo workspace scaffold
  web/       Operations/admin portal using React + Vite
customer-mobile-app/ Customer-facing Expo app with OTP sign-in and navigation
docs/        Architecture, workflows, data entities, security, and open decisions
```

The mobile app is customer-facing. The web app is for authorized operational roles (support, operations, finance/reconciliation, rate manager, and super admin). Both clients use the API; neither should access payment, bullion/custody, or KYC provider secrets directly.

## Requirements

- Node.js 20 or later
- npm 10 or later
- Android Studio and an Android emulator/device for Android development

## Get started

```bash
npm install
npm install --prefix customer-mobile-app
Copy-Item apps\api\.env.example apps\api\.env
npm run dev
```

The web app runs at `http://localhost:5173`; the API runs at `http://localhost:4000`. Start Expo separately:

```bash
npm run dev:mobile
```

`npm run dev:mobile` starts the customer app in `customer-mobile-app`. Use Expo Go or an Android emulator to open it. Generate native Android project files only when needed with `npx expo prebuild --platform android` from `customer-mobile-app`.
To start the customer app directly on an Android emulator from the repository
root, run:

```powershell
npm run dev:mobile:android
```

Alternatively, from `customer-mobile-app`, run `npm run android:emulator`. Do
not start Expo from the repository root; it is a workspace container, not an
Expo app.

## API database

The API uses MySQL 8. From Command Prompt, create the database and import the supplied schema dump:

```cmd
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS digital_gold_db CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;"
mysql -u root -p digital_gold_db < C:\Users\ASUS\Downloads\Dump20261015.sql
```

Set `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME` in `apps/api/.env` to match your MySQL account. The API checks the MySQL connection before it starts; `/api/health/db` reports database readiness. The dump contains table definitions only, not application records. After importing it, apply the admin-console schema (which includes the admin-managed customer profile table) and the customer-auth schema:

```cmd
mysql -u root -p digital_gold_db < apps\api\src\modules\admin-console\schema.sql
mysql -u root -p digital_gold_db < apps\api\src\modules\customer-auth\schema.sql
```

For an existing database, apply the customer identity and ID-generation
migration after the admin-console schema:

```powershell
mysql -u root -p digital_gold_db < apps\api\src\modules\admin-console\migrations\002-customer-identifiers-and-sequence.sql
```

It enables auto-increment IDs for `users.user_id` (starting at 1 for an empty
table, and continuing after the current maximum for existing data) and adds
unique constraints for customer email, phone, and PAN. Resolve any existing
duplicate values before applying the migration.

For existing installations, apply the purchase-quantity precision migration
to support exact amount-based Silver and Platinum quotes:

```powershell
mysql -u root -p digital_gold_db < apps\api\src\modules\admin-console\migrations\003-precise-purchase-quantities.sql
```

The admin-console schema includes the daily metal-price history table used by
the customer app's Current Metal Rates section. Super Admins can publish Gold,
Silver, and Platinum prices and purity from Rate management in the admin panel;
the public market-rates API returns the newest price effective as of the current
UTC date.

Customer OTP requests are accepted only for active customer records created in the admin panel. In API development mode the OTP is returned to the app for local testing; production SMS delivery is not configured.

### Admin panel sign-in

The standalone admin panel uses database-backed authentication. Create its account/session tables and provision an administrator once:

```cmd
mysql -u root -p digital_gold_db < apps\api\src\modules\auth\schema.sql
set ADMIN_EMAIL=you@example.com
set ADMIN_DISPLAY_NAME=Your Name
set ADMIN_PASSWORD=use-a-unique-password-at-least-12-characters
npm run create:admin --workspace @digi-gold/api
set ADMIN_EMAIL=
set ADMIN_DISPLAY_NAME=
set ADMIN_PASSWORD=
```

Start the API with `npm run dev:api` and the standalone panel with `npm run dev --prefix admin-panel`. Sign in using the email and password you provisioned; there are no default demo credentials. The panel uses a same-origin development proxy to reach the API.

## Useful commands

```bash
npm run build
npm run typecheck
npm run dev:web
npm run dev:api
npm run dev:mobile
```

## Scope and implementation status

This is not a functioning financial product. Admin-panel sign-in and server sessions are database-backed, and customer OTP authentication is implemented in the customer app and API. Customer login requires an active admin-panel customer record and the customer-authentication schema; development OTP delivery is local-only. Server-side authorization for all operational actions, KYC, persistence-backed customer operations, provider integrations, order processing, ledger, payments, and reconciliation still need implementation and testing. Provider choices and business policies are intentionally left open; see [docs/decisions-required.md](./docs/decisions-required.md). No image assets are included.

Review [docs/architecture.md](./docs/architecture.md), [docs/workflows.md](./docs/workflows.md), [docs/data-model.md](./docs/data-model.md), and [docs/security-and-operations.md](./docs/security-and-operations.md) before implementation.
