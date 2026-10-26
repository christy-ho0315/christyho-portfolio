import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const input = join(root, "raw-assets", "MyPortfolio");
const output = join(root, "public", "portfolio");
const dataOut = join(root, "src", "data", "assets.ts");
const imageExts = new Set([".jpg", ".jpeg", ".png"]);

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    if (name === ".DS_Store") return [];
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

function slug(value) {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

if (!existsSync(input)) throw new Error("Missing raw-assets/MyPortfolio");
rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
const files = walk(input);
const assets = [];
let index = 0;

for (const file of files) {
  const rel = relative(input, file);
  const parts = rel.split("/");
  const ext = extname(file).toLowerCase();
  const kind = parts[0];
  const groupParts = parts.slice(1, -1).filter(Boolean);
  const collection = groupParts.join(" — ") || "Selected Work";
  const id = `${slug(kind)}-${String(index++).padStart(3, "0")}-${slug(basename(file, ext)).slice(0, 50)}`;
  if (imageExts.has(ext)) {
    const categoryDir = join(output, slug(kind));
    mkdirSync(categoryDir, { recursive: true });
    const dest = join(categoryDir, `${id}.jpg`);
    execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "78", "-Z", "1800", file, "--out", dest], { stdio: "ignore" });
    assets.push({ id, kind, collection, title: basename(file, ext), src: `/portfolio/${slug(kind)}/${id}.jpg`, original: rel });
  } else if (ext === ".pdf") {
    const docDir = join(output, "documents");
    const previewDir = join(output, "previews");
    mkdirSync(docDir, { recursive: true });
    mkdirSync(previewDir, { recursive: true });
    const pdfName = `${id}.pdf`;
    copyFileSync(file, join(docDir, pdfName));
    const prefix = join(previewDir, id);
    execFileSync("pdftoppm", ["-f", "1", "-singlefile", "-jpeg", "-scale-to", "1800", "-jpegopt", "quality=82", file, prefix], { stdio: "ignore" });
    assets.push({ id, kind, collection, title: basename(file, ext), src: `/portfolio/previews/${id}.jpg`, document: `/portfolio/documents/${pdfName}`, original: rel });
  }
}

mkdirSync(dirname(dataOut), { recursive: true });
writeFileSync(dataOut, `export type PortfolioAsset = { id: string; kind: string; collection: string; title: string; src: string; document?: string; original: string };\n\nexport const portfolioAssets: PortfolioAsset[] = ${JSON.stringify(assets, null, 2)};\n`);
console.log(`Prepared ${assets.length} assets.`);
