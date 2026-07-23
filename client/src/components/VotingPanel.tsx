import { useState } from 'react';
import MemeRender from './MemeRender';
import { useCountdown } from '../hooks/useCountdown';
import type { RevealMemePayload, RevealResultPayload } from '../types';

interface VotingPanelProps {
  reveal: RevealMemePayload;
  isOwnMeme: boolean;
  hasVoted: boolean;
  result: RevealResultPayload | null;
  voteTimeSec: number;
  onVote: (thumbsUp: boolean) => Promise<void>;
}

export default function VotingPanel({ reveal, isOwnMeme, hasVoted, result, voteTimeSec, onVote }: VotingPanelProps) {
  const [voting, setVoting] = useState(false);
  const { remainingSec, pct } = useCountdown(result ? null : reveal.deadline, voteTimeSec);
  const resolved = Boolean(result);

  async function vote(thumbsUp: boolean) {
    if (voting || hasVoted) return;
    setVoting(true);
    try {
      await onVote(thumbsUp);
    } finally {
      setVoting(false);
    }
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="subtitle" style={{ margin: 0 }}>
        Meme {reveal.index + 1} / {reveal.total}
      </div>
      <MemeRender templateUrl={reveal.template.url} layers={reveal.meme.layers} />

      {!resolved && (
        <div className="timer-bar">
          <div className="timer-fill" style={{ width: `${pct}%` }} />
        </div>
      )}

      {resolved ? (
        <div className="center-note" style={{ fontSize: '1.1rem', color: 'var(--text)' }}>
          De <strong>{result!.authorNickname}</strong> — {result!.thumbsUp} 👍
        </div>
      ) : isOwnMeme ? (
        <div className="center-note">C'est ton meme, tu ne peux pas voter dessus !</div>
      ) : hasVoted ? (
        <div className="center-note">Vote enregistré, en attente des autres...</div>
      ) : (
        <div className="row">
          <button className="thumb-btn active" style={{ flex: 1 }} onClick={() => vote(true)} disabled={voting} aria-label="Pouce levé">
            👍
          </button>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => vote(false)} disabled={voting}>
            Passer ({remainingSec}s)
          </button>
        </div>
      )}
    </div>
  );
}
