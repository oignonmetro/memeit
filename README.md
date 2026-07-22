# MemeIt

Jeu de memes multijoueur en soirée : un template de meme commun est affiché à tout le monde,
chaque joueur crée sa légende sur son téléphone, puis la salle vote au pouce levé 👍.
Le score cumulé sur plusieurs manches désigne le vainqueur.

Optionnellement, la partie peut être affichée en grand sur une TV Android (via son navigateur)
pendant que les joueurs jouent depuis leur téléphone.

## Stack

- **Backend** : Node.js + Express + Socket.io (TypeScript). État des salles entièrement en mémoire
  (pas de base de données) — chaque salle vit le temps de la partie.
- **Frontend** : React + Vite, PWA installable (mobile-first), servie par le même serveur Express
  en production (un seul service à déployer).

## Développement local

```bash
npm install

# terminal 1 — API + WebSocket
npm run dev:server

# terminal 2 — client Vite (proxy vers le serveur sur :3001)
npm run dev:client
```

Ouvrir http://localhost:5173. Pour tester en multijoueur, ouvrir plusieurs onglets/appareils
sur le même réseau (remplacer `localhost` par l'IP locale de la machine).

Vue TV : http://localhost:5173/#/tv

## Build & déploiement production

```bash
npm run build   # build le client (client/dist) puis compile le serveur (server/dist)
npm start        # sert client/dist + API + WebSocket sur le port $PORT (3001 par défaut)
```

Un seul service Node à déployer (Render, Railway, Fly.io, un VPS avec PM2, etc.) : il sert à la
fois l'app web et le WebSocket. Variables d'environnement :

- `PORT` — port d'écoute (par défaut 3001)
- `CLIENT_ORIGIN` — origine autorisée pour CORS Socket.io si le client est servi ailleurs
  (par défaut `*`, inutile si tout est servi par ce même service)

## Déroulé d'une partie

1. **Lobby** — l'hôte crée une salle (code à 4 lettres), les joueurs rejoignent depuis leur
   téléphone avec le code (ou en scannant le QR code affiché sur la TV). Bibliothèque de
   templates intégrée + possibilité d'ajouter ses propres images.
2. **Manche — Légende** — un template est tiré au sort et affiché à tous. Chaque joueur compose
   sa légende en privé (texte positionnable librement sur l'image) avec un temps limité.
3. **Manche — Vote** — les memes sont révélés un par un à tout le monde (y compris sur la TV
   si connectée). Chaque joueur vote 👍 ou passe (pas de vote) sur les memes des autres.
4. **Score** — le score d'un joueur pour la manche est son nombre de 👍 reçus, cumulé sur toutes
   les manches.
5. Les étapes 2-4 se répètent pour le nombre de manches configuré, puis le classement final
   s'affiche.

## Reconnexion

Chaque joueur reçoit un jeton de session stocké en local sur son appareil : en cas de
déconnexion (écran verrouillé, perte de réseau), il peut revenir dans la même salle avec le
même score en rouvrant simplement le lien de la salle.

## Structure du projet

```
server/   API + logique de jeu (Room, RoomManager) + WebSocket (Socket.io)
client/   PWA React — pages Home / Room (joueur) / Tv (grand écran)
```
