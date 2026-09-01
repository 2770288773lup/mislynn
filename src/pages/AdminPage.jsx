import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Clipboard,
  Eye,
  EyeOff,
  History,
  Library,
  ListMusic,
  LockKeyhole,
  LogOut,
  Music2,
  Pause,
  Play,
  Plus,
  Radio,
  Save,
  Search,
  Settings,
  SkipForward,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import { api } from '../api.js';
import { EmptyState, LoadingScreen, Logo, StatusBadge, Toast, VipBadge } from '../components.jsx';
import { useLiveState, useToast } from '../hooks.js';

const TOKEN_KEY = 'linzi-admin-token';

function Login({ onLogin, errorMessage }) {
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState(errorMessage);
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await api('/api/admin/login', { method: 'POST', body: { password } });
      sessionStorage.setItem(TOKEN_KEY, result.token);
      onLogin(result.token);
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="admin-login">
      <section className="admin-login__panel">
        <Logo />
        <div className="admin-login__title">
          <span className="admin-login__icon"><LockKeyhole size={23} /></span>
          <div><span className="eyebrow">HOST CONSOLE</span><h1>主播控制台</h1></div>
        </div>
        <form onSubmit={submit}>
          <label htmlFor="admin-password">管理密码</label>
          <div className="input-shell input-shell--large">
            <LockKeyhole size={18} />
            <input
              id="admin-password"
              type={visible ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoFocus
              autoComplete="current-password"
              placeholder="输入主播密码"
            />
            <button type="button" className="icon-button" onClick={() => setVisible((value) => !value)} title={visible ? '隐藏密码' : '显示密码'}>
              {visible ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
          {error && <p className="form-error">{error}</p>}
          <button className="button button--primary button--wide" disabled={!password || busy}>
            {busy ? '正在登录…' : '进入控制台'}
          </button>
        </form>
      </section>
      <div className="admin-login__art" />
    </main>
  );
}

function QueueRow({ item, index, total, onAction, onCopy }) {
  return (
    <article className="admin-queue-row">
      <span className="admin-queue-row__index">{String(index + 1).padStart(2, '0')}</span>
      <div className="admin-queue-row__song">
        <strong>{item.songTitle}</strong>
        <span>{item.artist}</span>
      </div>
      <div className="admin-queue-row__requester">
        <UserRound size={14} /> {item.nickname} {item.isVip && <VipBadge />}
      </div>
      <div className="admin-queue-row__actions">
        <button className="icon-button" onClick={() => onCopy(item)} title="复制全民 K 歌搜索词"><Clipboard size={17} /></button>
        <button className="icon-button" disabled={index === 0} onClick={() => onAction(item.id, 'moveUp')} title="上移"><ArrowUp size={17} /></button>
        <button className="icon-button" disabled={index === total - 1} onClick={() => onAction(item.id, 'moveDown')} title="下移"><ArrowDown size={17} /></button>
        <button className="icon-button icon-button--play" onClick={() => onAction(item.id, 'start')} title="开始演唱"><Play size={17} /></button>
        <button className="icon-button icon-button--danger" onClick={() => onAction(item.id, 'remove')} title="移除"><Trash2 size={17} /></button>
      </div>
    </article>
  );
}

function ManualAdd({ songs, onAdd }) {
  const [query, setQuery] = useState('');
  const results = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('zh-CN');
    if (!needle) return [];
    return songs.filter((song) => `${song.title}${song.artist}`.toLocaleLowerCase('zh-CN').includes(needle)).slice(0, 6);
  }, [query, songs]);

  return (
    <div className="manual-add">
      <div className="input-shell">
        <Search size={17} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="手动插入歌曲" />
        {query && <button className="icon-button" onClick={() => setQuery('')} title="清空"><X size={15} /></button>}
      </div>
      {results.length > 0 && (
        <div className="manual-add__results">
          {results.map((song) => (
            <button key={song.id} onClick={() => { onAdd(song); setQuery(''); }}>
              <span><strong>{song.title}</strong><small>{song.artist}</small></span><Plus size={16} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function QueueView({ state, token, refresh, showToast }) {
  const singing = state.queue.find((item) => item.status === 'singing');
  const waiting = state.queue.filter((item) => item.status === 'queued');

  async function action(id, actionName) {
    try {
      await api(`/api/admin/queue/${id}`, { method: 'PATCH', token, body: { action: actionName } });
      await refresh();
    } catch (error) {
      showToast(error.message, 'error');
    }
  }

  async function copySearch(item) {
    await navigator.clipboard.writeText(`${item.songTitle} ${item.artist}`);
    showToast(`已复制：${item.songTitle} ${item.artist}`);
  }

  async function manualAdd(song) {
    try {
      await api('/api/admin/queue/manual', {
        method: 'POST', token, body: { songId: song.id, nickname: '林子' },
      });
      showToast(`${song.title} 已加入队列`);
      await refresh();
    } catch (error) {
      showToast(error.message, 'error');
    }
  }

  return (
    <div className="admin-dashboard-grid">
      <section className="admin-main-panel">
        <div className="admin-panel-heading">
          <div><span className="eyebrow">CURRENT</span><h2>正在演唱</h2></div>
          <a className="button button--secondary button--small" href="/overlay" target="_blank" rel="noreferrer"><Radio size={15} /> OBS 展示页</a>
        </div>
        {singing ? (
          <article className="admin-now-playing">
            <span className="admin-now-playing__art"><Music2 size={28} /></span>
            <div><span>NOW SINGING</span><h3>{singing.songTitle}</h3><p>{singing.artist} · {singing.nickname} 点歌</p></div>
            <div className="admin-now-playing__actions">
              <button className="button button--secondary" onClick={() => copySearch(singing)}><Clipboard size={16} /> 复制搜索词</button>
              <button className="button button--success" onClick={() => action(singing.id, 'done')}><Check size={16} /> 唱完</button>
              <button className="icon-button" onClick={() => action(singing.id, 'skip')} title="跳过"><SkipForward size={18} /></button>
            </div>
          </article>
        ) : (
          <div className="admin-now-playing admin-now-playing--empty"><Pause size={24} /><span>目前没有正在演唱的歌曲</span></div>
        )}

        <div className="admin-panel-heading admin-panel-heading--queue">
          <div><span className="eyebrow">UP NEXT</span><h2>待唱队列 <small>{waiting.length}</small></h2></div>
          <ManualAdd songs={state.songs.filter((song) => song.isActive)} onAdd={manualAdd} />
        </div>
        <div className="admin-queue-list">
          {waiting.length ? waiting.map((item, index) => (
            <QueueRow key={item.id} item={item} index={index} total={waiting.length} onAction={action} onCopy={copySearch} />
          )) : <EmptyState icon={ListMusic} title="待唱队列为空" detail="观众点歌后会实时出现在这里" />}
        </div>
      </section>

      <aside className="history-panel">
        <div className="admin-panel-heading"><div><span className="eyebrow">RECENT</span><h2>演唱记录</h2></div><History size={18} /></div>
        <div className="history-list">
          {state.history.length ? state.history.map((item) => (
            <div className="history-item" key={item.id}>
              <span className={`history-item__status ${item.status === 'done' ? 'done' : ''}`}>{item.status === 'done' ? <Check size={13} /> : <SkipForward size={13} />}</span>
              <div><strong>{item.songTitle}</strong><span>{item.artist} · {item.nickname}</span></div>
            </div>
          )) : <EmptyState title="还没有记录" />}
        </div>
      </aside>
    </div>
  );
}

function SongEditor({ song, token, onClose, onSaved, showToast }) {
  const [form, setForm] = useState(song || { title: '', artist: '', note: '', isChorus: false, isActive: true });
  const [saving, setSaving] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await api(song ? `/api/admin/songs/${song.id}` : '/api/admin/songs', {
        method: song ? 'PATCH' : 'POST', token, body: form,
      });
      showToast(song ? '歌曲信息已保存' : '歌曲已添加');
      await onSaved();
      onClose();
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <form className="song-editor" onSubmit={submit}>
        <button type="button" className="icon-button modal-close" onClick={onClose} title="关闭"><X size={18} /></button>
        <span className="eyebrow">SONG LIBRARY</span>
        <h2>{song ? '编辑歌曲' : '添加歌曲'}</h2>
        <label>歌名<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} autoFocus /></label>
        <label>歌手<input value={form.artist} onChange={(event) => setForm({ ...form, artist: event.target.value })} /></label>
        <label>备注<input value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="选填" /></label>
        <label className="check-row"><input type="checkbox" checked={form.isChorus} onChange={(event) => setForm({ ...form, isChorus: event.target.checked })} /> 合唱歌曲</label>
        <button className="button button--primary button--wide" disabled={saving || !form.title.trim() || !form.artist.trim()}><Save size={16} /> 保存</button>
      </form>
    </div>
  );
}

function LibraryView({ state, token, refresh, showToast }) {
  const [query, setQuery] = useState('');
  const [editor, setEditor] = useState(undefined);
  const filtered = useMemo(() => {
    const needle = query.toLocaleLowerCase('zh-CN').trim();
    return state.songs.filter((song) => !needle || `${song.title}${song.artist}`.toLocaleLowerCase('zh-CN').includes(needle));
  }, [query, state.songs]);

  async function toggle(song) {
    try {
      await api(`/api/admin/songs/${song.id}`, { method: 'PATCH', token, body: { isActive: !song.isActive } });
      showToast(song.isActive ? `${song.title} 已暂时下架` : `${song.title} 已恢复`);
      await refresh();
    } catch (error) {
      showToast(error.message, 'error');
    }
  }

  return (
    <section className="library-view">
      <div className="library-toolbar">
        <div><span className="eyebrow">SONG LIBRARY</span><h2>曲库管理 <small>{state.songs.length}</small></h2></div>
        <div className="library-toolbar__actions">
          <div className="input-shell"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索曲库" /></div>
          <button className="button button--primary" onClick={() => setEditor(null)}><Plus size={16} /> 添加歌曲</button>
        </div>
      </div>
      <div className="library-table">
        <div className="library-table__head"><span>歌曲</span><span>歌手</span><span>标签 / 备注</span><span>状态</span><span /></div>
        {filtered.slice(0, 150).map((song) => (
          <div className={`library-table__row ${song.isActive ? '' : 'is-inactive'}`} key={song.id}>
            <strong>{song.title}</strong>
            <span>{song.artist}</span>
            <span>{song.isChorus && <span className="badge">合唱</span>} {song.note}</span>
            <button className={`switch ${song.isActive ? 'active' : ''}`} onClick={() => toggle(song)} aria-label={song.isActive ? '下架歌曲' : '恢复歌曲'}><i /></button>
            <button className="button button--ghost button--small" onClick={() => setEditor(song)}>编辑</button>
          </div>
        ))}
      </div>
      {filtered.length > 150 && <p className="table-limit">当前显示前 150 条，请使用搜索缩小范围。</p>}
      {editor !== undefined && <SongEditor song={editor} token={token} onClose={() => setEditor(undefined)} onSaved={refresh} showToast={showToast} />}
    </section>
  );
}

function SettingsView({ state, token, refresh, showToast }) {
  const [notice, setNotice] = useState(state.settings.notice);
  const [maxPerViewer, setMaxPerViewer] = useState(state.settings.maxPerViewer);
  const [vipNicknames, setVipNicknames] = useState(state.settings.vipNicknames || []);
  const [vipNickname, setVipNickname] = useState('');

  useEffect(() => {
    setVipNicknames(state.settings.vipNicknames || []);
  }, [state.settings.vipNicknames]);

  async function save(values, successMessage) {
    try {
      await api('/api/admin/settings', { method: 'PATCH', token, body: values });
      showToast(successMessage);
      await refresh();
    } catch (error) {
      showToast(error.message, 'error');
    }
  }

  async function addVipNickname(event) {
    event.preventDefault();
    const next = vipNickname.trim().replace(/\s+/g, '').slice(0, 24);
    if (!next) return;
    const normalized = next.toLowerCase();
    if (vipNicknames.some((name) => name.toLowerCase() === normalized)) {
      showToast('这个昵称已经在 VIP 名单中', 'error');
      return;
    }
    await save({ vipNicknames: [...vipNicknames, next] }, 'VIP 小鸟已添加');
    setVipNickname('');
  }

  async function removeVipNickname(name) {
    await save({ vipNicknames: vipNicknames.filter((item) => item !== name) }, 'VIP 小鸟已移除');
  }

  return (
    <section className="settings-view">
      <div><span className="eyebrow">STAGE SETTINGS</span><h2>点歌设置</h2></div>
      <div className="settings-row">
        <div><strong>接收观众点歌</strong><span>关闭后歌单仍可浏览，但无法提交</span></div>
        <button className={`switch ${state.settings.requestsOpen ? 'active' : ''}`} onClick={() => save({ requestsOpen: !state.settings.requestsOpen }, state.settings.requestsOpen ? '已暂停点歌' : '已开放点歌')}><i /></button>
      </div>
      <div className="settings-row">
        <div><strong>普通小鸟排队上限</strong><span>VIP 昵称不受此限制，但仍正常排队</span></div>
        <div className="number-setting"><input type="number" min="1" max="20" value={maxPerViewer} onChange={(event) => setMaxPerViewer(event.target.value)} /><span>首</span><button className="button button--secondary button--small" onClick={() => save({ maxPerViewer: Number(maxPerViewer) }, '排队上限已保存')}>保存</button></div>
      </div>
      <div className="settings-row settings-row--notice">
        <div><strong>观众页公告</strong><span>显示在点歌台页首</span></div>
        <div className="notice-setting"><input maxLength="80" value={notice} onChange={(event) => setNotice(event.target.value)} /><button className="button button--secondary button--small" onClick={() => save({ notice }, '公告已更新')}>保存</button></div>
      </div>
      <div className="settings-row settings-row--vip">
        <div><strong>VIP 小鸟管理</strong><span>VIP 不受每人点歌上限限制，但仍按提交顺序正常排队</span></div>
        <div className="vip-manager">
          <form className="vip-manager__form" onSubmit={addVipNickname}>
            <input maxLength="24" value={vipNickname} onChange={(event) => setVipNickname(event.target.value)} placeholder="输入昵称后添加" />
            <button className="button button--secondary button--small" disabled={!vipNickname.trim()}><Plus size={14} /> 添加</button>
          </form>
          <div className="vip-manager__list">
            {vipNicknames.length ? vipNicknames.map((name) => (
              <span className="vip-manager__item" key={name}><span>{name}</span><button type="button" className="icon-button" onClick={() => removeVipNickname(name)} title={`移除 ${name}`} aria-label={`移除 ${name}`}><Trash2 size={14} /></button></span>
            )) : <span className="vip-manager__empty">暂未添加 VIP 小鸟</span>}
          </div>
        </div>
      </div>
      <div className="settings-note"><LockKeyhole size={18} /><div><strong>公网部署前更改管理密码</strong><span>通过服务器环境变量 ADMIN_PASSWORD 和 AUTH_SECRET 配置，不会暴露在网页中。</span></div></div>
    </section>
  );
}

export function AdminPage() {
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY) || '');
  const [tab, setTab] = useState('queue');
  const { state, error, loading, refresh } = useLiveState({ admin: true, token });
  const { toast, showToast } = useToast();

  function logout() {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken('');
  }

  if (!token) return <Login onLogin={setToken} />;
  if (loading) return <LoadingScreen />;
  if (!state) return <Login onLogin={setToken} errorMessage={error} />;

  const waitingCount = state.queue.filter((item) => item.status === 'queued').length;

  return (
    <div className="admin-page">
      <header className="admin-header">
        <Logo />
        <div className="admin-header__status"><StatusBadge open={state.settings.requestsOpen} /><span>{waitingCount} 首待唱</span></div>
        <button className="icon-button" onClick={logout} title="退出登录"><LogOut size={18} /></button>
      </header>
      <nav className="admin-nav">
        <button className={tab === 'queue' ? 'active' : ''} onClick={() => setTab('queue')}><ListMusic size={17} /> 演唱队列 {waitingCount > 0 && <span>{waitingCount}</span>}</button>
        <button className={tab === 'library' ? 'active' : ''} onClick={() => setTab('library')}><Library size={17} /> 曲库管理</button>
        <button className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}><Settings size={17} /> 点歌设置</button>
      </nav>
      <main className="admin-content">
        {tab === 'queue' && <QueueView state={state} token={token} refresh={refresh} showToast={showToast} />}
        {tab === 'library' && <LibraryView state={state} token={token} refresh={refresh} showToast={showToast} />}
        {tab === 'settings' && <SettingsView state={state} token={token} refresh={refresh} showToast={showToast} />}
      </main>
      <Toast toast={toast} />
    </div>
  );
}
