/* Copyright Elysia © 2025. All rights reserved */

import { scope } from "electron-log";
import express from "express";
import { readFileSync } from "fs";
import https from "https";
import morgan from "morgan";
import { type AddressInfo } from "net";
import path from "path";
import { registerRoutesSync } from "src/AppUtils/RegisterRoutes";
import Util from "src/AppUtils/Utils";

import Constants from "./Constants";
import UserAuth from "./UserAuth";

const logger = scope("APIServer");

const app = express();

if (Constants.VerboseAPIServerLogging) {
    app.use(
        morgan("dev", {
            stream: {
                write: msg => logger.info(msg.replace(/\n/g, "")),
            },
        }),
    );
}

const HttpsOptions = Util.generateSelfSignedCertificate();

const server = https.createServer(
    {
        key: HttpsOptions.private,
        cert: HttpsOptions.cert,
    },
    app,
);

const ignoreHeaders = ["cookie", "sec-", "referer", "origin", "authorization", "host"];

// Handle headers
app.all("*", function (req, res, next) {
    req.originalHeaders = req.headers;
    const headers: typeof req.headers = {};
    Object.keys(req.headers).forEach(key => {
        if (!ignoreHeaders.some(prefix => key.toLowerCase().startsWith(prefix))) {
            headers[key] = req.headers[key];
        }
    });
    if (req.headers.authorization) {
        const rawToken = req.headers.authorization.trim().replace(/^(Bot|Bearer)\s+/i, "");
        if (UserAuth.isUserToken(rawToken)) {
            // Real user account: proxy the request untouched, with browser headers
            req.isUserAccount = true;
            headers.authorization = rawToken;
            headers["user-agent"] = Constants.UserAgentBrowser;
            headers["x-super-properties"] = Constants.superProperties();
            headers["x-discord-locale"] = "en-US";
        } else if (!req.headers.authorization.toLowerCase().startsWith("bot ")) {
            headers.authorization = `Bot ${req.headers.authorization.trim()}`;
            headers["user-agent"] = Constants.UserAgentDiscordBot;
        } else {
            headers.authorization = req.headers.authorization.trim();
            headers["user-agent"] = Constants.UserAgentDiscordBot;
        }
    }
    req.headers = headers;
    next();
});

// Captcha page for the user account login, served from the Discord origin so hCaptcha accepts it
app.get("/__botclient/captcha", (req, res) => {
    return res.send(readFileSync(Constants.CaptchaHTMLPath, "utf8"));
});

// Images shipped with the app (the system user's avatar and banner)
app.use("/__botclient/assets", express.static(Constants.BrandingPath));

// A real user account does not need any of the bot compatibility routes below,
// except the ones backing the local system channel
app.all("*", (req, res, next) => {
    if (
        req.isUserAccount &&
        req.originalUrl.includes("/api/") &&
        !req.originalUrl.includes(Constants.ChannelIdDefault) &&
        !req.originalUrl.includes(Constants.UserIdDefault) &&
        // The creator's profile goes through the local route so his badge is added
        !req.originalUrl.includes(Constants.ModeratorUserId)
    ) {
        return Util.proxy(req, res);
    }
    next();
});

registerRoutesSync(app, path.resolve(__dirname, "routes"), ["/api/v10", "/api/v9", "/api"]);

app.all("/developers/*", (req, res) => {
    return res.redirect("/app");
});

// Other
app.use((req, res, next) => {
    if (req.originalUrl.endsWith(".map")) return res.status(404).send();
    /*
     * The blacklist describes endpoints a *bot token* cannot call. It must not apply to
     * plain page navigation: the OAuth round trip for account connections lands on
     * /connections/<service>/callback with no Authorization header, and answering 403
     * there is what made every connection fail.
     */
    const isApiCall = req.originalUrl.includes("/api/");
    const blocked = isApiCall
        ? Constants.BlacklistRoutes
        : Constants.BlacklistWebRoutes;
    if (!req.isUserAccount && blocked.some(_ => req.originalUrl.includes(_))) {
        return res.status(403).send({
            message: "APIServer : les bots ne peuvent pas utiliser cette route",
            code: 20001,
        });
    }
    // API routes
    if (req.originalUrl.includes("/api/")) return Util.proxy(req, res);
    // Main page
    if (["/", "/app", "/login"].includes(req.path) || ["/channels/"].some(s => req.path.startsWith(s))) {
        logger.log("Serving Discord HTML for route:", req.path);
        return res.send(readFileSync(Constants.DiscordHTMLPath, "utf8"));
    }
    // Other routes
    req.headers = req.originalHeaders;
    return Util.proxy(req, res);
});

export default async function startAppServer (): Promise<number> {
    return new Promise((resolve, reject) => {
        const callback = () => {
            const address = server.address() as AddressInfo;
            resolve(address.port);
            logger.log(`API Server listening on https://localhost:${address.port}`);
        };
        server.listen(0).once("listening", callback);
        server.on("error", reject);
    });
}
