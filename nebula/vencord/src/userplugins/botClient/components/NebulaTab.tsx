/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./NebulaTab.css";

import { classNameFactory } from "@utils/css";
import { Button, Forms, React } from "@webpack/common";

import { isUserAccountSession } from "../utils/patches";
import { CHANGELOG, README } from "./docs";

const cl = classNameFactory("vc-nebula-");

const BrandEmoji = "https://cdn.discordapp.com/emojis/1399479404706660373.gif";

function native() {
    return (window as any).BotClientNative;
}

/** Sidebar icon for the Nebula settings entry */
export function NebulaIcon(props: any) {
    return (
        <svg
            viewBox="0 0 24 24"
            width={props?.width ?? 20}
            height={props?.height ?? 20}
            fill="currentColor"
            aria-hidden="true"
            {...props}
        >
            <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm0 2a8 8 0 0 1 7.6 5.5 15.3 15.3 0 0 1-5 3.9 15.3 15.3 0 0 1-6.2 1.6A8 8 0 0 1 12 4Zm-7.9 7.3a10.2 10.2 0 0 0 4 .9 17.3 17.3 0 0 0 7-1.8 17.3 17.3 0 0 0 4.6-3.3 8 8 0 1 1-15.6 4.2Z" />
            <circle cx="9" cy="9" r="1.4" />
            <circle cx="15.5" cy="15" r="1.1" />
        </svg>
    );
}

function Row({ label, value }: { label: string; value: string; }) {
    return (
        <div className={cl("row")}>
            <span className={cl("rowLabel")}>{label}</span>
            <span className={cl("rowValue")}>{value}</span>
        </div>
    );
}

/** Shown instead of the pages that cannot work here */
export function BotBillingTab() {
    const isUserSession = isUserAccountSession();
    return (
        <div className={cl("empty")}>
            <img src={BrandEmoji} alt="" className={cl("emptyArt")} />
            <Forms.FormTitle tag="h3">Rien à voir par ici</Forms.FormTitle>
            {isUserSession ? (
                <Forms.FormText className={cl("emptyText")}>
                    Nebula ne prend pas en charge cette page. Elle a besoin des rouages de paiement et
                    d’authentification de Discord, qui n’existent que dans le client officiel : passe par
                    celui-ci pour y accéder.
                </Forms.FormText>
            ) : (
                <>
                    <Forms.FormText className={cl("emptyText")}>
                        Tu es connecté avec un bot. Cette page concerne les réglages d’un compte Discord : Nitro,
                        abonnements, moyens de paiement, confidentialité, notifications… Un bot n’a rien de tout ça.
                    </Forms.FormText>
                    <Forms.FormText className={cl("emptyText")}>
                        Connecte-toi avec un compte Discord pour y accéder.
                    </Forms.FormText>
                    <Button
                        size={Button.Sizes.SMALL}
                        color={Button.Colors.BRAND}
                        onClick={() => native()?.openAccountLogin?.()}
                    >
                        Se connecter avec un compte
                    </Button>
                </>
            )}
        </div>
    );
}

/**
 * Very small markdown renderer: enough for the two bundled documents.
 * Lines that continue a bullet (indented) are folded back into it so long
 * items wrap under their own text instead of under the bullet.
 */
