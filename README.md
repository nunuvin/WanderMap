# WanderMap

WanderMap is a single-page map explorer and geolocation guessing game built with plain HTML/CSS/JavaScript.
It was made with Gemini Pro.

## Features

- Interactive map view with multiple layers
- Embedded Street View flow for selected map points
- Seeded game rounds with timed guessing mode
- In-page debug terminal and gameplay stats panel

## Run locally

No build step is required.

1. Clone the repository.
2. Open `index.html` in a browser.

If your browser blocks some local iframe behaviors, run a simple static server instead:

```bash
cd WanderMap
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Live demo

GitHub Pages: https://nunuvin.github.io/WanderMap/

## Project structure

- `index.html` – main application markup, styles, and JavaScript logic.
