"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Download, Settings, Trash2, Upload, X } from "lucide-react";
import { ReactNode, useRef, useState } from "react";
import {
  clearWorkspaceData,
  downloadWorkspaceJson,
  exportWorkspace,
  importWorkspace,
} from "@/lib/storage";
import type { WorkspaceExport } from "@/lib/types";

const navItems = [
  { href: "/", label: "Search" },
  { href: "/saves", label: "Saves" },
  { href: "/docs", label: "Docs" },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="app-shell">
      <header className="top-bar">
        <Link className="brand" href="/">
          <span className="brand-mark" aria-hidden="true">
            #1
          </span>
          Rule One
        </Link>
        <nav className="top-nav" aria-label="Primary">
          {navItems.map((item) => (
            <Link
              key={item.href}
              className={`nav-link ${isActive(pathname, item.href) ? "active" : ""}`}
              href={item.href}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="top-actions">
          <button
            className="icon-button"
            type="button"
            aria-label="Settings"
            title="Settings"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings size={17} />
          </button>
        </div>
      </header>

      <main className="main">{children}</main>

      <nav className="bottom-nav" aria-label="Primary mobile">
        {navItems.map((item) => (
          <Link
            key={item.href}
            className={`nav-link ${isActive(pathname, item.href) ? "active" : ""}`}
            href={item.href}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {settingsOpen ? <SettingsDialog onClose={() => setSettingsOpen(false)} /> : null}
    </div>
  );
}

function SettingsDialog({ onClose }: { onClose: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");

  async function handleExport() {
    const workspace = await exportWorkspace();
    downloadWorkspaceJson(workspace);
    setMessage("Workspace exported.");
  }

  async function handleImport(file: File | undefined) {
    if (!file) {
      return;
    }

    const text = await file.text();
    const data = JSON.parse(text) as WorkspaceExport;
    await importWorkspace(data);
    setMessage("Workspace imported. Refresh Saves if it is already open.");
  }

  async function handleClear() {
    await clearWorkspaceData();
    setMessage("Local workspace cleared.");
  }

  return (
    <div className="settings-dialog" role="dialog" aria-modal="true" aria-label="Settings">
      <div className="settings-card stack">
        <div className="split">
          <div>
            <h2 className="title">Settings</h2>
            <p className="muted" style={{ margin: "4px 0 0" }}>
              Local defaults, workspace export, and source notes.
            </p>
          </div>
          <button className="icon-button" type="button" aria-label="Close settings" onClick={onClose}>
            <X size={17} />
          </button>
        </div>

        <div className="panel stack">
          <h3 className="section-title">Defaults</h3>
          <div className="grid two">
            <div>
              <div className="label">Required return</div>
              <div className="metric-value">15%</div>
            </div>
            <div>
              <div className="label">MOS</div>
              <div className="metric-value">50%</div>
            </div>
            <div>
              <div className="label">Years</div>
              <div className="metric-value">10</div>
            </div>
            <div>
              <div className="label">Big Five healthy</div>
              <div className="metric-value">10%+</div>
            </div>
          </div>
        </div>

        <div className="panel stack">
          <h3 className="section-title">Workspace</h3>
          <div className="row wrap">
            <button className="button" type="button" onClick={handleExport}>
              <Download size={16} />
              Export JSON
            </button>
            <button className="button" type="button" onClick={() => inputRef.current?.click()}>
              <Upload size={16} />
              Import JSON
            </button>
            <button className="button danger" type="button" onClick={handleClear}>
              <Trash2 size={16} />
              Clear
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="application/json"
              hidden
              onChange={(event) => handleImport(event.currentTarget.files?.[0])}
            />
          </div>
          {message ? <div className="pill info">{message}</div> : null}
        </div>

        <div className="panel stack">
          <h3 className="section-title">Sources</h3>
          <p className="muted" style={{ margin: 0 }}>
            SEC EDGAR provides ticker, company facts, submissions, and filing links. Stooq is tried
            first for daily prices, with Yahoo Finance public chart data as a no-key fallback.
          </p>
          <p className="subtle" style={{ margin: 0 }}>
            Educational research tool. Not financial advice. Not affiliated with Phil Town, Rule #1
            Investing, the SEC, Stooq, or any data provider.
          </p>
        </div>
      </div>
    </div>
  );
}
