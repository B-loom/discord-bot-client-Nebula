/* Copyright Elysia © 2025. All rights reserved */

/*
 * Vencord is cloned from upstream and `npm run requirement` resets it hard, so nothing
 * written inside it survives. Nebula's own plugins and its changes to Vencord's settings
 * pages therefore live in `nebula/vencord/`, which is versioned, and are laid over the
 * clone before every build. The clone stays disposable; the work does not.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const overlay = path.join(root, "nebula/vencord");
const target = path.join(root, "Vencord");

if (!fs.existsSync(overlay)) {
    throw new Error(`Le calque Nebula est introuvable : ${overlay}`);
}
if (!fs.existsSync(target)) {
    throw new Error("Vencord n'est pas installé. Lance d'abord : npm run requirement");
}

let copied = 0;

function copy(from, to) {
    for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
        const source = path.join(from, entry.name);
        const destination = path.join(to, entry.name);

        if (entry.isDirectory()) {
            fs.mkdirSync(destination, { recursive: true });
            copy(source, destination);
            continue;
        }

        // Rewriting an identical file would churn the build for nothing
        const next = fs.readFileSync(source);
        if (fs.existsSync(destination) && fs.readFileSync(destination).equals(next)) continue;

        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.writeFileSync(destination, next);
        copied++;
    }
}

copy(overlay, target);

console.log(
    copied === 0
        ? "Calque Nebula déjà en place"
        : `Calque Nebula appliqué (${copied} fichier${copied > 1 ? "s" : ""})`,
);
