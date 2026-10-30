/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/*
! Todo: These are the things I need to fix every time I update Vencord and Discord.
Ref: https://github.com/aiko-chan-ai/DiscordBotClient/issues/183
*/
import "./styles.css";


import { ChatBarButton, ChatBarButtonFactory } from "@api/ChatButtons";
import { ApplicationCommandInputType, ApplicationCommandOptionType, findOption, sendBotMessage } from "@api/Commands";
import { definePluginSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { Paragraph } from "@components/Paragraph";
import { getCurrentChannel, getCurrentGuild } from "@utils/discord";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType } from "@utils/types";
import { Channel, Guild, Role, type UserStore as UserStoreType } from "@vencord/discord-types";
import { DraftType, MessageFlags } from "@vencord/discord-types/enums";
import { findByCodeLazy, findByProps, findByPropsLazy, findStore } from "@webpack";
import {
    Alerts,
    ChannelStore,
    Constants,
    DraftStore,
    EmojiStore,
    FluxDispatcher,
    GuildMemberStore,
    GuildRoleStore,
    GuildStore,
    IconUtils,
    Menu,
    MessageActions,
    NavigationRouter,
    PermissionsBits,
    PresenceStore,
    React,
    RestAPI,
    UserStore,
    VoiceStateStore
} from "@webpack/common";

import SettingsPlugin from "@plugins/_core/settings";

import AuthBoxMultiTokenLogin, { multiTokenState } from "./components/AuthBoxMultiTokenLogin";
import AuthBoxTokenLogin from "./components/AuthBoxTokenLogin";
import { blockUnavailableModals } from "./components/BlockedModals";
import { listenForScreenShare } from "./components/ScreenSharePicker";
import NebulaTab, { BotBillingTab, ChangelogTab, NebulaIcon, ReadmeTab } from "./components/NebulaTab";
// Components
import { IconEmbedSvg } from "./icon.svg";
import type { EmojiGuildData, Group, List, MemberPatch, OpItem, Ops } from "./typing/index.d.ts";
import { buildDiscordAPIErrorMessage, originalSessionStorage, RegExToken } from "./utils/common";
import db from "./utils/database";
import { hasEmbedPerms } from "./utils/fakeNitroPlugin";
import { doIdentifyFirstPatch, handleClosePatch, handleDispatchPatch, isUserAccountSession, openPrivateChannelPatch, updateGuildSubscriptionsPatch, voiceStateUpdatePatch } from "./utils/patches";
import { SnowflakeUtil } from "./utils/SnowflakeUtil";
import { showToast, Toasts } from "./utils/toasts";
import { PendingReplyStore, uploadFile } from "./utils/voiceMessagePlugin";

/** The local channel served by the app itself, which is always present and cannot be closed */
const SystemChannelId = "1000000000000000000";

/** How many accounts the switcher keeps, in place of Discord's five */
const ACCOUNT_SWITCHER_LIMIT = 100;

/** Identifies Nebula's activity among the rich-presence sources Discord tracks */
const NEBULA_ACTIVITY_SOCKET = "nebula-games";

let buildLayoutOriginal: ((builder: any) => any) | null = null;

/*
 * Wrapped once, at module level: rebuilding these on every settings open would
 * hand React brand new component types each time, remounting the whole panel.
 */
const AboutPage = ErrorBoundary.wrap(NebulaTab, { displayName: "NebulaTab" });
const DocPage = ErrorBoundary.wrap(ReadmeTab, { displayName: "NebulaReadme" });
const ChangesPage = ErrorBoundary.wrap(ChangelogTab, { displayName: "NebulaChangelog" });
const UnavailablePage = ErrorBoundary.wrap(BotBillingTab, { displayName: "NebulaUnavailable" });

const GetToken = findByPropsLazy("getToken", "setToken");
const LoginToken = findByPropsLazy("loginToken", "login");
const murmurhash = findByPropsLazy("v3", "v2");
const GetApplicationId = findByPropsLazy("getToken", "getId", "getSessionId");

const getDraft = (channelId: string) => DraftStore.getDraft(channelId, DraftType.ChannelMessage);

const BotClientLogger = new Logger("BotClient", "#f5bde6");
/** Filled on first use, the switcher asks for it on every render */
let cachedBotAccountIds: Set<string> | null = null;

// PermissionStore.computePermissions is not the same function and doesn't work here
const computePermissions: (options: {
    user?: { id: string; } | string | null;
    context?: Guild | Channel | null;
    overwrites?: Channel["permissionOverwrites"] | null;
    roles?: undefined; // !?
    checkElevated?: boolean /* = true */;
    excludeGuildPermissions?: boolean /* = false */;
}) => bigint = findByCodeLazy(".getCurrentUser()", ".computeLurkerPermissionsAllowList()");
/*
function M(e) {
    var t, n, r;
    let i, {
        user: a,
        context: o,
        overwrites: s,
        roles: l,
        checkElevated: u = !0,
        excludeGuildPermissions: p = !1
    } = e;
    if (null == a) return T;
    let g = "string" == typeof a ? a : a.id,
        y = N;
    if (o instanceof f.Sf) {
        if (o.isScheduledForDeletion()) return T;
        if (f.Ec.has(o.type)) {
            let e = h.Z.getChannel(o.parent_id);
            if (null == e || e.isScheduledForDeletion()) return T;
            let t = g === (null == (n = b.default.getCurrentUser()) ? void 0 : n.id) && d.Z.hasJoined(o.id);
            return j(o, M({
                user: a,
                context: e,
                overwrites: s,
                roles: l,
                checkElevated: u,
                excludeGuildPermissions: p
            }), t)
        }
        y = null != (r = o.computeLurkerPermissionsAllowList()) ? r : y, s = null != s ? I({}, o.permissionOverwrites, s) : o.permissionOverwrites;
        let e = o.getGuildId();
        i = null != e ? E.Z.getGuild(e) : null
    } else s = null != s ? s : {}, i = o;
    if (null == i) return T;
    if (!(g === (null == (t = b.default.getCurrentUser()) ? void 0 : t.id) && c.Z.isViewingRoles(i.id)) && (0, _.eM)(i, g)) return D(S, i, g, u);
    let O = m.ZP.getMember(i.id, g);
    return x({
        userId: g,
        member: O,
        guild: i,
        overwrites: s,
        roles: l,
        checkElevated: u,
        excludeGuildPermissions: p,
        lurkerPermissionsMask: y
    })
}*/

let currentMessageHandler: ((event: MessageEvent) => Promise<void>) | null = null;

// Member-list updaters, bound to the plugin in start() (flux handlers run with `this` = the flux object, not the plugin, so they call these instead)
let funcUpdateGuildMembersList: ((location: string, data?: any) => void) | null = null;
let updateGuildMembersListDirect: ((location: string, data?: any) => void) | null = null;

const requestOpenMessageEditorWindow = (
    channelId: string,
    messageId: string | null,
    mode: "create" | "edit",
    hasComponentV2: boolean,
    initMessage: any,
) => {
    if (currentMessageHandler) {
        window.removeEventListener("message", currentMessageHandler);
        currentMessageHandler = null;
    }
    window.BotClientNative.requestOpenMessageEditorWindow();
    const onWindowMessage = async (event: MessageEvent) => {
        if (event.source === window && event.data === "forward-editor-port") {
            // Handshake done: the window listener fired once to receive the port, so detach it to avoid leaking a listener per editor window
            window.removeEventListener("message", onWindowMessage);
            if (currentMessageHandler === onWindowMessage) currentMessageHandler = null;
            const port = event.ports[0];
            window.editorPort?.close();
            window.editorPort = port;
            port.onmessage = async event => {
                BotClientLogger.info("Received message from Editor", event.data);
                const webMessage = event.data as {
                    action: "send" | "edit";
                    profile: {
                        username: string;
                        avatar_url: string;
                        token: string;
                    };
                    messages: { _id: string; data: any; }[];
                    files: { name; size; type; buffer: ArrayBuffer; }[];
                    type: string;
                };
                if (webMessage.type === "submit") {
                    if (webMessage.files.length > 0) {
                        showToast("Uploading attachments... Please be patient", Toasts.Type.MESSAGE);
                    }
                    const attachments: {
                        id: string;
                        filename: string;
                        uploaded_filename: string;
                    }[] = [];
                    for (let index_file = 0; index_file < webMessage.files.length; index_file++) {
                        const f = webMessage.files[index_file];
                        const blob = new Blob([f.buffer], { type: f.type });
                        await uploadFile(channelId, f.name, f.type, blob)
                            .then(res => {
                                attachments.push({
                                    id: index_file.toString(),
                                    filename: res.filename,
                                    uploaded_filename: res.uploadedFilename,
                                });
                            })
                            .then(() => {
                                BotClientLogger.info(
                                    `File uploaded: ${f.name} (${f.size} bytes) - ${index_file + 1}/${webMessage.files.length}`,
                                );
                            })
                            .catch(e => {
                                BotClientLogger.error(e);
                                showToast(`Failed to upload file: ${f.name}`, Toasts.Type.FAILURE);
                            });
                    }
                    const message = webMessage.messages[0].data;
                    if (webMessage.action === "send") {
                        RestAPI.post({
                            url: Constants.Endpoints.MESSAGES(channelId),
                            body: {
                                ...message,
                                attachments,
                            },
                        })
                            .then(() => {
                                // Clear draft after sending message
                                // Clear reply
                                FluxDispatcher.dispatch({ type: "DELETE_PENDING_REPLY", channelId });
                                // Clear Draft message
                                FluxDispatcher.dispatch({
                                    type: "DRAFT_CLEAR",
                                    channelId,
                                    draftType: DraftType.ChannelMessage,
                                });
                                // Clear attachments
                                FluxDispatcher.dispatch({
                                    type: "UPLOAD_ATTACHMENT_CLEAR_ALL_FILES",
                                    channelId,
                                    draftType: DraftType.ChannelMessage,
                                });
                                return showToast("Message has been sent successfully", Toasts.Type.SUCCESS);
                            })
                            .catch(e => {
                                return sendBotMessage(channelId, {
                                    content: `❌ An error occurred during sending message\n${buildDiscordAPIErrorMessage(e.body)}`,
                                });
                            });
                    } else if (webMessage.action === "edit") {
                        RestAPI.patch({
                            url: Constants.Endpoints.MESSAGE(channelId, messageId),
                            body: {
                                // Clear content and embeds if they are not included in the edited message to prevent duplication since Editor always sends the full message object instead of just the diff
                                content: null,
                                embeds: [],
                                ...message,
                                attachments,
                            },
                        })
                            .then(() => {
                                return showToast("Message has been edited successfully!", Toasts.Type.SUCCESS);
                            })
                            .catch(e => {
                                return sendBotMessage(channelId, {
                                    content: `❌ An error occurred during editing message\n${buildDiscordAPIErrorMessage(e.body)}`,
                                });
                            });
                    }
                }
            };
            const currentUser = UserStore.getCurrentUser();
            port.start();
            // Initial data for Editor
            // Emojis
            const emojis: EmojiGuildData[] = [];
            // Application Emojis
            if (window.applicationEmojis && Array.isArray(window.applicationEmojis)) {
                emojis.push({
                    guild_id: null,
                    icon_url: currentUser.getAvatarURL(),
                    name: "Application Emojis",
                    emojis: window.applicationEmojis,
                });
            }
            for (const guild of GuildStore.getGuildsArray()) {
                const obj: EmojiGuildData = {
                    guild_id: guild.id,
                    name: guild.name,
                    icon_url: IconUtils.getGuildIconURL({
                        id: guild.id,
                        icon: guild.icon,
                        size: 512,
                        canAnimate: true,
                    }),
                    emojis: [],
                };
                const guildEmojis = EmojiStore.getUsableGuildEmoji(guild.id);
                for (const emoji of guildEmojis) {
                    obj.emojis.push({
                        id: emoji.id,
                        name: emoji.name,
                        animated: emoji.animated,
                    });
                }
                emojis.push(obj);
            }
            const initData = {
                type: "init",
                profile: {
                    username: currentUser.username,
                    avatar_url: currentUser.getAvatarURL(),
                    token: "<not actually used>",
                },
                mode: {
                    type: mode, // create | edit
                    messageType: hasComponentV2 ? "components-v2" : "standard", // standard | components-v2
                },
                messages: [
                    {
                        data: initMessage,
                        _id: crypto.randomUUID(), // Just a random ID for Editor to identify the message, not related to actual Discord message ID
                    },
                ],
                emojis,
                timestamp: Date.now(),
                timestring: new Date().toLocaleString(),
            };
            BotClientLogger.info("Posting initial data to Editor", initData);
            port.postMessage(initData);
        }
    };
    currentMessageHandler = onWindowMessage;
    window.addEventListener("message", onWindowMessage);
};

