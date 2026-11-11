'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { initialState, transition, scenes } = require('../dist/safety.js');
test('all three stories require retreat before adult and advance only after help', () => {
  let state = transition(initialState(), 'start');
  for (let i = 0; i < 3; i++) {
    assert.equal(state.scene, i); assert.equal(state.phase, 'start');
    assert.equal(transition(state, 'call'), state); assert.equal(transition(state, 'next'), state);
    state = transition(state, 'retreat'); assert.equal(state.phase, 'safe');
    assert.equal(transition(state, 'retreat'), state); assert.equal(transition(state, 'next'), state);
    state = transition(state, 'call'); assert.equal(state.phase, 'adult');
    assert.equal(transition(state, 'call'), state); assert.equal(transition(state, 'retreat'), state);
    state = transition(state, 'next');
  }
  assert.deepEqual(state, { ...initialState(), started: true }); assert.equal(scenes.length, 3);
});
test('mute persists across scenes and replay; reducer leaves prior state intact', () => {
  const original = initialState(); let state = transition(transition(original, 'start'), 'mute');
  assert.equal(original.muted, false); assert.equal(state.muted, true);
  for (let i = 0; i < 3; i++) for (const action of ['retreat', 'call', 'next']) state = transition(state, action);
  assert.equal(state.muted, true); assert.equal(state.scene, 0);
  assert.equal(transition(state, 'mute').muted, false);
});
function fixture(windowAPIs = {}) {
  const nodes = new Map(); let focused;
  function node(id) { if (!nodes.has(id)) nodes.set(id, { textContent: '', innerHTML: '', hidden: false, disabled: false, children: [], attrs: {}, handlers: {}, classList: { toggle() {} }, setAttribute(k, v) { this.attrs[k] = v; }, addEventListener(k, fn) { this.handlers[k] = fn; }, focus() { focused = id; } }); return nodes.get(id); }
  node('dots').children = [node('d1'), node('d2'), node('d3')];
  const documentHandlers = {}, windowHandlers = {};
  const document = { hidden: false, getElementById: node, addEventListener(name, fn) { documentHandlers[name] = fn; } };
  const window = { ...windowAPIs, addEventListener(name, fn) { windowHandlers[name] = fn; } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../dist/safety.js'), 'utf8'), { window, document });
  return { node, window, document, dispatchWindow(name) { windowHandlers[name](); }, dispatchDocument(name) { documentHandlers[name](); }, focused: () => focused, tap(id) { const button = node(id); if (!button.disabled && !button.hidden) button.handlers.click(); } };
}
test('render works without voice or audio APIs; safe controls and focus follow the story', () => {
  const app = fixture();
  assert.equal(app.node('retreat').disabled, true);
  app.tap('retreat'); assert.equal(app.window.safetyGameState.phase, 'start');
  app.tap('start'); assert.equal(app.window.safetyGameState.started, true);
  assert.equal(app.node('startOverlay').hidden, true);
  app.tap('listen');
  assert.equal(app.node('callAdult').disabled, true);
  assert.equal(app.node('socketScene').attrs.style, 'display:inline');
  assert.equal(app.node('stripScene').attrs.style, 'display:none');
  app.tap('retreat'); assert.equal(app.window.safetyGameState.phase, 'safe'); assert.equal(app.focused(), 'callAdult');
  app.tap('retreat'); assert.equal(app.window.safetyGameState.phase, 'safe');
  app.tap('callAdult'); assert.equal(app.window.safetyGameState.phase, 'adult'); assert.equal(app.focused(), 'next');
  app.tap('next'); assert.equal(app.window.safetyGameState.scene, 1); assert.equal(app.focused(), 'retreat');
  assert.equal(app.node('socketScene').attrs.style, 'display:none');
  assert.equal(app.node('stripScene').attrs.style, 'display:inline');
  app.tap('mute'); assert.equal(app.node('mute').attrs['aria-pressed'], 'true');
  app.tap('mute'); assert.equal(app.node('mute').attrs['aria-pressed'], 'false');
  assert.equal(Object.isFrozen(app.window.safetyGameState), true);
  assert.throws(() => { app.window.safetyGameState.scene = 2; }, TypeError);
  assert.throws(() => { app.window.safetyGameState = {}; }, TypeError);
});
test('keyboard controls are native buttons and story has accessible live guidance', () => {
  const html = fs.readFileSync(path.join(__dirname, '../dist/safety.html'), 'utf8');
  for (const id of ['start', 'listen', 'retreat', 'callAdult', 'next', 'mute']) assert.match(html, new RegExp(`<button id="${id}"[^>]*type="button"`));
  assert.match(html, /aria-live="polite"/); assert.match(html, /href="\.\/"/);
  assert.doesNotMatch(html, /onclick=|tabindex="-1"/);
});

test('start is required and repeated start is idempotent', () => {
  const idle = initialState();
  for (const action of ['retreat', 'call', 'next']) assert.equal(transition(idle, action), idle);
  const playing = transition(idle, 'start');
  assert.equal(playing.started, true);
  assert.equal(transition(playing, 'start'), playing);
  const safe = transition(playing, 'retreat');
  assert.equal(transition(safe, 'start'), safe);
});

function voiceFixture() {
  const events = [], spoken = [], queue = [], audio = [];
  const synthesis = {
    getVoices: () => [{ lang: 'zh-CN', name: '测试中文声音' }],
    cancel() { events.push('cancel'); queue.length = 0; },
    speak(utterance) { events.push('speak'); spoken.push(utterance); queue.push(utterance); }
  };
  class AudioContext {
    constructor() { this.state = 'suspended'; this.currentTime = 0; this.destination = {}; audio.push('create'); }
    resume() { audio.push('resume'); this.state = 'running'; return Promise.resolve(); }
    suspend() { audio.push('suspend'); this.state = 'suspended'; return Promise.resolve(); }
    createOscillator() { return { frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, start() { audio.push('tone'); }, stop() {} }; }
    createGain() { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
  }
  const app = fixture({ speechSynthesis: synthesis, SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } }, AudioContext });
  return { ...app, events, spoken, queue, audio, latest: () => spoken.at(-1) };
}

