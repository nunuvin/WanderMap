// game.js

let gameMapInstance = null;
let gameTargetLat = null, gameTargetLng = null;
let gameGuessMarker = null, gameTargetMarker = null, gamePolyline = null;
let gameTimerInterval = null;
let isGameMapExpanded = false;
let nextGameLocationPromise = null;
window.activeGenId = 0; // Prevents background generator overlap

let gameLoadTimer;

// PRNG logic
function cyrb128(s) {
    let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
    for (let i = 0, k; i < s.length; i++) {
        k = s.charCodeAt(i);
        h1 = h2 ^ Math.imul(h1 ^ k, 597399067); h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
        h3 = h4 ^ Math.imul(h3 ^ k, 951274213); h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
    }
    return [(h1^h2^h3^h4)>>>0, (h2^h1)>>>0, (h3^h1)>>>0, (h4^h1)>>>0];
}
function sfc32(a, b, c, d) {
    return function() {
        a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
        let t = (a + b) | 0; a = b ^ b >>> 9; b = c + (c << 3) | 0;
        c = (c << 21) | (c >>> 11); d = d + 1 | 0; t = t + d | 0; c = c + t | 0;
        return (t >>> 0) / 4294967296;
    }
}
let rng;
function initRng(s) { let h = cyrb128(s); rng = sfc32(h[0], h[1], h[2], h[3]); }
function generateSeed() { return Math.random().toString(36).substring(2, 10).toUpperCase(); }

// UI Wait
async function waitWithCountdown(ms, prefixMsg, genId) {
    let timeLeft = Math.ceil(ms / 1000);
    while (timeLeft > 0) {
        if (genId !== window.activeGenId) return; // Abort immediately if user restarted
        const stepText = document.getElementById('loading-step-text');
        if (stepText) stepText.innerText = `${prefixMsg} ${timeLeft}s...`;
        await new Promise(r => setTimeout(r, 1000));
        timeLeft--;
    }
}

function prepareNextGameLocation() {
    window.activeGenId++; // Scope to current generation attempt
    const s = document.getElementById('game-seed').value;
    if (!rng) initRng(s);
    // Flag as a background pre-fetch
    nextGameLocationPromise = findRandomValidLocation(window.activeGenId, true);
}

