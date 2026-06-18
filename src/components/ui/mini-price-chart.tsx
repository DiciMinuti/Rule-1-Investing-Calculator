"use client";

import { useMemo, useState } from "react";
import type { PricePoint } from "@/lib/types";
import { formatCurrency, formatDate, formatPercent } from "@/lib/format";

const rangeOptions = [
  { label: "1Y", days: 260 },
  { label: "3Y", days: 780 },
  { label: "5Y", days: 1300 },
  { label: "10Y", days: 2600 },
  { label: "Max", days: 0 },
];

function pointPath(points: PricePoint[], width: number, height: number, min: number, spread: number) {
  return points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * width;
      const y = height - ((point.close - min) / spread) * height;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

export function MiniPriceChart({ points, sourceLabel }: { points: PricePoint[]; sourceLabel?: string }) {
  const [selectedRange, setSelectedRange] = useState("5Y");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const range = rangeOptions.find((option) => option.label === selectedRange) ?? rangeOptions[2];
  const chartPoints = useMemo(
    () => (range.days > 0 ? points.slice(-range.days) : points),
    [points, range.days],
  );

  if (chartPoints.length < 2) {
    return <div className="chart-empty">Price chart unavailable.</div>;
  }

  const width = 920;
  const height = 260;
  const padding = 18;
  const innerHeight = height - padding * 2;
  const min = Math.min(...chartPoints.map((point) => point.close));
  const max = Math.max(...chartPoints.map((point) => point.close));
  const spread = max - min || 1;
  const path = pointPath(chartPoints, width, innerHeight, min, spread);
  const first = chartPoints[0];
  const latest = chartPoints.at(-1) as PricePoint;
  const change = first.close ? latest.close / first.close - 1 : 0;
  const hoverPoint = hoverIndex === null ? latest : chartPoints[hoverIndex];
  const hoverX = hoverIndex === null ? width : (hoverIndex / (chartPoints.length - 1)) * width;
  const hoverY = padding + innerHeight - ((hoverPoint.close - min) / spread) * innerHeight;

  function updateHover(clientX: number, currentTarget: SVGSVGElement) {
    const rect = currentTarget.getBoundingClientRect();
    const rawX = Math.min(Math.max(clientX - rect.left, 0), rect.width);
    const nextIndex = Math.round((rawX / rect.width) * (chartPoints.length - 1));
    setHoverIndex(nextIndex);
  }

  return (
    <div className="price-panel">
      <div className="price-panel-header">
        <div className="stack compact-gap">
          <div className="label">Price history</div>
          <div className="price-readout">
            <strong>{formatCurrency(hoverPoint.close)}</strong>
            <span className="muted">{formatDate(hoverPoint.date)}</span>
          </div>
        </div>
        <div className="chart-range-controls" aria-label="Price chart range">
          {rangeOptions.map((option) => (
            <button
              className={`segmented-button ${selectedRange === option.label ? "active" : ""}`}
              key={option.label}
              type="button"
              onClick={() => {
                setSelectedRange(option.label);
                setHoverIndex(null);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <svg
        className="mini-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${selectedRange} price history`}
        onMouseLeave={() => setHoverIndex(null)}
        onMouseMove={(event) => updateHover(event.clientX, event.currentTarget)}
        onTouchMove={(event) => {
          const touch = event.touches[0];
          if (touch) {
            updateHover(touch.clientX, event.currentTarget);
          }
        }}
      >
        <line x1="0" x2={width} y1={padding} y2={padding} className="chart-grid-line" />
        <line x1="0" x2={width} y1={height / 2} y2={height / 2} className="chart-grid-line" />
        <line x1="0" x2={width} y1={height - padding} y2={height - padding} className="chart-grid-line" />
        <path
          d={path}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          transform={`translate(0 ${padding})`}
          vectorEffect="non-scaling-stroke"
        />
        <line x1={hoverX} x2={hoverX} y1={padding} y2={height - padding} className="chart-hover-line" />
        <circle cx={hoverX} cy={hoverY} r="4" className="chart-hover-dot" />
      </svg>
      <div className="chart-stats">
        <span>Low {formatCurrency(min)}</span>
        <span>High {formatCurrency(max)}</span>
        <span className={change >= 0 ? "good-text" : "bad-text"}>{selectedRange} {formatPercent(change)}</span>
        {sourceLabel ? <span>{sourceLabel}</span> : null}
      </div>
    </div>
  );
}
