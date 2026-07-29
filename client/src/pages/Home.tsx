import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../state/gameStore';
import { getDefaultNickname, setDefaultNickname } from '../lib/nickname';
import { resizeImageFile } from '../lib/image';
import {
  listPersonalTemplates,
  addPersonalTemplate,
  removePersonalTemplate,
  exportPackJson,
  importPackJson,
  type PersonalTemplate,
} from '../lib/templatePack';

type Mode = 'menu' | 'templates';

export default function Home() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('menu');
  const [nickname, setNickname] = useState(getDefaultNickname());
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [pack, setPack] = useState<PersonalTemplate[]>([]);
  const [packBusy, setPackBusy] = useState(false);
  const [packMessage, setPackMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mode === 'templates') {
      listPersonalTemplates().then(setPack).catch(() => {});
    }
  }, [mode]);

  // Nickname is remembered automatically as soon as it's typed, no opt-in needed.
  useEffect(() => {
    if (nickname.trim()) setDefaultNickname(nickname.trim());
  }, [nickname]);

  async function handleCreate() {
    if (!nickname.trim() || busy) return;
    setBusy('create');
    setError(null);
    try {
      const roomCode = await useGameStore.getState().createRoom(nickname.trim(), {});
      navigate(`/room/${roomCode}`);
    } catch (err: any) {
      setError(err.message || 'Impossible de créer la salle.');
    } finally {
      setBusy(null);
    }
  }

  async function handleJoin() {
    if (!nickname.trim() || !code.trim() || busy) return;
    setBusy('join');
    setError(null);
    try {
      await useGameStore.getState().joinRoom(code.trim(), nickname.trim());
      navigate(`/room/${code.trim().toUpperCase()}`);
    } catch (err: any) {
      setError(err.message || 'Impossible de rejoindre la salle.');
    } finally {
      setBusy(null);
    }
  }

  async function handleAddTemplate(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPackBusy(true);
    setPackMessage(null);
    try {
      const dataUrl = await resizeImageFile(file);
      const t = await addPersonalTemplate(file.name.replace(/\.[^.]+$/, ''), dataUrl);
      setPack((prev) => [...prev, t]);
    } catch (err) {
      setPackMessage("Impossible d'ajouter ce template.");
    } finally {
      setPackBusy(false);
    }
  }

  async function handleRemoveTemplate(id: string) {
    setPack((prev) => prev.filter((t) => t.id !== id));
    await removePersonalTemplate(id).catch(() => {});
  }

  async function handleExportPack() {
    const json = await exportPackJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `memeit-pack-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImportPack(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPackBusy(true);
    setPackMessage(null);
    try {
      const text = await file.text();
      const { added, skipped } = await importPackJson(text);
      setPack(await listPersonalTemplates());
      setPackMessage(`${added} template${added > 1 ? 's' : ''} importé${added > 1 ? 's' : ''}${skipped ? `, ${skipped} déjà présent(s)` : ''}.`);
    } catch (err) {
      setPackMessage('Fichier de pack invalide.');
    } finally {
      setPackBusy(false);
    }
  }

  return (
    <div className="screen">
      <img src="/icons/icon-192.png" alt="MemeIt" className="home-logo" />
      <h1 className="title">
        Meme<span className="accent">It</span>
      </h1>
      <p className="subtitle">Un template, tout le monde crée son meme, la salle vote au pouce levé.</p>

      {mode === 'menu' && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input type="text" placeholder="Ton pseudo" value={nickname} maxLength={20} onChange={(e) => setNickname(e.target.value)} autoFocus />

          <button className="btn btn-primary" disabled={!nickname.trim() || Boolean(busy)} onClick={handleCreate}>
            {busy === 'create' ? 'Création...' : 'Créer une partie'}
          </button>

          <div className="row" style={{ alignItems: 'center', gap: 8 }}>
            <input
              type="text"
              placeholder="Code"
              value={code}
              maxLength={4}
              onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 4))}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              style={{ textAlign: 'center', letterSpacing: '0.2em', fontWeight: 800, textTransform: 'uppercase' }}
            />
            <button
              className="btn btn-secondary"
              style={{ width: 'auto', flexShrink: 0, padding: '16px 20px' }}
              disabled={!nickname.trim() || !code.trim() || Boolean(busy)}
              onClick={handleJoin}
            >
              {busy === 'join' ? '...' : 'Rejoindre'}
            </button>
          </div>

          <button className="btn btn-ghost" onClick={() => navigate('/tv')}>
            📺 Afficher sur une TV
          </button>
          <button className="btn btn-ghost" onClick={() => setMode('templates')}>
            🖼️ Mes templates persos
          </button>
        </div>
      )}

      {mode === 'templates' && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
          <div className="subtitle" style={{ margin: 0 }}>
            Mes templates persos ({pack.length})
          </div>
          <div className="center-note" style={{ textAlign: 'left', margin: 0 }}>
            Enregistrés sur cet appareil uniquement. Une fois hôte d'une salle, tu pourras ajouter
            tout ton pack à la partie en un clic.
          </div>

          {pack.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 8 }}>
              {pack.map((t) => (
                <div key={t.id} style={{ position: 'relative' }}>
                  <img src={t.dataUrl} alt={t.name} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 10 }} />
                  <button
                    aria-label="Supprimer"
                    onClick={() => handleRemoveTemplate(t.id)}
                    style={{
                      position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: '50%',
                      border: 'none', background: 'rgba(0,0,0,0.7)', color: '#fff', cursor: 'pointer', lineHeight: 1,
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={handleAddTemplate} />
          <button className="btn btn-secondary" onClick={() => fileRef.current?.click()} disabled={packBusy}>
            {packBusy ? 'Ajout en cours...' : '+ Ajouter un template'}
          </button>

          <div className="row">
            <button className="btn btn-ghost" onClick={handleExportPack} disabled={pack.length === 0}>
              ⬇️ Exporter mon pack
            </button>
            <button className="btn btn-ghost" onClick={() => importRef.current?.click()} disabled={packBusy}>
              ⬆️ Importer un pack
            </button>
          </div>
          <input ref={importRef} type="file" accept="application/json" hidden onChange={handleImportPack} />

          {packMessage && <div className="center-note">{packMessage}</div>}

          <button className="btn btn-ghost" type="button" onClick={() => setMode('menu')}>
            Retour
          </button>
        </div>
      )}

      {error && <div className="center-note" style={{ color: 'var(--accent2)' }}>{error}</div>}
    </div>
  );
}
