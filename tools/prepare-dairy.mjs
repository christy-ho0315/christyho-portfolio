import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const input = join(root, "raw-assets", "Dairy");
const output = join(root, "public", "dairy");
const dataOut = join(root, "src", "data", "dairy.ts");

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    if (name === ".DS_Store") return [];
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

if (!existsSync(input)) throw new Error("Missing raw-assets/Dairy");
rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
const sources = walk(input).filter((file) => /\.(jpe?g|png)$/i.test(file));
const items = sources.map((file, index) => {
  const year = file.includes("/2024/") ? "2024" : file.includes("/2025/") ? "2025" : "2026";
  const id = `dairy-${year}-${String(index + 1).padStart(2, "0")}`;
  const dest = join(output, `${id}.jpg`);
  execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "80", "-Z", "1600", file, "--out", dest], { stdio: "ignore" });
  return { id, year, src: `/dairy/${id}.jpg`, alt: `Diary photograph from ${year}: ${basename(file, extname(file))}` };
});

writeFileSync(dataOut, `export const dairyImages = ${JSON.stringify(items, null, 2)} as const;\n`);
console.log(`Prepared ${items.length} diary images.`);
