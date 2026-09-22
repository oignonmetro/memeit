import { useRegisterSW } from 'virtual:pwa-register/react';

export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div className="update-prompt" role="status">
      <svg
        className="update-prompt__icon"
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
        <path d="M21 3v6h-6" />
      </svg>
      <p className="update-prompt__text">Une nouvelle version est disponible</p>
      <button className="update-prompt__action" onClick={() => updateServiceWorker(true)}>
        Mettre à jour
      </button>
      <button
        className="update-prompt__dismiss"
        onClick={() => setNeedRefresh(false)}
        aria-label="Ignorer la mise à jour pour l'instant"
      >
        Plus tard
      </button>
    </div>
  );
}
