"use client";

import { useSearchParams } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, CircleAlert, Loader2, Save, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MiniPriceChart } from "@/components/ui/mini-price-chart";
import {
  BusinessGradePill,
  MetricStatusPill,
  PriceVerdictPill,
} from "@/components/ui/status-pill";
import {
  buildBigFive,
  calculateValuation,
  deriveBusinessGrade,
  deriveDefaultAssumptions,
} from "@/lib/rule1";
import {
  businessGradeLabels,
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercent,
} from "@/lib/format";
import {
  getSavedBusinesses,
  makeSavedBusinessId,
  saveBusiness,
} from "@/lib/storage";
import type {
  AnnualFinancials,
  BigFiveResult,
  BusinessGroupConstituent,
  BusinessGroupDetail,
  BusinessGroupSummary,
  BusinessGrade,
  CompanyNotes,
  CompanyProfile,
  CompanySearchResult,
  FilingLink,
  PriceHistory,
  RuleOneEvaluation,
  SavedBusinessItem,
  ValuationAssumptions,
} from "@/lib/types";

type LoadStatus = "idle" | "loading" | "done" | "warning" | "failed";
type SearchMode = "business" | "group";
type GroupRunStatus = "idle" | "loading" | "ready" | "running" | "complete" | "stopped" | "failed";
type GroupRowStatus = "queued" | "loading" | "done" | "failed";

type LoadStep = {
  id: string;
  label: string;
  status: LoadStatus;
  detail?: string;
};

type LoadedCompany = {
  profile: CompanyProfile;
  financials: AnnualFinancials[];
  prices: PriceHistory;
  filings: FilingLink[];
  bigFive: BigFiveResult;
  loadedAt: string;
};

type GroupEvaluationRow = {
  constituent: BusinessGroupConstituent;
  status: GroupRowStatus;
  evaluation?: RuleOneEvaluation;
  error?: string;
};

type GroupRunSummary = {
  done: number;
  failed: number;
  running: number;
  queued: number;
  pass: number;
  almost: number;
  nope: number;
};

const steps = ["Result", "Business", "Big Five", "Moat", "Management", "Valuation", "Reports and notes"];
const groupLimitOptions = [10, 25, 50, 100, 0];
const moatTypes = ["Brand", "Price/cost advantage", "Secrets/IP", "Switching costs", "Toll bridge", "Network effects"];
const managementChecklist = [
  "Clear communication",
  "Rational capital allocation",
  "Reasonable debt behavior",
  "Shareholder alignment",
  "Compensation concerns reviewed",
  "Governance red flags reviewed",
];

const initialLoadSteps: LoadStep[] = [
  { id: "profile", label: "Company profile", status: "idle" },
  { id: "facts", label: "SEC facts", status: "idle" },
  { id: "prices", label: "Price history", status: "idle" },
  { id: "reports", label: "Reports", status: "idle" },
  { id: "calculation", label: "Rule #1 calculation", status: "idle" },
];

function initialNotes(): CompanyNotes {
  return {
    thesis: "",
    redFlags: "",
    changeMyMind: "",
    sourceNotes: "",
    meaning: "unsure",
    moat: "middle",
    management: "middle",
    moatTypes: [],
    managementChecklist: Object.fromEntries(managementChecklist.map((item) => [item, false])),
  };
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const body = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(body.error ?? `Request failed for ${url}`);
  }

  return body;
}

function updateLoadStep(stepsToUpdate: LoadStep[], id: string, status: LoadStatus, detail?: string) {
  return stepsToUpdate.map((step) => (step.id === id ? { ...step, status, detail } : step));
}

function statusIcon(status: LoadStatus) {
  if (status === "done") {
    return <Check size={15} />;
  }

  if (status === "loading") {
    return <Loader2 className="spin" size={15} />;
  }

  if (status === "warning" || status === "failed") {
    return <CircleAlert size={15} />;
  }

  return <span className="idle-dot" />;
}

function verdictReason(gapToMos: number) {
  if (!Number.isFinite(gapToMos)) {
    return "MOS comparison unavailable.";
  }

  if (gapToMos >= 0) {
    return `Price is ${formatPercent(gapToMos)} below MOS.`;
  }

  return `Price is ${formatPercent(Math.abs(gapToMos))} above MOS.`;
}

