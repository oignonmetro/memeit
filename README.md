# MemeIt

Jeu de memes multijoueur en soirée : un template de meme commun est affiché à tout le monde,
chaque joueur crée sa légende sur son téléphone, puis la salle vote au pouce levé 👍.
Le score cumulé sur plusieurs manches désigne le vainqueur.

Optionnellement, la partie peut être affichée en grand sur une TV Android (via son navigateur)
pendant que les joueurs jouent depuis leur téléphone.

## Stack

- **100% client** : une PWA React + Vite (mobile-first), pas de serveur applicatif.
- **Firebase Realtime Database** comme seul backend : stocke l'état de chaque salle et le
  synchronise en temps réel entre tous les appareils connectés (joueurs + TV).
- **Firebase Hosting** pour servir la PWA statique.
- Pas d'authentification, pas de base de données autre que RTDB, pas de Cloud Functions.
  Modèle de confiance "entre amis" : quiconque connaît le code d'une salle peut la lire/écrire
  (voir `database.rules.json`) — comme un lien non-listé, pas un système sécurisé contre un
  acteur malveillant.

Chaque joueur/appareil a une identité simple : un UUID généré et stocké dans le `localStorage`
du navigateur (pas de compte, pas de mot de passe). C'est aussi ce qui permet de revenir dans
sa salle après un rechargement de page ou une perte de connexion — l'appareil garde le même
identifiant, RTDB se resynchronise automatiquement.

## Mise en place d'un projet Firebase (à faire une fois)

Tout se fait en ligne de commande, sans jamais ouvrir console.firebase.google.com. La seule
étape qui ouvre un navigateur est la connexion Google elle-même (`firebase login`) — un simple
écran de connexion, pas le tableau de bord Firebase.

```bash
# 0. Installer la CLI si besoin
npm install -g firebase-tools

# 1. Se connecter (ouvre une page de connexion Google le temps de s'authentifier)
firebase login

# 2. Créer le projet — choisis un identifiant unique (lettres minuscules/chiffres/tirets)
firebase projects:create memeit-tonpseudo --display-name "MemeIt"

# 3. Créer l'instance Realtime Database (europe-west1 = Belgique, change si besoin)
firebase database:instances:create memeit-tonpseudo-default-rtdb \
  --project memeit-tonpseudo --location europe-west1

# 4. Créer l'app Web du projet — note l'"App ID" affiché dans la sortie
firebase apps:create WEB "MemeIt Web" --project memeit-tonpseudo

# 5. Afficher la config SDK dans le terminal (remplace <APP_ID> par la valeur de l'étape 4)
firebase apps:sdkconfig WEB <APP_ID> --project memeit-tonpseudo
```

La dernière commande affiche un objet JS avec `apiKey`, `authDomain`, `databaseURL`, etc.
Copie `client/.env.example` vers `client/.env` et reporte chaque valeur dans la variable
`VITE_FIREBASE_*` correspondante (`apiKey` → `VITE_FIREBASE_API_KEY`, etc.).

Puis relie ce projet au repo local (sans passer par le sélecteur interactif) et publie les
règles de sécurité :

```bash
echo "{\"projects\":{\"default\":\"memeit-tonpseudo\"}}" > .firebaserc
firebase deploy --only database
```

## Développement local

```bash
npm install
npm run dev
```

Ouvre http://localhost:5173. Pour tester en multijoueur, ouvre plusieurs onglets/appareils —
tous se connectent directement à la même Realtime Database Firebase (le `localhost` n'est que
pour servir la page, pas besoin d'être sur le même réseau).

Vue TV : http://localhost:5173/#/tv

Tant que `client/.env` n'existe pas ou est incomplet, l'app affiche un écran "Firebase n'est
pas configuré" au lieu du jeu.

## Déploiement sur Firebase Hosting

```bash
npm run deploy   # build le client puis déploie Hosting + les règles Database
```

Ou étape par étape :
```bash
npm run build
firebase deploy --only hosting,database
```

## Déploiement automatique via GitHub Actions

Le repo contient `.github/workflows/deploy.yml` : à chaque push sur `main`, une CI build le
client puis déploie Hosting + les règles Database — plus besoin de lancer `npm run deploy`
à la main. Il faut juste lui donner un moyen de s'authentifier auprès de Firebase, une seule
fois :

```bash
npm install -g firebase-tools
firebase login:ci
```

Ouvre un lien de connexion Google dans un navigateur, puis affiche un jeton dans le terminal.
Copie ce jeton et ajoute-le comme secret du repo GitHub : **Settings > Secrets and variables >
Actions > New repository secret**, nom `FIREBASE_TOKEN`, valeur = le jeton copié.

Une fois ce secret créé, va dans l'onglet **Actions** du repo → workflow "Déploiement
Firebase" → **Run workflow** pour déclencher le premier déploiement (les suivants se
déclenchent automatiquement à chaque push sur `main`).

