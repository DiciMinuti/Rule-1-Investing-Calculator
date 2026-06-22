# UI and UX Spec

## Product Shape

The app has three main surfaces:

1. Search.
2. Saves.
3. Docs.

Everything else is secondary and should appear inside those surfaces as panels, drawers, or compact settings. Do not turn the app into a multi-tab financial terminal. The primary experience is: search a business, evaluate it step by step, get a clear Rule #1 result, then optionally save it. Docs exist as a simple reference surface, not a course platform.

## Overall Feel

The app should feel like a minimal dark investing notebook with a calculator inside it:

- Dark mode only.
- Inter.
- Base UI font size: 14px.
- Quiet, compact, and direct.
- No hero page.
- No marketing page.
- No oversized headings.
- No decorative gradients, orbs, or filler visuals.
- Rounded surfaces with pure white at 3% opacity.

Visual tokens:

- App background: near-black.
- Surface: `rgba(255, 255, 255, 0.03)`.
- Surface border: `rgba(255, 255, 255, 0.08)`.
- Strong text: near-white.
- Muted text: white at 55-65% opacity.
- Subtle text: white at 35-45% opacity.
- Radius: 8px.
- Control height: compact, around 32-36px.
- Accent green: strong/pass.
- Accent amber: middle/almost.
- Accent red: dull/nope.
- Accent blue/cyan: links and source references only.

## App Shell

Keep navigation KISS. There are three app-level routes:

- `/` - Search.
- `/saves` - Saves.
- `/docs` - Docs.

Desktop:

- Top bar with app name, primary nav, settings icon, and local workspace controls.
- Main content centered with a practical max width.
- Optional right drawer for lessons, formulas, or notes.

Desktop top nav structure:

```text
Rule One        Search   Saves   Docs        Settings
```

Rules:

- `Search`, `Saves`, and `Docs` are always visible.
- The active surface gets a subtle selected background and stronger text.
- Inactive surfaces are muted text only.
- Settings is an icon/button on the right, not a fourth main surface.
- Do not add a sidebar unless the app outgrows the three-surface model.

Mobile:

- Top search/header.
- Bottom three-item nav: Search, Saves, and Docs.
- Single-column evaluation steps.
- Sticky verdict bar after a company is selected.

Mobile bottom nav:

```text
Search   Saves   Docs
```

Rules:

- Bottom nav is fixed/sticky.
- It contains only the three surfaces.
- Settings stays in a compact menu.

Primary navigation:

1. Search.
2. Saves.
3. Docs.

Secondary access:

- Docs can also be opened contextually from each evaluation step.
- Settings are a compact menu, not a main product surface.

Navigation levels:

- App navigation switches surfaces: Search, Saves, Docs.
- Evaluation navigation only appears inside Search after a business is selected.
- Do not mix the Search stepper into the main app nav.

## Verdict Language

Use two verdict systems.

### Business Grade

This evaluates the quality of the business through Rule #1 logic.

- `Strong` - numbers and checks suggest a high-quality, predictable business.
- `Middle` - some signs are good, but there are mixed numbers or unresolved judgment calls.
- `Dull` - weak, inconsistent, too hard to understand, or not attractive enough.

### Price Verdict

This evaluates current price against valuation.

- `Pass` - current price is at or below MOS price.
- `Almost` - current price is above MOS but not above sticker price.
- `Nope` - current price is above sticker price.

Avoid using these as investment commands. The UI should say things like:

- "Pass: price is below MOS."
- "Almost: price is below sticker."
- "Nope: price is too high for this model."

Do not use:

- Wait.
- Study.
- Data Incomplete.

If data is missing, show it as a blocking issue inside the step, but the saved grade still remains Strong/Middle/Dull once the user decides.

## Surface 1: Search

The Search surface is the core product.

### Empty State

Structure:

- Large but compact search input.
- Small helper line: "Search a U.S. business by ticker or name."
- Recent saved businesses, if any.

No large intro section. No education-first screen.

### Search Suggestions

When typing, show a suggestion list:

- Ticker.
- Company name.
- Exchange.
- CIK if available.
- Data availability marker.

The user chooses one suggestion. Do not auto-jump to the first match.

### Loading State

After selection, show a compact progress checklist:

1. Company profile.
2. SEC facts.
3. Price history.
4. Reports.
5. Rule #1 calculation.

Each item can be done, loading, warning, or failed. This makes free-data failures understandable.

## Evaluation Flow

