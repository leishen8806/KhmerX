#!/usr/bin/env node
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const roots = ["app", "components", "lib", "khmerx-website"];
const ignored = new Set(["node_modules", ".next", "dist", ".git"]);
const extensions = new Set([".ts", ".tsx", ".js", ".jsx", ".html", ".css"]);
const chinese = /[\u4e00-\u9fff]/;
const hits = [];

async function walk(dir) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    if (ignored.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await walk(path);
    else if (extensions.has(path.slice(path.lastIndexOf(".")))) {
      const text = await readFile(path, "utf8");
      text.split(/\r?\n/).forEach((line, index) => {
        if (chinese.test(line)) hits.push({ path: relative(process.cwd(), path), line: index + 1, text: line.trim() });
      });
    }
  }
}

for (const root of roots) await walk(root);
const byFile = new Map();
for (const hit of hits) byFile.set(hit.path, (byFile.get(hit.path) ?? 0) + 1);
console.log(`Chinese-containing lines: ${hits.length}`);
console.log(`Files: ${byFile.size}`);
for (const [path, count] of [...byFile.entries()].sort()) console.log(`${count}\t${path}`);
if (process.argv.includes("--lines")) {
  console.log("\nLines:");
  for (const hit of hits) console.log(`${hit.path}:${hit.line}: ${hit.text}`);
}
