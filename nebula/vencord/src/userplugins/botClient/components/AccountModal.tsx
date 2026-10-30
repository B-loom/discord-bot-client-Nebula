/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./AccountModal.css";

import ErrorBoundary from "@components/ErrorBoundary";
import { classNameFactory } from "@utils/css";
import { Logger } from "@utils/Logger";
import { closeModal, ModalContent, ModalFooter, ModalHeader, ModalRoot, ModalSize, openModal } from "@utils/modal";
import { Button, Forms, React, TextInput } from "@webpack/common";

const cl = classNameFactory("vc-nebula-account-");
const logger = new Logger("NebulaComptes", "#f5bde6");

function native() {
    return (window as any).BotClientNative;
}

/** What the main process answers, as UserAuth defines it */
type AuthResult =
    | { status: "success"; token: string; account: { username?: string; }; }
    | { status: "mfa"; ticket: string; methods: { type: string; }[]; }
    | { status: "captcha"; sitekey: string; rqdata: string | null; rqtoken: string | null; }
    | { status: "error"; message: string; };

type Step =
    | { name: "login"; }
    | { name: "mfa"; ticket: string; methods: string[]; }
    | { name: "done"; username: string; token: string; };

const MFA_LABELS: Record<string, string> = {
    totp: "Application d'authentification",
    sms: "Code par SMS",
    backup: "Code de secours",
    webauthn: "Clé de sécurité",
    password: "Mot de passe",
};

