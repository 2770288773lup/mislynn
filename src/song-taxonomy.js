export const LANGUAGE_FILTERS = [
  { value: 'all', label: '全部语言' },
  { value: '国语', label: '国语' },
  { value: '粤语', label: '粤语' },
  { value: '日语', label: '日语' },
  { value: '英语', label: '英语' },
  { value: '其他', label: '其他语言' },
];

export const GENRE_FILTERS = [
  { value: 'all', label: '全部曲风' },
  { value: '流行', label: '流行' },
  { value: '古风', label: '古风国风' },
  { value: '摇滚', label: '摇滚' },
  { value: '民谣', label: '民谣' },
  { value: '经典', label: '经典老歌' },
  { value: '唱跳', label: '唱跳' },
  { value: '动漫游戏', label: '动漫游戏' },
];

function compact(value) {
  return String(value || '').toLocaleLowerCase('zh-CN').replace(/[\s·・,，、/()（）._-]+/g, '');
}

function hasArtist(artist, candidates) {
  const value = compact(artist);
  return candidates.some((candidate) => value.includes(compact(candidate)));
}

function hasTitle(title, candidates) {
  const value = compact(title);
  return candidates.some((candidate) => value === compact(candidate));
}

// These singers' songs in the current catalogue are predominantly Cantonese.
// Mixed-language singers are handled by the per-song rules below instead.
const CANTONESE_ARTISTS = [
  'AGA', '阿梨粤', 'Beyond', '蔡国权', '侧田', '陈百强', '陈慧娴', '邓丽欣',
  '关淑怡', '李克勤', '林欣彤', '林志美', '谭咏麟', '汤宝如', '汪明荃',
  '王馨平', '卫兰', '吴若希', '吴雨霏', '谢安琪', '郑融', '郑伊健',
  '钟嘉欣', '周慧敏', '何仟仟', '彭羚', '刘美君', '陈僖仪', '王苑之',
];

const CANTONESE_BY_ARTIST = new Map([
  ['陈小春', ['献世', '相依为命', '友情岁月', '犯贱']],
  ['陈奕迅', ['富士山下', '最佳损友', '圣诞结', '单车', '明年今日', '一丝不挂', '白玫瑰', '不如不见', '裙下之臣', '人来人往', '陀飞轮']],
  ['古巨基', ['爱得太迟', '爱与诚', '必杀技']],
  ['卢冠廷', ['一生所爱']],
  ['梅艳芳', ['梦伴', '相爱很难', '夕阳之歌']],
  ['容祖儿', ['心淡', '习惯失恋']],
  ['Twins', ['下一站天后', '死性不改']],
  ['王菲', ['容易受伤的女人', '百年孤寂', '爱与痛的边缘', '笑忘书', '约定', '给自己的情书', '暧昧']],
  ['王力宏', ['好心分手']],
  ['薛凯琪', ['慕容雪', '南瓜车', '苏州河']],
  ['杨千嬅', ['可惜我是水瓶座', '处处吻', '野孩子', '小城大事', '捞月亮的人', '假如让我说下去', '少女的祈祷', '勇']],
  ['张国荣', ['追', '我']],
  ['张敬轩', ['春秋']],
  ['张明敏', ['焚情']],
  ['张学友', ['这么近那么远', '李香兰', '每天爱你多一些', '你的名字我的姓氏']],
  ['郑秀文', ['终身美丽', '独家试唱', '唉声叹气']],
  ['周华健', ['神话情话']],
]);

const GAME_ANIME_ARTISTS = ['绝区零', '花玲', '张安琪', '沐霏'];
const GAME_ANIME_TITLES = [
  '乐园游梦记', '闪亮', '我不曾忘记', '天地劫之幽城再临', '亲爱的旅人啊',
  '光るなら（粤语）', 'i really want to stay at your house（粤语）', '巴拉莱卡',
];

const GUOFENG_ARTISTS = [
  '等什么君', '双笙', '以冬', '银临', '音频怪物', '平生不晚', '一棵小葱',
  '黄诗扶', '小时姑娘', 'HITA', 'Aki阿杰', 'CRITTY', '董真', '张曦匀',
  '秋雪', '祖娅纳惜', '丸子呦', '张晓涵', '张晓棠',
];
const GUOFENG_TITLES = [
  '赤伶', '鸳鸯戏', '惊鸿一面', '星河叹', '三拜红尘凉', '玄鸟', '杀破狼',
  '青玉案·元夕', '夜光杯', '昨夜风今宵月', '虞兮叹', '不问天', '广寒宫',
  '牵丝戏', '浮生未歇', '青花', '烟花易冷', '若梦', '爱晚亭边', '同簪',
  '蓝桥玉杵', '世花梦镜', '孽海记', '黄梅戏', '相思遥', '煨酒忽忆旧关河',
  '挑兰灯', '梨园双', '游京', '十年人间', '醉梦仙霖', '中元夜话破相',
];

