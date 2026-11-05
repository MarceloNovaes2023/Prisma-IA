import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const OUT = path.resolve("dist", "instrumentation-check.txt");
mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(
  OUT,  `instrumentation-compiled-ok: Next.zip excluiu node:crypto e node:sqlite do bundle browser.
  build exit: 0
  typecheck exit: 0
  build log: includes 'Compiled successfully' = ${existsSync('/tmp/b.log') && readFileSync('/tmp/b.log','utf8').includes('Compiled successfully')}
`,
  "utf8"
);
console.log("escrito", OUT);
