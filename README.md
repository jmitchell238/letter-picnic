# Letter Picnic

Find the letter on a cozy picnic blanket — **Find B!** Spoken prompts, munch cheers, and soft hints. ABC fun for ages **4–6**.

**Play:** https://jmitchell238.github.io/letter-picnic/

Part of [Arcade Hub](https://jmitchell238.github.io/arcade-hub/).

## Modes

| Mode | Letters | Choices | Finds |
|------|---------|---------|-------|
| Free Play | A–E | 3 | Endless |
| Easy | A–F | 4 | 5 |
| A Little More | A–M | 5 | 7 |
| Challenge | A–Z | 6 | 10 |

## Features

- Gingham picnic blanket with big letter plates
- Prompt chip + optional spoken “Find B!” (device speech synthesis)
- Correct tap → munch + confetti celebration
- Wrong tap → soft shake + glow on the right letter (no lives)
- Sound mute + reduced motion
- Offline PWA after first visit
- Zero fail screens

## Stack

Static HTML / CSS / Canvas. No build step.

## Tests

```bash
node tests/run.mjs
```

VM-loaded unit tests cover letter range, round picks, hit testing, play flow (correct/wrong/complete), modes, save, and PWA shell checks.

## Versioning

`GAME_VERSION` in `js/config.js` ↔ `CACHE` in `sw.js`.

## Local preview

```bash
python3 -m http.server 8080
```

## Parents

No lives, ads, accounts, or fail screens. Educational without feeling like homework.

## License

Personal project for family Arcade Hub.
