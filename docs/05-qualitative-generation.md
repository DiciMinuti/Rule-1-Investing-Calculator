# Qualitative Brief Generation

The app does not call OpenAI at runtime. Qualitative management and moat briefs are generated locally, committed as JSON, and loaded by the frontend.

## Files

- `src/lib/data/qualitative/facts/{SYMBOL}.json` - source fact packet used as model input.
- `src/lib/data/qualitative/briefs/{SYMBOL}.json` - generated committed brief.
- `src/lib/data/qualitative/briefs/index.json` - committed registry imported by the app.
- `scripts/qualitative/schema.mjs` - JSON Schema and local validation.
- `scripts/qualitative/openai.mjs` - OpenAI Responses API call and optional Z.ai fact-packet call.
- `scripts/qualitative/generate.mjs` - generation CLI.

## Commands

Create a fact-packet template:

```bash
pnpm qualitative:template -- AAPL
```

Check a fact packet without calling OpenAI:

```bash
pnpm qualitative:generate -- AAPL --dry-run
```

Build a fact packet from public SEC source material:

```bash
pnpm qualitative:facts -- AAPL --force
```

Generate a brief:

```bash
OPENAI_API_KEY=... pnpm qualitative:generate -- AAPL --force
```

Choose a model explicitly:

```bash
OPENAI_API_KEY=... OPENAI_MODEL=gpt-5.5 pnpm qualitative:generate -- AAPL --force
```

Use separate models for cost control:

```bash
OPENAI_FACT_MODEL=gpt-5.4-mini OPENAI_BRIEF_MODEL=gpt-5.5 pnpm qualitative:batch -- --from=1 --to=300
```

The fact-packet step is usually the expensive step because it reads larger SEC source packets. The final brief step uses a smaller fact packet as input, so it can keep a stronger model while still reducing total cost.

Use Z.ai for cheaper fact packets while keeping OpenAI for the final brief:

```bash
ZAI_API_KEY=... OPENAI_FACT_PROVIDER=zai ZAI_FACT_MODEL=glm-5.2 OPENAI_BRIEF_MODEL=gpt-5.5 pnpm qualitative:batch -- --symbols=C,QCOM
```

The Z.ai path uses JSON mode and then runs the same local fact-packet validator before any brief is generated.

Use Z.ai for both fact packets and final briefs:

```bash
ZAI_API_KEY=... OPENAI_FACT_PROVIDER=zai OPENAI_BRIEF_PROVIDER=zai ZAI_FACT_MODEL=glm-5.2 ZAI_BRIEF_MODEL=glm-5.2 pnpm qualitative:batch -- --symbols=SCHW,DE
```

Validate committed briefs:

```bash
pnpm qualitative:validate
```

Rebuild the frontend registry after editing per-symbol JSON manually:

```bash
pnpm qualitative:index
```

Refresh the large-cap coverage universe:

```bash
pnpm qualitative:universe -- --limit=300
```

Run a resumable batch from the coverage universe:

```bash
pnpm qualitative:batch -- --from=1 --to=30
```

Run specific symbols:

```bash
pnpm qualitative:batch -- --symbols=NVDA,GOOG,MSFT
```

Batch runs skip existing fact packets and briefs by default, retry failed API calls, rebuild the brief index, and write status reports to `src/lib/data/qualitative/reports/`.

## Process

1. Create or update the fact packet for the business.
2. Run `qualitative:generate -- SYMBOL --dry-run`.
3. Generate with OpenAI.
4. Review the generated JSON.
5. Commit the fact packet, the per-symbol brief, and `index.json`.

The OpenAI path uses Structured Outputs with a JSON Schema so the model response matches the app's committed data shape. The Z.ai paths use JSON mode plus the same local validators.
