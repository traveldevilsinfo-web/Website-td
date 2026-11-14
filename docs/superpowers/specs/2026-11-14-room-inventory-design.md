# Room inventory for Finzo Stays

Status: **approved direction** (14 Nov 2026). Extends the stock system built in Phase 6
(`2026-11-13-ops-v2-system.md`).

## 1. Why

Harshit sent a room-by-room list of everything in a Finzo flat — about sixty things across seven
areas, from the duvet cover to the digital lock. Nothing holds that list today. Stock knows there are
24 bath towels somewhere across eight flats; nobody can say whether 1011 is three pillow covers short,
what the fridge cost, or that last month's breakages came to ₹4,000.

Three things follow from not holding it: losses are invisible until a guest complains, a flat can be
let with a missing kit, and the fit-out — several lakh rupees of ACs, fridges and sofas — appears
nowhere in the books.

## 2. The three kinds of thing

The owner's own framing, and the spine of this design: *"some are fixed one timers, some are those
which we have to change."*

| | Examples | Behaves like |
|---|---|---|
| **Consumable** | Shampoo, conditioner, shower gel, hand wash, toilet paper, tissue, Odonil, All Out | Used up every stay. Already modelled: `per_turnover` issues it when a cleaning is finished. |
| **Replaceable** | Bedsheet, duvet cover, pillow cover, towels, runner set, curtains, mats, remotes, glasses, dustbin, hanger | Several per flat, wears out, goes missing. Counted, and compared against what the flat should have. |
| **Fixture** | AC, fridge, microwave, chimney, RO, geyser, dishwasher, sofa, digital lock, TV | Bought once. You care that it exists and works, what it cost and when — not how many. |

## 3. Goals

- A flat's room list, by area, showing what should be there against what is.
- Fixtures per flat with condition, cost and purchase date.
- Losses recorded with a value and, where it was a guest, a flag that it is worth charging.
- The check happens during the cleaning that is already being done.
- Items and areas can be added later without touching code.

### Non-goals (deliberately out of v1)

- Charging a guest automatically. Airbnb gives hosts no API; the app says what to claim, a person claims it.
- **Fixture costs do not post to expenses** (owner, 14 Nov). Each fixture shows what it cost and when,
  and a flat totals its fit-out, but no expense rows are written. Seeding ~80 fixtures bought through
  2025 would inject lakhs into months already closed and reported on, which is a one-way change to
  live books for a number the Room page already shows. Revisit only for *new* purchases, where a
  completed maintenance ticket already sets the precedent.
- Depreciation, asset schedules or accounting treatment of the fit-out.
- Per-item barcodes, QR tags or serial-number warranty alerts.
- A full event history per fixture. Its current condition plus the maintenance ticket is the record.
- Purchase orders, suppliers or reordering workflow.

### Anti-goals (it has failed even if it works)

- A kit check so slow that housekeepers tick it through without looking. **Under 60 seconds** on a
  phone for a flat with nothing wrong.
- Anything that needs a laptop. Three of the five people who touch this have only a phone.
- Expected counts that drift from reality and are quietly ignored, which is worse than no counts.
- Breaking Travel Devils' gear stock, which runs on the same tables.

## 4. Constraints

- **Linen is washed in the flat** and never leaves it (owner, 14 Nov). This is load-bearing: it means
  what the cupboard holds is what the flat owns, so a shortfall really is a loss. The ledger's two
  places — the business store and each flat — are enough. **If Finzo ever moves to an outside laundry
  service, this design needs a third place**, or every count will read as a loss while the sheets are
  simply out being washed.
- **Phone first.** The kit check is done standing in the flat, one-handed, gloves on.
- **Quantity is never stored.** It is always the sum of movements, so every figure traces to who did
  what. This invariant predates the feature and holds.
- **The existing ledger keeps working**: stocktakes, undo, auto-issue on cleaning, TD's gear.
- **Deployment**: migrations run against Supabase, whose direct host is IPv6-only — see
  `docs/ops-go-live.md` for the route that works.

## 5. Approaches considered

