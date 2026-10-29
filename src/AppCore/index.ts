/* Copyright Elysia © 2025. All rights reserved */

import { randomUUID } from "crypto";
import {
    app,
    BrowserWindow,
    dialog,
    ipcMain,
    Menu,
    MessageChannelMain,
    Notification,
    NotificationConstructorOptions,
    powerMonitor,
    protocol,
    screen,
    session,
    shell,
    systemPreferences,
    Tray,
} from "electron";
import contextMenu from "electron-context-menu";
import { scope } from "electron-log";
import { autoUpdater } from "electron-updater";
import EventEmitter from "events";
import path from "path";
import GameDetection from "src/AppUtils/GameDetection";
import Util from "src/AppUtils/Utils";

import server from "./APIServer";
import GlobalConfig from "./Config";
import Constants from "./Constants";
import { IPCEvent } from "./IPCEvents";
import { setupIPCEvents } from "./IPCManager";
import messageEditor from "./MessageEditorServer";
import UserAuth from "./UserAuth";

/**
 * Discord asks its own CDN for the system user's pictures, Nebula's badge and the two
 * emojis used by the welcome buttons. None of them exist there, so each request is
 * answered with a file shipped alongside the app.
 */
function brandingFileFor (url: string) {
    if (url.includes("/badge-icons/")) return "nebula-badge.png";
    if (url.includes("/avatars/")) return "sakura-avatar.webp";
    if (url.includes("/banners/")) return "sakura-banner.webp";
    if (url.includes(`/emojis/${Constants.DiscordEmojiId}`)) return "discord-logo.svg";
    if (url.includes(`/emojis/${Constants.GithubEmojiId}`)) return "github-logo.svg";
    return null;
}

export class DiscordBotClient extends EventEmitter {
    logger = scope(Constants.AppName);
    #shouldQuitApp = false;
    win!: BrowserWindow;
    tray!: Tray;
    port!: number;
    customSession?: Electron.Session;
    childWindows = new Map<string, BrowserWindow>();
    editorWindow?: BrowserWindow;
    accountWindow?: BrowserWindow;
    /** One extra client window per account, keyed by account id */
    accountWindows = new Map<string, BrowserWindow>();
    /** The client window that asked for the login window, and that the account belongs to */
    accountLoginTarget?: BrowserWindow;
    config = GlobalConfig;
    ipcMain = ipcMain;

    // Beta Features
    messageEditorPort!: number;

    constructor () {
        super();
        this.logger.log("App starting...");
        this.initApp();
    }
    initTray (menu: Electron.Menu) {
        if (!this.tray) {
            this.tray = new Tray(Constants.icon16);
        }
        this.tray.setToolTip(`${Constants.AppName} v${app.getVersion()}`);
        this.tray.on("click", () => {
            this.win.show();
        });
        this.tray.setContextMenu(menu);
    }
    /** Saved accounts for the tray, split between real accounts and bots */
    savedAccountsMenu (): Electron.MenuItemConstructorOptions[] {
        if (!UserAuth.accounts.length) {
            return [{ label: "Aucun compte enregistré", enabled: false }];
        }
        const entry = (account: { username: string; token: string }) => ({
            label: `${account.username} — nouvelle fenêtre`,
            click: () => {
                this.openClientWindow(account.token);
            },
        });
        const users = UserAuth.accounts.filter(account => !account.bot);
        const bots = UserAuth.accounts.filter(account => account.bot);
        const menu: Electron.MenuItemConstructorOptions[] = [];
        if (users.length) {
            menu.push({ label: "Comptes utilisateurs", enabled: false }, ...users.map(entry));
        }
        if (bots.length) {
            if (menu.length) menu.push({ type: "separator" });
            menu.push({ label: "Bots", enabled: false }, ...bots.map(entry));
        }
        return menu;
    }

