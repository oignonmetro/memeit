import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGameStore } from '../state/gameStore';
import MemeRender from '../components/MemeRender';
import Leaderboard from '../components/Leaderboard';
import JoinQrCode from '../components/JoinQrCode';
import { useCountdown } from '../hooks/useCountdown';

export default function TvPage() {
  const { code: codeParam } = useParams();
  const navigate = useNavigate();
  const [codeInput, setCodeInput] = useState(codeParam || '');
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { room, roundStarted, captionProgress, revealMeme, lastResult, roundScoreboard, gameEnded, joinTv, detachRoom } = useGameStore();

  useEffect(() => {
    if (!codeParam) return;
    joinTv(codeParam).catch((err) => setError(err.message));
    return () => detachRoom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeParam]);

  const captionCountdown = useCountdown(roundStarted?.deadline, room?.settings.captionTimeSec ?? 60);
  const voteCountdown = useCountdown(revealMeme?.deadline, room?.settings.voteTimeSec ?? 10);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!codeInput.trim()) return;
    setJoining(true);
    setError(null);
    try {
      navigate(`/tv/${codeInput.trim().toUpperCase()}`);
    } finally {
      setJoining(false);
    }
  }

  if (!room) {
    return (
      <div className="tv-screen">
        <h1 className="title" style={{ fontSize: '3rem' }}>
          Meme<span className="accent">It</span> — Écran TV
        </h1>
        <form className="card" style={{ maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 14 }} onSubmit={handleJoin}>
          <input
            type="text"
            placeholder="Code de la salle"
            value={codeInput}
            maxLength={6}
            onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
            style={{ textAlign: 'center', letterSpacing: '0.2em', fontWeight: 800, fontSize: '1.4rem' }}
            autoFocus
          />
          <button className="btn btn-primary" type="submit" disabled={joining || !codeInput.trim()}>
            Afficher la partie
          </button>
        </form>
        {error && <div className="center-note" style={{ color: 'var(--accent2)' }}>{error}</div>}
      </div>
    );
  }

  if (room.phase === 'lobby') {
    return (
      <div className="tv-screen">
        <div className="subtitle" style={{ fontSize: '1.4rem' }}>Rejoignez avec le code</div>
        <div className="tv-code">{room.code}</div>
        <JoinQrCode code={room.code} />
        <div className="card" style={{ maxWidth: 480 }}>
          <div className="subtitle" style={{ margin: '0 0 10px' }}>Joueurs connectés ({room.players.length})</div>
          <div className="player-list">
            {room.players.map((p) => (
              <div key={p.id} className="player-row">
                <span>{p.nickname}{p.isHost && <span className="badge">Hôte</span>}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (room.phase === 'caption' && roundStarted) {
    return (
      <div className="tv-screen">
        <div className="subtitle" style={{ fontSize: '1.3rem' }}>
          Manche {roundStarted.roundNumber} / {roundStarted.totalRounds} — à vos claviers !
        </div>
        <div className="tv-meme-frame">
          <MemeRender templateUrl={roundStarted.template.url} layers={[]} />
        </div>
        <div className="timer-bar" style={{ maxWidth: 480 }}>
          <div className="timer-fill" style={{ width: `${captionCountdown.pct}%` }} />
        </div>
        <div className="subtitle">
          {captionProgress ? `${captionProgress.submitted} / ${captionProgress.total} memes reçus` : 'En attente des créations...'}
        </div>
      </div>
    );
  }

  if (room.phase === 'voting') {
    if (!revealMeme) {
      return (
        <div className="tv-screen">
          <div className="subtitle" style={{ fontSize: '1.4rem' }}>Préparation du vote...</div>
        </div>
      );
    }
    const result = lastResult && lastResult.memeId === revealMeme.meme.id ? lastResult : null;
    return (
      <div className="tv-screen">
        <div className="subtitle" style={{ fontSize: '1.3rem' }}>
          Meme {revealMeme.index + 1} / {revealMeme.total}
        </div>
        <div className="tv-meme-frame">
          <MemeRender templateUrl={revealMeme.template.url} layers={revealMeme.meme.layers} />
        </div>
        {!result && (
          <div className="timer-bar" style={{ maxWidth: 480 }}>
            <div className="timer-fill" style={{ width: `${voteCountdown.pct}%` }} />
          </div>
        )}
        {result ? (
          <div className="subtitle" style={{ fontSize: '1.6rem', color: 'var(--text)' }}>
            De <strong>{result.authorNickname}</strong> — {result.thumbsUp} 👍
          </div>
        ) : (
          <div className="subtitle">Votez sur vos téléphones !</div>
        )}
      </div>
    );
  }

  if (room.phase === 'round_results' && roundScoreboard) {
    return (
      <div className="tv-screen">
        <div style={{ maxWidth: 480, width: '100%' }}>
          <Leaderboard
            scores={roundScoreboard.scores}
            title={`Résultats — manche ${roundScoreboard.roundNumber} / ${roundScoreboard.totalRounds}`}
          />
        </div>
      </div>
    );
  }

  if (room.phase === 'ended' && gameEnded) {
    return (
      <div className="tv-screen">
        <div style={{ maxWidth: 480, width: '100%' }}>
          <Leaderboard scores={gameEnded.scores} title="🏆 Résultats finaux" winnerId={gameEnded.winnerId} />
        </div>
      </div>
    );
  }

  return (
    <div className="tv-screen">
      <div className="subtitle">Chargement...</div>
    </div>
  );
}
