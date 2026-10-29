/* Copyright Elysia © 2025. All rights reserved */

import { APIUser } from "discord-api-types/v10";

/**
 * The avatar and banner hashes are placeholders: requests for them are
 * redirected to the local files in `assets/branding` (see `sessionPatch`).
 */
export default {
    "47835198259200000": {
        id: "47835198259200000",
        username: "Sakura",
        global_name: "Sakura",
        avatar: "sakuraavatar0000000000000000000000",
        avatar_decoration: null,
        discriminator: "0000",
        public_flags: 1,
        flags: 1,
        bot: true,
        system: true,
        banner: "a_sakurabanner000000000000000000000",
        accent_color: null,
    },
} as Record<string, APIUser>;