    setupTray () {
        const menu = Menu.buildFromTemplate([
            {
                label: `${Constants.AppName} v${app.getVersion()}`,
                icon: Constants.icon16,
                enabled: false,
            },
            {
                type: "separator",
            },
            {
                label: "Recharger",
                click: () => {
                    this.win.reload();
                },
            },
            {
                label: "Redémarrer",
                click: () => this.relaunch(),
            },
            {
                label: "Nouvelle fenêtre Discord",
                click: () => {
                    this.openBlankClientWindow();
                },
            },
            {
                label: "Ouvrir un compte enregistré",
                submenu: this.savedAccountsMenu(),
            },
            {
                label: "Se connecter avec un compte Discord...",
                click: () => {
                    this.openAccountLoginWindow();
                },
            },
            {
                label: "Paramètres (éditeur de configuration)",
                click: () => {
                    this.openConfigEditorWindow();
                },
            },
            {
                label: "Supprimer toutes les données et redémarrer",
                click: async () => {
                    const result = await dialog.showMessageBox(this.win, {
                        type: "warning",
                        buttons: ["Annuler", "Supprimer et redémarrer"],
                        defaultId: 0,
                        cancelId: 0,
                        title: "Confirmer la suppression des données",
                        message: "Es-tu sûr de vouloir supprimer toutes les données de l’application ?",
                        detail:
                            "The following data will be permanently deleted:\n" +
                            "\n• Discord HTTP request cache" +
                            "\n• Data stored in session cache (cleared by clearCache)" +
                            "\n• Data stored in browser storage (cleared by clearStorageData)" +
                            "\n• Local databases: PrivateChannel, UserSetting, Frequency" +
                            "\n\nAll saved settings and cached data will be lost. This action cannot be undone.",
                    });

                    if (result.response === 1) {
                        try {
                            await this.win.webContents.session.clearCache();
                            await this.win.webContents.session.flushStorageData();
                            await this.win.webContents.session.clearStorageData({
                                storages: [
                                    "cookies",
                                    "filesystem",
                                    "indexdb",
                                    "localstorage",
                                    "shadercache",
                                    "serviceworkers",
                                    "cachestorage",
                                ],
                            });
                            this.relaunch();
                        } catch (err) {
                            console.error("Failed to clear app data:", err);
                        }
                    } else {
                        console.log("User canceled data deletion.");
                    }
                },
            },

            {
                label: "Afficher/masquer les DevTools",
                click: () => {
                    this.win.webContents.toggleDevTools();
                },
            },
            {
                type: "separator",
            },
            {
                label: "Quitter",
                click: () => this.quit(),
            },
        ]);
        this.initTray(menu);
    }
    async initApp () {
        this.port = await server();
        this.messageEditorPort = await messageEditor();
        app.setAppUserModelId(Constants.AppID);
        const enabledFeatures = new Set(app.commandLine.getSwitchValue("enable-features").split(","));
        const disabledFeatures = new Set(app.commandLine.getSwitchValue("disable-features").split(","));
        // Allow Localhost SSL
        app.commandLine.appendSwitch("allow-insecure-localhost", "true");
        app.commandLine.appendSwitch("ignore-certificate-errors");
        app.commandLine.appendSwitch("host-rules", `MAP ${Constants.CustomDiscordDomain} 127.0.0.1:${this.port}`);
        // Vesktop
        // Disable renderer backgrounding to prevent the app from unloading when in the background
        // https://github.com/electron/electron/issues/2822
        // https://github.com/GoogleChrome/chrome-launcher/blob/5a27dd574d47a75fec0fb50f7b774ebf8a9791ba/docs/chrome-flags-for-tools.md#task-throttling
        app.commandLine.appendSwitch("disable-renderer-backgrounding");
        app.commandLine.appendSwitch("disable-background-timer-throttling");
        app.commandLine.appendSwitch("disable-backgrounding-occluded-windows");
        // Disable proxy
        app.commandLine.appendSwitch("no-proxy-server");
        // Discord falls back to the browser locale when the account has none (bot accounts),
        // so the client speaks French out of the box
        app.commandLine.appendSwitch("lang", Constants.DefaultLocale);
        // Chromium lets its cache grow unbounded otherwise
        app.commandLine.appendSwitch("disk-cache-size", String(Constants.DiskCacheBytes));
        // Enable & Disable Chromium Features
        Constants.enableFeatures.forEach(feature => {
            enabledFeatures.add(feature);
        });
        Constants.disableFeatures.forEach(feature => {
            disabledFeatures.add(feature);
        });
        const enabledFeaturesArray = Array.from(enabledFeatures).filter(Boolean);
        const disabledFeaturesArray = Array.from(disabledFeatures).filter(Boolean);
        if (enabledFeaturesArray.length) {
            app.commandLine.appendSwitch("enable-features", enabledFeaturesArray.join(","));
            this.logger.log("Enabled Chromium features:", enabledFeaturesArray.join(", "));
        }

        if (disabledFeaturesArray.length) {
            app.commandLine.appendSwitch("disable-features", disabledFeaturesArray.join(","));
            this.logger.log("Disabled Chromium features:", disabledFeaturesArray.join(", "));
        }
        // App Event
        app.on("window-all-closed", () => {
            if (process.platform !== "darwin") this.quit();
        });

        app.on("before-quit", event => {
            // MacOS: Set flag to really quit app
            this.#shouldQuitApp = true;
            this.logger.info("App closing...");
            this.logger.info("=".repeat(50));
        });

        app.on("second-instance", (event, commandLine, workingDirectory, additionalData) => {
            const myWindow = BrowserWindow.getAllWindows()?.[0];
            if (myWindow) {
                myWindow.show();
            }
        });

        // Patch UserAgent (Switch Plan B SDP > Unified Plan)
        app.userAgentFallback = app.userAgentFallback.replace(/Electron\/[\d.]+/, "");

        // Handle second instance
        const gotTheLock = app.requestSingleInstanceLock();
        if (!gotTheLock) {
            this.logger.debug("Second Instance detected. Quit app...");
            this.#shouldQuitApp = true;
            app.quit();
        } else {
            protocol.registerSchemesAsPrivileged([
                {
                    scheme: "https",
                    privileges: {
                        standard: true,
                        bypassCSP: true,
                        allowServiceWorkers: true,
                        supportFetchAPI: true,
                        corsEnabled: true,
                        stream: true,
                    },
                },
            ]);
            app.whenReady().then(async () => {
                this.logger.info("Creating session...");
                this.customSession = session.fromPartition("persist:elysia_dbc");
                // Enable DoH (Cloudflare)
                app.configureHostResolver({
                    enableBuiltInResolver: true,
                    secureDnsMode: "secure",
                    enableHappyEyeballs: true,
                    enableAdditionalDnsQueryTypes: true,
                    secureDnsServers: ["https://cloudflare-dns.com/dns-query"],
                });
                this.createWindow();
                /*
                 * The releases now come from Nebula's own repository, so looking for one
                 * is safe again. It waits for the window: the notification is for the
                 * person reading it, not for a client still starting up.
                 */
                setTimeout(() => {
                    this.checkingForUpdates().catch(e => {
                        this.logger.error("Recherche de mise à jour impossible:", e);
                    });
                }, 10_000).unref();
                app.on("activate", () => {
                    if (BrowserWindow.getAllWindows().length === 0) {
                        this.createWindow();
                    } else {
                        this.win?.show();
                    }
                });
            });
        }

        // Create context menu
        contextMenu({
            showLearnSpelling: false,
            showSearchWithGoogle: false,
            showCopyImageAddress: true,
            showInspectElement: true,
            showSaveImage: true,
            showSaveImageAs: true,
            showSaveVideo: true,
            showSaveVideoAs: true,
        });

        setupIPCEvents(this);
    }
    get session () {
        if (this.customSession) {
            return this.customSession;
        } else {
            return session.defaultSession;
        }
    }
    async sessionPatch () {
        // Disable stripe.com
        this.session.webRequest.onBeforeRequest(
            {
                urls: [
                    "https://*.stripe.com/*",
                    `https://cdn.discordapp.com/avatars/${Constants.UserIdDefault}/*`,
                    `https://cdn.discordapp.com/banners/${Constants.UserIdDefault}/*`,
                    "https://cdn.discordapp.com/badge-icons/nebulacreator*",
                    `https://cdn.discordapp.com/emojis/${Constants.DiscordEmojiId}*`,
                    `https://cdn.discordapp.com/emojis/${Constants.GithubEmojiId}*`,
                ],
            },
            (details, callback) => {
                const branding = brandingFileFor(details.url);
                if (branding) {
                    return callback({
                        redirectURL: `https://${Constants.CustomDiscordDomain}/__botclient/assets/${branding}`,
                    });
                }
                // Cancel all requests to stripe.com
                callback({
                    cancel: true,
                });
            },
        );
        /*
        // Rule 1: Remove all CSP headers
        this.session.webRequest.onHeadersReceived(
            { urls: ["<all_urls>"], types: ["mainFrame", "subFrame"] },
            (details, callback) => {
                if (!details.responseHeaders) {
                    return callback({ responseHeaders: details.responseHeaders });
                }
                // Remove both CSP and CSP-report-only
                delete details.responseHeaders["content-security-policy"];
                delete details.responseHeaders["Content-Security-Policy"];
                delete details.responseHeaders["content-security-policy-report-only"];
                delete details.responseHeaders["Content-Security-Policy-Report-Only"];
                callback({ responseHeaders: details.responseHeaders });
            },
        );
        */
        // Rule 2: Force CSS content-type on GitHub raw URLs
        this.session.webRequest.onHeadersReceived(
            {
                urls: ["https://raw.githubusercontent.com/*"],
                types: ["stylesheet"],
            },
            (details, callback) => {
                if (!details.responseHeaders) {
                    return callback({ responseHeaders: details.responseHeaders });
                }
                const url = new URL(details.url);
                if (url.pathname.endsWith(".css")) {
                    // Override Content-Type
                    details.responseHeaders["content-type"] = ["text/css"];
                }
                callback({ responseHeaders: details.responseHeaders });
            },
        );
        // Load Vencord-Web Extension
        const extension = await this.session.extensions.loadExtension(Constants.VencordExtensionPath);
        this.logger.info(`Loaded Vencord Extension v${extension.version} from ${Constants.VencordExtensionPath}`);
    }
    async createWindow () {
        this.setupTray();
        const primaryDisplay = screen.getPrimaryDisplay();
        const { width, height } = primaryDisplay.workAreaSize;
        // Create the browser window.
        this.win = new BrowserWindow({
            width: Math.floor(width * 0.9),
            height: Math.floor(height * 0.9),
            minWidth: 940,
            minHeight: 500,
            icon: Constants.icon128,
            webPreferences: {
                webSecurity: false,
                sandbox: false,
                preload: path.join(__dirname, "ElectronPreload.js"),
                session: this.session,
            },
            backgroundColor: "#36393f",
            titleBarStyle: "hidden",
            frame: false,
            title: Constants.AppName,
            trafficLightPosition: { x: 10, y: 10 },
        });
        this.captureRendererLogs(this.win);
        this.keepStorageOnDisk();
        this.startGameDetection();
        // BrowserWindow Event
        this.win.on("close", event => {
            if (!this.#shouldQuitApp) {
                event.preventDefault();
                this.win.hide();
            }
        });
        this.win.on("focus", () => {
            this.win.flashFrame(false);
        });

        await this.sessionPatch();

        this.logger.info(`Electron UserData: ${app.getPath("userData")}`);
        // Microphone
        if (process.platform === "darwin") {
            this.session.setPermissionRequestHandler(async (_webContents, permission, callback, details) => {
                let granted = true;
                if ("mediaTypes" in details) {
                    if (details.mediaTypes?.includes("audio")) {
                        granted &&= await systemPreferences.askForMediaAccess("microphone");
                    }
                    if (details.mediaTypes?.includes("video")) {
                        granted = false;
                    }
                }
                callback(granted);
            });
        }
        // webContents
        if (!app.isPackaged) this.win.webContents.openDevTools();
        // Discord popout
        this.win.webContents.setWindowOpenHandler(({ url }) => {
            this.logger.log("WindowOpenHandler", url);
            switch (url) {
                case "about:blank":
                    return {
                        action: "allow",
                        overrideBrowserWindowOptions: {
                            icon: Constants.icon128,
                            frame: true,
                            autoHideMenuBar: true,
                            width: 1080,
                            height: 720,
                            webPreferences: {
                                webSecurity: false,
                            },
                        },
                    };
                case "https://discord.com/popout":
                case "https://ptb.discord.com/popout":
                case "https://canary.discord.com/popout":
                case `https://localhost:${this.port}/popout`:
                    return {
                        action: "allow",
                        overrideBrowserWindowOptions: {
                            icon: Constants.icon128,
                            frame: true,
                            autoHideMenuBar: true,
                            width: 1080,
                            height: 720,
                            // titleBarStyle: "hidden",
                            webPreferences: {
                                webSecurity: false,
                            },
                        },
                    };
            }

            if (
                [
                    "https://checkout.paypal.com/web",
                    "https://discord.com/connections",
                    "https://ptb.discord.com/connections",
                    "https://canary.discord.com/connections",
                    `https://localhost:${this.port}/connections`,
                ].some(e => url.includes(e))
            ) {
                return { action: "deny" };
            }

            let protocolHandle: string;

            try {
                protocolHandle = new URL(url).protocol;
            } catch {
                return { action: "deny" };
            }

            switch (protocolHandle) {
                case "http:":
                case "https:":
                case "mailto:":
                case "steam:":
                case "spotify:":
                    shell.openExternal(url);
            }

            return { action: "deny" };
        });
        // WebContents Event
        this.win.webContents
            .on("did-create-window", (window, details) => {
                window.show();
                window.on("closed", () => {
                    this.childWindows.delete(details.frameName);
                });
                this.childWindows.get(details.frameName)?.close();
                this.childWindows.set(details.frameName, window);
            })
            .on("did-start-loading", () => {
                this.win.setProgressBar(2, { mode: "indeterminate" });
            })
            .on("did-stop-loading", () => {
                this.win.setTitle(Constants.AppName);
                this.win.setProgressBar(-1);
            });

        this.win.loadURL(`https://${Constants.CustomDiscordDomain}`);
    }
    showNotification (options: NotificationConstructorOptions, callback?: () => unknown) {
        const notif = new Notification(options);
        function handleClick () {
            notif.close();
            if (callback && typeof callback === "function") callback();
        }
        if (callback && typeof callback === "function") notif.once("click", handleClick);
        setTimeout(() => {
            notif.close();
            notif.removeListener("click", handleClick);
        }, 15000).unref();
        notif.show();
    }
    checkingForUpdates (forceEmitted = false) {
        if (!app.isPackaged) {
            // autoUpdater.forceDevUpdateConfig = true; // ! Test
            if (forceEmitted) {
                this.showNotification({
                    title: "Gestionnaire de mises à jour",
                    body: "Les mises à jour automatiques sont désactivées en mode développement.",
                    silent: false,
                });
            }
            return Promise.resolve(false);
        }

        autoUpdater.logger = scope("AutoUpdater");
        autoUpdater.disableWebInstaller = true;

        // Auto download only on Windows and Linux
        // Mac requires code signing for auto-update to work properly
        autoUpdater.autoDownload = process.platform !== "darwin";

        autoUpdater.removeAllListeners();

        return new Promise(resolve => {
            autoUpdater.on("update-available", info => {
                const releaseUrl = `https://github.com/${Constants.GithubRepo}/releases/tag/v${info.version}`;

                if (process.platform === "darwin") {
                    this.showNotification(
                        {
                            title: `Nouvelle version disponible : ${info.version}`,
                            body: "Merci de télécharger la nouvelle version manuellement (macOS)",
                            silent: false,
                        },
                        () => {
                            shell.openExternal(releaseUrl);
                        },
                    );
                    resolve(true);
                    return;
                }

                this.showNotification(
                    {
                        title: "Gestionnaire de mises à jour",
                        body: `Une nouvelle version (${info.version}) est disponible et se télécharge en arrière-plan.`,
                        silent: false,
                    },
                    () => {
                        shell.openExternal(releaseUrl);
                    },
                );
            });

            autoUpdater.on("update-not-available", info => {
                if (forceEmitted) {
                    this.showNotification({
                        title: "Gestionnaire de mises à jour",
                        body: `Tu utilises déjà la dernière version (v${app.getVersion()})`,
                        silent: false,
                    });
                }
                resolve(true);
            });

            autoUpdater.on("error", err => {
                // Only log error, show notification if forced
                this.logger.error("Error in auto-updater: " + err);
                if (forceEmitted) {
                    this.showNotification(
                        {
                            title: "Gestionnaire de mises à jour",
                            body: `Erreur lors de la recherche de mises à jour : ${err.message}`,
                            silent: false,
                        },
                        () => {
                            shell.openExternal(`https://github.com/${Constants.GithubRepo}/releases`);
                        },
                    );
                }
                resolve(false);
            });

            autoUpdater.on("download-progress", progressObj => {
                const percent = Math.round(progressObj.percent);
                this.logger.debug(`Downloaded ${percent}%`);
                if (this.tray && !this.tray.isDestroyed()) {
                    this.tray.setToolTip(`${Constants.AppName} v${app.getVersion()} - Téléchargement : ${percent}%`);
                }
            });

            autoUpdater.on("update-downloaded", info => {
                if (this.tray && !this.tray.isDestroyed()) {
                    this.tray.setToolTip(`${Constants.AppName} v${app.getVersion()}`);
                }

                dialog
                    .showMessageBox(this.win, {
                        type: "info",
                        title: "Mise à jour prête",
                        message: `La version ${info.version} a été téléchargée. Redémarrer l’application pour l’appliquer ?`,
                        buttons: ["Redémarrer", "Plus tard"],
                    })
                    .then(returnValue => {
                        if (returnValue.response === 0) autoUpdater.quitAndInstall(true, true);
                    });
                resolve(true);
            });

            autoUpdater.checkForUpdates();
        });
    }
    relaunch () {
        this.#shouldQuitApp = true;
        app.relaunch();
        app.quit();
    }
    quit () {
        this.#shouldQuitApp = true;
        app.quit();
    }
    // Editor Window
    /** Watch the running processes and tell every open client window about the games found */
    startGameDetection () {
        const clientWindows = () => [this.win, ...this.accountWindows.values()];
        GameDetection.start(
            (games, added, removed) => {
                for (const win of clientWindows()) {
                    if (!win || win.isDestroyed()) continue;
                    win.webContents.send(IPCEvent.RunningGamesChanged, games, added, removed);
                }
            },
            // Nothing to publish to while every window is hidden in the tray
            () => clientWindows().some(win => win && !win.isDestroyed() && win.isVisible()),
        );
    }

