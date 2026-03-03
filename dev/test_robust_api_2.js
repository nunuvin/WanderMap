const fetch = require('node-fetch');

const overpassEndpoints = [
    'https://lz4.overpass-api.de/api/interpreter',
    'https://z.overpass-api.de/api/interpreter',
    'https://overpass-api.de/api/interpreter'
];

async function fetchWithEndpointRotation(q, maxAttempts = 5) {
    let attempt = 0;
    while (attempt < maxAttempts) {
        const endpoint = overpassEndpoints[attempt % overpassEndpoints.length];
        console.log(`Attempt ${attempt + 1}: Trying ${endpoint}`);

        try {
            // Add a timeout using AbortController
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 7000);

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `data=${encodeURIComponent(q)}`,
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (res.ok) {
                console.log(`Success on ${endpoint}!`);
                return await res.json();
            } else if (res.status === 429 || res.status >= 500) {
                console.log(`Server error ${res.status} on ${endpoint}, will rotate and retry.`);
                // backoff based on attempt
                await new Promise(r => setTimeout(r, 2000 * Math.pow(1.5, attempt)));
            } else {
                 console.log(`Client error ${res.status} on ${endpoint}`);
                 return null; // Bad request, syntax error, etc.
            }
        } catch (e) {
            console.log(`Fetch error: ${e.message}, will rotate and retry.`);
            await new Promise(r => setTimeout(r, 2000 * Math.pow(1.5, attempt)));
        }
        attempt++;
    }
    return null;
}

async function testRot() {
    const lat = 37.7749;
    const lng = -122.4194;
    const radius = 500;
    const q = `[out:json][timeout:5];way(around:${radius},${lat.toFixed(5)},${lng.toFixed(5)})["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential)$"];out geom;`;

    const res = await fetchWithEndpointRotation(q);
    console.log(res ? "Got data!" : "Failed.");
}

testRot();
