"use client";

import { useSearchParams } from "next/navigation";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ExternalLink,
  Loader2,
  Minus,
  Plus,
  Search,
} from "lucide-react";
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MiniPriceChart } from "@/components/ui/mini-price-chart";
import {
  buildBigFive,
  calculateValuation,
  deriveBusinessGrade,
  deriveDefaultAssumptions,
} from "@/lib/rule1";
import { selectManagementDocuments } from "@/lib/data/management-documents";
import {
  formatCurrency,
  formatDate,
  formatPercent,
  gradeTone,
  verdictTone,
} from "@/lib/format";
import {
  deleteSavedBusiness,
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
  CompanyNewsItem,
  CompanyProfile,
  CompanySearchResult,
  FilingLink,
  ManagementBrief,
  ManagementSignal,
  ManagementTable,
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
  management: ManagementBrief;
  news: CompanyNewsItem[];
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

const steps = ["Result", "Business", "Management", "Inputs"];
const groupLimitOptions = [10, 25, 50, 100, 0];

const initialLoadSteps: LoadStep[] = [
  { id: "profile", label: "Company profile", status: "idle" },
  { id: "facts", label: "SEC facts", status: "idle" },
  { id: "prices", label: "Price history", status: "idle" },
  { id: "reports", label: "Reports", status: "idle" },
  { id: "management", label: "Management", status: "idle" },
  { id: "news", label: "News", status: "idle" },
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
    managementChecklist: {},
  };
}

