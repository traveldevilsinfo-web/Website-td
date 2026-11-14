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

Vercel → the `website-td` project → **Settings** → **Environment Variables**. Add these for
**Production** (and Preview, if you want the preview deployments to work):

| Name | Value | What breaks without it |
|---|---|---|
| `SUPABASE_OPS_BUCKET` | `ops-private` | Receipts fail to upload |
| `NEXT_PUBLIC_SITE_URL` | `https://traveldevils.in` (your real site address) | Guest links and calendar links point at `localhost` |
| `CRON_SECRET` | a long random string | The nightly jobs refuse to run |

These should already exist from the website; check they are set:
`DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_BUCKET`.

To generate a `CRON_SECRET`:

```bash
openssl rand -hex 32
```

## 3. Run the database migrations

This adds the back office's tables. It does not alter any table the website uses.

From the project folder, with your Supabase connection string:

```bash
DATABASE_URL='<your supabase connection string>' npm run db:migrate
```

Use the **pooled** connection string from Supabase → Settings → Database. It runs migrations `0009`
through `0020`. It is safe to run twice: anything already applied is skipped.

> Setting `DATABASE_URL` on the command line like this overrides whatever is in `.env.local`, so you
> cannot accidentally run it against your laptop's database.

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

**Add the 13 flats.** Finzo Stays → Flats. For each one: code, name, address, door code, Wi-Fi and the
housekeeper.

**Add each flat's rent.** On the flat's page, **Add rent** opens a form already filled in — type the
amount and save. Do this for all 13. A flat with no rent recorded will read as far more profitable than
it is, and that error goes straight onto its owner statement.

**Connect the calendars.** On each flat: paste its Airbnb calendar link under *Calendars in*, then copy
the *For Airbnb* link from *Calendar out* and paste it into Airbnb's "import calendar". Open the
**Calendar** page and press **Sync now**. Bookings should appear within a minute.

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