test('start unlocks audio and each scene speaks Chinese safe-action guidance', () => {
  const app = voiceFixture();
  assert.equal(app.spoken.length, 0); assert.equal(app.audio.length, 0);
  assert.equal(app.window.safetyGameState.audioState, 'not-created');
  assert.equal(app.window.safetyGameState.voiceAvailable, true);
  app.tap('start');
  assert.deepEqual(app.audio, ['create', 'resume', 'tone']);
  assert.equal(app.window.safetyGameState.audioState, 'running');
  assert.equal(app.latest().lang, 'zh-CN'); assert.equal(app.latest().text, scenes[0].speech);
  const firstCount = app.spoken.length;
  app.node('start').handlers.click(); assert.equal(app.spoken.length, firstCount);
  for (let i = 0; i < 3; i++) {
    assert.equal(app.latest().text, scenes[i].speech);
    app.tap('retreat'); assert.equal(app.latest().text, '走开啦。现在说，请大人来帮忙！');
    app.tap('callAdult'); assert.equal(app.latest().text, scenes[i].end + '小手不碰，走开，叫大人。');
    app.tap('next'); assert.equal(app.latest().text, scenes[(i + 1) % 3].speech);
  }
  assert.ok(app.spoken.every(voice => voice.lang === 'zh-CN'));
  assert.equal(app.window.safetyGameState.scene, 0);
});

test('listen repeats the current prompt without changing game state or accumulating stale speech', () => {
  const app = voiceFixture(); app.tap('start');
  for (const action of [null, 'retreat', 'callAdult', 'next']) {
    if (action) app.tap(action);
    const before = JSON.stringify(app.window.safetyGameState), text = app.latest().text, count = app.spoken.length;
    app.tap('listen'); app.tap('listen');
    assert.equal(JSON.stringify(app.window.safetyGameState), before);
    assert.equal(app.spoken.length, count + 2); assert.equal(app.latest().text, text);
    assert.equal(app.queue.length, 1); assert.equal(app.queue[0], app.latest());
  }
  // Every fresh utterance cancels pending audio before enqueueing its replacement.
  assert.equal(app.events.length, app.spoken.length * 2);
  for (let i = 0; i < app.events.length; i += 2) assert.deepEqual(app.events.slice(i, i + 2), ['cancel', 'speak']);
});

test('mute cancels speech and suspends audio; muted actions remain playable; unmute speaks current guidance', () => {
  const app = voiceFixture(); app.tap('start'); app.tap('mute');
  assert.equal(app.queue.length, 0); assert.equal(app.events.at(-1), 'cancel');
  assert.equal(app.window.safetyGameState.audioState, 'suspended');
  const spoken = app.spoken.length, tones = app.audio.filter(x => x === 'tone').length;
  app.tap('listen'); app.tap('retreat'); app.tap('callAdult'); app.tap('next');
  assert.equal(app.window.safetyGameState.scene, 1); assert.equal(app.spoken.length, spoken);
  assert.equal(app.audio.filter(x => x === 'tone').length, tones); assert.equal(app.queue.length, 0);
  app.tap('mute'); assert.equal(app.window.safetyGameState.muted, false);
  assert.equal(app.spoken.length, spoken + 1); assert.equal(app.latest().text, scenes[1].speech);
  app.tap('listen'); assert.equal(app.window.safetyGameState.audioState, 'running');
  assert.equal(app.audio.filter(x => x === 'resume').length, 2);
});

test('starting muted avoids audio creation until sound is enabled', () => {
  const app = voiceFixture(); app.tap('mute'); app.tap('start');
  assert.equal(app.window.safetyGameState.started, true); assert.equal(app.spoken.length, 0); assert.equal(app.audio.length, 0);
  app.tap('mute'); assert.equal(app.latest().text, scenes[0].speech);
});

test('pagehide and hidden visibilitychange cancel voice; visible event does not interrupt', () => {
  const app = voiceFixture(); app.tap('start');
  const count = app.events.length;
  app.dispatchDocument('visibilitychange'); assert.equal(app.events.length, count); assert.equal(app.queue.length, 1);
  app.document.hidden = true; app.dispatchDocument('visibilitychange');
  assert.equal(app.queue.length, 0); assert.equal(app.events.at(-1), 'cancel');
  app.document.hidden = false; app.tap('listen'); assert.equal(app.queue.length, 1);
  app.dispatchWindow('pagehide'); assert.equal(app.queue.length, 0); assert.equal(app.events.at(-1), 'cancel');
});