const CreateAdvancedMessageEditor: ChatBarButtonFactory = prop => {
    // The editor sends through the bot's REST credentials: it has no meaning on a user account
    if (isUserAccountSession()) return null;
    const handle = () => {
        const channelId = prop.channel.id;
        // New message
        if (channelId.length < 17) {
            return Toasts.show({
                id: Toasts.genId(),
                message: `Cannot send embed in this channel (analyticsName: ${prop.type.analyticsName})`,
                type: Toasts.Type.FAILURE,
            });
        }
        if (!hasEmbedPerms(channelId)) {
            return Alerts.show({
                title: "Hold on!",
                body: (
                    <div>
                        <Paragraph>
                            You are trying to send a embed, however you do not have permissions to embed links in the
                            current channel.
                        </Paragraph>
                    </div>
                ),
            });
        }
        // idk how to pass attachments to Editor
        const reply = PendingReplyStore.getPendingReply(channelId);
        const content = getDraft(channelId) || undefined;
        requestOpenMessageEditorWindow(channelId, null, "create", false, {
            content,
            message_reference: reply ? MessageActions.getSendMessageOptionsForReply(reply)?.messageReference : null,
        });
    };
    return (
        <ChatBarButton onClick={handle} tooltip="Éditeur de message Nebula">
            <IconEmbedSvg />
        </ChatBarButton>
    );
};

const EditAdvancedMessageEditor = msg => {
    const handler = async () => {
        showToast("Fetching message...", Toasts.Type.MESSAGE, {
            position: Toasts.Position.TOP,
        });
        // Fetch raw msg from discord
        const msgRaw = await RestAPI.get({
            url: Constants.Endpoints.MESSAGE(msg.channel_id, msg.id),
        });
        const channelId = msg.channel_id;
        const messageId = msg.id;
        requestOpenMessageEditorWindow(
            channelId,
            messageId,
            "edit",
            (msgRaw.body.flags & MessageFlags.IS_COMPONENTS_V2) !== 0,
            msgRaw.body,
        );
    };
    if (!isUserAccountSession() && msg.author.id === GetApplicationId.getId()) {
        return {
            label: "Éditeur de message Nebula",
            icon: IconEmbedSvg,
            message: msg,
            channel: ChannelStore.getChannel(msg.channel_id),
            onClick: handler,
            onContextMenu: handler,
        };
    } else {
        return null;
    }
};

const settings = definePluginSettings({
    showMemberList: {
        description: "Allow fetching member list sidebar",
        type: OptionType.BOOLEAN,
        default: true,
        restartNeeded: false,
    },
    memberListThrottleDelay: {
        description: "The interval at which the member list sidebar is updated (seconds)",
        type: OptionType.NUMBER,
        default: 2,
        restartNeeded: false,
    },
    embedChatButton: {
        description: "Add a button to show the Embed Editor modal in the chat bar",
        type: OptionType.BOOLEAN,
        default: true,
        restartNeeded: true,
    },
    embedEditMessageButton: {
        description: "Add a button to show Embed Editor modal in messages",
        type: OptionType.BOOLEAN,
        default: true,
        restartNeeded: true,
    },
    saveDirectMessage: {
        description:
            "Whether or not to save private channels to storage? If disabled, all cached private channels will be cleared",
        type: OptionType.BOOLEAN,
        default: true,
        restartNeeded: false,
        onChange: (value: boolean) => {
            if (!value) db.clearDMsCache(GetApplicationId.getId());
        },
    },
    overrideVoiceChannelBitrate: {
        description:
            "Enable bitrate override for voice channels you join. Higher bitrate may increase network usage.",
        type: OptionType.BOOLEAN,
        default: false,
        onChange: (value: boolean) => {
            if (value) {
                const kbps = settings.store.bitrateVoiceChannel;
                BotClientLogger.log(`[Enable Override] Set default voice channel bitrate to ${kbps} kbps`);
                FluxDispatcher.dispatch({
                    type: "SET_CHANNEL_BITRATE",
                    bitrate: Math.floor(kbps * 1000),
                });
                showToast("Voice channel bitrate override enabled", Toasts.Type.SUCCESS);
                showToast(
                    "For the best voice quality, please disable echo cancellation and Krisp.",
                    Toasts.Type.SUCCESS,
                );
            } else {
                // Get current voice channel bitrate
                const channelId = VoiceStateStore.getVoiceStateForUser(GetApplicationId.getId())?.channelId;
                if (!channelId) return;
                const channel = ChannelStore.getChannel(channelId);
                BotClientLogger.log(`[Disable Override] Set voice channel bitrate to ${channel?.bitrate} bps`);
                showToast("Voice channel bitrate override disabled", Toasts.Type.SUCCESS);
                FluxDispatcher.dispatch({
                    type: "SET_CHANNEL_BITRATE",
                    bitrate: channel.bitrate,
                });
            }
        },
    },
    bitrateVoiceChannel: {
        description: "Set the default bitrate for voice channels you join (in kbps)",
        type: OptionType.NUMBER,
        default: 128,
        hidden: true,
        onChange: (kbps: number) => {
            BotClientLogger.log(`[Command] Set default voice channel bitrate to ${kbps} kbps`);
            FluxDispatcher.dispatch({
                type: "SET_CHANNEL_BITRATE",
                bitrate: Math.floor(kbps * 1000),
            });
        },
    },
});

