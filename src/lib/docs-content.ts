export type DocsTopic = {
  id: string;
  title: string;
  summary: string;
  whyItMatters: string;
  howAppMeasures: string;
  manualJudgment: string;
};

export const docsTopics: DocsTopic[] = [
  {
    id: "owner-mindset",
    title: "Owner Mindset",
    summary: "Rule #1 research starts by treating a stock as a slice of a real business.",
    whyItMatters: "It keeps the evaluation focused on durability, cash generation, and price.",
    howAppMeasures: "The app shows the company profile, filing links, Big Five trends, and valuation in one workflow.",
    manualJudgment: "You still decide whether you understand the business well enough to own it.",
  },
  {
    id: "meaning",
    title: "Meaning",
    summary: "Meaning asks whether the business is inside your circle of competence.",
    whyItMatters: "A company can look statistically cheap and still be a poor fit if you cannot explain what it does.",
    howAppMeasures: "The Business step asks plain ownership questions and shows SEC context.",
    manualJudgment: "Mark whether you can explain the company, understand its economics, and would want to own it.",
  },
  {
    id: "moat",
    title: "Moat",
    summary: "A moat is a durable competitive advantage that can protect returns over time.",
    whyItMatters: "Sticker price math depends on growth and predictability; moat is the reason those assumptions may hold.",
    howAppMeasures: "Big Five consistency gives a clue, and the Moat step lets you choose a moat type.",
    manualJudgment: "You decide whether brand, switching costs, network effects, cost advantage, IP, or a toll bridge exists.",
  },
  {
    id: "big-five",
    title: "Big Five",
    summary: "The app tracks ROIC, sales growth, EPS growth, equity growth, and cash-flow growth.",
    whyItMatters: "Healthy long-term trends can indicate a durable, predictable business.",
    howAppMeasures: "SEC annual facts are normalized into 10y, 5y, 3y, and 1y views where possible.",
    manualJudgment: "Review annual values for lumpiness, one-time events, and missing or messy filing data.",
  },
  {
    id: "management",
    title: "Management",
    summary: "Management quality is a qualitative review, not a fully automated score.",
    whyItMatters: "Capital allocation, governance, debt behavior, and candor can make or break long-term returns.",
    howAppMeasures: "The app links to 10-K, 10-Q, and proxy filings and provides a checklist.",
    manualJudgment: "Read the filings and mark whether leadership seems rational, aligned, and trustworthy.",
  },
  {
    id: "sticker-price",
    title: "Sticker Price",
    summary: "Sticker price is the present value of a future price based on EPS, growth, PE, and required return.",
    whyItMatters: "It gives you a disciplined estimate before applying a margin of safety.",
    howAppMeasures: "The valuation step uses current EPS, selected growth, future PE, 10 years, and a 15% required return.",
    manualJudgment: "Use the lower conservative growth estimate and the lower of historical PE or 2x growth.",
  },
  {
    id: "margin-of-safety",
    title: "Margin Of Safety",
    summary: "Margin of safety compares today's price against a discounted buy price.",
    whyItMatters: "A strong business can still be unattractive when the current price is too high.",
    howAppMeasures: "MOS price defaults to 50% below sticker price, then current price is compared against it.",
    manualJudgment: "Decide whether 50% is enough for the business quality and data confidence.",
  },
  {
    id: "payback-time",
    title: "Payback Time",
    summary: "Payback time is a secondary check for how quickly business earnings could repay the purchase price.",
    whyItMatters: "It sanity-checks valuation against business cash generation.",
    howAppMeasures: "V1 keeps payback as a contextual lesson and room for notes while the primary model uses sticker price.",
    manualJudgment: "Use conservative earnings or cash-flow assumptions if you add a payback note.",
  },
  {
    id: "saves-discipline",
    title: "Saves Discipline",
    summary: "Saves are for revisiting good businesses without turning the app into a trading terminal.",
    whyItMatters: "The goal is to keep a watchlist of business quality, valuation, assumptions, and thesis.",
    howAppMeasures: "Saved rows keep Strong/Middle/Dull, Pass/Almost/Nope, valuation numbers, notes, and timestamps.",
    manualJudgment: "Refresh stale data, update assumptions, and write what would change your mind.",
  },
  {
    id: "data-humility",
    title: "Data Humility",
    summary: "Free public data is useful, but it can be delayed, missing, inconsistent, or company-specific.",
    whyItMatters: "A precise-looking model can still be wrong if the inputs are weak.",
    howAppMeasures: "Warnings appear inside steps and values carry source, period, formula, and confidence where possible.",
    manualJudgment: "Treat every result as a research aid, not financial advice.",
  },
  {
    id: "formula-sticker-price",
    title: "How Sticker Price Is Calculated",
    summary: "Future EPS = EPS x (1 + growth)^years. Future price = future EPS x future PE.",
    whyItMatters: "This makes the valuation transparent and editable.",
    howAppMeasures: "Sticker price = future price / (1 + required return)^years. MOS price = sticker x (1 - MOS).",
    manualJudgment: "The formula is only as good as the selected EPS, growth, PE, return, and MOS assumptions.",
  },
  {
    id: "grade-logic",
    title: "How Grades Are Decided",
    summary: "Business grade uses Strong, Middle, or Dull only.",
    whyItMatters: "A small vocabulary keeps saves clean and avoids pretending missing data is a separate conclusion.",
    howAppMeasures: "Big Five contributes an initial grade; Moat and Management can pull the grade up or down.",
    manualJudgment: "You can override the final grade after reviewing the business, moat, and management.",
  },
  {
    id: "verdict-logic",
    title: "How Verdicts Are Decided",
    summary: "Price verdict uses Pass, Almost, or Nope only.",
    whyItMatters: "The verdict is about price versus model value, not a command to buy or sell.",
    howAppMeasures: "Pass means price is at or below MOS; Almost means price is above MOS but not above sticker; Nope means price is above sticker.",
    manualJudgment: "If EPS or price is missing, enter a manual value before trusting the verdict.",
  },
  {
    id: "free-data-sources",
    title: "Free Data Sources And Limits",
    summary: "The app uses SEC EDGAR for company data and no-key public price sources for current-ish daily prices.",
    whyItMatters: "Free sources keep the app unauthenticated and shareable, but they are not real-time feeds.",
    howAppMeasures: "Next.js API routes proxy and normalize SEC, Stooq, and Yahoo Finance public chart responses, then the browser stores saves locally.",
    manualJudgment: "Check filing dates, price dates, and warnings before relying on a result.",
  },
];

export function findDocsTopic(id: string) {
  return docsTopics.find((topic) => topic.id === id) ?? docsTopics[0];
}
