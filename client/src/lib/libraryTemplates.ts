import type { Template } from '../types';

// Built-in, original placeholder templates bundled with the app (client/public/templates/library).
// Rooms can add their own on top of this base library (stored in Realtime Database).
export const LIBRARY_TEMPLATES: Template[] = [
  { id: 'lib-1', url: '/templates/library/podium.svg', name: 'Le podium', source: 'library' },
  { id: 'lib-2', url: '/templates/library/two-buttons.svg', name: 'Les deux boutons', source: 'library' },
  { id: 'lib-3', url: '/templates/library/expanding-brain.svg', name: 'Le cerveau qui grandit', source: 'library' },
  { id: 'lib-4', url: '/templates/library/drakeish.svg', name: 'Approuve / désapprouve', source: 'library' },
  { id: 'lib-5', url: '/templates/library/change-my-mind.svg', name: 'Change mon avis', source: 'library' },
  { id: 'lib-6', url: '/templates/library/distracted.svg', name: 'Le regard qui dévie', source: 'library' },
];