async function findRandomValidLocation(genId, isPrefetch = true) {
    // Refined, high-density bounding boxes
    const zones = [
        { lat: [30, 48], lng: [-122, -75], name: "United States" },
        { lat: [42, 55], lng: [-5, 15], name: "Western Europe" },
        { lat: [36, 42], lng: [-10, 15], name: "Southern Europe" },
        { lat: [45, 55], lng: [15, 30], name: "Eastern Europe" },
        { lat: [50, 58], lng: [-8, 2], name: "UK & Ireland" },
        { lat: [33, 40], lng: [130, 140], name: "Japan" },
        { lat: [34, 38], lng: [126, 129], name: "South Korea" },
        { lat: [10, 20], lng: [100, 108], name: "SE Asia (Mainland)" },
        { lat: [10, 18], lng: [120, 125], name: "Philippines" },
        { lat: [-8, -6], lng: [106, 114], name: "Indonesia (Java)" },
        { lat: [10, 28], lng: [72, 88], name: "India" },
        { lat: [24, 26], lng: [54, 56], name: "UAE" },
        { lat: [36, 41], lng: [26, 36], name: "Turkey" },
        { lat: [29, 31.5], lng: [30, 33], name: "Egypt" },
        { lat: [-38, -27], lng: [143, 153], name: "SE Australia" },
        { lat: [-45, -35], lng: [170, 175], name: "New Zealand" },
        { lat: [-34, -22], lng: [-50, -45], name: "Brazil Coast" },
        { lat: [-38, -30], lng: [-72, -58], name: "Argentina & Chile" },
        { lat: [-34, -23], lng: [18, 32], name: "South Africa" },
        { lat: [-3, 1], lng: [30, 38], name: "East Africa" },
        { lat: [5, 9], lng: [-1, 8], name: "West Africa" }
    ];

    const taskName = isPrefetch ? "Background Pre-fetch" : "Live Generation";
    updateGenStep(`--- Starting ${taskName} ---`);
    const stepText = document.getElementById('loading-step-text');

    let backoffDelay = 2000;
    const maxDelay = 15000;

    for (let i = 0; i < 20; i++) {
        if (genId !== window.activeGenId) {
            logDebug(`[${taskName}] Aborted. Newer seed takes priority.`, "warn");
            return null;
        }

        const zone = zones[Math.floor(rng() * zones.length)];
        const lat = (rng() * (zone.lat[1] - zone.lat[0])) + zone.lat[0];
        const lng = (rng() * (zone.lng[1] - zone.lng[0])) + zone.lng[0];

        const attemptStr = isPrefetch ? `Pre-fetch` : `Attempt`;

        const scanLogMsg = `[${attemptStr} ${i+1}/20] Scanning ${zone.name}...`;
        const scanUiMsg = `[${attemptStr} ${i+1}/20] Checking location...`;

        logDebug(scanLogMsg, 'info');
        currentGenStep = scanUiMsg;
        if (stepText) stepText.innerText = scanUiMsg;

        // Find road
        const res = await window.api.snapToNearestRoadForGame(lat, lng, 30000, genId);

        if (res.aborted) return null;

        if (res.snapped) {
            logDebug(`[Success] Road found at ${res.lat.toFixed(4)}, ${res.lng.toFixed(4)}! Verifying SV image...`, 'info');
            if (stepText) stepText.innerText = `[Success] Validating street image...`;

            // Check if valid image exists without using API Key
            const hasImage = await window.api.hasStreetView(res.lat, res.lng);
            if (hasImage) {
                 logDebug(`[Success] Valid image found!`, 'success');
                 if (stepText) stepText.innerText = `[Success] Location secured!`;
                 return res;
            } else {
                 logDebug(`[Warn] No valid image found, retrying...`, 'warn');
                 // Don't wait, just loop to next attempt
                 continue;
            }
        }

        // Handle limits/errors if no road was found due to API issue
        if (res.rateLimited) {
            logDebug(`[API 429] Checking API status...`, 'warn');
            if (stepText) stepText.innerText = `[API] Analyzing limits...`;
            const status = await window.api.checkOverpassStatus();

            if (status.available === false && status.waitMs > 0) {
                logDebug(`[API Limit] Waiting ${(status.waitMs / 1000).toFixed(1)}s for slot...`, 'warn');
                await waitWithCountdown(status.waitMs, `[API Limit] Cooldown`, genId);
            } else {
                await waitWithCountdown(5000, `[API Limit] Cooldown`, genId); // Fallback
            }
        } else if (res.error) {
            if (res.status === 504) {
                logDebug(`[HTTP 504] Server timeout. Forcing cooldown...`, 'error');
                await waitWithCountdown(30000, `[HTTP 504 Timeout] Retrying in`, genId);
                backoffDelay = 2000;
            } else {
                let currentDelay = Math.min(backoffDelay, maxDelay);
                currentDelay += Math.floor(Math.random() * 2000); // 0-2s jitter
                logDebug(`[API HTTP Error] Fallback cooldown ${(currentDelay/1000).toFixed(1)}s...`, 'error');
                await waitWithCountdown(currentDelay, `[Network Error] Retrying in`, genId);
                backoffDelay = Math.min(backoffDelay * 2.0, maxDelay); // Steeper exponential backoff
            }
        } else {
            backoffDelay = 2000; // Reset backoff upon successful, but empty, response
            logDebug(`[Wait] No road found. 1s default cooldown...`, 'warn');
            await waitWithCountdown(1000, `[Retry] Next area in`, genId);
        }
    }

    logDebug(`[Failure] Exhausted all 20 attempts.`, 'error');
    return null;
}


const btnStartGame = document.getElementById('btn-start-game');