export function EvaluationWorkspace() {
  const params = useSearchParams();
  const symbolParam = params.get("symbol");
  const groupRunIdRef = useRef(0);
  const [searchMode, setSearchMode] = useState<SearchMode>("business");
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<CompanySearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [groupSuggestions, setGroupSuggestions] = useState<BusinessGroupSummary[]>([]);
  const [groupSearching, setGroupSearching] = useState(false);
  const [groupError, setGroupError] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<BusinessGroupDetail | null>(null);
  const [groupRows, setGroupRows] = useState<GroupEvaluationRow[]>([]);
  const [groupStatus, setGroupStatus] = useState<GroupRunStatus>("idle");
  const [groupLimit, setGroupLimit] = useState(25);
  const [loadSteps, setLoadSteps] = useState(initialLoadSteps);
  const [loaded, setLoaded] = useState<LoadedCompany | null>(null);
  const [assumptions, setAssumptions] = useState<ValuationAssumptions | null>(null);
  const [notes, setNotes] = useState<CompanyNotes>(() => initialNotes());
  const [gradeOverride, setGradeOverride] = useState<BusinessGrade | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [saveMessage, setSaveMessage] = useState("");
  const [recentSaves, setRecentSaves] = useState<SavedBusinessItem[]>([]);

  useEffect(() => {
    let ignore = false;
    getSavedBusinesses()
      .then((saves) => {
        if (!ignore) {
          setRecentSaves(saves.slice(0, 5));
        }
      })
      .catch(() => {
        if (!ignore) {
          setRecentSaves([]);
        }
      });
    return () => {
      ignore = true;
    };
  }, [saveMessage]);

  useEffect(() => {
    if (searchMode !== "business") {
      return;
    }

    if (query.trim().length < 1) {
      setSuggestions([]);
      setSearchError("");
      return;
    }

    const handle = window.setTimeout(async () => {
      setSearching(true);
      setSearchError("");
      try {
        const data = await fetchJson<{ results: CompanySearchResult[] }>(
          `/api/search?q=${encodeURIComponent(query)}`,
        );
        setSuggestions(data.results);
        if (data.results.length === 0) {
          setSearchError("No U.S. company match found.");
        }
      } catch (error) {
        setSearchError(error instanceof Error ? error.message : "Search failed.");
      } finally {
        setSearching(false);
      }
    }, 220);

    return () => window.clearTimeout(handle);
  }, [query, searchMode]);

  useEffect(() => {
    if (searchMode !== "group") {
      return;
    }

    const handle = window.setTimeout(async () => {
      setGroupSearching(true);
      setGroupError("");
      try {
        const data = await fetchJson<{ groups: BusinessGroupSummary[] }>(
          `/api/groups?q=${encodeURIComponent(query)}`,
        );
        setGroupSuggestions(data.groups);
        if (query.trim() && data.groups.length === 0) {
          setGroupError("No group match found.");
        }
      } catch (error) {
        setGroupError(error instanceof Error ? error.message : "Group search failed.");
      } finally {
        setGroupSearching(false);
      }
    }, 220);

    return () => window.clearTimeout(handle);
  }, [query, searchMode]);

  const loadCompany = useCallback(async (symbol: string) => {
    const normalizedSymbol = symbol.toUpperCase();
    setLoaded(null);
    setAssumptions(null);
    setNotes(initialNotes());
    setGradeOverride(null);
    setSaveMessage("");
    setActiveStep(0);
    setLoadSteps(initialLoadSteps.map((step) => ({ ...step, status: "idle" as const, detail: undefined })));

    try {
      setLoadSteps((current) => updateLoadStep(current, "profile", "loading"));
      const profileData = await fetchJson<{ profile: CompanyProfile }>(`/api/company/${normalizedSymbol}`);
      setLoadSteps((current) => updateLoadStep(current, "profile", "done"));

      setLoadSteps((current) =>
        current.map((step) =>
          ["facts", "prices", "reports"].includes(step.id) ? { ...step, status: "loading" } : step,
        ),
      );

      const [factsResult, pricesResult, filingsResult] = await Promise.allSettled([
        fetchJson<{ financials: AnnualFinancials[] }>(`/api/company/${normalizedSymbol}/facts`),
        fetchJson<{ prices: PriceHistory }>(`/api/company/${normalizedSymbol}/prices`),
        fetchJson<{ filings: FilingLink[] }>(`/api/company/${normalizedSymbol}/filings`),
      ]);

      const financials =
        factsResult.status === "fulfilled" ? factsResult.value.financials : ([] as AnnualFinancials[]);
      const prices =
        pricesResult.status === "fulfilled"
          ? pricesResult.value.prices
          : ({
              symbol: normalizedSymbol,
              history: [],
              source: {
                label: "Manual price required",
                confidence: "low" as const,
              },
            } satisfies PriceHistory);
      const filings = filingsResult.status === "fulfilled" ? filingsResult.value.filings : [];

      setLoadSteps((current) =>
        updateLoadStep(
          updateLoadStep(
            updateLoadStep(
              current,
              "facts",
              factsResult.status === "fulfilled" && financials.length ? "done" : "warning",
              factsResult.status === "rejected" ? factsResult.reason.message : financials.length ? undefined : "No annual facts normalized.",
            ),
            "prices",
            pricesResult.status === "fulfilled" && prices.latest ? "done" : "warning",
            pricesResult.status === "rejected" ? pricesResult.reason.message : prices.latest ? undefined : "Enter current price manually.",
          ),
          "reports",
          filingsResult.status === "fulfilled" && filings.length ? "done" : "warning",
          filings.length ? undefined : "No filing links returned.",
        ),
      );

      setLoadSteps((current) => updateLoadStep(current, "calculation", "loading"));
      const bigFive = buildBigFive(financials);
      const nextAssumptions = deriveDefaultAssumptions(financials, prices.latest?.close ?? 0);
      setLoaded({
        profile: profileData.profile,
        financials,
        prices,
        filings,
        bigFive,
        loadedAt: new Date().toISOString(),
      });
      setAssumptions(nextAssumptions);
      setLoadSteps((current) => updateLoadStep(current, "calculation", "done"));
    } catch (error) {
      setLoadSteps((current) => updateLoadStep(current, "profile", "failed", error instanceof Error ? error.message : "Load failed."));
    }
  }, []);

  const loadGroup = useCallback(async (groupId: string) => {
    groupRunIdRef.current += 1;
    setSelectedGroup(null);
    setGroupRows([]);
    setGroupStatus("loading");
    setGroupError("");

    try {
      const data = await fetchJson<{ group: BusinessGroupDetail }>(
        `/api/groups/${encodeURIComponent(groupId)}`,
      );
      setSelectedGroup(data.group);
      setGroupRows(
        data.group.constituents.map((constituent) => ({
          constituent,
          status: "queued" as const,
        })),
      );
      setGroupStatus("ready");
      setGroupSuggestions([]);
      setQuery(data.group.name);
    } catch (error) {
      setGroupStatus("failed");
      setGroupError(error instanceof Error ? error.message : "Group load failed.");
    }
  }, []);

  const stopGroupRun = useCallback(() => {
    groupRunIdRef.current += 1;
    setGroupStatus((current) => (current === "running" ? "stopped" : current));
    setGroupRows((current) =>
      current.map((row) => (row.status === "loading" ? { ...row, status: "queued" as const } : row)),
    );
  }, []);

  const runSelectedGroup = useCallback(async () => {
    if (!selectedGroup) {
      return;
    }

    const limit =
      groupLimit === 0
        ? selectedGroup.constituents.length
        : Math.min(groupLimit, selectedGroup.constituents.length);
    const targetConstituents = selectedGroup.constituents.slice(0, limit);
    const runId = groupRunIdRef.current + 1;
    groupRunIdRef.current = runId;
    setGroupStatus("running");
    setGroupError("");
    setGroupRows(
      selectedGroup.constituents.map((constituent) => ({
        constituent,
        status: "queued" as const,
      })),
    );

    for (const constituent of targetConstituents) {
      if (groupRunIdRef.current !== runId) {
        return;
      }

      setGroupRows((current) =>
        current.map((row) =>
          row.constituent.symbol === constituent.symbol
            ? { constituent: row.constituent, status: "loading" as const }
            : row,
        ),
      );

      try {
        const data = await fetchJson<{ evaluation: RuleOneEvaluation }>(
          `/api/company/${encodeURIComponent(constituent.symbol)}/evaluation`,
        );
        if (groupRunIdRef.current !== runId) {
          return;
        }
        setGroupRows((current) =>
          current.map((row) =>
            row.constituent.symbol === constituent.symbol
              ? {
                  constituent: row.constituent,
                  status: "done" as const,
                  evaluation: data.evaluation,
                }
              : row,
          ),
        );
      } catch (error) {
        if (groupRunIdRef.current !== runId) {
          return;
        }
        setGroupRows((current) =>
          current.map((row) =>
            row.constituent.symbol === constituent.symbol
              ? {
                  constituent: row.constituent,
                  status: "failed" as const,
                  error: error instanceof Error ? error.message : "Evaluation failed.",
                }
              : row,
          ),
        );
      }
    }

    if (groupRunIdRef.current === runId) {
      setGroupStatus("complete");
    }
  }, [groupLimit, selectedGroup]);

  useEffect(() => {
    if (symbolParam) {
      void loadCompany(symbolParam);
    }
  }, [loadCompany, symbolParam]);

  const businessGrade = useMemo(() => {
    if (!loaded) {
      return "middle" as BusinessGrade;
    }

    return gradeOverride ?? deriveBusinessGrade({ bigFive: loaded.bigFive, moat: notes.moat, management: notes.management });
  }, [gradeOverride, loaded, notes.management, notes.moat]);

  const valuation = useMemo(() => {
    if (!assumptions) {
      return null;
    }

    return calculateValuation(assumptions, businessGrade);
  }, [assumptions, businessGrade]);

  const visibleGroupRows = useMemo(() => {
    if (!selectedGroup) {
      return [];
    }

    const limit =
      groupLimit === 0
        ? selectedGroup.constituents.length
        : Math.min(groupLimit, selectedGroup.constituents.length);
    return groupRows.slice(0, limit);
  }, [groupLimit, groupRows, selectedGroup]);

  const groupRunSummary = useMemo(() => {
    const doneRows = visibleGroupRows.filter((row) => row.status === "done" && row.evaluation);
    const failed = visibleGroupRows.filter((row) => row.status === "failed").length;
    return {
      done: doneRows.length,
      failed,
      running: visibleGroupRows.filter((row) => row.status === "loading").length,
      queued: visibleGroupRows.filter((row) => row.status === "queued").length,
      pass: doneRows.filter((row) => row.evaluation?.valuation.priceVerdict === "pass").length,
      almost: doneRows.filter((row) => row.evaluation?.valuation.priceVerdict === "almost").length,
      nope: doneRows.filter((row) => row.evaluation?.valuation.priceVerdict === "nope").length,
    };
  }, [visibleGroupRows]);

  async function handleSave() {
    if (!loaded || !assumptions || !valuation) {
      return;
    }

    const now = new Date().toISOString();
    const save: SavedBusinessItem = {
      id: makeSavedBusinessId(loaded.profile.symbol),
      workspaceId: "local",
      symbol: loaded.profile.symbol,
      cik: loaded.profile.cik,
      companyName: loaded.profile.name,
      savedAt: now,
      updatedAt: now,
      assumptions,
      latestResult: valuation,
      notes,
      overrides: [],
      currentPrice: valuation.currentPrice,
      mosPrice: valuation.mosPrice,
      stickerPrice: valuation.stickerPrice,
      gapToMos: valuation.gapToMos,
    };

    await saveBusiness(save);
    setSaveMessage("Saved locally.");
  }

  function setAssumption<K extends keyof ValuationAssumptions>(key: K, value: ValuationAssumptions[K]) {
    setAssumptions((current) => (current ? { ...current, [key]: value } : current));
  }

  return (
    <div className="stack">
      <section className="panel search-panel">
        <div className="mode-toggle" role="tablist" aria-label="Search mode">
          <button
            className={`segmented-button ${searchMode === "business" ? "active" : ""}`}
            type="button"
            role="tab"
            aria-selected={searchMode === "business"}
            onClick={() => {
              setSearchMode("business");
              setGroupSuggestions([]);
              setGroupError("");
              setQuery("");
            }}
          >
            Business
          </button>
          <button
            className={`segmented-button ${searchMode === "group" ? "active" : ""}`}
            type="button"
            role="tab"
            aria-selected={searchMode === "group"}
            onClick={() => {
              setSearchMode("group");
              setSuggestions([]);
              setSearchError("");
              setQuery("");
            }}
          >
            Group
          </button>
        </div>

        {searchMode === "business" ? (
          <>
            <div className="search-input-wrap">
              <Search size={18} />
              <input
                className="search-input"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search a U.S. business by ticker or name."
                aria-label="Search a U.S. business by ticker or name"
              />
              {searching ? <Loader2 className="spin subtle" size={17} /> : null}
            </div>
            {suggestions.length ? (
              <div className="suggestions">
                {suggestions.map((suggestion) => (
                  <button
                    className="suggestion-row"
                    key={`${suggestion.symbol}-${suggestion.cik}`}
                    type="button"
                    onClick={() => {
                      setQuery(suggestion.symbol);
                      setSuggestions([]);
                      void loadCompany(suggestion.symbol);
                    }}
                  >
                    <span className="suggestion-symbol">{suggestion.symbol}</span>
                    <span className="suggestion-name">{suggestion.name}</span>
                    <span className="pill info">{suggestion.cik ? `CIK ${suggestion.cik}` : "SEC"}</span>
                  </button>
                ))}
              </div>
            ) : null}
            {searchError ? <p className="muted search-helper">{searchError}</p> : null}
            {!loaded && !suggestions.length && !searchError ? (
              <div className="empty-search">
                <p className="muted">Search a U.S. business by ticker or name.</p>
                {recentSaves.length ? (
                  <div className="stack">
                    <div className="label">Recent saved businesses</div>
                    <div className="row wrap">
                      {recentSaves.map((save) => (
                        <button
                          className="button"
                          key={save.id}
                          type="button"
                          onClick={() => void loadCompany(save.symbol)}
                        >
                          {save.symbol}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </>
        ) : (
          <div className="stack compact-gap">
            <div className="search-input-wrap">
              <Search size={18} />
              <input
                className="search-input"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search S&P 500, software, banks, healthcare..."
                aria-label="Search a group of businesses"
              />
              {groupSearching ? <Loader2 className="spin subtle" size={17} /> : null}
            </div>
            {groupSuggestions.length ? (
              <div className="suggestions group-suggestions">
                {groupSuggestions.map((group) => (
                  <button
                    className="suggestion-row group-suggestion-row"
                    key={group.id}
                    type="button"
                    onClick={() => void loadGroup(group.id)}
                  >
                    <span className="suggestion-symbol">{group.count}</span>
                    <span className="suggestion-name">
                      <strong>{group.name}</strong>
                      <span className="subtle">{group.description}</span>
                    </span>
                    <span className="pill info">{group.kind}</span>
                  </button>
                ))}
              </div>
            ) : null}
            {groupError ? <p className="muted search-helper">{groupError}</p> : null}
          </div>
        )}
      </section>

      {selectedGroup ? (
        <GroupScreen
          group={selectedGroup}
          rows={visibleGroupRows}
          summary={groupRunSummary}
          status={groupStatus}
          groupLimit={groupLimit}
          onGroupLimitChange={setGroupLimit}
          onRun={runSelectedGroup}
          onStop={stopGroupRun}
          onOpenCompany={loadCompany}
        />
      ) : null}

      {loadSteps.some((step) => step.status !== "idle") && !loaded ? (
        <section className="panel">
          <div className="loading-list">
            {loadSteps.map((step) => (
              <div className={`loading-item ${step.status}`} key={step.id}>
                {statusIcon(step.status)}
                <span>{step.label}</span>
                {step.detail ? <span className="subtle">{step.detail}</span> : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {loaded && assumptions && valuation ? (
        <>
          <CompanySummary
            loaded={loaded}
            valuation={valuation}
            onSave={handleSave}
            saveMessage={saveMessage}
          />
          <Stepper activeStep={activeStep} onStepChange={setActiveStep} />
          <section className="panel">
            {activeStep === 0 ? (
              <ResultStep
                loaded={loaded}
                assumptions={assumptions}
                valuation={valuation}
                gradeOverride={gradeOverride}
                setGradeOverride={setGradeOverride}
                notes={notes}
                setNotes={setNotes}
                onSave={handleSave}
                saveMessage={saveMessage}
              />
            ) : null}
            {activeStep === 1 ? <BusinessStep loaded={loaded} notes={notes} setNotes={setNotes} /> : null}
            {activeStep === 2 ? <BigFiveStep loaded={loaded} /> : null}
            {activeStep === 3 ? <MoatStep loaded={loaded} notes={notes} setNotes={setNotes} /> : null}
            {activeStep === 4 ? <ManagementStep loaded={loaded} notes={notes} setNotes={setNotes} /> : null}
            {activeStep === 5 ? (
              <ValuationStep
                assumptions={assumptions}
                setAssumption={setAssumption}
                valuation={valuation}
              />
            ) : null}
            {activeStep === 6 ? (
              <ReportsStep
                loaded={loaded}
                notes={notes}
                setNotes={setNotes}
                onSave={handleSave}
                saveMessage={saveMessage}
              />
            ) : null}
          </section>
          <div className="step-actions">
            <button
              className="button"
              type="button"
              disabled={activeStep === 0}
              onClick={() => setActiveStep((step) => Math.max(0, step - 1))}
            >
              <ChevronLeft size={16} />
              Previous
            </button>
            <button
              className="button"
              type="button"
              disabled={activeStep === steps.length - 1}
              onClick={() => setActiveStep((step) => Math.min(steps.length - 1, step + 1))}
            >
              Next
              <ChevronRight size={16} />
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

function groupRowStatusIcon(status: GroupRowStatus) {
  if (status === "done") {
    return <Check size={15} />;
  }

  if (status === "loading") {
    return <Loader2 className="spin" size={15} />;
  }

  if (status === "failed") {
    return <CircleAlert size={15} />;
  }

  return <span className="idle-dot" />;
}

function GroupScreen({
  group,
  rows,
  summary,
  status,
  groupLimit,
  onGroupLimitChange,
  onRun,
  onStop,
  onOpenCompany,
}: {
  group: BusinessGroupDetail;
  rows: GroupEvaluationRow[];
  summary: GroupRunSummary;
  status: GroupRunStatus;
  groupLimit: number;
  onGroupLimitChange: (limit: number) => void;
  onRun: () => void;
  onStop: () => void;
  onOpenCompany: (symbol: string) => void;
}) {
  const evaluatedCount = summary.done + summary.failed;
  const runLabel = evaluatedCount > 0 ? "Run again" : "Run screen";

  return (
    <section className="panel group-screen">
      <div className="stack">
        <div className="split">
          <div className="stack compact-gap">
            <div className="row wrap">
              <h1 className="title">{group.name}</h1>
              <span className="pill info">{group.kind}</span>
              <span className="pill">{group.count} businesses</span>
            </div>
            <div className="row wrap muted">
              <span>{group.source.label}</span>
              <span>Updated {formatDate(group.updatedAt)}</span>
            </div>
          </div>
          <div className="group-actions">
            <label className="stack compact-gap">
              <span className="label">Max companies</span>
              <select
                className="compact-select group-limit-select"
                value={groupLimit}
                disabled={status === "running"}
                onChange={(event) => onGroupLimitChange(Number(event.target.value))}
              >
                {groupLimitOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === 0 ? "All" : `Top ${option}`}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="button primary"
              type="button"
              disabled={status === "running" || rows.length === 0}
              onClick={onRun}
            >
              <Search size={16} />
              {runLabel}
            </button>
            {status === "running" ? (
              <button className="button danger" type="button" onClick={onStop}>
                <CircleAlert size={16} />
                Stop
              </button>
            ) : null}
          </div>
        </div>

        <div className="valuation-strip group-summary-strip">
          <ValueBlock label="Evaluated" value={`${evaluatedCount}/${rows.length}`} />
          <ValueBlock label="Pass" value={String(summary.pass)} />
          <ValueBlock label="Almost" value={String(summary.almost)} />
          <ValueBlock label="Nope" value={String(summary.nope)} />
        </div>

        <div className="table-wrap">
          <table className="table group-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Ticker</th>
                <th>Business</th>
                <th>Grade</th>
                <th>Big Five</th>
                <th>Current</th>
                <th>MOS</th>
                <th>Gap</th>
                <th>Verdict</th>
                <th>Open</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const evaluation = row.evaluation;
                return (
                  <tr key={row.constituent.symbol}>
                    <td>
                      <div className={`group-status ${row.status}`}>
                        {groupRowStatusIcon(row.status)}
                        <span>{row.status}</span>
                      </div>
                      {row.error ? <div className="subtle group-error">{row.error}</div> : null}
                    </td>
                    <td>
                      <strong>{row.constituent.displaySymbol}</strong>
                      {row.constituent.displaySymbol !== row.constituent.symbol ? (
                        <div className="subtle">{row.constituent.symbol}</div>
                      ) : null}
                    </td>
                    <td>
                      <div>{evaluation?.profile.name ?? row.constituent.name}</div>
                      <div className="subtle">{row.constituent.industry ?? row.constituent.sector ?? "S&P 500"}</div>
                    </td>
                    <td>{evaluation ? <BusinessGradePill grade={evaluation.valuation.businessGrade} /> : "—"}</td>
                    <td>{evaluation ? `${evaluation.bigFive.healthyCount}/${evaluation.bigFive.totalCount}` : "—"}</td>
                    <td>{evaluation ? formatCurrency(evaluation.valuation.currentPrice) : "—"}</td>
                    <td>{evaluation ? formatCurrency(evaluation.valuation.mosPrice) : "—"}</td>
                    <td>{evaluation ? formatPercent(evaluation.valuation.gapToMos) : "—"}</td>
                    <td>{evaluation ? <PriceVerdictPill verdict={evaluation.valuation.priceVerdict} /> : "—"}</td>
                    <td>
                      <button
                        className="button"
                        type="button"
                        onClick={() => onOpenCompany(row.constituent.symbol)}
                      >
                        <Search size={16} />
                        Open
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function CompanySummary({
  loaded,
  valuation,
  onSave,
  saveMessage,
}: {
  loaded: LoadedCompany;
  valuation: NonNullable<ReturnType<typeof calculateValuation>>;
  onSave: () => void;
  saveMessage: string;
}) {
  return (
    <section className="panel sticky-summary">
      <div className="split">
        <div className="stack compact-gap">
          <div className="row wrap">
            <h1 className="title">
              {loaded.profile.name} <span className="subtle">{loaded.profile.symbol}</span>
            </h1>
            <BusinessGradePill grade={valuation.businessGrade} />
            <PriceVerdictPill verdict={valuation.priceVerdict} />
          </div>
          <div className="row wrap muted">
            <span>{loaded.profile.exchange ?? "SEC-listed"}</span>
            <span>CIK {loaded.profile.cik ?? "—"}</span>
            <span>Price date {formatDate(loaded.prices.latest?.date)}</span>
            <span>{loaded.prices.source.label}</span>
          </div>
        </div>
        <div className="row wrap">
          <ValueMini label="Current" value={formatCurrency(valuation.currentPrice)} />
          <ValueMini label="Sticker" value={formatCurrency(valuation.stickerPrice)} />
          <ValueMini label="MOS" value={formatCurrency(valuation.mosPrice)} />
          <button className="button primary" type="button" onClick={onSave}>
            <Save size={16} />
            Save
          </button>
          {saveMessage ? <span className="pill info">{saveMessage}</span> : null}
        </div>
      </div>
    </section>
  );
}

function ValueMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="value-mini">
      <span className="label">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Stepper({ activeStep, onStepChange }: { activeStep: number; onStepChange: (step: number) => void }) {
  return (
    <nav className="stepper" aria-label="Evaluation steps">
      {steps.map((step, index) => (
        <button
          className={`step-tab ${activeStep === index ? "active" : ""}`}
          key={step}
          type="button"
          onClick={() => onStepChange(index)}
        >
          <span>{index + 1}</span>
          {step}
        </button>
      ))}
    </nav>
  );
}

function ResultStep({
  loaded,
  valuation,
  gradeOverride,
  setGradeOverride,
  notes,
  setNotes,
  onSave,
  saveMessage,
}: {
  loaded: LoadedCompany;
  assumptions: ValuationAssumptions;
  valuation: NonNullable<ReturnType<typeof calculateValuation>>;
  gradeOverride: BusinessGrade | null;
  setGradeOverride: (grade: BusinessGrade | null) => void;
  notes: CompanyNotes;
  setNotes: (notes: CompanyNotes) => void;
  onSave: () => void;
  saveMessage: string;
}) {
  const priceWarning = valuation.warnings.find((warning) => warning.startsWith("Price source"));
  const reasons = [
    priceWarning ?? verdictReason(valuation.gapToMos),
    `${loaded.bigFive.healthyCount} of 5 Big Five checks are healthy.`,
    notes.management === "middle" ? "Management review not completed." : `Management marked ${businessGradeLabels[notes.management]}.`,
    ...valuation.warnings.filter((warning) => warning !== priceWarning),
  ];

  return (
    <div className="stack">
      <div className="result-grid">
        <div className="result-block">
          <div className="label">Business grade</div>
          <div className="verdict-line">
            <BusinessGradePill grade={valuation.businessGrade} />
            <span className="muted">Quality of the business through the Rule #1 lens.</span>
          </div>
        </div>
        <div className="result-block">
          <div className="label">Price verdict</div>
          <div className="verdict-line">
            <PriceVerdictPill verdict={valuation.priceVerdict} />
            <span className="muted">
              {valuation.priceVerdict === "pass"
                ? "Pass: price is below MOS."
                : valuation.priceVerdict === "almost"
                  ? "Almost: close to MOS."
                  : "Nope: price is too high for this model."}
            </span>
          </div>
        </div>
      </div>

      <div className="valuation-strip">
        <ValueBlock label="Current price" value={formatCurrency(valuation.currentPrice)} />
        <ValueBlock label="MOS price" value={formatCurrency(valuation.mosPrice)} />
        <ValueBlock label="Sticker price" value={formatCurrency(valuation.stickerPrice)} />
        <ValueBlock label="Gap to MOS" value={formatPercent(valuation.gapToMos)} />
      </div>

      <div className="grid two">
        <div className="stack">
          <h2 className="section-title">Reasons</h2>
          <ul className="reason-list">
            {reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
        <div className="stack">
          <h2 className="section-title">Controls</h2>
          <label className="stack compact-gap">
            <span className="label">Override final business grade</span>
            <select
              className="compact-select"
              value={gradeOverride ?? ""}
              onChange={(event) => setGradeOverride(event.target.value ? (event.target.value as BusinessGrade) : null)}
            >
              <option value="">Use app grade</option>
              <option value="strong">Strong</option>
              <option value="middle">Middle</option>
              <option value="dull">Dull</option>
            </select>
          </label>
          <label className="stack compact-gap">
            <span className="label">One-line thesis</span>
            <input
              className="field"
              value={notes.thesis}
              onChange={(event) => setNotes({ ...notes, thesis: event.target.value })}
              placeholder="Why does this business belong on the list?"
            />
          </label>
          <div className="row wrap">
            <button className="button primary" type="button" onClick={onSave}>
              <Save size={16} />
              Save business
            </button>
            {saveMessage ? <span className="pill info">{saveMessage}</span> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function ValueBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="value-block">
      <span className="label">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function BusinessStep({
  loaded,
  notes,
  setNotes,
}: {
  loaded: LoadedCompany;
  notes: CompanyNotes;
  setNotes: (notes: CompanyNotes) => void;
}) {
  const latestTenK = loaded.filings.find((filing) => filing.form.startsWith("10-K"));

  return (
    <div className="stack">
      <div className="split">
        <div className="stack">
          <h2 className="section-title">Business</h2>
          <p className="muted" style={{ margin: 0 }}>
            {loaded.profile.description}
          </p>
          <div className="row wrap">
            <span className="pill info">Ticker {loaded.profile.symbol}</span>
            <span className="pill">Exchange {loaded.profile.exchange ?? "—"}</span>
            <span className="pill">CIK {loaded.profile.cik ?? "—"}</span>
            {loaded.profile.industry ? <span className="pill">{loaded.profile.industry}</span> : null}
          </div>
          {latestTenK ? (
            <a href={latestTenK.url} target="_blank" rel="noreferrer">
              Latest annual report ({latestTenK.filingDate})
            </a>
          ) : null}
        </div>
        <div className="mini-result">
          <div className="label">Meaning</div>
          <select
            className="compact-select"
            value={notes.meaning}
            onChange={(event) => setNotes({ ...notes, meaning: event.target.value as CompanyNotes["meaning"] })}
          >
            <option value="yes">Yes</option>
            <option value="unsure">Unsure</option>
            <option value="no">No</option>
          </select>
        </div>
      </div>
      <MiniPriceChart points={loaded.prices.history} />
      <div className="grid three">
        {["Can I explain what this business does?", "Is it inside my circle of competence?", "Would I want to own the whole business?"].map(
          (question) => (
            <div className="prompt" key={question}>
              {question}
            </div>
          ),
        )}
      </div>
    </div>
  );
}

function BigFiveStep({ loaded }: { loaded: LoadedCompany }) {
  return (
    <div className="stack">
      <div className="split">
        <div>
          <h2 className="section-title">Big Five</h2>
          <p className="muted" style={{ margin: "4px 0 0" }}>
            {loaded.bigFive.healthyCount}/5 checks are healthy at roughly {formatPercent(loaded.bigFive.threshold)}+.
          </p>
        </div>
        <BusinessGradePill grade={loaded.bigFive.businessContribution} />
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Metric</th>
              <th>10y</th>
              <th>5y</th>
              <th>3y</th>
              <th>1y</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loaded.bigFive.metrics.map((metric) => (
              <tr key={metric.id}>
                <td>
                  <details>
                    <summary>{metric.label}</summary>
                    <div className="annual-values">
                      {metric.values.map((point) => (
                        <span key={`${metric.id}-${point.fiscalYear}`}>
                          {point.fiscalYear}: {formatNumber(point.value)}
                        </span>
                      ))}
                    </div>
                  </details>
                  <div className="subtle">{metric.sourceLabel}</div>
                </td>
                <td>{formatPercent(metric.windows[10].value)}</td>
                <td>{formatPercent(metric.windows[5].value)}</td>
                <td>{formatPercent(metric.windows[3].value)}</td>
                <td>{formatPercent(metric.windows[1].value)}</td>
                <td>
                  <MetricStatusPill status={metric.status} />
                  {metric.warning ? <div className="subtle">{metric.warning}</div> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MoatStep({
  loaded,
  notes,
  setNotes,
}: {
  loaded: LoadedCompany;
  notes: CompanyNotes;
  setNotes: (notes: CompanyNotes) => void;
}) {
  function toggleMoatType(type: string) {
    const nextTypes = notes.moatTypes.includes(type)
      ? notes.moatTypes.filter((item) => item !== type)
      : [...notes.moatTypes, type];
    setNotes({ ...notes, moatTypes: nextTypes });
  }

  return (
    <div className="stack">
      <div className="split">
        <div>
          <h2 className="section-title">Moat</h2>
          <p className="muted" style={{ margin: "4px 0 0" }}>
            The numbers suggest a {businessGradeLabels[loaded.bigFive.businessContribution]} Big Five contribution.
          </p>
        </div>
        <select
          className="compact-select mini-select"
          value={notes.moat}
          onChange={(event) => setNotes({ ...notes, moat: event.target.value as BusinessGrade })}
        >
          <option value="strong">Strong</option>
          <option value="middle">Middle</option>
          <option value="dull">Dull</option>
        </select>
      </div>
      <div className="row wrap">
        {moatTypes.map((type) => (
          <button
            className={`segmented-button ${notes.moatTypes.includes(type) ? "active" : ""}`}
            key={type}
            type="button"
            onClick={() => toggleMoatType(type)}
          >
            {type}
          </button>
        ))}
      </div>
      <label className="stack compact-gap">
        <span className="label">Why will this business still matter in 10 years?</span>
        <textarea
          className="textarea"
          value={notes.sourceNotes}
          onChange={(event) => setNotes({ ...notes, sourceNotes: event.target.value })}
        />
      </label>
    </div>
  );
}

function ManagementStep({
  loaded,
  notes,
  setNotes,
}: {
  loaded: LoadedCompany;
  notes: CompanyNotes;
  setNotes: (notes: CompanyNotes) => void;
}) {
  const proxy = loaded.filings.find((filing) => filing.form === "DEF 14A");
  const latestTenK = loaded.filings.find((filing) => filing.form.startsWith("10-K"));

  return (
    <div className="stack">
      <div className="split">
        <div>
          <h2 className="section-title">Management</h2>
          <p className="muted" style={{ margin: "4px 0 0" }}>
            This step is a manual review using primary-source filings.
          </p>
        </div>
        <select
          className="compact-select mini-select"
          value={notes.management}
          onChange={(event) => setNotes({ ...notes, management: event.target.value as BusinessGrade })}
        >
          <option value="strong">Strong</option>
          <option value="middle">Middle</option>
          <option value="dull">Dull</option>
        </select>
      </div>
      <div className="row wrap">
        {latestTenK ? (
          <a className="button" href={latestTenK.url} target="_blank" rel="noreferrer">
            Latest 10-K
          </a>
        ) : null}
        {proxy ? (
          <a className="button" href={proxy.url} target="_blank" rel="noreferrer">
            Latest proxy
          </a>
        ) : null}
      </div>
      <div className="checklist">
        {managementChecklist.map((item) => (
          <label className="check-row" key={item}>
            <input
              type="checkbox"
              checked={notes.managementChecklist[item] ?? false}
              onChange={(event) =>
                setNotes({
                  ...notes,
                  managementChecklist: {
                    ...notes.managementChecklist,
                    [item]: event.target.checked,
                  },
                })
              }
            />
            <span>{item}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function ValuationStep({
  assumptions,
  setAssumption,
  valuation,
}: {
  assumptions: ValuationAssumptions;
  setAssumption: <K extends keyof ValuationAssumptions>(key: K, value: ValuationAssumptions[K]) => void;
  valuation: NonNullable<ReturnType<typeof calculateValuation>>;
}) {
  function setNumber<K extends keyof ValuationAssumptions>(key: K, rawValue: string, percent = false) {
    const value = Number(rawValue);
    const nextValue = Number.isFinite(value) ? (percent ? value / 100 : value) : 0;
    setAssumption(key, nextValue as ValuationAssumptions[K]);
  }

  return (
    <div className="stack">
      <div className="split">
        <div>
          <h2 className="section-title">Valuation</h2>
          <p className="muted" style={{ margin: "4px 0 0" }}>
            Edit the assumptions. The sticker price and MOS recalculate immediately.
          </p>
        </div>
        <PriceVerdictPill verdict={valuation.priceVerdict} />
      </div>
      <div className="row wrap">
        <button
          className="segmented-button"
          type="button"
          onClick={() => {
            setAssumption("growthRate", Math.max(0, assumptions.growthRate - 0.03));
            setAssumption("futurePe", Math.max(0, assumptions.futurePe - 5));
          }}
        >
          Conservative
        </button>
        <button
          className="segmented-button"
          type="button"
          onClick={() => {
            setAssumption("growthRate", assumptions.growthRate);
            setAssumption("futurePe", assumptions.futurePe);
          }}
        >
          Base
        </button>
        <button
          className="segmented-button"
          type="button"
          onClick={() => {
            setAssumption("growthRate", Math.min(0.3, assumptions.growthRate + 0.03));
            setAssumption("futurePe", Math.min(50, assumptions.futurePe + 5));
          }}
        >
          Optimistic
        </button>
      </div>
      <div className="grid four">
        <NumberField label="Current/TTM EPS" value={assumptions.eps} onChange={(value) => setNumber("eps", value)} />
        <NumberField
          label="Growth rate %"
          value={assumptions.growthRate * 100}
          onChange={(value) => setNumber("growthRate", value, true)}
        />
        <NumberField label="Future PE" value={assumptions.futurePe} onChange={(value) => setNumber("futurePe", value)} />
        <NumberField
          label="Required return %"
          value={assumptions.requiredReturn * 100}
          onChange={(value) => setNumber("requiredReturn", value, true)}
        />
        <NumberField label="Years" value={assumptions.years} onChange={(value) => setNumber("years", value)} />
        <NumberField
          label="MOS %"
          value={assumptions.marginOfSafety * 100}
          onChange={(value) => setNumber("marginOfSafety", value, true)}
        />
        <NumberField
          label="Current price"
          value={assumptions.currentPrice}
          onChange={(value) => setNumber("currentPrice", value)}
        />
        <NumberField
          label="Almost band %"
          value={assumptions.almostBand * 100}
          onChange={(value) => setNumber("almostBand", value, true)}
        />
      </div>
      <div className="valuation-strip">
        <ValueBlock label="Future EPS" value={formatCurrency(valuation.futureEps)} />
        <ValueBlock label="Future price" value={formatCurrency(valuation.futurePrice)} />
        <ValueBlock label="Sticker price" value={formatCurrency(valuation.stickerPrice)} />
        <ValueBlock label="MOS price" value={formatCurrency(valuation.mosPrice)} />
      </div>
      {valuation.warnings.length ? (
        <div className="warning-box">
          {valuation.warnings.map((warning) => (
            <div key={warning}>{warning}</div>
          ))}
        </div>
      ) : null}
      <details className="formula">
        <summary>Formula</summary>
        <code>
          future_eps = eps * (1 + growth)^years; future_price = future_eps * future_pe;
          sticker_price = future_price / (1 + required_return)^years; mos_price = sticker_price * (1 - MOS)
        </code>
      </details>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: string) => void;
}) {
  return (
    <label className="stack compact-gap">
      <span className="label">{label}</span>
      <input
        className="field"
        type="number"
        step="0.01"
        value={Number.isFinite(value) ? value : 0}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function ReportsStep({
  loaded,
  notes,
  setNotes,
  onSave,
  saveMessage,
}: {
  loaded: LoadedCompany;
  notes: CompanyNotes;
  setNotes: (notes: CompanyNotes) => void;
  onSave: () => void;
  saveMessage: string;
}) {
  return (
    <div className="stack">
      <div className="split">
        <div>
          <h2 className="section-title">Reports and notes</h2>
          <p className="muted" style={{ margin: "4px 0 0" }}>
            Keep the human reasoning next to the model.
          </p>
        </div>
        <button className="button primary" type="button" onClick={onSave}>
          <Save size={16} />
          Save
        </button>
      </div>
      {saveMessage ? <span className="pill info">{saveMessage}</span> : null}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Form</th>
              <th>Filed</th>
              <th>Document</th>
            </tr>
          </thead>
          <tbody>
            {loaded.filings.slice(0, 8).map((filing) => (
              <tr key={`${filing.accessionNumber}-${filing.primaryDocument}`}>
                <td>{filing.form}</td>
                <td>{formatDate(filing.filingDate)}</td>
                <td>
                  <a href={filing.url} target="_blank" rel="noreferrer">
                    {filing.primaryDocument}
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid two">
        <TextArea label="Thesis" value={notes.thesis} onChange={(value) => setNotes({ ...notes, thesis: value })} />
        <TextArea label="Red flags" value={notes.redFlags} onChange={(value) => setNotes({ ...notes, redFlags: value })} />
        <TextArea
          label="What would change my mind?"
          value={notes.changeMyMind}
          onChange={(value) => setNotes({ ...notes, changeMyMind: value })}
        />
        <label className="stack compact-gap">
          <span className="label">Next review date</span>
          <input
            className="field"
            type="date"
            value={notes.nextReviewDate ?? ""}
            onChange={(event) => setNotes({ ...notes, nextReviewDate: event.target.value })}
          />
        </label>
      </div>
    </div>
  );
}

function TextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="stack compact-gap">
      <span className="label">{label}</span>
      <textarea className="textarea" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
