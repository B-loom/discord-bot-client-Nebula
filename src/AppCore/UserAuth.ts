/* Copyright Elysia © 2025. All rights reserved */

import { app, net } from "electron";
import { scope } from "electron-log";
import fs from "fs";
import path from "path";

import Constants from "./Constants";

const logger = scope("UserAuth");

export type SavedAccount = {
    id: string | null;
    username: string;
    avatar: string | null;
    token: string;
    addedAt: number;
    /** A bot token added through the editor, as opposed to an account signed in with a password */
    bot?: boolean;
};

export type AuthResult =
    | { status: "success"; token: string; account: SavedAccount }
    | { status: "mfa"; ticket: string; methods: { type: string }[] }
    | {
          status: "captcha";
          sitekey: string;
          service: string;
          rqdata: string | null;
          rqtoken: string | null;
      }
    | { status: "error"; message: string; code?: number };

type LoginPayload = {
    login: string;
    password: string;
    captchaKey?: string | null;
    captchaRqtoken?: string | null;
};

type MfaPayload = {
    ticket: string;
    code: string;
    method?: "totp" | "sms" | "backup";
};

/**
 * Login to a real Discord user account (email / phone + password).
 *
 * The resulting user token is stored locally and remembered as a *user* token,
 * so the API server proxies it as-is (no `Bot ` prefix, browser headers)
 * instead of treating it like a bot token.
 */
export class UserAuth {
    static storePath = path.join(app.getPath("userData"), "accounts.json");
    static accounts: SavedAccount[] = UserAuth.load();
    /**
     * Tokens known to belong to a user account. Bots saved beside them must stay out:
     * a token listed here is sent to Discord as-is, without the `Bot ` prefix, which
     * would make every bot login fail after its first launch.
     */
    static tokens = new Set<string>(UserAuth.accounts.filter(a => !a.bot).map(a => a.token));

    static load (): SavedAccount[] {
        try {
            if (!fs.existsSync(UserAuth.storePath)) return [];
            const data = JSON.parse(fs.readFileSync(UserAuth.storePath, "utf-8"));
            return Array.isArray(data?.accounts) ? data.accounts : [];
        } catch (e) {
            logger.error("Failed to read account store:", e);
            return [];
        }
    }

    static save () {
        try {
            fs.writeFileSync(UserAuth.storePath, JSON.stringify({ accounts: UserAuth.accounts }, null, 4), "utf-8");
        } catch (e) {
            logger.error("Failed to write account store:", e);
        }
    }

    static isUserToken (token: string) {
        return UserAuth.tokens.has(token.replace(/^(Bot|Bearer)\s+/i, "").trim());
    }

    /**
     * Every saved account except this one.
     *
     * Signing in twice to the same account yields two different tokens, so comparing
     * tokens listed it twice. The account id is what identifies it; the older entry's
     * token is dropped from the user-token set so it stops being treated as valid.
     */
    static without (account: SavedAccount): SavedAccount[] {
        return UserAuth.accounts.filter(saved => {
            const sameAccount = account.id ? saved.id === account.id : saved.token === account.token;
            if (sameAccount && saved.token !== account.token) UserAuth.tokens.delete(saved.token);
            return !sameAccount;
        });
    }

    static remove (token: string) {
        UserAuth.tokens.delete(token);
        UserAuth.accounts = UserAuth.accounts.filter(a => a.token !== token);
        UserAuth.save();
    }

    static headers (extra: Record<string, string> = {}) {
        return {
            "content-type": "application/json",
            "user-agent": Constants.UserAgentBrowser,
            "x-super-properties": Constants.superProperties(),
            "x-discord-locale": "en-US",
            "x-debug-options": "bugReporterEnabled",
            accept: "*/*",
            "accept-language": "en-US,en;q=0.9",
            origin: `https://${Constants.AuthDomain}`,
            referer: `https://${Constants.AuthDomain}/login`,
            ...extra,
        };
    }

    static async request (endpoint: string, body: object, extraHeaders: Record<string, string> = {}) {
        const res = await net.fetch(`https://${Constants.AuthDomain}/api/v9${endpoint}`, {
            method: "POST",
            headers: UserAuth.headers(extraHeaders),
            body: JSON.stringify(body),
        });
        let data: Record<string, unknown> = {};
        try {
            data = (await res.json()) as Record<string, unknown>;
        } catch {
            //
        }
        return { res, data };
    }

    /** Turn a raw Discord auth response into an AuthResult */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static async handleResponse (data: Record<string, any>, status: number): Promise<AuthResult> {
        if (data.captcha_key) {
            return {
                status: "captcha",
                sitekey: data.captcha_sitekey ?? "",
                service: data.captcha_service ?? "hcaptcha",
                rqdata: data.captcha_rqdata ?? null,
                rqtoken: data.captcha_rqtoken ?? null,
            };
        }
        if (data.mfa === true || (data.ticket && !data.token)) {
            const methods = Array.isArray(data.mfa_methods)
                ? data.mfa_methods
                : [
                    data.totp && { type: "totp" },
                    data.sms && { type: "sms" },
                    data.backup && { type: "backup" },
                ].filter(Boolean);
            return { status: "mfa", ticket: data.ticket, methods: methods as { type: string }[] };
        }
        if (typeof data.token === "string" && data.token) {
            const account = await UserAuth.store(data.token);
            return { status: "success", token: data.token, account };
        }
        const fieldError = UserAuth.firstFieldError(data.errors);
        return {
            status: "error",
            message: fieldError ?? (typeof data.message === "string" ? data.message : `HTTP ${status}`),
            code: typeof data.code === "number" ? data.code : undefined,
        };
    }

