# Nebula — notes pour Claude

Ce fichier voyage avec le dépôt : il est lu automatiquement par Claude Code sur n'importe
quel ordinateur après un `git clone`. Il contient ce qui ne se devine pas en lisant le
code.

## Ce qu'est Nebula

Un client Discord de bureau (Electron) qui réunit comptes et bots dans une seule
application, dérivé de [aiko-chan-ai/DiscordBotClient](https://github.com/aiko-chan-ai/DiscordBotClient).

- Site : https://b-loom.github.io/discord-bot-client-Nebula/
- Serveur d'entraide : https://discord.gg/TNTYSmy4mX

## Le piège principal : ne jamais écrire dans `Vencord/`

`Vencord/` est un clone jetable. `npm run requirement` le remet à zéro par un
`git reset --hard`, et il est exclu de git.

Tout le code écrit pour Vencord — le plugin Nebula, NebulaApparence, les traductions
françaises, les retouches aux pages de réglages — vit dans **`nebula/vencord/`**, qui est
versionné. `scripts/applyNebulaOverlay.mjs` le recopie sur le clone avant chaque
compilation.

Modifier `Vencord/` directement, c'est perdre la modification au prochain
`npm run requirement` et ne jamais la voir partir sur GitHub.

## Rien n'est écrit deux fois

Trois textes ont une source unique, et des scripts les recopient :

| Texte | Source | Recopié par |
| --- | --- | --- |
| Documentation dans l'app | `README.md` | `scripts/syncReadme.mjs` |
| Pages du site | README, changelog, LICENSE, `package.json` | `scripts/buildSite.mjs` |
| Code Vencord | `nebula/vencord/` | `scripts/applyNebulaOverlay.mjs` |

L'ordre compte : `syncReadme` écrit dans `nebula/`, **puis** l'overlay recopie sur le
clone. L'inverse annulerait la synchronisation en silence — c'est arrivé une fois.

Ne jamais modifier à la main `docs/*.html` ni le `README` dans `docs.ts` : la modification
serait écrasée au build suivant.

## Numérotation des versions

Le dernier chiffre avance d'un cran, **et le compte s'arrête à `.9`** : après `1.0.9`
vient `1.1.1`, puis `1.1.2`. Le `.0` est sauté. C'est un choix de Bloom, qui a fait
renuméroter tout l'historique pour cela.

## Publier une version

1. Numéro dans `package.json`.
2. Entrée de changelog en tête de `CHANGELOG` dans
   `nebula/vencord/src/userplugins/botClient/components/docs.ts`.
3. `npm run build` — compile l'app, l'installateur et le site. Fermer Nebula avant, sinon
   le build échoue sur un fichier verrouillé.
4. Commit, push.
5. Release GitHub avec `Nebula-win-x64.exe`, son `.blockmap` et `latest.yml` : les trois
   sont nécessaires, `latest.yml` étant ce que les installations lisent pour se mettre à
   jour.

`npm run build:fast` ne produit que `dist/win-unpacked`, pour tester vite sans installateur.

## Diagnostiquer

Le journal `%APPDATA%\Nebula\logs\main.log` reçoit les messages du processus principal
**et** la console du client. C'est l'outil le plus utile du projet.

Quand une correction ne marche pas, instrumenter plutôt que formuler une hypothèse de
plus. Un exemple vécu : trois tentatives pour comprendre pourquoi un compte ne pouvait pas
rejoindre un serveur, jusqu'à ce qu'une trace montre que le refus venait de Nebula
elle-même — un `acceptInvite` hérité du projet d'origine, écrit pour les bots et appliqué
à tout le monde.

**Bot et compte utilisateur ne suivent pas le même chemin.** Beaucoup de code hérité
bloque des fonctions parce qu'un bot ne peut pas les utiliser ; il faut vérifier que
`isUserAccountSession()` laisse passer les comptes. C'est la source de bugs la plus
fréquente ici.

## Attentes de Bloom

- Tout en français, y compris les messages d'erreur.
- Il communique par captures d'écran numérotées et n'est pas développeur : ses captures
  décrivent ce qu'il voit, et c'est souvent l'indice décisif.
- Ne jamais annoncer qu'une correction marche sans l'avoir vérifiée.
