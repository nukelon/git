import http from 'https://unpkg.com/isomorphic-git@1.37.2/http/web/index.js';
import { Buffer as BufferPolyfill } from 'https://esm.sh/buffer@6.0.3';

if (!globalThis.Buffer) globalThis.Buffer = BufferPolyfill;
if (!globalThis.process) globalThis.process = { env: {} };

const git = window.git;
const LightningFS = window.LightningFS;

const STORAGE_KEY = 'browser-git-demo-settings-v3';
const FS_NAME = 'browser-git-demo-fs';

const state = {
  fs: null,
  pfs: null,
  busy: false,
};

const $ = (id) => document.getElementById(id);
const els = {
  repoUrl: $('repoUrl'),
  branch: $('branch'),
  dirName: $('dirName'),
  corsProxy: $('corsProxy'),
  username: $('username'),
  token: $('token'),
  authorName: $('authorName'),
  authorEmail: $('authorEmail'),
  commitMessage: $('commitMessage'),
  currentPath: $('currentPath'),
  newFilePath: $('newFilePath'),
  editor: $('editor'),
  fileList: $('fileList'),
  output: $('output'),
  saveSettingsBtn: $('saveSettingsBtn'),
  wipeFsBtn: $('wipeFsBtn'),
  cloneBtn: $('cloneBtn'),
  pullBtn: $('pullBtn'),
  refreshFilesBtn: $('refreshFilesBtn'),
  refreshFilesBtn2: $('refreshFilesBtn2'),
  showStatusBtn: $('showStatusBtn'),
  showLogBtn: $('showLogBtn'),
  loadFileBtn: $('loadFileBtn'),
  saveFileBtn: $('saveFileBtn'),
  createFileBtn: $('createFileBtn'),
  stageCurrentBtn: $('stageCurrentBtn'),
  deleteCurrentBtn: $('deleteCurrentBtn'),
  stageAllBtn: $('stageAllBtn'),
  commitBtn: $('commitBtn'),
  pushBtn: $('pushBtn'),
  clearLogBtn: $('clearLogBtn'),
};

function now() {
  return new Date().toLocaleTimeString();
}

function log(message, data) {
  const lines = [`[${now()}] ${message}`];
  if (data !== undefined) {
    if (typeof data === 'string') {
      lines.push(data);
    } else {
      lines.push(JSON.stringify(data, null, 2));
    }
  }
  els.output.textContent = `${lines.join('\n')}\n\n${els.output.textContent}`;
}

function setBusy(busy) {
  state.busy = busy;
  for (const button of document.querySelectorAll('button')) {
    button.disabled = busy;
  }
  els.clearLogBtn.disabled = false;
}

function normalizeDir(dir) {
  const trimmed = (dir || '').trim();
  if (!trimmed) return '/demo-repo';
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function getSettings() {
  return {
    repoUrl: els.repoUrl.value.trim(),
    branch: els.branch.value.trim() || 'main',
    dir: normalizeDir(els.dirName.value),
    corsProxy: els.corsProxy.value.trim(),
    username: els.username.value.trim(),
    token: els.token.value,
    authorName: els.authorName.value.trim(),
    authorEmail: els.authorEmail.value.trim(),
    commitMessage: els.commitMessage.value.trim(),
  };
}

function saveSettings() {
  const allSettings = getSettings();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(allSettings));
  log('已将包括 token 在内的设置保存到 localStorage。');
}

function loadSettings() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const saved = JSON.parse(raw);
    els.repoUrl.value = saved.repoUrl || '';
    els.branch.value = saved.branch || 'main';
    els.dirName.value = saved.dir || '/demo-repo';
    els.corsProxy.value = saved.corsProxy || 'https://cors.isomorphic-git.org';
    els.username.value = saved.username || '';
    els.authorName.value = saved.authorName || '';
    els.authorEmail.value = saved.authorEmail || '';
    els.commitMessage.value = saved.commitMessage || '';
    els.token.value = saved.token || '';
  } catch (error) {
    console.error(error);
  }
}

