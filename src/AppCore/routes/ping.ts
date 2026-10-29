/* Copyright Elysia © 2025. All rights reserved */

import { Router } from "express";

const app = Router({ mergeParams: true });

app.get("/", (req, res) => {
    res.send({
        code: 0,
        message: "OK",
        version: globalThis.botClient.app.getVersion(),
        isBotClient: req.headers["user-agent"]?.includes("Nebula") || false,
    });
});

export default app;
