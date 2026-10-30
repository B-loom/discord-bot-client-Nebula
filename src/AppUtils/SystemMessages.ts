/* Copyright Elysia © 2025. All rights reserved */

import { APIMessage, MessageType } from "discord-api-types/v10";
import Constants from "src/AppCore/Constants";

const BrandColor = 16750296;

export async function GetSystemMessage () {
    const brandingUrl = (file: string) => `https://${Constants.CustomDiscordDomain}/__botclient/assets/${file}`;
    return [
        // MessageData
        {
            id: "1000000000000000000",
            // https://docs.discord.food/resources/message#message-type
            type: 47 as MessageType, // CHANGELOG => Disable Message Forwards
            channel_id: Constants.ChannelIdDefault,
            author: Constants.UserDefaultPatch,
            attachments: [],
            content: "",
            embeds: [
                {
                    type: "rich",
                    title: "Télécharge cette application uniquement depuis la source officielle !",
                    description:
                        "### La télécharger ailleurs peut mettre ton ordinateur en danger et exposer tes données personnelles.",
                    color: BrandColor,
                    author: {
                        name: "Avis important",
                        icon_url: "https://i.imgur.com/P4wWwbP.png",
                        proxy_icon_url: "https://i.imgur.com/P4wWwbP.png",
                    },
                    thumbnail: {
                        url: brandingUrl("sakura-avatar.webp"),
                        width: 128,
                        height: 128,
                    },
                },
                {
                    type: "rich",
                    description: `Cette application te permet de te connecter à des **comptes Discord** et à des **bots Discord**, et de les utiliser depuis un seul et même client.

Ouvre la fenêtre de connexion pour ajouter un compte avec son adresse e-mail et son mot de passe, ou colle un token de bot sur l'écran de connexion.

**Un souci, une question, une idée ?**`,
                    color: BrandColor,
                    author: {
                        name: "Bienvenue !",
                        icon_url: brandingUrl("sakura-avatar.webp"),
                        proxy_icon_url: brandingUrl("sakura-avatar.webp"),
                    },
                },
                {
                    type: "rich",
                    image: {
                        url: brandingUrl("sakura-banner.webp"),
                        srcIsAnimated: false,
                        flags: 0,
                        width: 498,
                        height: 280,
                    },
                    color: BrandColor,
                    timestamp: new Date().toISOString(),
                    footer: {
                        text: "Sakura",
                        icon_url: brandingUrl("sakura-avatar.webp"),
                    },
                },
            ],
            mentions: [],
            mention_roles: [],
            pinned: false,
            mention_everyone: false,
            tts: false,
            timestamp: new Date().toISOString(),
            edited_timestamp: null,
            flags: 16,
            components: [
                {
                    type: 1, // action row
                    components: [
                        {
                            type: 2, // button
                            style: 5, // link
                            label: "Rejoindre le serveur",
                            url: Constants.SupportInvite,
                            emoji: { id: Constants.DiscordEmojiId, name: "discord", animated: false },
                        },
                        {
                            type: 2,
                            style: 5,
                            label: "Voir sur GitHub",
                            url: Constants.ProjectRepoUrl,
                            emoji: { id: Constants.GithubEmojiId, name: "github", animated: false },
                        },
                        {
                            type: 2,
                            style: 5,
                            label: "Le site",
                            url: Constants.ProjectSiteUrl,
                            emoji: { id: Constants.SiteEmojiId, name: "nebula", animated: false },
                        },
                    ],
                },
            ],
        },
    ] as APIMessage[];
}