Once a business loads, the Search surface becomes a step-by-step evaluation. It should feel like a guided checklist, not a dashboard where everything competes for attention.

Top persistent summary:

- Company name and ticker.
- Current price and date.
- Business grade: Strong/Middle/Dull.
- Price verdict: Pass/Almost/Nope.
- Current price.
- Sticker price.
- MOS price.
- Save button.

The app tells the user the result first, then the user can inspect each step.

Suggested step order:

1. Result.
2. Business.
3. Big Five.
4. Moat.
5. Management.
6. Valuation.
7. Reports and notes.

Navigation:

- Stepper at the top of the evaluation.
- Previous/next buttons.
- Clicking a step opens that step.
- Each step has its own clear mini-result.

## Step 1: Result

Purpose: answer the user's main question immediately.

Layout:

- Main verdict panel.
- Three valuation numbers.
- Short reason list.
- Save/evaluate controls.

Primary content:

- Business grade: Strong/Middle/Dull.
- Price verdict: Pass/Almost/Nope.
- Current price.
- Sticker price.
- MOS price.
- Distance to MOS.

Reason list examples:

- "Price is 12% below MOS."
- "4 of 5 Big Five checks are healthy."
- "Management review not completed."
- "EPS growth is inconsistent."

Evaluation controls:

- User can override final business grade to Strong/Middle/Dull.
- User can save the business.
- User can add a one-line thesis.

The result should be calm and blunt. No hype.

## Step 2: Business

Purpose: decide whether the business has Meaning.

Content:

- Plain-language description from filings/source.
- What the company does.
- Ticker, exchange, CIK.
- Sector/industry when available.
- Latest annual report link.
- Price chart in compact form.

Manual questions:

- "Can I explain what this business does?"
- "Is it inside my circle of competence?"
- "Would I want to own the whole business?"

Mini-result:

- Meaning: Yes/Unsure/No.

Lesson link:

- "Meaning" opens a drawer explaining circle of competence and owner mindset.

## Step 3: Big Five

Purpose: judge whether the numbers look Rule #1-worthy.

Content:

- Five rows:
  - ROIC.
  - Sales growth.
  - EPS growth.
  - Equity/book value growth.
  - Cash flow growth.
- Columns:
  - 10y.
  - 5y.
  - 3y.
  - 1y.
  - Status.
- A compact trend sparkline per row.
- Expandable annual values.

Mini-result:

- Big Five score: `5/5`, `4/5`, etc.
- Business contribution:
  - 4-5 healthy checks leans Strong.
  - 2-3 healthy checks leans Middle.
  - 0-1 healthy checks leans Dull.

Rules:

- Around 10%+ CAGR is healthy by default.
- Negative, missing, or inconsistent values are not hidden.
- User can override a metric and the app labels it `Manual`.

Lesson link:

- "Big Five" opens the lesson drawer.

## Step 4: Moat

Purpose: connect the numbers to a durable advantage.

Content:

- Automatic moat clue from Big Five consistency.
- Manual moat type selector:
  - Brand.
  - Price/cost advantage.
  - Secrets/IP.
  - Switching costs.
  - Toll bridge.
  - Network effects.
- Notes field: "Why will this business still matter in 10 years?"

Mini-result:

- Moat: Strong/Middle/Dull.

The app can suggest a moat strength from the numbers, but the user decides.

## Step 5: Management

Purpose: force a qualitative review.

Content:

- Latest 10-K link.
- Latest proxy/DEF 14A if available.
- CEO/shareholder letter link if identifiable.
- Management checklist:
  - Clear communication.
  - Rational capital allocation.
  - Reasonable debt behavior.
  - Shareholder alignment.
  - Compensation concerns.
  - Governance red flags.

Mini-result:

- Management: Strong/Middle/Dull.

The app should not pretend to fully automate this step. It can provide report links and prompts.

## Step 6: Valuation

Purpose: calculate sticker price and MOS.

Inputs:

- Current/TTM EPS.
- 10y EPS growth rate.
- Analyst growth rate.
- Growth rate used.
- Historical PE.
- Future PE.
- Required return, default 15%.
- Years, default 10.
- MOS, default 50%.
- Current price.

Outputs:

- Future EPS.
- Future price.
- Sticker price.
- MOS price.
- Current price vs MOS.
- Price verdict: Pass/Almost/Nope.

Price verdict logic:

- Pass: current price <= MOS price.
- Almost: current price is above MOS price and <= sticker price.
- Nope: current price is above sticker price.

Visual:

