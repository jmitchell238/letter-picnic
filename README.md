# Letter Picnic

Find the letter the game asks for ("Find B!") among the plates on a picnic blanket. An alphabet game for ages 4–6.

Play at https://jmitchell238.github.io/letter-picnic/. It's one of the games in [Arcade Hub](https://jmitchell238.github.io/arcade-hub/).

## Modes

| Mode | Letters | Choices | Finds |
|------|---------|---------|-------|
| Free Play | A–E | 3 | Endless |
| Easy | A–F | 4 | 5 |
| A Little More | A–M | 5 | 7 |
| Challenge | A–Z | 6 | 10 |

## Features

- Big letter plates on a gingham blanket
- The letter to find is shown on screen and can also be spoken, using the device's built-in speech
- A correct tap gets a munching sound and confetti
- A wrong tap gives a small shake and highlights the right letter. There are no lives.
- Mute and Calm motion settings
- Installable PWA that works offline after the first visit

There are no lives, ads, accounts or fail screens.

## Running locally

```bash
python3 -m http.server 8080
```

Then open http://localhost:8080. The service worker needs `localhost` or HTTPS.

Plain HTML, CSS and canvas with no build step.

## Tests

```bash
node tests/run.mjs
```

## Versioning

When you bump `GAME_VERSION` in `js/config.js`, set `CACHE` in `sw.js` to `'letter-picnic-' + GAME_VERSION`.

## License

Personal project for the family.
