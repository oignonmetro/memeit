import { useRef, useState } from 'react';
import type { RoomSnapshot, PublicPlayer } from '../types';
import { resizeImageFile } from '../lib/image';

interface LobbyProps {
  room: RoomSnapshot;
  self: PublicPlayer;
  onStart: () => Promise<void>;
  onUpload: (dataUrl: string) => Promise<void>;
}

export default function Lobby({ room, self, onStart, onUpload }: LobbyProps) {
  const [starting, setStarting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const customCount = room.templates.filter((t) => t.source === 'upload').length;

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
