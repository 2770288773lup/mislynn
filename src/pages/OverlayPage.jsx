import { useEffect } from 'react';
import { ListMusic, Music2, Radio } from 'lucide-react';
import { LoadingScreen, VipBadge } from '../components.jsx';
import { useLiveState } from '../hooks.js';

export function OverlayPage() {
  const { state, loading } = useLiveState();
  const fullMode = new URLSearchParams(window.location.search).get('mode') === 'full';

  useEffect(() => {
    document.body.classList.add('overlay-body');
    document.documentElement.classList.add('overlay-html');
    if (fullMode) document.body.classList.add('overlay-body--full');
    return () => {
      document.body.classList.remove('overlay-body', 'overlay-body--full');
      document.documentElement.classList.remove('overlay-html');
    };
  }, [fullMode]);

  if (loading || !state) return <LoadingScreen />;
  const singing = state.queue.find((item) => item.status === 'singing');
  const waiting = state.queue.filter((item) => item.status === 'queued').slice(0, 5);

  return (
    <main className={`overlay-page ${fullMode ? 'overlay-page--full' : ''}`}>
      <section className="overlay-now">
        <div className="overlay-now__label"><Radio size={18} /> NOW SINGING</div>
        <div className="overlay-now__main">
          <span className="overlay-disc"><Music2 size={30} /></span>
          <div>
            <h1>{singing?.songTitle || '等待开唱'}</h1>
            <p>{singing ? singing.artist : '林子的歌单'}</p>
          </div>
        </div>
        {singing && <div className="overlay-requester">{singing.nickname} 点歌 {singing.isVip && <VipBadge />}</div>}
      </section>
      <section className="overlay-next">
        <header><ListMusic size={18} /><span>接下来</span><small>UP NEXT</small></header>
        <div>
          {waiting.length ? waiting.map((item, index) => (
            <article key={item.id}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div><strong>{item.songTitle}</strong><small>{item.artist}</small></div>
              <em>{item.nickname}</em>
            </article>
          )) : <p className="overlay-empty">小鸟们正在选歌…</p>}
        </div>
      </section>
    </main>
  );
}
