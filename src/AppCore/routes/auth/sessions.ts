/* Copyright Elysia © 2025. All rights reserved */

import { Router } from "express";

const app = Router({ mergeParams: true });

app.get("/", (req, res) => {
    res.send({
        user_sessions: [
            {
                id_hash: Buffer.from("Nebula", "utf8").toString("base64"),
                approx_last_used_time: new Date().toISOString(),
                client_info: {
                    os: process.platform === "win32" ? "Windows" : process.platform === "darwin" ? "macOS" : "Linux",
                    platform: "Nebula",
                    location: "Aedes Elysiae",
                },
            },
        ],
    });
});

export default app;
