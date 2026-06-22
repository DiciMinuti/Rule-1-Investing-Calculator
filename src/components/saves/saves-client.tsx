"use client";

import { Download, ExternalLink, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BusinessGradePill, PriceVerdictPill } from "@/components/ui/status-pill";
import {
  formatCurrency,
  formatDate,
  formatPercent,
} from "@/lib/format";
import {
  deleteSavedBusiness,
  downloadWorkspaceJson,
  exportWorkspace,
  getSavedBusinesses,
} from "@/lib/storage";
import type { BigFiveMetric, BusinessGrade, PriceVerdict, SavedBusinessItem } from "@/lib/types";

type PriceBandFilter = "all" | PriceVerdict;
type SaveSort = "gap" | "grade" | "reviewed" | "symbol";

const priceBandFilters: { id: PriceBandFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pass", label: "Below MOS" },
  { id: "almost", label: "Between MOS and sticker" },
  { id: "nope", label: "Above sticker" },
];

const bigFiveFilters: { id: BigFiveMetric["id"]; label: string }[] = [
  { id: "roic", label: "ROIC pass" },
  { id: "salesGrowth", label: "Sales pass" },
  { id: "epsGrowth", label: "EPS pass" },
  { id: "equityGrowth", label: "Equity pass" },
  { id: "cashFlowGrowth", label: "Cash flow pass" },
];

function gradeRank(grade: BusinessGrade) {
  return grade === "strong" ? 0 : grade === "middle" ? 1 : 2;
}

