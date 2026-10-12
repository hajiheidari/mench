// Assembles the Worker's static files: the web game build plus the landing pages.
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const web = join(here, "../web/dist");
const out = join(here, "dist");
if (!existsSync(join(web, "index.html")))
  throw new Error("Build the web app first: npm run build -w @mench/web");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(web, out, { recursive: true });
cpSync(join(here, "site"), out, { recursive: true });

// files.json (every file with its sha256) lets the espadna.ir mirror copy the
// game (mench.espadna.com) and the landing pages (espadna.com/mench-app).
function manifest(root, skip = () => false) {
  const files = [];
  const walk = (dir, prefix) => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const rel = prefix + entry.name;
      if (skip(rel)) continue;
      if (entry.isDirectory()) walk(join(dir, entry.name), rel + "/");
      else if (rel !== "files.json") {
        const data = readFileSync(join(dir, entry.name));
        const sha256 = createHash("sha256").update(data).digest("hex");
        files.push({ path: rel, size: data.length, sha256 });
      }
    }
  };
  walk(root, "");
  const version = createHash("sha256")
    .update(files.map((f) => f.sha256).join(""))
    .digest("hex")
    .slice(0, 12);
  writeFileSync(
    join(root, "files.json"),
    JSON.stringify({ version, files, redirects: "" }),
  );
  return files.length;
}
const game = manifest(out, (rel) => rel === "mench-app");
const landing = manifest(join(out, "mench-app"));
console.log(
  `Edge assets ready in ${out} (files.json: game ${game}, landing ${landing})`,
);
