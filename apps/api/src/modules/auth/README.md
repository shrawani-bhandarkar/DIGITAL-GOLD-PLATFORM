# Authentication and access

Own customer/admin authentication, session lifecycle, roles, permissions, and authorization policy. Enforce server-side authorization for every protected action.

## Admin sign-in

Set `JWT_SECRET` to at least 32 random bytes in the API environment. Apply `schema.sql` to create the `admins`, `superadmins`, and role-specific session tables. Seed the local demo administrator with `npm run seed:admin --workspace @digi-gold/api`.

The seed is for local/demo use only:

- Email: `admin@digitalgold.demo`
- Password: `Admin123!`

Passwords in both account tables are stored and compared as plain text for this local/demo application. Do not use plain-text password storage in production. The shared `POST /api/auth/login` checks Admin accounts in `admins` and Super Admin accounts in `superadmins`. It sets the same short-lived HttpOnly session cookie for either role and stores its token hash in the corresponding session table. `GET /api/auth/session` resolves the account and role from that server-side session; `POST /api/auth/logout` revokes it. The existing admin panel dashboard and routes use this verified role for their current permission checks. `GET /api/admin/profile` demonstrates a protected API route.
