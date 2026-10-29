/* Copyright Elysia © 2025 */

import { fetch } from "undici";
import path from "path";
import fs from "fs";

const guildExperiments = path.resolve(process.cwd(), "assets", "snapshot", "guild_experiments.json");

interface GuildExperimentResponse {
    rollout: unknown;
}

export default async function updateGuildExperiments(): Promise<void> {
    console.log("[Discord] Fetching Guild Experiments from Advaith's API");

    await fetch("https://api.rollouts.advaith.io/")
        .then(async r => {
            if (r.ok) {
                return (await r.json()) as GuildExperimentResponse[];
            } else {
                console.log("[Discord] Failed to fetch Guild Experiments");
                throw new Error("Failed to fetch data");
            }
        })
        .then(r => {
            fs.writeFileSync(guildExperiments, JSON.stringify(r.map(o => o.rollout)));
            console.log("[Discord] Updated Guild Experiments");
        })
        .catch(() => {
            fs.writeFileSync(guildExperiments, JSON.stringify([]));
        });
}
