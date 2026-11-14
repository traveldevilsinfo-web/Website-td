# Putting the back office live

Follow this once, in order. Steps 1–5 are setup; step 6 onward is the first real day's work.
Everything here happens in the **Travel Devils** Supabase and Vercel accounts, not a personal login.

Nothing in these steps touches the public website. The back office lives at `/ops` and has its own login.

---

## 1. Create the private bucket in Supabase

Receipt photos must never be publicly readable. The website's existing `media` bucket is public, so the
back office uses a second one.

1. Supabase → **Storage** → **New bucket**
2. Name it exactly `ops-private`
3. Leave **Public bucket** switched **off**. This is the whole point of the step.
4. Create it.

> If you make it public by mistake, anyone who guesses a file name can read your receipts. Delete the
> bucket and make it again rather than trying to flip the setting.

## 2. Set the environment variables in Vercel

Vercel → the project that serves traveldevils.in → **Settings** → **Environment Variables**. Add
these for **Production** (and Preview, if you want the preview deployments to work):

| Name | Value | What breaks without it |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://traveldevils.in` (your real site address) | Guest links and calendar links point at `localhost` |

That is usually the only one to add. Two more only matter in particular cases:

- `CRON_SECRET` — **the website already has one**, and the back office's nightly jobs check the same
  variable, so reuse it. Adding a second is what Vercel rejects with *"a variable with the name
  CRON_SECRET already exists"*. Only set it if the project genuinely has none.
- `SUPABASE_OPS_BUCKET` — only if the private bucket is **not** called `ops-private`, which is what
  the code falls back to.

> `NEXT_PUBLIC_SITE_URL` cannot be marked **secret**. Anything with the `NEXT_PUBLIC_` prefix is
> compiled into the browser bundle, so Vercel refuses it and says to use *visibility: config*
> instead. Turn the secret toggle off on that one.

These should already exist from the website; check they are set, because the back office needs them
too — `DATABASE_URL` (nothing loads without it), and `SUPABASE_URL` plus
`SUPABASE_SERVICE_ROLE_KEY` (receipt photos fail to upload without them).

## 3. Run the database migrations

This adds the back office's tables. It does not alter any table the website uses.

### Finding the connection string

Supabase → your project → **Settings** → **Database** → **Connection string** → **URI**. Supabase
offers three, and for this step you want one of the first two:

| | Port | Use it for |
|---|---|---|
| **Direct connection** | 5432 | migrations and the one-off scripts below, **if** you have IPv6 |
| **Session pooler** | 5432 (host contains `pooler`) | the same, over IPv4 — most networks need this |
| Transaction pooler | 6543 | the deployed app — **not** these commands |

