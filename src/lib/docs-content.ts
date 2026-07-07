export type DocsFormula = {
  title?: string;
  lines: string[];
  note?: string;
};

export type DocsExample = {
  title: string;
  body: string[];
};

export type DocsSection = {
  id: string;
  title: string;
  body: string[];
  formula?: DocsFormula;
  examples?: DocsExample[];
  appNotes?: string[];
  mistake?: string;
  checklist?: string[];
};

export type DocsChapter = {
  id: string;
  title: string;
  summary: string;
  readingTime: number;
  sections: DocsSection[];
  keyTakeaways: string[];
};

export const docsChapters: DocsChapter[] = [
  {
    id: "whole-game",
    title: "The Whole Game",
    summary:
      "Rule #1 investing is a simple sequence: understand the business, judge its quality, estimate value, and wait for a safe price.",
    readingTime: 8,
    keyTakeaways: [
      "A stock is a small ownership claim on a business, not a symbol moving on a chart.",
      "The app separates business quality from price so you do not confuse a great company with a great investment.",
      "The final answer is not automatic. The app gives structure; you still supply judgment.",
    ],
    sections: [
      {
        id: "stock-as-business",
        title: "A stock is a business in pieces",
        body: [
          "The first mental move is to stop thinking of a stock as a blinking price. A share is a small piece of a real company. That company sells products or services, earns or loses money, competes with other companies, hires managers, borrows capital, and makes choices that affect owners.",
          "When you buy a share, you are not buying yesterday's price chart. You are buying a claim on future business results. That is why this method starts with business questions before valuation questions. What does the company do? Why do customers choose it? Can it keep earning attractive returns? Would you be comfortable owning all of it if you had the money?",
          "Think about Coca-Cola. The interesting question is not only whether KO went up or down this week. The owner question is whether the business can keep selling beverages profitably for many years, whether its brands and distribution still matter, and what price would make that future attractive.",
        ],
        appNotes: [
          "The Search workflow puts the business profile, filings, quality indicators, management review, valuation inputs, price verdict, and notes in one place.",
          "The app is built to slow the process down. It makes you see the business, the numbers, the management judgment, and the price before you save a conclusion.",
        ],
        mistake:
          "A common beginner mistake is starting with price movement. Price tells you what the market is offering today. It does not tell you whether the business is understandable, durable, or attractively valued.",
      },
      {
        id: "four-decisions",
        title: "The four decisions",
        body: [
          "The workflow can be reduced to four decisions. First, Meaning: do you understand the business well enough to make a reasonable judgment? Second, Moat: does the business have a durable advantage that protects profits from competition? Third, Management: are the people running the business rational, aligned, and honest enough to trust with owner capital? Fourth, Margin of Safety: is the price low enough compared with a conservative estimate of value?",
          "The first three decisions are about quality. The fourth is about price. You need both. A weak business can be cheap for a reason. A wonderful business can be too expensive. The method works only when the business is worth owning and the price gives you room for error.",
          "This is why the app has separate grades and verdicts. A business can be Strong but still get a Nope price verdict. Another company can look statistically cheap but receive a Dull business grade because the numbers are inconsistent or the moat is unclear.",
        ],
        checklist: [
          "Meaning: I can explain how the business makes money.",
          "Moat: I can name the advantage and why it may last.",
          "Management: I can see rational capital allocation and owner alignment.",
          "Margin of safety: the current price is below my conservative buy price.",
        ],
      },
      {
        id: "quality-before-price",
        title: "Quality before price",
        body: [
          "It is tempting to look for low prices first. The problem is that cheap stocks often belong to companies with weak economics, shrinking demand, heavy debt, or unclear futures. Rule #1 thinking reverses the order: build a list of businesses you would be glad to own, then wait for price to cooperate.",
          "Costco is a useful example. Many investors understand the basic customer promise: membership, low prices, high inventory turnover, and loyal shoppers. That does not automatically make Costco a buy at any price. It means it may be worth studying as a business. The valuation still has to work.",
          "The app supports that order by showing business quality and valuation side by side. Big Five trends give a first clue. Moat and management notes refine the judgment. Sticker price and margin of safety handle price. Saves keep the research available when the market finally offers a better entry point.",
        ],
        appNotes: [
          "Business grade uses Strong, Middle, or Dull. Price verdict uses Pass, Almost, or Nope.",
          "Those labels answer different questions. Strong means business quality looks attractive. Pass means the current price is at or below the margin-of-safety price.",
        ],
      },
      {
        id: "what-app-can-do",
        title: "What the app can and cannot do",
        body: [
          "The app can gather public data, normalize common financial metrics, calculate growth rates, calculate sticker price, compare current price with margin of safety, and keep your notes organized. That is a lot. It removes many chores that used to make disciplined research hard.",
          "The app cannot know whether you understand the business. It cannot guarantee a moat is real. It cannot know the future growth rate. It cannot decide whether a manager is trustworthy. It also cannot turn a formula into certainty. The formula is transparent because the assumptions matter.",
          "Use the app like a research cockpit. It keeps the instruments in one place, but you still decide whether the flight is worth taking.",
        ],
        mistake:
          "Do not treat any single output as a command. A Pass verdict means the price is below the model's margin-of-safety price. It is not a personal recommendation to buy.",
      },
    ],
  },
  {
    id: "meaning",
    title: "Meaning",
    summary:
      "Meaning asks whether the company sits inside your circle of competence: simple enough for you to explain, track, and own with conviction.",
    readingTime: 7,
    keyTakeaways: [
      "Meaning is not about liking a product. It is about understanding how the business makes money.",
      "You can pass on companies that are too complex. Passing is a valid investing decision.",
      "The app helps by placing the company profile, filings, news, and notes beside the evaluation.",
    ],
    sections: [
      {
        id: "circle",
        title: "The circle of competence",
        body: [
          "Your circle of competence is the area where you can make a clear, honest judgment. It does not need to be large. In fact, a small circle can be an advantage because it keeps you from pretending you understand every industry.",
          "A smart beginner can understand a warehouse retailer, a beverage company, a railroad, or a payment network without knowing every accounting detail on day one. The question is whether the basic engine makes sense. What does the company sell? Who pays it? What costs matter? Why would customers keep coming back?",
          "A semiconductor equipment company, biotech company, insurance company, or bank may still be a great business, but it can require more specialized knowledge. That does not mean you should never study it. It means you should be honest about the work required before trusting your valuation.",
        ],
        examples: [
          {
            title: "Costco",
            body: [
              "A beginner can start with a simple explanation: Costco sells a limited selection of goods at low margins, charges membership fees, and relies on high volume and customer loyalty. That does not complete the analysis, but it gives you a business model you can explain.",
            ],
          },
          {
            title: "A complex bank",
            body: [
              "A bank earns money through loans, deposits, credit quality, interest rates, capital rules, and risk controls. If those drivers are unfamiliar, the right next step is not guessing. It is either studying more or putting the company outside your circle for now.",
            ],
          },
        ],
      },
      {
        id: "meaning-questions",
        title: "Questions that make Meaning practical",
        body: [
          "Meaning becomes useful when you turn it into plain questions. You should be able to answer without reading from a script. If the company disappeared tomorrow, what problem would customers have? Who are the main customers? What would make revenue grow? What would make profits fall? What competitor could hurt it?",
          "You do not need perfect answers. You need answers good enough to identify what matters. If you cannot name the important drivers, your valuation will be fragile because you will not know which assumptions are reasonable.",
        ],
        checklist: [
          "I can describe the product or service in one paragraph.",
          "I know who the customer is.",
          "I can name two major competitors or substitutes.",
          "I know which costs or risks matter most.",
          "I can explain why the business might be larger or smaller in ten years.",
        ],
        appNotes: [
          "The Business step gives you the profile and source context. Use the notes fields to write your own explanation in simple language.",
          "If the explanation sounds vague, mark Meaning as unsure. That is not failure. It is good process.",
        ],
      },
      {
        id: "product-love",
        title: "Product love is not enough",
        body: [
          "Using a product can help you understand a company, but it is not the same as understanding the business. You may love Netflix as a customer and still need to understand content spending, subscriber growth, pricing power, competition, and cash flow. You may use an iPhone and still need to understand Apple's services, supply chain, regulation, and replacement cycles.",
          "A company can make a great product and a poor investment if the economics are weak or the price is too high. A company can also be boring and excellent if the economics are durable. Meaning is about knowing the machine, not admiring the logo.",
        ],
        mistake:
          "The beginner mistake is saying, 'I use it, so I understand it.' A customer sees the product. An owner studies the economics.",
      },
      {
        id: "meaning-app",
        title: "How the app supports Meaning",
        body: [
          "The app does not grade Meaning automatically because only you know whether the business is inside your circle. Instead, it gives you the company profile, filings, news context, and notes in the same workspace as the valuation.",
          "That matters because Meaning should influence every later assumption. If you do not understand the business well, use more conservative growth, demand a larger margin of safety, or skip the company. A formula does not fix weak understanding.",
        ],
        appNotes: [
          "Meaning is stored in your notes as a manual judgment.",
          "Your thesis, red flags, and change-my-mind notes are part of the Meaning record. They capture what you believe and what would prove you wrong.",
        ],
      },
    ],
  },
  {
    id: "moat",
    title: "Moat",
    summary:
      "A moat is a durable advantage that helps a business defend profits when competitors try to attack.",
    readingTime: 11,
    keyTakeaways: [
      "A moat is not popularity. It is a reason competitors cannot easily copy the economics.",
      "The best moat evidence combines business facts with long-term financial consistency.",
      "The app lets you select moat types, read qualitative support, and compare that judgment with the Big Five.",
    ],
    sections: [
      {
        id: "moat-plain",
        title: "The plain idea",
        body: [
          "In business, high profits attract competition. If a restaurant, software product, payment network, or retailer earns unusually good returns, other companies want a piece of those returns. A moat is what makes that attack difficult.",
          "A moat can come from habit, scale, network effects, switching costs, regulation, patents, location, cost structure, or a brand that lets the company charge more. The important word is durable. A temporary advantage can disappear before your ten-year valuation has time to work.",
          "Moat is the bridge between today's numbers and tomorrow's assumptions. If you assume a company will grow for ten years, you need a reason. The moat is that reason.",
        ],
        appNotes: [
          "The app shows qualitative moat notes when available and lets you select the moat types you believe are supported.",
          "Big Five consistency is a clue, not proof. Strong numbers can suggest a moat, but you still need to identify the actual advantage.",
        ],
      },
      {
        id: "moat-types",
        title: "Common moat types",
        body: [
          "Brand moat means customers choose the company because the name itself reduces risk, creates trust, or signals quality. Coca-Cola is a classic example because the brand and distribution matter in a crowded beverage market.",
          "Switching cost means customers stay because changing providers is expensive, risky, or disruptive. Enterprise software can have switching costs when employees, data, workflows, and integrations depend on it.",
          "Network effect means the service becomes more useful as more people or businesses use it. Visa is a useful example: a payment network is more valuable when many cardholders, merchants, banks, and processors participate.",
          "Price or cost advantage means the company can operate at lower cost or offer better value while still earning acceptable returns. Costco and Walmart are often studied through this lens because scale and logistics matter.",
          "Toll bridge means a company controls access to something customers must use. Railroads can have toll-bridge features because routes, rights of way, and infrastructure are hard to duplicate.",
          "Secrets, patents, or intellectual property can matter when legal protection or specialized know-how prevents easy copying. This can be powerful, but it requires care because patents expire and technology changes.",
        ],
        examples: [
          {
            title: "Visa",
            body: [
              "Visa's moat is often discussed as a network effect. The value is not just the logo on a card. It is the acceptance network, bank relationships, authorization infrastructure, fraud tools, and habit built around electronic payments.",
            ],
          },
          {
            title: "Microsoft",
            body: [
              "Microsoft can show switching costs in business software. A company using Microsoft 365, Azure, Teams, identity tools, and internal workflows does not switch casually. That does not remove competition, but it can make customer relationships sticky.",
            ],
          },
        ],
      },
      {
        id: "moat-evidence",
        title: "Evidence beats labels",
        body: [
          "It is easy to label a famous company as having a moat. The better habit is to ask what evidence supports the label. If you say brand, can the company keep pricing power? If you say switching costs, what exactly makes switching painful? If you say network effect, who benefits as the network grows?",
          "Numbers help. A durable moat often leaves fingerprints: high return on invested capital, steady revenue growth, resilient margins, cash generation, and the ability to survive bad periods. But numbers alone can fool you. A commodity business can look good at the top of a cycle. A one-time event can make a year look better than normal.",
          "That is why the app pairs qualitative moat review with the Big Five. The moat explains why the numbers may persist. The numbers test whether the moat has shown up in results.",
        ],
        checklist: [
          "I can name the moat in one sentence.",
          "I can explain why a competitor cannot copy it quickly.",
          "I can connect the moat to customer behavior or economics.",
          "The financial record supports the moat instead of contradicting it.",
          "The moat could still matter ten years from now.",
        ],
      },
      {
        id: "moat-failures",
        title: "When a moat may be weaker than it looks",
        body: [
          "A large company does not automatically have a moat. Size can help, but size without durable economics can become bureaucracy. A popular product is not automatically a moat. Trends change. A high growth rate is not automatically a moat. Growth can be bought with heavy spending or temporary demand.",
          "Technology can also shrink moats. A company that looked protected by distribution may be hurt by online channels. A company protected by hardware may face software substitution. A media company with a strong catalog may face changes in consumer attention and content costs.",
          "For beginners, the safest move is to be strict. If the moat is hard to explain, mark it Middle or Dull and use conservative assumptions. You can always improve the judgment later as you learn more.",
        ],
        mistake:
          "Do not write 'strong brand' as a moat unless you can explain what the brand lets the company do: charge more, sell more often, lower customer acquisition cost, or keep customers from switching.",
      },
      {
        id: "moat-app",
        title: "How the app handles Moat",
        body: [
          "The Moat judgment in the app is partly supported by data and partly manual. The Big Five can suggest whether the business has been consistent. The qualitative brief can point to business facts, products, scale, risk, or competitive structure. The final moat grade is still yours.",
          "That is the right design. A moat is a business judgment, not a number the app can fully detect. The app can gather evidence and keep the logic visible. It cannot know whether the advantage will survive.",
        ],
        appNotes: [
          "Use the moat type selector to name the advantage you believe exists.",
          "If the Big Five looks strong but you cannot explain the moat, treat the company with caution.",
          "If the qualitative moat sounds appealing but the numbers are weak, ask why the advantage is not showing up in results.",
        ],
      },
    ],
  },
  {
    id: "big-five",
    title: "The Big Five",
    summary:
      "The Big Five are the app's main numerical quality checks: ROIC, sales growth, EPS growth, equity growth, and cash-flow growth.",
    readingTime: 13,
    keyTakeaways: [
      "The Big Five are not magic. They are practical clues about quality, growth, and predictability.",
      "Healthy long-term trends matter more than one impressive year.",
      "The app calculates multiple time windows because consistency is often more useful than a single average.",
    ],
    sections: [
      {
        id: "why-five",
        title: "Why these five numbers matter",
        body: [
          "A good business does two things over time: it earns attractive returns on capital and grows those results in a way owners can understand. The Big Five are a compact way to look for that pattern.",
          "ROIC asks how efficiently the business turns invested capital into profit. Sales growth asks whether demand is growing. EPS growth asks whether owners are getting more earnings per share. Equity growth asks whether the owner's claim on net assets is compounding. Cash-flow growth asks whether accounting profit is supported by cash.",
          "No metric is perfect. Banks, insurers, REITs, early-stage companies, and cyclical commodity businesses can require special treatment. The point is not to force every company into one mold. The point is to make the business prove quality before you trust a valuation.",
        ],
        appNotes: [
          "The app uses SEC annual facts where available and shows 10-year, 5-year, 3-year, and 1-year views when the data supports it.",
          "A 10% threshold is a simple health marker, not a universal law. The trend and business context matter.",
        ],
      },
      {
        id: "roic",
        title: "ROIC: return on invested capital",
        body: [
          "ROIC stands for return on invested capital. It asks: for each dollar the business uses, how much profit does it produce? High ROIC can be a sign that the business has an advantage. Competitors usually push returns down unless something protects the economics.",
          "Imagine two businesses. Business A needs factories, inventory, and debt to earn $1. Business B earns $1 with less capital because customers pay upfront or software scales cheaply. Business B may have better economics even if both report the same profit.",
          "ROIC is especially useful when compared over time. A single high year can be misleading. A long record of strong returns is more interesting.",
        ],
        formula: {
          title: "Plain formula",
          lines: ["ROIC = operating profit after tax / invested capital"],
          note:
            "The app uses available standardized filing data. Exact company reporting can differ, so treat ROIC as a quality clue, not a legal definition.",
        },
        examples: [
          {
            title: "Apple",
            body: [
              "Apple is often studied as a high-return business because it combines hardware, software, services, brand, and ecosystem behavior. The lesson is not that every Apple price is attractive. The lesson is that high returns deserve a moat explanation.",
            ],
          },
        ],
      },
      {
        id: "growth-metrics",
        title: "Sales, EPS, equity, and cash flow",
        body: [
          "Sales growth is the top-line clue. It shows whether the company is selling more over time. Sales growth without profit can be low quality, but no sales growth can limit long-term value unless margins or share count improve.",
          "EPS growth means earnings per share are growing. Per share matters because owners own shares, not the whole income statement. Buybacks can lift EPS even when total earnings are flat, so always ask what caused the growth.",
          "Equity growth means the company's net worth on the balance sheet is growing. It can be useful, but it can also be distorted by buybacks, write-downs, acquisitions, and accounting rules.",
          "Cash-flow growth asks whether the business produces more cash over time. This is important because cash pays debt, funds reinvestment, supports dividends, and gives management options.",
        ],
        formula: {
          title: "Growth rate pattern",
          lines: [
            "growth rate = (ending value / beginning value) ^ (1 / years) - 1",
            "example: from $100 to $161 over 5 years",
            "growth rate = (161 / 100) ^ (1 / 5) - 1 = 10%",
          ],
        },
        examples: [
          {
            title: "Netflix",
            body: [
              "Netflix can teach why sales growth alone is not enough. A streaming business may grow revenue while also spending heavily on content. An owner has to connect growth with durable cash generation and competitive position.",
            ],
          },
          {
            title: "A mature railroad",
            body: [
              "A railroad may not grow sales as fast as a software company, but it can still be valuable if it earns good returns, produces cash, and has hard-to-replicate infrastructure. The Big Five must be read with the business model in mind.",
            ],
          },
        ],
      },
      {
        id: "windows",
        title: "Why the app shows several time windows",
        body: [
          "A ten-year number gives the longest view, but it can hide recent weakness. A one-year number shows what just happened, but it can overreact to temporary events. The app uses multiple windows because the pattern matters.",
          "The ideal pattern is boring in a good way: many years of positive results, reasonable consistency, and no obvious collapse in the recent period. A messy pattern does not automatically disqualify a business, but it raises the amount of judgment required.",
          "Cyclical companies are the hardest. A steel company, energy producer, or semiconductor memory company can look wonderful at the top of a cycle and poor at the bottom. In those cases, normalized earnings matter more than the latest year.",
        ],
        appNotes: [
          "Review the actual annual values, not only the summary status. Missing or unusual data can change the interpretation.",
          "When the app warns about data quality, slow down. A clean-looking average can be built on imperfect inputs.",
        ],
        mistake:
          "Do not average blindly. A company that went from losses to one big profit year can show explosive growth that is not repeatable.",
      },
      {
        id: "big-five-grade",
        title: "How Big Five affects the business grade",
        body: [
          "The app uses Big Five consistency as an initial business-quality clue. Strong means the numbers look broadly healthy. Middle means the evidence is mixed. Dull means the numbers do not yet support a Rule #1-quality conclusion.",
          "That grade is not final. Moat and management can support or weaken it. A company with excellent numbers but a fragile moat may not deserve full confidence. A company with temporary messy numbers may still deserve study if the business explanation is strong, but the valuation should be conservative.",
        ],
        appNotes: [
          "Use Big Five as a first filter, not a final verdict.",
          "If Big Five, Moat, and Management all point in the same direction, your confidence improves.",
          "If they disagree, write the disagreement in notes. That is often where the real research begins.",
        ],
      },
    ],
  },
  {
    id: "management",
    title: "Management",
    summary:
      "Management quality asks whether leaders treat capital like owners would: rationally, honestly, and with discipline.",
    readingTime: 10,
    keyTakeaways: [
      "Great economics can be damaged by poor capital allocation.",
      "Management review is qualitative, but it should still be evidence based.",
      "The app keeps filings, management brief, checklist, and notes near the valuation so leadership judgment is not skipped.",
    ],
    sections: [
      {
        id: "why-management",
        title: "Why management matters",
        body: [
          "Shareholders do not run the business day to day. Managers decide how much to reinvest, how much debt to use, whether to buy other companies, when to repurchase stock, how to compensate executives, and how clearly to communicate with owners.",
          "A good business can survive average management for a while, but poor decisions compound. Overpaying for acquisitions, issuing shares cheaply, buying back stock at inflated prices, hiding bad news, or taking reckless debt can destroy owner value.",
          "Management matters most when a company produces cash. Cash gives leaders choices. The question is whether those choices make sense for long-term owners.",
        ],
        examples: [
          {
            title: "Berkshire Hathaway",
            body: [
              "Berkshire is often used as a management and capital allocation case study because the central question is not one product line. It is how capital gets moved among businesses, securities, cash, insurance float, and acquisitions.",
            ],
          },
        ],
      },
      {
        id: "rational",
        title: "Rational capital allocation",
        body: [
          "Capital allocation means deciding where money goes. The main choices are reinvestment in the business, acquisitions, debt repayment, dividends, buybacks, or holding cash. None is automatically good or bad. The right choice depends on opportunity and price.",
          "A buyback is good when the company repurchases shares below intrinsic value. The same buyback can be bad if shares are expensive and the company has better uses for cash. A dividend can be sensible for a mature business but harmful if it starves a growing business of needed reinvestment.",
          "The beginner-friendly question is: did management use money in a way that made each remaining share more valuable over time?",
        ],
        checklist: [
          "Debt is understandable and not reckless.",
          "Acquisitions have a clear strategic and financial reason.",
          "Buybacks are not used blindly at any price.",
          "Management explains capital decisions in plain terms.",
          "Long-term owner value seems more important than short-term appearances.",
        ],
        appNotes: [
          "Use filings and the management brief to look for debt, buybacks, acquisitions, compensation, and governance facts.",
          "Write down anything that would change your management grade. Vague trust is weaker than a documented reason.",
        ],
      },
      {
        id: "alignment",
        title: "Alignment and incentives",
        body: [
          "Alignment means managers benefit when long-term owners benefit. Ownership can help, but ownership alone is not enough. Compensation plans, bonus metrics, share issuance, insider selling, board independence, and governance rules also matter.",
          "If executives are paid mainly for revenue growth, they may chase size over quality. If they are paid for return on capital, free cash flow, or per-share value creation, incentives may be closer to owner interests. The exact details matter, and proxy statements are the main source.",
          "This is one reason management cannot be fully automated. The app can surface useful facts, but you still decide whether incentives make sense.",
        ],
        examples: [
          {
            title: "Share count matters",
            body: [
              "A company can announce large buybacks while also issuing stock compensation. If the share count barely falls, owners may not be getting the benefit they expected. Look at the actual shares outstanding over time.",
            ],
          },
        ],
      },
      {
        id: "candor",
        title: "Candor and trust",
        body: [
          "Candor means management explains reality clearly, including problems. You want leaders who describe risks, mistakes, tradeoffs, and long-term priorities without hiding behind promotional language.",
          "Public companies communicate through annual reports, shareholder letters, earnings calls, proxy statements, and filings. Beginners do not need to read everything at once. Start by comparing what management emphasizes with what the numbers show.",
          "If the business is deteriorating but the language stays cheerful and vague, be careful. If management explains a hard period with specifics and the financial logic is visible, that can be a better sign.",
        ],
        mistake:
          "Do not confuse confidence with candor. A confident CEO can still be promotional. Look for specific explanations tied to numbers and decisions.",
      },
      {
        id: "management-app",
        title: "How the app handles Management",
        body: [
          "The app treats management as a manual grade because no formula can decide trust. It gives you source material and a checklist so the judgment is explicit instead of skipped.",
          "Strong management should support your conviction, but it should not rescue a bad valuation. Weak management should lower confidence, even when the sticker price looks tempting.",
        ],
        appNotes: [
          "Use Strong only when you can point to evidence.",
          "Use Middle when the evidence is mixed or incomplete.",
          "Use Dull when capital allocation, governance, debt, incentives, or communication raise serious concerns.",
        ],
      },
    ],
  },
  {
    id: "sticker-price",
    title: "Sticker Price",
    summary:
      "Sticker price is the app's estimate of what a business may be worth today based on future earnings, growth, PE, time, and required return.",
    readingTime: 14,
    keyTakeaways: [
      "Sticker price is not a prediction. It is a transparent estimate built from assumptions.",
      "Small changes in growth rate or future PE can change the result a lot.",
      "The app exposes every input so you can use conservative assumptions instead of accepting a black box.",
    ],
    sections: [
      {
        id: "valuation-plain",
        title: "The plain idea",
        body: [
          "If you buy a business, you care about the cash and earnings it can produce in the future. Sticker price works backward from a future estimate to a value today. It asks: if this company grows for a number of years, sells at a reasonable future PE, and I require a certain return, what is the business worth per share today?",
          "The formula sounds intimidating only because it has several steps. Each step is simple. Start with current EPS. Grow it into future EPS. Multiply future EPS by future PE to estimate a future market price. Discount that future price back to today using your required return.",
          "The app uses 10 years and 15% required return by default because the method is designed to demand an attractive return and avoid weak opportunities. You can edit inputs when better information or more conservative judgment is needed.",
        ],
        formula: {
          title: "Sticker price flow",
          lines: [
            "future EPS = current EPS x (1 + growth rate) ^ years",
            "future price = future EPS x future PE",
            "sticker price = future price / (1 + required return) ^ years",
          ],
        },
      },
      {
        id: "eps",
        title: "Start with EPS",
        body: [
          "EPS means earnings per share. If a company earned $1 billion and has 1 billion shares, EPS is $1. If the same earnings are spread over fewer shares, EPS is higher. Since you own shares, per-share earnings matter.",
          "The app uses trailing-twelve-month EPS when quarterly data is available, then falls back to the latest annual EPS. That is convenient, but you should still inspect it. A one-time gain, temporary loss, recession year, or accounting charge can make current EPS unrepresentative. For cyclical businesses, normalized EPS may be more useful than the latest year.",
          "Real businesses are not smooth machines. An energy producer, bank, or semiconductor company can have earnings that move sharply with cycles. A stable consumer staples business may be easier to model. The less predictable the EPS, the more conservative the valuation should be.",
        ],
        appNotes: [
          "If EPS is missing or obviously distorted, the app warns you. You can enter a manual EPS assumption.",
          "A manual input should be written in notes so future you knows why it was used.",
        ],
      },
      {
        id: "growth",
        title: "Choose a growth rate",
        body: [
          "Growth rate is the most dangerous input because it has huge influence over the result. A business growing EPS at 15% for ten years becomes much larger than one growing at 7%. If the growth assumption is too optimistic, the sticker price will look better than reality.",
          "A conservative habit is to compare historical growth with analyst expectations, then use the lower reasonable number. The app can derive historical EPS growth from filings. If analyst growth is unavailable, the app still gives you the historical clue and lets you decide.",
          "Growth should connect to Meaning and Moat. If you cannot explain why the company can grow, do not let the spreadsheet assume it. A high growth rate needs a strong business reason.",
        ],
        formula: {
          title: "Growth example",
          lines: [
            "current EPS = $5.00",
            "growth rate = 10%",
            "years = 10",
            "future EPS = 5.00 x (1.10 ^ 10) = $12.97",
          ],
        },
        examples: [
          {
            title: "Nvidia-style lesson",
            body: [
              "A fast-growing business can deserve a higher growth assumption only if the business case supports it. For a company tied to intense technology cycles, the conservative investor still asks how much growth is already in the price and how durable the advantage may be.",
            ],
          },
        ],
        mistake:
          "Do not choose the growth rate you need to make the stock look cheap. Choose the growth rate the business can reasonably support.",
      },
      {
        id: "future-pe",
        title: "Choose a future PE",
        body: [
          "PE means price divided by earnings. A PE of 20 means the market price is 20 times annual earnings. In sticker price math, future PE estimates what multiple investors may pay for the company at the end of the forecast period.",
          "The app defaults toward a conservative Rule #1-style choice: compare historical PE with two times the growth rate, then use the lower reasonable number. This prevents a valuation from assuming both high growth and an inflated future multiple.",
          "For example, if the growth rate is 10%, two times growth is 20. If the historical PE is 24, the future PE default would be 20. If historical PE is 15, the default would be 15. That keeps the future price grounded.",
        ],
        formula: {
          title: "Future PE guardrail",
          lines: [
            "future PE = lower of historical PE or 2 x growth rate",
            "if growth = 10%, 2 x growth = 20",
            "if historical PE = 15, use 15",
          ],
        },
      },
      {
        id: "full-example",
        title: "A full numerical example",
        body: [
          "Use a made-up company so the math is clear. Suppose a business has current EPS of $5.00. You believe a conservative growth rate is 10% for 10 years. You use a future PE of 20. You require a 15% annual return.",
          "First, grow EPS. EPS of $5.00 growing at 10% for 10 years becomes about $12.97. Second, multiply by future PE. Future price equals $12.97 times 20, or about $259.40. Third, discount that future price back at 15% for 10 years. The sticker price is about $64.30.",
          "If today's stock price is $80, the business is above sticker price in this model. If today's price is $50, it is below sticker price but not necessarily below the margin-of-safety price. Sticker price is not the buy price. It is the value estimate before the safety discount.",
        ],
        formula: {
          title: "Full example",
          lines: [
            "future EPS = 5.00 x (1.10 ^ 10) = 12.97",
            "future price = 12.97 x 20 = 259.40",
            "sticker price = 259.40 / (1.15 ^ 10) = 64.30",
          ],
          note:
            "Rounded values are shown for readability. The app calculates with the exact numeric inputs.",
        },
      },
      {
        id: "sensitivity",
        title: "Why assumptions matter so much",
        body: [
          "Valuation is sensitive. If the example growth rate falls from 10% to 7%, future EPS becomes much lower. If future PE falls from 20 to 15, future price falls again. If required return rises, today's sticker price falls. This is why the app shows the inputs instead of hiding them.",
          "For beginners, the correct response is not to search for perfect precision. The correct response is to be conservative. If a stock only looks attractive under optimistic assumptions, it is probably not attractive enough.",
        ],
        appNotes: [
          "Edit EPS, growth, future PE, required return, years, margin of safety, and current price when the defaults do not fit.",
          "Use notes to record the reason for manual inputs. A valuation without an assumption record is hard to trust later.",
        ],
        mistake:
          "Do not round uncertainty in your favor. When unsure, use the lower growth rate, lower future PE, or larger margin of safety.",
      },
    ],
  },
  {
    id: "margin-of-safety",
    title: "Margin of Safety",
    summary:
      "Margin of safety turns estimated value into a disciplined buy price by demanding a discount for mistakes, surprises, and uncertainty.",
    readingTime: 9,
    keyTakeaways: [
      "Sticker price is the estimate. Margin-of-safety price is the disciplined buy price.",
      "The app defaults to a 50% margin of safety because valuation errors are normal.",
      "A great company above the margin-of-safety price can stay on the watchlist instead of becoming a purchase.",
    ],
    sections: [
      {
        id: "mos-plain",
        title: "Why safety matters",
        body: [
          "Every valuation is wrong in some way. Growth may slow. Margins may fall. Management may make a bad acquisition. Interest rates may change. A competitor may improve. A customer may leave. Margin of safety exists because investors are not promised a clean future.",
          "If sticker price says a business is worth $100, paying $100 leaves no room for error. Paying $50 gives room for the valuation to be too optimistic and still potentially work. The discount is not pessimism. It is respect for uncertainty.",
          "This is the emotional heart of the method. You do not need to buy just because you found a good business. You can wait until the price gives you an advantage.",
        ],
        formula: {
          title: "Margin-of-safety price",
          lines: ["MOS price = sticker price x (1 - margin of safety)", "if sticker = $100 and MOS = 50%", "MOS price = 100 x (1 - 0.50) = $50"],
        },
      },
      {
        id: "pass-almost-nope",
        title: "Pass, Almost, and Nope",
        body: [
          "The app's price verdict is intentionally simple. Pass means current price is at or below the margin-of-safety price. Almost means price is above the margin-of-safety price but still at or below sticker price. Nope means price is above sticker price.",
          "Almost is useful because many good companies spend most of their time there. The business may be worth watching, but the price is not cheap enough for the method. Nope is also useful. It prevents you from turning admiration into overpayment.",
          "A Pass verdict still depends on the assumptions. If EPS is distorted or the growth rate is too high, the Pass may be false comfort. Always read the warnings and inputs.",
        ],
        appNotes: [
          "The app compares current price with sticker price and MOS price automatically.",
          "If current price data is unavailable or stale, enter a manual current price before trusting the verdict.",
        ],
      },
      {
        id: "business-quality",
        title: "Safety depends on business quality",
        body: [
          "A 50% margin of safety is a default, not a substitute for judgment. A predictable business with a clear moat may justify more confidence than a cyclical business with uncertain earnings. A company with weak management, heavy debt, or messy data may need a larger discount or no investment at all.",
          "Think about a consumer staples company versus a commodity producer. The staples company may have steadier demand and margins. The commodity producer may look cheap when earnings are temporarily high. The same formula can produce numbers for both, but the confidence level is different.",
          "The app helps by showing business grade beside price verdict. You want the two ideas together: quality and price.",
        ],
        examples: [
          {
            title: "Wonderful business, wrong price",
            body: [
              "A company like Coca-Cola can be understandable and durable, but that does not make every market price attractive. If the current price is far above the margin-of-safety price, the disciplined answer is to wait.",
            ],
          },
        ],
      },
      {
        id: "patience",
        title: "Patience is part of the math",
        body: [
          "The method can feel inactive because many companies will not be below the buy price today. That is normal. The goal is not constant activity. The goal is to know what you want to own and what price would make sense.",
          "Saves exist for this reason. A good business with a Nope verdict is not wasted research. It can become useful later if price falls, earnings grow, or your assumptions improve.",
        ],
        mistake:
          "Do not lower the margin of safety just because you are impatient. If the price is not there, the method is telling you something.",
      },
    ],
  },
  {
    id: "payback-time",
    title: "Payback Time",
    summary:
      "Payback time is a simple sanity check: how long would the business take to earn back the price you pay?",
    readingTime: 6,
    keyTakeaways: [
      "Payback time is a secondary lens, not the app's main valuation engine.",
      "It is useful because it turns valuation into a plain owner question.",
      "It works best with conservative earnings or owner-cash-flow assumptions.",
    ],
    sections: [
      {
        id: "payback-plain",
        title: "The owner question",
        body: [
          "Payback time asks a simple question: if I bought this business, how many years of earnings would it take to get my purchase price back? This does not mean the company literally hands you all earnings as cash. It is a thinking tool.",
          "If a share costs $80 and the business earns $10 per share, the simple payback is 8 years. If it costs $80 and earns $4 per share, the simple payback is 20 years. The first situation gives the owner more earnings for each dollar paid.",
          "The appeal is clarity. Before debating discount rates and future PE, you can ask whether the current earnings power makes the price look reasonable.",
        ],
        formula: {
          title: "Simple payback",
          lines: ["payback years = price / earnings per share", "example: $80 price / $10 EPS = 8 years"],
        },
      },
      {
        id: "growth-payback",
        title: "Growth changes the picture",
        body: [
          "A simple payback ignores growth. A business earning $5 today but growing steadily may repay the purchase price faster than the first-year earnings suggest. A business earning $10 today but shrinking may be worse than it looks.",
          "That is why payback time is a sanity check, not a complete valuation. It helps you avoid obviously stretched prices, but sticker price handles growth and required return more explicitly.",
        ],
        examples: [
          {
            title: "Two different $50 stocks",
            body: [
              "Company A earns $5 per share and grows slowly. Company B earns $3 per share but has a durable path to grow earnings. Simple payback favors Company A. A full valuation may still favor Company B if the growth is real and conservatively priced.",
            ],
          },
        ],
      },
      {
        id: "payback-app",
        title: "How to use it with this app",
        body: [
          "The app's primary valuation is sticker price plus margin of safety. Payback time belongs in your notes as a second check. If the sticker price looks attractive but payback feels absurdly long, revisit the assumptions.",
          "Payback is especially helpful for beginners because it keeps the analysis connected to business reality. A valuation should never become pure spreadsheet performance.",
        ],
        appNotes: [
          "Use conservative EPS or cash-flow assumptions if you write a payback note.",
          "If payback and sticker price disagree sharply, investigate before trusting either conclusion.",
        ],
      },
    ],
  },
  {
    id: "saves-discipline",
    title: "Using Saves Like an Investor",
    summary:
      "Saves are for building a research shelf: good businesses, clear assumptions, red flags, and prices worth watching.",
    readingTime: 7,
    keyTakeaways: [
      "A save is not a trade ticket. It is a stored investment judgment.",
      "The most useful saved idea includes thesis, red flags, and what would change your mind.",
      "Revisiting assumptions is part of the process because businesses and prices change.",
    ],
    sections: [
      {
        id: "watchlist",
        title: "A watchlist is not a shopping cart",
        body: [
          "A disciplined watchlist contains businesses you understand or want to understand, not random tickers that moved recently. The point is to separate research from urgency. When price finally changes, you already know what you are looking at.",
          "For example, you might save a high-quality payment network, a warehouse retailer, a railroad, and a software company. They may not be buyable today. That is fine. A good watchlist waits.",
          "The app's Saves page stores the latest business grade, price verdict, valuation numbers, notes, and timestamp. That gives future you a starting point instead of forcing every review to begin from zero.",
        ],
        appNotes: [
          "Saved rows keep Strong, Middle, or Dull business quality and Pass, Almost, or Nope price verdict.",
          "Use the filters to separate below-MOS candidates from good businesses that are still too expensive.",
        ],
      },
      {
        id: "notes",
        title: "Write notes that are useful later",
        body: [
          "Good notes are specific. 'Great company' is not useful. 'Cost advantage from scale and membership model; watch gross margin, renewal behavior, and valuation' is useful. The goal is to preserve the reasoning, not to sound impressive.",
          "The most important note is often the change-my-mind note. Before buying, write what would prove the thesis wrong. That could be slowing same-store sales, weakening margins, rising debt, customer loss, regulatory pressure, or management changing capital allocation.",
          "A thesis without a falsification point can become a story you defend instead of a judgment you update.",
        ],
        checklist: [
          "Thesis: why this business might be worth owning.",
          "Moat: the advantage and evidence.",
          "Valuation: the assumptions that matter most.",
          "Red flags: what worries you.",
          "Change my mind: what evidence would make you downgrade or exit the idea.",
        ],
      },
      {
        id: "refresh",
        title: "Refresh stale conclusions",
        body: [
          "A saved valuation ages. Price changes daily. Filings arrive quarterly and annually. Management decisions change. Debt changes. Growth expectations change. A saved Pass from months ago may no longer be a Pass. A saved Nope can become interesting after a price decline.",
          "This is why the app stores timestamps. Treat old saves as research history, not current truth. When reviewing a company, refresh the data and reread the assumptions before acting.",
        ],
        mistake:
          "Do not let an old label do today's thinking. The label is a snapshot of the model at the time it was saved.",
      },
      {
        id: "emotion",
        title: "Saves reduce emotional decisions",
        body: [
          "Markets create pressure. A stock falls and feels scary. A stock rises and feels urgent. A saved research process helps because you already decided what matters before the emotional moment.",
          "If a business you admire finally reaches the margin-of-safety price, you can reread the thesis and red flags. If the business quality is still intact, the lower price may be opportunity. If the facts changed, the lower price may be a warning.",
        ],
        appNotes: [
          "The app is designed as a research cockpit, not a trading terminal.",
          "Use it to make fewer, clearer decisions rather than more frequent ones.",
        ],
      },
    ],
  },
  {
    id: "data-limits",
    title: "Data, Limits, and Responsibility",
    summary:
      "The app uses public data and transparent formulas, but public data can be delayed, incomplete, inconsistent, or unsuitable for some businesses.",
    readingTime: 8,
    keyTakeaways: [
      "Precise-looking numbers can still be built from imperfect data.",
      "The app is an educational research tool, not financial advice and not a broker.",
      "Warnings, filing dates, source notes, and manual inputs deserve attention.",
    ],
    sections: [
      {
        id: "sources",
        title: "Where the data comes from",
        body: [
          "The app uses free public sources so the product can remain unauthenticated and accessible. SEC EDGAR provides company facts, filings, and submissions for U.S. public companies. Public price endpoints provide daily price history and current-ish prices when available.",
          "Free data is powerful, but it is not the same as a professional market data terminal. Prices may be delayed or unavailable. Company facts may use tags that require normalization. Some companies report unusual items. Some metrics do not fit every industry cleanly.",
          "The app tries to show warnings when important inputs are missing or unreliable. Read those warnings. They are part of the analysis.",
        ],
        appNotes: [
          "The app shows filing links so you can inspect source documents.",
          "Saves are stored locally in the browser workspace unless exported.",
        ],
      },
      {
        id: "normalization",
        title: "Why normalized data can be messy",
        body: [
          "Public filings are standardized, but companies still differ. One company may tag a concept differently from another. A restatement can change past data. A spin-off, merger, or accounting change can make growth rates look strange. Share splits require adjustment. Negative earnings can make PE meaningless.",
          "This is why the app uses warnings and leaves inputs editable. A serious investing tool should not pretend every company fits perfectly into one formula.",
        ],
        examples: [
          {
            title: "Banks and REITs",
            body: [
              "Banks and REITs often need specialized metrics. A simple industrial-company Big Five read may miss what matters most, such as credit quality for banks or funds from operations for REITs.",
            ],
          },
          {
            title: "Cyclical earnings",
            body: [
              "A commodity company can show high EPS during a favorable price cycle. If you use that peak EPS as normal, the sticker price can be too high.",
            ],
          },
        ],
      },
      {
        id: "manual-responsibility",
        title: "Manual inputs are responsibility, not inconvenience",
        body: [
          "Manual inputs are not a weakness in the app. They are an honest admission that judgment matters. If EPS is distorted, enter a conservative EPS. If historical growth is not representative, choose a lower growth rate. If future PE looks generous, reduce it.",
          "Every manual input should have a reason. Otherwise, it is too easy to adjust the model until it gives the answer you wanted.",
        ],
        checklist: [
          "I know which inputs came from data and which I changed manually.",
          "I wrote a note explaining any manual change.",
          "I checked whether the business model fits the formula.",
          "I considered using more conservative assumptions when data quality is weak.",
        ],
      },
      {
        id: "not-advice",
        title: "What the final verdict means",
        body: [
          "The app's verdict is a model output. It is not financial advice, not a recommendation, and not a promise of return. It does not know your goals, taxes, time horizon, risk tolerance, portfolio, income needs, or legal restrictions.",
          "Use the app to learn and organize research. If you make investment decisions, they are your decisions. The best use of the tool is to make your reasoning visible enough that you can challenge it.",
        ],
        mistake:
          "Do not outsource responsibility to a formula. The formula is there so you can see and question the assumptions.",
      },
    ],
  },
];

export function findDocsChapter(id: string) {
  return docsChapters.find((chapter) => chapter.id === id) ?? docsChapters[0];
}

export function docsChapterSearchText(chapter: DocsChapter) {
  return [
    chapter.title,
    chapter.summary,
    ...chapter.keyTakeaways,
    ...chapter.sections.flatMap((section) => [
      section.title,
      ...section.body,
      ...(section.formula?.lines ?? []),
      section.formula?.note ?? "",
      ...(section.examples?.flatMap((example) => [example.title, ...example.body]) ?? []),
      ...(section.appNotes ?? []),
      section.mistake ?? "",
      ...(section.checklist ?? []),
    ]),
  ]
    .join(" ")
    .toLowerCase();
}
