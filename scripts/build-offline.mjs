import { build } from "esbuild";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, writeFile } from "node:fs/promises";
const root = fileURLToPath(new URL("../", import.meta.url));
const output = resolve(
  process.argv[2] ?? resolve(root, "../mench-artifacts/mench-offline.html"),
);
await mkdir(dirname(output), { recursive: true });
const result = await build({
  stdin: {
    resolveDir: resolve(root, "apps/web"),
    sourcefile: "standalone.tsx",
    loader: "tsx",
    contents: `
import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Practice} from './src/Practice';
import {messages} from './src/messages';
import './src/style.css';
function App(){const[locale,setLocale]=useState('fa');const t=messages[locale];return <main dir={locale==='fa'?'rtl':'ltr'} lang={locale}><header><div><h1>{t.brand}<span className="brand-dot">✦</span></h1><p>{t.tagline}</p></div><button className="language" onClick={()=>{const next=locale==='fa'?'en':'fa';setLocale(next);document.documentElement.lang=next;document.documentElement.dir=next==='fa'?'rtl':'ltr';}}>{t.language}</button></header><Practice t={t}/><footer>{t.rules} · {t.practice}</footer></main>;}createRoot(document.getElementById('root')).render(<App/>);
`,
  },
  bundle: true,
  format: "iife",
  platform: "browser",
  jsx: "automatic",
  minify: true,
  define: { "process.env.NODE_ENV": '"production"' },
  outfile: resolve(dirname(output), "mench-offline.js"),
  write: false,
});
const js = result.outputFiles
  .find((f) => f.path.endsWith(".js"))
  .text.replaceAll("</script", "<\\/script");
const css = result.outputFiles.find((f) => f.path.endsWith(".css")).text;
await writeFile(
  output,
  `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>منچ — بازی روی یک دستگاه</title><style>${css}</style></head><body><div id="root"></div><script>${js}</script></body></html>`,
);
console.log("Created self-contained practice game HTML.");
