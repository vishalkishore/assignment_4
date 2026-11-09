import { useEffect, useState } from "react";

const worker = new Worker("/pyworker.js");
const pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
const statusListeners = new Set<(s: string) => void>();
let lastStatus = "Waking the harbor (Python runtime)";
let nextId = 0;

worker.onmessage = ({ data }) => {
  if (data.status) {
    lastStatus = data.status === "failed" ? `failed: ${data.error}` : data.status;
    statusListeners.forEach((l) => l(lastStatus));
    return;
  }
  const p = pending.get(data.id);
  if (!p) return;
  pending.delete(data.id);
  data.error ? p.reject(new Error(data.error)) : p.resolve(data.result);
};

/** Call a function in src/auto/api.py; it runs in Pyodide in a worker. */
export function py<T = any>(fn: string, ...args: unknown[]): Promise<T> {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker.postMessage({ id, fn, args });
  });
}

export function usePyStatus() {
  const [status, setStatus] = useState(lastStatus);
  useEffect(() => {
    statusListeners.add(setStatus);
    return () => void statusListeners.delete(setStatus);
  }, []);
  return status;
}

// recent results, so going back to a screen does not re-run its simulations
const cache = new Map<string, Promise<any>>();
function cached<T>(fn: string, args: unknown[]): Promise<T> {
  const key = fn + JSON.stringify(args);
  let p = cache.get(key);
  if (!p) {
    p = py<T>(fn, ...args);
    p.catch(() => cache.delete(key));
    cache.set(key, p);
    if (cache.size > 10) cache.delete(cache.keys().next().value!);
  }
  return p;
}

/** Re-runs the Python call whenever deps change; returns null while computing.
 *  Pass fn = null to skip the call until its inputs are ready. */
export function usePy<T = any>(fn: string | null, args: unknown[]): T | null {
  const [data, setData] = useState<T | null>(null);
  const key = JSON.stringify(args);
  useEffect(() => {
    let live = true;
    setData(null);
    if (fn) cached<T>(fn, args).then((d) => live && setData(d));
    return () => void (live = false);
  }, [fn, key]);
  return data;
}
