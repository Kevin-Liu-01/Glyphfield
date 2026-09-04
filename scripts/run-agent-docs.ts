#!/usr/bin/env npx tsx
/**
 * Agent-Docs Mesh shim — forwards to the canonical kit in kevin-wiki.
 * Override: KEVIN_WIKI_ROOT=/path/to/kevin-wiki
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

const wikiRootCandidates = [
  process.env.KEVIN_WIKI_ROOT,
  join(homedir(), "Documents/GitHub/kevin-wiki"),
  join(homedir(), "repos/Kevin-Wiki-v3"),
].filter((value): value is string => Boolean(value));
const wikiRoot = wikiRootCandidates.find((value) =>
  existsSync(join(value, "scripts/agent-docs/index.ts")),
) ?? wikiRootCandidates[0]!;
const kit = join(wikiRoot, "scripts/agent-docs/index.ts");

if (!existsSync(kit)) {
  console.error(
    `agent-docs: kit not found at ${kit}. Set KEVIN_WIKI_ROOT or vendor scripts/agent-docs/.`,
  );
  process.exit(2);
}

const forwardedArgs = process.argv.slice(2);
if (forwardedArgs[0] === "--") forwardedArgs.shift();
if (forwardedArgs[1] && !forwardedArgs[1].startsWith("-") && !isAbsolute(forwardedArgs[1])) {
  forwardedArgs[1] = resolve(process.cwd(), forwardedArgs[1]);
}

const r = spawnSync(
  "npm",
  ["run", "agent-docs", "--", ...forwardedArgs],
  { cwd: wikiRoot, stdio: "inherit" },
);
process.exit(r.status ?? 1);
