// Assembles the Worker's static files: the web game build plus the landing pages.
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
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
console.log(`Edge assets ready in ${out}`);
