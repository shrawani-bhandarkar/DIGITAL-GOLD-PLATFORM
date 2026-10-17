# Authentication and access

Own customer/admin authentication, session lifecycle, roles, permissions, and authorization policy. Enforce server-side authorization for every protected action.

## Admin sign-in

Set `JWT_SECRET` to at least 32 random bytes in the API environment. Apply `schema.sql` and seed the local demo administrator with `npm run seed:admin --workspace @digi-gold/api`.

The seed is for local/demo use only:

- Email: `admin@digitalgold.demo`
- Password: `Admin123!`

Passwords are stored as bcrypt hashes. Login sets a short-lived JWT in an HttpOnly cookie and records its hash in `admin_jwt_sessions`, so logout revokes the token. `GET /api/admin/profile` demonstrates a protected API route. The admin panel uses `GET /api/auth/session` to restore the signed-in user and `POST /api/auth/logout` to revoke the session.
