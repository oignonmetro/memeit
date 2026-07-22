import type { PublicPlayer } from '../types';

interface LeaderboardProps {
  scores: PublicPlayer[];
  title: string;
  subtitle?: string;
  selfId?: string;
  winnerId?: string | null;
}

export default function Leaderboard({ scores, title, subtitle, selfId, winnerId }: LeaderboardProps) {
  const sorted = [...scores].sort((a, b) => b.score - a.score);
  return (
    <div className="card">
      <div className="subtitle" style={{ margin: '0 0 4px', fontWeight: 800, color: 'var(--text)' }}>{title}</div>
      {subtitle && <div className="center-note" style={{ marginBottom: 10 }}>{subtitle}</div>}
      <div className="player-list">
        {sorted.map((p, i) => (
          <div key={p.id} className="player-row">
            <span>
              {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`} {p.nickname}
              {p.id === selfId && ' (toi)'}
              {p.id === winnerId && ' 🏆'}
            </span>
            <strong>{p.score} 👍</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
