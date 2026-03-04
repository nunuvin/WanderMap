// main.js
lucide.createIcons();

let lastMouseMoveTime = Date.now();
let activeToasters = {};
window.activeViewTab = 'map';
window.hasViewedStreet = false;
let terminalOpen = false;

const debugLogEl = document.getElementById('debug-log');
const terminalWindow = document.getElementById('debug-terminal-window');
const btnToggleTerminal = document.getElementById('btn-toggle-terminal');

window.currentGenStep = "Initializing engine...";

window.updateGenStep = function(msg, type = 'info') {
    window.currentGenStep = msg;
    logDebug(msg, type);
    const stepText = document.getElementById('loading-step-text');
    if (stepText) stepText.innerText = msg;
}

window.logDebug = function(msg, type = 'info') {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    const color = type === 'error' ? 'text-rose-400' : type === 'success' ? 'text-emerald-400' : type === 'warn' ? 'text-amber-400' : 'text-slate-300';
    debugLogEl.insertAdjacentHTML('beforeend', `<div class="shrink-0"><span class="text-slate-500">[${time}]</span> <span class="${color}">${msg}</span></div>`);
    debugLogEl.scrollTop = debugLogEl.scrollHeight;
}

btnToggleTerminal.addEventListener('click', () => {
    terminalOpen = !terminalOpen;
    terminalWindow.classList.toggle('hidden', !terminalOpen);
});

document.getElementById('terminal-header').addEventListener('click', () => {
    terminalOpen = false;
    terminalWindow.classList.add('hidden');
});

window.addEventListener('mousemove', () => { lastMouseMoveTime = Date.now(); });

const tabs = ['map', 'view', 'game', 'stats'];
const coordTextEl = document.getElementById('coord-text');

window.switchTab = function(target) {
    if (target === 'view' && !window.hasViewedStreet) return;
    window.activeViewTab = target;
    tabs.forEach(t => {
        const btn = document.getElementById(`tab-${t}`);
        const pane = document.getElementById(`pane-${t}`);
        if (!btn || !pane) return;
        if (t === target) {
            btn.className = 'flex items-center justify-center gap-1.5 px-3 md:px-5 py-1.5 rounded-full bg-emerald-500 text-white text-xs md:text-sm font-bold transition-all shadow-md';
            pane.classList.remove('opacity-0', 'pointer-events-none');
        } else {
            btn.className = (t === 'view' && !window.hasViewedStreet) ? 'flex items-center justify-center gap-1.5 px-3 md:px-5 py-1.5 rounded-full text-slate-500 opacity-50 cursor-not-allowed text-xs md:text-sm font-bold transition-all' : 'flex items-center justify-center gap-1.5 px-3 md:px-5 py-1.5 rounded-full text-slate-400 hover:text-slate-200 hover:bg-slate-700 text-xs md:text-sm font-bold transition-all';
            pane.classList.add('opacity-0', 'pointer-events-none');
        }
    });
    if (target === 'map') { setTimeout(() => window.mapModule.map.invalidateSize(), 50); hideToaster('hint-game'); coordTextEl.innerText = 'Hover over map'; }
    else if (target === 'game') {
        if (!window.gameMapInstance) window.gameModule.initGameMap();
        if (window.gameMapInstance) setTimeout(() => window.gameMapInstance.invalidateSize(), 50);
        if (!window.nextGameLocationPromise) window.gameModule.prepareNextGameLocation();
    }
}

tabs.forEach(t => document.getElementById(`tab-${t}`).addEventListener('click', () => switchTab(t)));

window.showToaster = function(id, duration = 7000) {
    const h = document.getElementById(id);
    if (!h) return;
    if (activeToasters[id]) clearTimeout(activeToasters[id]);
    h.classList.remove('opacity-0', 'translate-x-8', 'pointer-events-none', 'scale-95');
    h.classList.add('opacity-100', 'translate-x-0', 'scale-100');
    activeToasters[id] = setTimeout(() => hideToaster(id), duration);
}

window.hideToaster = function(id) {
    const h = document.getElementById(id);
    if (!h) return;
    h.classList.add('opacity-0', 'translate-x-8', 'pointer-events-none', 'scale-95');
    h.classList.remove('opacity-100', 'translate-x-0', 'scale-100');
}

function setupToasterToggle(hId, bId) {
    const h = document.getElementById(hId), b = document.getElementById(bId);
    if (!h || !b) return;
    b.addEventListener('click', () => h.classList.contains('opacity-0') ? showToaster(hId) : hideToaster(hId));
    h.querySelector('.close-hint').addEventListener('click', () => hideToaster(hId));
}

setupToasterToggle('hint-map', 'btn-info-map');
setupToasterToggle('hint-view', 'btn-info-view');
setupToasterToggle('hint-game', 'btn-info-game');

document.getElementById('btn-restart-game-hint').addEventListener('click', () => {
    document.getElementById('regen-seed').click();
    window.gameModule.handleStartGame();
    hideToaster('hint-game');
});

window.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('game-seed').value) {
        document.getElementById('game-seed').value = window.gameModule.generateSeed();
    }

    // Wire up game map dragging logic
    const gmc = document.getElementById('game-map-container'), gmh = document.getElementById('game-map-header');
    let isDrag = false, dX, dY;
    if (gmh && gmc) {
        gmh.addEventListener('mousedown', (e) => {
            if (window.isGameMapExpanded) return;
            isDrag = true; const r = gmc.getBoundingClientRect();
            dX = e.clientX - r.left; dY = e.clientY - r.top;
            gmc.style.right = 'auto'; gmc.style.bottom = 'auto';
            gmc.style.width = `${r.width}px`; gmc.style.height = `${r.height}px`;
            document.body.style.cursor = 'grabbing';
        });
        document.addEventListener('mousemove', (e) => {
            if (!isDrag) return;
            gmc.style.left = `${e.clientX - dX}px`; gmc.style.top = `${e.clientY - dY}px`;
        });
        document.addEventListener('mouseup', () => { isDrag = false; document.body.style.cursor = 'default'; });
        gmc.style.resize = 'both'; gmc.style.overflow = 'hidden';
    }

    document.getElementById('regen-seed').addEventListener('click', () => {
        window.activeGenId++; // Abort any ongoing background fetches
        document.getElementById('game-seed').value = window.gameModule.generateSeed();
        window.nextGameLocationPromise = null;
        const btn = document.getElementById('btn-start-game');
        btn.innerHTML = `<i data-lucide="refresh-cw" class="w-3 h-3"></i> Restart Round`;
        btn.classList.remove('cursor-not-allowed', 'opacity-50');
        btn.classList.add('bg-emerald-500', 'hover:bg-emerald-400');
        btn.onclick = window.gameModule.handleStartGame;
        lucide.createIcons();
    });

    document.getElementById('btn-submit-guess').addEventListener('click', window.gameModule.submitGuess);
    document.getElementById('btn-start-game').onclick = window.gameModule.handleStartGame;
});