function AccountModal({ close }: { close: () => void; }) {
    const [step, setStep] = React.useState<Step>({ name: "login" });
    const [login, setLogin] = React.useState("");
    const [password, setPassword] = React.useState("");
    const [token, setToken] = React.useState("");
    const [code, setCode] = React.useState("");
    const [method, setMethod] = React.useState("totp");
    const [error, setError] = React.useState<string | null>(null);
    const [busy, setBusy] = React.useState(false);

    /*
     * Every sign-in ends one of four ways, whatever started it: a captcha to solve, a
     * second factor to ask for, an error to show, or a token to keep.
     */
    const handle = async (result: AuthResult | undefined): Promise<void> => {
        if (!result) return setError("Aucune réponse de Discord.");

        switch (result.status) {
            case "success":
                setError(null);
                setStep({
                    name: "done",
                    username: result.account?.username ?? "ton compte",
                    token: result.token,
                });
                return;

            case "mfa": {
                setError(null);
                // The methods arrive as objects, each naming one way of proving it is you
                const methods = (result.methods ?? []).map(entry => entry.type).filter(Boolean);
                setMethod(methods[0] ?? "totp");
                setStep({ name: "mfa", ticket: result.ticket, methods: methods.length ? methods : ["totp"] });
                return;
            }

            case "captcha": {
                setError(null);
                // hCaptcha only runs on a page Discord itself serves, hence its own window
                const key = await native()?.accountSolveCaptcha?.(result.sitekey, result.rqdata ?? null);
                if (!key) return setError("Captcha abandonné.");
                return handle(
                    await native()?.accountLogin?.(login, password, { key, rqtoken: result.rqtoken ?? null }),
                );
            }

            default:
                setError(result.message ?? "Connexion impossible.");
        }
    };

    const run = async (work: () => Promise<AuthResult>) => {
        setBusy(true);
        try {
            await handle(await work());
        } catch (e) {
            logger.error("Échec de la connexion", e);
            setError(String((e as Error)?.message ?? e));
        } finally {
            setBusy(false);
        }
    };

    return (
        <>
            <ModalHeader separator={false}>
                <div className={cl("header")}>
                    <Forms.FormTitle tag="h2" className={cl("title")}>
                        {step.name === "mfa" ? "Vérification en deux étapes" : "Ajouter un compte"}
                    </Forms.FormTitle>
                    <Forms.FormText className={cl("subtitle")}>
                        {step.name === "mfa"
                            ? "Saisis le code demandé par Discord."
                            : "Un compte Discord, ou un bot avec son token."}
                    </Forms.FormText>
                </div>
            </ModalHeader>

            <ModalContent className={cl("content")}>
                {error && <div className={cl("error")}>{error}</div>}

                {step.name === "login" && (
                    <>
                        <div className={cl("label")}>Adresse e-mail ou numéro de téléphone</div>
                        <TextInput value={login} onChange={setLogin} placeholder="exemple@mail.com" />

                        <div className={cl("label")}>Mot de passe</div>
                        <TextInput type="password" value={password} onChange={setPassword} />

                        <Button
                            className={cl("wide")}
                            color={Button.Colors.BRAND}
                            disabled={busy || !login || !password}
                            onClick={() => run(() => native()?.accountLogin?.(login, password))}
                        >
                            {busy ? "Connexion…" : "Se connecter"}
                        </Button>

                        <div className={cl("separator")}>ou</div>

                        <div className={cl("label")}>Token de compte ou de bot</div>
                        <TextInput
                            type="password"
                            value={token}
                            onChange={setToken}
                            placeholder="Se connecter sans mot de passe"
                        />
                        <Button
                            className={cl("wide")}
                            color={Button.Colors.PRIMARY}
                            disabled={busy || !token}
                            onClick={() => run(() => native()?.accountTokenLogin?.(token))}
                        >
                            Se connecter avec ce token
                        </Button>
                    </>
                )}

                {step.name === "mfa" && (
                    <>
                        {step.methods.length > 1 && (
                            <div className={cl("methods")}>
                                {step.methods.map(entry => (
                                    <button
                                        key={entry}
                                        className={cl(entry === method ? "method-current" : "method")}
                                        onClick={() => setMethod(entry)}
                                    >
                                        {MFA_LABELS[entry] ?? entry}
                                    </button>
                                ))}
                            </div>
                        )}

                        {method === "sms" && (
                            <Button
                                className={cl("wide")}
                                color={Button.Colors.PRIMARY}
                                onClick={() => native()?.accountSendSms?.(step.ticket)}
                            >
                                Recevoir le code par SMS
                            </Button>
                        )}

                        <div className={cl("label")}>
                            {method === "backup" ? "Code de secours" : "Code à six chiffres"}
                        </div>
                        <TextInput value={code} onChange={setCode} placeholder="123456" />

                        <Button
                            className={cl("wide")}
                            color={Button.Colors.BRAND}
                            disabled={busy || !code}
                            onClick={() => run(() => native()?.accountMfa?.(step.ticket, code, method))}
                        >
                            {busy ? "Vérification…" : "Vérifier"}
                        </Button>
                    </>
                )}

                {step.name === "done" && (
                    <div className={cl("done")}>
                        <div className={cl("label")}>
                            {step.username} est enregistré sur cet ordinateur.
                        </div>
                        <Button
                            className={cl("wide")}
                            color={Button.Colors.BRAND}
                            onClick={() => native()?.accountUse?.(step.token)}
                        >
                            Ouvrir Discord avec ce compte
                        </Button>
                        <Button
                            className={cl("wide")}
                            color={Button.Colors.PRIMARY}
                            onClick={() => native()?.accountOpenWindow?.(step.token)}
                        >
                            Ouvrir dans une nouvelle fenêtre
                        </Button>
                    </div>
                )}
            </ModalContent>

            <ModalFooter className={cl("footer")}>
                {step.name !== "login" && (
                    <Button
                        color={Button.Colors.PRIMARY}
                        look={Button.Looks.LINK}
                        onClick={() => {
                            setError(null);
                            setCode("");
                            setStep({ name: "login" });
                        }}
                    >
                        Retour
                    </Button>
                )}
                <Button color={Button.Colors.PRIMARY} onClick={close}>Fermer</Button>
            </ModalFooter>
        </>
    );
}

/** Opens the sign-in inside Discord, in place of the window it used to be */
export function openAccountModal() {
    const key = openModal(props => (
        <ErrorBoundary noop>
            <ModalRoot {...props} size={ModalSize.SMALL}>
                <AccountModal close={() => closeModal(key)} />
            </ModalRoot>
        </ErrorBoundary>
    ));
}
