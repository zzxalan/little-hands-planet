# Verification: 小手星球

## Passed automated checks
- Syntax checks for home.js, game.js and safety.js.
- Original car-wash harness: all 3 vehicles and soap/rinse/dry phases; replay; out-of-order tools; touch-type pointer taps and drags; two simultaneous pointers; pointer cancellation; vehicle change during pending transition; mute; keyboard alternative.
- Safety game: 10 tests covering every scene and required safe order, repeated actions, start gating, replay, immutable state, missing audio APIs, native keyboard controls, Chinese speech content, repeat narration, mute/unmute, voice cancellation, gesture audio start and page lifecycle.
- Site integrity: local assets and route links resolve; Chinese metadata; no external runtime assets or input/forms; real catalog filters including repeat clicks; preserved Site ID; QA harness excluded from deployment.

## Passed browser checks
- Homepage: actual images, both game entries, three category filters, navigation, parent-information disclosure.
- Car wash: pointer-dragged small car through all three stages; completed fire engine with keyboard; selected dump truck, reset/replayed, muted; local mute preference survived navigation. The AudioContext reached `running` after a gesture.
- Safety: started the game; stepped away then called the adult in all 3 scenes; adult arrival and visual state changes; replay; mute; repeat narration; native keyboard interaction in the tablet scene. The AudioContext reached `running` after start.
- Browser-rendered iframe QA at exact 768×1024, 1024×768 and 390×844 viewports: no horizontal overflow in either game, all play buttons remained inside the viewport. Primary safety actions were 64+ px high; car-wash tools were 100+ px high on phone portrait. Exact sizes use real browser layout, not estimates.
- Safety also checked at 844×390 landscape: core actions are visible together with the room, no horizontal overflow; parent footer can scroll slightly.
- Homepage checked at phone and tablet sizes: no horizontal overflow, game cards stack on phone and remain navigable.
- Observed browser errors were browser-extension metadata messages; none identified an application source error. These are independent of hosting authentication.

## Limits
- No physical iPad, Safari or actual touchscreen testing. Pointer-type multitouch is covered by the Node harness, not real hardware.
- This cloud browser has zero system speech voices, so audible Chinese narration could not be verified. Speech contents, API calls and cancellation are tested with stubs, and the full silent visual route was verified in-browser. Actual Chinese voice availability and audio output must be checked on the user's device. No claim of audible voice verification is made.
- Deployment readiness is verified by the native Sites result. Local QA does not bypass private Site authentication.

## Safety and privacy
- Only safe retreat and adult-help actions are available. Electrical objects are inert, with no manipulation, shock, rescue-touch, or real-world charging instruction.
- No feedback or idea collection entry, group link, fake community, child profile, analytics, advertising, purchase or data form.
- Gameplay needs no separate account. The Site is now public and can be opened by anyone with its link.

## 2026-11-11: three new toddler games
- Opened the hosted Site and synchronized the existing source before editing. Source was clean; current audience was verified as public. Retained the Site ID and audience, existing car-wash and electrical-safety implementation, and corrected the homepage's stale private-only description.
- Added Shape Home (形状回家), Little Garden (小小花园), and Peekaboo (谁藏起来了). Each has a complete replayable round, large pictorial controls, a visible non-reading instruction, optional Web Audio and device Chinese narration, and a safe parent note. No scores, timers, failure screen, data forms, account flow, third-party assets, submission/group links, or tracking were added.
- Chrome browser: completed all three rounds and replayed each; checked a shape mismatch with no loss, pointer-dragged a shape to its matching home, raised a curtain with a pointer swipe, used native Enter to reveal a friend, confirmed changed animal positions after replay, muted and verified persistence across new-game navigation, and continued the same peekaboo round after portrait/landscape changes.
- Real browser-rendered QA iframes: homepage plus all three games at 768×1024, 1024×768, 390×844, and 844×390. No horizontal overflow. Every primary game control stayed within its viewport. Shape pieces were 85×85 on phone portrait and 66×66 on phone landscape; flower/curtain touch regions were at least 109 px wide on portrait. Replay remained visible at round completion. This is viewport rendering, not device emulation.
- Homepage: all four filters worked, showing 5 total games, 2 habit games, 2 discovery games, and 1 safety game. Existing routes remain unchanged.
- Automated rules and lightweight DOM event tests cover starts, immutable game state, every full round and replay, malformed indices, wrong placement, repeated clicks, absent audio APIs and blocked localStorage, pointer dragging, second pointers, cancellation, out-of-board drops, upward swipes and click fallback.
- All JS syntax checks, original car-wash regression, 10 safety tests, 10 new-game tests, and expanded route/asset/privacy/catalog integrity checks passed. The temporary QA page was removed before publication.
- Limits: no physical touchscreen, iPad or Safari testing. Touch/pointer cancellation and multiple pointers are tested in the event harness, while browser interaction uses mouse/pointer input. The cloud Chrome browser reports zero system speech voices, so audible Chinese narration remains unverified. No microphone is used. Device narration availability and physical audio output depend on the visiting device.