function handleStartGame() {
    const challenge = document.getElementById('game-challenge').value;
    const timerVal = parseInt(document.getElementById('game-timer').value);

    window.activeGenId++; // Increment ID to aggressively abort any previous runs
    const currentRunId = window.activeGenId;

    resetGameUI();

    // 60 seconds (1 minute) before showing the stuck loading hint
    gameLoadTimer = setTimeout(() => showToaster('hint-game'), 60000);

    btnStartGame.innerHTML = `<i data-lucide="loader-2" class="w-3 h-3 animate-spin"></i> Loading...`;
    btnStartGame.classList.add('cursor-not-allowed', 'opacity-75');

    document.getElementById('game-panorama').innerHTML = `
        <div class="flex flex-col items-center justify-center h-full text-center p-6 bg-slate-900">
            <i data-lucide="loader-2" class="w-12 h-12 text-emerald-400 animate-spin mb-6 mx-auto"></i>
            <p class="text-slate-200 font-bold tracking-wide text-lg mb-2">Teleporting...</p>
            <p id="loading-step-text" class="text-emerald-400 text-xs font-mono h-4">Initializing engine...</p>
        </div>
    `;
    lucide.createIcons();

    setTimeout(async () => {
        if (currentRunId !== window.activeGenId) return; // Silently abort if user restarted

        let loc = nextGameLocationPromise ? await nextGameLocationPromise : null;

        if (currentRunId !== window.activeGenId) return;

        if (!loc) {
            logDebug("Pre-calculated location missing. Generating live...", "warn");
            const stepText = document.getElementById('loading-step-text');
            if (stepText) stepText.innerText = "Generating live...";
            // Pass isPrefetch = false to label it clearly in logs
            loc = await findRandomValidLocation(currentRunId, false);
        }

        if (currentRunId !== window.activeGenId) return; // Final abort check

        clearTimeout(gameLoadTimer);
        hideToaster('hint-game');

        if (loc) {
            gameTargetLat = loc.lat; gameTargetLng = loc.lng;
            loadGameStreetView(loc.lat, loc.lng, challenge);
            if (timerVal > 0) startGameTimer(timerVal);

            document.getElementById('game-blinder-tl').classList.remove('hidden');
            document.getElementById('game-blinder-tr').classList.remove('hidden');

            btnStartGame.innerHTML = `<i data-lucide="map-pin" class="w-3 h-3"></i> Place Pin`;
            btnStartGame.classList.remove('cursor-not-allowed', 'opacity-75', 'bg-slate-700');
            btnStartGame.classList.add('bg-emerald-500', 'hover:bg-emerald-400');

            // Draw attention to the mini-map when clicked, instead of being disabled
            btnStartGame.onclick = () => {
                const mapContainer = document.getElementById('game-map-container');
                mapContainer.classList.add('ring-4', 'ring-emerald-500', 'transform', '-translate-y-4');
                setTimeout(() => {
                    mapContainer.classList.remove('ring-4', 'ring-emerald-500', 'transform', '-translate-y-4');
                }, 400);
            };

            lucide.createIcons();

            prepareNextGameLocation();
        } else {
            document.getElementById('game-panorama').innerHTML = `
                <div class="flex flex-col items-center justify-center h-full text-center p-6 bg-slate-900">
                    <i data-lucide="alert-circle" class="w-12 h-12 text-rose-500 mb-4 mx-auto"></i>
                    <p class="text-slate-300 font-bold tracking-wide">Location Generation Failed</p>
                    <p class="text-slate-500 text-sm mt-2">Try regenerating the seed or clicking Restart Round.</p>
                </div>
            `;
            lucide.createIcons();
            btnStartGame.innerHTML = `<i data-lucide="refresh-cw" class="w-3 h-3"></i> Restart Round`;
            btnStartGame.classList.remove('cursor-not-allowed', 'opacity-75');
            btnStartGame.onclick = () => { document.getElementById('regen-seed').click(); };
            nextGameLocationPromise = null;
        }
    }, 100);
}

function initGameMap() {
    if (gameMapInstance) return;
    gameMapInstance = L.map('game-map', { zoomControl: false, attributionControl: false, doubleClickZoom: false }).setView([20, 0], 1);
    L.tileLayer('https://mt1.google.com/vt/lyrs=m&hl=en&x={x}&y={y}&z={z}').addTo(gameMapInstance);

    let clickCount = 0, clickTimer = null;
    gameMapInstance.on('click', (e) => {
        clickCount++;
        if (clickCount === 1) {
            clickTimer = setTimeout(() => { handleGameMapClick(e.latlng); clickCount = 0; }, 300);
        } else if (clickCount === 3) {
            clearTimeout(clickTimer); handleGameMapClick(e.latlng); submitGuess(); clickCount = 0;
        }
    });
}