    /**
     * Saved private channels live in the browser storage of the session. Chromium only
     * writes them out lazily, so a machine that restarts without the app quitting
     * cleanly loses the most recent ones. Flush regularly and on the way out.
     */
    keepStorageOnDisk () {
        const flush = async () => {
            try {
                await this.session.flushStorageData();
            } catch (e) {
                this.logger.debug("Impossible d'écrire le stockage sur le disque:", e);
            }
        };
        // Every five minutes is enough: the events below cover the cases that matter
        const timer = setInterval(flush, 300_000);
        timer.unref?.();
        this.win.on("hide", flush);
        this.win.webContents.on("render-process-gone", flush);
        app.on("before-quit", flush);
        powerMonitor.on("shutdown", flush);
        powerMonitor.on("suspend", flush);
    }

    /**
     * Mirror the client's own errors into the application log, so a crash inside
     * the Discord window can be diagnosed without opening the DevTools.
     */
    captureRendererLogs (win: BrowserWindow) {
        const rendererLogger = scope("Renderer");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        win.webContents.on("console-message" as any, (details: any) => {
            const level = details?.level ?? details?.levelName;
            if (level !== "error" && level !== "warning" && level !== 3 && level !== 2) return;
            const where = details?.sourceId ? ` (${details.sourceId}:${details.lineNumber})` : "";
            rendererLogger.error(`${details?.message ?? details}${where}`);
        });
        win.webContents.on("render-process-gone", (event, details) => {
            rendererLogger.error("Le processus de rendu s'est arrêté:", details.reason, details.exitCode);
        });
        win.webContents.on("preload-error", (event, preloadPath, error) => {
            rendererLogger.error("Erreur dans le preload", preloadPath, error);
        });
    }