function Markdown({ source }: { source: string; }) {
    const nodes: React.ReactNode[] = [];
    let list: string[] = [];

    const flushList = () => {
        if (!list.length) return;
        const items = [...list];
        nodes.push(
            <ul key={`list-${nodes.length}`} className={cl("docList")}>
                {items.map((item, index) => (
                    <li key={index} className={cl("docItem")}>{inline(item)}</li>
                ))}
            </ul>
        );
        list = [];
    };

    let quote: string[] = [];
    const flushQuote = () => {
        if (!quote.length) return;
        const lines = [...quote];
        nodes.push(
            <div key={`quote-${nodes.length}`} className={cl("docQuote")}>
                {lines.map((item, index) => (
                    <Forms.FormText key={index} className={cl("docText")}>{inline(item)}</Forms.FormText>
                ))}
            </div>
        );
        quote = [];
    };

    for (const line of source.trim().split("\n")) {
        // Consecutive quoted lines make one block, and a bare ">" separates two of them
        if (line.startsWith(">")) {
            flushList();
            const text = line.replace(/^>\s?/, "");
            if (text.trim()) {
                quote.push(text);
            } else {
                flushQuote();
            }
            continue;
        }
        flushQuote();

        if (line.startsWith("- ")) {
            list.push(line.slice(2));
            continue;
        }
        // An indented line continues the bullet above it
        if (list.length && line.startsWith("  ") && line.trim()) {
            list[list.length - 1] += ` ${line.trim()}`;
            continue;
        }
        flushList();
        const key = `line-${nodes.length}`;
        if (/^-{3,}$/.test(line.trim())) {
            nodes.push(<div key={key} className={cl("docRule")} />);
        } else if (line.startsWith("### ")) {
            nodes.push(<Forms.FormTitle key={key} tag="h5">{line.slice(4)}</Forms.FormTitle>);
        } else if (line.startsWith("## ")) {
            nodes.push(<Forms.FormTitle key={key} tag="h3">{line.slice(3)}</Forms.FormTitle>);
        } else if (line.startsWith("# ")) {
            nodes.push(<Forms.FormTitle key={key} tag="h1">{line.slice(2)}</Forms.FormTitle>);
        } else if (!line.trim()) {
            nodes.push(<div key={key} className={cl("docSpace")} />);
        } else {
            nodes.push(<Forms.FormText key={key} className={cl("docText")}>{inline(line)}</Forms.FormText>);
        }
    }
    flushList();
    flushQuote();

    return <div className={cl("doc")}>{nodes}</div>;
}

/** Renders **bold**, `code` runs and [links](url) */
function inline(text: string) {
    return text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g).map((part, index) => {
        if (part.startsWith("**") && part.endsWith("**")) {
            return <strong key={index}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith("`") && part.endsWith("`")) {
            return <code key={index} className={cl("docCode")}>{part.slice(1, -1)}</code>;
        }
        const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
        if (link) {
            return (
                <a key={index} href={link[2]} target="_blank" rel="noreferrer" className={cl("docLink")}>
                    {link[1]}
                </a>
            );
        }
        return part;
    });
}

export function ReadmeTab() {
    return <Markdown source={README} />;
}

export function ChangelogTab() {
    return <Markdown source={CHANGELOG} />;
}

type UpdateState = {
    state: "idle" | "checking" | "up-to-date" | "available" | "downloading" | "ready" | "error";
    version?: string;
    percent?: number;
    message?: string;
};

/** What each state means to someone reading the page, and the colour of its dot */
const UPDATE_LABELS: Record<UpdateState["state"], { text: string; tone: "good" | "bad" | "wait"; }> = {
    idle: { text: "Non vérifié", tone: "wait" },
    checking: { text: "Vérification…", tone: "wait" },
    "up-to-date": { text: "À jour", tone: "good" },
    available: { text: "Mise à jour disponible", tone: "bad" },
    downloading: { text: "Téléchargement…", tone: "wait" },
    ready: { text: "Prête à installer", tone: "bad" },
    error: { text: "Vérification impossible", tone: "bad" },
};

/** Follows the update as the main process reports it */
function useUpdateState(): UpdateState {
    const [state, setState] = React.useState<UpdateState>(
        () => native()?.getUpdateState?.() ?? { state: "idle" },
    );

    React.useEffect(() => {
        native()?.onUpdateState?.((next: UpdateState) => setState(next));
    }, []);

    return state;
}