    static firstFieldError (errors: unknown): string | null {
        if (!errors || typeof errors !== "object") return null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const value of Object.values(errors as Record<string, any>)) {
            if (value?._errors?.[0]?.message) return value._errors[0].message as string;
            const nested = UserAuth.firstFieldError(value);
            if (nested) return nested;
        }
        return null;
    }

    /** Fetch the profile behind a token and persist it as a user account */
    static async store (token: string): Promise<SavedAccount> {
        let account: SavedAccount = { id: null, username: "Unknown", avatar: null, token, addedAt: Date.now() };
        try {
            const res = await net.fetch(`https://${Constants.AuthDomain}/api/v9/users/@me`, {
                headers: UserAuth.headers({ authorization: token }),
            });
            if (res.ok) {
                const user = (await res.json()) as { id: string; username: string; avatar: string | null };
                account = { ...account, id: user.id, username: user.username, avatar: user.avatar };
            }
        } catch (e) {
            logger.warn("Could not fetch the profile of the new token:", e);
        }
        UserAuth.tokens.add(token);
        UserAuth.accounts = [...UserAuth.without(account), account];
        UserAuth.save();
        logger.info("Stored user account:", account.username, account.id);
        return account;
    }

    /**
     * Sign in with an account token that was obtained elsewhere, instead of an email and a
     * password. The token is checked against `/users/@me` first: an invalid one would
     * otherwise be stored and fail later, with nothing to explain why.
     */
    static async loginWithToken (token: string): Promise<AuthResult> {
        const bare = token.trim();
        if (!bare) return { status: "error", message: "Colle un token de compte." };
        if (isBotShaped(bare)) {
            return {
                status: "error",
                message: "Ce champ attend un token de compte. Un token de bot se colle sur l'écran de connexion.",
            };
        }
        try {
            const res = await net.fetch(`https://${Constants.AuthDomain}/api/v9/users/@me`, {
                headers: UserAuth.headers({ authorization: bare }),
            });
            if (res.status === 401) {
                return { status: "error", message: "Token refusé par Discord : il est invalide ou expiré." };
            }
            if (!res.ok) {
                return { status: "error", message: `Discord a répondu ${res.status}.` };
            }
            const account = await UserAuth.store(bare);
            return { status: "success", token: bare, account };
        } catch (e) {
            logger.error("Connexion par token échouée:", e);
            return { status: "error", message: (e as Error).message };
        }
    }

    /**
     * Remember a bot token so it shows up next to the accounts. Unlike `store`, the
     * token is *not* added to `tokens`: the API server must keep prefixing it with `Bot `.
     */
    static async storeBot (token: string): Promise<SavedAccount> {
        const bare = token.replace(/^Bot\s+/i, "").trim();
        let account: SavedAccount = { id: null, username: "Bot", avatar: null, token: bare, addedAt: Date.now(), bot: true };
        try {
            const res = await net.fetch(`https://${Constants.AuthDomain}/api/v9/users/@me`, {
                headers: {
                    authorization: `Bot ${bare}`,
                    "user-agent": Constants.UserAgentDiscordBot,
                },
            });
            if (res.ok) {
                const user = (await res.json()) as { id: string; username: string; avatar: string | null };
                account = { ...account, id: user.id, username: user.username, avatar: user.avatar };
            }
        } catch (e) {
            logger.warn("Impossible de lire le profil du bot:", e);
        }
        UserAuth.accounts = [...UserAuth.without(account), account];
        UserAuth.save();
        logger.info("Bot enregistré:", account.username, account.id);
        return account;
    }

    static async login ({ login, password, captchaKey, captchaRqtoken }: LoginPayload): Promise<AuthResult> {
        if (!login || !password) {
            return { status: "error", message: "L’adresse e-mail (ou le téléphone) et le mot de passe sont obligatoires." };
        }
        try {
            const { res, data } = await UserAuth.request(
                "/auth/login",
                {
                    login,
                    password,
                    undelete: false,
                    login_source: null,
                    gift_code_sku_id: null,
                    ...(captchaKey ? { captcha_key: captchaKey } : {}),
                    ...(captchaRqtoken ? { captcha_rqtoken: captchaRqtoken } : {}),
                },
                captchaRqtoken ? { "x-captcha-rqtoken": captchaRqtoken, "x-captcha-key": captchaKey ?? "" } : {},
            );
            return UserAuth.handleResponse(data, res.status);
        } catch (e) {
            logger.error("Login request failed:", e);
            return { status: "error", message: (e as Error).message };
        }
    }

    static async mfa ({ ticket, code, method = "totp" }: MfaPayload): Promise<AuthResult> {
        if (!code) return { status: "error", message: "Un code de vérification est obligatoire." };
        try {
            const { res, data } = await UserAuth.request(`/auth/mfa/${method}`, {
                ticket,
                code: code.replace(/\s/g, ""),
                login_source: null,
                gift_code_sku_id: null,
            });
            return UserAuth.handleResponse(data, res.status);
        } catch (e) {
            logger.error("MFA request failed:", e);
            return { status: "error", message: (e as Error).message };
        }
    }

    /** Ask Discord to send the SMS code for a pending MFA ticket */
    static async sendSms (ticket: string) {
        try {
            const { res, data } = await UserAuth.request("/auth/mfa/sms/send", { ticket });
            if (res.ok) return { success: true, phone: (data as { phone?: string }).phone ?? null };
            return { success: false, message: (data as { message?: string }).message ?? `HTTP ${res.status}` };
        } catch (e) {
            return { success: false, message: (e as Error).message };
        }
    }
}

/** A token already carrying the bot prefix was pasted in the wrong field. */
function isBotShaped (token: string): boolean {
    return /^Bot\s+/i.test(token);
}

export default UserAuth;
