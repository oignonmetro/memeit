// Point d'entrée de l'éditeur de zones (dev-boxes.html).
//
// Volontairement séparé de main.tsx : l'éditeur est un outil de
// développement, pas un écran de l'application. Le build de production ne
// prend que index.html comme entrée, donc ni ce fichier ni BoxEditor ne
// peuvent finir dans dist/ — c'est une garantie structurelle, pas une
// simple élimination de code mort.
import React from 'react';
import ReactDOM from 'react-dom/client';
import BoxEditor from './BoxEditor';
import '../styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BoxEditor />
  </React.StrictMode>
);
