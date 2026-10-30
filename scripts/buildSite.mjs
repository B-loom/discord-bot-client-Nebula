/* Copyright Elysia © 2025. All rights reserved */

/*
 * The site is generated from the project itself: the documentation page from README.md,
 * the changelog from the one embedded in the client, the licence from LICENSE, and the
 * version from package.json. Nothing is written twice, so nothing can drift.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "docs");

const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
const licence = fs.readFileSync(path.join(root, "LICENSE"), "utf8");

const docsSource = fs.readFileSync(
    path.join(root, "nebula/vencord/src/userplugins/botClient/components/docs.ts"),
    "utf8",
);
const changelogMatch = /export const CHANGELOG = `([\s\S]*?)`;/.exec(docsSource);
if (!changelogMatch) throw new Error("Le changelog est introuvable dans docs.ts");
const changelog = changelogMatch[1]
    .split("\\`").join("`")
    .split("\\${").join("${")
    .split("\\\\").join("\\");

const REPO = "https://github.com/B-loom/discord-bot-client-Nebula";
const INVITE = "https://discord.gg/TNTYSmy4mX";
const DOWNLOAD = `${REPO}/releases/latest/download/Nebula-win-x64.exe`;

const escape = (text) =>
    text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** **bold**, `code` and [links](url), in that order so none swallows another */
function inline(text) {
    return escape(text)
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/`([^`]+)`/g, "<code>$1</code>");
}

/** Just enough Markdown for what this project writes: no tables, no images */
function markdown(source) {
    const html = [];
    let list = null;
    let quote = null;

    const closeList = () => {
        if (!list) return;
        html.push(`<${list.tag}>${list.items.map(i => `<li>${i}</li>`).join("")}</${list.tag}>`);
        list = null;
    };
    const closeQuote = () => {
        if (!quote) return;
        html.push(`<blockquote>${quote.map(line => `<p>${line}</p>`).join("")}</blockquote>`);
        quote = null;
    };

    for (const raw of source.split("\n")) {
        const line = raw.trimEnd();

        if (line.startsWith(">")) {
            closeList();
            const text = line.replace(/^>\s?/, "");
            if (text.trim()) (quote ??= []).push(inline(text));
            else closeQuote();
            continue;
        }
        closeQuote();

        const ordered = /^\d+\.\s+(.*)$/.exec(line);
        const bullet = /^[-*]\s+(.*)$/.exec(line);

        if (bullet || ordered) {
            const tag = bullet ? "ul" : "ol";
            if (list && list.tag !== tag) closeList();
            list ??= { tag, items: [] };
            list.items.push(inline((bullet ?? ordered)[1]));
            continue;
        }

        // An indented line continues the bullet above it
        if (list && /^\s+\S/.test(raw)) {
            list.items[list.items.length - 1] += ` ${inline(line.trim())}`;
            continue;
        }

        closeList();

        if (/^-{3,}$/.test(line)) html.push("<hr>");
        else if (line.startsWith("### ")) html.push(`<h3>${inline(line.slice(4))}</h3>`);
        else if (line.startsWith("## ")) html.push(`<h2>${inline(line.slice(3))}</h2>`);
        else if (line.startsWith("# ")) html.push(`<h1>${inline(line.slice(2))}</h1>`);
        else if (line.trim()) html.push(`<p>${inline(line)}</p>`);
    }

    closeList();
    closeQuote();
    return html.join("\n");
}

const NAV = [
    { href: "index.html", label: "Accueil" },
    { href: "documentation.html", label: "Documentation" },
    { href: "changelog.html", label: "Nouveautés" },
    { href: "licence.html", label: "Licence" },
];

function page({ file, title, body, wide = false }) {
    const nav = NAV.map(
        item =>
            `<a class="${item.href === file ? "nav-link current" : "nav-link"}" href="${item.href}">${item.label}</a>`,
    ).join("");

    return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="Un client Discord de bureau qui réunit tes comptes Discord et tes bots dans une seule application.">
<link rel="icon" href="icon.png">
<link rel="stylesheet" href="style.css">
<meta property="og:title" content="${title}">
<meta property="og:description" content="Tes comptes Discord et tes bots dans une seule application.">
<meta property="og:image" content="icon.png">
</head>
<body>

<nav class="topbar">
    <a class="brand" href="index.html">
        <img src="icon.png" alt="">
        <span>Nebula</span>
        <span class="version">v${pkg.version}</span>
    </a>
    <div class="nav-links">${nav}</div>
</nav>

<main class="${wide ? "wrap wide" : "wrap"}">
${body}
</main>

<footer>
    <a href="${REPO}">Code source</a>
    <span>·</span>
    <a href="${REPO}/releases">Toutes les versions</a>
    <span>·</span>
    <a href="${INVITE}">Serveur Discord</a>
</footer>

</body>
</html>
`;
}

