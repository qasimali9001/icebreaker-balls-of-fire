import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { validateLevelSolvability } from "../src/validation/levelSolver.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const levelsDir = path.join(__dirname, "..", "src", "levels");

const files = fs.readdirSync(levelsDir).filter((f) => f.endsWith(".json"));
let failed = false;

for (const f of files.sort()) {
  const full = path.join(levelsDir, f);
  const data = JSON.parse(fs.readFileSync(full, "utf8"));
  const res = validateLevelSolvability(data);
  if (res.solvable) {
    console.log(`OK  ${f}  (${res.iceCount} ice)`);
  } else {
    console.error(`FAIL ${f}  — ${res.reason}`);
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}
