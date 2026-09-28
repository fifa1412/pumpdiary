# Supabase setup

PumpDiary uses [Supabase Auth](https://supabase.com/docs/guides/auth) for
register/login and a single `profiles` table for the player name. This guide
sets up a Supabase project from scratch so the app works end to end.

You need a free Supabase account. All steps below are done in the Supabase
dashboard at <https://supabase.com/dashboard> unless stated otherwise.

## 1. Create a Supabase project

1. Sign in to Supabase and click **New project**.
2. Give it a name (e.g. `pumpdiary`), set a strong database password, and pick
   the region closest to you.
3. Wait for the project to finish provisioning, then open it.

## 2. Add your credentials to `.env.local`

1. In the dashboard go to **Project Settings → API Keys**.
2. Copy two values:
   - **Project URL** — looks like `https://<your-project>.supabase.co`.
   - **Publishable key** — starts with `sb_publishable_`.
3. In the repo root, copy the example env file and fill in your values:

   ```bash
   cp .env.example .env.local
   ```

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_<your-key>
   ```

> **Warning:** never use the `service_role` / `sb_secret_` key in this app. It
> bypasses Row Level Security and must only ever be used by trusted server-side
> code, which this project does not have. Use the publishable key only. `.env.local`
> is git-ignored; never commit it.

## 3. Run the database migrations

There are two migration files. Run them **in this order**: for each one, open
**SQL Editor → New query** in the dashboard, paste the full contents of the
file from this repo, and click **Run**.

### 3.1 `supabase/migrations/0001_profiles.sql`

What this file creates:

- **`public.profiles` table** — one row per auth user: `id` (references
  `auth.users`, deleted with the user), `player_name` (2–20 characters), and
  `created_at`.
- **Row Level Security (RLS)** — enabled on the table, with policies that let an
  authenticated user **select and update only their own row** (matched by
  `auth.uid()`). There are no insert/delete policies: rows are created by the
  trigger below and removed automatically when the auth user is deleted.
- **Sign-up trigger** — a `handle_new_user()` function plus an
  `on_auth_user_created` trigger on `auth.users`. After each new user signs up,
  it inserts the matching `profiles` row, reading the player name from the
  sign-up metadata (`player_name`), which the app passes on register.

### 3.2 `supabase/migrations/0002_profiles_grants.sql`

This file sets **least-privilege table grants** on `public.profiles`:

- **Signed-in users (`authenticated`)** get `SELECT` — RLS still limits them to
  their own row — and `UPDATE` on the `player_name` column only.
- **Logged-out visitors (`anon`)** get nothing: they can never read profiles.

It also revokes the default grants Supabase applies to new tables, which
included `TRUNCATE` — a privilege RLS does not restrict.

## 4. Turn off email confirmation (local development only)

1. Go to **Authentication → Sign In / Providers → Email**.
2. Turn **off** **Confirm email**.

With confirmation off, a new user can log in immediately after registering,
which is what the app's flow expects for now. **Turn it back on before real
users sign up** — the email-confirmation flow is future work and is not
implemented yet.

## 5. Run the app

```bash
npm install
npm run dev
```

Open <http://localhost:3000> and register at `/register`. You should be able to
log in, see your player name in the header, and be redirected to `/dashboard`.

## 6. Troubleshooting

- **"Database error saving new user" at sign-up** — the migrations in step 3
  were not run, or the `player_name` value is missing. Re-run both migration
  files in order and make sure the register form submits a player name.
- **Login fails right after registering** — **Confirm email** is still on
  (step 4). Turn it off and register again.
