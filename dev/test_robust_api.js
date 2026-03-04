const fetch = require('node-fetch');

const overpassEndpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://lz4.overpass-api.de/api/interpreter',
    'https://z.overpass-api.de/api/interpreter'
];

async function checkOverpassStatus() {
    try {
        // use lz4 for status check
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
        console.warn(`Status check failed: ${e.message}`);
        return { available: 'unknown', waitMs: 0 };
    }
}

async function fetchWithRetry(url, options, maxRetries = 3) {
    let retries = 0;
    while (retries < maxRetries) {
        try {
            const res = await fetch(url, options);
            if (res.ok) return res;
            if (res.status === 429) {
                console.log("429 Rate limit, checking status...");
                const status = await checkOverpassStatus();
                if (!status.available && status.waitMs > 0) {
                    console.log(`Waiting ${status.waitMs}ms before retry...`);
                    await new Promise(r => setTimeout(r, status.waitMs));
                } else {
                    await new Promise(r => setTimeout(r, 2000));
                }
            } else if (res.status >= 500) {
                console.log(`5xx Error (${res.status}), retrying...`);
                await new Promise(r => setTimeout(r, 2000 * Math.pow(2, retries))); // Exponential backoff
            } else {
                return res; // Client error like 400
            }
        } catch (e) {
            console.log(`Network error: ${e.message}, retrying...`);
            await new Promise(r => setTimeout(r, 2000 * Math.pow(2, retries))); // Exponential backoff
        }
        retries++;
    }
    throw new Error(`Max retries reached for ${url}`);
}

async function testFetchWithRetry() {
    const lat = 37.7749;
    const lng = -122.4194;
    const radius = 500;
    const q = `[out:json][timeout:5];way(around:${radius},${lat.toFixed(5)},${lng.toFixed(5)})["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential)$"];out geom;`;

    try {
        const res = await fetchWithRetry(overpassEndpoints[0], {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `data=${encodeURIComponent(q)}`,
        });
        console.log(`Success: ${res.status}`);
    } catch (e) {
        console.error("Test failed", e);
    }
}

testFetchWithRetry();
