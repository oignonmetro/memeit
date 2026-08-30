import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGameStore } from '../state/gameStore';
import Lobby from '../components/Lobby';
import CaptionEditor from '../components/CaptionEditor';
import FavoriteVotePanel from '../components/FavoriteVotePanel';
import MemeRender from '../components/MemeRender';
import Leaderboard from '../components/Leaderboard';
import { useCountdown } from '../hooks/useCountdown';
import { getDefaultNickname, setDefaultNickname } from '../lib/nickname';
import { downloadMeme } from '../lib/memeImage';

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
    setRounds,
    setMode,
    setMaxTemplateChanges,
    setTemplatePacks,
    uploadTemplate,
    submitMeme,
    changeTemplate,
    castFavorite,
    markMemeSeen,
    joinRoom,
    leaveRoom,
    restartGame,
    kickPlayer,
  } = useGameStore();

  const [nickname, setNickname] = useState(getDefaultNickname());
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [kicked, setKicked] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);
  const hadSelfRef = useRef(false);

  useEffect(() => {
    if (!code) return;
    attachRoom(code.toUpperCase(), 'player');
    return () => detachRoom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  useEffect(() => {
    hadSelfRef.current = false;
    setKicked(false);
  }, [code]);

  const captionCountdown = useCountdown(roundStarted?.deadline, room?.settings.captionTimeSec ?? 60);
  const revealCountdown = useCountdown(revealMeme?.deadline, room?.settings.revealTimeSec ?? 5);

  const self = room?.players.find((p) => p.id === selfId) || null;

  useEffect(() => {
    if (self) hadSelfRef.current = true;
    else if (hadSelfRef.current && room) setKicked(true);
  }, [self, room]);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!nickname.trim()) return;
    setJoining(true);
    setJoinError(null);
    try {
      setDefaultNickname(nickname.trim());
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

  async function handleDownloadRevealed() {
    if (!revealMeme || downloading) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      await downloadMeme(
        revealMeme.template.url,
        revealMeme.meme.layers,
        `memeit-${code.toUpperCase()}-${revealMeme.index + 1}.png`
      );
    } catch (err: any) {
      setDownloadError(err?.message || 'Téléchargement impossible.');
    } finally {
      setDownloading(false);
    }
  }

  async function handleMarkSeen() {
    if (!revealMeme || revealMeme.selfSeen || revealMeme.isAuthor || marking) return;
    setMarking(true);
    try {
      await markMemeSeen();
    } finally {
      setMarking(false);
    }
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

  if (kicked) {
    return (
      <div className="screen">
        <h1 className="title">
          Salle <span className="accent">{code}</span>
        </h1>
        <div className="card center-note">Tu as été exclu de cette salle par l'hôte.</div>
        <button className="btn btn-ghost" onClick={handleLeave}>Retour à l'accueil</button>
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
        <Lobby
          room={room}
          self={self}
          onStart={startGame}
          onUpload={uploadTemplate}
          onSetCaptionTime={setCaptionTime}
          onSetRounds={setRounds}
          onSetMode={setMode}
          onSetMaxTemplateChanges={setMaxTemplateChanges}
          onSetTemplatePacks={setTemplatePacks}
          onKick={kickPlayer}
        />
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
          ) : roundStarted.template ? (
            <CaptionEditor
              key={roundStarted.template.id}
              template={roundStarted.template}
              submitting={submitting}
              changesLeft={roundStarted.changesLeft}
              isFirstTemplate={roundStarted.isFirstTemplate}
              isSharedTemplate={roundStarted.isSharedTemplate}
              onChangeTemplate={changeTemplate}
              onSubmit={async (layers) => {
                setSubmitting(true);
                try {
                  await submitMeme(layers);
                } finally {
                  setSubmitting(false);
                }
              }}
            />
          ) : (
            <div className="card center-note">En attente du prochain tour...</div>
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
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-secondary btn-sm" onClick={handleDownloadRevealed} disabled={downloading}>
                {downloading ? 'Préparation...' : '⬇️ Télécharger ce meme'}
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleMarkSeen}
                disabled={marking || revealMeme.selfSeen || revealMeme.isAuthor}
                title={revealMeme.isAuthor ? "C'est ton meme, pas besoin de le confirmer" : undefined}
              >
                {revealMeme.isAuthor
                  ? '👀 Ton meme'
                  : revealMeme.selfSeen
                  ? `👀 Vu (${revealMeme.seenCount}/${revealMeme.seenTotal})`
                  : '👀 Vu'}
              </button>
            </div>
            {downloadError && (
              <div className="center-note" style={{ color: 'var(--accent2)' }}>{downloadError}</div>
            )}
            <div className="timer-bar">
              <div className="timer-fill" style={{ width: `${revealCountdown.pct}%` }} />
            </div>
            <div className="center-note">
              {revealMeme.isAuthor || revealMeme.selfSeen
                ? `En attente des autres (${revealMeme.seenCount}/${revealMeme.seenTotal} ont vu)...`
                : 'Le vote arrive quand tous les memes sont passés. Clique "Vu" pour accélérer.'}
            </div>
          </div>
        ) : (
          <div className="center-note" style={{ marginTop: 40 }}>Préparation...</div>
        )
      )}

      {room.phase === 'vote' && (
        voteState ? (
          <FavoriteVotePanel
            vote={voteState}
            selfId={selfId}
            voteTimeSec={room.settings.voteTimeSec}
            onVote={castFavorite}
          />
        ) : (
          <div className="center-note" style={{ marginTop: 40 }}>Préparation du vote...</div>
        )
      )}

      {room.phase === 'round_results' && roundScoreboard && (
        <>
          {room.effectiveMode === 'detendu' ? (
            <div className="card center-note" style={{ fontSize: '1.1rem', color: 'var(--text)' }}>
              Manche {roundScoreboard.roundNumber} terminée 🎉
            </div>
          ) : (
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
            </>
          )}
          <div className="center-note">
            {roundScoreboard.roundNumber >= roundScoreboard.totalRounds
              ? (room.effectiveMode === 'detendu' ? 'Fin de la partie...' : 'Calcul du classement final...')
              : 'Prochaine manche dans quelques secondes...'}
          </div>
        </>
      )}

      {room.phase === 'ended' && gameEnded && (
        <>
          {room.effectiveMode === 'detendu' ? (
            <div className="card center-note" style={{ fontSize: '1.2rem', color: 'var(--text)' }}>
              Partie terminée — merci d'avoir joué ! 🎉
            </div>
          ) : (
            <Leaderboard scores={gameEnded.scores} title="🏆 Résultats finaux" selfId={selfId} winnerId={gameEnded.winnerId} />
          )}
          {self.isHost ? (
            <button
              className="btn btn-primary"
              disabled={restarting}
              onClick={async () => {
                setRestarting(true);
                try {
                  await restartGame();
                } finally {
                  setRestarting(false);
                }
              }}
            >
              {restarting ? 'Préparation...' : '🔄 Rejouer avec ce groupe'}
            </button>
          ) : (
            <div className="center-note">En attente que l'hôte relance une partie...</div>
          )}
          <button className="btn btn-ghost" onClick={handleLeave}>
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
