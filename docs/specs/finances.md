# Finances — spec

Third module of healthManager, after Alimentation and Musculation. French UI, same theme tokens (shown dark), no helper or explanatory text.

Mockups (dark theme), in `design/finances/`:
- `mobile-1-mon-mois.html`
- `mobile-2-ajouter-modifier.html`
- `bureau-mon-mois.html`

## 1. Purpose

A **typical month**, not a cash-flow tracker. It lists the regular monthly incomes (salary…) and the known monthly charges (rent, subscriptions, savings…), and shows **what is left each month**.

There are:
- no day-to-day expenses;
- no bank sync;
- no history;
- no annual amounts (the user enters a monthly amount himself if he wants to spread one).

## 2. Data model

```ts
// One line of the typical month
FinanceLine { id, kind: "income" | "expense",
              name /* 1–60 chars */,
              amountCents /* integer > 0, monthly */,
              category?: "housing" | "subscriptions" | "savings" | "other" /* required for expense, null for income */,
              createdAt, updatedAt }
```

- Amounts are stored as **integer cents**. They are displayed in euros: fr-FR format, `€` suffix, decimals only when they are not zero ("850 €", "86,40 €", "1 462,60 €").
- Editing a line overwrites it; nothing keeps the old amount.
- Category labels:
  - `housing` → **Logement**
  - `subscriptions` → **Abonnements**
  - `savings` → **Épargne**
  - `other` → **Autre**
- Category colours are new theme tokens taken from the mockups:
  - Logement: blue `#82AAD6`;
  - Abonnements: purple `#B79CDB`;
  - Épargne: the accent;
  - Autre: muted `#9AA59F`;
  - plus the light-theme equivalents.

## 3. Calculation (in `shared/`)

- Entrées = Σ income lines.
- Dépenses = Σ expense lines, **savings included**: money set aside counts as spent.
- **Reste = Entrées − Dépenses.** It can be negative.
- Per category: its total and its share of Entrées (rounded %), used in the desktop legend.
- Pure functions with unit tests. Example:
  - Entrées 2 650 + 200 = 2 850 €;
  - Dépenses 997 + 190,40 + 200 = 1 387,40 €;
  - Reste 1 462,60 €.

## 4. Screens

Route `/finances`. The module is added to the switcher (top-bar title "Finances" with its chevron, like the other modules) and remembered as the last module used.

### Mon mois (mobile `mobile-1-mon-mois`)

- **Summary card**:
  - a ring showing Reste / Entrées, with the amount in the centre on one line and "reste / mois" under it;
  - beside it, Entrées and Dépenses;
  - under them, a thin stacked bar: each category in its colour, proportional to its total, then the remainder in the track colour. The bar is decorative (`aria-hidden`).
  - Reste < 0: the ring is full in the warning colour and the amount shows with "−" in the warning colour.
- **Entrées**: a title with the total, then one card listing the income lines (name, amount, chevron).
- **Dépenses**: a title with the total, then **one card** with a section per category, in the order Logement, Abonnements, Épargne, Autre.
  - Each section has a header: colour square, name, subtotal.
  - Then its lines: name, amount, chevron.
  - **A category with no line is not shown.** It stays available in the form.
  - Lines are sorted by amount, highest first, inside their section (and in Entrées).
- Tap a line → Modifier.
- A floating **Ajouter** button (like Alimentation) → Ajouter.
- Empty state (no line at all): the ring at 0 €, no section, the Ajouter button. Nothing else.

### Ajouter / Modifier (mobile `mobile-2-ajouter-modifier`)

Bottom sheet on mobile, centred dialog on desktop (`ModalFrame`, like Nouveau repas). Fields:

1. Segmented **Dépense | Entrée**.
2. **Nom**.
3. **Montant** (€, decimal input; `,` or `.`, up to 2 decimals, > 0).
4. **Catégorie**: pills Logement / Abonnements / Épargne / Autre, each with its colour square. Expense only; hidden for an income. Required for an expense, with no default (Enregistrer stays disabled until one is chosen).

Then:
- **Enregistrer** (disabled until valid).
- **Supprimer**, when editing only. It deletes right away (no confirmation) and shows an undo toast, like a deleted log entry in Alimentation.

### Desktop (≥ 1024 px, `bureau-mon-mois`)

- Top bar: the module switcher "Finances" on the left and an **Ajouter** button on the right.
- Two columns, max 1120 px, both **the same height**: the left card stretches to the bottom of the right column, and its extra space goes around the ring.
  - **Left**:
    - one card with a 220 px ring (Reste);
    - under it, Entrées | Dépenses side by side;
    - the stacked bar;
    - a legend with one row per non-empty category (square, name, % of Entrées, amount), then a "Reste" row (% and amount, semibold) above a divider.
  - **Right**:
    - Entrées: title + card;
    - Dépenses: title + **one card** split into two inner columns. Logement then Épargne on the left; Abonnements then Autre on the right. Empty categories are hidden.
- Below 1024 px the columns stack and the mobile layout applies.

## 5. API

`/api/finance-lines`, same access-key guard as everything else:
- `GET` → all lines;
- `POST` → create;
- `PATCH /:id` → update;
- `DELETE /:id` → delete.

Validation:
- `kind` is required;
- `name` is trimmed, 1–60 characters;
- `amountCents` is an integer from 1 to 100 000 000;
- `category` is required when `kind = expense` and must be absent or null when `kind = income`.

Anything else → 400.

## 6. Acceptance checks

- With the mockup lines: Entrées 2 850 €, Dépenses 1 387,40 €, Reste 1 462,60 €; the ring is about 51 % full.
- No "Autre" section while no line has that category; adding one makes it appear (mobile, desktop card and desktop legend).
- Switching the form to Entrée hides Catégorie; saving an income stores no category.
- Editing the rent from 850 to 900 updates every total right away; nothing else is kept.
- Expenses above incomes → negative Reste in the warning colour, full ring.
- Deleting a line can be undone from the toast.
- The switcher lists Alimentation, Musculation, Finances; reopening the app goes back to Finances if it was the last module used.
- Desktop: the left card's bottom lines up with the bottom of the Dépenses card.
- No English text in the UI; every string is in `fr.ts`.
