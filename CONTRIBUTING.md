# Contributing

Thanks for improving Rule One Portfolio. This project is a local-first investing research app, so changes should keep the workflow transparent, source-backed, and clear about limitations.

## Local Setup

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Checks

Before opening a pull request, run the checks that match your change:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Data-only or docs-only changes may not need the full set, but formula, API, storage, or UI changes should be checked carefully.

## Contribution Guidelines

- Keep calculations explicit and covered by focused tests.
- Prefer source attribution over opaque scores.
- Keep assumptions editable where investor judgment is required.
- Avoid language that sounds like investment advice or trade instructions.
- Preserve the local-first model unless a change clearly justifies otherwise.
- Use public data responsibly and respect provider access policies.
- Keep UI changes consistent with the existing minimal dark interface.

## Data And Formula Changes

For metric or valuation changes, include:

- the reason for the change
- source links or filing references
- edge cases considered
- tests for representative cases

For qualitative brief work, see [docs/05-qualitative-generation.md](docs/05-qualitative-generation.md).

## Pull Requests

Good pull requests are small enough to review, explain the user-facing effect, and call out any data-quality or financial-method assumptions.