    /**
     * Apply to a freshly created session the same rules the main one gets:
     * the Vencord extension, the branding redirects and the stripe block.
     */
    async prepareAccountSession (target: Electron.Session) {
        target.webRequest.onBeforeRequest(
            {
                urls: [
                    "https://*.stripe.com/*",
                    `https://cdn.discordapp.com/avatars/${Constants.UserIdDefault}/*`,
                    `https://cdn.discordapp.com/banners/${Constants.UserIdDefault}/*`,
                    "https://cdn.discordapp.com/badge-icons/nebulacreator*",
                    `https://cdn.discordapp.com/emojis/${Constants.DiscordEmojiId}*`,
                    `https://cdn.discordapp.com/emojis/${Constants.GithubEmojiId}*`,
                ],
            },
            (details, callback) => {
                const branding = brandingFileFor(details.url);
                if (branding) {
                    return callback({
                        redirectURL: `https://${Constants.CustomDiscordDomain}/__botclient/assets/${branding}`,
                    });
                }
                callback({ cancel: true });
            },
        );
        try {
            await target.extensions.loadExtension(Constants.VencordExtensionPath);
        } catch (e) {
            this.logger.error("Impossible de charger l'extension Vencord dans la session du compte:", e);
        }
    }

    /**
     * A brand new, empty Discord window with its own session: it opens on the login
     * screen, so any account or bot can be signed into it alongside the others.
     */
    async openBlankClientWindow () {
        return this.openClientWindow(null);
    }

