const fetch = require('node-fetch');

async function testQuery() {
    const lat = 45.0;
    const lng = -110.0;
    const radius = 30000;
    // adding limit might help: way...; out geom 1;
    // but the around query still processes everything.
    const q = `[out:json][timeout:5];way(around:${radius},${lat.toFixed(5)},${lng.toFixed(5)})["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential)$"];out geom 1;`;
    console.log("Query:", q);
    try {
        const start = Date.now();
        const r = await fetch('https://z.overpass-api.de/api/interpreter', {
            method: 'POST',
            body: `data=${encodeURIComponent(q)}`
        });
        const elapsed = Date.now() - start;
        console.log("Status:", r.status, "Elapsed:", elapsed, "ms");
        if(r.ok) {
            const d = await r.json();
            console.log("Found:", d.elements.length);
        } else {
            console.log(await r.text());
        }
    } catch(e) {
        console.error(e);
    }
}
testQuery();
