'use strict';
(function () {
  const scenes = [
    { title: '客厅里的小汽车', description: '小汽车停在插座附近。小手不碰插座哦。', art: 'socketScene', speech: '小汽车在插座附近。小手不碰插座，先走开，再叫大人。', end: '大人来啦！小汽车的事，交给大人。' },
    { title: '小皮球滚到哪里啦？', description: '小皮球在插排旁边。先不捡，找大人。', art: 'stripScene', speech: '小皮球在插排旁边。先不捡，小手不碰，走开，再叫大人。', end: '大人来啦！捡球的事，交给大人。' },
    { title: '小平板想休息了', description: '平板没电啦。小朋友不碰充电设备。', art: 'tabletScene', speech: '平板没电了。小朋友不碰充电设备。离开这里，叫大人帮忙。', end: '大人来啦！充电的事，交给大人。' }
  ];
  function initialState() { return { scene: 0, phase: 'start', muted: false, started: false }; }
  function transition(state, action) {
    if (action === 'mute') return { ...state, muted: !state.muted };
    if (action === 'start') return state.started ? state : { ...state, started: true };
    if (!state.started) return state;
    if (action === 'retreat' && state.phase === 'start') return { ...state, phase: 'safe' };
    if (action === 'call' && state.phase === 'safe') return { ...state, phase: 'adult' };
    if (action === 'next' && state.phase === 'adult') return { ...state, scene: (state.scene + 1) % scenes.length, phase: 'start' };
    return state;
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { initialState, transition, scenes };
  if (typeof document === 'undefined') return;
  let state = initialState();
  let audioContext;
  const get = id => document.getElementById(id);
  Object.defineProperty(window, 'safetyGameState', { get: () => Object.freeze({ ...state, audioState: audioContext?.state || 'not-created', voiceAvailable: Boolean(window.speechSynthesis?.getVoices().some(v => /^zh/i.test(v.lang))) }), configurable: false });
  function stopVoice() { try { window.speechSynthesis?.cancel(); } catch (_) { /* Text remains available. */ } }
  function speak(text) {
    stopVoice();
    if (state.muted || !window.speechSynthesis || !window.SpeechSynthesisUtterance) return;
    try { const voice = new window.SpeechSynthesisUtterance(text); voice.lang = 'zh-CN'; voice.rate = .85; voice.volume = .8; window.speechSynthesis.speak(voice); } catch (_) { /* No audio is required to play. */ }
  }
  function chime() {
    if (state.muted) return;
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      audioContext ||= new Audio();
      if (audioContext.state === 'suspended') { const result = audioContext.resume(); if (result?.catch) result.catch(() => {}); }
      const tone = audioContext.createOscillator(), gain = audioContext.createGain(), now = audioContext.currentTime;
      tone.type = 'sine'; tone.frequency.setValueAtTime(523, now); tone.frequency.exponentialRampToValueAtTime(659, now + .13);
      gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(.045, now + .025); gain.gain.exponentialRampToValueAtTime(.001, now + .28);
      tone.connect(gain); gain.connect(audioContext.destination); tone.start(now); tone.stop(now + .3);
    } catch (_) { /* Muted devices still have the full visual game. */ }
  }
  function render() {
    const scene = scenes[state.scene], safe = state.phase === 'safe', adult = state.phase === 'adult';
    get('sceneLabel').textContent = scene.title; get('sceneDescription').textContent = scene.description;
    get('roomTitle').textContent = scene.title; get('roomDesc').textContent = scene.description + (adult ? '大人已来到小朋友身边。' : safe ? '小朋友已走开，在安全的位置等大人。' : '小朋友还没有碰任何电气设备。');
    scenes.forEach(item => { get(item.art).setAttribute('style', item !== scene ? 'display:none' : 'display:inline'); });
    get('room').classList.toggle('retreated', safe || adult); get('room').classList.toggle('arrived', adult);
    get('dots').setAttribute('aria-label', `第${state.scene + 1}个场景，共3个`);
    Array.from(get('dots').children).forEach((dot, index) => dot.classList.toggle('current', index === state.scene));
    get('promptIcon').textContent = adult ? '♡' : safe ? '🙋' : '🖐';
    get('promptTitle').textContent = adult ? '大人来啦，安心等一等。' : safe ? '走开啦！现在叫大人。' : '小手不碰，先走开。';
    get('promptText').textContent = adult ? scene.end : safe ? '说一声：“请大人来帮忙！”' : '点点小脚印，退到安全的地方。';
    get('startOverlay').hidden = state.started;
    get('listen').disabled = !state.started;
    get('retreat').disabled = !state.started || safe || adult; get('retreat').hidden = adult;
    get('callAdult').disabled = !state.started || !safe; get('callAdult').hidden = adult;
    get('next').hidden = !adult;
    get('next').innerHTML = state.scene === 2 ? '<span aria-hidden="true">↻</span>再玩一遍' : '<span aria-hidden="true">☀</span>下一个小故事';
    get('mute').setAttribute('aria-pressed', String(state.muted)); get('mute').setAttribute('aria-label', state.muted ? '打开声音' : '关闭声音');
    const note = document.querySelector?.('.audio-note');
    if (note) note.textContent = state.muted ? '声音已关闭，也可以看图一起玩。' : '声音已开启，可用右上角按钮关闭。';
    get('mute').innerHTML = state.muted ? '♪ <span>声音关</span>' : '♫ <span>声音开</span>';
  }
  function currentVoice() { return state.phase === 'start' ? scenes[state.scene].speech : state.phase === 'safe' ? '走开啦。现在说，请大人来帮忙！' : scenes[state.scene].end + '小手不碰，走开，叫大人。'; }
  function act(action) {
    const previous = state; state = transition(state, action);
    if (state === previous) return;
    render();
    if (action === 'mute') { if (state.muted) { stopVoice(); try { audioContext?.suspend()?.catch(() => {}); } catch (_) {} } else if (state.started) speak(currentVoice()); return; }
    chime();
    speak(state.phase === 'safe' ? '走开啦。现在说，请大人来帮忙！' : state.phase === 'adult' ? scenes[state.scene].end + '小手不碰，走开，叫大人。' : scenes[state.scene].speech);
    // Move focus with the story, keeping keyboard and switch access complete.
    get(state.phase === 'safe' ? 'callAdult' : state.phase === 'adult' ? 'next' : 'retreat').focus({ preventScroll: true });
  }
  get('start').addEventListener('click', () => act('start'));
  get('listen').addEventListener('click', () => { if (state.started) { chime(); speak(currentVoice()); } });
  get('retreat').addEventListener('click', () => act('retreat'));
  get('callAdult').addEventListener('click', () => act('call'));
  get('next').addEventListener('click', () => act('next'));
  get('mute').addEventListener('click', () => act('mute'));
  window.addEventListener('pagehide', stopVoice);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopVoice(); });
  render();
})();