function ensureLibraryLoaded() {
  if (!git) {
    throw new Error('isomorphic-git 未成功加载。请检查 CDN 是否可访问。');
  }
  if (!LightningFS) {
    throw new Error('LightningFS 未成功加载。请检查 CDN 是否可访问。');
  }
  if (!globalThis.indexedDB) {
    throw new Error('当前浏览器环境没有可用的 IndexedDB。请改用普通窗口打开，并优先使用最新版 Chrome 或 Edge。');
  }
}

function ensureFs({ wipe = false } = {}) {
  ensureLibraryLoaded();
  try {
    state.fs = new LightningFS(FS_NAME, { wipe });
    state.pfs = state.fs.promises;
    log(wipe ? '浏览器文件系统已重建并清空。' : '浏览器文件系统已初始化。');
  } catch (error) {
    const extra = [
      '浏览器文件系统初始化失败。',
      '这通常是浏览器 IndexedDB 不可用，或当前 CDN 模块组合不兼容。',
      '优先用最新版 Chrome / Edge 的普通窗口测试；若仍失败，再更换网络或代理。',
    ].join(' ');
    throw new Error(`${extra} 原始错误：${error.message || String(error)}`);
  }
}

async function ensureDirExists(dir) {
  const parts = dir.split('/').filter(Boolean);
  let current = '';
  for (const part of parts) {
    current += `/${part}`;
    try {
      await state.pfs.mkdir(current);
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
  }
}

function getAuth() {
  const username = els.username.value.trim();
  const password = els.token.value;
  return {
    onAuth() {
      return { username, password };
    },
  };
}

function requireRepoUrl() {
  const repoUrl = els.repoUrl.value.trim();
  if (!repoUrl) {
    throw new Error('请先填写仓库 HTTPS URL。');
  }
  return repoUrl;
}

function requireFsReady() {
  if (!state.fs || !state.pfs) {
    ensureFs();
  }
}

async function run(label, task) {
  if (state.busy) return;
  setBusy(true);
  try {
    await task();
  } catch (error) {
    console.error(error);
    log(`${label} 失败`, error.message || String(error));
  } finally {
    setBusy(false);
  }
}

async function cloneRepo() {
  const settings = getSettings();
  requireRepoUrl();
  ensureFs();
  await ensureDirExists(settings.dir);
  log('开始 clone...', { repo: settings.repoUrl, branch: settings.branch, dir: settings.dir, corsProxy: settings.corsProxy });
  await git.clone({
    fs: state.fs,
    http,
    dir: settings.dir,
    url: settings.repoUrl,
    ref: settings.branch,
    singleBranch: true,
    depth: 10,
    corsProxy: settings.corsProxy || undefined,
    ...getAuth(),
    onProgress(evt) {
      if (evt?.phase) log(`clone progress: ${evt.phase}`, evt);
    },
  });
  log('clone 完成。');
  await refreshFileList();
}

async function pullRepo() {
  requireFsReady();
  const settings = getSettings();
  requireRepoUrl();
  log('开始 pull...', { dir: settings.dir, branch: settings.branch });
  const result = await git.pull({
    fs: state.fs,
    http,
    dir: settings.dir,
    ref: settings.branch,
    singleBranch: true,
    fastForwardOnly: true,
    author: {
      name: settings.authorName || settings.username || 'Browser Demo',
      email: settings.authorEmail || 'browser-demo@example.com',
    },
    corsProxy: settings.corsProxy || undefined,
    ...getAuth(),
    onProgress(evt) {
      if (evt?.phase) log(`pull progress: ${evt.phase}`, evt);
    },
  });
  log('pull 完成。', result);
  await refreshFileList();
}

async function readDirRecursive(rootDir, current = '') {
  const fullPath = current ? `${rootDir}/${current}` : rootDir;
  const entries = await state.pfs.readdir(fullPath);
  const files = [];
  for (const entry of entries) {
    if (entry === '.git') continue;
    const relativePath = current ? `${current}/${entry}` : entry;
    const nextPath = `${rootDir}/${relativePath}`;
    const stat = await state.pfs.stat(nextPath);
    if (stat.type === 'dir') {
      files.push(...await readDirRecursive(rootDir, relativePath));
    } else {
      files.push(relativePath);
    }
  }
  return files.sort((a, b) => a.localeCompare(b));
}

async function refreshFileList() {
  requireFsReady();
  const { dir } = getSettings();
  try {
    const files = await readDirRecursive(dir);
    renderFileList(files);
    log(`文件列表已刷新，共 ${files.length} 个文件。`);
  } catch (error) {
    renderFileList([]);
    throw error;
  }
}

function renderFileList(files) {
  els.fileList.innerHTML = '';
  if (!files.length) {
    const li = document.createElement('li');
    li.className = 'muted';
    li.textContent = '暂无文件。先 clone，或确认目录里已有仓库。';
    els.fileList.appendChild(li);
    return;
  }
  for (const file of files) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = file;
    btn.addEventListener('click', () => {
      els.currentPath.value = file;
      loadCurrentFile();
    });
    li.appendChild(btn);
    els.fileList.appendChild(li);
  }
}

