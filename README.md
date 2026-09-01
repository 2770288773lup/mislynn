# 可爱的林子 · 林子的歌单

一个面向直播间观众的实时点歌台。观众进入链接后输入一次昵称，即可搜索歌单并点歌；主播在管理台控制演唱队列，OBS 可通过透明网页叠加显示当前歌曲。

## 页面

- 观众点歌：部署域名根路径 `/`
- 主播管理台：`/admin`
- OBS 透明叠加：`/overlay`
- OBS 全背景叠加：`/overlay?mode=full`
- 健康检查：`/api/health`

## 已实现规则

- 普通小鸟最多同时有 2 首处于“排队/演唱中”的歌曲，可在管理台调整。
- VIP 昵称为 `lclol` 或 `lol`（不区分大小写），不受个人两首限制，但仍按正常顺序入队，不能置顶。
- 同一首歌在队列中已有“排队/演唱中”记录时不可重复点歌。
- 管理台支持开始、完成、跳过、移除、上下移动、手动插入歌曲和维护歌单。
- 队列与设置保存在 SQLite；生产环境必须将 `DATA_DIR` 指向持久化磁盘。

## 本地运行

```bash
npm ci
copy .env.example .env
# 编辑 .env，至少设置 ADMIN_PASSWORD 和 AUTH_SECRET
npm run build
npm start
```

然后打开 `http://localhost:3000/`。默认管理员密码仅用于本地开发，公网部署必须替换。

## 公网部署（推荐 Railway / Fly.io / VPS）

GitHub 私人仓库可以直接作为部署源。平台需要能运行 Docker 或 Node.js，并提供一个持久化卷：

| 环境变量 | 生产值 | 说明 |
| --- | --- | --- |
| `PORT` | 平台自动注入，默认 `3000` | 服务端口 |
| `ADMIN_PASSWORD` | 自定义高强度密码 | `/admin` 登录密码 |
| `AUTH_SECRET` | 随机长字符串 | 管理员令牌签名密钥 |
| `DATA_DIR` | `/app/data` | SQLite 数据目录，必须挂载持久盘 |

### Railway

1. 在 Railway 新建 Project，选择 **Deploy from GitHub Repo**，授权访问此私人仓库 `2770288773lup/mislynn`。
2. 服务设置中添加变量 `ADMIN_PASSWORD`、`AUTH_SECRET`、`DATA_DIR=/app/data`。
3. 添加 Volume，挂载路径填写 `/app/data`（至少 1 GB）。
4. Railway 会按仓库中的 `Dockerfile` 构建并生成 HTTPS 域名。部署完成后，用该域名访问 `/`、`/admin` 和 `/overlay`。

### Fly.io 或 VPS

使用仓库中的 `Dockerfile` 构建镜像，运行时设置上述环境变量，并把持久化卷挂载到 `/app/data`。反向代理到容器 `3000` 端口并启用 HTTPS；Socket.IO 需要允许 WebSocket 升级。

### Cloudflare Workers + Durable Objects

仓库已经包含 `wrangler.jsonc` 和 Worker 后端。完成 `wrangler login` 后，在项目根目录执行：

```bash
npm run build:cf
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put AUTH_SECRET
npx wrangler deploy
```

首次部署会创建名为 `linzi-song-stage` 的 Worker 和一个名为 `global` 的 Durable Object 实例。Worker Assets 会同时托管前端页面，Durable Object 负责共享队列、设置和 WebSocket 广播，因此不需要 `DATA_DIR` 或 SQLite 文件卷。生产环境请把 `ADMIN_PASSWORD` 和 `AUTH_SECRET` 作为 Cloudflare Secret 保存，不要写入仓库。

## 管理台首次使用

打开 `https://你的域名/admin`，输入 `ADMIN_PASSWORD`。主播常用操作在“当前队列”中完成；“复制”按钮可复制“歌名 - 歌手”，直接粘贴到全民 K 歌搜索。

## OBS 设置

在 OBS 添加“浏览器”来源，URL 填 `https://你的域名/overlay`，宽高按直播画布设置，勾选“刷新浏览器时清空缓存”以外的默认选项即可。该页面会通过 Socket.IO 自动同步当前演唱与排队列表。

## 重要说明

- GitHub 私仓只保存代码和歌单，不会提供长期运行的公网地址。
- 免费临时隧道（例如 Pinggy/LocalTunnel）会过期，电脑关机后也会失效，不适合作为长期直播入口。
- SQLite 数据库包含队列和设置，请定期备份持久卷中的 `linzi-song-stage.db`。
