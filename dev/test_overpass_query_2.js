const fetch = require('node-fetch');

async function testQuery() {
    // 30km is way too large for overpass to search quickly in rural areas!
    // Let's reduce radius to something more reasonable like 5km or 10km,
    // and use `(around:...)` with `out geom;` carefully, or maybe use bbox?
    // Actually, bounding box is faster.
    const lat = 45.0;
    const lng = -110.0;
    const km = 10;
    const r_earth = 6378;
    const pi = Math.PI;
    const dy = km / r_earth * (180 / pi);
    const dx = dy / Math.cos(lat * pi / 180);

    const s = lat - dy, w = lng - dx, n = lat + dy, e = lng + dx;
    // Bbox query format: (s,w,n,e)
    const bbox = `${s.toFixed(4)},${w.toFixed(4)},${n.toFixed(4)},${e.toFixed(4)}`;

    // Using limit doesn't help with timeout if the filtering itself is slow, but bounding box is highly optimized.
    const q = `[out:json][timeout:5];way(${bbox})["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential)$"];out geom 1;`;
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
    } catch(err) {
        console.error(err);
    }
}
testQuery();