    /**
     * Open a dedicated window already logged into the given account, so several
     * accounts can be used side by side. Each one gets its own session.
     */
    async openClientWindow (token: string | null) {
        // A token we do not know as a user account is a bot: remember it so it is listed too
        if (token && !UserAuth.isUserToken(token)) {
            await UserAuth.storeBot(token);
            this.setupTray();
        }
        const accountId = (token && Util.getIDFromToken(token)) || randomUUID();
        const existing = this.accountWindows.get(accountId);
        if (existing && !existing.isDestroyed()) {
            existing.show();
            existing.focus();
            return true;
        }
        const accountSession = session.fromPartition(`persist:nebula_account_${accountId}`);
        await this.prepareAccountSession(accountSession);
        const primaryDisplay = screen.getPrimaryDisplay();
        const { width, height } = primaryDisplay.workAreaSize;
        const win = new BrowserWindow({
            width: Math.floor(width * 0.8),
            height: Math.floor(height * 0.8),
            minWidth: 940,
            minHeight: 500,
            icon: Constants.icon128,
            webPreferences: {
                webSecurity: false,
                sandbox: false,
                preload: path.join(__dirname, "ElectronPreload.js"),
                session: accountSession,
            },
            backgroundColor: Constants.DiscordBackgroundColor,
            title: Constants.AppName,
            // Same chrome as the main window: Discord draws its own title bar
            titleBarStyle: "hidden",
            frame: false,
            trafficLightPosition: { x: 10, y: 10 },
        });
        this.accountWindows.set(accountId, win);
        win.on("closed", () => {
            this.accountWindows.delete(accountId);
        });
        this.captureRendererLogs(win);
        if (token) {
            win.webContents.once("did-finish-load", async () => {
                try {
                    await this.injectToken(win, token);
                    this.logger.info(`Jeton injecté dans la fenêtre du compte ${accountId}`);
                } catch (e) {
                    this.logger.error("Impossible d'injecter le jeton dans la nouvelle fenêtre:", e);
                }
                win.reload();
            });
        }
        await win.loadURL(`https://${Constants.CustomDiscordDomain}/app`);
        this.accountWindow?.close();
        return true;
    }

