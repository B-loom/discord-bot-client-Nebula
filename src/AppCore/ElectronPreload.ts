/* Copyright Elysia © 2025. All rights reserved */

import { contextBridge, ipcRenderer } from "electron";

import { IPCEvent } from "./IPCEvents";

type LogLevel = "log" | "info" | "warn" | "error" | "debug";

class Logger {
    _log (scope: string, level: LogLevel, color: string, args: unknown[]) {
        console[level](
            `%c MainProcess %c %c ${scope || "Unknown"} `,
            `background: ${color}; color: black; font-weight: bold; border-radius: 5px;`,
            "",
            "background: #99d1db; color: black; font-weight: bold; border-radius: 5px;",
            ...args,
        );
    }

    log (scope: string, ...args: unknown[]) {
        this._log(scope, "log", "#a6d189", args);
    }
    info (scope: string, ...args: unknown[]) {
        this._log(scope, "info", "#a6d189", args);
    }
    error (scope: string, ...args: unknown[]) {
        this._log(scope, "error", "#e78284", args);
    }
    warn (scope: string, ...args: unknown[]) {
        this._log(scope, "warn", "#e5c890", args);
    }
    debug (scope: string, ...args: unknown[]) {
        this._log(scope, "debug", "#eebebe", args);
    }
}

// Discord reads its locale from storage before the account settings arrive, so a bot
// account (which carries no locale of its own) starts in French too
try {
    if (!window.localStorage.getItem("locale")) {
        window.localStorage.setItem("locale", JSON.stringify("fr"));
    }
} catch {
    //
}

window.addEventListener("DOMContentLoaded", () => {
    const logger = new Logger();
    ipcRenderer.on(IPCEvent.LogFromMainProcess, (_event, scope, level: LogLevel, ...args) => {
        logger[level](scope, ...args);
    });
});

contextBridge.exposeInMainWorld("BotClientNative", {
    getBotInfo: (token: string) => {
        return ipcRenderer.invoke(IPCEvent.GetBotInfo, token);
    },
    getBotClientVersion () {
        return ipcRenderer.sendSync(IPCEvent.GetVersion);
    },
    getBotClientName () {
        return ipcRenderer.sendSync(IPCEvent.GetName);
    },
    getPrivateChannelDefault () {
        return {
            type: 1,
            recipients: [ipcRenderer.sendSync(IPCEvent.GetDefaultUserPatch)],
            // Discord orders direct messages by last_message_id, so a snowflake far in the
            // future keeps this channel pinned at the top of the list
            last_message_id: "9999999999999999999",
            is_spam: false,
            id: "1000000000000000000",
            flags: 0,
        };
    },
    getUserExperiments (allData: Record<string, string>[], botId?: string) {
        return ipcRenderer.sendSync(IPCEvent.GetExperiment, "user", botId, allData);
    },
    getGuildExperiments () {
        return ipcRenderer.sendSync(IPCEvent.GetExperiment, "guild");
    },
    getApexExperiments (botId: string) {
        return ipcRenderer.sendSync(IPCEvent.GetExperiment, "apex", botId);
    },
    closeWindow: () => {
        ipcRenderer.send(IPCEvent.RequestCloseWindow);
    },
    // User account login (email + password)
    openAccountLogin () {
        return ipcRenderer.invoke(IPCEvent.OpenAccountLoginWindow);
    },
    /** True when the token belongs to a user account logged in through the account window */
    isUserToken (token: string) {
        return ipcRenderer.sendSync(IPCEvent.GetIsUserToken, token) as boolean;
    },
    /** Remember a bot that just signed in, so it is listed beside the accounts */
    rememberBot (token: string) {
        ipcRenderer.send(IPCEvent.RememberBot, token);
    },
    /** The invite shown in the welcome message, copied rather than opened */
    getSupportInvite () {
        return ipcRenderer.sendSync(IPCEvent.GetSupportInvite) as string;
    },
    /** Told when the main process copied the invite instead of opening it */
    onSupportInviteCopied (listener: (invite: string) => void) {
        ipcRenderer.on(IPCEvent.SupportInviteCopied, (event, invite) => listener(invite));
    },
    // Updates
    checkForUpdates () {
        return ipcRenderer.invoke(IPCEvent.UpdateCheck);
    },
    installUpdate () {
        return ipcRenderer.invoke(IPCEvent.UpdateInstall);
    },
    getUpdateState () {
        return ipcRenderer.sendSync(IPCEvent.UpdateGetState);
    },
    onUpdateState (listener: (state: unknown) => void) {
        ipcRenderer.on(IPCEvent.UpdateState, (event, state) => listener(state));
    },
    /** Ids of the saved accounts that are bots, so the switcher can group them */
    getBotAccountIds () {
        return ipcRenderer.sendSync(IPCEvent.GetBotAccountIds) as string[];
    },
    // Game detection
    getRunningGames () {
        return ipcRenderer.sendSync(IPCEvent.GetRunningGames);
    },
    onRunningGamesChanged (listener: (games: unknown[], added: unknown[], removed: unknown[]) => void) {
        ipcRenderer.on(IPCEvent.RunningGamesChanged, (event, games, added, removed) =>
            listener(games, added, removed),
        );
    },
    // Vesktop
    close (frameName: string) {
        ipcRenderer.send(IPCEvent.Close, frameName);
    },
    minimize (frameName: string) {
        ipcRenderer.send(IPCEvent.Minimize, frameName);
    },
    maximize (frameName: string) {
        ipcRenderer.send(IPCEvent.Maximize, frameName);
    },
    focus (frameName: string) {
        ipcRenderer.send(IPCEvent.Focus, frameName);
    },
    flashFrame (flag: boolean) {
        ipcRenderer.send(IPCEvent.FlashFrame, flag);
    },
    // Beta Features
    requestOpenMessageEditorWindow () {
        return ipcRenderer.invoke(IPCEvent.RequestOpenMessageEditorWindow);
    },
});

