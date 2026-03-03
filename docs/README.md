# WanderMap Architecture and Improvements

## Refactoring Overview
The codebase has been refactored from a monolithic `index.html` file into a modular structure to improve maintainability and separation of concerns.

- `index.html`: Contains only the HTML structure and loads the necessary CSS and JavaScript files.
- `src/styles.css`: Contains all custom CSS previously embedded in the HTML.
- `src/api.js`: Handles all external API interactions, including the Overpass API for road snapping and the undocumented Google API for Street View validation.
- `src/map.js`: Manages the main Leaflet map initialization, layers, and interactive double-click to view Street View.
- `src/game.js`: Contains the core game logic, including seeded random location generation, timer, map interaction for guessing, and result calculation.
- `src/main.js`: Handles global UI state, tab switching, debug terminal logging, and general event listeners.

## API Improvements
To solve the issue of long loading times and black screens in the random street view game mode, several improvements were made in `src/api.js` and `src/game.js`:

### Robust Overpass API Handling
The Overpass API is used to snap random coordinates to the nearest drivable road. To prevent hanging and timeouts:
1. **Endpoint Rotation**: We now rotate through multiple official Overpass endpoints (`lz4.overpass-api.de`, `z.overpass-api.de`, `overpass-api.de`) if one fails or times out.
2. **AbortController Timeout**: Requests to Overpass are hard-capped at 7 seconds. If a request hangs beyond this, it is aborted, treated as a 504 timeout, and retried on the next endpoint.
3. **Exponential Backoff & Rate Limit Handling**: If the API returns a 429 (Too Many Requests), the client queries the `/api/status` endpoint to accurately determine the wait time before the next available slot. If a 5xx error occurs, exponential backoff is applied before retrying.

### Zero-Key Street View Validation
Previously, the game would frequently drop players into locations with no Street View coverage, resulting in a black screen.
- **Pre-validation**: Before confirming a game location, the client now quietly pings the undocumented `GeoPhotoService.SingleImageSearch` endpoint. This endpoint verifies if a panorama exists at the given coordinates without requiring an API key.
- If the validation fails, the generator instantly discards the location and moves to the next attempt, drastically reducing the chance of a player encountering a missing image.

## Development sandbox
The `dev/` directory contains Node.js scripts used to develop and test the API resilience and validation logic in an isolated environment before porting it to the client-side JavaScript.
