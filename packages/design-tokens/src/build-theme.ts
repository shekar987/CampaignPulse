import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { renderThemeCss } from "./theme-css";

const target = new URL("../theme.css", import.meta.url);
writeFileSync(target, renderThemeCss(), "utf8");
console.log(`Wrote ${fileURLToPath(target)}`);
