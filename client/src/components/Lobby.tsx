import { useEffect, useState } from 'react';
import type { RoomSnapshot, PublicPlayer, GameMode } from '../types';
import { CAPTION_TIME_OPTIONS, GAME_MODES, ROUNDS_OPTIONS, TEMPLATE_CHANGE_OPTIONS } from '../types';
import { listPersonalTemplates } from '../lib/templatePack';
import { TEMPLATE_PACKS } from '../lib/packs';
import TickSlider from './TickSlider';

interface LobbyProps {
  room: RoomSnapshot;
  self: PublicPlayer;
  onStart: () => Promise<void>;
  onUpload: (dataUrl: string) => Promise<void>;
  onSetCaptionTime: (seconds: number) => Promise<void>;
  onSetRounds: (rounds: number) => Promise<void>;
  onSetMode: (mode: GameMode) => Promise<void>;
  onSetMaxTemplateChanges: (value: number) => Promise<void>;
  onSetTemplatePacks: (packIds: string[]) => Promise<void>;
  onKick: (playerId: string) => Promise<void>;
}

function formatTime(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? `${m}min${s}` : `${m}min`;
}

export default function Lobby({ room, self, onStart, onUpload, onSetCaptionTime, onSetRounds, onSetMode, onSetMaxTemplateChanges, onSetTemplatePacks, onKick }: LobbyProps) {
  const [starting, setStarting] = useState(false);
  const [addingPack, setAddingPack] = useState(false);
  const [packAdded, setPackAdded] = useState(false);
  const [packCount, setPackCount] = useState(0);
  const [kicking, setKicking] = useState<string | null>(null);
  const customCount = room.templates.filter((t) => t.source === 'upload').length;
  const connectedCount = room.players.filter((p) => p.connected).length;
  const modeLocked = connectedCount <= 2;
  const currentMode = GAME_MODES.find((m) => m.id === room.effectiveMode) ?? GAME_MODES[0];
  const selectedPackIds = room.settings.templatePackIds?.length ? room.settings.templatePackIds : [TEMPLATE_PACKS[0].id];
  const currentPacks = TEMPLATE_PACKS.filter((p) => selectedPackIds.includes(p.id));

  async function handleTogglePack(packId: string) {
    const isSelected = selectedPackIds.includes(packId);
    if (isSelected && selectedPackIds.length <= 1) return; // au moins un pack doit rester sélectionné
    const next = isSelected ? selectedPackIds.filter((id) => id !== packId) : [...selectedPackIds, packId];
    await onSetTemplatePacks(next);
  }

  useEffect(() => {
    if (!self.isHost) return;
    listPersonalTemplates().then((pack) => setPackCount(pack.length)).catch(() => {});
  }, [self.isHost]);

  async function handleKick(playerId: string, nickname: string) {
    if (!window.confirm(`Exclure ${nickname} de la salle ?`)) return;
    setKicking(playerId);
    try {
      await onKick(playerId);
    } catch (err) {
      console.error(err);
    } finally {
      setKicking(null);
    }
  }

  async function handleAddPack() {
    setAddingPack(true);
    try {
      const pack = await listPersonalTemplates();
      for (const t of pack) {
        // eslint-disable-next-line no-await-in-loop
        await onUpload(t.dataUrl);
      }
      setPackAdded(true);
    } catch (err) {
      console.error(err);
    } finally {
      setAddingPack(false);
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
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {!p.connected && <span style={{ fontSize: '0.8rem' }}>déconnecté</span>}
                {self.isHost && p.id !== self.id && (
                  <button
                    className="kick-btn"
                    aria-label={`Exclure ${p.nickname}`}
                    disabled={kicking === p.id}
                    onClick={() => handleKick(p.id, p.nickname)}
                  >
                    ✕
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="subtitle" style={{ margin: '0 0 10px' }}>Mode de jeu</div>
        {modeLocked ? (
          <div>
            <div style={{ fontWeight: 800 }}>{currentMode.label}</div>
            <div className="center-note" style={{ margin: '4px 0 0' }}>
              Mode imposé à 2 joueurs : pas de système de points possible (chacun ne peut voter
              que pour l'autre). Rejoins avec un 3ᵉ joueur pour débloquer les autres modes.
            </div>
          </div>
        ) : self.isHost ? (
          <>
            <div className="setting-options">
              {GAME_MODES.map((m) => (
                <button
                  key={m.id}
                  className={`setting-chip ${room.settings.mode === m.id ? 'selected' : ''}`}
                  aria-pressed={room.settings.mode === m.id}
                  onClick={() => onSetMode(m.id)}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div className="center-note" style={{ margin: '10px 0 0' }}>
              <strong className="chip-desc-highlight">{currentMode.label}</strong> — {currentMode.description}
            </div>
          </>
        ) : (
          <div>
            <div style={{ fontWeight: 800 }}>{currentMode.label}</div>
            <div className="center-note" style={{ margin: '4px 0 0' }}>{currentMode.description}</div>
          </div>
        )}
      </div>

      {self.isHost ? (
        <div className="card">
          <div className="subtitle" style={{ margin: '0 0 14px' }}>Réglages de partie</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <div className="field-label" style={{ marginBottom: 8, textAlign: 'center' }}>
                Nombre de manches : {room.settings.rounds}
              </div>
              <TickSlider
                options={ROUNDS_OPTIONS}
                value={room.settings.rounds}
                onChange={onSetRounds}
                formatLabel={(n) => String(n)}
              />
            </div>
            <div>
              <div className="field-label" style={{ marginBottom: 8, textAlign: 'center' }}>
                Temps pour créer son meme : {formatTime(room.settings.captionTimeSec)}
              </div>
              <TickSlider
                options={CAPTION_TIME_OPTIONS}
                value={room.settings.captionTimeSec}
                onChange={onSetCaptionTime}
                formatLabel={formatTime}
              />
            </div>
            {room.settings.mode !== 'meme' && (
              <div>
                <div className="field-label" style={{ marginBottom: 8, textAlign: 'center' }}>
                  Changements de template par manche : {room.settings.maxTemplateChanges}
                </div>
                <TickSlider
                  options={TEMPLATE_CHANGE_OPTIONS}
                  value={room.settings.maxTemplateChanges}
                  onChange={onSetMaxTemplateChanges}
                  formatLabel={(n) => String(n)}
                />
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="subtitle" style={{ margin: '0 0 12px' }}>Réglages de partie</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'left' }}>
            <div className="settings-recap-row">
              <span className="field-label">Manches</span>
              <span>{room.settings.rounds}</span>
            </div>
            <div className="settings-recap-row">
              <span className="field-label">Temps pour créer son meme</span>
              <span>{formatTime(room.settings.captionTimeSec)}</span>
            </div>
            {room.settings.mode !== 'meme' && (
              <div className="settings-recap-row">
                <span className="field-label">Changements de template</span>
                <span>{room.settings.maxTemplateChanges} / manche</span>
              </div>
            )}
            <div className="settings-recap-row">
              <span className="field-label">Packs de templates</span>
              <span>{currentPacks.map((p) => p.name).join(', ')}</span>
            </div>
            <div className="settings-recap-row">
              <span className="field-label">Templates</span>
              <span>{room.templates.length} (dont {customCount} perso)</span>
            </div>
          </div>
          <div className="center-note" style={{ marginTop: 12 }}>Réglé par l'hôte.</div>
        </div>
      )}

      {self.isHost && (
        <div className="card">
          <div className="subtitle" style={{ margin: '0 0 10px' }}>
            Packs de templates (plusieurs possibles)
          </div>
          <div className="setting-options">
            {TEMPLATE_PACKS.map((p) => {
              const selected = selectedPackIds.includes(p.id);
              const lockedOn = selected && selectedPackIds.length <= 1;
              return (
                <button
                  key={p.id}
                  className={`setting-chip ${selected ? 'selected' : ''}`}
                  onClick={() => handleTogglePack(p.id)}
                  disabled={lockedOn}
                  aria-pressed={selected}
                  title={lockedOn ? 'Au moins un pack doit rester sélectionné' : undefined}
                >
                  {selected ? '✅ ' : ''}{p.name}
                </button>
              );
            })}
          </div>
          <div className="center-note" style={{ margin: '10px 0 0', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {currentPacks.map((p) => (
              <div key={p.id}>
                <strong className="chip-desc-highlight">{p.name}</strong> — {p.description}
              </div>
            ))}
          </div>
        </div>
      )}

      {self.isHost && (
        <div className="card">
          <div className="subtitle" style={{ margin: '0 0 10px' }}>
            Templates ({room.templates.length}, dont {customCount} perso)
          </div>
          {packCount === 0 ? (
            <div className="center-note">
              Aucun template perso enregistré sur cet appareil (gérable depuis l'accueil).
            </div>
          ) : (
            <button className="btn btn-secondary" onClick={handleAddPack} disabled={addingPack || packAdded}>
              {addingPack ? 'Ajout en cours...' : packAdded ? '✅ Pack ajouté' : `📦 Ajouter mon pack (${packCount})`}
            </button>
          )}
        </div>
      )}

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
