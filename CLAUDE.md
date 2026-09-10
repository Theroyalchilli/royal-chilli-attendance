# royal-chilli-attendance

Dedicated staff attendance app for **The Royal Chilli**. Split out of the POS
(`royal-chilli-pos`) so a fixed reception tablet can sit on the clock-in screen
all day. Managers reach the admin console from the POS's Staff Hub.

- **Stack:** Next.js 15 (App Router) + TypeScript + Tailwind. No Python.
- **Database:** the **same Supabase project** as `royal-chilli-pos` — one
  `staff` table, no duplicate employee records. Attendance tables were added by
  POS migration `030_attendance_rebuild.sql`.
- **Auth:** managers sign in with their **POS credentials**. `lib/auth.ts`
  mirrors the POS: same `JWT_SECRET`, same `pos_session` cookie, same payload.
  Phase 8 sets the cookie domain to `.royalchilli.com` for cross-app SSO.
- **Employees never log in.** They use the kiosk (`/`) with a 4-digit PIN
  (`staff.pin_hash`) + a clock photo.

## Design reference

`C:\Users\adapa\attendance-system` (FastAPI/Postgres standalone) is the **spec**,
not a dependency. Port its logic — especially `backend/time_engine.py` — to
TypeScript; don't reimplement from scratch.

## Rules

- Derived attendance figures are whole **seconds**, always recomputed by the
  time engine on any write — never trusted from a client.
- Raw punch timestamps are never silently rewritten. Manager changes go through
  `break_override_minutes` / `adjustment_seconds` and an `audit_logs` old→new row.
- Payroll (in the POS) reads only **locked** `timesheets`.

## Deploy

Own Vercel project on the `aicoe1` account. No git remote — `vercel --prod`
from the working tree (the sandbox blocks it; the user runs `! vercel --prod`).

## Phase plan

Tracked in the POS session's task list. 1 schema ✓ · 2 scaffold · 3 kiosk ·
4 time engine · 5 admin console · 6 rota · 7 POS integration + retire
`clock_events` · 8 subdomain + tablet · 9 cron jobs.
