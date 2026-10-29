/* Copyright Elysia © 2025. All rights reserved */

import "express";

import type { IncomingHttpHeaders } from "http";

import type { DiscordBotClient } from "./AppCore";

declare module "express-serve-static-core" {
    interface Request {
        originalHeaders: IncomingHttpHeaders;
        rawBody?: string;
        /** Set when the request is authenticated with a real user account token */
        isUserAccount?: boolean;
    }
}

declare global {
    interface BigInt {
        toJSON(): string;
    }
    interface Window {
        Dexie: unknown;
    }
    var botClient: DiscordBotClient;
}