async function loadCurrentFile() {
  requireFsReady();
  const { dir } = getSettings();
  const filepath = els.currentPath.value.trim();
  if (!filepath) throw new Error('请先填写当前文件路径。');
  const content = await state.pfs.readFile(`${dir}/${filepath}`, { encoding: 'utf8' });
  els.editor.value = content;
  log(`已加载文件 ${filepath}`);
}

async function ensureParentDirectories(dir, filepath) {
  const parts = filepath.split('/').filter(Boolean);
  parts.pop();
  let current = dir;
  for (const part of parts) {
    current = `${current}/${part}`;
    try {
      await state.pfs.mkdir(current);
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
  }
}

async function saveCurrentFile() {
  requireFsReady();
  const { dir } = getSettings();
  const filepath = els.currentPath.value.trim();
  if (!filepath) throw new Error('请先填写当前文件路径。');
  await ensureParentDirectories(dir, filepath);
  await state.pfs.writeFile(`${dir}/${filepath}`, els.editor.value, 'utf8');
  log(`已保存到工作区 ${filepath}`);
  await refreshFileList();
}

async function createNewFile() {
  const path = els.newFilePath.value.trim();
  if (!path) throw new Error('请先填写新建文件路径。');
  els.currentPath.value = path;
  els.editor.value = '';
  await saveCurrentFile();
  log(`已新建文件 ${path}`);
}

async function stageCurrentFile() {
  requireFsReady();
  const { dir } = getSettings();
  const filepath = els.currentPath.value.trim();
  if (!filepath) throw new Error('请先填写当前文件路径。');
  await git.add({ fs: state.fs, dir, filepath });
  log(`已 stage 当前文件 ${filepath}`);
}

async function deleteCurrentFile() {
  requireFsReady();
  const { dir } = getSettings();
  const filepath = els.currentPath.value.trim();
  if (!filepath) throw new Error('请先填写当前文件路径。');
  await state.pfs.unlink(`${dir}/${filepath}`);
  await git.remove({ fs: state.fs, dir, filepath });
  els.editor.value = '';
  log(`已删除并 stage ${filepath}`);
  await refreshFileList();
}

async function stageAllChanges() {
  requireFsReady();
  const { dir } = getSettings();
  const matrix = await git.statusMatrix({ fs: state.fs, dir });
  const actions = [];
  for (const row of matrix) {
    const [filepath, head, workdir, stage] = row;
    const deletedInWorkdir = head !== 0 && workdir === 0;
    const needsStageDelete = deletedInWorkdir && stage !== 0;
    const existsInWorkdir = workdir !== 0;
    const changed = head !== workdir || workdir !== stage;

    if (needsStageDelete) {
      await git.remove({ fs: state.fs, dir, filepath });
      actions.push(`remove ${filepath}`);
      continue;
    }
    if (existsInWorkdir && changed) {
      await git.add({ fs: state.fs, dir, filepath });
      actions.push(`add ${filepath}`);
    }
  }
  log('Stage all 完成。', actions.length ? actions : '没有检测到需要 stage 的变更。');
}

async function showStatus() {
  requireFsReady();
  const { dir } = getSettings();
  const matrix = await git.statusMatrix({ fs: state.fs, dir });
  log('statusMatrix', matrix.map(([filepath, head, workdir, stage]) => ({ filepath, head, workdir, stage })));
}

async function showLog() {
  requireFsReady();
  const { dir } = getSettings();
  const commits = await git.log({ fs: state.fs, dir, depth: 10 });
  const summary = commits.map((item) => ({
    oid: item.oid,
    message: item.commit.message,
    author: item.commit.author,
  }));
  log('最近提交', summary);
}

async function commitChanges() {
  requireFsReady();
  const { dir, authorName, authorEmail, commitMessage } = getSettings();
  if (!authorName || !authorEmail || !commitMessage) {
    throw new Error('请填写 Author Name、Author Email 和 Commit Message。');
  }
  const sha = await git.commit({
    fs: state.fs,
    dir,
    message: commitMessage,
    author: {
      name: authorName,
      email: authorEmail,
    },
  });
  log('commit 完成。', { sha });
}

async function pushRepo() {
  requireFsReady();
  const settings = getSettings();
  log('开始 push...', { branch: settings.branch, dir: settings.dir });
  const result = await git.push({
    fs: state.fs,
    http,
    dir: settings.dir,
    remote: 'origin',
    ref: settings.branch,
    corsProxy: settings.corsProxy || undefined,
    ...getAuth(),
    onProgress(evt) {
      if (evt?.phase) log(`push progress: ${evt.phase}`, evt);
    },
  });
  log('push 完成。', result);
}

function bindEvents() {
  els.saveSettingsBtn.addEventListener('click', saveSettings);
  els.wipeFsBtn.addEventListener('click', () => run('清空文件系统', async () => {
    ensureFs({ wipe: true });
    renderFileList([]);
    els.editor.value = '';
  }));
  els.cloneBtn.addEventListener('click', () => run('Clone', cloneRepo));
  els.pullBtn.addEventListener('click', () => run('Pull', pullRepo));
  els.refreshFilesBtn.addEventListener('click', () => run('刷新文件列表', refreshFileList));
  els.refreshFilesBtn2.addEventListener('click', () => run('刷新文件列表', refreshFileList));
  els.showStatusBtn.addEventListener('click', () => run('查看状态', showStatus));
  els.showLogBtn.addEventListener('click', () => run('查看提交记录', showLog));
  els.loadFileBtn.addEventListener('click', () => run('加载文件', loadCurrentFile));
  els.saveFileBtn.addEventListener('click', () => run('保存文件', saveCurrentFile));
  els.createFileBtn.addEventListener('click', () => run('新建文件', createNewFile));
  els.stageCurrentBtn.addEventListener('click', () => run('Stage 当前文件', stageCurrentFile));
  els.deleteCurrentBtn.addEventListener('click', () => run('删除当前文件', deleteCurrentFile));
  els.stageAllBtn.addEventListener('click', () => run('Stage 所有变更', stageAllChanges));
  els.commitBtn.addEventListener('click', () => run('Commit', commitChanges));
  els.pushBtn.addEventListener('click', () => run('Push', pushRepo));
  els.clearLogBtn.addEventListener('click', () => {
    els.output.textContent = '';
  });
}

function bootstrap() {
  loadSettings();
  ensureFs();
  bindEvents();
  renderFileList([]);
  log('页面已就绪。先填写仓库信息，然后点击 Clone。');
  log('已为浏览器环境注入 Buffer polyfill；这是为修复 isomorphic-git 的 Missing Buffer dependency。');
  log('注意：这个 demo 会把 token 保存到 localStorage，并直接用于浏览器端 HTTPS 认证，仅适合临时测试。');
}

bootstrap();
