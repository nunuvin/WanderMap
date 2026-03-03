// map.js
const map = L.map('map', { zoomControl: false, doubleClickZoom: false, maxZoom: 18 }).setView([37.723, -119.639], 15);
const satLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}').addTo(map);
const hybridLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=h&hl=en&x={x}&y={y}&z={z}').addTo(map);

satLayer.on('tileload', () => window.api.incrementSat());
hybridLayer.on('tileload', () => window.api.incrementHybrid());
L.control.zoom({ position: 'topleft' }).addTo(map);

const svDomains = ['www.google.com', 'www.google.ca', 'www.google.com.au', 'www.google.co.jp'];
let currentDomainIndex = 0;

map.on('dblclick', async (e) => {
    const w = e.latlng.wrap();
    hasViewedStreet = true;
    switchTab('view');
    const loc = await snapToNearestRoadForGame(w.lat, w.lng, 250);
    // fallback to clicked lat/lng if no road found within 250m
    const finalLat = loc.snapped ? loc.lat : w.lat;
    const finalLng = loc.snapped ? loc.lng : w.lng;

    if (loc.snapped) {
        showToaster('hint-snap');
    } else {
        showToaster('hint-snap-fail');
    }

    loadActualStreetView(finalLat, finalLng);
});

function loadActualStreetView(lat, lng) {
    window.api.incrementSv();
    const dom = svDomains[currentDomainIndex];
    document.getElementById('panorama').innerHTML = `<iframe width="100%" height="100%" frameborder="0" style="border:0;" referrerpolicy="no-referrer" src="https://${dom}/maps?layer=c&cbll=${lat.toFixed(6)},${lng.toFixed(6)}&cbp=11,0,0,0,0&ncr=1&hl=en&gl=US&output=svembed&cb=${Date.now()}" allowfullscreen></iframe>`;
}

window.mapModule = {
    map,
    svDomains,
    currentDomainIndex
};