function handleGameMapClick(latlng) {
    if (gameGuessMarker) gameMapInstance.removeLayer(gameGuessMarker);

    const markerIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div class="bg-amber-500 rounded-full w-4 h-4 border-2 border-white shadow-lg"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
    });

    gameGuessMarker = L.marker(latlng, {icon: markerIcon}).addTo(gameMapInstance);

    const submitBtn = document.getElementById('btn-submit-guess');
    if (submitBtn) {
        submitBtn.classList.remove('hidden');

        const headerBtn = document.getElementById('btn-start-game');
        headerBtn.innerHTML = `<i data-lucide="check" class="w-3 h-3"></i> Submit Guess`;
        headerBtn.classList.remove('cursor-not-allowed', 'opacity-50');
        headerBtn.onclick = submitGuess;
        lucide.createIcons();
    }
}

function loadGameStreetView(lat, lng, chal) {
    window.api.incrementSv();
    const dom = window.mapModule.svDomains[window.mapModule.currentDomainIndex];
    const interaction = (chal === 'static') ? 'pointer-events-auto cursor-not-allowed' : 'pointer-events-none';
    document.getElementById('game-panorama').innerHTML = `
        <div class="w-full h-full relative group">
            <div id="game-blinder-tl" class="absolute top-0 left-0 w-48 h-12 bg-black z-40 flex items-center justify-center text-[10px] text-slate-500 border-b border-r border-slate-800 rounded-br-xl hidden"><i data-lucide="eye-off" class="w-3 h-3 mr-2"></i> Location Hidden</div>
            <div id="game-blinder-tr" class="absolute top-0 right-0 w-32 h-64 bg-black z-40 flex flex-col items-center justify-center text-sm font-bold tracking-widest text-slate-500 border-b border-l border-slate-800 rounded-bl-3xl writing-vertical hidden"><i data-lucide="map-pin-off" class="w-5 h-5 mb-3"></i> Source Hidden</div>
            <div class="absolute inset-0 z-10 ${interaction}"></div>
            <iframe width="100%" height="100%" frameborder="0" style="border:0;" referrerpolicy="no-referrer" src="https://${dom}/maps?layer=c&cbll=${lat.toFixed(6)},${lng.toFixed(6)}&cbp=11,${Math.floor(Math.random()*360)},0,0,0&ncr=1&hl=en&gl=US&output=svembed&cb=${Date.now()}" allowfullscreen></iframe>
            <a href="https://${dom}/maps/@?api=1&map_action=pano&viewpoint=${lat.toFixed(6)},${lng.toFixed(6)}"
                target="_blank"
                title="Open safely in official Google Maps (Give Up)"
                class="absolute bottom-4 left-4 z-[20] bg-slate-900/90 hover:bg-slate-800 text-slate-200 px-3 py-1.5 rounded-lg shadow-xl border border-slate-700 flex items-center gap-2 text-xs font-medium transition-colors backdrop-blur-md opacity-0 group-hover:opacity-50 hover:!opacity-100">
                <i data-lucide="external-link" class="w-3 h-3 text-emerald-400"></i>
                External Failsafe
            </a>
        </div>`;
    lucide.createIcons();
}

function startGameTimer(seconds) {
    const display = document.getElementById('game-timer-display');
    display.classList.remove('hidden');
    let timeLeft = seconds;
    display.innerText = timeLeft;
    display.classList.remove('text-rose-500', 'animate-pulse');

    clearInterval(gameTimerInterval);
    gameTimerInterval = setInterval(() => {
        timeLeft--;
        display.innerText = timeLeft;
        if (timeLeft <= 10) {
            display.classList.add('text-rose-500', 'animate-pulse');
        }
        if (timeLeft <= 0) {
            clearInterval(gameTimerInterval);
            submitGuess();
        }
    }, 1000);
}