    /**
     * Discord deletes `window.localStorage`, so the token is written through an iframe.
     */
    async injectToken (win: BrowserWindow, token: string) {
        await win.webContents.executeJavaScript(
            `(() => {
                const frame = document.createElement("iframe");
                document.body.appendChild(frame);
                frame.contentWindow.localStorage.setItem("token", ${JSON.stringify(JSON.stringify(token))});
                frame.remove();
            })()`,
        );
    }

    openAccountLoginWindow (requestedBy?: BrowserWindow) {
        this.accountLoginTarget = requestedBy;
        if (this.accountWindow && !this.accountWindow.isDestroyed()) {
            this.accountWindow.show();
            this.accountWindow.focus();
            return;
        }
        this.accountWindow = new BrowserWindow({
            width: 560,
            height: 760,
            minWidth: 480,
            minHeight: 600,
            title: `${Constants.AppName} - Account Login`,
            backgroundColor: Constants.DiscordBackgroundColor,
            webPreferences: {
                webSecurity: false,
                sandbox: false,
                preload: path.join(__dirname, "AccountLoginPreload.js"),
            },
            icon: Constants.icon128,
            frame: true,
            autoHideMenuBar: true,
        });
        this.accountWindow.loadFile(Constants.AccountLoginHTMLPath);
        this.accountWindow.on("closed", () => {
            this.accountWindow = undefined;
            this.accountLoginTarget = undefined;
        });
    }

