/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Documentation shipped inside the bundle, so the pages work from the packaged
 * app without any file next to the executable.
 */

export const README = `# Nebula

Nebula est un client Discord de bureau qui réunit **tes comptes Discord** et **tes bots**
dans une seule application : une fenêtre par compte, le même client pour tous.

---

## ⚠️ À lire avant d'utiliser Nebula

> **Ce projet a été écrit avec [Claude](https://claude.ai), l'assistant d'Anthropic.**

> **Je ne suis responsable de rien.** Ni d'un compte désactivé ou banni, ni d'un bot
> supprimé, ni d'une perte de données, ni d'un plantage de ton ordinateur, ni de quoi que
> ce soit d'autre qui arriverait en utilisant Nebula. Tu l'utilises à tes risques.

> **Un client tiers est contraire aux conditions d'utilisation de Discord.** Se connecter
> avec un compte utilisateur depuis autre chose que le client officiel peut entraîner la
> désactivation de ce compte. Les bots, eux, utilisent l'API officielle et ne posent pas
> ce problème.

> **Nebula n'est pas un projet original.** C'est une version modifiée de
> **[aiko-chan-ai/DiscordBotClient](https://github.com/aiko-chan-ai/DiscordBotClient)**,
> à qui revient tout le travail de fond. Merci à l'auteur.

> **Les mises à jour de Discord ne viennent pas de moi.** Quand Discord change et que le
> client casse, j'attends que **aiko-chan-ai** publie une mise à jour du projet d'origine,
> puis je la reprends ici. Il peut donc s'écouler du temps entre le moment où quelque
> chose casse et le moment où c'est réparé.

---

## Se connecter

### Avec un compte Discord

Ouvre la fenêtre de connexion — depuis le lien sous le bouton de connexion, depuis
« Ajouter un compte », ou depuis l'icône de Nebula dans la barre des tâches. Saisis ton
adresse e-mail et ton mot de passe ; Nebula s'occupe du reste :

- le captcha, dans une fenêtre dédiée ;
- la double authentification, par application, par SMS ou par code de secours.

Tu peux aussi coller directement un token de compte si tu en as déjà un.

Seul le token est conservé, dans le fichier \`accounts.json\` du dossier de données de
Nebula, sur cet ordinateur. **Ton mot de passe n'est jamais enregistré** et ne quitte pas
la fenêtre de connexion.

### Avec un bot

Colle le token du bot sur l'écran de connexion. Pense à activer l'intent
**MessageContent** dans les paramètres de ton application sur le portail développeur,
sinon le client affichera des messages vides.

## Plusieurs comptes à la fois

Chaque compte enregistré s'ouvre dans sa propre fenêtre, avec sa propre session : un
compte utilisateur et dix bots peuvent tourner côte à côte sans se gêner. Le bouton
« Ouvrir dans une nouvelle fenêtre » de la fenêtre de connexion s'en charge.

Dans le sélecteur de comptes, les comptes utilisateurs et les bots sont rangés sous deux
intitulés séparés.

## Ce qu'un bot ne peut pas faire

Un bot n'a ni Nitro, ni abonnement, ni moyen de paiement ; il n'a pas d'amis et pas de
messages privés au sens habituel, et il ne peut pas rejoindre un serveur depuis un client
— seul le propriétaire du serveur peut l'ajouter, via son lien d'invitation OAuth.

Les pages concernées ne sont pas cachées : elles expliquent pourquoi elles ne servent à
rien ici. Avec un compte utilisateur, le client Discord habituel revient.

## Ce que Nebula ajoute

- **Détection des jeux** : le jeu en cours apparaît sur le profil, sans le client officiel.
- **Éditeur de messages** : embeds, boutons, fichiers et catalogue d'émojis, pour les bots.
- **Apparence** : un plugin pour changer le nom affiché et choisir ses badges. Purement
  visuel, rien n'est envoyé à Discord.
- **Interface en français**, y compris les messages d'erreur.

## Mises à jour

Nebula ne se met pas à jour toute seule et n'affiche aucune notification de mise à jour.
Les nouveautés de chaque version sont dans l'onglet **Nebula → Nouveautés** du client, et
cette page est le texte que tu lis dans **Nebula → Documentation**.

## Licence et crédits

Travail d'origine : **[aiko-chan-ai/DiscordBotClient](https://github.com/aiko-chan-ai/DiscordBotClient)**.
Nebula en est une modification personnelle, écrite avec Claude.
`;

