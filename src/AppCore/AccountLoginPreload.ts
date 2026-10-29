/* Copyright Elysia © 2025. All rights reserved */

import { contextBridge, ipcRenderer } from "electron";

import { IPCEvent } from "./IPCEvents";

contextBridge.exposeInMainWorld("accountAPI", {
    login (login: string, password: string, captcha?: { key: string; rqtoken: string | null }) {
        return ipcRenderer.invoke(IPCEvent.AccountLogin, { login, password, captcha });
    },
    /** Signs in with an account token instead of an email and a password */
    loginWithToken (token: string) {
        return ipcRenderer.invoke(IPCEvent.AccountTokenLogin, token);
    },
    mfa (ticket: string, code: string, method: "totp" | "sms" | "backup") {
        return ipcRenderer.invoke(IPCEvent.AccountMfa, { ticket, code, method });
    },
    sendSms (ticket: string) {
        return ipcRenderer.invoke(IPCEvent.AccountSendSms, ticket);
    },
    /** Opens the captcha window and resolves with the solved captcha key (or null) */
    solveCaptcha (sitekey: string, rqdata: string | null) {
        return ipcRenderer.invoke(IPCEvent.AccountSolveCaptcha, { sitekey, rqdata });
    },
    listAccounts () {
        return ipcRenderer.invoke(IPCEvent.AccountList);
    },
    removeAccount (token: string) {
        return ipcRenderer.invoke(IPCEvent.AccountRemove, token);
    },
    /** Logs the main Discord window into the given user token */
    useAccount (token: string) {
        return ipcRenderer.invoke(IPCEvent.AccountUse, token);
    },
    /** Opens that account in a window of its own, with its own session */
    openAccountWindow (token: string) {
        return ipcRenderer.invoke(IPCEvent.AccountOpenWindow, token);
    },
    closeWindow () {
        ipcRenderer.send(IPCEvent.RequestCloseWindow);
    },
});

// Used by the captcha window (assets/account/captcha.html)
contextBridge.exposeInMainWorld("captchaAPI", {
    resolve (token: string | null) {
        ipcRenderer.send(IPCEvent.AccountCaptchaResult, token);
    },
});
