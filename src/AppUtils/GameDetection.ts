/* Copyright Elysia © 2025. All rights reserved */

import { execFile } from "child_process";
import { net } from "electron";
import { scope } from "electron-log";
import Constants from "src/AppCore/Constants";

const logger = scope("GameDetection");

type DetectableExecutable = {
    name: string;
    os: string;
    is_launcher?: boolean;
};

type DetectableGame = {
    id: string;
    name: string;
    executables?: DetectableExecutable[];
};

export type RunningGame = {
    id: string;
    name: string;
    pid: number;
    processName: string;
    exeName: string;
    exePath: string;
    start: number;
    isLauncher: boolean;
    hidden: boolean;
    elevated: boolean;
    distributor: null;
    cmdLine: string;
    pidPath: number[];
};

/**
 * Discord detects games with a native module that walks the process list. There is
 * none here, so the running processes are listed with the platform's own tools and
 * matched against Discord's public catalogue of detectable games.
 */
export class GameDetection {
    /** Executable name (lowercase) -> game */
    static catalogue = new Map<string, { game: DetectableGame; isLauncher: boolean }>();
    static catalogueLoadedAt = 0;
    static running = new Map<number, RunningGame>();
    static timer: NodeJS.Timeout | null = null;
    static onChange: ((games: RunningGame[], added: RunningGame[], removed: RunningGame[]) => void) | null = null;

    static async loadCatalogue () {
        // The catalogue barely moves: refresh it once a day at most
        if (UserCatalogueIsFresh()) return;
        try {
            const res = await net.fetch(`https://${Constants.AuthDomain}/api/v9/applications/detectable`, {
                headers: { "user-agent": Constants.UserAgentBrowser },
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const games = (await res.json()) as DetectableGame[];
            const catalogue = new Map<string, { game: DetectableGame; isLauncher: boolean }>();
            for (const game of games) {
                for (const executable of game.executables ?? []) {
                    if (executable.os !== GameDetection.osName()) continue;
                    // Entries look like "steam/game.exe" or just "game.exe"
                    const name = executable.name.split(/[\\/]/).pop()?.toLowerCase();
                    if (!name) continue;
                    if (!catalogue.has(name)) {
                        catalogue.set(name, { game, isLauncher: Boolean(executable.is_launcher) });
                    }
                }
            }
            GameDetection.catalogue = catalogue;
            GameDetection.catalogueLoadedAt = Date.now();
            logger.info(`Catalogue de jeux chargé: ${catalogue.size} exécutables reconnus`);
        } catch (e) {
            logger.error("Impossible de charger le catalogue de jeux:", e);
        }
    }

    static osName () {
        if (process.platform === "win32") return "win32";
        if (process.platform === "darwin") return "darwin";
        return "linux";
    }

    /** Current processes as [pid, executable name] */
    static listProcesses (): Promise<[number, string][]> {
        return new Promise(resolve => {
            if (process.platform === "win32") {
                execFile(
                    "tasklist",
                    ["/fo", "csv", "/nh"],
                    { windowsHide: true, maxBuffer: 8 * 1024 * 1024 },
                    (error, stdout) => {
                        if (error) {
                            logger.debug("tasklist a échoué:", error.message);
                            return resolve([]);
                        }
                        const processes: [number, string][] = [];
                        for (const line of stdout.split(/\r?\n/)) {
                            // "name.exe","1234","Console","1","12 345 K"
                            const match = /^"([^"]+)","(\d+)"/.exec(line);
                            if (match) processes.push([Number(match[2]), match[1].toLowerCase()]);
                        }
                        resolve(processes);
                    },
                );
                return;
            }
            execFile("ps", ["-eo", "pid=,comm="], { maxBuffer: 8 * 1024 * 1024 }, (error, stdout) => {
                if (error) return resolve([]);
                const processes: [number, string][] = [];
                for (const line of stdout.split("\n")) {
                    const match = /^\s*(\d+)\s+(.+)$/.exec(line);
                    if (match) {
                        const name = match[2].split("/").pop()?.trim().toLowerCase();
                        if (name) processes.push([Number(match[1]), name]);
                    }
                }
                resolve(processes);
            });
        });
    }

    static async scan () {
        await GameDetection.loadCatalogue();
        if (!GameDetection.catalogue.size) return;

        const processes = await GameDetection.listProcesses();
        const seen = new Map<number, RunningGame>();

        for (const [pid, processName] of processes) {
            const entry = GameDetection.catalogue.get(processName);
            if (!entry) continue;
            const existing = GameDetection.running.get(pid);
            seen.set(
                pid,
                existing ?? {
                    id: entry.game.id,
                    name: entry.game.name,
                    pid,
                    processName,
                    exeName: processName,
                    exePath: processName,
                    start: Date.now(),
                    isLauncher: entry.isLauncher,
                    hidden: false,
                    elevated: false,
                    distributor: null,
                    cmdLine: processName,
                    pidPath: [pid],
                },
            );
        }

        const added: RunningGame[] = [];
        const removed: RunningGame[] = [];
        for (const [pid, game] of seen) {
            if (!GameDetection.running.has(pid)) added.push(game);
        }
        for (const [pid, game] of GameDetection.running) {
            if (!seen.has(pid)) removed.push(game);
        }
        GameDetection.running = seen;

        if (!added.length && !removed.length) return;
        const games = [...seen.values()];
        logger.info(
            `Jeux en cours: ${games.map(g => g.name).join(", ") || "aucun"}` +
                (added.length ? ` (+${added.map(g => g.name).join(", ")})` : "") +
                (removed.length ? ` (-${removed.map(g => g.name).join(", ")})` : ""),
        );
        GameDetection.onChange?.(games, added, removed);
    }

    /**
     * Listing the processes is the only part of Nebula that costs anything while the user
     * does nothing, so it runs as rarely as it can: once a minute, and not at all while no
     * client window is on screen, since nobody can see the activity it would publish.
     */
    static shouldScan: () => boolean = () => true

    static start (
        onChange: (games: RunningGame[], added: RunningGame[], removed: RunningGame[]) => void,
        shouldScan: () => boolean = () => true,
    ) {
        GameDetection.onChange = onChange;
        GameDetection.shouldScan = shouldScan;
        if (GameDetection.timer) return;
        const tick = () => {
            if (!GameDetection.shouldScan()) return;
            GameDetection.scan().catch(e => logger.error("Analyse des processus échouée:", e));
        };
        tick();
        GameDetection.timer = setInterval(tick, 60_000);
        GameDetection.timer.unref?.();
    }

    static stop () {
        if (GameDetection.timer) clearInterval(GameDetection.timer);
        GameDetection.timer = null;
        GameDetection.running.clear();
    }

    static snapshot () {
        return [...GameDetection.running.values()];
    }
}

function UserCatalogueIsFresh () {
    return GameDetection.catalogue.size > 0 && Date.now() - GameDetection.catalogueLoadedAt < 24 * 60 * 60 * 1000;
}

export default GameDetection;
