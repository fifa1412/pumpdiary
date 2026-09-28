# PumpDiary

PumpDiary is a web app for [Pump It Up](https://en.wikipedia.org/wiki/Pump_It_Up)
players to log their scores, grades, and gameplay videos, and to track their
progress over time. The UI is in Thai; the brand name and game terms (Single,
Double, Perfect, Great, grades) stay in English.

This is an unofficial fan project. It is not affiliated with or endorsed by
Andamiro or Pump It Up.

## Stack

- [Next.js](https://nextjs.org) (App Router) + React + TypeScript
- [Tailwind CSS](https://tailwindcss.com) with [shadcn/ui](https://ui.shadcn.com)
- [Supabase Auth](https://supabase.com/docs/guides/auth) for register/login and
  a `profiles` table for the player name
- Package manager: npm

## Getting started

```bash
npm install
npm run dev
```

Open <http://localhost:3000> to see the app.

Before the first run you need a Supabase project with your credentials in
`.env.local` and the database migrations applied. Follow
[docs/setup-supabase.md](docs/setup-supabase.md) for the full setup, including
the email-confirmation setting and troubleshooting.