The transaction pooler drops the prepared statements the migration tool relies on, so use 5432 here.
Supabase prints the password as `[YOUR-PASSWORD]`; replace it with the real one (**Reset database
password** on the same page if you don't have it).

It is already in Vercel too, as `DATABASE_URL` under Environment Variables, if that is quicker to
reach — but take it from the dashboard in the browser rather than the `vercel` CLI, which may be
signed in to a different account than the one holding this project.

### Running them

From the project folder:

```bash
DATABASE_URL='<the URI from above>' npm run db:migrate
```

It runs migrations `0009` through `0020` and is safe to run twice: anything already applied is
skipped. Putting `DATABASE_URL=` in front of the command overrides whatever is in `.env.local` for
that one run, so there is no way to hit your laptop's database by mistake.

To check afterwards — `21` means every migration is in:

```bash
psql '<the URI from above>' -c "select count(*) from drizzle.__drizzle_migrations;"
```

> The string holds your database password, so it goes into your shell history. Clear it afterwards
> if that matters to you.

**If it fails with `EHOSTUNREACH` and an address full of colons**, that is the direct connection
being IPv6-only on a network that has no IPv6 route:

```
Error: connect EHOSTUNREACH 2406:da12:1f1:f802:…:5432
```

Use the **Session pooler** string instead — same port, IPv4, user `postgres.<project-ref>`. The
migration tool is worse: it fails the same way but prints nothing at all, stopping after *Using 'pg'
driver for database querying*, which reads like success. If you see no `[✓]` line, it did not run.

> Setting `DATABASE_URL` on the command line like this overrides whatever is in `.env.local`, so you
> cannot accidentally run it against your laptop's database.

### If your network has no IPv6: do it from the browser instead

Rather than hunting for a connection string that works, let the scripts print SQL and paste it into
Supabase → **SQL Editor** → Run. Nothing connects from your machine, so nothing can fail this way.

```bash
npm run ops:owner -- you@traveldevils.in "Your Name" 'a-long-password' --sql
```

```bash
npm run ops:airbnb -- --sql
```

The first prints one `insert` for your login — the password is hashed on your machine, so only the
hash is ever on screen or in the clipboard. The second prints the eight flats and their Airbnb
calendars. Both are safe to run twice.

The migrations are the one thing this cannot do; they need a real connection. If `db:migrate` fails,
use the session pooler string above.

## 4. Deploy

Merge the pull request. Vercel builds and deploys `main` by itself.

## 5. Create the first owner account

This is the only account that can create other accounts.

```bash
DATABASE_URL='<your supabase connection string>' npm run ops:owner -- you@traveldevils.in "Your Name" 'a-long-password'
```

Then open `https://<your site>/ops/login` and sign in. If it lets you in, steps 1–5 worked.

---

## 6. First day in the app

Do these in order; each one depends on the last.

**Check the categories.** Switch to **Finzo Stays** → Categories. Rent, electricity, housekeeping and the
rest are already there. Rename anything that doesn't match how you think about costs. Keep one category
of kind **salary** — payroll refuses to pay if there isn't one.

**Add the people.** Team (logins) is for anyone who signs in. People is everyone you pay; most
housekeepers need both, a cook may need only the second. Give each flat a housekeeper, so cleanings
assign themselves.

**Bring in the flats that are on Airbnb.** Eight listings were read off the Airbnb host account on
14 Nov 2026 — name, address, bedrooms, guests, check-in and checkout, and each listing's calendar
link. One command puts them in with their Airbnb calendar already connected:

```bash
DATABASE_URL='<your supabase connection string>' npx tsx scripts/import-airbnb-listings.mts
```

It reads `exports/airbnb-listings.json`, which is deliberately **not** in the repository: those
calendar links are secrets, and anyone holding one can read that flat's bookings without logging in.
Keep the file somewhere safe. Running the command twice is harmless — flats are matched on their
code, so the second run updates rather than duplicates, and it never overwrites a door code, Wi-Fi
password, housekeeper or guidebook.

> Set `NEXT_PUBLIC_SITE_URL` (step 2) **before** this, or every guest and calendar link the app hands
> out will point at `localhost`.

**Add any flat that isn't on Airbnb.** Finzo Stays → Flats → Add flat: code, name, address, door
code, Wi-Fi and the housekeeper. Eight of the flats come from the import above; the rest are let
some other way and have to be typed in.

**Fill in what Airbnb doesn't know.** Open each imported flat and add its door code, Wi-Fi and
housekeeper. Airbnb holds none of these, so the import leaves them blank, and cleanings only assign
themselves once a flat has a housekeeper.

**Add each flat's rent.** On the flat's page, **Add rent** opens a form already filled in — type the
amount and save. Do this for every flat. A flat with no rent recorded will read as far more
profitable than it is, and that error goes straight onto its owner statement.

**Send our calendar back to Airbnb.** The import only brings bookings *in*. Until this step, a
booking taken anywhere else won't block the night on Airbnb. On each flat's page copy the *For
Airbnb* link under *Calendar out*, then in Airbnb: that listing → Calendar → Availability → Connect
to another website → Add calendar. The link carries `?exclude=airbnb` so Airbnb never sees its own
reservations come back as blocks.

**Check it arrived.** Open the **Calendar** page and press **Sync now**. Bookings should appear
within a minute, and each flat's page should show its calendar as syncing rather than *Failing*.

**Import last month's earnings.** Revenue → Import earnings. In Airbnb: Earnings → Transaction history →
export CSV. Upload it.

> **Check this one number before you trust anything.** The import tells you the total it brought in.
> Compare one booking's payout against your bank statement. Airbnb localises its export, and if the
> columns differ from what we expect, this is where it shows.

**Print the guidebook QR.** On each flat's page, *Guidebook QR* is a link to print and stick inside the
flat. It shows Wi-Fi and the house guide, never the door code.

---

## What runs by itself

| When (IST) | What |
|---|---|
| 5:30 am | Calendars sync (also whenever someone opens the Calendar page and it's over 30 minutes old, and on **Sync now**) |
| 6:30 am | Fixed costs for the day are posted |
| 9:00 am | The website's existing morning summary |

Cleanings are created from checkouts as bookings arrive, not on a schedule.

## If something looks wrong

| What you see | What it means |
|---|---|
| A flat's calendar says **Failing** | The link was pasted wrong or Airbnb changed it. Open the flat and paste it again. |
| **Double booked** in red | Two channels sold the same nights. Cancel one on its own channel; the next sync clears the flag. |
| A month's revenue looks low | Some stays have no payout imported. The Revenue page says how many. |
| Payroll won't pay | There's no category of kind **salary**. Add one, then pay again. |
| A guest says their link doesn't work | It only shows the door code from the day before arrival, and nothing after checkout. |
| Someone can't see a page | Roles: staff add their own expenses and do their own tasks; managers approve and see money; only an owner locks or pays payroll. |

## What this does not do

- It cannot change prices or listing text on Airbnb, and it cannot read guest messages. Airbnb gives
  hosts no way in. Calendars sync, and money comes from the monthly CSV.
- A booking made on another channel can take up to a few hours to appear, because that is how often
  channels re-read each other's calendars. Clashes are flagged, not prevented.
- Receiving stock does not create the matching expense. Record the purchase under Expenses as usual.