export default definePlugin({
    name: "Nebula",
    description: "Permet d'utiliser des comptes Discord et des bots dans ce client",
    authors: [
        {
            name: "Nebula",
        },
    ],
    enabledByDefault: true,
    dependencies: ["UserSettingsAPI"],
    settings,
    required: true,
    patches: [
        // AuthBox (Token)
        {
            // ???
            find: '"username webauthn"',
            replacement: [
                {
                    // #region Example code for reference
                    /** Function: renderDefaultForm(e){...} -> function iv(e) { ... } ???
                    function iv(e) {
                        let t, {invite: n, guildTemplate: i, giftCode: l, authBoxClassName: s, disableAutofocusOnDefaultForm: r, login: c, password: h, errors: g, loginSource: x, dismissedChooseAccount: f, setDismissedChooseAccount: p, conditionalMediationAbortController: A, onLoginChange: E, onPasswordChange: _, handleLogin: j, handleForgotPassword: N, handleGotoRegister: v} = e, C = (0,
                        m.bG)([eE.A], () => eE.A.getCountryCode()), I = (0,
                        m.bG)([eQ.default], () => eQ.default.getLoginStatus()), S = (0,
                        m.bG)([ig.A], () => ig.A.getHasLoggedInAccounts()), y = o.useCallback(e => {
                            T.default.track(b.HAw.LOGIN_SUCCESSFUL, {
                                source: b.mdB.QR_CODE,
                                login_source: x,
                                gift_code_sku_id: l?.skuId ?? null,
                                is_new_user: !1,
                                login_method: "remote_auth",
                                login_instance_id: e ?? null
                            })
                        }
                        , [x, l]), {handoff_token: R} = (0,
                        d.parse)(window.location.search), O = u.Fr && u.KY && null != R, L = null == g.email && null != g.password, D = o.useRef(null), P = o.useRef(null), w = (0,
                        n7.A)(g);
                        o.useEffect( () => {
                            let e = e => null != g[e];
                            null != w && w !== g && (e("password") ? P.current?.focus() : (e("email") || e("login")) && D.current?.focus())
                        }
                        , [g, D, P, w]),
                        t = null != n ? (0,
                        a.jsx)("div", {
                            className: Q.S3,
                            children: (0,
                            a.jsx)(n6.A, {
                                invite: n
                            })
                        }) : null != l ? (0,
                        a.jsx)(n1, {
                            giftCode: l
                        }) : (0,
                        a.jsxs)("div", {
                            className: n8.wx,
                            children: [(0,
                            a.jsx)(k.hE, {
                                className: Q.QB,
                                children: z.intl.string(z.t["7fNJgA"])
                            }, "title"), !1 === (0,
                            tY.isAndroidWeb)() ? (0,
                            a.jsx)(k.tK, {
                                children: z.intl.string(z.t.euS7r4)
                            }, "subtitle") : null]
                        });
                        let G = (0,
                        a.jsxs)("div", {
                            className: n8.Eh,
                            children: [S && f && (0,
                            a.jsx)("div", {
                                className: n8.AX,
                                children: (0,
                                a.jsx)(V.$, {
                                    onClick: () => p(!1),
                                    variant: "secondary",
                                    text: z.intl.string(z.t["1MrpWO"]),
                                    icon: nl.n
                                })
                            }), t, (0,
                            a.jsx)(n4.F, {
                                children: (0,
                                a.jsxs)(k.eB, {
                                    className: Q.QX,
                                    children: [(0, <- Here => Replace this line (children: [) with children:[$self.renderTokenLogin()],children_:[
                                    a.jsx)(e_.A, {
                                        alpha2: C.alpha2,
                                        countryCode: C.code.split(" ")[0],
                                        className: Q.SX,
                                        label: z.intl.string(z.t.tUjnxr),
                                        error: iN("login", g) ?? iN("email", g),
                                        onChange: E,
                                        setRef: D,
                                        autoCapitalize: "none",
                                        autoComplete: "username webauthn",
                                        autoCorrect: "off",
                                        spellCheck: "false",
                                        value: c,
                                        autoFocus: !L && !O && !r,
                                        required: !0
                                    }), (0,
                                    a.jsx)(k.pd, {
                                        label: z.intl.string(z.t["CIGa+7"]),
                                        error: iN("password", g),
                                        onChange: _,
                                        name: "password",
                                        type: "password",
                                        setRef: P,
                                        autoComplete: "current-password",
                                        spellCheck: "false",
                                        autoFocus: L && !O && !r,
                                        value: h,
                                        required: !0
                                    }), (0,
                                    a.jsx)("div", {
                                        className: B()(Q.SX, Q.a5),
                                        children: (0,
                                        a.jsx)(ec.Q, {
                                            text: z.intl.string(z.t.wWIufs),
                                            textVariant: "text-sm/normal",
                                            onClick: () => {
                                                null != D.current && D.current.focus(),
                                                N()
                                            }
                                        })
                                    }), (0,
                                    a.jsx)("div", {
                                        className: Q.QB,
                                        children: (0,
                                        a.jsx)(V.$, {
                                            text: z.intl.string(z.t.dKhVQN),
                                            fullWidth: !0,
                                            type: "submit",
                                            loading: I === b.aUe.LOGGING_IN
                                        })
                                    }), (0,
                                    a.jsxs)("div", {
                                        className: Q.a5,
                                        children: [(0,
                                        a.jsx)("span", {
                                            className: n8.Qt,
                                            children: z.intl.string(z.t.tmE73r)
                                        }), (0,
                                        a.jsx)("span", {
                                            className: n8.Z8,
                                            children: (0,
                                            a.jsx)(ec.Q, {
                                                text: z.intl.string(z.t.pV8xeR),
                                                textVariant: "text-sm/normal",
                                                onClick: v
                                            })
                                        })]
                                    })]
                                })
                            })]
                        });
                        return null != n && n.state === b.elq.RESOLVING ? (0,
                        a.jsx)(i_, {
                            authBoxClassName: s,
                            country: C,
                            login: c,
                            password: h,
                            onLoginChange: E,
                            onPasswordChange: _,
                            loginRef: D,
                            passwordRef: P
                        }) : null != i ? i.state === ij.QB.RESOLVING ? (0,
                        a.jsx)(i_, {
                            authBoxClassName: s,
                            country: C,
                            login: c,
                            password: h,
                            onLoginChange: E,
                            onPasswordChange: _,
                            loginRef: D,
                            passwordRef: P
                        }) : (0,
                        a.jsx)(ie, {
                            onSubmit: j,
                            tag: "form",
                            className: B()(s, n8.Sy),
                            children: () => [(0,
                            a.jsx)(it.A, {
                                guildTemplate: i
                            }, "template"), (0,
                            a.jsx)(o.Fragment, {
                                children: G
                            }, "form-wrapper")]
                        }) : S && !f ? (0,
                        a.jsx)(iE, {
                            onDismiss: () => p(!0)
                        }) : (0,
                        a.jsxs)("div", {
                            children: [(0,
                            a.jsx)(k.Ay, {
                                onSubmit: j,
                                tag: "form",
                                className: B()(s, {
                                    [n8.M0]: O
                                }),
                                expanded: !0,
                                children: (0,
                                a.jsxs)(eR.B, {
                                    direction: "horizontal",
                                    align: "center",
                                    gap: 64,
                                    children: [G, (0,
                                    a.jsx)(n9.A, { <- QR Login component
                                        onAuthenticateSuccess: y,
                                        conditionalMediationAbortController: A
                                    })]
                                })
                            }), O && (0,
                            a.jsx)(im, {})]
                        })
                    }
                    */
                    // #endregion
                    match: /(?<=\{className:\i\.\i,)children:\[(?=\(0,\i\.\i\)\(\i\.\i,\{alpha2:)/,
                    replace: "children:[$self.renderTokenLogin()],children_:[",
                },
            ],
        },
        // Disable QR login
        {
            find: "https://discord.com/ra/",
            replacement: {
                match: /(function \i\(\i\)\{)(?=let\{onAuthenticateSuccess:)/,
                replace: "$1return null;",
            },
        },
        // AuthBox2 (Switch Account)
        {
            find: 'componentWillUnmount(){window.removeEventListener("keydown",this.handleTabOrEnter),this.state.conditionalMediationAbortController.abort()}',
            replacement: [
                {
                    // {className:F.Eh,children:(0,n.jsxs)(b.eB,{children:[(0,n.jsx)(A.A,{alpha2:t.alpha2
                    match: /children:\[(?=\(0,[\w.]+\)\([\w.]+,{alpha2:)/,
                    replace: function (str, ...args) {
                        return "children:[$self.renderTokenLoginMultiAccount()],children_:[";
                    },
                },
                {
                    // Button "Continue"
                    match: "onClick:this.handleLogin,",
                    replace: "onClick:$self.validateTokenAndLogin,onClick_:this.handleLogin,",
                },
                {
                    // gap:32,children:[this.renderDefaultForm(),(0,r.jsx)(w.A,{onAuthenticateSuccess:this.handleQRAuthSuccess,conditionalMediationAbortController:this.state.conditionalMediationAbortController,isMultiAccount:!0})]}
                    // Remove QR login component, keep only renderDefaultForm()
                    match: /(this\.renderDefaultForm\(\)),[^\]]*?isMultiAccount:!0\}\)(?=\])/,
                    replace: "$1",
                },
            ],
        },
        {
            // Bot account caused the error
            find: "hasFetchedCredentials(){",
            replacement: [
                {
                    match: /hasFetchedCredentials\(\){/,
                    replace: "$&return true;",
                },
                {
                    match: /getCredentials\(\){return/,
                    replace: "$& [];",
                },
            ],
        },
        {
            find: "unranked_game_entries.map",
            replacement: [
                {
                    // let e=n?c?.unranked_game_entries.map(e=>e.content):c?.entries.map(e=>e.content);
                    match: /(\w+\?\w+\?\.unranked_game_entries\.map\(\w+=>\w+\.content\):\w+\?\.entries\.map\(\w+=>\w+\.content\))/,
                    replace: "[]",
                },
            ],
        },
        {
            /*
             * Discord keeps five accounts in the switcher: once a sixth is added, the
             * reducer cuts the list at index five and signs the rest out. The cap is the
             * literal in that slice, not a named constant, so both numbers are raised.
             */
            find: "tokenStatus:2,pushSyncToken:null",
            replacement: {
                match: /(\(\i=\i\)\.length>)5(&&\i\.splice\()5(\))/,
                replace: `$1${ACCOUNT_SWITCHER_LIMIT}$2${ACCOUNT_SWITCHER_LIMIT}$3`,
            },
        },
        {
            /*
             * The switcher modal refuses before the reducer ever runs: "Add an account"
             * raises an error once five accounts are listed, and a second effect clears
             * that error below five. Both comparisons and the number quoted in the
             * message carry the cap as a literal.
             */
            // Anchored on the literal being replaced: "MULTI_ACCOUNT_SWITCH_LANDING"
            // appears in several modules and sent these patches to the wrong one.
            find: "maxNumAccounts:5",
            replacement: [
                {
                    // onClick: I.length>=5 ? C(!0) : (open the login)
                    match: /(\i\.length>=)5(\?\i\(!0\))/,
                    replace: `$1${ACCOUNT_SWITCHER_LIMIT}$2`,
                },
                {
                    // useEffect: I.length<5 && C(!1)
                    match: /(\i\.length<)5(&&\i\(!1\))/,
                    replace: `$1${ACCOUNT_SWITCHER_LIMIT}$2`,
                },
                {
                    // the figure quoted back to the user in the refusal
                    match: /maxNumAccounts:5/,
                    replace: `maxNumAccounts:${ACCOUNT_SWITCHER_LIMIT}`,
                },
            ],
        },
        {
            /*
             * The account switcher lists every saved account in one flat run, which is
             * unreadable once a dozen bots sit next to the real accounts. The list is
             * reordered so users come first, and a heading is slipped in front of the
             * first entry of each group.
             */
            find: '"manage-multi-account"',
            replacement: {
                match: /(\i)\.map\(\((\i),(\i)\)=>\(0,(\i)\.jsxs\)\((\i)\.Fragment,\{children:\[/,
                replace: "($1=$self.sortAccounts($1)).map(($2,$3)=>(0,$4.jsxs)($5.Fragment,{children:[$self.accountHeader($1,$3),",
            },
        },
        {
            /*
             * Every account list reads the same hook, so sorting its result groups the
             * accounts in the switcher modal and in the quick popout alike. The hook
             * returns the stored accounts, or those accounts behind the current user
             * when it is missing from them.
             */
            find: "pushSyncToken:null},...",
            replacement: {
                match: /multiAccountUsers:(\i|\[[^\]]*\])\}/g,
                replace: "multiAccountUsers:$self.sortAccounts($1)}",
            },
        },
        {
            /*
             * Every account list ultimately reads the store, so the grouping is applied
             * where the accounts are handed out: users first, bots after. Only the
             * reading order changes; the stored order is what Discord wrote.
             */
            find: 'static persistKey="MultiAccountStore"',
            replacement: {
                match: /getUsers\(\)\{return (\i)\}/,
                replace: "getUsers(){return $self.sortAccounts($1)}",
            },
        },
        {
            /*
             * The quick popout builds one flat run of menu entries, then appends the
             * "Gérer les comptes" entry. The entries are gathered into two menu groups
             * just before that, which is how a Discord menu carries headings.
             */
            find: '"switch-accounts-submenu"',
            replacement: {
                match: /return (\i)\.push\((?=[\s\S]{0,200}id:"manage-accounts")/,
                replace: "return $1=$self.groupAccountMenu($1),$1.push(",
            },
        },
        {
            // Remove/Patch unused bot ws opcode
            find: "voiceServerPing(){",
            replacement: [
                {
                    match: /(updateGuildSubscriptions\(\w+\){)/,
                    // A user account subscribes natively, which is what fills the member list
                    replace: "$& if(!$self.isUserAccountSession())return $self.updateGuildSubscriptionsPatch(arguments[0]);",
                },
                // Leave / Switch VoiceChannel
                {
                    match: /(voiceStateUpdate\()(\w+)(\){)/,
                    replace: "$& $2 = $self.voiceStateUpdatePatch($2, this.send.bind(this));",
                },
                // Switched off for bots only: an account uses every one of these
                {
                    match: /callConnect\(((\w+,?)+)?\){/,
                    replace: "$& if(!$self.isUserAccountSession())return;",
                },
                {
                    match: /streamCreate\(((\w+,?)+)?\){/,
                    replace: "$& if(!$self.isUserAccountSession())return;",
                },
                {
                    match: /streamWatch\(((\w+,?)+)?\){/,
                    replace: "$& if(!$self.isUserAccountSession())return;",
                },
                {
                    match: /streamPing\(((\w+,?)+)?\){/,
                    replace: "$& if(!$self.isUserAccountSession())return;",
                },
                {
                    match: /streamDelete\(((\w+,?)+)?\){/,
                    replace: "$& if(!$self.isUserAccountSession())return;",
                },
                {
                    match: /streamSetPaused\(((\w+,?)+)?\){/,
                    replace: "$& if(!$self.isUserAccountSession())return;",
                },
                {
                    match: /remoteCommand\(((\w+,?)+)?\){/,
                    replace: "$& return;",
                },
            ],
        },
        {
            // Patch opcode 2 (identify) and events
            find: "window.GLOBAL_ENV.GATEWAY_ENDPOINT;",
            replacement: [
                {
                    // Patch Close code
                    // _handleClose(e,t,n){
                    match: /(_handleClose\()(\w+)(,)(\w+)(,)(\w+)(\){)/,
                    //      $1               $2  $3  $4  $5  $6    $7
                    // e = event, t = closeCode, n = reason
                    replace: "$& $4=$self.handleClosePatch($2, $4, $6);",
                },
                // Handle Events
                {
                    // _handleDispatch(e,t,n){
                    // e = data, t = eventName, n = N ???
                    match: /(_handleDispatch\()(\w+)(,)(\w+)(,)(\w+)(\){)/,
                    //      $1                  $2  $3  $4  $5  $6    $7
                    replace:
                        "$& $2=$self.handleDispatchPatch($2,$4,$6,this.dispatcher.receiveDispatch.bind(this.dispatcher),$self);if(!$2)return;",
                },
                // _doIdentify
                {
                    match: /(this\.token=)(\w+)(,)(\w+)(\.verbose\("\[IDENTIFY\]"\);)/,
                    //       $1            $2   $3  $4       $5
                    replace:
                        '$& $2=$2.replace(/bot/gi,"").trim();this.token=$2;const botInfo = await $self.doIdentifyFirstPatch($2, $self, this._handleClose.bind(this));if(!botInfo)return;',
                },
                // Sharding
                {
                    match: /(token:\w+)(,capabilities:)/,
                    replace: "$1,...$self.identifyExtra(botInfo)$2",
                },
                // QoS Heartbeat: bots only accept a null `qos`, any object closes with 4002
                {
                    // _sendHeartbeat(){let e=this._consumeQOSPayload();
                    match: /(_sendHeartbeat\(\)\{let )(\w+)(=this\._consumeQOSPayload\(\);)/,
                    //       $1                        $2   $3
                    replace: "$& $2=null;",
                },
            ],
        },
        {
            // Bot account caused the error
            find: "users_size:JSON.stringify",
            replacement: [
                {
                    match: /users_size:JSON.stringify\(\w+\)\.length/,
                    replace: "users_size:0",
                },
                {
                    match: /read_states_size:JSON.stringify\(\w+\)\.length/,
                    replace: "read_states_size:0",
                },
            ],
        },
        {
            // Bot account caused the error
            find: "notificationSettings:{",
            replacement: [
                {
                    match: /(notificationSettings:{flags:)([\w.]+)},/,
                    replace: "$1 0},",
                },
                {
                    // If user account is already logged in, proceed to log out
                    // if(e.user.bot){ (old)
                    // e.user.bot?X({type:"LOGOUT"}):E.A.ready.measure... (new)
                    match: /(\w+)\.user\.bot\?/,
                    replace: "($self.isUserAccountSession()?$1.user.bot:!$1.user.bot)?",
                },
            ],
        },
        {
            find: "STARTED_ONBOARDING=8",
            replacement: [
                {
                    match: /STARTED_ONBOARDING=8/,
                    replace: "STARTED_ONBOARDING=4294967296",
                },
            ],
        },
        // Max attachment size 20MB = 20971520
        // 2024: https://discord.com/developers/docs/change-log#default-file-upload-limit-change
        // 2026: https://docs.discord.com/developers/change-log#default-file-upload-limit-increase
        {
            find: 'PREMIUM_TENURE_1_MONTH="premium_tenure_1_month_v2"',
            replacement: [
                {
                    match: /(\d):{fileSize:\w+}/g,
                    replace: "$1:{fileSize:20971520}",
                },
            ],
        },
        // Deny stickers to be sent everywhere - From FakeNitro plugin
        {
            find: "canUseCustomStickersEverywhere:",
            replacement: {
                match: /(?<=canUseCustomStickersEverywhere:function\(\i\)\{)/,
                replace: "return false;",
            },
        },
        // Try handle Private Channel
        {
            find: "async openPrivateChannel(",
            replacement: [
                {
                    match: /(async openPrivateChannel)(\(\w+\){)/,
                    //       $1                          $2
                    replace: "openPrivateChannel(e){return $self.openPrivateChannelPatch(e, this, $self);},$1_$2",
                },
                {
                    match: /(closePrivateChannel\(\w+\){)/,
                    replace:
                        "$& if ($self.settings.store.saveDirectMessage) $self.db.handleClosePrivateChannel(Vencord.Webpack.Common.UserStore.getCurrentUser().id, arguments[0]);",
                },
            ],
        },
        // Fix unread message
        {
            find: "}getOldestUnreadMessageId(",
            replacement: [
                {
                    match: /(}getOldestUnreadMessageId\(\w+\){)/,
                    replace: "$&return null;",
                },
                {
                    match: /(}getOldestUnreadTimestamp\(\w+\){)/,
                    replace: "$&return 0;",
                },
            ],
        },
        // Emoji
        {
            find: "}searchWithoutFetchingLatest(",
            replacement: [
                {
                    match: /;return{unlocked:this\.getSearchResultsOrder\((\w+)\.unlocked/,
                    replace:
                        ";$self.getApplicationEmojis();$1.unlocked = [...$1.unlocked, ...(window.applicationEmojis || []).filter(o => o.name?.toLowerCase().includes(arguments[0].query?.toLowerCase()))];return{unlocked:this.getSearchResultsOrder($1.unlocked",
                },
            ],
        },
        // Support link
        {
            find: '"support.discord.com"',
            replacement: [
                {
                    match: '"support.discord.com"',
                    replace: '"github.com/aiko-chan-ai/DiscordBotClient/discussions#"',
                },
            ],
        },
        // === Apply Patches from Vesktop ===
        // #region Vesktop Patches
        // src > renderer > patches > windowsTitleBar.tsx
        {
            find: ".USE_OSX_NATIVE_TRAFFIC_LIGHTS",
            replacement: [
                {
                    match: /case \i\.\i\.WINDOWS:/,
                    replace: 'case "WEB":',
                },
            ],
        },
        // Visual Refresh
        {
            find: '"refresh-title-bar-small"',
            replacement: [
                {
                    match: /\i===\i\.PlatformTypes\.WINDOWS/g,
                    replace: "true",
                },
                {
                    match: /\i===\i\.PlatformTypes\.WEB/g,
                    replace: "false",
                },
            ],
        },
        // src > renderer > patches > windowMethods.tsx
        {
            find: ",setSystemTrayApplications",
            replacement: [
                {
                    match: /\i\.window\.(close|minimize|maximize)/g,
                    replace: "BotClientNative.$1",
                },
                {
                    // TODO: Fix eslint rule
                    match: /(focus(\(\i\)){).{0,150}?\.focus\(\i,\i\)/,
                    replace: "$1BotClientNative.focus$2",
                },
                // Todo: Hardware Acceleration
            ],
        },
        // src > renderer > patches > devtoolsFixes.ts
        // Discord Web blocks the devtools key-bind on mac specifically, disable that
        {
            find: '"mod+alt+i"',
            replacement: {
                match: /"discord\.com"===location\.host/,
                replace: "false",
            },
        },
        {
            // Custom patch
            // Instead of trying to precisely identify which events should “hide” the token in localStorage, I chose to disable this feature entirely.
            // This client is intended for power users anyway - no one would leave their token exposed while opening devtools, right?
            find: ".setDevtoolsCallbacks(",
            replacement: [
                {
                    match: /if\(null!=(\i)\)(?=.{0,50}\1\.window\.setDevtoolsCallbacks)/,
                    replace: "if(true)",
                },
            ],
        },
        // src > renderer > patches > enableNotificationsByDefault.ts
        {
            find: '"NotificationSettingsStore',
            replacement: {
                match: /\.isPlatformEmbedded(?=\?\i\.\i\.ALL)/g,
                replace: "$&||true",
            },
        },
        {
            /*
             * The deeplink wrapper replaces the whole client with "Application Discord
             * détectée" whenever it thinks it is running on the web and a deeplink is
             * opening. Nebula is the desktop app, so the check is answered truthfully.
             */
            find: '"deeplink-wrapper"',
            replacement: {
                match: /\(0,\i\.isDesktop\)\(\)/g,
                replace: "true",
            },
        },
        // src > renderer > patches > hideDownloadAppsButton.ts
        {
            find: '"app-download-button"',
            replacement: {
                match: /return(?=.{0,50}id:"app-download-button")/,
                replace: "return null;return",
            },
        },
        // src > renderer > patches > taskBarFlash.ts
        {
            find: ".flashFrame(!0)",
            replacement: {
                match: /(\i)&&\i\.\i\.taskbarFlash&&\i\.\i\.flashFrame\(!0\)/,
                replace: "BotClientNative.flashFrame(true)",
            },
        },
        // #endregion
        // === End Vesktop Patches ===
        // High bitrate
        {
            find: '{type:"SET_CHANNEL_BITRATE",bitrate:',
            replacement: [
                {
                    match: /({type:"SET_CHANNEL_BITRATE",bitrate:)(\w+\.bitrate)}/,
                    replace:
                        "$1 $self.settings.store.overrideVoiceChannelBitrate ? Math.floor($self.settings.store.bitrateVoiceChannel * 1000) : $2}",
                },
            ],
        },
    ],
    commands: [
        {
            name: "ping",
            description: "Ping pong!",
            inputType: ApplicationCommandInputType.BUILT_IN,
            execute: (opts, ctx) => {
                sendBotMessage(ctx.channel.id, { content: "Pong!" });
            },
        },
        {
            name: "purge",
            description: "Delete messages from the channel",
            inputType: ApplicationCommandInputType.BOT,
            options: [
                {
                    name: "amount",
                    description: "Input the amount of messages to delete",
                    required: true,
                    type: ApplicationCommandOptionType.INTEGER,
                },
            ],
            execute: async (opts, ctx) => {
                const amount = findOption<number>(opts, "amount", 2);
                if (amount < 2 || amount > 100) {
                    sendBotMessage(ctx.channel.id, {
                        content: `🚫 Must be greater than or equal to **2** and less than or equal to **100**.\n**${amount}** is an invalid number`,
                    });
                } else {
                    const oldId = SnowflakeUtil.generate(Date.now() - 1209600000); // 14 days ago
                    const { body } = await RestAPI.get({
                        url: Constants.Endpoints.MESSAGES(ctx.channel.id) + `?limit=${amount}`,
                    });
                    const messages = body.filter(m => BigInt(m.id) > BigInt(oldId)).map(m => m.id);
                    if (messages.length < 2) {
                        return sendBotMessage(ctx.channel.id, {
                            content: "Not enough messages to delete (messages must be less than 14 days old)",
                        });
                    }
                    try {
                        await RestAPI.post({
                            url: `${Constants.Endpoints.MESSAGES(ctx.channel.id)}/bulk-delete`,
                            body: {
                                messages,
                            },
                        });
                        sendBotMessage(ctx.channel.id, {
                            content: `Deleted ${messages.length} messages`,
                        });
                    } catch {
                        sendBotMessage(ctx.channel.id, {
                            content: "Failed to delete messages",
                        });
                    }
                }
            },
        },
        {
            name: "switch",
            description: "Commands related to switch",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                {
                    name: "shard",
                    description: "Login with another shard ID",
                    type: ApplicationCommandOptionType.SUB_COMMAND,
                    options: [
                        {
                            name: "id",
                            description: "Shard ID",
                            required: true,
                            type: ApplicationCommandOptionType.INTEGER,
                        },
                    ],
                },
                {
                    name: "guild",
                    description: "Switch to a guild in another shard using its ID.",
                    type: ApplicationCommandOptionType.SUB_COMMAND,
                    options: [
                        {
                            name: "id",
                            description: "Guild ID",
                            required: true,
                            type: ApplicationCommandOptionType.STRING,
                        },
                    ],
                },
            ],
            execute: async (opts, ctx) => {
                BotClientLogger.debug(opts, ctx);
                const subCommand = opts[0];
                switch (subCommand.name) {
                    case "shard": {
                        const id = findOption<number>(subCommand.options, "id", 0);
                        const allShards = parseInt((originalSessionStorage.getItem("allShards") as string) || "0");
                        if (id < 0 || id + 1 > allShards) {
                            sendBotMessage(ctx.channel.id, {
                                content: `### Invalid shardId\n🚫 Must be greater than or equal to **0** and less than or equal to **${allShards - 1}**.\n**${id}** is an invalid number`,
                            });
                        } else {
                            originalSessionStorage.setItem("currentShard", id as any);
                            LoginToken.loginToken(GetToken.getToken());
                        }
                        break;
                    }
                    case "guild": {
                        const guild = findOption<string>(subCommand.options, "id", "");
                        const allShards = parseInt((originalSessionStorage.getItem("allShards") as string) || "0");
                        if (!/^\d{17,19}$/.test(guild)) {
                            return sendBotMessage(ctx.channel.id, {
                                content: "🚫 Invalid guild ID",
                            });
                        }
                        if (allShards === 1) {
                            return sendBotMessage(ctx.channel.id, {
                                content: "🚫 Cannot switch guild in single shard",
                            });
                        }
                        const shardId = Number((BigInt(guild) >> 22n) % BigInt(allShards));
                        originalSessionStorage.setItem("currentShard", shardId as any);
                        await LoginToken.loginToken(GetToken.getToken());
                        NavigationRouter.transitionToGuild(guild);
                        break;
                    }
                }
            },
        },
        {
            name: "override",
            description: "Override settings",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                {
                    description: "Override voice channel bitrate",
                    name: "bitrate",
                    type: ApplicationCommandOptionType.SUB_COMMAND,
                    options: [
                        {
                            name: "value",
                            description: "Bitrate value (Kbps)",
                            required: true,
                            type: ApplicationCommandOptionType.INTEGER,
                        },
                    ],
                },
            ],
            execute: async (opts, ctx) => {
                BotClientLogger.debug(opts, ctx);
                const subCommand = opts[0];
                switch (subCommand.name) {
                    case "bitrate": {
                        if (!settings.store.overrideVoiceChannelBitrate) {
                            return sendBotMessage(ctx.channel.id, {
                                content: "🚫 You must enable `Override Voice Channel Bitrate` in settings first",
                            });
                        }
                        const kbps = findOption<number>(subCommand.options, "value", 128);
                        if (!Number.isInteger(kbps)) {
                            return sendBotMessage(ctx.channel.id, {
                                content: `🚫 **${kbps}** is not a valid integer`,
                            });
                        }
                        if (kbps < 6 || kbps > 5000) {
                            return sendBotMessage(ctx.channel.id, {
                                content: `🚫 Must be greater than or equal to **6** and less than or equal to **5000** Kbps.\n**${kbps}** is an invalid number`,
                            });
                        }
                        settings.store.bitrateVoiceChannel = kbps;
                        sendBotMessage(ctx.channel.id, {
                            content: `✅ Set voice channel bitrate to **${kbps}** Kbps`,
                        });
                        break;
                    }
                }
            },
        },
    ],
    flux: {
        GUILD_MEMBER_LIST_UPDATE(data) {
            BotClientLogger.debug(
                "botClient#updateGuildMembersList()",
                "FluxDispatcher#GUILD_MEMBER_LIST_UPDATE",
                data,
            );
        },
        GUILD_MEMBER_UPDATE(data) {
            if (data.guildId === getCurrentChannel()?.guild_id) {
                funcUpdateGuildMembersList?.("GuildMemberUpdate", data);
            }
        },
        GUILD_MEMBER_ADD(data) {
            if (data.guildId === getCurrentChannel()?.guild_id) {
                funcUpdateGuildMembersList?.("GuildMemberAdd", data);
            }
        },
        GUILD_MEMBER_REMOVE(data) {
            if (data.guildId === getCurrentChannel()?.guild_id) {
                funcUpdateGuildMembersList?.("GuildMemberRemove", data);
            }
        },
        PRESENCE_UPDATES(data) {
            const guildId = getCurrentChannel()?.guild_id;
            if ((data.updates as any[]).find(u => u.guildId === guildId)) {
                funcUpdateGuildMembersList?.("PresenceUpdates", data);
            }
        },
        CHANNEL_PRELOAD(data) {
            updateGuildMembersListDirect?.("ChannelPreload", data);
        },
        GUILD_ROLE_UPDATE(data) {
            if (data.guildId === getCurrentChannel()?.guild_id) {
                funcUpdateGuildMembersList?.("GuildRoleUpdate", data);
            }
        },
        GUILD_ROLE_CREATE(data) {
            if (data.guildId === getCurrentChannel()?.guild_id) {
                funcUpdateGuildMembersList?.("GuildRoleCreate", data);
            }
        },
        GUILD_ROLE_DELETE(data) {
            if (data.guildId === getCurrentChannel()?.guild_id) {
                funcUpdateGuildMembersList?.("GuildRoleDelete", data);
            }
        },
        /*
        USER_SETTINGS_PROTO_UPDATE: async function (data) {
            const botId = GetApplicationId.getId();
            if (data.partial) {
                BotClientLogger.debug(
                    "FluxDispatcher#USER_SETTINGS_PROTO_UPDATE",
                    data,
                );
                // Preloaded User Settings
                if (data.settings.type === 1) {
                    const preloaded = await db.getPreloadedUserSettings(botId);
                    // Try update
                    Object.keys(data.settings.proto).forEach(key => {
                        preloaded[key] = data.settings.proto[key];
                    });
                    // Save to IndexedDB
                    await db.SetPreloadedUserSettings(botId, preloaded);
                }
                // Frecency User Settings
                if (data.settings.type === 2) {
                    const frecency = await db.getFrecencyUserSettings(botId);
                    // Try update
                    Object.keys(data.settings.proto).forEach(key => {
                        frecency[key] = data.settings.proto[key];
                    });
                    // Save to IndexedDB
                    await db.SetFrecencyUserSettings(botId, frecency);
                }
            }
        }
        */
    },
    dynamicPatchModules() {
        // Patch Relationships modules
        const RelationshipsModule = findByProps("fetchRelationships", "sendRequest", "removeFriend");
        /*
        Object.keys(RelationshipsModule).forEach(a => {
            RelationshipsModule[a] = function () {
                showToast(
                    `${window.BotClientNative.getBotClientName()} cannot use Relationships Module`,
                    Toasts.Type.FAILURE,
                );
                return Promise.reject(`${window.BotClientNative.getBotClientName()} cannot use Relationships Module`);
            };
        });
        */
        const methodsToBlock = [
            "sendRequest",
            "addRelationship",
            "acceptFriendRequest",
            "cancelFriendRequest",
            "removeFriend",
            "blockUser",
            "unblockUser",
            "removeRelationship",
            "updateRelationship",
            "fetchRelationships",
            "confirmClearPendingRelationships",
            "clearPendingRelationships",
            "clearPendingSpamAndIgnored",
            "ignoreUser",
            "unignoreUser",
        ];
        for (const method of methodsToBlock) {
            if (typeof RelationshipsModule[method] === "function") {
                const original = RelationshipsModule[method].bind(RelationshipsModule);
                RelationshipsModule[method] = function (...args: any[]) {
                    // Only bots are barred from the Relationships module
                    if (isUserAccountSession()) return original(...args);
                    showToast(
                        `${window.BotClientNative.getBotClientName()} cannot use Relationships Module`,
                        Toasts.Type.FAILURE,
                    );
                    return Promise.reject(
                        `${window.BotClientNative.getBotClientName()} cannot use Relationships Module`,
                    );
                };
            }
        }
        /** The explanation shown wherever Nebula stops before a page that cannot work */
        const nebulaAlert = (title: string, paragraphs: string[]) => {
            Alerts.show({
                title,
                body: (
                    <div className="vc-nebula-alert">
                        <img
                            src="https://cdn.discordapp.com/emojis/1399479404706660373.gif"
                            alt=""
                            className="vc-nebula-alertArt"
                        />
                        {paragraphs.map((text, index) => (
                            <Paragraph key={index}>{text}</Paragraph>
                        ))}
                    </div>
                ),
            });
        };

        /*
         * A bot joins a server through the OAuth invite link, never from the client:
         * creating or joining one from here always fails, so say why up front.
         */
        const unavailableForBots = (what: string) => {
            nebulaAlert("Rien à voir par ici", [
                `Tu es connecté avec un bot, et un bot ne peut pas ${what} depuis un client.`,
                "Un bot rejoint un serveur uniquement via son lien d'invitation OAuth, généré depuis le " +
                    "portail développeur de Discord, et c'est le propriétaire du serveur qui l'ajoute.",
            ]);
        };

        this.guardNavigation();
        listenForScreenShare();
        blockUnavailableModals();
        /*
         * An invite clicked here is shown by Discord itself, instead of the web page that
         * asks whether to open the desktop app — which Nebula already is.
         */
        try {
            window.BotClientNative.onOpenInvite((code: string) => {
                NavigationRouter.transitionTo(`/invite/${code}`);
            });
        } catch (error) {
            BotClientLogger.warn("Impossible de suivre les invitations", error);
        }
        this.guardInviteButton(nebulaAlert);

        /*
         * Catch it as early as possible: the modal openers first, so the window never
         * appears, and the actions themselves as a safety net. Which of these exist
         * depends on the Discord build, so each one is looked up and reported.
         */
        /*
         * Never let one of these take the rest of the patching down with it: a module
         * may be frozen, or simply gone after a Discord update, and everything below
         * (the current user, the private channels…) still has to be installed.
         */
        const guard = (propName: string, what: string, rejects: boolean) => {
            try {
                const owner = findByProps(propName);
                if (typeof owner?.[propName] !== "function") return;
                const original = owner[propName].bind(owner);
                owner[propName] = function (...args: any[]) {
                    if (isUserAccountSession()) return original(...args);
                    unavailableForBots(what);
                    return rejects
                        ? Promise.reject(new Error(`Nebula: indisponible pour un bot (${propName})`))
                        : undefined;
                };
            } catch (error) {
                BotClientLogger.warn(`Impossible d'accrocher ${propName}`, error);
            }
        };


        // The modal opener, so the window never appears at all
        guard("openCreateGuildModal", "créer un serveur", false);
        // …and the actions themselves, as a safety net
        guard("createGuild", "créer un serveur", true);
        guard("joinGuild", "rejoindre un serveur", true);

        // The local system channel cannot be closed
        try {
            const PrivateChannelActions = findByProps("closePrivateChannel");
            if (typeof PrivateChannelActions?.closePrivateChannel === "function") {
                const closeOriginal = PrivateChannelActions.closePrivateChannel.bind(PrivateChannelActions);
                PrivateChannelActions.closePrivateChannel = function (channelId: string, ...rest: any[]) {
                    if (channelId === SystemChannelId) {
                        showToast("Ce salon ne peut pas être fermé", Toasts.Type.FAILURE);
                        return;
                    }
                    return closeOriginal(channelId, ...rest);
                };
            }
        } catch (error) {
            BotClientLogger.warn("Impossible de protéger le salon système", error);
        }
        // Patch getCurrentUser in UserStore
        const UserStorePatch = findStore("UserStore") as UserStoreType;
        const getCurrentUserOriginal = UserStorePatch.getCurrentUser.bind(UserStorePatch);
        UserStorePatch.getCurrentUser = function () {
            // A user account already has a real profile, Nitro state, email and phone
            if (isUserAccountSession()) return getCurrentUserOriginal();
            const user = UserStorePatch.getUsers()[GetApplicationId.getId()];
            if (!user) return user;
            user.bot = false;
            user.desktop = true;
            user.mobile = true;
            user.premiumState = {
                // @ts-expect-error ignore
                premiumSubscriptionType: 4,
                premiumSource: 1,
            };
            user.purchasedFlags = 3; // https://docs.discord.food/resources/user#purchased-flags
            user.premiumType = 2; // https://docs.discord.food/resources/user#premium-type
            user.premiumUsageFlags = 4; // https://docs.discord.food/resources/user#purchased-flags
            // @ts-expect-error ignore
            user.premium = true;
            user.mfaEnabled = true;
            user.verified = true;
            user.nsfwAllowed = true;
            user.phone = "33550336"; // https://x.com/StarRailVerse1/status/1939186090222490046
            user.email = user.id + "@cyrene.moe";
            return user;
        };
        // Invite Module
        const InviteModule = findByProps("acceptInvite", "resolveInvite");
        const originalAcceptInvite = InviteModule.acceptInvite.bind(InviteModule);
        InviteModule.acceptInvite = async function (e) {
            /*
             * A bot cannot accept an invite — only the server owner adds it — so this was
             * written to refuse outright. A real account joins servers like anywhere else,
             * and was being refused with it.
             */
            if (isUserAccountSession()) return originalAcceptInvite(e);
            if (parseInt(originalSessionStorage.getItem("allShards") || "0") > 1) {
                const invite = await this.resolveInvite(e.inviteKey);
                const guildId = invite.invite.guild_id;
                const channelId = invite.invite.channel.id;
                if (!guildId) {
                    Toasts.show({
                        message: `${window.BotClientNative.getBotClientName()} cannot join guilds`,
                        id: Toasts.genId(),
                        type: Toasts.Type.FAILURE,
                    });
                    throw new Error(`${window.BotClientNative.getBotClientName()} cannot join guilds`);
                } else {
                    const res = await RestAPI.get({
                        url: Constants.Endpoints.GUILD(guildId),
                    }).catch(e => e);
                    if (res.ok) {
                        const shardId = Number(
                            (BigInt(guildId) >> 22n) %
                                BigInt(parseInt(originalSessionStorage.getItem("allShards") || "0")),
                        );
                        originalSessionStorage.setItem("currentShard", shardId.toString());
                        await LoginToken.loginToken(GetToken.getToken());
                        return NavigationRouter.transitionToGuild(guildId, channelId);
                    } else {
                        Toasts.show({
                            message: `${window.BotClientNative.getBotClientName()} cannot join guilds`,
                            id: Toasts.genId(),
                            type: Toasts.Type.FAILURE,
                        });
                        throw new Error(`${window.BotClientNative.getBotClientName()} cannot join guilds`);
                    }
                }
            } else {
                Toasts.show({
                    message: `${window.BotClientNative.getBotClientName()} cannot join guilds`,
                    id: Toasts.genId(),
                    type: Toasts.Type.FAILURE,
                });
                return Promise.reject(`${window.BotClientNative.getBotClientName()} cannot join guilds`);
            }
        };
        // GuildTemplateModule
        const GuildTemplateModule = findByProps("loadTemplatesForGuild", "resolveGuildTemplate");
        const originalLoadTemplates = GuildTemplateModule.loadTemplatesForGuild.bind(GuildTemplateModule);
        GuildTemplateModule.loadTemplatesForGuild = function (e) {
            // Templates are a bot's dead end, not an account's
            if (isUserAccountSession()) return originalLoadTemplates(e);
            return Promise.reject(`${window.BotClientNative.getBotClientName()} cannot use Guild Templates`);
        };
    },
    chatBarButton: {
        icon: IconEmbedSvg,
        render: CreateAdvancedMessageEditor,
    },
    messagePopoverButton: {
        icon: IconEmbedSvg,
        render: EditAdvancedMessageEditor,
    },
    /**
     * Discord's shop, Nitro and quests need the payment machinery Nebula does not carry,
     * and server discovery only leads to a join a bot cannot perform. Wrapping Discord's
     * own router did not catch these — the sidebar reaches them another way — so the
     * browser's own history is watched instead: whatever route Discord takes, the address
     * changes, and that is what is checked.
     *
     * The page is covered rather than left behind: the panel sits over the content area,
     * so the sidebar stays usable and nothing of the page shows through.
     */
    /**
     * The invite is copied by the main process, which sees the click as a request to
     * open a browser and answers it differently. All that is left here is saying so.
     */
    guardInviteButton(alert: (title: string, paragraphs: string[]) => void) {
        try {
            window.BotClientNative.onSupportInviteCopied((invite: string) => {
                alert("Lien copié", [
                    "Le lien du serveur est dans ton presse-papiers.",
                    `Colle-le dans Discord pour rejoindre le serveur : ${invite}`,
                ]);
            });
        } catch (error) {
            BotClientLogger.warn("Impossible d'annoncer la copie du lien", error);
        }
    },
    guardNavigation() {
        const blocked = [
            {
                // Nitro is sold through machinery neither kind of account has here
                match: /^\/store/,
                botsOnly: false,
                paragraphs: [
                    "Cette page vend Nitro. Elle a besoin des rouages de paiement et d'abonnement de " +
                        "Discord, qui n'existent que dans le client officiel.",
                    "Passe par Discord pour souscrire ou gérer un abonnement.",
                ],
            },
            {
                match: /^\/(shop|application-directory)/,
                botsOnly: true,
                paragraphs: [
                    "Tu es connecté avec un bot, et la boutique vend des objets pour un compte Discord : " +
                        "décorations de profil, effets, thèmes. Un bot n'a rien de tout ça.",
                    "Connecte-toi avec un compte Discord pour y accéder.",
                ],
            },
            {
                /*
                 * A quest only counts when Discord's own desktop client watches the game
                 * running or the video playing, which Nebula cannot stand in for: the page
                 * would show quests that never progress, for an account as for a bot.
                 */
                match: /^\/(quest|quests|quest-home)/,
                botsOnly: false,
                paragraphs: [
                    "Les quêtes ne peuvent pas avancer ici. Elles sont validées par le client officiel de " +
                        "Discord, qui vérifie lui-même le jeu lancé ou la vidéo regardée.",
                    "Ouvre Discord pour réclamer une récompense.",
                ],
            },
            {
                match: /^\/(discovery|guild-discovery)/,
                botsOnly: true,
                paragraphs: [
                    "Tu es connecté avec un bot, et la découverte sert à rejoindre un serveur : un bot ne " +
                        "peut pas le faire depuis un client.",
                    "Un bot rejoint un serveur uniquement par son lien d'invitation OAuth, et c'est le " +
                        "propriétaire du serveur qui l'ajoute.",
                ],
            },
        ];

        const findBlocked = (path: string) => {
            for (const entry of blocked) {
                if (!entry.match.test(path)) continue;
                if (entry.botsOnly && isUserAccountSession()) return null;
                return entry;
            }
            return null;
        };

        let panel: HTMLElement | null = null;

        const buildPanel = () => {
            const node = document.createElement("div");
            node.className = "nebula-blocked-page";
            node.innerHTML =
                '<img class="nebula-blocked-art" alt="" src="https://cdn.discordapp.com/emojis/1399479404706660373.gif">' +
                '<h2 class="nebula-blocked-title">Rien à voir par ici</h2>' +
                '<div class="nebula-blocked-body"></div>';
            document.body.appendChild(node);
            return node;
        };

        /*
         * The panel is placed from the sidebar rather than from a fixed width: it starts
         * where the sidebar ends, so it covers the page and nothing else, whatever the
         * window size or the layout of the moment.
         */
        const place = (node: HTMLElement) => {
            // Each page has its own left column, and they do not share one class name
            const sidebars = document.querySelectorAll<HTMLElement>(
                '[class*="sidebar_"], [class*="guilds_"], [class*="nav_"], nav[class]',
            );
            let left = 0;
            let top = 0;
            for (const sidebar of sidebars) {
                const rect = sidebar.getBoundingClientRect();
                if (rect.width === 0 || rect.height < window.innerHeight / 3) continue;
                left = Math.max(left, rect.right);
                top = Math.max(top, rect.top);
            }
            node.style.left = `${left}px`;
            node.style.top = `${top}px`;
        };

        const hide = () => {
            panel?.remove();
            panel = null;
        };

        const show = (paragraphs: string[]) => {
            panel ??= buildPanel();
            const body = panel.querySelector(".nebula-blocked-body");
            if (body) {
                body.textContent = "";
                for (const text of paragraphs) {
                    const line = document.createElement("p");
                    line.textContent = text;
                    body.appendChild(line);
                }
            }
            place(panel);
        };

        const check = () => {
            try {
                const entry = findBlocked(window.location.pathname);
                if (entry) {
                    show(entry.paragraphs);
                } else {
                    hide();
                }
            } catch (error) {
                BotClientLogger.warn("Impossible de filtrer la navigation", error);
            }
        };

        try {
            /*
             * Discord's router is built on the history API, so every move it makes goes
             * through one of these, whichever component started it.
             */
            for (const name of ["pushState", "replaceState"] as const) {
                const original = history[name].bind(history);
                history[name] = function (...args: Parameters<History["pushState"]>) {
                    const result = original(...args);
                    check();
                    return result;
                };
            }
            window.addEventListener("popstate", check);
            // The sidebar settles after the page does, and the window can be resized
            window.addEventListener("resize", () => panel && place(panel));
            setInterval(() => panel && place(panel), 1000);
            check();
            BotClientLogger.info("Filtre de navigation installé");
        } catch (error) {
            BotClientLogger.warn("Impossible d'installer le filtre de navigation", error);
        }
    },
    /** Splits the popout's account entries into a user group and a bot group */
    groupAccountMenu(items: any[]) {
        if (!Array.isArray(items) || items.length < 2) return items;
        const ids = this.botAccountIds();
        // The entries are keyed by account id, which is all that is needed to tell them apart
        const people = items.filter(item => !ids.has(String(item?.key)));
        const bots = items.filter(item => ids.has(String(item?.key)));
        // With only one kind of account, headings would say nothing
        if (!people.length || !bots.length) return items;
        return [
            React.createElement(Menu.MenuGroup, { key: "nebula-users", label: "UTILISATEURS" }, people),
            React.createElement(Menu.MenuGroup, { key: "nebula-bots", label: "BOTS" }, bots),
        ];
    },
    /** Ids of the saved bot accounts, read once from the main process */
    botAccountIds(): Set<string> {
        if (!cachedBotAccountIds) {
            try {
                cachedBotAccountIds = new Set(BotClientNative.getBotAccountIds());
            } catch (error) {
                BotClientLogger.warn("Impossible de lire la liste des bots", error);
                cachedBotAccountIds = new Set<string>();
            }
        }
        return cachedBotAccountIds;
    },
    /** True when an account listed in the switcher is a bot */
    isBotAccount(user: { id: string; bot?: boolean; }): boolean {
        return Boolean(user?.bot) || this.botAccountIds().has(user?.id);
    },
    /** Users first, bots after, each group keeping the order Discord gave them */
    sortAccounts<T extends { id: string; bot?: boolean; }>(users: T[]): T[] {
        if (!Array.isArray(users)) return users;
        const people = users.filter(user => !this.isBotAccount(user));
        const bots = users.filter(user => this.isBotAccount(user));
        return [...people, ...bots];
    },
    /** Heading drawn above the first account of each group, nothing in between */
    accountHeader(users: { id: string; bot?: boolean; }[], index: number) {
        const user = users?.[index];
        if (!user) return null;
        const isBot = this.isBotAccount(user);
        // Only the entry that opens a group carries the heading
        if (index > 0 && this.isBotAccount(users[index - 1]) === isBot) return null;
        return React.createElement(
            "div",
            {
                className: "nebula-account-group",
                key: `nebula-group-${isBot ? "bot" : "user"}`,
            },
            isBot ? "BOTS" : "UTILISATEURS",
        );
    },
    /**
     * The quick account popout draws its own list, in a module whose name is minified
     * away. Every consumer of the multi-account hook imports it by id, so the plugin
     * reports those modules instead of guessing at identifiers.
     */
    start() {
        this.patchSettingsLayout();
        this.watchRunningGames();
        // Patch Modules
        this.dynamicPatchModules();

        updateGuildMembersListDirect = this.updateGuildMembersList.bind(this);
        funcUpdateGuildMembersList = this.throttle(
            updateGuildMembersListDirect,
            () => this.settings.store.memberListThrottleDelay * 1000,
        );

        this.applyGlobalPatches();
    },
    stop() {
        // Editor window may have been opened without completing the port handshake, leaving a dangling "message" listener and an open port
        if (currentMessageHandler) {
            window.removeEventListener("message", currentMessageHandler);
            currentMessageHandler = null;
        }
        if (window.editorPort) {
            window.editorPort.close();
            window.editorPort = null;
        }
        this.removeGlobalPatches();
    },
    // Utils
    throttle<T extends (...args: any[]) => void>(func: T, getDelay: () => number): (...args: Parameters<T>) => void {
        let lastCall = 0;
        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        return (...args: Parameters<T>) => {
            let delay = getDelay();
            if (delay <= 0) delay = 2000;
            const now = Date.now();
            if (now - lastCall >= delay) {
                func(...args);
                lastCall = now;
            } else {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }
                timeoutId = setTimeout(
                    () => {
                        func(...args);
                        lastCall = Date.now();
                    },
                    delay - (now - lastCall),
                );
            }
        };
    },
    // Guild Member List
    calculateMemberListId(channel: Channel, everyonePermHasViewChannel: bigint) {
        const VIEW = PermissionsBits.VIEW_CHANNEL;
        const perms: string[] = [];
        let hasDeny = false;

        for (const { id, allow, deny } of Object.values(channel.permissionOverwrites)) {
            if (allow & VIEW) {
                perms.push(`allow:${id}`);
            } else if (deny & VIEW) {
                perms.push(`deny:${id}`);
                hasDeny = true;
            }
        }

        if (!hasDeny && everyonePermHasViewChannel > 0n) {
            return "everyone";
        }

        const hashInput = perms.sort().join(",");
        return murmurhash.v3(hashInput).toString();
    },
    makeGroup(onlineMembers: MemberPatch[], offlineMembers: MemberPatch[], guildRoles: Record<string, Role>) {
        const ops: OpItem[] = [];
        const groups: Group[] = [];
        const allLists = new Map<string, List>();
        // Online members
        for (const member of onlineMembers) {
            const idList = member.hoistRoleId || "online";
            let list = allLists.get(idList);
            if (!list) {
                list = {
                    group: {
                        id: idList,
                        count: 0,
                    },
                    members: [],
                };
                allLists.set(idList, list);
            }
            list.group.count++;
            list.members.push(member);
        }
        // Sorting roles by position
        const sortedLists = [...allLists.values()].sort(
            (a, b) =>
                // group.id = role.id
                (guildRoles[b.group.id]?.position ?? 0) - (guildRoles[a.group.id]?.position ?? 0),
        );
        // Sorting members by nickname
        for (const list of sortedLists) {
            ops.push({ group: list.group });

            list.members
                .sort((a, b) => (a.nick || "").localeCompare(b.nick || ""))
                .forEach(m => ops.push({ member: m }));

            groups.push(list.group);
        }
        // Offline members
        if (offlineMembers.length) {
            const offlineGroup = { id: "offline", count: offlineMembers.length };
            ops.push({ group: offlineGroup });
            for (const m of offlineMembers) ops.push({ member: m });
            groups.push(offlineGroup);
        }
        return {
            ops,
            groups,
        };
    },
    // Permission cache to avoid recomputing for every member on each event
    _permissionCache: new Map<string, boolean>(),
    _cachedGuildId: null as string | null,
    _cachedChannelId: null as string | null,
    _invalidatePermCache() {
        this._permissionCache.clear();
        this._cachedGuildId = null;
        this._cachedChannelId = null;
    },
    _invalidatePermCacheForMember(channelId: string, userId: string) {
        this._permissionCache.delete(`${channelId}:${userId}`);
    },
    /**
     * The app watches the running processes itself, since this client has no native
     * module for it. Feed what it finds to Discord's own running games store.
     */
    watchRunningGames() {
        const native = (window as any).BotClientNative;
        if (!native?.onRunningGamesChanged) return;

        const publish = (games: any[], added: any[], removed: any[]) => {
            BotClientLogger.info(
                `Jeux reçus du processus principal: [${games.map(g => g?.name).join(", ")}]` +
                    ` ajoutés=${added.length} retirés=${removed.length}`,
            );
            /*
             * Two routes, because the first alone never showed anything.
             *
             * RUNNING_GAMES_CHANGE only feeds Discord's store of detected processes, and
             * the store still decides whether to publish them — it answers to settings and
             * to a native module this client does not have. LOCAL_ACTIVITY_UPDATE is the
             * path rich-presence clients use: it states the activity outright, and Discord
             * sends it to the gateway. The first keeps the "playing" list honest, the
             * second is what actually appears on the profile.
             */
            try {
                FluxDispatcher.dispatch({ type: "RUNNING_GAMES_CHANGE", games, added, removed });
            } catch (error) {
                BotClientLogger.error("Impossible de publier la liste des jeux", error);
            }

            try {
                const game = games.find(entry => entry && !entry.isLauncher) ?? null;
                FluxDispatcher.dispatch({
                    type: "LOCAL_ACTIVITY_UPDATE",
                    socketId: NEBULA_ACTIVITY_SOCKET,
                    activity: game
                        ? {
                            name: game.name,
                            application_id: game.id,
                            type: 0, // en train de jouer
                            timestamps: { start: game.start },
                            flags: 1,
                        }
                        : null,
                });
                BotClientLogger.info(
                    game ? `Activité publiée : ${game.name}` : "Activité effacée (plus aucun jeu)",
                );
            } catch (error) {
                BotClientLogger.error("Impossible de publier l'activité", error);
            }
        };

        native.onRunningGamesChanged(publish);

        // Whatever was already running before the client finished loading
        try {
            const current = native.getRunningGames?.() ?? [];
            if (current.length) publish(current, current, []);
        } catch (error) {
            BotClientLogger.error("Impossible de lire les jeux en cours", error);
        }
    },
    /**
     * Give Nebula a settings section of its own, and replace the pages a bot
     * account has no use for with an explanation instead of a broken screen.
     */
    patchSettingsLayout() {
        if (buildLayoutOriginal) return;
        buildLayoutOriginal = SettingsPlugin.buildLayout.bind(SettingsPlugin);
        SettingsPlugin.buildLayout = function (builder: any) {
            const layout = buildLayoutOriginal!(builder);
            // buildLayout runs for every nested panel and category too: only the root
            // layout is a list of sections, so only that one may be rearranged
            if (builder?.key !== "$Root") return layout;
            try {
                return patchLayout(layout);
            } catch (error) {
                // Settings must open even if Discord changed its layout under us
                BotClientLogger.error("Impossible de personnaliser les paramètres", error);
                return layout;
            }
        };

        function patchLayout(layout: any) {
            if (!Array.isArray(layout)) return layout;
            if (layout.some((s: any) => s?.key === "nebula_section")) return layout;

            // Reuse the type of an existing section so we stay in step with Discord
            const sectionType = layout.find((s: any) => s?.type != null)?.type;
            if (sectionType == null) return layout;

            const nebulaSection = {
                key: "nebula_section",
                type: sectionType,
                useTitle: () => "Nebula",
                buildLayout: () => [
                    SettingsPlugin.buildEntry({
                        key: "nebula_main",
                        title: "À propos",
                        panelTitle: "Nebula",
                        Component: AboutPage,
                        Icon: NebulaIcon
                    }),
                    SettingsPlugin.buildEntry({
                        key: "nebula_readme",
                        title: "Documentation",
                        panelTitle: "Documentation",
                        Component: DocPage,
                        Icon: NebulaIcon
                    }),
                    SettingsPlugin.buildEntry({
                        key: "nebula_changelog",
                        title: "Nouveautés",
                        panelTitle: "Nouveautés",
                        Component: ChangesPage,
                        Icon: NebulaIcon
                    })
                ]
            };
            const result = [...layout];
            result.splice(1, 0, nebulaSection);

            /*
             * Nitro, the shop and account connections need Discord's own payment and
             * OAuth plumbing, which this client does not carry: they are unavailable
             * for everyone, bot or not. The rest only goes away for a bot.
             */
            const alwaysBlockedKeys = ["billing", "nitro", "premium", "shop", "connection", "connected"];
            const botOnlyBlockedKeys = [
                "privacy",
                "notification",
                "activity",
                "connection",
                "connected",
                "messaging",
                "content_filter",
                "spam",
                "friend_request",
                "family",
                "safety",
            ];
            const blockedKeys = isUserAccountSession()
                ? alwaysBlockedKeys
                : [...alwaysBlockedKeys, ...botOnlyBlockedKeys];
            const isBlocked = (key: unknown) =>
                typeof key === "string" &&
                !key.includes("account") &&
                !key.startsWith("nebula") &&
                !key.startsWith("vencord") &&
                blockedKeys.some(blocked => key.toLowerCase().includes(blocked));

            const blockedEntry = (key: string) =>
                SettingsPlugin.buildEntry({
                    key: `nebula_blocked_${key}`,
                    title: "Indisponible",
                    panelTitle: "Indisponible",
                    Component: UnavailablePage,
                    Icon: NebulaIcon
                });

            return result.map((section: any) => {
                if (!section || typeof section.buildLayout !== "function") return section;
                if (section.key === "nebula_section") return section;
                if (section.key === "billing_section") {
                    return {
                        ...section,
                        buildLayout: () => [blockedEntry("billing")]
                    };
                }
                const originalSectionLayout = section.buildLayout.bind(section);
                return {
                    ...section,
                    buildLayout: () => {
                        const entries = originalSectionLayout();
                        if (!Array.isArray(entries)) return entries;
                        // A whole category collapses into a single "Indisponible" entry
                        let alreadyBlocked = false;
                        const kept: any[] = [];
                        for (const entry of entries) {
                            if (!isBlocked(entry?.key)) {
                                kept.push(entry);
                                continue;
                            }
                            if (alreadyBlocked) continue;
                            alreadyBlocked = true;
                            kept.push(blockedEntry(section.key ?? entry.key));
                        }
                        return kept;
                    }
                };
            });
        }
    },
    updateGuildMembersList(location: string = "unknown", anyLog?: any) {
        if (isUserAccountSession()) {
            // The gateway sends GUILD_MEMBER_LIST_UPDATE itself for a user account
            return false;
        }
        if (!this.settings.store.showMemberList) {
            return false;
        }
        const guild = anyLog?.type === "CHANNEL_PRELOAD" ? GuildStore.getGuild(anyLog.guildId) : getCurrentGuild();
        if (!guild) {
            BotClientLogger.error("botClient#updateGuildMembersList()", "Invalid Guild");
            return false;
        }
        const channel =
            anyLog?.type === "CHANNEL_PRELOAD" ? ChannelStore.getChannel(anyLog.channelId) : getCurrentChannel();
        if (
            !channel ||
            !channel.guild_id ||
            channel.isDM() ||
            channel.isGroupDM() ||
            channel.isMultiUserDM() ||
            channel.isGuildVoice() ||
            channel.isGuildStageVoice() ||
            channel.isDirectory()
        ) {
            BotClientLogger.error("botClient#updateGuildMembersList()", "Invalid Channel", channel);
            return false;
        }
        // Convert guild roles to object
        const guildRolesArray = GuildRoleStore.getSortedRoles(guild.id);
        const guildRoles: Record<string, Role> = {};
        guildRolesArray.map(r => (guildRoles[r.id] = r));
        // MemberListId
        const memberListId = this.calculateMemberListId(
            channel,
            (guildRoles[guild.id]?.permissions ?? 0n) & PermissionsBits.VIEW_CHANNEL,
        );
        // Invalidate permission cache when guild/channel context changes
        if (guild.id !== this._cachedGuildId || channel.id !== this._cachedChannelId) {
            this._permissionCache.clear();
            this._cachedGuildId = guild.id;
            this._cachedChannelId = channel.id;
        }

        // Invalidate cache based on event type
        switch (location) {
            case "GuildRoleUpdate":
            case "GuildRoleCreate":
            case "GuildRoleDelete":
                // Role changes can affect any member's permissions
                this._permissionCache.clear();
                break;
            case "GuildMemberUpdate":
                // Only the updated member's permissions may have changed
                if (anyLog?.user?.id) {
                    this._invalidatePermCacheForMember(channel.id, anyLog.user.id);
                }
                break;
            case "GuildMemberAdd":
                // New member — no cache entry yet, nothing to invalidate
                break;
            case "GuildMemberRemove":
                // Remove stale cache entry
                if (anyLog?.user?.id) {
                    this._invalidatePermCacheForMember(channel.id, anyLog.user.id);
                }
                break;
            // PresenceUpdates, ChannelPreload: permissions unchanged, skip invalidation
        }

        // GuildMembers Patch
        const allMembers = GuildMemberStore.getMembers(guild.id);
        const memberCount = allMembers.length;
        const membersOffline: MemberPatch[] = [];
        const membersOnline: MemberPatch[] = [];

        for (const m of allMembers) {
            const cacheKey = `${channel.id}:${m.userId}`;
            let canView = this._permissionCache.get(cacheKey);
            if (canView === undefined) {
                canView = !!(
                    computePermissions({
                        user: { id: m.userId },
                        context: guild,
                        overwrites: channel.permissionOverwrites,
                    }) & PermissionsBits.VIEW_CHANNEL
                );
                this._permissionCache.set(cacheKey, canView);
            }
            if (canView) {
                const status = PresenceStore.getStatus(m.userId);
                const member = {
                    ...m,
                    user: {
                        id: m.userId,
                    },
                    status: status !== "invisible" ? status : "offline",
                    position: m.hoistRoleId ? guildRoles[m.hoistRoleId]?.position || 0 : 0,
                };
                if (member.status === "offline" && memberCount <= 1000) {
                    membersOffline.push(member);
                } else if (member.status !== "offline") {
                    membersOnline.push(member);
                }
            }
        }

        const groups = this.makeGroup(membersOnline, membersOffline, guildRoles);

        const ops = [
            {
                items: groups.ops,
                op: "SYNC",
                range: [0, 99],
            },
        ] as Ops[];

        FluxDispatcher.dispatch({
            guildId: guild.id,
            id: memberListId,
            ops,
            groups: groups.groups,
            onlineCount: membersOnline.length,
            memberCount: memberCount,
            type: "GUILD_MEMBER_LIST_UPDATE",
            log: {
                message: `Emitted by: ${location}`,
                data: anyLog,
            },
        });

        return true;
    },
    // React Component Login
    renderTokenLogin() {
        return (
            <ErrorBoundary noop>
                <AuthBoxTokenLogin />
            </ErrorBoundary>
        );
    },
    renderTokenLoginMultiAccount() {
        return (
            <ErrorBoundary noop>
                <AuthBoxMultiTokenLogin />
            </ErrorBoundary>
        );
    },
    validateTokenAndLogin(e) {
        e.preventDefault();
        const state = multiTokenState.value;
        if (!state) return;
        if (!RegExToken.test(state.trim())) {
            showToast("Login Failure: Invalid token", Toasts.Type.FAILURE);
            BotClientLogger.error("Login Failure: Invalid token", state);
            return;
        }
        originalSessionStorage.setItem("currentShard", "0");
        LoginToken.loginToken(state);
    },
    async fixPreloadedUserSettings() {
        let userId = GetApplicationId.getId();
        const stopTime = Date.now() + 10000;
        while (!userId) {
            if (Date.now() > stopTime) {
                BotClientLogger.error("Failed to get application ID after 10 seconds");
                return;
            }
            await new Promise(r => setTimeout(r, 100));
            userId = GetApplicationId.getId();
        }
        FluxDispatcher.dispatch({
            type: "USER_SETTINGS_PROTO_UPDATE",
            local: true,
            partial: false,
            settings: {
                type: 1,
                proto: await this.db.getPreloadedUserSettings(userId),
            },
        });
    },
    getApplicationEmojis() {
        this.console.debug("Fetching Application Emojis");
        return new Promise(resolve => {
            RestAPI.get({
                // TODO: Use the correct endpoint for fetching emojis
                url: "/users/@me/emojis",
            })
                .then(d => {
                    window.applicationEmojis = d.body;
                    resolve(d.body);
                })
                .catch(() => resolve([]));
        });
    },
    // Debug
    get console() {
        return BotClientLogger;
    },
    // Dexie
    get db() {
        return db;
    },
    get sessionStorage() {
        return originalSessionStorage;
    },
    // Patches
    updateGuildSubscriptionsPatch,
    voiceStateUpdatePatch,
    handleClosePatch,
    handleDispatchPatch,
    doIdentifyFirstPatch,
    openPrivateChannelPatch,
    isUserAccountSession,
    /** Bot accounts identify with intents and a shard, user accounts must not */
    identifyExtra(botInfo: any) {
        if (botInfo?.isUserAccount) return {};
        return {
            intents: botInfo.intents,
            shard: [parseInt(originalSessionStorage.getItem("currentShard") || "0"), botInfo.allShards]
        };
    },
    // Global patches
    applyGlobalPatches() {
        Object.defineProperty(BigInt.prototype, "includes", {
            value(searchValue, position = 0) {
                const value = BigInt.prototype.toString.call(this);
                return value.includes(String(searchValue), position);
            },
            writable: true,
            configurable: true,
        });
        Object.defineProperty(BigInt.prototype, Symbol.iterator, {
            value: function* () {
                const text = BigInt.prototype.toString.call(this);
                yield* text;
            },
            writable: true,
            configurable: true,
        });
    },
    removeGlobalPatches() {
        // eslint-disable-next-line @typescript-eslint/dot-notation
        delete BigInt.prototype["includes"];
        delete BigInt.prototype[Symbol.iterator];
    },
});
