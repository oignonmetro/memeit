import { useState } from 'react';
import MemeRender from './MemeRender';
import { useCountdown } from '../hooks/useCountdown';
import type { VoteStatePayload } from '../types';

interface FavoriteVotePanelProps {
  vote: VoteStatePayload;
  selfId: string;
  voteTimeSec: number;
  onVote: (authorId: string) => Promise<void>;
}

export default function FavoriteVotePanel({ vote, selfId, voteTimeSec, onVote }: FavoriteVotePanelProps) {
  const [pending, setPending] = useState<string | null>(null);
  const { remainingSec, pct } = useCountdown(vote.deadline, voteTimeSec);

  async function pick(authorId: string) {
    if (authorId === selfId || pending) return;
    setPending(authorId);
    try {
      await onVote(authorId);
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="subtitle" style={{ margin: 0, color: 'var(--text)', fontWeight: 800 }}>
        Vote pour ton meme préféré 🏆
      </div>

      <div className="timer-bar">
        <div className="timer-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="center-note">{remainingSec}s — {vote.votedCount}/{vote.total} ont voté</div>

      <div className="vote-grid">
        {vote.memes.map((meme, i) => {
          const own = meme.authorId === selfId;
          const selected = vote.myVote === meme.authorId;
          return (
            <button
              key={meme.authorId}
              className={`vote-card ${selected ? 'selected' : ''} ${own ? 'own' : ''} ${vote.myVote && !selected ? 'disabled' : ''}`}
              onClick={() => pick(meme.authorId)}
              disabled={own || Boolean(pending)}
            >
              <span className="vote-card__badge">#{i + 1}</span>
              {own && <span className="vote-card__own-tag">toi</span>}
              <MemeRender templateUrl={meme.template.url} layers={meme.layers} />
            </button>
          );
        })}
      </div>

      {vote.myVote ? (
        <div className="center-note">Vote enregistré ! Tu peux encore changer d'avis tant que le temps tourne.</div>
      ) : (
        <div className="center-note">Touche le meme que tu préfères (pas le tien).</div>
      )}
    </div>
  );
}
