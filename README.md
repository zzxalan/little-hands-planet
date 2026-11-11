# 小手星球

A touch-first parent-child game hub in Chinese, designed around age three. Builds on the existing 车车洗澡 Site and preserves its Site identity.

## Pages
- `dist/index.html`: illustrated home, five playable game entries, category filters, parent guidance and clear privacy/access information.
- `dist/wash.html`: original three-vehicle car wash, soap/rinse/dry, forgiving touch gestures, replay, mute, added Chinese device voice prompts and home navigation.
- `dist/safety.html`: three supervised safety stories. The only action path is do not touch, step away, ask an adult. Hazard objects are inert. No shock, unsafe handling, rescue or electrical procedures.

No advertising, purchases, child accounts, data forms, feedback collection, fabricated community or group links. No analytics or third-party runtime assets. The car game stores only its mute preference locally. Games need no separate registration. The current hosted website is publicly accessible; this source repository is private.

The game catalog contains five games.

- `dist/shapes.html`: match three shapes by tapping or dragging.
- `dist/garden.html`: water three plants from seed to flower.
- `dist/peekaboo.html`: tap or swipe curtains to greet three animals; replay rotates their positions.

## Develop
Buildless static assets are in `dist/`. No dependencies or build needed. Preview with `python3 -m http.server 8000 --directory dist` and open `http://localhost:8000`.

## Tests
```
node --check dist/game.js
node --check dist/safety.js
node --check dist/home.js
node --check dist/play-state.js
node --check dist/play.js
node tests/game.test.cjs
node --test tests/safety.test.cjs
node tests/site.test.cjs
node --test tests/play.test.cjs
```

`tests/responsive.html` is a local QA harness. To use, temporarily copy it into `dist/qa.html`. Remove it before publishing. See `tests/VERIFICATION.md` for actual checked coverage and limitations.

## Voice
Chinese voice prompts use the device's SpeechSynthesis API after a user gesture. No remote audio provider, microphone permission or recording. Support depends on available Chinese system voices. Text and illustrations remain fully usable without speech. Sound effects use Web Audio and can be muted.

New-game tests use lightweight DOM stubs for state and pointer logic, not real browser layout or speech rendering. Chinese speech availability and pronunciation are controlled by the operating system and installed voices; silent play remains available.

## Hosted website

https://cheche-bubble-bath-moon.wavy-loom-3931.chatgpt.site

Source exported from the published Sites version 3, commit `a936149a8cd67b70a683cd45bcb512d1fcf0afa0`. The GitHub copy retains the original static game assets and tests.
