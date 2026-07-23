import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGameStore } from '../state/gameStore';
import Lobby from '../components/Lobby';
import CaptionEditor from '../components/CaptionEditor';
import FavoriteVotePanel from '../components/FavoriteVotePanel';
import MemeRender from '../components/MemeRender';
import Leaderboard from '../components/Leaderboard';
import { useCountdown } from '../hooks/useCountdown';

export default function RoomPage() {
  const { code = '' } = useParams();
  const navigate = useNavigate();
  const {
    selfId,
    room,
    loaded,
    roundStarted,
    captionProgress,
    revealMeme,
    voteState,
    roundScoreboard,
    gameEnded,
    hasSubmitted,
    error,
    clearError,
    attachRoom,
    detachRoom,
    startGame,
    setCaptionTime,
    uploadTemplate,
    submitMeme,
    castFavorite,
    joinRoom,
    leaveRoom,
  } = useGameStore();

  const [nickname, setNickname] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!code) return;
    attachRoom(code.toUpperCase(), 'player');
    return () => detachRoom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const captionCountdown = useCountdown(roundStarted?.deadline, room?.settings.captionTimeSec ?? 60);
  const revealCountdown = useCountdown(revealMeme?.deadline, room?.settings.revealTimeSec ?? 5);

  const self = room?.players.find((p) => p.id === selfId) || null;

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!nickname.trim()) return;
    setJoining(true);
    setJoinError(null);
    try {
      await joinRoom(code, nickname.trim());
    } catch (err: any) {
      setJoinError(err.message || 'Impossible de rejoindre.');
    } finally {
      setJoining(false);
    }
  }

  function handleLeave() {
    leaveRoom();
    navigate('/');
  }

  if (!loaded) {
    return (
      <div className="screen">
        <div className="center-note" style={{ marginTop: 80 }}>Connexion...</div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="screen">
        <h1 className="title">
          Salle <span className="accent">{code}</span>
        </h1>
        <div className="card center-note">Cette salle n'existe pas (ou plus).</div>
        <button className="btn btn-ghost" onClick={() => navigate('/')}>Retour à l'accueil</button>
      </div>
    );
  }

  if (!self) {
    return (
      <div className="screen">
        <h1 className="title">
          Salle <span className="accent">{code}</span>
        </h1>
        <form className="card" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }} onSubmit={handleJoin}>
          <input type="text" placeholder="Ton pseudo" value={nickname} maxLength={20} onChange={(e) => setNickname(e.target.value)} autoFocus />
          <button className="btn btn-primary" type="submit" disabled={joining || !nickname.trim()}>
            {joining ? 'Connexion...' : 'Rejoindre la partie'}
          </button>
          {joinError && <div className="center-note" style={{ color: 'var(--accent2)' }}>{joinError}</div>}
        </form>
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="row" style={{ width: '100%', alignItems: 'center' }}>
        <h1 className="title" style={{ margin: 0, fontSize: '1.4rem', flex: 1, textAlign: 'left' }}>
          MemeIt · <span className="accent">{room.code}</span>
        </h1>
        <button className="btn btn-ghost" style={{ width: 'auto', padding: '8px 14px' }} onClick={handleLeave}>
          Quitter
        </button>
      </div>

      {room.phase === 'lobby' && (
        <Lobby room={room} self={self} onStart={startGame} onUpload={uploadTemplate} onSetCaptionTime={setCaptionTime} />
      )}

      {room.phase === 'caption' && roundStarted && (
        <>
          <div className="center-note">
            Manche {roundStarted.roundNumber} / {roundStarted.totalRounds}
          </div>
          {!hasSubmitted && (
            <div className="timer-bar">
              <div className="timer-fill" style={{ width: `${captionCountdown.pct}%` }} />
            </div>
          )}
          {hasSubmitted ? (
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem' }}>✅</div>
              <div className="center-note">
                Meme envoyé ! En attente des autres ({captionProgress?.submitted ?? 0}/{captionProgress?.total ?? room.players.length})
              </div>
            </div>
          ) : (
            <CaptionEditor
              templateUrl={roundStarted.template.url}
              submitting={submitting}
              onSubmit={async (layers) => {
                setSubmitting(true);
                try {
                  await submitMeme(layers);
                } finally {
                  setSubmitting(false);
                }
              }}
            />
          )}
        </>
      )}

      {room.phase === 'reveal' && (
        revealMeme ? (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="subtitle" style={{ margin: 0 }}>
              Découverte des memes — {revealMeme.index + 1} / {revealMeme.total}
            </div>
            <MemeRender templateUrl={revealMeme.template.url} layers={revealMeme.meme.layers} />
            <div className="timer-bar">
              <div className="timer-fill" style={{ width: `${revealCountdown.pct}%` }} />
            </div>
            <div className="center-note">Le vote arrive quand tous les memes sont passés.</div>
          </div>
        ) : (
          <div className="center-note" style={{ marginTop: 40 }}>Préparation...</div>
        )
      )}

      {room.phase === 'vote' && voteState && (
        <FavoriteVotePanel
          vote={voteState}
          selfId={selfId}
          voteTimeSec={room.settings.voteTimeSec}
          onVote={castFavorite}
        />
      )}

      {room.phase === 'round_results' && roundScoreboard && (
        <>
          {roundScoreboard.winner ? (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="subtitle" style={{ margin: 0, color: 'var(--text)', fontWeight: 800, textAlign: 'center' }}>
                🏆 Meme de la manche — {roundScoreboard.winner.nickname} ({roundScoreboard.winner.votes} vote{roundScoreboard.winner.votes > 1 ? 's' : ''})
              </div>
              <MemeRender templateUrl={roundScoreboard.winner.template.url} layers={roundScoreboard.winner.layers} />
            </div>
          ) : (
            <div className="card center-note">Personne n'a voté cette manche.</div>
          )}
          <Leaderboard
            scores={roundScoreboard.scores}
            title={`Classement — manche ${roundScoreboard.roundNumber} / ${roundScoreboard.totalRounds}`}
            selfId={selfId}
          />
          <div className="center-note">
            {roundScoreboard.roundNumber >= roundScoreboard.totalRounds ? 'Calcul du classement final...' : 'Prochaine manche dans quelques secondes...'}
          </div>
        </>
      )}

      {room.phase === 'ended' && gameEnded && (
        <>
          <Leaderboard scores={gameEnded.scores} title="🏆 Résultats finaux" selfId={selfId} winnerId={gameEnded.winnerId} />
          <button className="btn btn-primary" onClick={handleLeave}>
            Retour à l'accueil
          </button>
        </>
      )}

      {error && (
        <div className="error-toast" onClick={clearError}>
          {error}
        </div>
      )}
    </div>
  );
}