function fallbackManagementBrief(symbol: string, filings: FilingLink[], reason?: string): ManagementBrief {
  return {
    symbol: symbol.toUpperCase(),
    generatedAt: new Date().toISOString(),
    documents: selectManagementDocuments(filings),
    signals: [
      {
        id: "leaders",
        label: "Leadership",
        question: "Who leads the business, and how long have they been in the business?",
        status: "needs-review",
        summary: "Open the latest annual report or proxy to review executive names, roles, background, and tenure.",
        excerpts: [],
      },
      {
        id: "compensation",
        label: "Compensation",
        question: "What are the leaders paid, including salary and total compensation?",
        status: "needs-review",
        summary: "Open the latest proxy statement and review the Summary Compensation Table.",
        excerpts: [],
      },
      {
        id: "ownership",
        label: "Ownership",
        question: "How much stock do leaders and directors own?",
        status: "needs-review",
        summary: "Open the latest proxy statement and review the beneficial ownership table.",
        excerpts: [],
      },
      {
        id: "shareholderLetter",
        label: "CEO Letter",
        question: "What does the latest CEO or shareholder letter say?",
        status: "needs-review",
        summary: "Open the annual report and look for a CEO or shareholder letter. Some companies publish it outside SEC filings.",
        excerpts: [],
      },
    ],
    warnings: reason ? [reason] : [],
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
  const [savedIds, setSavedIds] = useState<Set<string>>(() => new Set());
  const [recentSaves, setRecentSaves] = useState<SavedBusinessItem[]>([]);

  useEffect(() => {
    let ignore = false;
    getSavedBusinesses()
      .then((saves) => {
        if (!ignore) {
          setRecentSaves(saves.slice(0, 5));
          setSavedIds(new Set(saves.map((save) => save.id)));
        }
      })
      .catch(() => {
        if (!ignore) {
          setRecentSaves([]);
          setSavedIds(new Set());
        }
      });
    return () => {
      ignore = true;
    };
  }, []);

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
    setActiveStep(0);
    setLoadSteps(initialLoadSteps.map((step) => ({ ...step, status: "idle" as const, detail: undefined })));

    try {
      setLoadSteps((current) => updateLoadStep(current, "profile", "loading"));
      const profileData = await fetchJson<{ profile: CompanyProfile }>(`/api/company/${normalizedSymbol}`);
      setLoadSteps((current) => updateLoadStep(current, "profile", "done"));

      setLoadSteps((current) =>
        current.map((step) =>
          ["facts", "prices", "reports", "management", "news"].includes(step.id)
            ? { ...step, status: "loading" }
            : step,
        ),
      );

      const [factsResult, pricesResult, filingsResult, managementResult, newsResult] = await Promise.allSettled([
        fetchJson<{ financials: AnnualFinancials[] }>(`/api/company/${normalizedSymbol}/facts`),
        fetchJson<{ prices: PriceHistory }>(`/api/company/${normalizedSymbol}/prices`),
        fetchJson<{ filings: FilingLink[] }>(`/api/company/${normalizedSymbol}/filings`),
        fetchJson<{ management: ManagementBrief }>(`/api/company/${normalizedSymbol}/management`),
        fetchJson<{ news: CompanyNewsItem[] }>(`/api/company/${normalizedSymbol}/news`),
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
      const management =
        managementResult.status === "fulfilled"
          ? managementResult.value.management
          : fallbackManagementBrief(
              normalizedSymbol,
              filings,
              managementResult.reason instanceof Error ? managementResult.reason.message : "Management extraction failed.",
            );
      const news = newsResult.status === "fulfilled" ? newsResult.value.news : [];

      setLoadSteps((current) => {
        let next = updateLoadStep(
          current,
          "facts",
          factsResult.status === "fulfilled" && financials.length ? "done" : "warning",
          factsResult.status === "rejected" ? factsResult.reason.message : financials.length ? undefined : "No annual facts normalized.",
        );
        next = updateLoadStep(
          next,
          "prices",
          pricesResult.status === "fulfilled" && prices.latest ? "done" : "warning",
          pricesResult.status === "rejected" ? pricesResult.reason.message : prices.latest ? undefined : "Enter current price manually.",
        );
        next = updateLoadStep(
          next,
          "reports",
          filingsResult.status === "fulfilled" && filings.length ? "done" : "warning",
          filings.length ? undefined : "No filing links returned.",
        );
        next = updateLoadStep(
          next,
          "management",
          managementResult.status === "fulfilled" &&
            management.signals.some((signal) => signal.status === "found")
            ? "done"
            : "warning",
          managementResult.status === "rejected"
            ? managementResult.reason.message
            : management.signals.some((signal) => signal.status === "found")
              ? undefined
              : "Open the source filings to complete this review.",
        );
        return updateLoadStep(
          next,
          "news",
          newsResult.status === "fulfilled" && news.length ? "done" : "warning",
          newsResult.status === "rejected" ? newsResult.reason.message : news.length ? undefined : "No news returned.",
        );
      });

      setLoadSteps((current) => updateLoadStep(current, "calculation", "loading"));
      const bigFive = buildBigFive(financials);
      const nextAssumptions = deriveDefaultAssumptions(financials, prices.latest?.close ?? 0);
      setLoaded({
        profile: profileData.profile,
        financials,
        prices,
        filings,
        management,
        news,
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

  const isLoadedSaved = loaded ? savedIds.has(makeSavedBusinessId(loaded.profile.symbol)) : false;

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

  async function handleSaveToggle() {
    if (!loaded || !assumptions || !valuation) {
      return;
    }

    const saveId = makeSavedBusinessId(loaded.profile.symbol);
    if (savedIds.has(saveId)) {
      await deleteSavedBusiness(saveId);
      setSavedIds((current) => {
        const next = new Set(current);
        next.delete(saveId);
        return next;
      });
      setRecentSaves((current) => current.filter((save) => save.id !== saveId));
      return;
    }

    const now = new Date().toISOString();
    const save: SavedBusinessItem = {
      id: saveId,
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
    setSavedIds((current) => new Set(current).add(save.id));
    setRecentSaves((current) => [save, ...current.filter((item) => item.id !== save.id)].slice(0, 5));
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
            isSaved={isLoadedSaved}
            onSaveToggle={handleSaveToggle}
          />
          <section className="panel evaluation-panel">
            <Stepper activeStep={activeStep} onStepChange={setActiveStep} />
            <div className="evaluation-body">
              {activeStep === 0 ? <ResultStep loaded={loaded} valuation={valuation} /> : null}
              {activeStep === 1 ? <BusinessStep loaded={loaded} /> : null}
              {activeStep === 2 ? <ManagementStep loaded={loaded} /> : null}
              {activeStep === 3 ? (
                <ValuationStep
                  assumptions={assumptions}
                  setAssumption={setAssumption}
                  valuation={valuation}
                />
              ) : null}
            </div>
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

function groupEvaluationRowTone(row: GroupEvaluationRow) {
  if (row.status === "failed") {
    return "bad";
  }

  if (row.status === "done" && row.evaluation) {
    return verdictTone(row.evaluation.valuation.priceVerdict);
  }

  return "thinking";
}

function groupBigFiveTone(bigFive: BigFiveResult) {
  return gradeTone(bigFive.businessContribution);
}

function groupRowStatusLabel(status: GroupRowStatus) {
  if (status === "loading") {
    return "Thinking";
  }

  if (status === "queued") {
    return "Waiting";
  }

  if (status === "failed") {
    return "Failed";
  }

  return "";
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
                <th>Ticker</th>
                <th>Business</th>
                <th>Big Five</th>
                <th>Current</th>
                <th>Sticker</th>
                <th>MOS</th>
                <th>Gap</th>
                <th>Open</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const evaluation = row.evaluation;
                const statusLabel = groupRowStatusLabel(row.status);
                return (
                  <tr className={`group-result-row ${groupEvaluationRowTone(row)}`} key={row.constituent.symbol}>
                    <td>
                      <strong>{row.constituent.displaySymbol}</strong>
                      {row.constituent.displaySymbol !== row.constituent.symbol ? (
                        <div className="subtle">{row.constituent.symbol}</div>
                      ) : null}
                    </td>
                    <td>
                      <div>{evaluation?.profile.name ?? row.constituent.name}</div>
                      <div className="subtle">{row.constituent.industry ?? row.constituent.sector ?? "S&P 500"}</div>
                      {statusLabel ? (
                        <div className={`group-status ${row.status}`}>
                          {groupRowStatusIcon(row.status)}
                          <span>{statusLabel}</span>
                        </div>
                      ) : null}
                      {row.error ? <div className="subtle group-error">{row.error}</div> : null}
                    </td>
                    <td>
                      {evaluation ? (
                        <span className={`pill ${groupBigFiveTone(evaluation.bigFive)}`}>
                          {evaluation.bigFive.healthyCount}/{evaluation.bigFive.totalCount}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{evaluation ? formatCurrency(evaluation.valuation.currentPrice) : "—"}</td>
                    <td>{evaluation ? formatCurrency(evaluation.valuation.stickerPrice) : "—"}</td>
                    <td>{evaluation ? formatCurrency(evaluation.valuation.mosPrice) : "—"}</td>
                    <td>{evaluation ? formatPercent(evaluation.valuation.gapToMos) : "—"}</td>
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
  isSaved,
  onSaveToggle,
}: {
  loaded: LoadedCompany;
  valuation: NonNullable<ReturnType<typeof calculateValuation>>;
  isSaved: boolean;
  onSaveToggle: () => void;
}) {
  const hasCurrentPrice = Number.isFinite(valuation.currentPrice) && valuation.currentPrice > 0;
  const hasMosPrice = Number.isFinite(valuation.mosPrice) && valuation.mosPrice > 0;
  const isBelowMos = hasCurrentPrice && hasMosPrice && valuation.currentPrice <= valuation.mosPrice;

  return (
    <section className="panel sticky-summary">
      <div className="summary-layout">
        <div className={`summary-main stack compact-gap ${gradeTone(loaded.bigFive.businessContribution)}`}>
          <div className="row wrap">
            <h1 className="title">
              {loaded.profile.name} <span className="subtle">{loaded.profile.symbol}</span>
            </h1>
          </div>
          <div className="row wrap muted">
            <span>{loaded.profile.exchange ?? "SEC-listed"}</span>
            <span>CIK {loaded.profile.cik ?? "—"}</span>
            <span>Price date {formatDate(loaded.prices.latest?.date)}</span>
            <span>{loaded.prices.source.label}</span>
          </div>
        </div>
        <div className="summary-metrics">
          <ValueMini label="Current" value={formatCurrency(valuation.currentPrice)} />
          <ValueMini label="Sticker" value={formatCurrency(valuation.stickerPrice)} />
          <ValueMini label="MOS" value={formatCurrency(valuation.mosPrice)} tone={isBelowMos ? "good" : "bad"} />
          <SaveToggleButton isSaved={isSaved} onClick={onSaveToggle} />
        </div>
      </div>
    </section>
  );
}

function SaveToggleButton({ isSaved, onClick }: { isSaved: boolean; onClick: () => void }) {
  return (
    <button className="button primary" type="button" onClick={onClick}>
      {isSaved ? <Minus size={16} /> : <Plus size={16} />}
      {isSaved ? "Remove" : "Save"}
    </button>
  );
}

function ValueMini({ label, value, tone }: { label: string; value: string; tone?: "good" | "warn" | "bad" }) {
  return (
    <div className={`value-mini ${tone ?? ""}`}>
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
}: {
  loaded: LoadedCompany;
  valuation: NonNullable<ReturnType<typeof calculateValuation>>;
}) {
  const hasCurrentPrice = Number.isFinite(valuation.currentPrice) && valuation.currentPrice > 0;
  const hasMosPrice = Number.isFinite(valuation.mosPrice) && valuation.mosPrice > 0;
  const isBelowMos = hasCurrentPrice && hasMosPrice && valuation.currentPrice <= valuation.mosPrice;

  return (
    <div className="stack">
      <BigFiveResultRows loaded={loaded} />

      <div className="valuation-strip result-valuation-strip">
        <ValueBlock label="Current price" value={formatCurrency(valuation.currentPrice)} />
        <ValueBlock label="Gap to MOS" value={formatPercent(valuation.gapToMos)} />
        <ValueBlock label="Sticker price" value={formatCurrency(valuation.stickerPrice)} />
        <ValueBlock label="MOS price" value={formatCurrency(valuation.mosPrice)} tone={isBelowMos ? "good" : "bad"} />
      </div>
    </div>
  );
}

function metricResultTone(status: BigFiveResult["metrics"][number]["status"]) {
  if (status === "healthy") {
    return "good";
  }

  if (status === "weak") {
    return "bad";
  }

  return "warn";
}

function BigFiveResultRows({ loaded }: { loaded: LoadedCompany }) {
  return (
    <div className="big-five-grid result-big-five-grid" role="table" aria-label="Big Five result">
      <div className="big-five-header" role="row">
        <span role="columnheader">Metric</span>
        <span role="columnheader">10y</span>
        <span role="columnheader">5y</span>
        <span role="columnheader">3y</span>
        <span role="columnheader">1y</span>
      </div>
      <div className="big-five-rows">
        {loaded.bigFive.metrics.map((metric) => (
          <div className={`big-five-row result-big-five-row ${metricResultTone(metric.status)}`} role="row" key={metric.id}>
            <div className="big-five-metric" role="cell">
              <strong>{metric.label}</strong>
              <div className="subtle">{metric.sourceLabel}</div>
            </div>
            <div className="big-five-value" data-label="10y" role="cell">
              {formatPercent(metric.windows[10].value)}
            </div>
            <div className="big-five-value" data-label="5y" role="cell">
              {formatPercent(metric.windows[5].value)}
            </div>
            <div className="big-five-value" data-label="3y" role="cell">
              {formatPercent(metric.windows[3].value)}
            </div>
            <div className="big-five-value" data-label="1y" role="cell">
              {formatPercent(metric.windows[1].value)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ValueBlock({ label, value, tone }: { label: string; value: string; tone?: "good" | "warn" | "bad" }) {
  return (
    <div className={`value-block ${tone ?? ""}`}>
      <span className="label">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function companyNewsSearchUrl(symbol: string, name: string) {
  return `https://www.google.com/search?tbm=nws&q=${encodeURIComponent(`${symbol} ${name}`)}`;
}

function BusinessStep({
  loaded,
}: {
  loaded: LoadedCompany;
}) {
  return (
    <div className="stack">
      <MiniPriceChart points={loaded.prices.history} sourceLabel={loaded.prices.source.label} />
      <div className="stack">
        <div className="split aligned">
          <h3 className="section-title">Latest news</h3>
          <a className="button" href={companyNewsSearchUrl(loaded.profile.symbol, loaded.profile.name)} target="_blank" rel="noreferrer">
            <ExternalLink size={16} />
            More
          </a>
        </div>
        <div className="news-list">
          {loaded.news.length ? (
            loaded.news.slice(0, 4).map((item) => (
              <a className="news-row" href={item.url} key={`${item.title}-${item.publishedAt ?? ""}`} target="_blank" rel="noreferrer">
                <span>{item.title}</span>
                <span className="subtle">{item.source ?? "News"}{item.publishedAt ? ` · ${formatDate(item.publishedAt)}` : ""}</span>
              </a>
            ))
          ) : (
            <div className="empty-list">No news returned from the free feed.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function ManagementStep({
  loaded,
}: {
  loaded: LoadedCompany;
}) {
  const management = loaded.management;

  return (
    <div className="stack">
      {management.warnings.length ? (
        <div className="warning-box">
          {management.warnings.map((warning) => (
            <div key={warning}>{warning}</div>
          ))}
        </div>
      ) : null}

      <div className="management-list">
        {management.signals.map((signal, index) => (
          <section className="management-section" key={signal.id}>
            <div className="split aligned">
              <h3 className="section-title">
                {index + 1}. {signal.label}
              </h3>
              {signal.source?.url ? (
                <a className="subtle-link" href={signal.source.url}>
                  <ExternalLink size={14} />
                  Source
                </a>
              ) : null}
            </div>
            <p className="management-summary">{signal.summary}</p>
            <ManagementSignalContent signal={signal} />
          </section>
        ))}
      </div>
    </div>
  );
}

function ManagementSignalContent({ signal }: { signal: ManagementSignal }) {
  if (signal.tables?.length) {
    return (
      <div className="management-tables">
        {signal.tables.map((table) => (
          <ManagementTableGrid key={table.id} table={table} />
        ))}
      </div>
    );
  }

  if (signal.excerpts.length) {
    return (
      <div className="management-letter">
        {signal.excerpts.map((excerpt) => (
          <p className="management-result" key={excerpt}>
            {excerpt}
          </p>
        ))}
      </div>
    );
  }

  return <p className="management-result muted">{signal.summary}</p>;
}

function ManagementTableGrid({ table }: { table: ManagementTable }) {
  const gridTemplate = table.columns
    .map((column) => `minmax(${column.minWidth ?? "120px"}, ${column.align === "end" ? "0.7fr" : "1fr"})`)
    .join(" ");
  const tableStyle = { "--management-table-columns": gridTemplate } as CSSProperties;

  return (
    <div className="management-table-wrap">
      {table.title ? <h4 className="management-table-title">{table.title}</h4> : null}
      <div className="management-table-grid" role="table" style={tableStyle}>
        <div className="management-table-header" role="row">
          {table.columns.map((column) => (
            <span className={column.align === "end" ? "align-end" : ""} role="columnheader" key={column.key}>
              {column.label}
            </span>
          ))}
        </div>
        <div className="management-table-rows">
          {table.rows.map((row, rowIndex) => (
            <div className="management-table-row" role="row" key={`${table.id}-${rowIndex}`}>
              {table.columns.map((column) => (
                <div
                  className={`management-table-value ${column.align === "end" ? "align-end" : ""}`}
                  data-label={column.label}
                  role="cell"
                  key={column.key}
                >
                  {row[column.key] || "—"}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      {table.note ? <p className="management-table-note">{table.note}</p> : null}
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
          <h2 className="section-title">Inputs</h2>
          <p className="muted" style={{ margin: "4px 0 0" }}>
            Edit the input numbers. The sticker price and MOS recalculate immediately.
          </p>
        </div>
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
