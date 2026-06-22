# Rule #1 Method

This app is inspired by Phil Town's public Rule #1 investing framework. It should paraphrase and attribute concepts, not copy course or book content. It should also avoid implying affiliation with Rule #1 Investing.

## Sources Reviewed

- Rule #1 overview and Four M's: https://www.ruleoneinvesting.com/blog/how-to-invest/how-to-invest-rule-1-strategy-overview-of-the-basics/
- Four M's detail: https://www.ruleoneinvesting.com/blog/how-to-invest/the-4ms-for-successful-investing/
- Big 4 growth rates and moat: https://www.ruleoneinvesting.com/blog/how-to-invest/how-to-invest-moat-the-big-four/
- Sticker price and margin of safety: https://www.ruleoneinvesting.com/blog/how-to-invest/how-to-invest-sticker-price-and-margin-of-safety/
- Payback time: https://www.ruleoneinvesting.com/blog/how-to-invest/how-to-invest-margin-of-safety-payback-time/
- Rule #1 resource/calculator list: https://www.ruleoneinvesting.com/investing-resources/

## Core Framework

Rule #1 investing is organized around the Four M's:

1. Meaning - stay inside your circle of competence and understand the business.
2. Moat - look for a durable competitive advantage.
3. Management - prefer honest, capable, owner-oriented leadership.
4. Margin of Safety - buy only when price is meaningfully below conservative value.

The app should use this as the top-level decision model.

## Big Five

The app should show the Big Five as a moat-quality and predictability check:

1. ROIC.
2. Sales growth.
3. EPS growth.
4. Equity/book value growth.
5. Cash flow growth.

Phil Town's public tutorial on the Big 4 describes book value per share, EPS, operating cash flow per share, and sales per share as moat/predictability indicators. The app can add ROIC to complete the Big Five and can show both operating cash flow and free cash flow when possible.

Target behavior:

- Display 10y, 5y, 3y, and 1y views.
- Mark strong values around 10%+ as green.
- Mark inconsistent, negative, missing, or deteriorating values clearly.
- Do not reduce the analysis to one number only.
- Show the underlying annual values so the user can see lumpiness.

## Valuation Model

The core Rule #1 sticker price flow:

1. Start with current or trailing-twelve-month EPS.
2. Pick a future growth rate.
3. Project EPS 10 years forward.
4. Pick a future PE.
5. Calculate future market price.
6. Discount that future price back to today using the required return.
7. Apply margin of safety, default 50%.

Default assumptions:

- Required return: 15%.
- Horizon: 10 years.
- MOS discount: 50%.
- Future PE: lower of historical high/average PE and 2x selected growth rate, with user override.
- Future growth: lower of 10-year EPS growth and analyst growth when an analyst estimate is entered, capped at 15% by default. Since free analyst data may not be reliable, manual entry must be first-class.

Formula:

```text
future_eps = current_eps * (1 + growth_rate) ^ years
future_price = future_eps * future_pe
sticker_price = future_price / (1 + required_return) ^ years
mos_price = sticker_price * (1 - margin_of_safety)
```

Example defaults:

```text
years = 10
required_return = 15%
margin_of_safety = 50%
```

## Payback Time

Payback time is an additional valuation lens. The public Rule #1 lesson frames it as the price at which earnings would pay back the purchase price in about 8 years.

V1 implementation:

- Show payback time as an optional secondary panel.
- Use conservative earnings/free-cash-flow assumptions.
- Let the user edit growth and payout assumptions.
- Label it as "secondary check" rather than the main decision.

## Management And CEO Reports

Management cannot be fully automated with free numerical data. The app should create a guided checklist and link users into primary-source documents:

- Latest 10-K.
- Latest 10-Q.
- DEF 14A/proxy statement when available.
- CEO/shareholder letter when identifiable.
- Business section.
- MD&A.
- Risk factors.

The app can extract and summarize filing sections later, but V1 can begin with links and user notes.

Management checklist:

- Do I trust management?
- Does leadership communicate clearly?
- Is capital allocation rational?
- Is debt manageable?
- Is compensation aligned with shareholders?
- Is the CEO/founder owner-oriented?
- Are there obvious governance concerns?

## Lessons

Lessons should be short, contextual, and app-native. Do not create a separate landing page or course website.

Lesson modules:

1. "Buy businesses, not tickers"
   - Teaches owner mindset and why descriptions/reports matter.

2. "Meaning"
   - Teaches circle of competence and why the user can mark a company as outside their world.

3. "Moat"
   - Teaches moat types: brand, price/cost advantage, secrets/IP, switching costs, toll bridge, network effects.

4. "The Big Five"
   - Teaches how the numbers can indicate durability and predictability.

5. "Management"
   - Teaches why leadership quality is judged manually using reports, proxy statements, history, and capital allocation.

6. "Sticker price"
   - Teaches EPS, growth, PE, future price, and discounting.

7. "Margin of safety"
   - Teaches why a good business can still be a bad buy at the wrong price.

8. "Payback time"
   - Teaches the secondary check and why simple assumptions matter.

9. "Saves discipline"
   - Teaches waiting, revisiting assumptions, and avoiding action just because a ticker is popular.

10. "Data humility"
   - Teaches that public filings are messy and every model is an estimate.

## Language Rules

Use:

- "Strong."
- "Middle."
- "Dull."
- "Pass: price is below MOS."
- "Almost: above MOS but not above sticker."
- "Nope: price is too high for this model."
- "Missing EPS. Enter EPS to finish valuation."
- "Only 6 annual periods found."

Avoid:

- "Buy now."
- "Sell now."
- "Guaranteed return."
- "Safe investment."
- "This stock will..."
