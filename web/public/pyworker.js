// Runs the Python backend in Pyodide, off the main thread.
// Messages in:  { id, fn, args }   Messages out: { id, result } | { id, error } | { status }
importScripts("https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js");

const FILES = ["second_price.py", "first_price.py", "vcg.py", "api.py"];

const ready = (async () => {
  postMessage({ status: "Waking the harbor (Python runtime)" });
  const pyodide = await loadPyodide();
  postMessage({ status: "Loading numpy" });
  await pyodide.loadPackage("numpy");
  postMessage({ status: "Opening the auction house" });
  pyodide.FS.mkdirTree("/home/pyodide/auto");
  pyodide.FS.writeFile("/home/pyodide/auto/__init__.py", "");
  for (const f of FILES) {
    const src = await (await fetch(`py/${f}`)).text();
    pyodide.FS.writeFile(`/home/pyodide/auto/${f}`, src);
  }
  pyodide.runPython("import sys; sys.path.insert(0, '/home/pyodide')");
  return pyodide.pyimport("auto.api");
})();

ready.then(
  () => postMessage({ status: "ready" }),
  (e) => postMessage({ status: "failed", error: String(e) }),
);

onmessage = async ({ data: { id, fn, args } }) => {
  try {
    const api = await ready;
    postMessage({ id, result: JSON.parse(api[fn](...args)) });
  } catch (e) {
    postMessage({ id, error: String(e) });
  }
};