- One simple horizontal comparison:
  - Current price.
  - MOS price.
  - Sticker price.
- Make it instantly obvious where current price sits.

Controls:

- Editable assumptions.
- Conservative/base/optimistic quick selectors.
- Formula disclosure.

Lesson links:

- Sticker price.
- Margin of safety.
- Payback time.

## Step 7: Reports And Notes

Purpose: save the human reasoning.

Content:

- Report links.
- Thesis.
- Red flags.
- What would change my mind?
- Next review date.
- Source notes.

Save behavior:

- Saving stores the selected company, business grade, price verdict, valuation numbers, assumptions, notes, overrides, and timestamp locally.

## Surface 2: Saves

The Saves surface is a list of saved businesses. It should be simple and fast.

Primary layout:

- Search/filter saved businesses.
- Compact table/list.
- Detail drawer or click-through back to Search evaluation.

Saved business row:

- Ticker.
- Company.
- Business grade: Strong/Middle/Dull.
- Price verdict: Pass/Almost/Nope.
- Current price.
- MOS price.
- Sticker price.
- Gap to MOS.
- Last reviewed.
- One-line thesis.

Filters:

- Strong.
- Middle.
- Dull.
- Pass.
- Almost.
- Nope.
- Near MOS.

Sorting:

- Gap to MOS.
- Business grade.
- Last reviewed.
- Ticker/name.

Actions:

- Open evaluation.
- Refresh price/data.
- Edit grade.
- Edit notes.
- Remove.
- Export JSON.

The Saves screen should not introduce new statuses like Wait, Study, or Data Incomplete. If a saved business has missing data, show a small warning icon or line, but keep the user's grade visible.

## Surface 3: Docs

Docs are the third main surface. Keep it simple: a small reference library for Rule #1 concepts, app formulas, source notes, and disclaimers.

Docs layout:

- Left list of topics on desktop.
- Single list-to-detail flow on mobile.
- Search/filter topics if easy.
- Short pages, not long essays.

Docs content:

- Short explanation.
- Why it matters.
- How the app measures it.
- What the user still has to judge manually.

Topics:

1. Owner mindset.
2. Meaning.
3. Moat.
4. Big Five.
5. Management.
6. Sticker price.
7. Margin of safety.
8. Payback time.
9. Saves discipline.
10. Data humility.
11. How sticker price is calculated.
12. How `Strong`, `Middle`, and `Dull` are decided.
13. How `Pass`, `Almost`, and `Nope` are decided.
14. Free data sources and limitations.

Contextual docs:

- Each Search step can open the relevant docs topic in a drawer or side panel.
- The standalone Docs surface is for reading later.
- Do not duplicate heavy text inside the Search flow.

## Settings

Settings are a compact menu/dialog.

Sections:

- Defaults:
  - Required return.
  - MOS percentage.
  - Years.
  - Big Five healthy threshold.
- Workspace:
  - Export.
  - Import.
  - Clear local data.
- Sources:
  - SEC attribution.
  - Price source attribution.
- Disclaimer:
  - Educational research tool.
  - Not financial advice.
  - Not affiliated with Phil Town, Rule #1 Investing, SEC, or data providers.

## Status Model

Do not use the old broad statuses:

- No `Wait`.
- No `Study`.
- No `Data Incomplete`.

Use:

- Business grade: Strong/Middle/Dull.
- Price verdict: Pass/Almost/Nope.
- Step-specific blockers/warnings only when data is missing.

Examples:

- "EPS missing. Enter EPS to finish valuation."
- "Price source unavailable. Enter current price manually."
- "Only 6 annual periods found."

## Core Interaction Flow

1. User opens app on Search.
2. User searches a U.S. business.
3. User selects one suggestion.
4. App loads free data and calculates initial result.
5. User sees Result first.
6. User steps through Business, Big Five, Moat, Management, Valuation, Reports/Notes.
7. User can edit assumptions or override grades.
8. App recalculates immediately.
9. User saves the business.
10. Saved business appears in Saves list with Strong/Middle/Dull and Pass/Almost/Nope.

## Empty/Error States

No search results:

- "No U.S. company match found."

Missing price:

- "Price source unavailable. Enter current price manually."

Missing EPS:

- "EPS unavailable. Enter EPS to calculate sticker price."

Messy filings:

- "SEC facts vary by company. Review the annual values before trusting this metric."

Rate-limited:

- "Source is cooling down. Try again in a moment."

The user should always have a next action: choose another result, retry, or enter a manual value.