const ROCK_ARTISTS = ['Beyond', '飞儿乐队', 'F.I.R.', '黑屋乐队', '苏打绿'];
const ROCK_TITLES = ['Super Star', '破茧', '火力全开', '易燃易爆炸', '燕尾蝶'];

const FOLK_ARTISTS = ['陈粒', '陈绮贞', '柳爽', '老狼', '王筝', '任素汐', '安与骑兵'];
const FOLK_TITLES = ['南屏晚钟', '乡间小路', '漠河舞厅', '胡广生', '我要你', '红山果'];

const CLASSIC_ARTISTS = ['蔡琴', '邓丽君', '毛阿敏', '宋祖英', '汪明荃', '叶丽仪', '周璇'];
const CLASSIC_TITLES = ['夜上海', '上海滩', '大地飞歌', '昨夜星辰又星辰', '新不了情'];

const DANCE_ARTISTS = ['蔡依林', 'BY2', 'S.H.E'];
const DANCE_TITLES = [
  '不如跳舞', '热爱', '彩虹的微笑', '睫毛弯弯', 'DaDaDa', '眉飞色舞',
  '火', '维多利亚的秘密', 'High歌', '爱河', '大地飞歌',
];

function declaredLanguages(song) {
  const value = song.languages ?? song.language;
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value !== 'string' || !value.trim()) return null;
  if (/国\s*[\/、]\s*粤/.test(value)) return ['国语', '粤语'];
  return value.split(/[\/、,，]/).map((item) => item.trim()).filter(Boolean);
}

export function inferLanguages(song) {
  const declared = declaredLanguages(song);
  if (declared?.length) return [...new Set(declared)];

  const title = String(song.title || '');
  const note = String(song.note || '');
  const markers = `${title}${note}`;
  if (/国\s*[\/、]\s*粤/.test(markers)) return ['国语', '粤语'];
  if (/粤语|广东话|廣東話/i.test(markers)) return ['粤语'];
  if (/日语|日文/i.test(markers)) return ['日语'];
  if (/英语|英文/i.test(markers)) return ['英语'];
  if (/韩语|韩文|闽南语|台语|泰语|俄语/i.test(markers)) return ['其他'];

  const artist = String(song.artist || '');
  for (const [candidate, titles] of CANTONESE_BY_ARTIST) {
    if (hasArtist(artist, [candidate]) && hasTitle(title, titles)) return ['粤语'];
  }
  if (hasArtist(artist, CANTONESE_ARTISTS)) return ['粤语'];

  // Japanese scripts are a reliable signal when the title is not explicitly a Cantonese cover.
  if (/[\u3040-\u30ff]/.test(title)) return ['日语'];
  return ['国语'];
}

export function inferGenre(song) {
  if (typeof song.genre === 'string' && song.genre.trim()) return song.genre.trim();

  const artist = String(song.artist || '');
  const title = String(song.title || '');
  if (hasArtist(artist, GAME_ANIME_ARTISTS) || hasTitle(title, GAME_ANIME_TITLES)) return '动漫游戏';
  if (hasArtist(artist, GUOFENG_ARTISTS) || hasTitle(title, GUOFENG_TITLES)) return '古风';
  if (hasArtist(artist, ROCK_ARTISTS) || hasTitle(title, ROCK_TITLES)) return '摇滚';
  if (hasArtist(artist, FOLK_ARTISTS) || hasTitle(title, FOLK_TITLES)) return '民谣';
  if (hasArtist(artist, CLASSIC_ARTISTS) || hasTitle(title, CLASSIC_TITLES)) return '经典';
  if (hasArtist(artist, DANCE_ARTISTS) || hasTitle(title, DANCE_TITLES)) return '唱跳';
  return '流行';
}

export function classifySong(song) {
  return {
    ...song,
    languages: inferLanguages(song),
    genre: inferGenre(song),
  };
}

