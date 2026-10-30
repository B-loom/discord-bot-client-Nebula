/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

/*
 * Nebula is an Electron client, not a browser: the stream is set up by the application
 * itself. The bitrate this plugin writes into the offer — eighty megabits — is far beyond
 * anything Discord accepts, and a rejected offer leaves the stream dead with no reason
 * given, so the patches stand aside here.
 */
const runningUnderNebula = () => Boolean((window as any).BotClientNative);

export default definePlugin({
    name: "WebScreenShareFixes",
    authors: [Devs.Kaitlyn],
    description: "Removes 2500kbps bitrate cap on chromium and vesktop clients and fixes CPU usage growing endlessly while screensharing.",
    tags: ["Voice"],
    enabledByDefault: true,

    patches: [
        {
            find: "x-google-max-bitrate",
            predicate: () => !runningUnderNebula(),
            replacement: [
                {
                    match: /`x-google-max-bitrate=\$\{\i\}`/,
                    replace: '"x-google-max-bitrate=80000"'
                },
                {
                    match: /;usedtx=\$\{(\i)\?"0":"1"\}/,
                    replace: '$&${$1?";stereo=1;sprop-stereo=1":""}'
                },
            ]
        },
        {
            find: "ApplicationStreamPreviewUploadManager",
            predicate: () => !runningUnderNebula(),
            replacement: {
                match: /removeAttribute\("srcObject"\)(?<=(\i)\..+?)/,
                replace: "pause(),$1.srcObject=null"
            }
        }
    ]
});
