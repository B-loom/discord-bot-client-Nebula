/* Copyright Elysia © 2025. All rights reserved */

import { app, nativeImage } from "electron";
import path from "path";
import UserPatch from "src/AppUtils/UserPatch";

const GithubUserName = "B-loom";
const GithubRepoName = "discord-bot-client-Nebula";

export default class Constants extends null {
    static BlacklistRoutes = [
        "outbound-promotions/codes",
        "science",
        "applications/public",
        "notes",
        "member-ids",
        "connections/",
        "users/@me/disable",
        "users/@me/delete",
        "users/@me/mfa",
        "users/@me/phone",
        "interaction-data",
        "member-verification",
        "cdn-cgi/challenge-platform",
        "explicit-media",
        "premium/subscriptions",
        "/ack",
        "/stripe",
        "/paypal",
        "/validate-billing-address",
        "/custom-call-sounds",
        "auth/conditional/start", // Disable WebAuthn
    ];
    /** Blocked even outside the API: these are pages, not bot endpoints */
    static BlacklistWebRoutes = ["cdn-cgi/challenge-platform"];
    static LatestStorageUpdate = 1735000000000;
    static AppName = "Nebula";
    static AppID = "Nebula";
    static iconPath = path.join(app.getAppPath(), "assets", "icon.png");
    static icon16 = nativeImage.createFromPath(Constants.iconPath).resize({ width: 16 });
    static icon128 = nativeImage.createFromPath(Constants.iconPath).resize({ width: 128 });
    static DiscordBackgroundColor = "#36393f";
    static GithubRepo = `${GithubUserName}/${GithubRepoName}`;
    static UserAgentDiscordBot = `DiscordBot (https://github.com/${GithubUserName}/${GithubRepoName}, v${app.getVersion()})`;
    // User account login (email + password)
    static UserAgentBrowser =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
    static ChromeVersion = "131.0.0.0";
    static ClientBuildNumber = 589596;
    static AuthDomain = "canary.discord.com";
    static superProperties () {
        return Buffer.from(
            JSON.stringify({
                os: "Windows",
                browser: "Chrome",
                device: "",
                system_locale: "en-US",
                browser_user_agent: Constants.UserAgentBrowser,
                browser_version: Constants.ChromeVersion,
                os_version: "10",
                referrer: "",
                referring_domain: "",
                referrer_current: "",
                referring_domain_current: "",
                release_channel: "stable",
                client_build_number: Constants.ClientBuildNumber,
                client_event_source: null,
            }),
        ).toString("base64");
    }
    static VencordExtensionPath = path.join(app.getAppPath(), "VencordExtension");
    static DiscordHTMLPath = path.join(app.getAppPath(), "assets", "snapshot", "index.html");
    static ConfigEditorHTMLPath = path.join(app.getAppPath(), "assets", "config", "index.html");
    static AccountLoginHTMLPath = path.join(app.getAppPath(), "assets", "account", "index.html");
    static CaptchaHTMLPath = path.join(app.getAppPath(), "assets", "account", "captcha.html");
    static BrandingPath = path.join(app.getAppPath(), "assets", "branding");
    /** Nebula's own message editor, in place of the bundled Discohook build */
    static EditorHTMLFolderPath = path.join(app.getAppPath(), "assets", "nebula-editor");
    static DiscordGuildExperimentsPath = path.join(app.getAppPath(), "assets", "snapshot", "guild_experiments.json");
    static DiscordUserExperimentsPath = path.join(app.getAppPath(), "assets", "snapshot", "user_experiments.json");
    static DiscordApexExperimentsPath = path.join(app.getAppPath(), "assets", "snapshot", "apex_experiments.json");
    static UserDefaultPatch = UserPatch["47835198259200000"];
    static ChannelIdDefault = "1000000000000000000";
    static UserIdDefault = "47835198259200000"; // Snowflake du 13 mai 2015, date de creation de Discord
    static CustomDiscordDomain = "discord.com";
    static DefaultLocale = "fr-FR";
    /** This user gets the Moderator Programs Alumni badge */
    static ModeratorUserId = "1391459588930404372";
    /** Where users are sent for help, shown in the welcome message */
    static SupportInvite = "https://discord.gg/TNTYSmy4mX";
    /*
     * Discord resolves a discord.gg link itself, in the client, so a button carrying one
     * never reaches the app. This address means nothing to Discord, which therefore hands
     * it over as an ordinary external link: that is where the invite gets copied.
     */
    static CopyInviteUrl = "https://nebula.invalid/copier-invitation";
    /** The project page, linked from the welcome message */
    static ProjectSiteUrl = "https://b-loom.github.io/discord-bot-client-Nebula/";
    /** This fork's own repository, linked from the welcome message */
    static ProjectRepoUrl = "https://github.com/B-loom/discord-bot-client-Nebula";
    /*
     * Buttons may only carry an emoji Discord knows, so two ids are reserved here and
     * their pictures are redirected to files shipped with the app, the same way the
     * system user's avatar and Nebula's badge already are.
     */
    static DiscordEmojiId = "1000000000000000001";
    static GithubEmojiId = "1000000000000000002";
    static SiteEmojiId = "1000000000000000003";
    static DefaultBio = "<a:emoji_1:1399479404706660373> Nebula on top";
    static VerboseAPIServerLogging = false; // Journaliser chaque requête coûte du processeur et des écritures disque
    // Database
    static DirectMessages = {
        name: "DMsData",
        path: "DirectMessages",
    };
    static PreloadedUserSettings = {
        name: "UserSettingsProto1",
        path: "PreloadedUserSettings",
    };
    static FrecencyUserSettings = {
        name: "UserSettingsProto2",
        path: "FrecencyUserSettings",
    };
    // Chromium Features
    static enableFeatures = [];
    static disableFeatures = [
        "CalculateNativeWinOcclusion",
        "OutOfBlinkCors",
        "WinRetrieveSuggestionsOnlyOnDemand",
        "HardwareMediaKeyHandling",
        "MediaSessionService",
        // Chromium services Nebula never uses, each of which costs a background task
        "MediaRouter", // découverte Cast sur le réseau local
        "OptimizationHints", // téléchargement périodique de règles Google
        "Translate",
        "AutofillServerCommunication",
        "InterestFeedContentSuggestions",
    ];
    /** Cap the on-disk cache: Chromium's default grows into the hundreds of megabytes. */
    static DiskCacheBytes = 64 * 1024 * 1024;
}
