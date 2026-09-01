import { useMemo, useState } from 'react';
import {
  ChevronDown,
  Clock3,
  Dices,
  ListMusic,
  LogOut,
  Music2,
  Plus,
  Search,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react';
import { api } from '../api.js';
import { Avatar, EmptyState, LoadingScreen, Logo, StatusBadge, Toast, VipBadge } from '../components.jsx';
import { useLiveState, useToast } from '../hooks.js';

const NICKNAME_KEY = 'linzi-viewer-nickname';
const PAGE_SIZE = 60;

function normalized(value) {
  return value.toLocaleLowerCase('zh-CN').replace(/\s+/g, '');
}

function isVip(nickname, vipNicknames = ['lclol', 'lol']) {
  const names = Array.isArray(vipNicknames) ? vipNicknames : [];
  return names.map(normalized).includes(normalized(nickname));
}

function NicknameDialog({ initialValue, onSave, onClose }) {
  const [value, setValue] = useState(initialValue);

  function submit(event) {
    event.preventDefault();
    const next = value.trim().slice(0, 24);
    if (next) onSave(next);
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="nickname-modal" role="dialog" aria-modal="true" aria-labelledby="nickname-title">
        {initialValue && (
          <button className="icon-button modal-close" onClick={onClose} title="关闭" aria-label="关闭">
            <X size={18} />
          </button>
        )}
        <div className="nickname-modal__art" />
        <div className="nickname-modal__content">
          <span className="eyebrow">WELCOME, LITTLE BIRD</span>
          <h1 id="nickname-title">小鸟，怎么称呼你？</h1>
          <p>昵称会显示在点歌队列中，本机下次进入会自动记住。</p>
          <form onSubmit={submit}>
            <label htmlFor="nickname">昵称</label>
            <div className="input-shell input-shell--large">
              <UserRound size={18} />
              <input
                id="nickname"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                maxLength={24}
                autoFocus
                placeholder="输入你的昵称"
              />
            </div>
            <button className="button button--primary button--wide" disabled={!value.trim()}>
              进入点歌台 <Sparkles size={17} />
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}

function QueuePanel({ queue, currentNickname }) {
  const singing = queue.find((item) => item.status === 'singing');
  const waiting = queue.filter((item) => item.status === 'queued');

  return (
    <aside className="queue-panel">
      <div className="section-heading">
        <div>
          <span className="eyebrow">LIVE QUEUE</span>
          <h2>演唱队列</h2>
        </div>
        <span className="count-badge">{waiting.length} 首等待</span>
      </div>

      <div className={`now-playing ${singing ? '' : 'now-playing--empty'}`}>
        <div className="now-playing__disc"><Music2 size={18} /></div>
        <div className="now-playing__text">
          <span>正在演唱</span>
          <strong>{singing?.songTitle || '等待开唱'}</strong>
          <small>{singing ? `${singing.artist} · ${singing.nickname} 点歌` : '下一首也许就是你的'}</small>
        </div>
        {singing && <span className="equalizer"><i /><i /><i /></span>}
      </div>

      <div className="queue-list">
        {waiting.length === 0 ? (
          <EmptyState title="队列还是空的" detail="选一首喜欢的歌吧" />
        ) : waiting.map((item, index) => {
          const mine = normalized(item.nickname) === normalized(currentNickname);
          return (
            <div className={`queue-item ${mine ? 'queue-item--mine' : ''}`} key={item.id}>
              <span className="queue-item__number">{String(index + 1).padStart(2, '0')}</span>
              <div className="queue-item__song">
                <strong>{item.songTitle}</strong>
                <span>{item.artist}</span>
              </div>
              <div className="queue-item__viewer">
                {item.isVip && <VipBadge />}
                <span>{mine ? '我' : item.nickname}</span>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

export function ViewerPage() {
  const { state, loading, error } = useLiveState();
  const { toast, showToast } = useToast();
  const [nickname, setNickname] = useState(() => localStorage.getItem(NICKNAME_KEY) || '');
  const [showNickname, setShowNickname] = useState(() => !localStorage.getItem(NICKNAME_KEY));
  const [query, setQuery] = useState('');
  const [section, setSection] = useState('全部');
  const [filter, setFilter] = useState('all');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [requesting, setRequesting] = useState(null);
  const [mobileTab, setMobileTab] = useState('songs');

  const sections = useMemo(() => {
    if (!state) return [];
    return [...new Set(state.songs.map((song) => song.section).filter(Boolean))];
  }, [state]);

  const filteredSongs = useMemo(() => {
    if (!state) return [];
    const needle = normalized(query);
    return state.songs.filter((song) => {
      if (section !== '全部' && song.section !== section) return false;
      if (filter === 'chorus' && !song.isChorus) return false;
      if (needle && !normalized(`${song.title}${song.artist}${song.note}`).includes(needle)) return false;
      return true;
    });
  }, [filter, query, section, state]);

  const activeSongIds = useMemo(
    () => new Set(state?.queue.map((item) => item.songId) || []),
    [state],
  );

  function saveNickname(nextNickname) {
    localStorage.setItem(NICKNAME_KEY, nextNickname);
    setNickname(nextNickname);
    setShowNickname(false);
    showToast(`欢迎回来，${nextNickname}`);
  }

  async function requestSong(song) {
    if (!nickname) {
      setShowNickname(true);
      return;
    }
    setRequesting(song.id);
    try {
      const result = await api('/api/queue', {
        method: 'POST',
        body: { songId: song.id, nickname },
      });
      showToast(`${song.title} 已加入队列，你排在第 ${result.position} 位`);
    } catch (nextError) {
      showToast(nextError.message, 'error');
    } finally {
      setRequesting(null);
    }
  }

  function randomSong() {
    const available = filteredSongs.filter((song) => !activeSongIds.has(song.id));
    if (!available.length) return showToast('当前筛选下没有可点的歌曲', 'error');
    const song = available[Math.floor(Math.random() * available.length)];
    setQuery(song.title);
    setVisibleCount(PAGE_SIZE);
    document.querySelector('.song-catalog')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  if (loading) return <LoadingScreen />;
  if (!state) return <main className="fatal-state"><h1>暂时无法打开歌单</h1><p>{error}</p></main>;

  const vip = isVip(nickname, state.settings.vipNicknames);

  return (
    <div className="viewer-page">
      <header className="site-header">
        <Logo />
        <nav className="site-header__actions">
          <StatusBadge open={state.settings.requestsOpen} />
          <button className="viewer-chip" onClick={() => setShowNickname(true)}>
            <Avatar nickname={nickname} vip={vip} />
            <span>{nickname}</span>
            {vip && <VipBadge />}
            <ChevronDown size={14} />
          </button>
        </nav>
      </header>

      <section className="viewer-masthead">
        <div className="viewer-masthead__content">
          <span className="eyebrow">LINZI'S SONG STAGE</span>
          <h1>想听哪一首？</h1>
          <p>{state.settings.notice || '欢迎小鸟们来点歌'}</p>
          <div className="masthead-stats">
            <span><strong>{state.songs.length}</strong> 首歌</span>
            <span><strong>{state.queue.filter((item) => item.status === 'queued').length}</strong> 首排队中</span>
            <span><Clock3 size={15} /> 实时同步</span>
          </div>
        </div>
      </section>

      <div className="mobile-tabs" role="tablist">
        <button className={mobileTab === 'songs' ? 'active' : ''} onClick={() => setMobileTab('songs')}>
          <Music2 size={16} /> 点歌
        </button>
        <button className={mobileTab === 'queue' ? 'active' : ''} onClick={() => setMobileTab('queue')}>
          <ListMusic size={16} /> 队列
          <span>{state.queue.filter((item) => item.status === 'queued').length}</span>
        </button>
      </div>

      <main className="viewer-layout">
        <section className={`song-catalog ${mobileTab !== 'songs' ? 'mobile-hidden' : ''}`}>
          <div className="catalog-toolbar">
            <div className="input-shell search-shell">
              <Search size={19} />
              <input
                value={query}
                onChange={(event) => { setQuery(event.target.value); setVisibleCount(PAGE_SIZE); }}
                placeholder="搜索歌名、歌手"
                aria-label="搜索歌名或歌手"
              />
              {query && (
                <button className="icon-button" onClick={() => setQuery('')} title="清空搜索" aria-label="清空搜索">
                  <X size={16} />
                </button>
              )}
            </div>
            <button className="button button--secondary" onClick={randomSong}>
              <Dices size={17} /> 手气不错
            </button>
          </div>

          <div className="filter-row">
            <div className="segmented-control">
              <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>全部歌曲</button>
              <button className={filter === 'chorus' ? 'active' : ''} onClick={() => setFilter('chorus')}>合唱</button>
            </div>
            <div className="letter-filter" aria-label="按歌手首字母筛选">
              {['全部', ...sections].map((letter) => (
                <button key={letter} className={section === letter ? 'active' : ''} onClick={() => setSection(letter)}>
                  {letter}
                </button>
              ))}
            </div>
          </div>

          <div className="results-heading">
            <h2>{query ? `“${query}”的搜索结果` : section === '全部' ? '全部歌曲' : `${section} 字歌手`}</h2>
            <span>{filteredSongs.length} 首</span>
          </div>

          <div className="song-list">
            {filteredSongs.length === 0 ? (
              <EmptyState icon={Search} title="没有找到这首歌" detail="换个歌名或歌手试试" />
            ) : filteredSongs.slice(0, visibleCount).map((song) => {
              const queued = activeSongIds.has(song.id);
              return (
                <article className="song-row" key={song.id}>
                  <span className="song-row__note"><Music2 size={16} /></span>
                  <div className="song-row__title">
                    <strong>{song.title}</strong>
                    <span>{song.artist}</span>
                  </div>
                  <div className="song-row__tags">
                    {song.isChorus && <span className="badge">合唱</span>}
                    {song.note && <span className="badge badge--note">{song.note}</span>}
                  </div>
                  <button
                    className={`request-button ${queued ? 'request-button--queued' : ''}`}
                    disabled={queued || requesting === song.id || !state.settings.requestsOpen}
                    onClick={() => requestSong(song)}
                  >
                    {queued ? <><ListMusic size={15} /> 已在队列</> : <><Plus size={16} /> 点歌</>}
                  </button>
                </article>
              );
            })}
          </div>

          {visibleCount < filteredSongs.length && (
            <button className="load-more" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>
              再显示 {Math.min(PAGE_SIZE, filteredSongs.length - visibleCount)} 首
            </button>
          )}
        </section>

        <div className={`queue-column ${mobileTab !== 'queue' ? 'mobile-hidden' : ''}`}>
          <QueuePanel queue={state.queue} currentNickname={nickname} />
        </div>
      </main>

      <footer className="site-footer">
        <Logo compact />
        <span>为可爱的林子和小鸟们准备</span>
        <button onClick={() => { localStorage.removeItem(NICKNAME_KEY); setNickname(''); setShowNickname(true); }}>
          <LogOut size={14} /> 更换昵称
        </button>
      </footer>

      {showNickname && (
        <NicknameDialog
          initialValue={nickname}
          onSave={saveNickname}
          onClose={() => nickname && setShowNickname(false)}
        />
      )}
      <Toast toast={toast} />
    </div>
  );
}
