// api.js

let countSat = 0, countHybrid = 0, countOsm = 0, countSv = 0;

// Round-robin endpoints to spread load and avoid 429s
const overpassEndpoints = [
    'https://lz4.overpass-api.de/api/interpreter',
    'https://z.overpass-api.de/api/interpreter',
    'https://overpass-api.de/api/interpreter'
];
let currentOverpassIndex = 0;

async function checkOverpassStatus() {
    try {
        const res = await fetch('https://lz4.overpass-api.de/api/status');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();

        const availableMatch = text.match(/(\d+)\s+slots available now/i);
        if (availableMatch && parseInt(availableMatch[1]) > 0) {
            return { available: true, waitMs: 0 };
        }

        const waitMatch = text.match(/Slot available after:\s+([^\n\r]+)/i);
        const timeMatch = text.match(/Current time:\s+([^\n\r]+)/i);

        if (waitMatch && timeMatch) {
            const serverTime = new Date(timeMatch[1].trim()).getTime();
            const availableTime = new Date(waitMatch[1].trim()).getTime();

            let waitMs = availableTime - serverTime;
            if (waitMs < 0) waitMs = 1000;
            return { available: false, waitMs: waitMs + 2000 };
        }

        return { available: true, waitMs: 0 };
    } catch (e) {
        logDebug(`Status check failed: ${e.message}`, 'warn');
        return { available: 'unknown', waitMs: 0 };
    }
}

async function snapToNearestRoadForGame(lat, lng, radius, genId) {
    // 30km radius is too large for Overpass and causes 504 Gateway Timeouts.
    // Instead, we use a much smaller radius (e.g. 5000m) to keep the query fast.
    const cappedRadius = Math.min(radius, 5000);

    // We only need the first geometry to find a single valid road
    const q = `[out:json][timeout:5];way(around:${cappedRadius},${lat.toFixed(5)},${lng.toFixed(5)})["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential)$"];out geom 1;`;

    countOsm++;
    document.getElementById('stat-osm').innerText = countOsm;

    let attempt = 0;
    let maxAttempts = 3;

    while (attempt < maxAttempts) {
        if (genId && genId !== window.activeGenId) return { snapped: false, aborted: true };

        const endpoint = overpassEndpoints[(currentOverpassIndex + attempt) % overpassEndpoints.length];

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 7000);

        try {
            const r = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `data=${encodeURIComponent(q)}`,
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (r.ok) {
                const d = await r.json();
                if (!d.elements || !d.elements.length) {
                    return { snapped: false }; // Valid response, but no roads
                }
                for (const el of d.elements) {
                    if (el.geometry && el.geometry.length > 0) {
                        return { lat: el.geometry[0].lat, lng: el.geometry[0].lon, snapped: true };
                    }
                }
                return { snapped: false };
            } else if (r.status === 429) {
                logDebug(`API HTTP 429 Rate Limit on ${endpoint}`, 'warn');
                return { snapped: false, rateLimited: true, status: 429 };
            } else if (r.status >= 500) {
                 logDebug(`API HTTP ${r.status} on ${endpoint}, retrying...`, 'error');
            } else {
                 return { snapped: false, error: true, status: r.status };
            }
        } catch (e) {
            clearTimeout(timeoutId);
            const isTimeout = e.name === 'AbortError' || e.message.toLowerCase().includes('timeout');
            logDebug(`Fetch Error (${endpoint}): ${isTimeout ? 'Timeout' : e.message}, retrying...`, 'error');
        }

        // Ensure we iterate to the next endpoint
        attempt++;

        // Important: Wait before retrying immediately on a different endpoint if there was an error
        if (attempt < maxAttempts) {
             await new Promise(r => setTimeout(r, 1000 * attempt));
        }
    }

    // Cycle the default index so next calls don't start on the failed one
    currentOverpassIndex = (currentOverpassIndex + 1) % overpassEndpoints.length;
    return { snapped: false, error: true, status: 504 }; // Exhausted retries
}

async function hasStreetView(lat, lng) {
    // Uses undocumented Google GeoPhotoService endpoint to check if pano exists without API key
    // Returns JSON response structured like [[[2,... if pano exists.
    const url = `https://maps.googleapis.com/maps/api/js/GeoPhotoService.SingleImageSearch?pb=!1m5!1sapiv3!5sUS!11m2!1m1!1b0!2m4!1m2!3d${lat}!4d${lng}!2d50!3m10!2m2!1sen!2sUS!9m1!1e2!11m4!1m3!1e2!2b1!3e2!4m10!1e1!1e2!1e3!1e4!1e8!1e6!5m1!1e2!6m1!1e2&callback=svCallback`;

    // Some browsers block this via CORS when using fetch() in strict mode, so we use JSONP script tag injection
    return new Promise((resolve) => {
        const scriptId = 'sv-check-script-' + Date.now();
        const script = document.createElement('script');
        script.id = scriptId;

        // Define the global callback
        window.svCallback = function(data) {
            // Cleanup
            document.getElementById(scriptId)?.remove();
            delete window.svCallback;

            // Check if it's a valid panorama response structure
            try {
                if (data && data[1] && data[1][1] && data[1][1][0] === 2) {
                    resolve(true);
                } else {
                    resolve(false);
                }
            } catch (e) {
                resolve(false);
            }
        };

        script.onerror = () => {
            document.getElementById(scriptId)?.remove();
            delete window.svCallback;
            resolve(false);
        };

        script.src = url;
        document.body.appendChild(script);

        // Timeout in case it hangs
        setTimeout(() => {
            if (window.svCallback) {
                document.getElementById(scriptId)?.remove();
                delete window.svCallback;
                resolve(false);
            }
        }, 5000);
    });
}

window.api = {
    checkOverpassStatus,
    snapToNearestRoadForGame,
    hasStreetView,
    incrementSat: () => { countSat++; document.getElementById('stat-sat').innerText = countSat; },
    incrementHybrid: () => { countHybrid++; document.getElementById('stat-hybrid').innerText = countHybrid; },
    incrementSv: () => { countSv++; document.getElementById('stat-sv').innerText = countSv; }
};