function resetGameUI() {
    clearInterval(gameTimerInterval);
    clearTimeout(gameLoadTimer); hideToaster('hint-game');
    document.getElementById('game-result-overlay').classList.add('opacity-0', 'pointer-events-none');
    const mc = document.getElementById('game-map-container'), vc = document.getElementById('game-view-container'), mh = document.getElementById('game-map-header');

    mc.removeAttribute('style');
    vc.removeAttribute('style');

    if (mh) mh.classList.remove('hidden');

    mc.className = "absolute bottom-4 right-4 w-96 h-64 bg-slate-900/90 backdrop-blur-md border border-slate-700 rounded-lg shadow-2xl z-20 flex flex-col transition-all duration-500 hover:opacity-100 opacity-90 overflow-hidden group";
    vc.className = "absolute inset-0 z-0";

    if (gameGuessMarker && gameMapInstance) gameMapInstance.removeLayer(gameGuessMarker);
    if (gameTargetMarker && gameMapInstance) gameMapInstance.removeLayer(gameTargetMarker);
    if (gamePolyline && gameMapInstance) gameMapInstance.removeLayer(gamePolyline);

    document.getElementById('btn-submit-guess').classList.add('hidden');
    btnStartGame.onclick = handleStartGame;
    btnStartGame.innerHTML = `<i data-lucide="play" class="w-3 h-3"></i> Start Round`;

    btnStartGame.classList.remove('cursor-not-allowed', 'opacity-50', 'opacity-75');
    btnStartGame.classList.add('bg-emerald-500', 'hover:bg-emerald-400');
    lucide.createIcons();

    if (gameMapInstance) { gameMapInstance.setView([20, 0], 1); gameMapInstance.invalidateSize(); }
    isGameMapExpanded = false;
}

function submitGuess() {
    if (!gameTargetLat || !gameGuessMarker) return;
    const guess = gameGuessMarker.getLatLng();
    const dist = (gameMapInstance.distance(guess, [gameTargetLat, gameTargetLng]) / 1000).toFixed(2);
    document.getElementById('result-distance').innerText = `${dist} km`;
    gameTargetMarker = L.marker([gameTargetLat, gameTargetLng], { icon: L.divIcon({ className: 'custom-div-icon', html: `<div class="bg-emerald-500 rounded-full w-4 h-4 border-2 border-white shadow-lg animate-bounce"></div>` }) }).addTo(gameMapInstance);
    gamePolyline = L.polyline([guess, [gameTargetLat, gameTargetLng]], { color: '#10b981', weight: 3, dashArray: '10, 10' }).addTo(gameMapInstance);
    const mc = document.getElementById('game-map-container'), vc = document.getElementById('game-view-container'), mh = document.getElementById('game-map-header');
    mc.style.top = "0px"; mc.style.left = "0px"; mc.style.width = "100%"; mc.style.height = "100%";
    if (mh) mh.classList.add('hidden');

    const mapDiv = document.getElementById('game-map');
    if(mapDiv) mapDiv.style.height = "100%";

    mc.className = "absolute inset-0 z-50 flex flex-col transition-all duration-500";
    vc.className = "absolute bottom-4 right-4 w-96 h-64 z-[60] border border-slate-700 rounded-lg shadow-2xl bg-slate-900";

    document.getElementById('game-blinder-tl').classList.add('hidden');
    document.getElementById('game-blinder-tr').classList.add('hidden');
    isGameMapExpanded = true;

    document.getElementById('btn-submit-guess').classList.add('hidden');

    btnStartGame.onclick = () => { document.getElementById('regen-seed').click(); handleStartGame(); };
    btnStartGame.innerHTML = `<i data-lucide="fast-forward" class="w-3 h-3"></i> Next Round`;
    lucide.createIcons();

    const iv = setInterval(() => gameMapInstance.invalidateSize(), 50);
    setTimeout(() => {
        clearInterval(iv);
        gameMapInstance.invalidateSize();
        gameMapInstance.fitBounds(gamePolyline.getBounds(), { padding: [100, 100] });
    }, 600);

    document.getElementById('game-result-overlay').classList.remove('opacity-0', 'pointer-events-none');
    document.getElementById('btn-view-results').onclick = () => document.getElementById('game-result-overlay').classList.add('opacity-0', 'pointer-events-none');
    document.getElementById('btn-next-round').onclick = () => { document.getElementById('regen-seed').click(); handleStartGame(); };
}

window.gameModule = {
    generateSeed,
    handleStartGame,
    initGameMap,
    prepareNextGameLocation,
    submitGuess
};
