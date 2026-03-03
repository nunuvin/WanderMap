# WanderMap

WanderMap is a single-page map explorer and geolocation guessing game built with plain HTML/CSS/JavaScript.
It was made with Gemini Pro.

## Features

- Interactive map view with multiple layers
- Embedded Street View flow for selected map points
- Seeded game rounds with timed guessing mode
- In-page debug terminal and gameplay stats panel

## Live demo: [WanderMap](https://nunuvin.github.io/WanderMap/) on Github Pages
- the random street view can take a while if overpass api is timed out. check via [Overpass API](https://lz4.overpass-api.de/api/status)
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


## Project structure

- `index.html` – main application markup, styles, and JavaScript logic.
