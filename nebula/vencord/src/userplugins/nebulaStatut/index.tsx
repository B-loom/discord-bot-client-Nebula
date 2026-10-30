/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType } from "@utils/types";
import { FluxDispatcher } from "@webpack/common";

const logger = new Logger("NebulaStatut", "#f5bde6");

const settings = definePluginSettings({
    hideGames: {
        type: OptionType.BOOLEAN,
        description: "Ne pas montrer le jeu auquel tu joues",
        default: true,
        onChange: () => clearActivity(),
    },
    hideEverything: {
        type: OptionType.BOOLEAN,
        description: "Ne montrer aucune activité, y compris la musique et les autres applications",
        default: false,
        onChange: () => clearActivity(),
    },
});

/** True when the activity on its way out should be dropped */
function shouldHide(activity: any) {
    if (settings.store.hideEverything) return true;
    if (!settings.store.hideGames) return false;
    // Type 0 is "playing"; music and the rest carry other types
    return !activity.type || activity.type === 0;
}

let originalDispatch: ((event: any) => unknown) | null = null;

/** Sends an empty activity, which is what Discord itself sends when a game closes */
function clearActivity() {
    try {
        (originalDispatch ?? FluxDispatcher.dispatch.bind(FluxDispatcher))({
            type: "LOCAL_ACTIVITY_UPDATE",
            socketId: "nebula-games",
            activity: null,
        });
    } catch (error) {
        logger.warn("Impossible d'effacer l'activité en cours", error);
    }
}

export default definePlugin({
    name: "NebulaStatut",
    description:
        "Empêche ton activité d'apparaître sur ton profil : le jeu en cours, et si tu veux, tout le reste.",
    authors: [
        {
            name: "Nebula",
        },
    ],
    settings,

    start() {
        /*
         * Discord announces what you are doing through LOCAL_ACTIVITY_UPDATE, whoever
         * sends it — Nebula's own game detection, a music player, anything else. The
         * announcement is emptied before the dispatcher hands it to the stores, since a
         * subscriber would only see it once they already had it.
         */
        const dispatcher = FluxDispatcher as any;
        originalDispatch = dispatcher.dispatch.bind(dispatcher);

        dispatcher.dispatch = (event: any) => {
            if (event?.type === "LOCAL_ACTIVITY_UPDATE" && event.activity && shouldHide(event.activity)) {
                return originalDispatch!({ ...event, activity: null });
            }
            return originalDispatch!(event);
        };

        clearActivity();
    },

    stop() {
        if (!originalDispatch) return;
        (FluxDispatcher as any).dispatch = originalDispatch;
        originalDispatch = null;
    },
});