const DISCORD_ICON = `<svg viewBox="0 0 127.14 96.36" fill="currentColor" aria-hidden="true"><path d="M107.7 8.07A105.15 105.15 0 0 0 81.47 0a72.06 72.06 0 0 0-3.36 6.83 97.68 97.68 0 0 0-29.11 0A72.37 72.37 0 0 0 45.64 0a105.89 105.89 0 0 0-26.25 8.09C2.79 32.65-1.71 56.6.54 80.21a105.73 105.73 0 0 0 32.17 16.15 77.7 77.7 0 0 0 6.89-11.11 68.42 68.42 0 0 1-10.85-5.18c.91-.66 1.8-1.34 2.66-2a75.57 75.57 0 0 0 64.32 0c.87.71 1.76 1.39 2.66 2a68.68 68.68 0 0 1-10.87 5.19 77 77 0 0 0 6.89 11.1 105.25 105.25 0 0 0 32.19-16.14c2.64-27.38-4.51-51.11-18.9-72.15ZM42.45 65.69C36.18 65.69 31 60 31 53s5-12.74 11.43-12.74S54 46 53.89 53s-5.05 12.69-11.44 12.69Zm42.24 0C78.41 65.69 73.25 60 73.25 53s5-12.74 11.44-12.74S96.23 46 96.12 53s-5.04 12.69-11.43 12.69Z"/></svg>`;
const GITHUB_ICON = `<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.42 7.42 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>`;
const DOWNLOAD_ICON = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3v10.6l3.3-3.3 1.4 1.4-5.7 5.7-5.7-5.7 1.4-1.4L10 13.6V3h2ZM4 19h16v2H4v-2Z"/></svg>`;

const FEATURES = [
    ["Comptes et bots ensemble", "Connexion par e-mail, par token de compte ou par token de bot. Captcha et double authentification gérés."],
    ["Autant de comptes que voulu", "Chacun dans sa fenêtre et sa session, rangés entre utilisateurs et bots."],
    ["Détection des jeux", "Le jeu en cours apparaît sur ton profil, sans le client officiel."],
    ["Éditeur de messages", "Embeds, boutons, fichiers et catalogue d'émojis, pour les bots."],
    ["Tout en français", "L'interface, les plugins et jusqu'aux messages d'erreur."],
    ["Mises à jour", "Nebula prévient quand une version paraît, la télécharge et l'installe au redémarrage."],
];

// The first heading of the changelog is the newest version: worth showing on the home page
const latestEntry = /^## (v[\d.]+)\s*—\s*(.+)$/m.exec(changelog);

