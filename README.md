# Digi Gold

Monorepo structure for a digital gold and silver platform: customer mobile app, web-based operations/admin panel, and Node.js API. The structure follows the supplied planning document and customer workflow diagram.

## Repository layout

```text
apps/
  api/       Node.js + Express + TypeScript API, divided by business domain
  mobile/    Customer app using React Native + Expo (Android-first)
  web/       Operations/admin portal using React + Vite
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
Copy-Item apps\api\.env.example apps\api\.env
npm run dev
```

The web app runs at `http://localhost:5173`; the API runs at `http://localhost:4000`. Start Expo separately:

```bash
npm run dev:mobile
```

Use Expo Go or an Android emulator to open the customer mobile app. Generate native Android project files only when needed with `npx expo prebuild --platform android` from `apps/mobile`.

## API database

The API uses MySQL 8. From Command Prompt, create the database and import the supplied schema dump:

```cmd
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS digital_gold_db CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;"
mysql -u root -p digital_gold_db < C:\Users\ASUS\Downloads\Dump20261015.sql
```

Set `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME` in `apps/api/.env` to match your MySQL account. The API checks the MySQL connection before it starts; `/api/health/db` reports database readiness. The dump contains table definitions only, not application records.

## Useful commands

```bash
npm run build
npm run typecheck
npm run dev:web
npm run dev:api
npm run dev:mobile
```

## Scope and implementation status

This is a structural scaffold with starter entry points and database connectivity—not a functioning financial product. Authentication, KYC, persistence-backed API operations, provider integrations, order processing, ledger, payments, reconciliation, and the screens/actions listed in the planning docs still need implementation and testing. Provider choices and business policies are intentionally left open; see [docs/decisions-required.md](./docs/decisions-required.md). No image assets are included.

Review [docs/architecture.md](./docs/architecture.md), [docs/workflows.md](./docs/workflows.md), [docs/data-model.md](./docs/data-model.md), and [docs/security-and-operations.md](./docs/security-and-operations.md) before implementation.
