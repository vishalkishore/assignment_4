// Copies the Python backend into public/py so Pyodide can load it in the browser.
// The Python in ../src/auto stays the single source of truth.
import { copyFileSync, mkdirSync } from "node:fs";

const files = ["second_price.py", "first_price.py", "vcg.py", "api.py"];
mkdirSync("public/py", { recursive: true });
for (const f of files) copyFileSync(`../src/auto/${f}`, `public/py/${f}`);
console.log(`synced ${files.length} python files to public/py`);