| | What it is | Trade-off |
|---|---|---|
| **Everything in Stock** | Fixtures become items with a quantity of one per flat. Only an area field and the standard kit are new. | Least code. But a fridge becomes a number in a ledger: nowhere for working/broken, warranty or purchase date, and the Stock page fills with rows reading 1. |
| **One new room model** | A single room-inventory system covering all three kinds; Stock migrates onto it. | One mental model. Replaces a working ledger that TD's gear also uses: most code, most migration, most risk, for tidiness staff never see. |
| **Stock + a fixtures register** ✅ | Stock stays the ledger for anything counted, gaining an area and a standard kit. Fixtures get a small register of their own. One Room page shows both. | Two tables behind one page. Chosen: each thing is modelled as what it is, the tested ledger is untouched, and the seam is invisible to staff. |

**Chosen: Stock + a fixtures register**, with **one standard kit and per-flat overrides** (the eight
flats are near-identical studios: ~60 rows to set up instead of 480, and a new item reaches every
flat at once).

## 6. Data

Added to `inventory_items`:

```
area          text        Bed | Table | Work desk | Kitchen | Wardrobe | Fixtures | Bathroom (free text, so more can be added)
kind          text        consumable | replaceable        (fixtures live in their own table)
```

`category` stays as it is — it says *what a thing is* ("Linen"), while `area` says *where it lives*
("Bathroom"). A towel is both.

New `property_kit` — the standard, and where a flat differs:

```
id, item_id → inventory_items, property_id → properties (NULL = the standard for every flat),
expected int, unique(item_id, property_id)
```

The expected count for a flat is its override row if there is one, otherwise the `NULL` row.

New `fixtures`:

```
id, property_id → properties, name, area, condition (working | attention | broken | missing),
condition_at, cost int, bought_on date, model text, notes, active, created_at, updated_at
```

Added to `tickets`: `fixture_id` (nullable), so reporting a broken fridge from the Room page opens a
maintenance ticket already tied to it.

Added to `stock_movements`, which already carries `kind = 'damaged'`:

```
reason         text      damaged | stolen | lost | worn out
reservation_id int?      the stay it happened on, when it was a guest
chargeable     bool      worth claiming from that guest
unit_cost      int?      snapshot of the item's cost at the time, so a later price change
                         does not rewrite last month's damage figure
```

## 7. Screens

**`/ops/properties/[id]/room` — the Room page.** The flat's kit by area, counted items showing
*actual of expected* with shortfalls flagged, then fixtures with their condition. Each line can
record a loss or, for a fixture, report a problem.

```
1011 · The Cozy Nest Studio

BED                        BATHROOM
  Bedsheet      4 of 4       Bath towel    2 of 4  ⚠ 2 short
  Duvet cover   2 of 2       Hand towel    2 of 2
  Pillow cover  3 of 6  ⚠    Bath mat      1 of 1

FIXTURES
  AC (split)    Working    ₹32,000   Jun 2025
  Fridge        Broken     → ticket #14
  Digital lock  Working    ₹8,500    Jun 2025
```

**The cleaning.** One new checklist step, *Room kit checked*. It opens on a single question —
*everything present?* — answered with one tap. Only where something is wrong does she tap that item
and give a number. Counting thirty linen items daily with gloves on is precisely what produces
tick-through, so the default path is one tap and the typing is reserved for exceptions.

```
1011 · Room kit

  Everything present?   [ Yes, all good ]

  or tap an item that's wrong:
  Bath towel · Pillow cover · Remote · Glass · …
```

A shortfall asks one question — damaged, stolen, lost or worn out — and, where the flat had a guest
that night, ties it to that stay. She does not decide whether it is chargeable; see §8.

**`/ops/kit` (Setup).** The standard list: area, item, expected. Overrides per flat on the same page.

**Reports.** Breakage and theft per month per flat, valued, with what is worth charging.

## 8. Calls made while answering the builder check

These were settled by the author, not the owner. Each is reversible; none changes what the owner asked for.

- **A shortfall writes one movement, not two.** A shortfall with a reason writes a single `damaged`
  row carrying the reason, the stay, `chargeable` and `unit_cost`. A surplus, or a difference nobody
  can explain, writes a `count` row. Never both: a `damaged` row of −2 already lowers the total, so
  also writing the count delta would decrement twice, in a ledger whose whole worth is that it adds up.
- **`STOCK_LABEL.damaged` becomes "Damaged, lost or stolen"**, with the specific reason shown beside it
  in history. The present label would read wrongly next to a reason of "stolen".
