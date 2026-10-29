/* Copyright Elysia © 2025. All rights reserved */

import { Router } from "express";
import { GetSystemMessage } from "src/AppUtils/SystemMessages";

const app = Router({ mergeParams: true });

app.all("/", async (req, res) => {
    switch (req.method.toLowerCase()) {
        case "delete":
        case "patch":
        case "post": {
            return res.status(403).send({
                message: "APIServer : impossible d’envoyer un message à cet utilisateur",
                code: 50007,
            });
        }
        default: {
            const SystemMessages = await GetSystemMessage();
            return res.send(SystemMessages);
        }
    }
});

app.all("/*", (req, res) => {
    res.status(404).send();
});

export default app;
