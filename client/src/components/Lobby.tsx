import { useRef, useState } from 'react';
import type { RoomSnapshot, PublicPlayer, GameMode } from '../types';
import { CAPTION_TIME_OPTIONS, GAME_MODES, TEMPLATE_CHANGE_OPTIONS } from '../types';
import { resizeImageFile } from '../lib/image';
import { isChatVisible, setChatVisible } from '../lib/chatVisibility';

interface LobbyProps {
  room: RoomSnapshot;
  self: PublicPlayer;
  onStart: () => Promise<void>;
  onUpload: (dataUrl: string) => Promise<void>;
  onSetCaptionTime: (seconds: number) => Promise<void>;
  onSetRounds: (rounds: number) => Promise<void>;
  onSetMode: (mode: GameMode) => Promise<void>;
  onSetMaxTemplateChanges: (value: number) => Promise<void>;
}

function formatTime(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? `${m}min${s}` : `${m}min`;
}

export default function Lobby({ room, self, onStart, onUpload, onSetCaptionTime, onSetRounds, onSetMode, onSetMaxTemplateChanges }: LobbyProps) {
  const [starting, setStarting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [chatShown, setChatShown] = useState(isChatVisible);
  const fileRef = useRef<HTMLInputElement>(null);
  const customCount = room.templates.filter((t) => t.source === 'upload').length;
  const currentMode = GAME_MODES.find((m) => m.id === room.settings.mode) ?? GAME_MODES[0];

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const dataUrl = await resizeImageFile(file);
      await onUpload(dataUrl);
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <div className="card" style={{ textAlign: 'center' }}>
        <div className="subtitle" style={{ margin: 0 }}>Code de la salle</div>
        <div className="room-code">{room.code}</div>
        <div className="center-note">Rejoignez depuis un téléphone avec ce code, ou affichez la partie sur une TV via /tv</div>
      </div>

      <div className="card">
        <div className="subtitle" style={{ margin: '0 0 10px' }}>
          Joueurs ({room.players.length})
        </div>
        <div className="player-list">
          {room.players.map((p) => (
            <div key={p.id} className={`player-row ${p.connected ? '' : 'offline'}`}>
              <span>
                {p.nickname} {p.isHost && <span className="badge">Hôte</span>} {p.id === self.id && '(toi)'}
              </span>
              {!p.connected && <span style={{ fontSize: '0.8rem' }}>déconnecté</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="subtitle" style={{ margin: '0 0 10px' }}>Mode de jeu</div>
        {self.isHost ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {GAME_MODES.map((m) => (
              <button
                key={m.id}
                className={`mode-option ${room.settings.mode === m.id ? 'selected' : ''}`}
                onClick={() => onSetMode(m.id)}
              >
                <span className="mode-option__label">{m.label}</span>
                <span className="mode-option__desc">{m.description}</span>
              </button>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontWeight: 800 }}>{currentMode.label}</div>
            <div className="center-note" style={{ textAlign: 'left', margin: 0 }}>{currentMode.description}</div>
          </div>
        )}
      </div>

      <div className="card">
        <div className="subtitle" style={{ margin: '0 0 10px' }}>
          Nombre de manches : {room.settings.rounds}
        </div>
        {self.isHost ? (
          <input
            type="range"
            min={1}
            max={8}
            value={room.settings.rounds}
            onChange={(e) => onSetRounds(Number(e.target.value))}
            style={{ width: '100%' }}
          />
        ) : (
          <div className="center-note" style={{ textAlign: 'left' }}>Réglé par l'hôte.</div>
        )}
      </div>

      <div className="card">
        <div className="subtitle" style={{ margin: '0 0 10px' }}>
          Temps pour créer son meme : {formatTime(room.settings.captionTimeSec)}
        </div>
        {self.isHost ? (
          <div className="setting-options">
            {CAPTION_TIME_OPTIONS.map((sec) => (
              <button
                key={sec}
                className={`setting-chip ${room.settings.captionTimeSec === sec ? 'selected' : ''}`}
                onClick={() => onSetCaptionTime(sec)}
              >
                {formatTime(sec)}
              </button>
            ))}
          </div>
        ) : (
          <div className="center-note" style={{ textAlign: 'left' }}>Réglé par l'hôte.</div>
        )}
      </div>

      <div className="card">
        <div className="subtitle" style={{ margin: '0 0 10px' }}>
          Changements de template par manche : {room.settings.maxTemplateChanges}
        </div>
        {self.isHost ? (
          <div className="setting-options">
            {TEMPLATE_CHANGE_OPTIONS.map((n) => (
              <button
                key={n}
                className={`setting-chip ${room.settings.maxTemplateChanges === n ? 'selected' : ''}`}
                onClick={() => onSetMaxTemplateChanges(n)}
              >
                {n}
              </button>
            ))}
          </div>
        ) : (
          <div className="center-note" style={{ textAlign: 'left' }}>Réglé par l'hôte.</div>
        )}
      </div>

      <div className="card">
        <label className="chat-toggle">
          <input
            type="checkbox"
            checked={chatShown}
            onChange={() => {
              const next = !chatShown;
              setChatShown(next);
              setChatVisible(next);
            }}
          />
          Afficher le bouton de chat
        </label>
      </div>

      <div className="card">
        <div className="subtitle" style={{ margin: '0 0 10px' }}>
          Templates ({room.templates.length}, dont {customCount} perso)
        </div>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={handleFile} />
        <button className="btn btn-secondary" onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? 'Ajout en cours...' : '+ Ajouter mon template'}
        </button>
      </div>

      {self.isHost ? (
        <button
          className="btn btn-primary"
          disabled={room.players.filter((p) => p.connected).length < 2 || starting}
          onClick={async () => {
            setStarting(true);
            try {
              await onStart();
            } finally {
              setStarting(false);
            }
          }}
        >
          {starting ? 'Démarrage...' : 'Démarrer la partie'}
        </button>
      ) : (
        <div className="center-note">En attente que l'hôte démarre la partie...</div>
      )}
    </>
  );
}
