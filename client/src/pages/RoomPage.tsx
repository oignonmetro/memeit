import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGameStore } from '../state/gameStore';
import Lobby from '../components/Lobby';
import CaptionEditor from '../components/CaptionEditor';
import VotingPanel from '../components/VotingPanel';
import Leaderboard from '../components/Leaderboard';
import { useCountdown } from '../hooks/useCountdown';

export default function RoomPage() {
  const { code = '' } = useParams();
  const navigate = useNavigate();
  const {
    room,
    self,
    roundStarted,
    captionProgress,
    revealMeme,
    lastResult,
    roundScoreboard,
    gameEnded,
    hasSubmitted,
    hasVotedCurrent,
    myMemeId,
    error,
    clearError,
    tryRejoin,
    startGame,
    uploadTemplate,
    submitMeme,
    castVote,
    leaveRoom,
  } = useGameStore();

  const [rejoinDone, setRejoinDone] = useState(false);
  const [nickname, setNickname] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!code) return;
    if (self) {
      setRejoinDone(true);
      return;
    }
    tryRejoin(code).finally(() => setRejoinDone(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const captionCountdown = useCountdown(roundStarted?.deadline, room?.settings.captionTimeSec ?? 60);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!nickname.trim()) return;
    setJoining(true);
    setJoinError(null);
    try {
      await useGameStore.getState().joinRoom(code, nickname.trim());
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

  if (!rejoinDone) {
    return (
      <div className="screen">
        <div className="center-note" style={{ marginTop: 80 }}>Connexion...</div>
      </div>
    );
  }

  if (!self || !room) {
    return (
      <div className="screen">
        <h1 className="title">
          Salle <span className="accent">{code}</span>
        </h1>
        <form className="card" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }} onSubmit={handleJoin}>
          <input type="text" placeholder="Ton pseudo" value={nickname} maxLength={20} onChange={(e) => setNickname(e.target.value)} />
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

      {room.phase === 'lobby' && <Lobby room={room} self={self} onStart={startGame} onUpload={uploadTemplate} />}

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
                  await submitMeme(roundStarted.template.id, layers);
                } finally {
                  setSubmitting(false);
                }
              }}
            />
          )}
        </>
      )}

      {room.phase === 'voting' && (
        revealMeme ? (
          <VotingPanel
            reveal={revealMeme}
            templates={room.templates}
            isOwnMeme={revealMeme.meme.id === myMemeId}
            hasVoted={hasVotedCurrent}
            result={lastResult && lastResult.memeId === revealMeme.meme.id ? lastResult : null}
            voteTimeSec={room.settings.voteTimeSec}
            onVote={(thumbsUp) => castVote(revealMeme.meme.id, thumbsUp)}
          />
        ) : (
          <div className="center-note" style={{ marginTop: 40 }}>Préparation du vote...</div>
        )
      )}

      {room.phase === 'round_results' && roundScoreboard && (
        <>
          <Leaderboard
            scores={roundScoreboard.scores}
            title={`Résultats — manche ${roundScoreboard.roundNumber} / ${roundScoreboard.totalRounds}`}
            selfId={self.id}
          />
          <div className="center-note">
            {roundScoreboard.roundNumber >= roundScoreboard.totalRounds ? 'Calcul du classement final...' : 'Prochaine manche dans quelques secondes...'}
          </div>
        </>
      )}

      {room.phase === 'ended' && gameEnded && (
        <>
          <Leaderboard scores={gameEnded.scores} title="🏆 Résultats finaux" selfId={self.id} winnerId={gameEnded.winnerId} />
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