const home = `
<header class="hero">
    <img class="hero-icon" src="icon.png" alt="">
    <h1>Nebula</h1>
    <p class="tagline">
        Tes comptes Discord et tes bots dans une seule application.
        Une fenêtre par compte, le même client pour tous.
    </p>

    <div class="actions">
        <a class="btn btn-main" href="${DOWNLOAD}">${DOWNLOAD_ICON} Télécharger pour Windows</a>
        <a class="btn btn-ghost" href="${INVITE}">${DISCORD_ICON} Serveur Discord</a>
        <a class="btn btn-ghost" href="${REPO}">${GITHUB_ICON} Code source</a>
    </div>

    <div class="release">
        <span class="pill">Version ${pkg.version}</span>
        ${latestEntry ? `<span class="release-name">${escape(latestEntry[2])}</span>` : ""}
        <a class="release-link" href="changelog.html">Voir les nouveautés</a>
    </div>

    <p class="note">Windows 64 bits · installateur · mises à jour automatiques</p>
</header>

<section>
    <h2>Ce que fait Nebula</h2>
    <div class="grid">
        ${FEATURES.map(([title, text]) => `<div class="card"><h3>${title}</h3><p>${text}</p></div>`).join("\n        ")}
    </div>
</section>

<section>
    <h2>Installer</h2>
    <ol class="steps">
        <li>Télécharge <strong>Nebula-win-x64.exe</strong> avec le bouton plus haut.</li>
        <li>Lance-le. Windows affichera un avertissement, l'application n'étant pas signée par un certificat payant : passe par <strong>Informations complémentaires</strong> puis <strong>Exécuter quand même</strong>.</li>
        <li>Choisis le dossier d'installation. C'est tout.</li>
    </ol>
</section>

<section>
    <h2>À lire avant d'utiliser Nebula</h2>

    <div class="warn">
        <strong>Un client tiers est contraire aux conditions d'utilisation de Discord.</strong>
        <p>Se connecter avec un compte utilisateur depuis autre chose que le client officiel peut entraîner la désactivation de ce compte. Les bots, eux, passent par l'API officielle et ne posent pas ce problème.</p>
    </div>

    <div class="warn">
        <strong>Aucune responsabilité n'est assumée.</strong>
        <p>Ni pour un compte banni, ni pour un bot supprimé, ni pour une perte de données, ni pour quoi que ce soit d'autre. Tu l'utilises à tes risques.</p>
    </div>

    <div class="warn">
        <strong>Nebula n'est pas un projet original.</strong>
        <p>C'est une version modifiée de <a href="https://github.com/aiko-chan-ai/DiscordBotClient">aiko-chan-ai/DiscordBotClient</a>, à qui revient tout le travail de fond. Quand Discord change et que le client casse, la correction est attendue du projet d'origine avant d'être reprise ici.</p>
    </div>

    <div class="warn">
        <strong>Ce projet a été écrit avec <a href="https://claude.ai">Claude</a>.</strong>
        <p>L'assistant d'Anthropic.</p>
    </div>
</section>

<section>
    <h2>Un bug, une question&nbsp;?</h2>
    <p class="muted">
        Tout se passe sur <a href="${INVITE}">le serveur Discord</a>. Pour un bug, dis ce que
        tu faisais, ce qui s'est passé, et si tu étais connecté avec un compte ou avec un
        bot&nbsp;: les deux ne suivent pas le même chemin dans l'application, et la réponse
        en dépend.
    </p>
</section>
`;

const pages = [
    { file: "index.html", title: "Nebula", body: home },
    {
        file: "documentation.html",
        title: "Documentation · Nebula",
        body: `<article class="prose">${markdown(readme)}</article>`,
    },
    {
        file: "changelog.html",
        title: "Nouveautés · Nebula",
        body: `<article class="prose changelog">${markdown(changelog)}</article>`,
    },
    {
        file: "licence.html",
        title: "Licence · Nebula",
        body: `<article class="prose">
<h1>Licence</h1>
<p>Nebula est publiée sous la <strong>GNU General Public License v3</strong>, comme le projet dont elle dérive.</p>
<pre class="licence">${escape(licence)}</pre>
</article>`,
        wide: true,
    },
];

for (const entry of pages) {
    fs.writeFileSync(path.join(out, entry.file), page(entry));
}

console.log(`Site généré (${pages.length} pages, version ${pkg.version})`);
