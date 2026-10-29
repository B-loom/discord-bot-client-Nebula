/* Copyright Elysia © 2025. All rights reserved */

import { Router } from "express";
import Constants from "src/AppCore/Constants";
import Util from "src/AppUtils/Utils";

const app = Router({ mergeParams: true });

app.get("/", (req, res) => {
    res.send(Constants.UserDefaultPatch);
});

/*
 * The profile lives here rather than in its own `profile.ts`: route files are registered
 * in alphabetical order, so the catch-all below would answer 404 before `profile.ts`
 * ever got a chance to run.
 */
app.get("/profile", (req, res) => {
    const profile = Util.ProfilePatch(Constants.UserDefaultPatch, null, null, Constants.DefaultBio);
    profile.user_profile.banner = Constants.UserDefaultPatch.banner ?? null;
    profile.user_profile.accent_color = Constants.UserDefaultPatch.accent_color ?? null;
    profile.premium_type = 2;
    res.send(profile);
});

app.all("/*", (req, res) => {
    res.status(404).send();
});

export default app;
