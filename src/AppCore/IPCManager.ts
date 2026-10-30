/* Copyright Elysia © 2025. All rights reserved */

import { APIApplication, ApplicationFlags, GatewayIntentBits } from "discord-api-types/v10";
import { app, BrowserWindow, dialog } from "electron";
import { autoUpdater } from "electron-updater";
import { ApplicationFlagsBitField, IntentsBitField } from "src/AppUtils/DiscordBitField";
import { ApexExperiment, GuildExperiment, UserExperiment } from "src/AppUtils/Experiments";
import GameDetection from "src/AppUtils/GameDetection";

import { DiscordBotClient } from ".";
import Constants from "./Constants";
import { IPCEvent } from "./IPCEvents";
import UserAuth from "./UserAuth";

export function setupIPCEvents (mainApp: DiscordBotClient) {
    /*
     * The title bar buttons must act on the window they were clicked in. Falling back to
     * the main window made a second client window minimise or maximise the first one.
     */
    const getWindow = (event: Electron.IpcMainEvent, framename: string) => {
        return (
            mainApp.childWindows.get(framename) ?? BrowserWindow.fromWebContents(event.sender) ?? mainApp.win
        );
    };
    mainApp.ipcMain
        .on(IPCEvent.Minimize, (event, frameName) => {
            getWindow(event, frameName).minimize();
        })
        .on(IPCEvent.Maximize, (event, frameName) => {
            const win = getWindow(event, frameName);
            if (win.isMaximized()) {
                win.restore();
            } else {
                win.maximize();
            }
        })
        .on(IPCEvent.Close, (event, frameName) => {
            if (frameName) {
                return mainApp.childWindows.get(frameName)?.close();
            }
            const win = BrowserWindow.fromWebContents(event.sender);
            // Only the main window survives being closed, as it lives in the tray
            if (win && win !== mainApp.win) return win.close();
            mainApp.win.hide();
        })
        .on(IPCEvent.Focus, (event, frameName) => {
            const win = getWindow(event, frameName);
            win.show();
            win.setSkipTaskbar(false);
        })
        .on(IPCEvent.FlashFrame, (event, flag: boolean) => {
            const win = BrowserWindow.fromWebContents(event.sender) ?? mainApp.win;
            if (!win || win.isDestroyed() || (flag && win.isFocused())) return;
            win.flashFrame(flag);
        })
        .on(IPCEvent.RequestCloseWindow, event => {
            const win = BrowserWindow.fromWebContents(event.sender);
            win?.close();
        });
    mainApp.ipcMain.handle(IPCEvent.GetBotInfo, (event, token) => {
        token = token.replace(/Bot/g, "").trim();
        return mainApp.session
            .fetch("https://canary.discord.com/api/v9/applications/@me?with_counts=true", {
                headers: {
                    Authorization: `Bot ${token}`,
                    "User-Agent": Constants.UserAgentDiscordBot,
                },
            })
            .then(res => {
                if (!res.ok) throw new Error(res.statusText);
                return res.json() as Promise<APIApplication>;
            })
            .then(data => {
                const applicationFlags = new ApplicationFlagsBitField(data.flags);
                const skipIntents = new Set<GatewayIntentBits>([
                    GatewayIntentBits.GuildPresences,
                    GatewayIntentBits.GuildMembers,
                    GatewayIntentBits.MessageContent,
                ]);
                if (
                    applicationFlags.has(ApplicationFlags.GatewayPresence) ||
                    applicationFlags.has(ApplicationFlags.GatewayPresenceLimited)
                ) {
                    skipIntents.delete(GatewayIntentBits.GuildPresences);
                }
                if (
                    applicationFlags.has(ApplicationFlags.GatewayGuildMembers) ||
                    applicationFlags.has(ApplicationFlags.GatewayGuildMembersLimited)
                ) {
                    skipIntents.delete(GatewayIntentBits.GuildMembers);
                }
                if (
                    applicationFlags.has(ApplicationFlags.GatewayMessageContent) ||
                    applicationFlags.has(ApplicationFlags.GatewayMessageContentLimited)
                ) {
                    skipIntents.delete(GatewayIntentBits.MessageContent);
                }
                if (
                    skipIntents.has(GatewayIntentBits.MessageContent) &&
                    !mainApp.config.config.suppress_intent_warning
                ) {
                    dialog.showErrorBox(
                        "L’intent MessageContent est requis",
                        "You need to enable the MessageContent intent in the application settings.\nIf you want to permanently suppress this warning, change the application settings (accessible from the tray menu via right-click)",
                    );
                    throw new Error("MESSAGE_CONTENT is required.");
                }
                return {
                    success: true,
                    data,
                    intents: IntentsBitField.getIntents(...Array.from(skipIntents)),
                    allShards:
                        Math.ceil(
                            ((
                                data as APIApplication & {
                                    // New field, it reflects the number of guilds that have actually added this application as a bot profile
                                    // @undocumented
                                    bot_approximate_guild_count?: number;
                                }
                            ).bot_approximate_guild_count ??
                                // Old field, it reflects the number of guilds that have added this application as an intergration
                                data.approximate_guild_count ??
                                0) / Number(mainApp.config.config.guilds_per_shard),
                        ) || 1,
                };
            })
            .catch(e => {
                return {
                    success: false,
                    message: e.message,
                };
            });
    });
    mainApp.ipcMain.handle(IPCEvent.RequestOpenMessageEditorWindow, () => {
        return mainApp.openDiscordMessageEditorWindow();
    });
    mainApp.ipcMain
        .on(IPCEvent.GetVersion, event => {
            return (event.returnValue = app.getVersion());
        })
        .on(IPCEvent.GetName, event => {
            return (event.returnValue = app.getName());
        })
        .on(IPCEvent.GetExperiment, (event, type, botId, allData) => {
            if (type === "user") {
                event.returnValue = UserExperiment(allData, botId);
            } else if (type === "guild") {
                event.returnValue = GuildExperiment();
            } else if (type === "apex") {
                event.returnValue = ApexExperiment(botId);
            }
        })
        .on(IPCEvent.GetDefaultUserPatch, event => {
            event.returnValue = Constants.UserDefaultPatch;
        })
        .on(IPCEvent.GetIsUserToken, (event, token: string) => {
            event.returnValue = UserAuth.isUserToken(token ?? "");
        })
        .on(IPCEvent.GetSupportInvite, event => {
            event.returnValue = Constants.SupportInvite;
        })
        .on(IPCEvent.GetBotAccountIds, event => {
            event.returnValue = UserAuth.accounts.filter(a => a.bot && a.id).map(a => a.id as string);
        })
        .on(IPCEvent.GetRunningGames, event => {
            event.returnValue = GameDetection.snapshot();
        })
        .on(IPCEvent.RememberBot, async (event, token: string) => {
            if (!token) return;
            await UserAuth.storeBot(token);
            mainApp.setupTray();
        });
    // User Account Login (email + password)
    mainApp.ipcMain.handle(IPCEvent.OpenAccountLoginWindow, event => {
        // Remember which client window asked, so the account lands in that one
        mainApp.openAccountLoginWindow(BrowserWindow.fromWebContents(event.sender) ?? undefined);
    });
    mainApp.ipcMain.handle(IPCEvent.AccountLogin, async (event, { login, password, captcha }) => {
        const result = await UserAuth.login({
            login,
            password,
            captchaKey: captcha?.key ?? null,
            captchaRqtoken: captcha?.rqtoken ?? null,
        });
        // The tray lists the saved accounts, so it has to know about the new one
        if (result.status === "success") mainApp.setupTray();
        return result;
    });
    mainApp.ipcMain.handle(IPCEvent.AccountTokenLogin, async (event, token: string) => {
        const result = await UserAuth.loginWithToken(token);
        if (result.status === "success") mainApp.setupTray();
        return result;
    });
    mainApp.ipcMain.handle(IPCEvent.AccountMfa, (event, { ticket, code, method }) => {
        return UserAuth.mfa({ ticket, code, method });
    });
    mainApp.ipcMain.handle(IPCEvent.AccountSendSms, (event, ticket: string) => {
        return UserAuth.sendSms(ticket);
    });
    mainApp.ipcMain.handle(IPCEvent.AccountSolveCaptcha, (event, { sitekey, rqdata }) => {
        return mainApp.openCaptchaWindow(sitekey, rqdata ?? null);
    });
    mainApp.ipcMain.handle(IPCEvent.AccountList, () => {
        // The token is needed by the renderer to pick an account, it never leaves the app
        return UserAuth.accounts;
    });
    mainApp.ipcMain.handle(IPCEvent.AccountRemove, (event, token: string) => {
        UserAuth.remove(token);
        return UserAuth.accounts;
    });
    mainApp.ipcMain.handle(IPCEvent.AccountUse, (event, token: string) => {
        return mainApp.loginWithUserToken(token);
    });
    mainApp.ipcMain.handle(IPCEvent.AccountOpenWindow, (event, token: string) => {
        return mainApp.openClientWindow(token);
    });
    // Updates
    mainApp.ipcMain.handle(IPCEvent.UpdateCheck, () => {
        return mainApp.checkingForUpdates(true);
    });
    mainApp.ipcMain.handle(IPCEvent.UpdateInstall, () => {
        autoUpdater.quitAndInstall(true, true);
    });
    mainApp.ipcMain.on(IPCEvent.UpdateGetState, event => {
        event.returnValue = mainApp.updateState;
    });
    // Config Editor
    mainApp.ipcMain.handle(IPCEvent.MonacoEditorGetConfig, event => {
        return mainApp.config.toString();
    });
    mainApp.ipcMain.handle(IPCEvent.MonacoEditorGetAutoComplete, event => {
        return mainApp.config.monacoAutoComplete();
    });
    mainApp.ipcMain.handle(IPCEvent.MonacoEditorSaveConfig, (event, config) => {
        // Validate and save the config
        try {
            mainApp.config.loadConfig(config);
            mainApp.config.save();
            mainApp.logger.info("Config saved successfully");
            return true;
        } catch (e) {
            mainApp.logger.error("Invalid config:", e);
            dialog.showErrorBox("Configuration invalide", `La configuration fournie est invalide : ${(e as Error).message}`);
            return false;
        }
    });
}