- **The first kit check for a flat is an opening count.** It records what is actually there and asks no
  loss questions. The alternative — seeding every flat at its expected number — would invent counts
  nobody verified and start the ledger with a lie, which is the drift anti-goal on day one.
- **`chargeable` is a manager's decision, not the housekeeper's.** She states what happened; a manager
  marks what is worth claiming. The person counting has the least standing to judge it, and keeping
  the field off her screen protects the 60-second budget.
- **A claim can be closed.** `claim_settled_at` on the movement, so the "worth charging" list clears
  instead of growing forever and being ignored by month three.
- **The seed carries a cost for every replaceable**, and the losses report states how many rows are
  unpriced rather than quietly under-reporting. `cost_per_unit` is nullable and often unset today, so
  a valued report would otherwise read ₹0 for half its rows.
- **The new step replaces** `DEFAULT_CHECKLIST`'s existing "Check for damage / missing items" line
  rather than sitting beside it, and applies to new turnovers only; those already created keep their
  current checklist.
- **Finishing a cleaning is not blocked** if the kit check was skipped; the turnover records that it
  was not done. Blocking would strand a housekeeper who cannot finish her shift.
- **Finzo only.** The Room page, the kit and the check are scoped to `biz === "finzo"`, and `kind`
  stays null on Travel Devils' gear, so that ledger is untouched.

## 9. What's left to the builder

- Where the Room page hangs off the flat page, and whether it is a tab or a section.
- Exact wording of the loss reasons in the housekeeper's language.
- Whether the kit check writes a `count` movement per item every time, or only where the number changed
  (prefer the latter: a ledger full of no-op counts is noise).
- Seeding Harshit's sixty items and the standard kit: a script in the manner of
  `scripts/import-airbnb-listings.mts`, with the list in a data file so it can be edited without code.
- How fixtures are first populated — most likely the same seed, with costs filled in later.

---

## Knowingly deferred (recorded 15 Nov 2026, after the branch review)

The whole-branch review returned 0 Critical and 5 Important; the five were fixed. These were
judged real but not worth holding the branch for. Nothing here loses data or misreports money.

**Needs the owner, not code**
- No expected kit counts are seeded, and no item prices. Both are the owner's numbers, not ours:
  inventing them would make the Room page and the losses report confidently wrong. Until they are
  entered on `/ops/kit`, every flat reads "Nothing counted here yet" and losses total ₹0 (the
  report says how many items have no cost recorded).
- Portable appliances (iron, hair dryer, kettle, toaster, mixer, coffee maker, lamp) are fixtures,
  so they carry a condition but no count and no loss value. If one walking off should be caught by
  the kit check, they belong as replaceables instead — a one-line change each in
  `scripts/room-kit.json`.

**Behaviour**
- The kit check silently ignores a bad entry (a finished cleaning, or a value like "2.5") instead of
  saying so. The header count still moves, so there is feedback, just not an explanation.
- `isOpeningCount`'s "first count" path is effectively dead once a cleaning has issued any
  consumable. Left in: it still guards a genuinely empty ledger, and a count above an empty ledger
  is a surplus, so no day-one losses can be invented either way.
- A kit-check movement can carry neither a turnover nor a reservation. The clean fix is a partial
  unique index.
- An item that is inactive but still holding stock at a flat is left off the Room page.
- A kit check now locks every item in the flat's kit, so two kit checks on *different* flats
  serialise where they used to run in parallel. Irrelevant at eight flats; revisit if that grows.
- `saveTicket` lets a manager move a ticket to another flat while its fixture still points at the
  old one.
- The "Other" area sorts to the top of the Room page rather than the bottom.

**Validation and types**
- `condition` and `reason` are plain text with no database CHECK, so only the app layer validates
  them.
- `boughtOn` accepts an impossible date (2026-13-45) at the regex and relies on Postgres to reject
  it; it also formats in the server's timezone rather than IST.
- `saveKitForm` quietly does nothing on a bad value while `saveKit` throws.
- `lossTotal` has no note that it expects loss rows only, and `fitOutValue` does not guard a
  negative cost.

**Naming and cost**
- `effectiveKit` returns every flat's kit rows, so the name overstates what it does.
- The losses actions make two round trips where one would do.
- Grouping room lines by area copies arrays O(n²) — harmless at room scale.
