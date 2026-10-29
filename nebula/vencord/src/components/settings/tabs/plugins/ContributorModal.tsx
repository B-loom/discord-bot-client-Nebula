/*
 * Vencord, a Discord client mod
 * Copyright (c) 2023 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./ContributorModal.css";

import { useSettings } from "@api/Settings";
import { Link } from "@components/Link";
import { DevsById } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import { fetchUserProfile } from "@utils/discord";
import { classes, pluralise } from "@utils/misc";
import { RenderModalProps, User } from "@vencord/discord-types";
import { Forms, Modal, openModal, showToast, useEffect, useMemo, UserProfileStore, useStateFromStores } from "@webpack/common";

import Plugins from "~plugins";

import { PluginCard } from "./PluginCard";
import { GithubButton, WebsiteButton } from "./PluginModalButtons";

const cl = classNameFactory("vc-author-modal-");

/** Nebula has no Discord account of its own, so its card is drawn from the app itself */
const NEBULA = "Nebula";

function NebulaAvatar() {
    return (
        <svg viewBox="0 0 24 24" className={cl("avatar")} fill="currentColor" aria-hidden="true">
            <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm0 2a8 8 0 0 1 7.6 5.5 15.3 15.3 0 0 1-5 3.9 15.3 15.3 0 0 1-6.2 1.6A8 8 0 0 1 12 4Zm-7.9 7.3a10.2 10.2 0 0 0 4 .9 17.3 17.3 0 0 0 7-1.8 17.3 17.3 0 0 0 4.6-3.3 8 8 0 1 1-15.6 4.2Z" />
            <circle cx="9" cy="9" r="1.4" />
            <circle cx="15.5" cy="15" r="1.1" />
        </svg>
    );
}

export function openContributorModal(user: User) {
    openModal(modalProps => <ContributorModal user={user} modalProps={modalProps} />);
}

function ContributorModal({ user, modalProps }: { user: User; modalProps: RenderModalProps; }) {
    useSettings();

    const profile = useStateFromStores([UserProfileStore], () => UserProfileStore.getUserProfile(user.id));

    useEffect(() => {
        if (!profile && !user.bot && user.id)
            fetchUserProfile(user.id);
    }, [user.id, user.bot, profile]);

    const githubName = profile?.connectedAccounts?.find(a => a.type === "github")?.name;
    const website = profile?.connectedAccounts?.find(a => a.type === "domain")?.name;

    const plugins = useMemo(() => {
        const allPlugins = Object.values(Plugins);
        const pluginsByAuthor = DevsById[user.id]
            ? allPlugins.filter(p => p.authors.includes(DevsById[user.id]))
            : allPlugins.filter(p => p.authors.some(a => a.name === user.username));

        return pluginsByAuthor
            .filter(p => !p.name.endsWith("API"))
            .sort((a, b) => Number(a.required ?? false) - Number(b.required ?? false));
    }, [user.id, user.username]);

    const isNebula = user.username === NEBULA;
    const ContributedHyperLink = <Link href="https://vencord.dev/source">contribué</Link>;

    return (
        <Modal
            {...modalProps}
            title={
                <div className="vc-plugin-modal-header">
                    {isNebula
                        ? <NebulaAvatar />
                        : (
                            <img
                                className={cl("avatar")}
                                src={user.getAvatarURL(void 0, 512, true)}
                                alt=""
                            />
                        )}
                    <Forms.FormTitle tag="h2" className={cl("name")}>{user.username}</Forms.FormTitle>

                    <div className={classes("vc-settings-modal-links", cl("links"))}>
                        {website && (
                            <WebsiteButton
                                text={website}
                                href={`https://${website}`}
                            />
                        )}
                        {githubName && (
                            <GithubButton
                                text={githubName}
                                href={`https://github.com/${githubName}`}
                            />
                        )}
                    </div>
                </div>
            }
            subtitle={
                isNebula
                    ? (
                        <Forms.FormText>
                            Les plugins écrits pour Nebula, le client que tu utilises.
                        </Forms.FormText>
                    )
                    : plugins.length
                        ? (
                            <Forms.FormText>
                                Cette personne a {ContributedHyperLink} à {pluralise(plugins.length, "plugin")}.
                            </Forms.FormText>
                        )
                        : (
                            <Forms.FormText>
                                Cette personne n’a écrit aucun plugin. Elle a sans doute {ContributedHyperLink} à Vencord autrement.
                            </Forms.FormText>
                        )
            }
        >
            {!!plugins.length && (
                <div className={cl("plugins")}>
                    {plugins.map(p =>
                        <PluginCard
                            key={p.name}
                            plugin={p}
                            disabled={p.required ?? false}
                            onRestartNeeded={() => showToast({ text: "Redémarre pour appliquer les changements." })}
                        />
                    )}
                </div>
            )}
        </Modal>
    );
}