export function SavesClient() {
  const [saves, setSaves] = useState<SavedBusinessItem[]>([]);
  const [query, setQuery] = useState("");
  const [priceBandFilter, setPriceBandFilter] = useState<PriceBandFilter>("all");
  const [selectedBigFive, setSelectedBigFive] = useState<Set<BigFiveMetric["id"]>>(() => new Set());
  const [sort, setSort] = useState<SaveSort>("gap");
  const [message, setMessage] = useState("");

  async function refresh() {
    const loaded = await getSavedBusinesses();
    setSaves(loaded);
  }

  useEffect(() => {
    let ignore = false;
    getSavedBusinesses()
      .then((loaded) => {
        if (!ignore) {
          setSaves(loaded);
        }
      })
      .catch(() => {
        if (!ignore) {
          setSaves([]);
        }
      });
    return () => {
      ignore = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return saves
      .filter((save) => {
        if (!normalizedQuery) {
          return true;
        }

        return (
          save.symbol.toLowerCase().includes(normalizedQuery) ||
          save.companyName.toLowerCase().includes(normalizedQuery) ||
          save.notes.thesis.toLowerCase().includes(normalizedQuery)
        );
      })
      .filter((save) => {
        if (priceBandFilter === "all") {
          return true;
        }

        return save.latestResult.priceVerdict === priceBandFilter;
      })
      .filter((save) => {
        if (!selectedBigFive.size) {
          return true;
        }

        const healthyMetricIds = new Set(
          save.bigFive?.metrics
            .filter((metric) => metric.status === "healthy")
            .map((metric) => metric.id) ?? [],
        );

        return [...selectedBigFive].every((metricId) => healthyMetricIds.has(metricId));
      })
      .toSorted((a, b) => {
        if (sort === "gap") {
          return (b.gapToMos ?? -Infinity) - (a.gapToMos ?? -Infinity);
        }

        if (sort === "grade") {
          return gradeRank(a.latestResult.businessGrade) - gradeRank(b.latestResult.businessGrade);
        }

        if (sort === "symbol") {
          return a.symbol.localeCompare(b.symbol);
        }

        return b.updatedAt.localeCompare(a.updatedAt);
      });
  }, [priceBandFilter, query, saves, selectedBigFive, sort]);

  function toggleBigFiveFilter(metricId: BigFiveMetric["id"]) {
    setSelectedBigFive((current) => {
      const next = new Set(current);
      if (next.has(metricId)) {
        next.delete(metricId);
      } else {
        next.add(metricId);
      }
      return next;
    });
  }

  async function handleDelete(id: string) {
    await deleteSavedBusiness(id);
    await refresh();
    setMessage("Saved business removed.");
  }

  async function handleExport() {
    const data = await exportWorkspace();
    downloadWorkspaceJson(data);
    setMessage("Workspace exported.");
  }

  return (
    <div className="stack">
      <section className="panel">
        <div className="split">
          <div>
            <h1 className="title">Saves</h1>
            <p className="muted" style={{ margin: "4px 0 0" }}>
              Browser-stored businesses with Rule #1 grade, valuation, and thesis.
            </p>
          </div>
          <button className="button" type="button" onClick={handleExport}>
            <Download size={16} />
            Export JSON
          </button>
        </div>
      </section>

      <section className="panel stack">
        <div className="saves-controls">
          <div className="search-input-wrap compact">
            <Search size={16} />
            <input
              className="search-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter saved businesses"
              aria-label="Filter saved businesses"
            />
          </div>
          <select className="compact-select" value={sort} onChange={(event) => setSort(event.target.value as SaveSort)}>
            <option value="gap">Sort by gap to MOS</option>
            <option value="grade">Sort by business grade</option>
            <option value="reviewed">Sort by last reviewed</option>
            <option value="symbol">Sort by ticker/name</option>
          </select>
        </div>
        <div className="filter-block">
          <div className="label">Price</div>
          <div className="row wrap">
            {priceBandFilters.map((item) => (
              <button
                className={`segmented-button ${priceBandFilter === item.id ? "active" : ""}`}
                type="button"
                key={item.id}
                onClick={() => setPriceBandFilter(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div className="filter-block">
          <div className="label">Big Five</div>
          <div className="row wrap">
            {bigFiveFilters.map((item) => (
              <button
                className={`segmented-button ${selectedBigFive.has(item.id) ? "active" : ""}`}
                type="button"
                key={item.id}
                onClick={() => toggleBigFiveFilter(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        {message ? <span className="pill info">{message}</span> : null}
      </section>

      <section className="panel">
        {filtered.length ? (
          <div className="table-wrap">
            <table className="table saves-table">
              <thead>
                <tr>
                  <th>Ticker</th>
                  <th>Grade</th>
                  <th>Verdict</th>
                  <th>Current</th>
                  <th>MOS</th>
                  <th>Sticker</th>
                  <th>Gap</th>
                  <th>Last reviewed</th>
                  <th>Thesis</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((save) => (
                  <tr key={save.id}>
                    <td>
                      <strong>{save.symbol}</strong>
                      <div className="subtle">{save.companyName}</div>
                    </td>
                    <td>
                      <BusinessGradePill grade={save.latestResult.businessGrade} />
                      <div className="subtle">
                        {save.bigFive ? `${save.bigFive.healthyCount}/${save.bigFive.totalCount} Big Five` : "Big Five not saved"}
                      </div>
                    </td>
                    <td>
                      <PriceVerdictPill verdict={save.latestResult.priceVerdict} />
                    </td>
                    <td>{formatCurrency(save.currentPrice)}</td>
                    <td>{formatCurrency(save.mosPrice)}</td>
                    <td>{formatCurrency(save.stickerPrice)}</td>
                    <td>{formatPercent(save.gapToMos)}</td>
                    <td>{formatDate(save.updatedAt)}</td>
                    <td>{save.notes.thesis || <span className="subtle">No thesis yet.</span>}</td>
                    <td>
                      <div className="row">
                        <a className="icon-button" href={`/?symbol=${encodeURIComponent(save.symbol)}`} aria-label={`Open ${save.symbol}`}>
                          <ExternalLink size={16} />
                        </a>
                        <button className="icon-button" type="button" aria-label={`Remove ${save.symbol}`} onClick={() => handleDelete(save.id)}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-list">
            <h2 className="section-title">No saved businesses yet.</h2>
            <p className="muted">Search a business, review the result, and save it locally.</p>
          </div>
        )}
      </section>
    </div>
  );
}
