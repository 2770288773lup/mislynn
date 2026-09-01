import { Crown, Music2, Radio, UserRound } from 'lucide-react';

export function Logo({ compact = false }) {
  return (
    <a className={`logo ${compact ? 'logo--compact' : ''}`} href="/" aria-label="林子的歌单首页">
      <span className="logo__mark"><Music2 size={19} strokeWidth={2.4} /></span>
      <span>
        <strong>林子的歌单</strong>
        {!compact && <small>可爱的林子 · LIVE</small>}
      </span>
    </a>
  );
}

export function VipBadge() {
  return <span className="badge badge--vip"><Crown size={12} /> VIP</span>;
}

export function StatusBadge({ open }) {
  return (
    <span className={`live-status ${open ? '' : 'live-status--closed'}`}>
      <Radio size={13} /> {open ? '点歌开放中' : '暂停点歌'}
    </span>
  );
}

export function Avatar({ nickname, vip = false }) {
  return (
    <span className={`avatar ${vip ? 'avatar--vip' : ''}`} aria-hidden="true">
      {vip ? <Crown size={14} /> : <UserRound size={14} />}
      <span>{nickname?.slice(0, 1).toUpperCase()}</span>
    </span>
  );
}

export function Toast({ toast }) {
  if (!toast) return null;
  return <div className={`toast toast--${toast.kind}`} role="status">{toast.message}</div>;
}

export function EmptyState({ icon: Icon = Music2, title, detail }) {
  return (
    <div className="empty-state">
      <Icon size={28} />
      <strong>{title}</strong>
      {detail && <span>{detail}</span>}
    </div>
  );
}

export function LoadingScreen() {
  return (
    <main className="loading-screen">
      <span className="vinyl-spinner"><Music2 size={22} /></span>
      <p>正在准备歌单…</p>
    </main>
  );
}
