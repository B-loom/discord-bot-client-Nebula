/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Margins } from "@utils/margins";
import { openAccountModal } from "./AccountModal";
import { classes } from "@utils/misc";
import { useEffect, useState } from "@webpack/common";

import { authBoxModule, cl, inputModule } from "./AuthBoxTokenLogin";

// Shared with the patched "Continue" button (validateTokenAndLogin), which is Discord's own button and lives outside this component
export const multiTokenState = { value: "" };

export default function AuthBoxMultiTokenLogin() {
    const [state, setState] = useState("");

    useEffect(() => {
        multiTokenState.value = "";
        return () => {
            multiTokenState.value = "";
        };
    }, []);

    return (
        <>
            <div className={classes(authBoxModule.block, Margins.top20)}>
                <div className={Margins.bottom20}>
                    <h5 className={classes(cl("h5"), cl("defaultMarginh5"))}>
                        Token du bot
                    </h5>
                    <div className={inputModule.inputWrapper}>
                        <input
                            className={inputModule.inputDefault}
                            name="token"
                            type="password"
                            placeholder="Colle le token de ton bot"
                            aria-label="Token"
                            autoComplete="off"
                            maxLength={100}
                            spellCheck="false"
                            value={state}
                            onChange={ev => {
                                setState(ev.target.value);
                                multiTokenState.value = ev.target.value;
                            }}
                        />
                    </div>
                </div>
                <div className={cl("separator")}>ou</div>
                <button
                    type="button"
                    className={cl("accountLink")}
                    onClick={ev => {
                        ev.preventDefault();
                        openAccountModal();
                    }}
                >
                    Ajouter un compte Discord (e-mail &amp; mot de passe)
                </button>
            </div>
        </>
    );
}