    /**
     * Show the captcha challenge Discord asked for, served from the Discord origin
     * so hCaptcha accepts the sitekey. Resolves with the captcha key, or null.
     */
    openCaptchaWindow (sitekey: string, rqdata: string | null): Promise<string | null> {
        return new Promise(resolve => {
            const captchaWindow = new BrowserWindow({
                width: 480,
                height: 620,
                title: "Discord - Captcha",
                parent: this.accountWindow,
                modal: Boolean(this.accountWindow),
                backgroundColor: Constants.DiscordBackgroundColor,
                webPreferences: {
                    webSecurity: false,
                    sandbox: false,
                    preload: path.join(__dirname, "AccountLoginPreload.js"),
                },
                icon: Constants.icon128,
                frame: true,
                autoHideMenuBar: true,
            });
            let settled = false;
            const finish = (token: string | null) => {
                if (settled) return;
                settled = true;
                resolve(token);
                if (!captchaWindow.isDestroyed()) captchaWindow.close();
            };
            captchaWindow.webContents.ipc.once(IPCEvent.AccountCaptchaResult, (event, token: string | null) => {
                finish(token);
            });
            captchaWindow.on("closed", () => finish(null));
            const query = new URLSearchParams({ sitekey, ...(rqdata ? { rqdata } : {}) });
            captchaWindow.loadURL(`https://${Constants.CustomDiscordDomain}/__botclient/captcha?${query}`);
        });
    }

