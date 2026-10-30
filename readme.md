# Nebula

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

## Installer

Télécharge l'installateur de la dernière version depuis la page
[Releases](https://github.com/B-loom/discord-bot-client-Nubula/releases), puis lance-le.
Il te laisse choisir le dossier d'installation et crée les raccourcis habituels.

Windows affichera probablement un avertissement au lancement : l'application n'est pas
signée par un certificat payant. Passe par « Informations complémentaires » puis
« Exécuter quand même ».

## Se connecter

### Avec un compte Discord

Ouvre la fenêtre de connexion — depuis le lien sous le bouton de connexion, depuis
« Ajouter un compte », ou depuis l'icône de Nebula dans la barre des tâches. Saisis ton
adresse e-mail et ton mot de passe ; Nebula s'occupe du reste :

- le captcha, dans une fenêtre dédiée ;
- la double authentification, par application, par SMS ou par code de secours.

Tu peux aussi coller directement un token de compte si tu en as déjà un.

Seul le token est conservé, dans le fichier `accounts.json` du dossier de données de
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

Nebula regarde, peu après son démarrage, s'il existe une version plus récente sur la page
des releases de ce dépôt. Si c'est le cas, une notification te le dit et la mise à jour se
télécharge en arrière-plan ; elle s'installe à la fermeture de l'application.

Les nouveautés de chaque version sont dans l'onglet **Nebula → Nouveautés** du client, et
cette page est le texte que tu lis dans **Nebula → Documentation**.

## Un bug, une question ?

Rejoins le serveur Discord : **https://discord.gg/TNTYSmy4mX**

C'est le seul endroit où je réponds. Pour un bug, dis ce que tu faisais, ce qui s'est passé,
et si tu étais connecté avec un compte ou avec un bot — les deux ne suivent pas le même
chemin dans l'application, et la réponse en dépend.

## Licence et crédits

Travail d'origine : **[aiko-chan-ai/DiscordBotClient](https://github.com/aiko-chan-ai/DiscordBotClient)**.
Nebula en est une modification personnelle, écrite avec Claude.
