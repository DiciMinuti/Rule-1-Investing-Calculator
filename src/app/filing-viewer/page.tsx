import Link from "next/link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAllowedSecUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    return (
      url.protocol === "https:" &&
      url.hostname === "www.sec.gov" &&
      url.pathname.startsWith("/Archives/edgar/data/")
    );
  } catch {
    return false;
  }
}

function decodeEntities(value: string) {
  return value
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'")
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function filingHtmlToText(html: string) {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<\/(div|p|tr|table|h1|h2|h3|h4|section|article)>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  );
}

export default async function FilingViewerPage({
  searchParams,
}: {
  searchParams: Promise<{ url?: string; title?: string }>;
}) {
  const { url, title } = await searchParams;
  const filingUrl = url ?? "";
  const displayTitle = title ?? "SEC filing";

  if (!filingUrl || !isAllowedSecUrl(filingUrl)) {
    return (
      <section className="panel stack">
        <h1 className="title">Filing viewer</h1>
        <p className="muted">This viewer only opens SEC archive documents from sec.gov.</p>
        <Link className="button" href="/">
          Back to search
        </Link>
      </section>
    );
  }

  let text = "";
  let error = "";

  try {
    const response = await fetch(filingUrl, {
      headers: {
        "User-Agent":
          process.env.SEC_USER_AGENT ?? "RuleOnePortfolio/0.1 personal research app contact: local@example.com",
        Accept: "text/html,text/plain,*/*",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`SEC document request failed (${response.status})`);
    }

    text = filingHtmlToText(await response.text());
  } catch (caughtError) {
    error = caughtError instanceof Error ? caughtError.message : "Could not load filing.";
  }

  return (
    <section className="panel stack filing-viewer">
      <div className="split">
        <div className="stack compact-gap">
          <h1 className="title">{displayTitle}</h1>
          <p className="muted">Clean text view of the SEC document.</p>
        </div>
        <a className="button" href={filingUrl} target="_blank" rel="noreferrer">
          Open original
        </a>
      </div>
      {error ? <div className="warning-box">{error}</div> : null}
      {text ? <pre className="filing-text">{text}</pre> : null}
    </section>
  );
}
