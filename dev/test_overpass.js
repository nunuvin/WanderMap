const fetch = require('node-fetch');

async function testOverpass() {
    const lat = 37.7749;
    const lng = -122.4194;
    const radius = 500;
    const q = `[out:json][timeout:5];way(around:${radius},${lat.toFixed(5)},${lng.toFixed(5)})["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential)$"];out geom;`;

    try {
        const r = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `data=${encodeURIComponent(q)}`,
        });

        console.log(`Status: ${r.status}`);
        if (r.ok) {
            const d = await r.json();
            console.log(`Elements: ${d.elements ? d.elements.length : 0}`);
        } else {
            const text = await r.text();
            console.log(`Error text: ${text}`);
        }
    } catch (e) {
        console.error(e);
    }
}

testOverpass();