    /**
     * Log the main Discord window into a user account token.
     * Discord deletes `window.localStorage`, so it is reached through an iframe.
     */
    async loginWithUserToken (token: string) {
        // The account belongs to whichever client window opened the login window:
        // signing in from a second window must not hijack the first one
        const target =
            this.accountLoginTarget && !this.accountLoginTarget.isDestroyed() ? this.accountLoginTarget : this.win;
        if (!target || target.isDestroyed()) return false;
        await this.injectToken(target, token);
        target.reload();
        target.show();
        target.focus();
        this.accountWindow?.close();
        return true;
    }

    openConfigEditorWindow () {
        if (this.editorWindow && !this.editorWindow.isDestroyed()) {
            this.editorWindow.show();
            return;
        }
        this.editorWindow = new BrowserWindow({
            width: 1080,
            height: 720,
            minWidth: 800,
            minHeight: 600,
            webPreferences: {
                webSecurity: false,
                sandbox: false,
                preload: path.join(__dirname, "ConfigEditorPreload.js"),
            },
            icon: Constants.icon128,
            frame: true,
            autoHideMenuBar: true,
            /*
            ...(process.platform === "darwin" && {
                titleBarStyle: "hidden",
                trafficLightPosition: { x: 10, y: 10 },
            }),
            */
        });
        this.editorWindow.loadFile(Constants.ConfigEditorHTMLPath);
        this.editorWindow.on("closed", () => {
            this.editorWindow = undefined;
        });
    }

    // Beta
    openDiscordMessageEditorWindow () {
        const editorWindow = new BrowserWindow({
            width: 1080,
            height: 720,
            minWidth: 800,
            minHeight: 600,
            parent: this.win,
            modal: true,
            webPreferences: {
                webSecurity: false,
                sandbox: false,
                preload: path.join(__dirname, "MessageEditorPreload.js"),
                partition: "temp:" + randomUUID(), // Use a temporary session for the message editor
            },
            icon: Constants.icon128,
            frame: true,
            autoHideMenuBar: true,
            /*
            ...(process.platform === "darwin" && {
                titleBarStyle: "hidden",
                trafficLightPosition: { x: 10, y: 10 },
            }),
            */
        });
        editorWindow.loadURL(`http://localhost:${this.messageEditorPort}`);
        // Handle Message Editor Ports
        editorWindow.webContents.ipc.once(IPCEvent.MessageEditorReactReady, () => {
            this.logger.debug("Message Editor is ready. Setting up MessageChannel...");
            const { port1, port2 } = new MessageChannelMain();
            editorWindow.webContents.postMessage(IPCEvent.MessageEditorReceivePort, null, [port2]);
            this.win.webContents.postMessage(IPCEvent.MainAppReceiveEditorPort, null, [port1]);
        });
    }

    get app () {
        return app;
    }
}
