/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Logger } from "@utils/Logger";

const logger = new Logger("NebulaBloque", "#f5bde6");

/**
 * Windows Discord opens on its own, which lead nowhere here. They are not routes, so the
 * address cannot be watched for them; they are recognised by the title they draw and
 * their contents replaced, the way the blocked pages are.
 */
const BLOCKED = [
    {
        title: "Envoyer un cadeau",
        paragraphs: [
            "Cette fenêtre offre un abonnement Nitro. Elle a besoin des rouages de paiement de Discord, qui n'existent que dans le client officiel.",
            "Passe par Discord pour offrir un abonnement.",
        ],
    },
];

const ART = "https://cdn.discordapp.com/emojis/1399479404706660373.gif";

function replace(modal: HTMLElement, paragraphs: string[]) {
    modal.innerHTML = "";

    const panel = document.createElement("div");
    panel.className = "nebula-blocked-modal";

    const art = document.createElement("img");
    art.src = ART;
    art.alt = "";
    art.className = "nebula-blocked-art";

    const title = document.createElement("h2");
    title.className = "nebula-blocked-title";
    title.textContent = "Rien à voir par ici";

    const body = document.createElement("div");
    body.className = "nebula-blocked-body";
    for (const text of paragraphs) {
        const line = document.createElement("p");
        line.textContent = text;
        body.append(line);
    }

    panel.append(art, title, body);
    modal.append(panel);
}

/*
 * Hiding the quest panel left its wrapper behind, and the wrapper keeps its height: a
 * band of empty space above the account bar. The panel is found in the page and the
 * container holding it is hidden, rather than guessing at a class name.
 */
const QUEST_PARTS = '[class*="questProgress"], [class*="questAccepted"], [class*="questsPanel"], [class*="questPanel"]';

function hideQuestPanel() {
    for (const node of document.querySelectorAll<HTMLElement>(QUEST_PARTS)) {
        const holder = node.closest<HTMLElement>('[class*="contentWrapper"]') ?? node.parentElement;
        if (!holder || holder.dataset.nebulaHidden) continue;
        holder.dataset.nebulaHidden = "1";
        holder.style.display = "none";
    }
}

/** Watches for one of those windows appearing and takes its place */
export function blockUnavailableModals() {
    const check = () => {
        hideQuestPanel();

        for (const entry of BLOCKED) {
            for (const heading of document.querySelectorAll<HTMLElement>("h1,h2")) {
                if (heading.textContent?.trim() !== entry.title) continue;

                // The window itself, rather than the heading inside it
                const modal = heading.closest<HTMLElement>('[class*="modal_"], [role="dialog"]');
                if (!modal || modal.dataset.nebulaBlocked) continue;

                modal.dataset.nebulaBlocked = "1";
                replace(modal, entry.paragraphs);
            }
        }
    };

    try {
        // Driven by the page rather than by a timer, so nothing runs while nothing opens
        new MutationObserver(check).observe(document.body, { childList: true, subtree: true });
        check();
    } catch (error) {
        logger.warn("Impossible de surveiller les fenêtres bloquées", error);
    }
}
