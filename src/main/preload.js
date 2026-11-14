'use strict';
const { contextBridge, ipcRenderer } = require('electron');

const on = (channel, cb) => {
  const handler = (_e, payload) => cb(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
};

contextBridge.exposeInMainWorld('api', {
  getState: () => ipcRenderer.invoke('get-state'),
  analyze: (p) => ipcRenderer.invoke('analyze', p),
  retry: () => ipcRenderer.invoke('retry'),
  setTone: (t) => ipcRenderer.invoke('set-tone', t),
  regenerate: (p) => ipcRenderer.invoke('regenerate', p),
  followup: (q) => ipcRenderer.invoke('followup', q),
  setAuto: (on) => ipcRenderer.invoke('set-auto', on),
  setProvider: (id) => ipcRenderer.invoke('set-provider', id),
  checkKiro: () => ipcRenderer.invoke('check-kiro'),
  // Kiro 로그인 화면. 로그인 주소는 메인 프로세스가 가진 값만 연다(인자 없음).
  kiroLogin: (method) => ipcRenderer.invoke('kiro-login-start', method),
  kiroLoginCancel: () => ipcRenderer.invoke('kiro-login-cancel'),
  kiroLoginOpen: () => ipcRenderer.invoke('kiro-login-open'),
  openKiroInstall: () => ipcRenderer.invoke('open-kiro-install'),
  skipLogin: () => ipcRenderer.invoke('skip-login'),
  setQuick: (on) => ipcRenderer.invoke('set-quick', on),
  copy: (t) => ipcRenderer.invoke('copy', t),
  hide: () => ipcRenderer.invoke('hide'),
  openLink: (u) => ipcRenderer.invoke('open-link', u),
  onEvent: (cb) => on('svc-event', cb),
  onState: (cb) => on('app-state', cb),
  onIncoming: (cb) => on('incoming', cb),
});