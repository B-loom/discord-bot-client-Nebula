/* Copyright Elysia © 2025. All rights reserved */

/*
 * The Documentation page inside the client shows the README. Rather than keep the same
 * text in two places and let them drift, README.md is the original and this copies it
 * into the bundle before every build.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readmePath = path.join(root, "README.md");
/*
 * The documentation is written into the versioned source, not into the clone: the
 * Nebula overlay is copied over the clone right after this runs, and would otherwise
 * put the previous text back.
 */
const docsPath = path.join(root, "nebula/vencord/src/userplugins/botClient/components/docs.ts");

const readme = fs.readFileSync(readmePath, "utf8");
const docs = fs.readFileSync(docsPath, "utf8");

const start = docs.indexOf("export const README = `");
const end = docs.indexOf("export const CHANGELOG = `");
if (start < 0 || end < 0) {
    throw new Error("docs.ts no longer exposes README and CHANGELOG the expected way");
}

// The text lands inside a template literal, so the three things that would break it escape
const escaped = readme
    .split("\\").join("\\\\")
    .split("`").join("\\`")
    .split("${").join("\\${");

const next = `${docs.slice(0, start)}export const README = \`${escaped}\`;\n\n${docs.slice(end)}`;

if (next === docs) {
    console.log("Documentation déjà à jour");
} else {
    fs.writeFileSync(docsPath, next);
    console.log("Documentation synchronisée depuis README.md");
}
