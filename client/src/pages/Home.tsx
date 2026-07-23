import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../state/gameStore';

type Mode = 'menu' | 'create' | 'join';

export default function Home() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('menu');
  const [nickname, setNickname] = useState('');
  const [code, setCode] = useState('');
  const [rounds, setRounds] = useState(3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!nickname.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const roomCode = await useGameStore.getState().createRoom(nickname.trim(), { rounds });
      navigate(`/room/${roomCode}`);
    } catch (err: any) {
      setError(err.message || 'Impossible de créer la salle.');
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!nickname.trim() || !code.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await useGameStore.getState().joinRoom(code.trim(), nickname.trim());
      navigate(`/room/${code.trim().toUpperCase()}`);
    } catch (err: any) {
      setError(err.message || 'Impossible de rejoindre la salle.');
    } finally {
      setBusy(false);
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
          <button className="btn btn-primary" onClick={() => setMode('create')}>
            Créer une partie
          </button>
          <button className="btn btn-secondary" onClick={() => setMode('join')}>
            Rejoindre une partie
          </button>
          <button className="btn btn-ghost" onClick={() => navigate('/tv')}>
            📺 Afficher sur une TV
          </button>
        </div>
      )}

      {mode === 'create' && (
        <form className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }} onSubmit={handleCreate}>
          <input type="text" placeholder="Ton pseudo" value={nickname} maxLength={20} onChange={(e) => setNickname(e.target.value)} autoFocus />
          <div>
            <div className="center-note" style={{ marginBottom: 6 }}>Nombre de manches : {rounds}</div>
            <input
              type="range"
              min={1}
              max={8}
              value={rounds}
              onChange={(e) => setRounds(Number(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={busy || !nickname.trim()}>
            {busy ? 'Création...' : 'Créer la salle'}
          </button>
          <button className="btn btn-ghost" type="button" onClick={() => setMode('menu')}>
            Retour
          </button>
        </form>
      )}

      {mode === 'join' && (
        <form className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }} onSubmit={handleJoin}>
          <input
            type="text"
            placeholder="Code de la salle"
            value={code}
            maxLength={6}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            style={{ textAlign: 'center', letterSpacing: '0.2em', fontWeight: 800, textTransform: 'uppercase' }}
            autoFocus
          />
          <input type="text" placeholder="Ton pseudo" value={nickname} maxLength={20} onChange={(e) => setNickname(e.target.value)} />
          <button className="btn btn-primary" type="submit" disabled={busy || !nickname.trim() || !code.trim()}>
            {busy ? 'Connexion...' : 'Rejoindre'}
          </button>
          <button className="btn btn-ghost" type="button" onClick={() => setMode('menu')}>
            Retour
          </button>
        </form>
      )}

      {error && <div className="center-note" style={{ color: 'var(--accent2)' }}>{error}</div>}
    </div>
  );
}