export const CHANGELOG = `# Nouveautés

## v1.2.4 — Première version publiée

### Nouveautés
- Nebula prévient quand une nouvelle version est publiée. La recherche vise désormais le
  dépôt du projet, et non plus celui d’origine dont les versions auraient remplacé
  Nebula par une autre application.

### Changements
- Le projet s’installe par un véritable installateur Windows, et le code est publié sur
  GitHub.

## v1.2.3 — Boutons dans le message d’accueil

### Changements
- Le lien du serveur en texte brut laisse place à deux boutons : rejoindre le serveur
  Discord, et ouvrir le projet sur GitHub, chacun avec son logo.

## v1.2.2 — Ménage et fenêtre de connexion

### Corrections
- La fenêtre de connexion ne coupait plus le haut de la liste quand les comptes étaient
  nombreux, et le formulaire se retrouvait hors d’écran. La liste défile désormais seule.

### Changements
- Le build de Discohook, sa copie dans les ressources et les sources Android ont été
  retirés du projet : environ 200 Mo qui ne servaient plus à rien.
- Le code écrit pour Vencord vit maintenant dans nebula/, versionné, et se recopie sur le
  clone à chaque compilation. Une mise à jour de Vencord ne l’efface plus.

## v1.2.1 — Les quêtes aussi

### Changements
- Les quêtes sont bloquées sur les deux clients : leur progression est vérifiée par le
  client officiel de Discord, donc elles n’avanceraient jamais ici, compte ou bot.

## v1.1.9 — Blocage au cas par cas

### Changements
- Seul Nitro est bloqué sur les deux clients, puisque ni un bot ni Nebula ne peuvent
  gérer un abonnement. La Boutique, les Quêtes et la Découverte ne le sont que pour un
  bot : un compte Discord y a toute sa place.
- Le panneau retrouve mieux le bord de la barre latérale, qui change d’une page à l’autre.

## v1.1.8 — Le message remplace la page

### Changements
- Nitro, la Boutique, les Quêtes et la Découverte affichent le message à la place de la
  page, en grand, au lieu de renvoyer à l’accueil. La barre latérale reste utilisable.

## v1.1.7 — Français et pages bloquées

### Nouveautés
- Les plugins de Vencord sont décrits en français, et la page qui les liste aussi.
- NebulaApparence permet de changer le nom affiché et le pseudo séparément.

### Corrections
- La boutique, Nitro et les quêtes sont enfin bloquées, ainsi que la découverte pour un
  bot. Le filtre posé sur le routeur de Discord ne voyait pas les liens de la barre
  latérale ; il surveille maintenant l'adresse elle-même.
- La fiche d'auteur des plugins Nebula montrait le profil d'un contributeur de Vencord,
  dont l'identifiant avait été repris par erreur. Elle affiche désormais Nebula.

## v1.1.6 — Documentation, apparence et pages bloquées

### Nouveautés
- Un plugin « NebulaApparence » permet de changer le nom affiché et de choisir ses badges.
  Tout est local : rien n'est envoyé à Discord et personne d'autre ne le voit.
- Les plugins écrits pour Nebula portent son logo dans la liste des plugins.
- La boutique, Nitro et les quêtes expliquent pourquoi elles ne fonctionnent pas ici au lieu
  de s'ouvrir vides, et la découverte de serveurs fait de même pour un bot.

### Changements
- Les numéros de version avancent d'un cran à la fois. Les anciennes versions ont été
  renumérotées : le compte s'arrête à 1.0.9, puis reprend à 1.1.1, 1.1.2, et ainsi de suite.
- Le message d'accueil renvoie vers le serveur Discord plutôt que vers un compte.
- La page Documentation est désormais le README du projet, recopié à chaque compilation,
  et sait afficher les encadrés, les séparateurs et les liens.

## v1.1.5 — Comptes groupés partout

### Corrections
- Le volet rapide de bascule sépare lui aussi les comptes utilisateurs des bots, comme la
  fenêtre « Gérer les comptes ». Les deux listes lisent le même magasin, qui rend
  désormais les comptes groupés.

## v1.1.4 — Jeux et comptes

### Nouveautés
- Les jeux en cours apparaissent enfin sur le profil. La liste des processus détectés ne
  suffisait pas : Nebula publie maintenant une véritable activité, le même chemin que les
  clients de présence enrichie.
- Le sélecteur de comptes sépare les comptes utilisateurs des bots sous deux intitulés,
  au lieu de tout empiler dans une seule liste.

### Corrections
- L'écran « Application Discord détectée » ne remplace plus le client. Il s'affichait
  parce que le client se croyait sur le web ; Nebula est l'application de bureau.

## v1.1.3 — Identité et sobriété

### Corrections
- La limite de comptes est réellement levée. Le premier correctif ne touchait que la
  troncature qui suit l'ajout ; le refus venait du bouton lui-même, qui affichait l'erreur
  au lieu d'ouvrir la connexion. Les deux sont corrigés.
- Plus aucune trace du nom d'origine : dépôt, identifiant de session, page de
  téléchargement, éditeur de configuration et en-têtes portent désormais Nebula.

### Allègements
- Cinq services de Chromium dont Nebula ne se sert pas sont désactivés : découverte Cast
  sur le réseau, téléchargement de règles d'optimisation, traduction, communication de
  remplissage automatique et suggestions de contenu.
- Le cache disque est plafonné à 64 Mo, là où Chromium le laissait grossir sans limite.
- L'écriture du stockage sur le disque passe d'une fois par minute à une fois toutes les
  cinq minutes, les moments qui comptent restant couverts.

## v1.1.2 — Plus de cinq comptes

### Nouveautés
- Le sélecteur accepte **cent comptes** au lieu de cinq. Discord ne refusait pas le
  sixième : son code coupait la liste au cinquième et déconnectait les suivants. Ni
  constante nommée ni fonction de contrôle, le chiffre était écrit dans l'opération de
  découpe, trouvé en lisant les modules chargés par le client.

## v1.1.1 — Comptes en double

### Corrections
- Un compte connecté plusieurs fois n'apparaît plus en double dans la liste ni dans le
  menu. Chaque connexion produit un token différent, et les entrées étaient comparées par
  token au lieu de l'identifiant du compte.
- Le champ de token de bot a quitté la fenêtre de connexion : il faisait doublon avec
  celui de l'écran d'accueil.
- L'état « compte utilisateur » est remis à zéro quand Discord refuse le token ou à la
  déconnexion, au lieu de rester actif alors que plus personne n'est connecté.

## v1.0.9 — Jeton, sobriété, mises à jour

### Nouveautés
- Connexion à un compte **avec un token**, sans mot de passe ni code à deux facteurs.
  Le token est vérifié auprès de Discord avant d'être enregistré, pour que rien ne casse
  plus tard sans explication.

### Allègements
- Plus aucune journalisation des requêtes : chaque image et chaque script chargés par
  Discord écrivaient une ligne sur le disque, ce qui coûtait du processeur en permanence.
- La détection des jeux examine les processus une fois par minute au lieu de quatre, et
  s'arrête complètement quand aucune fenêtre n'est affichée.

### Corrections
- Plus de notification de mise à jour venant du projet d'origine. Nebula interrogeait son
  dépôt, et accepter une de ses versions aurait remplacé Nebula par une autre application.

## v1.0.8 — Émojis, fichiers et fenêtres

### Nouveautés
- L'éditeur a un **catalogue d'émojis** : un bouton ouvre la liste, rangée par serveur,
  avec une recherche. Plus besoin de copier un identifiant à la main, ni pour le texte
  ni pour les boutons.
- L'éditeur accepte les **pièces jointes** : par le bouton ou par glisser-déposer, dix
  fichiers de 10 Mo au maximum. Un message peut désormais ne contenir qu'un fichier.

### Corrections
- Les boutons de la barre de titre agissent sur leur propre fenêtre. Réduire ou agrandir
  depuis une deuxième fenêtre pilotait la première, parce que la fenêtre visée était
  déduite d'un nom et non de celle d'où venait le clic.
- La fenêtre d'indisponibilité reprend la présentation de la page des paramètres.

## v1.0.7 — Les bots se reconnectent

### Corrections
- Un bot ne pouvait plus se connecter après son premier lancement. En le mémorisant pour
  l'afficher dans la liste des comptes, son jeton se retrouvait au redémarrage parmi ceux
  des comptes utilisateurs — or ces jetons-là sont envoyés à Discord tels quels, sans le
  préfixe réservé aux bots. Les bots sont désormais exclus de cette liste.
- Les greffes posées sur Discord sont isolées les unes des autres : si l'une échoue, elle
  est signalée et les suivantes s'installent quand même, au lieu d'abandonner tout ce qui
  vient après.

## v1.0.6 — L'éditeur envoie vraiment

### Corrections
- L'éditeur de message envoie enfin. La liaison avec le client était bien établie, mais la
  page rejetait le canal parce qu'elle vérifiait l'origine du message : le canal est remis
  depuis le monde isolé du préchargement, où cette origine n'est pas la page elle-même.
- Les nouvelles fenêtres n'ont plus de barre de titre du système : elles reprennent
  l'habillage de la fenêtre principale, où Discord dessine la sienne.
- Le créateur garde ses vrais badges. Les badges décoratifs ajoutés à tous les profils ne
  s'appliquent plus au sien, qui n'affiche donc que ce qu'il a réellement obtenu, plus
  celui de Nebula.
- Les bots sont mémorisés dès qu'ils se connectent, et apparaissent dans leur catégorie
  du menu de la barre des tâches sans avoir à passer par la fenêtre de connexion.
- Créer ou rejoindre un serveur est intercepté plus tôt, à l'ouverture de la fenêtre et
  plus seulement à la validation.

## v1.0.5 — Éditeur de message Nebula

### Nouveautés
- **Nouvel éditeur de message**, écrit pour Nebula, à la place de celui emprunté ailleurs.
  Il gère le contenu, jusqu'à dix embeds complets (titre, description, couleur, auteur,
  miniature, grande image, pied de page, date, champs alignés) et des boutons qui ouvrent
  un lien, avec émojis personnalisés. L'aperçu se met à jour pendant la frappe et la
  mention « bêta » a disparu.
- Le bouton de l'éditeur n'apparaît plus que sur un bot, puisqu'il envoie avec les
  identifiants du bot.
- Créer ou rejoindre un serveur depuis un bot affiche une explication : un bot rejoint un
  serveur par son lien d'invitation OAuth, ajouté par le propriétaire du serveur.
- Les comptes enregistrés sont rangés en deux catégories, **comptes utilisateurs** et
  **bots**, dans la fenêtre de connexion comme dans le menu de la barre des tâches. Un bot
  ouvert dans sa propre fenêtre est mémorisé pour la prochaine fois.

## v1.0.4 — Chaque fenêtre à sa place

### Corrections
- Se connecter à un compte depuis une deuxième fenêtre ne détourne plus la première.
  La fenêtre de connexion retient celle qui l'a ouverte et y renvoie le compte.
- La page indisponible dit la vérité selon le cas : sur un compte, que Nebula ne prend
  pas en charge cette page et qu'il faut passer par le client officiel ; sur un bot,
  qu'un bot n'a ni Nitro ni abonnement.
- Le badge Creator Nebula s'affiche aussi sur un compte utilisateur. Son profil partait
  directement chez Discord, sans passer par l'étape qui ajoute le badge.

## v1.0.3 — Plusieurs fenêtres et identité

### Nouveautés
- Le menu de la barre des tâches ouvre directement une **nouvelle fenêtre Discord**, et
  propose chaque compte enregistré dans sa propre fenêtre. Plusieurs Discord côte à côte,
  chacun avec sa session : un bot ici, ton compte là.
- Badge **Creator Nebula** pour l'auteur du projet, avec le logo de l'application.
- Le salon d'accueil indique qui contacter en cas de problème.

### Corrections
- Nitro, la boutique et les connexions de comptes sont marqués indisponibles pour tout le
  monde, pas seulement pour les bots : ils ont besoin des rouages de paiement et
  d'authentification de Discord, que ce client ne transporte pas. Ça se fait sur le client
  officiel.
- Les jeux détectés sont tracés dans le journal au moment où le client les reçoit, pour
  distinguer un problème de détection d'un problème d'affichage.

## v1.0.2 — Détection des jeux et connexions

### Nouveautés
- Les jeux en cours sont détectés et affichés dans ton activité. Ce client n'a pas le
  module natif de Discord, alors Nebula lit la liste des processus du système et la
  compare au catalogue public des jeux reconnus, toutes les quinze secondes.
- Un bot peut s'ouvrir dans sa propre fenêtre depuis la fenêtre de connexion : un compte
  dans une fenêtre, un bot dans une autre, en même temps.

### Corrections
- Les connexions de comptes externes fonctionnent de nouveau. Le retour d'authentification
  arrive sur une page sans jeton, et la liste des routes interdites aux bots s'appliquait
  à cette page comme s'il s'agissait d'un appel d'API, ce qui la refusait systématiquement.
  Cette liste ne vaut plus que pour les appels d'API.
- Les messages privés enregistrés résistent mieux à un redémarrage brutal : le stockage
  est écrit sur le disque régulièrement, à la mise en veille et à l'extinction, au lieu
  d'attendre le bon vouloir du navigateur.
- Les paramètres s'ouvrent plus vite. Les pages ajoutées par Nebula étaient reconstruites
  à chaque ouverture, ce qui forçait un remontage complet du panneau.
- Une catégorie ne montre plus qu'une seule entrée « Indisponible » au lieu d'en empiler
  une par page masquée.

## v1.0.1 — Corrections et finitions

### Corrections
- Les paramètres ne font plus planter le client. La personnalisation du menu s'appliquait
  à chaque panneau imbriqué au lieu de la seule disposition racine, ce qui insérait des
  sections là où Discord n'en attend pas.
- Le profil du salon système s'affiche enfin avec ses badges, sa biographie et sa bannière.
  Une route interne répondait 404 avant que le profil ne soit construit, parce que les
  fichiers de routes sont enregistrés par ordre alphabétique et qu'un attrape-tout passait
  devant.
- Le salon système reste en tête des messages privés. Discord trie par identifiant du
  dernier message, et le sien était trop bas pour remonter.
- Le client démarre en français même avec un bot, qui n'a pas de langue propre.

### Interface
- Le salon système porte tous les badges Discord et sa bannière est animée.
- Sa date de création est celle de Discord, le 13 mai 2015.
- Le logo de l'application est désormais rond.
- Le menu de la barre des tâches a été allégé.
- La fiche du plugin affiche Nebula comme éditeur.
- La section Nebula est une catégorie à part entière, plus une entrée rangée sous Vencord.
- Les pages indisponibles pour un bot couvrent aussi les applications connectées et les
  autorisations de messages.

### Sous le capot
- Les erreurs du client sont écrites dans le journal de l'application, ce qui permet de
  diagnostiquer un plantage sans ouvrir les outils de développement.
- Les pages ajoutées par Nebula sont protégées : une erreur dans l'une d'elles s'affiche
  à sa place au lieu d'emporter le client.

## v1.0.0 — Nebula

### Connexion avec un compte Discord
- Nouvelle fenêtre de connexion avec adresse e-mail et mot de passe.
- Gestion du captcha dans une fenêtre dédiée, servie depuis l'origine Discord.
- Authentification à deux facteurs : application, SMS et codes de secours.
- Les comptes sont enregistrés et réutilisables en un clic.
- Chaque compte peut s'ouvrir dans sa propre fenêtre, avec sa propre session.

### Compatibilité des comptes utilisateurs
- Les messages privés, la liste des membres, les amis et le vrai profil ne sont plus
  remplacés par les données factices prévues pour les bots.
- L'adresse e-mail et le numéro de téléphone affichés sont les vrais.
- La déconnexion automatique qui visait les comptes non-bot a été supprimée.

### Interface
- L'application s'appelle désormais Nebula, avec une nouvelle icône.
- Toute l'interface de l'application est en français.
- Nouvelle section Nebula dans les paramètres, avec les informations de l'application,
  la documentation et cette page.
- Les pages réservées aux comptes utilisateurs affichent une explication quand un bot
  est connecté.
`;