Firebase donne une URL publique du type `https://<ton-projet>.web.app`. C'est cette URL qui
sert la PWA — la Realtime Database, elle, n'a pas besoin d'être "déployée" à part ses règles
(déjà publiées à l'étape 5 de la mise en place).

## Coût

Le plan gratuit **Spark** de Firebase suffit largement pour un usage "soirée entre amis" :
Realtime Database (1 Go stocké, 10 Go téléchargés/mois, 100 connexions simultanées), Hosting
(10 Go stockés, 360 Go transférés/mois). Pas de carte bancaire requise sur ce plan. Pas de
mise en veille contrairement à un service applicatif classique : Hosting et RTDB sont
disponibles instantanément.

## Déroulé d'une partie

1. **Lobby** — l'hôte crée une salle (code à 4 lettres), les joueurs rejoignent depuis leur
   téléphone avec le code (ou en scannant le QR code affiché sur la TV). Bibliothèque de
   templates intégrée + possibilité d'ajouter ses propres images (stockées dans la salle,
   visibles par tous les joueurs de cette salle).
2. **Manche — Légende** — un template est tiré au sort et affiché à tous. Chaque joueur compose
   sa légende (texte positionnable librement sur l'image) avec un temps limité.
3. **Manche — Vote** — les memes sont révélés un par un à tout le monde (y compris sur la TV
   si connectée). Chaque joueur vote 👍 ou passe (pas de vote) sur les memes des autres.
4. **Score** — le score d'un joueur pour la manche est son nombre de 👍 reçus, cumulé sur toutes
   les manches.
5. Les étapes 2-4 se répètent pour le nombre de manches configuré, puis le classement final
   s'affiche.

Il n'y a pas de serveur de jeu central : ce sont les appareils connectés à une salle qui
coopèrent pour faire avancer la partie (déclenchement des transitions de phase via des
transactions Realtime Database, qui garantissent qu'une seule tentative concurrente l'emporte).
Tant qu'au moins un appareil (joueur ou TV) a la salle ouverte, la partie avance normalement.

## Confidentialité et sécurité — ce qui n'est pas garanti

Comme les règles Realtime Database sont ouvertes (`.read`/`.write: true` sur toute salle dont
on connaît le code), il faut avoir en tête :
- N'importe qui inspectant le trafic réseau (onglet développeur du navigateur) pendant la phase
  de création pourrait voir les memes des autres joueurs avant leur révélation.
- Rien n'empêche un client de tricher (voter plusieurs fois, modifier son propre score).
- La seule protection d'une salle est que son code à 4 caractères n'est pas indexé/partagé
  publiquement — comme un lien non-listé.

Ce compromis est assumé : c'est un jeu pensé pour un groupe de confiance, pas pour résister à
un acteur malveillant.

## Nettoyage des salles inactives

Pas de tâche planifiée côté serveur (il n'y a pas de serveur) : chaque appareil affichant une
salle vérifie toutes les 60 secondes si elle est inactive depuis plus de 30 minutes, et la
supprime le cas échéant via une transaction Realtime Database.

## Structure du projet

```
client/                  PWA React — pages Home / Room (joueur) / Tv (grand écran)
client/src/lib/firebase.ts   Initialisation Firebase (conditionnelle)
client/src/lib/roomApi.ts    Toute la logique de salle : create/join, transactions de phase, votes
client/src/lib/playerId.ts   Identité joueur (UUID en localStorage)
client/.env.example       Variables d'environnement Firebase à copier vers client/.env
firebase.json              Config Firebase Hosting + emplacement des règles Database
database.rules.json        Règles de sécurité Realtime Database
```
