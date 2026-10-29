/* Copyright Elysia © 2025 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const cloneDir = path.join(".", "Vencord");
const userPluginDir = path.join(cloneDir, "src", "userplugins", "botClient");

function runCommand(command: string, cwd?: string) {
    execSync(command, {
        stdio: "inherit",
        cwd,
    });
}

(async () => {
    // Clone or update Vencord
    if (!fs.existsSync(cloneDir)) {
        console.log("> Cloning Vendicated/Vencord...");
        runCommand(`git clone --depth 1 https://github.com/Vendicated/Vencord.git ${cloneDir}`);
        console.log("> Vencord clone complete.");
    } else {
        console.log("> Vencord already exists, updating main branch...");
        try {
            runCommand("git fetch origin main", cloneDir);
            runCommand("git reset --hard origin/main", cloneDir);
            console.log("> Vencord updated to latest main.");
        } catch (err) {
            console.error("> Failed to update Vencord:", err);
        }
    }

    // Clone user plugin only if not exists
    if (!fs.existsSync(userPluginDir)) {
        console.log("> Cloning aiko-chan-ai/VencordDBCPlugin...");
        runCommand(`git clone --depth 1 https://github.com/aiko-chan-ai/VencordDBCPlugin.git ${userPluginDir}`);
        console.log("> VencordDBCPlugin clone complete.");
    } else {
        console.log("> VencordDBCPlugin already exists, skipping clone.");
    }

    // Install dependencies
    console.log("> Installing Vencord dependencies...");
    runCommand("npx pnpm install --frozen-lockfile", cloneDir);
    console.log("> Vencord dependencies installed.");
})();