export default function NebulaTab() {
    const [copied, setCopied] = React.useState(false);
    const update = useUpdateState();
    const updateLabel = UPDATE_LABELS[update.state] ?? UPDATE_LABELS.idle;

    const version = native()?.getBotClientVersion?.() ?? "inconnue";
    const name = native()?.getBotClientName?.() ?? "Nebula";
    const chrome = navigator.userAgent.match(/Chrome\/([\d.]+)/)?.[1] ?? "inconnue";
    const electron = navigator.userAgent.match(/Electron\/([\d.]+)/)?.[1] ?? "inconnue";

    const isUserSession = isUserAccountSession();

    const details = [
        `${name} v${version}`,
        `Chromium ${chrome}`,
        `Electron ${electron}`,
        `Plateforme ${navigator.platform}`,
        `Langue ${navigator.language}`,
        `Session ${isUserSession ? "compte utilisateur" : "bot"}`,
    ].join("\n");

    return (
        <>
            <div className={cl("hero")}>
                <div className={cl("heroText")}>
                    <Forms.FormTitle tag="h3" className={cl("heroTitle")}>
                        <img src={BrandEmoji} alt="" className={cl("heroEmoji")} />
                        Nebula
                    </Forms.FormTitle>
                    <Forms.FormText className={cl("heroBody")}>
                        Connecte-toi à tes comptes Discord et à tes bots depuis un seul client.
                    </Forms.FormText>
                    <Button
                        size={Button.Sizes.SMALL}
                        color={Button.Colors.WHITE}
                        look={Button.Looks.FILLED}
                        disabled={update.state === "checking" || update.state === "downloading"}
                        onClick={() => native()?.checkForUpdates?.()}
                    >
                        {update.state === "checking" ? "Vérification…" : "Vérifier les mises à jour"}
                    </Button>
                </div>
                <img src={BrandEmoji} alt="" className={cl("heroArt")} />
            </div>

            <Forms.FormSection title="Informations">
                <div className={cl("card")}>
                    <Row label="Application" value={name} />
                    <Row label="Version" value={`v${version}`} />
                    <div className={cl("row")}>
                        <span className={cl("rowLabel")}>Mise à jour</span>
                        <span className={cl("rowValue")}>
                            <span className={cl(`dot-${updateLabel.tone}`)} />
                            {updateLabel.text}
                            {update.version && update.state === "available" ? ` (v${update.version})` : ""}
                        </span>
                    </div>
                    <Row label="Chromium" value={chrome} />
                    <Row label="Electron" value={electron} />
                    <Row label="Plateforme" value={navigator.platform} />
                    <Row label="Langue" value={navigator.language} />
                    <Row label="Build Discord" value={String((window as any).GLOBAL_ENV?.BUILD_NUMBER ?? "inconnu")} />
                    <Row label="Canal" value={String((window as any).GLOBAL_ENV?.RELEASE_CHANNEL ?? "inconnu")} />
                    <Row label="Session" value={isUserSession ? "Compte utilisateur" : "Bot"} />
                    <Row label="Cœurs CPU" value={String(navigator.hardwareConcurrency ?? "inconnu")} />
                </div>
                {update.state === "downloading" && (
                    <div className={cl("progress")}>
                        <div className={cl("progressBar")} style={{ width: `${update.percent ?? 0}%` }} />
                        <span className={cl("progressText")}>
                            Téléchargement de la mise à jour : {update.percent ?? 0} %
                        </span>
                    </div>
                )}
                {update.state === "error" && update.message && (
                    <Forms.FormText className={cl("updateError")}>{update.message}</Forms.FormText>
                )}
                <div className={cl("actions")}>
                    {update.state === "ready" && (
                        <Button
                            size={Button.Sizes.SMALL}
                            color={Button.Colors.GREEN}
                            onClick={() => native()?.installUpdate?.()}
                        >
                            Redémarrer et installer
                        </Button>
                    )}
                    <Button
                        size={Button.Sizes.SMALL}
                        color={Button.Colors.PRIMARY}
                        onClick={() => {
                            navigator.clipboard.writeText(details);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                        }}
                    >
                        {copied ? "Copié !" : "Copier les informations"}
                    </Button>
                    <Button
                        size={Button.Sizes.SMALL}
                        color={Button.Colors.PRIMARY}
                        onClick={() => location.reload()}
                    >
                        Recharger le client
                    </Button>
                </div>
            </Forms.FormSection>

            <Forms.FormSection title="Comptes">
                <Forms.FormText className={cl("sectionText")}>
                    Les comptes connectés avec une adresse e-mail et un mot de passe sont enregistrés sur cet
                    ordinateur. Tu peux les gérer depuis la fenêtre de connexion.
                </Forms.FormText>
                <div className={cl("actions")}>
                    <Button
                        size={Button.Sizes.SMALL}
                        color={Button.Colors.BRAND}
                        onClick={() => native()?.openAccountLogin?.()}
                    >
                        Ouvrir la fenêtre de connexion
                    </Button>
                </div>
            </Forms.FormSection>
        </>
    );
}