ipcRenderer.on(IPCEvent.MainAppReceiveEditorPort, event => {
    const port = event.ports[0];
    window.postMessage("forward-editor-port", "*", [port]);
});

/*
contextBridge.exposeInMainWorld("ipcRender", {
    // From render to main (1-way)
    send: (channel: string, ...args: unknown[]) => {
        ipcRenderer.send(channel, ...args);
    },
    // From main to render (1-way)
    receive: (channel: string, listener: (...args: unknown[]) => unknown) => {
        ipcRenderer.on(channel, (event, ...args) => listener(...args));
    },
    // From render to main and back again (2-way)
    invoke: (channel: string, ...args: unknown[]) => {
        return ipcRenderer.invoke(channel, args);
    },
});
*/

contextBridge.exposeInMainWorld("protoAPI", {
    GetPreloadedUserSettings: (listener: (botId: string) => unknown) => {
        ipcRenderer.on(IPCEvent.GetPreloadedUserSettings, (event, botId) => listener(botId));
    },
    GetPreloadedUserSettingsResponse: (botId: string, settings: string) => {
        ipcRenderer.send(IPCEvent.GetPreloadedUserSettingsResponse, botId, settings);
    },
    SetPreloadedUserSettings: (listener: (botId: string, settings: string) => unknown) => {
        ipcRenderer.on(IPCEvent.SetPreloadedUserSettings, (event, botId, settings) => listener(botId, settings));
    },
    //
    GetFrecencyUserSettings: (listener: (botId: string) => unknown) => {
        ipcRenderer.on(IPCEvent.GetFrecencyUserSettings, (event, botId) => listener(botId));
    },
    GetFrecencyUserSettingsResponse: (botId: string, settings: string) => {
        ipcRenderer.send(IPCEvent.GetFrecencyUserSettingsResponse, botId, settings);
    },
    SetFrecencyUserSettings: (listener: (botId: string, settings: string) => unknown) => {
        ipcRenderer.on(IPCEvent.SetFrecencyUserSettings, (event, botId, settings) => listener(botId, settings));
    },
});
