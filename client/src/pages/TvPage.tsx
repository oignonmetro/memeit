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

  const { room, roundStarted, captionProgress, revealMeme, voteState, roundScoreboard, gameEnded, joinTv, detachRoom } = useGameStore();

  useEffect(() => {
    if (!codeParam) return;
    joinTv(codeParam).catch((err) => setError(err.message));
    return () => detachRoom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeParam]);

  const captionCountdown = useCountdown(roundStarted?.deadline, room?.settings.captionTimeSec ?? 60);
  const revealCountdown = useCountdown(revealMeme?.deadline, room?.settings.revealTimeSec ?? 5);
  const voteCountdown = useCountdown(voteState?.deadline, room?.settings.voteTimeSec ?? 30);

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
            maxLength={4}
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

  if (room.phase === 'reveal') {
    if (!revealMeme) {
      return (
        <div className="tv-screen">
          <div className="subtitle" style={{ fontSize: '1.4rem' }}>Préparation...</div>
        </div>
      );
    }
    return (
      <div className="tv-screen">
        <div className="subtitle" style={{ fontSize: '1.3rem' }}>
          Découverte des memes — {revealMeme.index + 1} / {revealMeme.total}
        </div>
        <div className="tv-meme-frame">
          <MemeRender templateUrl={revealMeme.template.url} layers={revealMeme.meme.layers} />
        </div>
        <div className="timer-bar" style={{ maxWidth: 480 }}>
          <div className="timer-fill" style={{ width: `${revealCountdown.pct}%` }} />
        </div>
      </div>
    );
  }

  if (room.phase === 'vote' && voteState) {
    return (
      <div className="tv-screen">
        <div className="subtitle" style={{ fontSize: '1.6rem', color: 'var(--text)' }}>
          Votez pour votre meme préféré sur vos téléphones !
        </div>
        <div className="timer-bar" style={{ maxWidth: 480 }}>
          <div className="timer-fill" style={{ width: `${voteCountdown.pct}%` }} />
        </div>
        <div className="subtitle">{voteState.votedCount} / {voteState.total} ont voté</div>
        <div className="vote-grid tv">
          {voteState.memes.map((meme, i) => (
            <div key={meme.authorId} className="vote-card disabled">
              <span className="vote-card__badge">#{i + 1}</span>
              <MemeRender templateUrl={voteState.template.url} layers={meme.layers} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (room.phase === 'round_results' && roundScoreboard) {
    return (
      <div className="tv-screen">
        {roundScoreboard.winner && (
          <>
            <div className="subtitle" style={{ fontSize: '1.6rem', color: 'var(--text)' }}>
              🏆 {roundScoreboard.winner.nickname} — {roundScoreboard.winner.votes} vote{roundScoreboard.winner.votes > 1 ? 's' : ''}
            </div>
            <div className="tv-meme-frame">
              <MemeRender templateUrl={roundScoreboard.winner.template.url} layers={roundScoreboard.winner.layers} />
            </div>
          </>
        )}
        <div style={{ maxWidth: 480, width: '100%' }}>
          <Leaderboard
            scores={roundScoreboard.scores}
            title={`Classement — manche ${roundScoreboard.roundNumber} / ${roundScoreboard.totalRounds}`}
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
