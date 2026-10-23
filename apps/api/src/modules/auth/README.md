# Authentication and access

Own customer/admin authentication, session lifecycle, roles, permissions, and authorization policy. Enforce server-side authorization for every protected action.

## Admin sign-in

Set `JWT_SECRET` to at least 32 random bytes in the API environment. Apply `schema.sql` to create the `admins`, `superadmins`, and role-specific session tables. Seed the local demo administrator with `npm run seed:admin --workspace @digi-gold/api`.

The seed is for local/demo use only:

- Email: `admin@digitalgold.demo`
- Password: `Admin123!`

Passwords in both account tables are stored and compared as plain text for this local/demo application. Do not use plain-text password storage in production. The shared `POST /api/auth/login` checks Admin accounts in `admins` and Super Admin accounts in `superadmins`. It sets the same short-lived HttpOnly session cookie for either role and stores its token hash in the corresponding session table. `GET /api/auth/session` resolves the account and role from that server-side session; `POST /api/auth/logout` revokes it. The existing admin panel dashboard and routes use this verified role for their current permission checks. `GET /api/admin/profile` demonstrates a protected API route.

## Customer mobile OTP sign-in

Customer sign-in is separate from the Admin session routes and does not change
Admin login. Before starting the API, apply
`src/modules/customer-auth/schema.sql` to `digital_gold_db`; it creates only
the OTP challenge and customer session tables and does not alter or delete
existing rows. OTP requests are accepted only for active users with an
`admin_customer_profiles` record and a matching Indian mobile number.

Apply the additive schema with:

```sh
mysql -u root -p digital_gold_db < apps/api/src/modules/customer-auth/schema.sql
```

The API generates a cryptographically random six-digit code, stores only an
HMAC hash, expires it after five minutes, limits requests to three per
15-minute window with a 30-second resend delay, and allows five verification
attempts. Successful verification consumes the code and creates a revocable
eight-hour customer session token. The mobile app sends that token as a
Bearer token.

For local development, set `NODE_ENV=development` for the API and configure
the Expo app with `EXPO_PUBLIC_DATA_MODE=backend` and
`EXPO_PUBLIC_API_BASE_URL` pointing to the API. The generated OTP is returned
to the app only when the API is explicitly running in development mode. No SMS
provider is configured in this project; other environments fail closed with
503 until a delivery provider is integrated.
