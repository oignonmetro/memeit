import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 'prompt' plutôt que 'autoUpdate' : un rechargement silencieux
      // couperait une partie en cours (caption à moitié écrite, vote en
      // cours...). Le nouveau service worker reste en attente jusqu'à ce
      // que le joueur choisisse de recharger, via le bandeau UpdatePrompt.
      registerType: 'prompt',
      includeAssets: ['icons/favicon.png'],
      manifest: {
        name: 'MemeIt',
        short_name: 'MemeIt',
        description: 'Jeu de memes multijoueur en soirée',
        theme_color: '#181022',
        background_color: '#181022',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
  },
});
