"use client";

import {
  DEFAULT_BIG_FIVE_THRESHOLD,
  DEFAULT_MARGIN_OF_SAFETY,
  DEFAULT_REQUIRED_RETURN,
} from "@/lib/rule1";
import type {
  BrowserCacheRecord,
  SavedBusinessItem,
  ValuationDefaults,
  Workspace,
  WorkspaceExport,
} from "@/lib/types";

const DB_NAME = "rule-one-portfolio";
const DB_VERSION = 2;
const DEFAULT_WORKSPACE_ID = "local";

export const defaultValuationDefaults: ValuationDefaults = {
  requiredReturn: DEFAULT_REQUIRED_RETURN,
  marginOfSafety: DEFAULT_MARGIN_OF_SAFETY,
  bigFiveHealthyThreshold: DEFAULT_BIG_FIVE_THRESHOLD,
};

export const defaultWorkspace: Workspace = {
  id: DEFAULT_WORKSPACE_ID,
  name: "Local workspace",
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
  defaults: defaultValuationDefaults,
};

function hasIndexedDb() {
  return typeof window !== "undefined" && "indexedDB" in window;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!hasIndexedDb()) {
      reject(new Error("IndexedDB is not available."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("saves")) {
        const store = db.createObjectStore("saves", { keyPath: "id" });
        store.createIndex("symbol", "symbol", { unique: false });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
      }

      if (!db.objectStoreNames.contains("workspace")) {
        db.createObjectStore("workspace", { keyPath: "id" });
      }

      if (!db.objectStoreNames.contains("cache")) {
        db.createObjectStore("cache", { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(
  storeName: "saves" | "workspace" | "cache",
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const request = action(store);

    transaction.oncomplete = () => {
      db.close();
      resolve(request ? request.result : undefined);
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

export async function ensureWorkspace() {
  const existing = await getWorkspace();
  if (existing) {
    return existing;
  }

  const now = new Date().toISOString();
  const workspace = {
    ...defaultWorkspace,
    createdAt: now,
    updatedAt: now,
  };
  await saveWorkspace(workspace);
  return workspace;
}

export async function getWorkspace() {
  return withStore<Workspace>("workspace", "readonly", (store) => store.get(DEFAULT_WORKSPACE_ID));
}

export async function saveWorkspace(workspace: Workspace) {
  await withStore("workspace", "readwrite", (store) => store.put(workspace));
}

export async function getSavedBusinesses() {
  const saves =
    (await withStore<SavedBusinessItem[]>("saves", "readonly", (store) => store.getAll())) ?? [];
  return saves.toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function saveBusiness(item: SavedBusinessItem) {
  await withStore("saves", "readwrite", (store) => store.put(item));
}

export async function deleteSavedBusiness(id: string) {
  await withStore("saves", "readwrite", (store) => store.delete(id));
}

export async function clearWorkspaceData() {
  await withStore("saves", "readwrite", (store) => store.clear());
  await withStore("cache", "readwrite", (store) => store.clear());
  await saveWorkspace({
    ...defaultWorkspace,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

export async function getCacheValue<T>(key: string) {
  const record = await withStore<BrowserCacheRecord<T>>("cache", "readonly", (store) => store.get(key));
  if (!record) {
    return undefined;
  }

  if (record.expiresAt && new Date(record.expiresAt).getTime() < Date.now()) {
    await withStore("cache", "readwrite", (store) => store.delete(key));
    return undefined;
  }

  return record.value;
}

export async function setCacheValue<T>(key: string, value: T, ttlMs?: number) {
  const now = new Date();
  const record: BrowserCacheRecord<T> = {
    key,
    value,
    updatedAt: now.toISOString(),
    expiresAt: ttlMs ? new Date(now.getTime() + ttlMs).toISOString() : undefined,
  };
  await withStore("cache", "readwrite", (store) => store.put(record));
}

export async function exportWorkspace(): Promise<WorkspaceExport> {
  const workspace = (await ensureWorkspace()) ?? defaultWorkspace;
  const saves = await getSavedBusinesses();

  return {
    exportedAt: new Date().toISOString(),
    workspace,
    saves,
  };
}

export async function importWorkspace(workspaceExport: WorkspaceExport) {
  await saveWorkspace({
    ...workspaceExport.workspace,
    updatedAt: new Date().toISOString(),
  });

  await withStore("saves", "readwrite", (store) => {
    store.clear();
    workspaceExport.saves.forEach((save) => store.put(save));
  });
}

export function makeSavedBusinessId(symbol: string) {
  return `${DEFAULT_WORKSPACE_ID}:${symbol.toUpperCase()}`;
}

export function downloadWorkspaceJson(workspaceExport: WorkspaceExport) {
  const blob = new Blob([JSON.stringify(workspaceExport, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `rule-one-workspace-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
