/* =====================================================================
   Aetherna V2 · site.js
   Todo lo compartido entre páginas vive aquí:
     1. Cabecera (menú, menú móvil) y buscador del Códice
     2. <audio> + reproductor flotante (volumen, barra de progreso)
     3. Pantalla de entrada («Entrar al Códice»)
     4. Fondo cósmico y brasas
     5. Router de navegación suave (la música no se corta al cambiar de página)
   Si añades una página nueva: añádela a NAV (abajo) y al índice de búsqueda.
   ===================================================================== */
(function () {
    'use strict';
    if (window.__aetherna) return;
    window.__aetherna = true;

    const $ = id => document.getElementById(id);
    const reduceMotion = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    const nativeAdd = EventTarget.prototype.addEventListener;
    const nativeRemove = EventTarget.prototype.removeEventListener;
    // localStorage / sessionStorage pueden estar bloqueados por el navegador: siempre dentro de try/catch
    const area = which => { try { return which === 'session' ? window.sessionStorage : window.localStorage; } catch (e) { return null; } };
    const store = {
        get(k, which) { try { return area(which).getItem(k); } catch (e) { return null; } },
        set(k, v, which) { try { area(which).setItem(k, v); } catch (e) {} }
    };

    // Estilo de la web: «nebulosa» (por defecto) o «grimorio». Se recuerda en este navegador y se aplica a todas las páginas.
    const getTheme = () => (store.get('aetherna_theme', 'local') === 'grimorio' ? 'grimorio' : 'nebulosa');
    document.documentElement.dataset.theme = getTheme();
    function setTheme(t) {
        t = t === 'grimorio' ? 'grimorio' : 'nebulosa';
        document.documentElement.dataset.theme = t;
        store.set('aetherna_theme', t, 'local');
        document.querySelectorAll('[data-theme-pick]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.themePick === t)));
        document.querySelectorAll('[data-theme-label]').forEach(b => { b.textContent = t === 'grimorio' ? 'Grimorio' : 'Nebulosa'; });
        window.dispatchEvent(new CustomEvent('aetherna:theme', { detail: t }));
    }
    nativeAdd.call(document, 'click', e => {
        const pick = e.target.closest && e.target.closest('[data-theme-pick]');
        if (pick) { setTheme(pick.dataset.themePick); return; }
        if (e.target.closest && e.target.closest('#theme-pill, [data-theme-toggle]')) setTheme(getTheme() === 'grimorio' ? 'nebulosa' : 'grimorio');
    });
    // Runas y sigilo del estilo Grimorio (trazos inventados, sin fuentes). cls = clase del <svg>.
    window.__aethernaSigil = function (cls) {
        let seed = 11; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
        const G = ['M0 -12V12M-8 -3H8', 'M0 -12V12M0 -5L8 -11', 'M-7 -10L7 10M7 -10L-7 10', 'M0 -12V12M-7 5L0 -1L7 5', 'M-7 -11H7M0 -11V12M-7 7H7'];
        let runes = '';
        for (let i = 0; i < 48; i++) runes += '<path d="' + G[(r() * G.length) | 0] + '" transform="rotate(' + (i * 7.5) + ' 400 400) translate(400 62)"/>';
        return '<svg class="' + cls + '" viewBox="0 0 800 800" aria-hidden="true"><g fill="none" stroke="#C98A3C" stroke-width="1.4">' +
            '<circle cx="400" cy="400" r="394"/><circle cx="400" cy="400" r="386" stroke-opacity=".55"/>' +
            '<circle cx="400" cy="400" r="372" stroke-width="9" stroke-dasharray="2 19" stroke-opacity=".55"/>' +
            '<circle cx="400" cy="400" r="356" stroke-opacity=".7"/><circle cx="400" cy="400" r="320" stroke-opacity=".7"/>' +
            '<g class="gs-ring" stroke-width="2.4" stroke-linecap="square">' + runes + '</g>' +
            '<g class="gs-inner" stroke-opacity=".8"><circle cx="400" cy="400" r="290"/><circle cx="400" cy="400" r="262" stroke-opacity=".6"/>' +
            '<polygon points="585.3,214.7 585.3,585.3 214.7,585.3 214.7,214.7"/><polygon points="662,400 400,662 138,400 400,138"/></g>' +
            '<circle cx="400" cy="400" r="44" stroke-opacity=".6"/></g>' +
            '<path d="M400 372 L404 396 L428 400 L404 404 L400 428 L396 404 L372 400 L396 396Z" fill="#E0902F" fill-opacity=".9"/></svg>';
    };

    // Si falta el archivo de un emblema (fotos/<clase>.webp), se oculta en vez de enseñar una imagen rota
    nativeAdd.call(document, 'error', e => {
        const t = e.target;
        if (t && t.tagName === 'IMG' && t.classList.contains('emblem')) {
            t.style.display = 'none';
            const card = t.closest('.emblem-card'); if (card) card.classList.add('no-emblem');
        }
    }, true);

    // ------------------------------------------------------------------
    // 1) Cabecera + buscador
    // ------------------------------------------------------------------
    // [clave de página, texto, enlace]   (los enlaces son relativos: funcionan también abriendo los archivos en local)
    const NAV = [ // orden del menú: Inicio, Lore, Época, Razas, Clases, Oficios, Manual, Noticias
        ['inicio',   'Inicio',   './'],
        ['lore',     'Lore',     'lore.html'],
        ['epoca',    'Época',    'epoca.html'],
        ['razas',    'Razas',    'razas.html'],
        ['clases',   'Clases',   'clases.html'],
        ['oficios',  'Oficios',  'oficios.html'],
        ['manual',   'Manual',   'manual.html'],
        ['noticias', 'Noticias', 'noticias.html']
    ];

    const pageKey = u => {
        const last = u.pathname.replace(/\/+$/, '').split('/').pop().replace(/\.html$/i, '').toLowerCase();
        return (last === '' || last === 'index') ? 'inicio' : last;
    };

    const desktopLink = (k, label, href, on) =>
        '<a href="' + href + '" class="font-cinzel text-xs uppercase tracking-[0.25em] py-1 ' +
        (on ? 'text-aetherna-goldLight font-bold border-b-2 border-aetherna-goldMain'
            : 'text-aetherna-textSoft hover:text-aetherna-goldHover transition-colors') + '"' +
        (on ? ' aria-current="page"' : '') + '>' + label + '</a>';
    const mobileLink = (k, label, href, on) =>
        '<a href="' + href + '" class="block font-cinzel text-sm uppercase tracking-widest ' +
        (on ? 'text-aetherna-goldLight' : 'text-aetherna-textSoft') + '"' +
        (on ? ' aria-current="page"' : '') + '>' + label + '</a>';


    // ------------------------------------------------------------------
    // Barra de navegación estilo habilidades (solo escritorio, desde 1024 px; en móvil sigue la cabecera de siempre)
    // ------------------------------------------------------------------
    const svg = d => '<svg viewBox="0 0 32 32" aria-hidden="true">' + d + '</svg>';
    const DOCK_ICONS = {
        inicio:   '<img src="fotos/Logo.png" alt="" width="24" height="24">',
        lore:     svg('<path d="M6 6.5c3-1.4 6.5-1.4 10 .6 3.5-2 7-2 10-.6V25c-3-1.4-6.5-1.4-10 .6-3.5-2-7-2-10-.6z"/><path d="M16 7.1V25.6"/>'),
        razas:    svg('<circle cx="11" cy="11" r="4"/><circle cx="22" cy="12" r="3.2"/><path d="M3.5 26c.6-5 3.5-8 7.5-8s6.900 3 7.500 8M18 26c.4-3.600 2.200-5.800 5-5.800s4.600 2.200 5 5.800"/>'),
        clases:   svg('<path d="M23.5 5.5l3 3L13 22l-4 1 1-4z"/><path d="M8 24l-3 3M20.5 8.5l3 3"/>'),
        epoca:    svg('<path d="M9 5h14M9 27h14M10 5c0 6 6 6 6 11s-6 5-6 11M22 5c0 6-6 6-6 11s6 5 6 11"/>'),
        oficios:  svg('<path d="M6 12h14l3-4h3v4h-3v3H11l-1 3H6z"/><path d="M12 15v10h8V15"/>'),
        manual:   svg('<rect x="7" y="4.5" width="18" height="23" rx="1.5"/><path d="M11 10h10M11 14.5h10M11 19h6"/>'),
        noticias: svg('<path d="M5 12v7h4l9 5V7l-9 5z"/><path d="M22 11c1.700 1.600 1.700 6.400 0 8"/>')
    };
    const dockSlot = (n, i, on) =>
        '<a href="' + n[2] + '" class="dk-slot' + (on ? ' on' : '') + '" data-hk="' + (i + 1) + '"' + (on ? ' aria-current="page"' : '') + ' title="' + n[1] + ' (tecla ' + (i + 1) + ')">' +
        '<span class="k">' + (i + 1) + '</span>' + DOCK_ICONS[n[0]] + '<span class="l">' + n[1] + '</span></a>';
    const DOCK_SEARCH = '<button type="button" id="dock-search" class="dk-slot" title="Buscar (Ctrl+K)" aria-label="Buscar en el Códice"><span class="k">K</span>' +
        svg('<circle cx="14" cy="14" r="7"/><path d="M19.5 19.500L26 26"/>') + '<span class="l">Buscar</span></button>';

    function renderNav(key) {
        const d = $('nav-links'), m = $('mobile-menu');
        if (d) d.innerHTML = NAV.map(n => desktopLink(n[0], n[1], n[2], n[0] === key)).join('\n');
        if (m) m.innerHTML = NAV.map(n => mobileLink(n[0], n[1], n[2], n[0] === key)).join('\n') + '<button type="button" data-theme-toggle class="theme-toggle-m">Estilo: <b data-theme-label>' + (getTheme() === 'grimorio' ? 'Grimorio' : 'Nebulosa') + '</b></button>';
        const k = $('dock-slots');
        if (k) k.innerHTML = NAV.map((n, i) => dockSlot(n, i, n[0] === key)).join('') + DOCK_SEARCH;
    }

    const HEADER_HTML = `
    <header class="fixed top-0 left-0 w-full z-50 transition-all duration-300 bg-[#07051A]/90 backdrop-blur-md border-b border-aetherna-goldMain/22" id="navbar">
        <div class="w-full px-3 sm:px-4 h-20 grid grid-cols-[1fr_auto_1fr] items-center gap-3 relative z-10">
            <div class="flex items-center justify-start">
                <a href="./" class="flex items-center gap-3 group" aria-label="Aetherna V2 · Inicio">
                    <div class="h-11 flex items-center justify-center overflow-hidden">
                        <img src="fotos/Logo.png" alt="Aetherna Logo" class="h-full w-auto object-contain group-hover:scale-105 transition-transform">
                    </div>
                </a>
            </div>
            <nav id="nav-links" class="hidden lg:flex items-center justify-center gap-4 xl:gap-8" aria-label="Principal"></nav>
            <div class="col-start-3 flex items-center justify-end gap-3">
                <button id="search-btn" type="button" title="Buscar (Ctrl+K)" aria-label="Buscar en el Códice" class="p-2 bg-aetherna-field border border-aetherna-goldMain/30 text-aetherna-goldMain hover:border-aetherna-goldMain hover:bg-aetherna-panel transition-all">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                </button>
                <button id="mobile-menu-btn" type="button" aria-label="Abrir menú" class="lg:hidden p-2 text-aetherna-goldMain hover:text-aetherna-goldHover">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
                </button>
            </div>
        </div>
        <div id="mobile-menu" class="hidden lg:hidden text-center bg-aetherna-panel border-b border-aetherna-goldMain/30 px-6 py-6 space-y-4"></div>
    </header>

    <div id="search-modal" role="dialog" aria-modal="true" aria-label="Búsqueda en el Códice" class="fixed inset-0 bg-aetherna-bgMain/90 backdrop-blur-md z-50 hidden flex items-start sm:items-center justify-center p-4">
        <div class="frame-panel p-6 w-full max-w-xl relative max-h-[88vh] flex flex-col">
            <button id="close-search" type="button" aria-label="Cerrar búsqueda" class="absolute top-4 right-4 text-aetherna-textMuted hover:text-aetherna-goldMain">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
            <h3 class="font-cinzel text-aetherna-goldLight text-lg mb-4 font-bold tracking-wider">BÚSQUEDA EN EL CÓDICE</h3>
            <input id="search-input" type="search" autocomplete="off" spellcheck="false" placeholder="Escribe términos de búsqueda..."
                   class="w-full bg-aetherna-field border border-aetherna-goldMain/30 rounded-none px-4 py-3 text-aetherna-textNormal placeholder-aetherna-textMuted focus:outline-none focus:border-aetherna-goldMain font-garamond">
            <div id="search-results" class="mt-4 space-y-2 overflow-y-auto" role="listbox" aria-label="Resultados"></div>
        </div>
    </div>`;

    const root0 = $('page-root');
    if (root0) root0.insertAdjacentHTML('beforebegin', HEADER_HTML);
    else document.body.insertAdjacentHTML('afterbegin', HEADER_HTML);
    if (!$('dock')) document.body.insertAdjacentHTML('beforeend', '<nav id="dock" aria-label="Navegación principal"><div id="dock-slots" class="dk-bar"></div></nav>');
    if (!$('grim-layer')) document.body.insertAdjacentHTML('afterbegin', '<div id="grim-layer" aria-hidden="true"><div class="gl-smoke"></div><div class="gl-smoke gl-smoke2"></div></div>');
    if (!$('theme-pill')) document.body.insertAdjacentHTML('beforeend', '<button type="button" id="theme-pill" aria-label="Cambiar el estilo de la web" title="Cambiar el estilo de la web"><span class="tp-k">Estilo</span><span data-opt="nebulosa">Nebulosa</span><i>/</i><span data-opt="grimorio">Grimorio</span></button>');
    renderNav(pageKey(location));

    // Barra de habilidades: buscar y teclas 1-8
    (function () {
        const dock = $('dock'), wide = matchMedia('(min-width: 1024px)');
        dock.addEventListener('click', e => { if (e.target.closest('#dock-search')) { const b = $('search-btn'); if (b) b.click(); } });
        // Teclas 1-8: ir a cada sección
        window.addEventListener('keydown', e => {
            if (!wide.matches || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
            if (/input|textarea|select/i.test((e.target && e.target.tagName) || '') || (e.target && e.target.isContentEditable)) return;
            const m = $('search-modal'); if (m && !m.classList.contains('hidden')) return;
            const a = dock.querySelector('.dk-slot[data-hk="' + e.key + '"]');
            if (a) { e.preventDefault(); a.click(); }
        });
    })();

    // --- buscador: índice estático (search-index.json), se descarga la primera vez que se abre ---
    const fold = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const esc = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    let index = null, indexPromise = null, activeRes = -1;

    function loadIndex() {
        if (!indexPromise) {
            indexPromise = fetch('search-index.json').then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
                .then(list => { index = list.map(e => Object.assign(e, { _s: fold(e.s), _x: fold(e.x), _p: fold(e.p) })); })
                .catch(() => { indexPromise = null; index = []; });
        }
        return indexPromise;
    }

    function snippet(e, terms) {
        const f = e._x;
        let pos = -1;
        for (const t of terms) { const i = f.indexOf(t); if (i >= 0 && (pos < 0 || i < pos)) pos = i; }
        const start = Math.max(0, (pos < 0 ? 0 : pos) - 50);
        const end = Math.min(e.x.length, start + 170);
        const raw = e.x.slice(start, end), fl = f.slice(start, end);
        const marks = [];
        terms.forEach(t => { let i = -1; while ((i = fl.indexOf(t, i + 1)) >= 0) marks.push([i, i + t.length]); });
        marks.sort((a, b) => a[0] - b[0]);
        let out = '', cur = 0;
        marks.forEach(([a, b]) => { if (a < cur) return; out += esc(raw.slice(cur, a)) + '<mark>' + esc(raw.slice(a, b)) + '</mark>'; cur = b; });
        out += esc(raw.slice(cur));
        return (start > 0 ? '…' : '') + out + (end < e.x.length ? '…' : '');
    }

    // Emblema de la clase en los resultados (Clases y Manual): la clase sale del enlace (clases.html#barbaro / manual.html#sec-barbaro)
    function emblemFor(e) {
        const m = (e.p === 'Clases' || e.p === 'Manual' || e.p === 'Oficios') && /#(?:sec-)?([a-z]+)$/.exec(e.u || '');
        return m ? '<img src="fotos/' + m[1] + '.webp" alt="" width="40" height="40" loading="lazy" decoding="async" class="emblem flex-none w-10 h-10">' : '';
    }

    function runSearch(q) {
        const box = $('search-results');
        const terms = fold(q).split(/\s+/).filter(Boolean);
        activeRes = -1;
        if (!terms.length) { box.innerHTML = ''; return; }
        if (!index) { box.innerHTML = '<p class="font-garamond italic text-aetherna-textMuted text-sm">Consultando los archivos…</p>'; return; }
        const phrase = terms.join(' ');
        const hits = [];
        index.forEach(e => {
            let score = 0;
            for (const t of terms) {
                const inS = e._s.includes(t), inP = e._p.includes(t);
                const inX = e._x.split(t).length - 1;
                if (!inS && !inP && !inX) return;
                score += (inS ? 12 : 0) + (inP ? 4 : 0) + Math.min(inX, 5);
            }
            if (terms.length > 1 && (e._s + ' ' + e._x).includes(phrase)) score += 8;
            hits.push([score, e]);
        });
        hits.sort((a, b) => b[0] - a[0]);
        if (!hits.length) { box.innerHTML = '<p class="font-garamond italic text-aetherna-textMuted text-sm">Nada en los archivos con «' + esc(q) + '». Prueba con otra palabra.</p>'; return; }
        box.innerHTML = hits.slice(0, 8).map(([, e], i) =>
            '<a href="' + esc(e.u) + '" role="option" data-i="' + i + '" class="sr flex items-center gap-3 px-3 py-2 border border-aetherna-goldMain/15 bg-aetherna-field/60 hover:border-aetherna-goldMain/60">' +
            emblemFor(e) +
            '<span class="block min-w-0 flex-1">' +
            '<span class="block font-cinzel text-[10px] uppercase tracking-[0.2em] text-aetherna-goldMain">' + esc(e.p) + '</span>' +
            '<span class="block font-cinzel text-sm font-bold text-aetherna-goldLight">' + esc(e.s) + '</span>' +
            '<span class="block font-garamond text-sm text-aetherna-textSoft leading-snug">' + snippet(e, terms) + '</span></span></a>').join('');
    }

    function setActive(i) {
        const items = $('search-results').querySelectorAll('a.sr');
        if (!items.length) return;
        activeRes = (i + items.length) % items.length;
        items.forEach((a, n) => a.classList.toggle('is-active', n === activeRes));
        items[activeRes].scrollIntoView({ block: 'nearest' });
    }

    let lastFocus = null;
    function openSearch() {
        const m = $('search-modal'); if (!m) return;
        lastFocus = document.activeElement;
        m.classList.remove('hidden');
        const mm = $('mobile-menu'); if (mm) mm.classList.add('hidden');
        const inp = $('search-input'); inp.focus(); inp.select();
        loadIndex().then(() => runSearch(inp.value));
    }
    function closeSearch() {
        const m = $('search-modal'); if (!m || m.classList.contains('hidden')) return;
        m.classList.add('hidden');
        if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
    }
    window.__closeSearch = closeSearch;

    $('search-btn').onclick = openSearch;
    $('close-search').onclick = closeSearch;
    $('search-modal').onclick = e => { if (e.target === $('search-modal')) closeSearch(); };
    $('mobile-menu-btn').onclick = () => $('mobile-menu').classList.toggle('hidden');
    $('search-results').onclick = e => { if (e.target.closest('a.sr')) closeSearch(); };
    let searchTimer = 0;
    $('search-input').addEventListener('input', e => { clearTimeout(searchTimer); searchTimer = setTimeout(() => runSearch(e.target.value), 70); });
    $('search-input').addEventListener('keydown', e => {
        if (e.key === 'ArrowDown') { e.preventDefault(); setActive(activeRes + 1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(activeRes - 1); }
        else if (e.key === 'Enter') {
            const items = $('search-results').querySelectorAll('a.sr');
            const a = items[activeRes >= 0 ? activeRes : 0];
            if (a) { e.preventDefault(); a.click(); }
        }
    });
    document.addEventListener('keydown', e => {
        const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target || {}).tagName || '') || (e.target && e.target.isContentEditable);
        if (e.key === 'Escape') closeSearch();
        else if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); openSearch(); }
        else if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); openSearch(); }
    });

    // ------------------------------------------------------------------
    // 2) Audio + reproductor (se crean una sola vez y sobreviven a la navegación)
    // ------------------------------------------------------------------
    const CAPSULE_HTML = `
<div id="music-player-capsule" class="fixed bottom-4 right-4 z-50 flex items-center gap-3 px-4 py-2 bg-[#0B0824]/94 backdrop-blur-md border border-aetherna-goldMain/40 shadow-2xl" style="border-radius: 25px; height: 50px; max-width: calc(100vw - 2rem);" role="region" aria-label="Reproductor de música">
        <button id="player-disc" type="button" title="Encoger / expandir reproductor" aria-label="Encoger o expandir el reproductor" aria-expanded="true" class="mp-disc border border-aetherna-goldMain">
            <img src="fotos/Logo.png" alt="Aetherna" class="mp-logo">
        </button>
        <div class="mp-body">
            <div class="mp-info flex flex-col justify-center min-w-[96px] max-w-[150px] sm:min-w-[130px] sm:max-w-[180px]">
                <span id="mp-title" class="font-cinzel text-[11px] text-aetherna-goldLight font-bold truncate">Epopee Cathedrale</span>
                <span class="font-garamond text-[10px] text-aetherna-textMuted tracking-wider"><span id="mp-artist">Aleyda</span> &bull; <span id="mp-time">0:00</span></span>
                <input id="mp-seek" class="mp-range mp-seek" type="range" min="0" max="1000" value="0" step="1" aria-label="Progreso de la canción">
            </div>
            <input id="mp-volume" class="mp-range mp-vol hidden sm:block" type="range" min="0" max="100" value="30" step="1" aria-label="Volumen" title="Volumen">
            <button id="mp-mute-btn" type="button" title="Silenciar / Activar sonido" aria-label="Silenciar" class="w-9 h-9 flex-none rounded-full bg-aetherna-field border border-aetherna-goldMain/30 text-aetherna-goldMain hover:border-aetherna-goldMain hover:bg-aetherna-panel transition-all flex items-center justify-center">
                <svg id="mp-icon-on" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"></path>
                    </svg>
                <svg id="mp-icon-off" class="w-4 h-4 hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"></path>
                    </svg>
            </button>
            <button id="capsule-play-btn" type="button" title="Reproducir / Pausar" aria-label="Reproducir" class="w-9 h-9 flex-none rounded-full bg-gradient-to-br from-aetherna-ember to-aetherna-blood border border-aetherna-goldMain flex items-center justify-center text-aetherna-parchment hover:scale-105 transition-transform shadow-md">
                <svg id="capsule-play-icon" class="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            </button>
            <button id="mp-skip-btn" type="button" title="Siguiente canción" aria-label="Siguiente canción" class="w-9 h-9 flex-none rounded-full bg-aetherna-field border border-aetherna-goldMain/30 text-aetherna-goldMain hover:border-aetherna-goldMain hover:bg-aetherna-panel transition-all flex items-center justify-center">
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
            </button>
        </div>
    </div>
`;
    if (!$('bg-audio')) {
        const a = document.createElement('audio');
        a.id = 'bg-audio'; a.preload = 'auto';
        document.body.appendChild(a);
    }
    if (!$('music-player-capsule')) document.body.insertAdjacentHTML('beforeend', CAPSULE_HTML);

    const entered = store.get('aetherna_entered', 'session') === '1';
    let gateOpen = !entered;

    (function () {
        const audio = $('bg-audio'), cap = $('music-player-capsule');
        if (!audio || !cap) return;
        audio.loop = false;
        const TRACKS = [
            { src: 'audio/Epopee Cathedrale - aleyda.mp3', title: 'Epopee Cathedrale', artist: 'Aleyda' },
            { src: 'audio/The Last Stand of the Hero - aleyda.mp3', title: 'The Last Stand of the Hero', artist: 'Aleyda' },
            // 'alt' = nombre alternativo del archivo, por si en la carpeta audio/ se llama distinto
            { src: 'audio/The Celestial Oath.mp3', alt: 'audio/ The Celestial Oath.mp3', title: 'The Celestial Oath' },
            { src: 'audio/Stars Cast the Dice.mp3', title: 'Stars Cast the Dice' }
        ];
        const disc = $('player-disc'), playBtn = $('capsule-play-btn'), playIcon = $('capsule-play-icon');
        const muteBtn = $('mp-mute-btn'), skipBtn = $('mp-skip-btn'), iconOn = $('mp-icon-on'), iconOff = $('mp-icon-off');
        const timeEl = $('mp-time'), titleEl = $('mp-title'), artistEl = $('mp-artist'), seekEl = $('mp-seek'), volEl = $('mp-volume');
        const PLAY = '<path d="M8 5v14l11-7z"/>', PAUSE = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
        const KEY = 'aetherna_player';
        const st = { collapsed: false, muted: false, playing: false, time: 0, track: 0, vol: 0.3 };
        try { Object.assign(st, JSON.parse(store.get(KEY) || '{}')); } catch (e) {}
        if (!(st.track >= 0 && st.track < TRACKS.length)) { st.track = 0; st.time = 0; }
        if (!(st.vol >= 0 && st.vol <= 1)) st.vol = 0.3;
        const save = () => { st.time = audio.currentTime || 0; store.set(KEY, JSON.stringify(st)); };
        const fmt = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
        const pct = (el, v) => el.style.setProperty('--p', v + '%');

        function paint() {
            cap.classList.toggle('mp-collapsed', st.collapsed);
            cap.classList.toggle('mp-playing', !audio.paused);
            disc.setAttribute('aria-expanded', String(!st.collapsed));
            playIcon.innerHTML = audio.paused ? PLAY : PAUSE;
            playBtn.setAttribute('aria-label', audio.paused ? 'Reproducir' : 'Pausar');
            iconOn.classList.toggle('hidden', audio.muted);
            iconOff.classList.toggle('hidden', !audio.muted);
            muteBtn.setAttribute('aria-label', audio.muted ? 'Activar sonido' : 'Silenciar');
            titleEl.textContent = TRACKS[st.track].title;
            titleEl.title = TRACKS[st.track].title;
            if (artistEl) artistEl.textContent = TRACKS[st.track].artist || 'Aetherna V2';
        }
        let playIntent = false, triedAlt = false, failures = 0, pendingSeek = st.time > 0 ? { track: st.track, time: st.time } : null;
        function loadTrack(i) {
            st.track = (i + TRACKS.length) % TRACKS.length;
            triedAlt = false;
            audio.src = TRACKS[st.track].src;
            timeEl.textContent = '0:00'; seekEl.value = 0; pct(seekEl, 0);
            paint();
        }
        const startPlaying = () => {
            playIntent = true;
            if (!audio.getAttribute('src')) loadTrack(st.track);      // aún no se había cargado ninguna (pantalla de entrada)
            return audio.play().then(() => { st.playing = true; paint(); save(); }).catch(() => { paint(); save(); });
        };
        function skip() { pendingSeek = null; loadTrack(st.track + 1); st.time = 0; startPlaying(); }

        playBtn.addEventListener('click', () => {
            if (audio.paused) startPlaying();
            else { playIntent = false; audio.pause(); st.playing = false; paint(); save(); }
        });
        skipBtn.addEventListener('click', skip);
        muteBtn.addEventListener('click', () => { audio.muted = !audio.muted; st.muted = audio.muted; paint(); save(); });
        disc.addEventListener('click', () => { st.collapsed = !st.collapsed; paint(); save(); });
        volEl.addEventListener('input', () => {
            st.vol = volEl.value / 100; audio.volume = st.vol; pct(volEl, volEl.value);
            if (audio.muted && st.vol > 0) { audio.muted = false; st.muted = false; }
            paint(); save();
        });
        seekEl.addEventListener('input', () => {
            if (isFinite(audio.duration)) audio.currentTime = (seekEl.value / 1000) * audio.duration;
            pct(seekEl, seekEl.value / 10);
        });

        audio.addEventListener('play', paint);
        audio.addEventListener('pause', paint);
        audio.addEventListener('ended', skip);
        audio.addEventListener('playing', () => { failures = 0; });
        audio.addEventListener('error', () => {
            const t = TRACKS[st.track];
            if (t.alt && !triedAlt) { triedAlt = true; audio.src = t.alt; if (playIntent) audio.play().catch(() => {}); return; }
            if (++failures >= TRACKS.length) { playIntent = false; st.playing = false; paint(); return; }   // ninguna carga: parar
            pendingSeek = null; loadTrack(st.track + 1); st.time = 0;
            if (playIntent) startPlaying();
        });
        let lastSave = 0;
        audio.addEventListener('timeupdate', () => {
            timeEl.textContent = fmt(audio.currentTime);
            if (isFinite(audio.duration) && audio.duration > 0 && document.activeElement !== seekEl) {
                const v = (audio.currentTime / audio.duration) * 1000;
                seekEl.value = v; pct(seekEl, v / 10);
            }
            if (Date.now() - lastSave > 1000) { lastSave = Date.now(); save(); }
        });
        window.addEventListener('pagehide', save);

        // Restaurar estado (por si la página se recarga del todo)
        audio.volume = st.vol; volEl.value = Math.round(st.vol * 100); pct(volEl, volEl.value);
        audio.muted = !!st.muted;
        audio.addEventListener('loadedmetadata', () => {
            if (pendingSeek && pendingSeek.track === st.track && isFinite(audio.duration) && pendingSeek.time < audio.duration) audio.currentTime = pendingSeek.time;
            pendingSeek = null;
        });
        if (gateOpen) paint(); else loadTrack(st.track);
        if (st.playing && !gateOpen) {
            playIntent = true;
            audio.play().catch(() => {
                const resume = () => { if (st.playing && !gateOpen) audio.play().catch(() => {}); };
                ['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, resume, { once: true }));
            });
        }

        // API para la pantalla de entrada
        window.__aethernaPlayer = {
            pause() { playIntent = false; audio.pause(); st.playing = false; paint(); save(); },
            enter(withMusic) {
                gateOpen = false;
                if (withMusic) {
                    audio.muted = false; st.muted = false;
                    pendingSeek = null; st.time = 0;
                    loadTrack(Math.floor(Math.random() * TRACKS.length));   // una al azar de las canciones
                    startPlaying();
                } else { playIntent = false; audio.pause(); st.playing = false; paint(); save(); }
            }
        };
    })();

    // ------------------------------------------------------------------
    // 2b) Intro de la entrada: tirada de iniciativa con un d20 (20 natural). Se salta con un clic o con una tecla.
    // ------------------------------------------------------------------
    function playDice(gate, done, sound) {
        const warm = document.documentElement.dataset.theme === 'grimorio';
        const PAL = warm ? { glow: 'rgba(224,150,50,.36), rgba(120,60,15,.12) 46%', crit: 'rgba(255,190,90,.9)', pipBg: '#E0902F', pipBd: '#F0B35A', pipSh: 'rgba(224,144,47,.7)', pipCur: '#FFF2CF',
                flash: 'rgba(255,236,190,.85), rgba(255,200,110,.25) 40%', ring: '#F0B35A', dg: 'rgba(240,170,70,.65)', f0: '#24150A', f1: '#090503', st: '#F0B35A', num: '#FFE9B8', spark: '#F0B35A', bg: '#070402' }
            : { glow: '${PAL.glow}', crit: '${PAL.crit}', pipBg: '#7B4FD8', pipBd: '#B79CFF', pipSh: 'rgba(130,80,230,.8)', pipCur: '#EBDDFF',
                flash: '${PAL.flash}', ring: '#B79CFF', dg: 'rgba(125,75,230,.75)', f0: '#2B1A5C', f1: '#0A0722', st: '#8B5CE6', num: '#E6D9FF', spark: '#B79CFF', bg: '#05030C' };
        const NS = 'http://www.w3.org/2000/svg';
        {
            const old = $('dice-style'); if (old) old.remove();
            const st = document.createElement('style'); st.id = 'dice-style';
            st.textContent = `
#entry-gate.dice { background: ${PAL.bg}; backdrop-filter: none; cursor: pointer; }
.dice-stage { position: relative; width: min(74vmin, 420px); aspect-ratio: 1; }
.dice-stage svg { position: relative; width: 100%; height: 100%; overflow: visible; }
.dice-glow { position: absolute; inset: -30%; background: radial-gradient(circle, ${PAL.glow}, transparent 68%); opacity: 0; animation: dice-in 1.2s ease forwards; }
.dice-ring { transform-box: view-box; transform-origin: 200px 200px; animation: dice-spin 60s linear infinite; }
.dice-ring path { fill: none; stroke: #D9B46A; stroke-width: 1; opacity: .6; stroke-linecap: round; }
.dice-fade { opacity: 0; animation: dice-in .9s ease .15s forwards; }
.dice-label { margin-top: 1.4rem; font: 700 .8rem Cinzel, serif; letter-spacing: .38em; text-transform: uppercase; color: #D9B46A; text-align: center; transition: color .3s, text-shadow .3s; }
.dice-label.crit { color: #FFF2CF; text-shadow: 0 0 16px ${PAL.crit}; }
.dice-pips { display: flex; gap: .55rem; margin-top: .9rem; }
.dice-pips i { width: 9px; height: 9px; transform: rotate(45deg); border: 1px solid rgba(217,180,106,.5); transition: background .2s, box-shadow .2s; }
.dice-pips i.on { background: ${PAL.pipBg}; border-color: ${PAL.pipBd}; box-shadow: 0 0 8px ${PAL.pipSh}; }
.dice-pips i.cur { background: ${PAL.pipCur}; }
.dice-quote { position: absolute; left: 0; right: 0; bottom: 9vh; padding: 0 1.5rem; text-align: center; font: italic 1.05rem 'EB Garamond', serif; color: #B9A98A; opacity: 0; transition: opacity 1s; }
.dice-skip { position: absolute; top: 1rem; right: 1.25rem; font: 600 .62rem Cinzel, serif; letter-spacing: .25em; text-transform: uppercase; color: #6f6450; }
.dice-flash { position: absolute; inset: 0; pointer-events: none; opacity: 0; background: radial-gradient(circle at 50% 46%, ${PAL.flash}, transparent 70%); }
.dice-ring-x { fill: none; stroke: ${PAL.ring}; stroke-width: 1.2; opacity: 0; transform-box: fill-box; transform-origin: center; }
.dice-shadow, #dice { transform-box: view-box; transform-origin: 200px 200px; }
#dice { filter: drop-shadow(0 0 12px ${PAL.dg}); }
@keyframes dice-in { to { opacity: 1; } }
@keyframes dice-spin { to { transform: rotate(360deg); } }`;
            document.head.appendChild(st);
        }
        // runas: trazos inventados (no dependen de ninguna fuente)
        let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
        let runes = '';
        for (let i = 0; i < 84; i++) {
            const k = (rnd() * 4) | 0;
            const d = 'M0 -7V7' + (k === 0 ? 'M0 -7L5 -2' : k === 1 ? 'M0 -7L-5 -2M0 0L5 5' : k === 2 ? 'M0 -3L5 -8M0 3L5 -2' : 'M-5 -4L5 4');
            runes += '<path d="' + d + '" transform="rotate(' + (i / 84 * 360).toFixed(1) + ' 200 200) translate(200 32)"/>';
        }
        // d20 de frente: hexágono + triángulo central + aristas
        const P = (r, deg) => [200 + r * Math.cos(deg * Math.PI / 180), 200 + r * Math.sin(deg * Math.PI / 180)];
        const V = [-90, -30, 30, 90, 150, 210].map(a => P(84, a)), T = [-90, 30, 150].map(a => P(44, a));
        const pt = p => p[0].toFixed(1) + ',' + p[1].toFixed(1);
        const edges = [[T[0], V[1]], [T[0], V[5]], [T[0], V[0]], [T[1], V[1]], [T[1], V[3]], [T[1], V[2]], [T[2], V[3]], [T[2], V[5]], [T[2], V[4]]]
            .map(e => 'M' + pt(e[0]) + 'L' + pt(e[1])).join('');
        const small = [P(66, -30), P(66, 90), P(66, 210)];
        gate.classList.add('dice');
        gate.setAttribute('aria-label', 'Tirando iniciativa');
        gate.innerHTML = `
        <span class="dice-skip">Pulsa para saltar</span>
        <div class="dice-stage">
            <div class="dice-glow"></div>
            <svg viewBox="0 0 400 400" aria-hidden="true">
                <defs><linearGradient id="dg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${PAL.f0}"/><stop offset="1" stop-color="${PAL.f1}"/></linearGradient></defs>
                <g class="dice-fade">
                    <circle cx="200" cy="200" r="118" fill="none" stroke="#D9B46A" stroke-opacity=".22"/>
                    <circle cx="200" cy="200" r="100" fill="none" stroke="#D9B46A" stroke-opacity=".16"/>
                    <g class="dice-ring">${runes}</g>
                    <circle cx="200" cy="32" r="21" fill="#05030C"/>
                    <g transform="translate(200 34) scale(.17) translate(-100 -100)" fill="none" stroke="#F0D79E" stroke-width="9" stroke-linejoin="miter">
                        <polygon points="100,6 181.4,53 181.4,147 100,194 18.6,147 18.6,53"/><path d="M68 146 L100 62 L132 146 M81 122 H119"/>
                    </g>
                </g>
                <ellipse class="dice-shadow" id="dice-shadow" cx="200" cy="304" rx="62" ry="9" fill="#000" opacity="0"/>
                <circle class="dice-ring-x" cx="200" cy="200" r="100"/><circle class="dice-ring-x" cx="200" cy="200" r="100"/>
                <g id="dice" opacity="0">
                    <polygon points="${V.map(pt).join(' ')}" fill="url(#dg)" stroke="${PAL.st}" stroke-width="2.2" stroke-linejoin="round"/>
                    <polygon points="${T.map(pt).join(' ')}" fill="none" stroke="${PAL.st}" stroke-width="1.8" stroke-linejoin="round"/>
                    <path d="${edges}" stroke="${PAL.st}" stroke-width="1.5" stroke-opacity=".85" fill="none"/>
                    <g fill="${PAL.num}" font-family="Cinzel, serif" font-weight="700" text-anchor="middle">
                        <text id="dn" x="200" y="${(T[1][1] - 12).toFixed(1)}" font-size="30">7</text>
                        ${small.map((p, i) => '<text class="ds" x="' + p[0].toFixed(1) + '" y="' + (p[1] + 5).toFixed(1) + '" font-size="14" fill-opacity=".8">' + (i + 3) + '</text>').join('')}
                    </g>
                </g>
                <g id="dice-sparks"></g>
            </svg>
        </div>
        <div class="dice-label dice-fade" id="dice-label">Tirando iniciativa</div>
        <div class="dice-pips dice-fade" id="dice-pips">${'<i></i>'.repeat(10)}</div>
        <p class="dice-quote" id="dice-quote">«Un 20 natural no garantiza la victoria… pero ayuda.»</p>
        <div class="dice-flash" id="dice-flash"></div>`;
        gate.tabIndex = -1; gate.focus({ preventScroll: true });

        const dice = $('dice'), shadow = $('dice-shadow'), dn = $('dn'), smalls = gate.querySelectorAll('.ds'), sparks = $('dice-sparks'), label = $('dice-label');
        const pips = [].slice.call($('dice-pips').children), timers = [];
        const at = (ms, fn) => timers.push(setTimeout(fn, ms));
        const burst = (x, y, n, spd, up) => {
            for (let i = 0; i < n; i++) {
                const c = document.createElementNS(NS, 'circle');
                c.setAttribute('r', (1 + Math.random() * 1.8).toFixed(1)); c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('fill', PAL.spark);
                sparks.appendChild(c);
                const a = up ? -Math.PI / 2 + (Math.random() - .5) * 2.4 : Math.random() * 6.283, d = spd * (.45 + Math.random() * .75);
                const an = c.animate([{ transform: 'translate(0,0)', opacity: 1 }, { transform: 'translate(' + Math.cos(a) * d + 'px,' + Math.sin(a) * d + 'px)', opacity: 0 }],
                    { duration: 650 + Math.random() * 550, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' });
                an.onfinish = () => c.remove();
            }
        };
        // Sonido sintetizado (sin archivos): choques del dado y campanada del 20 natural. Solo si se entra «con sonido».
        let actx = null, master = null;
        if (sound) {
            try {
                const AC = window.AudioContext || window.webkitAudioContext;
                actx = new AC(); if (actx.state === 'suspended') { const r = actx.resume(); if (r && r.catch) r.catch(() => {}); }
                const comp = actx.createDynamicsCompressor(); master = actx.createGain(); master.gain.value = .8;
                master.connect(comp); comp.connect(actx.destination);
            } catch (e) { actx = null; }
        }
        const noiseBuf = () => { const b = actx.createBuffer(1, actx.sampleRate * .4, actx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; };
        const env = (g, t, peak, dur) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + .004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); };
        const tone = (type, f0, f1, t, peak, dur) => {
            const o = actx.createOscillator(), g = actx.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
            env(g, t, peak, dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .05);
        };
        // «tac» seco de dado (hueso/resina): clic de ruido + 3 resonancias agudas que se apagan en milisegundos + un cuerpo corto
        const tick = (t, v) => {
            const s = actx.createBufferSource(); s.buffer = noiseBuf();
            const bp = actx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3200 + Math.random() * 1500; bp.Q.value = 1.4;
            const g = actx.createGain(); env(g, t, v * .9, .014); s.connect(bp); bp.connect(g); g.connect(master); s.start(t); s.stop(t + .03);
            const base = 900 + Math.random() * 500;
            [1, 2.15, 3.6].forEach((m, i) => tone('sine', base * m, base * m * .97, t, v * .55 / (i + 1), .05 / (i + 1) + .012));
            tone('sine', 480 + Math.random() * 120, 260, t, v * .45, .045);
        };
        // racimo de tacs con separaciones irregulares (el dado rueda y rebota)
        const clatter = (ms, v, offs) => { if (!actx) return; const t0 = actx.currentTime + ms / 1000; offs.forEach((o, k) => tick(t0 + o, v * (1 - k * .09))); };
        const whoosh = (ms, dur) => {
            if (!actx) return; const t = actx.currentTime + ms / 1000, s = actx.createBufferSource(); s.buffer = noiseBuf(); s.loop = true;
            const bp = actx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.2; bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(1500, t + dur);
            const g = actx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(.05, t + dur * .8); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
            s.connect(bp); bp.connect(g); g.connect(master); s.start(t); s.stop(t + dur + .05);
        };
        const crit = ms => {
            if (!actx) return; const t = actx.currentTime + ms / 1000;
            tone('sine', 110, 70, t, .12, .5);
            [880, 1318.5, 1760, 2637].forEach((f, i) => tone('sine', f, f, t + i * .04, .13 / (i + 1), 2.2));
        };
        // caída y rebotes
        dice.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, delay: 350, fill: 'forwards' });
        // OJO: el easing global va en «linear» para que los rebotes caigan justo en 350 ms + 2600 ms × offset (el sonido y las chispas usan esos tiempos)
        dice.animate([
            { transform: 'translateY(-320px) rotate(0deg)', offset: 0, easing: 'cubic-bezier(.55,0,.9,.55)' },
            { transform: 'translateY(0) rotate(560deg)', offset: .38, easing: 'ease-out' },
            { transform: 'translateY(-48px) rotate(770deg)', offset: .55, easing: 'ease-in' },
            { transform: 'translateY(0) rotate(910deg)', offset: .7, easing: 'ease-out' },
            { transform: 'translateY(-14px) rotate(1000deg)', offset: .84, easing: 'ease-in' },
            { transform: 'translateY(0) rotate(1080deg)', offset: 1 }
        ], { duration: 2600, delay: 350, easing: 'linear', fill: 'forwards' });
        shadow.animate([
            { transform: 'scale(.25)', opacity: .1, offset: 0 }, { transform: 'scale(1)', opacity: .55, offset: .38 }, { transform: 'scale(.65)', opacity: .3, offset: .55 },
            { transform: 'scale(1)', opacity: .55, offset: .7 }, { transform: 'scale(.88)', opacity: .45, offset: .84 }, { transform: 'scale(1)', opacity: .55, offset: 1 }
        ], { duration: 2600, delay: 350, fill: 'forwards' });
        // choques del dado: coinciden con los rebotes de la animación (350 ms de retardo + 2600 ms × desplazamiento)
        [1338, 2170, 2534, 2950].forEach((t, i) => at(t, () => burst(200, 292, [10, 8, 5, 4][i], [80, 60, 40, 30][i], true)));
        whoosh(350, 950);
        clatter(1338, .55, [0, .03, .075, .13, .2, .29]);
        clatter(2170, .38, [0, .04, .1, .18]);
        clatter(2534, .26, [0, .05, .12]);
        clatter(2950, .16, [0, .07]);
        crit(3050);
        // números que cambian cada vez más despacio
        let t = 450, step = 70, last = 0;
        while (t < 2950) {
            at(t, () => {
                let n; do { n = 1 + ((Math.random() * 19) | 0); } while (n === last); last = n; dn.textContent = n;
                smalls.forEach(s => { s.textContent = 1 + ((Math.random() * 19) | 0); });
            });
            t += step; step *= 1.07;
        }
        // barra de diamantes
        pips.forEach((p, i) => at(650 + i * 240, () => { pips.forEach(q => q.classList.remove('cur')); p.classList.add('on', 'cur'); }));
        // 20 natural
        at(3050, () => {
            dn.textContent = '20'; [15, 16, 14].forEach((n, i) => { smalls[i].textContent = n; });
            pips.forEach(p => { p.classList.remove('cur'); p.classList.add('on'); });
            label.textContent = '20 natural · ¡Crítico!'; label.classList.add('crit');
            $('dice-flash').animate([{ opacity: 0 }, { opacity: .85, offset: .18 }, { opacity: 0 }], { duration: 1000, easing: 'ease-out' });
            gate.querySelectorAll('.dice-ring-x').forEach((c, i) => c.animate([{ transform: 'scale(1)', opacity: .8 }, { transform: 'scale(' + (1.55 + i * .35) + ')', opacity: 0 }], { duration: 1200 + i * 300, easing: 'ease-out' }));
            burst(200, 200, 24, 150, false);
        });
        at(3600, () => { $('dice-quote').style.opacity = '1'; });
        let ended = false;
        const finish = () => {
            if (ended) return; ended = true;
            timers.forEach(clearTimeout);
            if (actx) { try { master.gain.setTargetAtTime(0.0001, actx.currentTime, .08); setTimeout(() => actx.close(), 600); } catch (e) {} }
            gate.removeEventListener('pointerdown', finish); document.removeEventListener('keydown', finish);
            done();
        };
        at(5200, finish);
        gate.addEventListener('pointerdown', finish); document.addEventListener('keydown', finish);
    }

    // ------------------------------------------------------------------
    // 3) Pantalla de entrada (una vez por sesión del navegador)
    // ------------------------------------------------------------------
    if (gateOpen) {
        const inertTargets = () => [$('page-root'), $('navbar')].filter(Boolean);
        document.body.insertAdjacentHTML('beforeend', `
    <div id="entry-gate" role="dialog" aria-modal="true" aria-labelledby="gate-title" class="fixed inset-0 z-[100] flex flex-col items-center justify-center text-center px-6 bg-[#05030C]/95 backdrop-blur-md transition-opacity duration-500">
        <img src="fotos/Logo.png" alt="" class="gate-logo w-24 h-24 object-contain mb-8">
        <div id="gate-title" class="font-title-deco text-aetherna-goldLight text-3xl sm:text-5xl tracking-[0.15em] mb-3">AETHERNA V2</div>
        <p class="font-garamond italic text-aetherna-textSoft mb-8">Códice de Fantasía Oscura</p>
        <div class="gate-theme" role="group" aria-label="Estilo de la web"><span>Estilo</span>
            <button type="button" data-theme-pick="nebulosa" aria-pressed="${getTheme() === 'nebulosa'}">Nebulosa</button>
            <button type="button" data-theme-pick="grimorio" aria-pressed="${getTheme() === 'grimorio'}">Grimorio</button>
        </div>
        <button id="gate-enter" type="button" class="btn-normal px-8 py-3 text-sm">Entrar al Códice</button>
        <button id="gate-silent" type="button" class="mt-5 font-cinzel text-[11px] uppercase tracking-[0.25em] text-aetherna-textMuted hover:text-aetherna-goldHover transition-colors">Entrar en silencio</button>
        <p class="mt-10 max-w-xs text-[12px] font-garamond text-aetherna-textMuted">Esta web tiene música ambiental. Podrás pausarla o bajarla cuando quieras desde el reproductor.</p>
    </div>`);
        const gate = $('entry-gate');
        inertTargets().forEach(el => { el.inert = true; });
        document.documentElement.style.overflow = 'hidden';
        $('gate-enter').focus();
        const release = () => {
            inertTargets().forEach(el => { el.inert = false; });
            document.documentElement.style.overflow = '';
            gate.classList.add('opacity-0', 'pointer-events-none');
            setTimeout(() => { if (gate.parentNode) gate.remove(); }, reduceMotion ? 0 : 520);
        };
        const closeGate = (withMusic, skipIntro) => {
            if (!$('entry-gate') || gate.dataset.busy) return;
            store.set('aetherna_entered', '1', 'session');
            if (window.__aethernaPlayer) window.__aethernaPlayer.enter(withMusic);
            if (reduceMotion || skipIntro) release();
            else { gate.dataset.busy = '1'; playDice(gate, release, withMusic); }
        };
        $('gate-enter').addEventListener('click', () => closeGate(true));
        $('gate-silent').addEventListener('click', () => closeGate(false));
        document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('entry-gate') && !gate.dataset.busy) closeGate(false, true); });
    }

    // ------------------------------------------------------------------
    // 4) Fondo cósmico + brasas
    // ------------------------------------------------------------------
        // Fondo cósmico: nebulosa generada en el navegador + estrellas que titilan
        (function () {
            function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
            function makeNoise(seed){
              const rnd=mulberry32(seed),N=256,perm=new Uint8Array(N*2),g=new Float32Array(N);
              for(let i=0;i<N;i++){g[i]=rnd();perm[i]=i;}
              for(let i=N-1;i>0;i--){const j=(rnd()*(i+1))|0;const t=perm[i];perm[i]=perm[j];perm[j]=t;}
              for(let i=0;i<N;i++)perm[i+N]=perm[i];
              const f=t=>t*t*t*(t*(t*6-15)+10);
              return (x,y)=>{
                const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,X=xi&255,Y=yi&255;
                const a=g[perm[perm[X]+Y]],b=g[perm[perm[X+1]+Y]],c=g[perm[perm[X]+Y+1]],d=g[perm[perm[X+1]+Y+1]];
                const u=f(xf),v=f(yf);
                return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v;
              };
            }
            function fbm(n,x,y,oct){
              let s=0,a=.5,sum=0;
              for(let i=0;i<oct;i++){s+=a*n(x,y);sum+=a;a*=.5;const nx=x*1.6-y*1.2+5.3,ny=x*1.2+y*1.6+2.1;x=nx;y=ny;}
              return s/sum;
            }
            let _N;
            function buildNebula(w,h,t,out){
              t=t||0;
              const N=_N||(_N=[makeNoise(11),makeNoise(29),makeNoise(47)]),n1=N[0],n2=N[1],n3=N[2];
              out=out||new Uint8ClampedArray(w*h*4);
              const ox=t*.035,oy=t*.024;
              const ss=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};
              const G=(u,v,cx,cy,sx,sy)=>Math.exp(-(((u-cx)/sx)**2+((v-cy)/sy)**2));
              const asp=w/h;
              for(let y=0;y<h;y++)for(let x=0;x<w;x++){
                const u=x/w,v=y/h,px=u*asp,py=v;
                const wx=fbm(n1,px*1.5+3.1+ox*1.6,py*1.5+1.7-oy*1.2,4),wy=fbm(n1,px*1.5+8.3-ox*1.1,py*1.5+5.2+oy*1.5,4);
                const qx=px*1.8+wx*1.3+ox,qy=py*1.8+wy*1.3-oy*.6;
                const c1=fbm(n2,qx,qy,6),c2=fbm(n3,qx*1.1+5.2-ox*.8,qy*1.1+1.3+oy*.7,6);
                const m1=Math.max(G(u,v,.48,.40,.55,.40),.8*G(u,v,.82,.28,.28,.28),.6*G(u,v,.15,.45,.25,.30));
                const purple=ss(.30,.72,c1)*(.30+.70*m1);
                const bright=ss(.55,.82,c1)*m1;
                const haze=ss(.30,.70,c1)*.5;
                const gold=Math.min(1,1.45*ss(.30,.66,c2))*ss(.48,.92,v)*(.65+.35*G(u,v,.42,1,.75,.38));
                const goldB=ss(.55,.85,c2)*gold;
                const pink=ss(.50,.85,c1)*G(u,v,.58,.84,.22,.15);
                const dx=u-.5,dy=v-.5,vig=1-.45*Math.min(1,Math.sqrt(dx*dx*1.1+dy*dy*1.4)*1.15);
                const top=.78+.22*ss(0,.28,v),k=vig*top,i=(y*w+x)*4;
                const ar=(4+14*haze+92*purple*.95+178*bright*.55)*k, ag=(2+8*haze+30*purple*.95+70*bright*.55)*k, ab=(12+34*haze+140*purple*.95+190*bright*.55)*k;
                const br=(175*gold*.85+224*goldB*.55+230*pink*.35)*k, bg=(128*gold*.85+176*goldB*.55+140*pink*.35)*k, bb=(62*gold*.85+98*goldB*.55+190*pink*.35)*k;
                out[i]=ar+br-ar*br/255; out[i+1]=ag+bg-ag*bg/255; out[i+2]=ab+bb-ab*bb/255; out[i+3]=255;
              }
              return out;
            }

            const cv = document.getElementById('cosmos-bg'), sc = document.getElementById('cosmos-stars');
            if (!cv || !sc) return;
            const NW = cv.width, NH = cv.height;
            const nctx = cv.getContext('2d');
            const nbuf = new Uint8ClampedArray(NW * NH * 4), nimg = new ImageData(nbuf, NW, NH);
            function paintNebula(t) { buildNebula(NW, NH, t, nbuf); nctx.putImageData(nimg, 0, 0); }
            try { paintNebula(0); } catch (e) {}

            const ctx = sc.getContext('2d');
            const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            let W = 0, H = 0, dpr = 1, stars = [], shoot = null, nextShoot = 0;
            const rnd = mulberry32(2026);
            const TINTS = ['255,255,255', '255,244,224', '226,214,255', '255,222,190'];

            function setup() {
                dpr = Math.min(window.devicePixelRatio || 1, 2);
                W = sc.width = Math.round(window.innerWidth * dpr);
                H = sc.height = Math.round(window.innerHeight * dpr);
                const n = Math.round((W * H) / (dpr * dpr) / 7500);
                stars = [];
                for (let i = 0; i < n; i++) {
                    const big = rnd() < .05, spark = rnd() < .018;
                    stars.push({ x: rnd() * W, y: rnd() * H, r: (big ? 1.1 + rnd() * .8 : .35 + rnd() * .75) * dpr,
                        a: .35 + rnd() * .65, sp: .6 + rnd() * 1.8, ph: rnd() * 6.28, c: TINTS[(rnd() * TINTS.length) | 0], big, spark });
                }
            }

            function draw(t) {
                ctx.clearRect(0, 0, W, H);
                for (const s of stars) {
                    const tw = reduce ? 1 : .68 + .32 * Math.sin(t * s.sp + s.ph), a = s.a * tw;
                    ctx.fillStyle = 'rgba(' + s.c + ',' + a.toFixed(3) + ')';
                    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.2832); ctx.fill();
                    if (s.big) {
                        ctx.fillStyle = 'rgba(' + s.c + ',' + (a * .14).toFixed(3) + ')';
                        ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 3.4, 0, 6.2832); ctx.fill();
                    }
                }
                if (!reduce) {
                    if (!shoot && t > nextShoot) {
                        shoot = { x: W * (.1 + rnd() * .5), y: H * (.05 + rnd() * .3), vx: W * .55, vy: H * .28, life: 0 };
                    }
                    if (shoot) {
                        shoot.life += 1 / 30;
                        const k = shoot.life / 1.1, px = shoot.x + shoot.vx * shoot.life, py = shoot.y + shoot.vy * shoot.life;
                        if (k >= 1) { shoot = null; nextShoot = t + 10 + rnd() * 14; }
                        else {
                            const g = ctx.createLinearGradient(px - shoot.vx * .22, py - shoot.vy * .22, px, py), al = Math.sin(k * Math.PI);
                            g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,244,224,' + (al * .9).toFixed(3) + ')');
                            ctx.strokeStyle = g; ctx.lineWidth = 1.4 * dpr; ctx.beginPath();
                            ctx.moveTo(px - shoot.vx * .22, py - shoot.vy * .22); ctx.lineTo(px, py); ctx.stroke();
                        }
                    }
                }
            }

            setup(); draw(0); nextShoot = 6 + rnd() * 6;
            // La nebulosa se recalcula poco a poco (12 veces/s o menos)
            const speed = reduce ? .35 : 1.4;
            let lastStars = 0, lastNeb = 0, nebCost = 0, tNeb = 0, prevTs = 0;
            function loop(ts) {
                if (!document.hidden) {
                    if (!reduce && ts - lastStars > 66) { lastStars = ts; draw(ts / 1000); }
                    if (ts - lastNeb > Math.max(80, nebCost * 8)) {
                        tNeb += Math.min(.4, (ts - (prevTs || ts)) / 1000) * speed;
                        const t0 = performance.now();
                        try { paintNebula(tNeb); } catch (e) {}
                        nebCost = performance.now() - t0; lastNeb = ts; prevTs = ts;
                    }
                }
                requestAnimationFrame(loop);
            }
            requestAnimationFrame(loop);
            let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { setup(); draw(lastStars / 1000); }, 150); });
        })();
    

    (function () {
        const canvas = $('ember-canvas');
        if (!canvas || reduceMotion) { if (canvas) canvas.style.display = 'none'; return; }
        const ctx = canvas.getContext('2d');
        function resizeCanvas() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        const warmNow = () => document.documentElement.dataset.theme === 'grimorio';
        const mkEmber = () => ({
            x: Math.random() * canvas.width, y: Math.random() * canvas.height,
            size: Math.random() * 2 + 1, speedY: Math.random() * 0.4 + 0.2, speedX: (Math.random() - 0.5) * 0.2
        });
        const embers = Array.from({ length: 110 }, mkEmber);
        // runas que caen despacio (trazos dibujados, sin depender de ninguna fuente)
        const mkRune = (top) => {
            const strokes = [[0, -1, 0, 1]];
            const n = 1 + Math.floor(Math.random() * 2);
            for (let i = 0; i < n; i++) {
                const y0 = -1 + Math.random() * 1.4, dir = Math.random() < 0.5 ? -1 : 1;
                strokes.push([0, y0, dir * (0.5 + Math.random() * 0.4), y0 + 0.45 + Math.random() * 0.5]);
            }
            return { x: Math.random() * canvas.width, y: top ? -30 - Math.random() * canvas.height : Math.random() * canvas.height,
                size: 7 + Math.random() * 9, speed: 0.25 + Math.random() * 0.45, drift: (Math.random() - 0.5) * 0.15,
                a: 0.18 + Math.random() * 0.32, strokes };
        };
        const runes = Array.from({ length: 34 }, () => mkRune(false));
        function animateEmbers() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const warm = warmNow();
            const count = warm ? embers.length : 46;
            for (let i = 0; i < count; i++) {
                const e = embers[i];
                e.y -= e.speedY;
                e.x += e.speedX + Math.sin(e.y * 0.02) * 0.2;
                if (e.y < 0) { e.y = canvas.height + 10; e.x = Math.random() * canvas.width; }
                ctx.beginPath();
                ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2);
                ctx.fillStyle = (warm ? 'rgba(255,150,60,' : 'rgba(196,160,255,') + (0.6 * Math.sin(e.y * 0.01)) + ')';
                ctx.shadowBlur = 8; ctx.shadowColor = warm ? '#E0902F' : '#B48CFF';
                ctx.fill(); ctx.shadowBlur = 0;
            }
            if (warm) {
                ctx.lineWidth = 1.4; ctx.lineCap = 'round';
                runes.forEach((r, i) => {
                    r.y += r.speed; r.x += r.drift;
                    if (r.y > canvas.height + 30) runes[i] = mkRune(true);
                    const fade = Math.min(1, r.y / 120, (canvas.height - r.y) / 160 + 0.2);
                    ctx.strokeStyle = 'rgba(240,170,80,' + (r.a * Math.max(0, fade)) + ')';
                    ctx.shadowBlur = 6; ctx.shadowColor = '#E0902F';
                    ctx.beginPath();
                    r.strokes.forEach(t => { ctx.moveTo(r.x + t[0] * r.size, r.y + t[1] * r.size); ctx.lineTo(r.x + t[2] * r.size, r.y + t[3] * r.size); });
                    ctx.stroke(); ctx.shadowBlur = 0;
                });
            }
            requestAnimationFrame(animateEmbers);
        }
        animateEmbers();
    })();

    // ------------------------------------------------------------------
    // 5) Router de navegación suave
    //    (solo con http/https; abriendo los archivos con file:// se navega normal)
    // ------------------------------------------------------------------
    if (!/^https?:$/.test(location.protocol) || !window.fetch || !window.DOMParser || !history.pushState) return;

    // Escuchas añadidas por el script de cada página (scroll, hashchange...): se anotan
    // para quitarlas al salir de esa página. Se instala DESPUÉS de lo permanente.
    let tracked = [];
    [window, document].forEach(target => {
        target.addEventListener = function (type, fn, opts) {
            tracked.push([target, type, fn, opts]);
            return nativeAdd.call(target, type, fn, opts);
        };
    });
    function dropPageListeners() {
        tracked.forEach(([t, type, fn, opts]) => nativeRemove.call(t, type, fn, opts));
        tracked = [];
    }

    // Fundido entre páginas. #page-root no genera caja (display: contents).
    const css = document.createElement('style');
    css.textContent =
        '#page-root{display:contents}' +
        '#page-root>*{transition:opacity .2s ease}' +
        '#page-root.is-leaving>*{opacity:0}' +
        '@media (prefers-reduced-motion:reduce){#page-root>*{transition:none}}';
    document.head.appendChild(css);

    try { history.scrollRestoration = 'manual'; } catch (e) {}

    const sleep = ms => new Promise(r => setTimeout(r, ms));
    let currentPath = location.pathname;
    let navToken = 0;
    const hardNav = href => { location.assign(href); };
    const scrollTopNow = y => window.scrollTo({ top: y || 0, left: 0, behavior: 'instant' });

    function runPageScript(code) {
        if (!code) return;
        const old = document.querySelector('script[data-page]');
        if (old) old.remove();
        const s = document.createElement('script');
        s.setAttribute('data-page', '');
        s.textContent = code;
        try { document.body.appendChild(s); }
        catch (err) { console.error('[Aetherna] error en el script de la página', err); }
    }

    function syncMeta(doc) {
        const d = doc.querySelector('meta[name="description"]'), cur = document.querySelector('meta[name="description"]');
        if (d && cur) cur.setAttribute('content', d.getAttribute('content') || '');
    }

    async function go(href, opts) {
        opts = opts || {};
        const push = opts.push !== false;
        const token = ++navToken;
        const root = $('page-root');
        if (!root) return hardNav(href);

        if (push) { try { history.replaceState({ y: window.scrollY }, ''); } catch (e) {} }
        root.classList.add('is-leaving');

        let html, finalUrl;
        try {
            const [res] = await Promise.all([fetch(href, { credentials: 'same-origin' }), sleep(190)]);
            if (!res.ok) throw new Error('HTTP ' + res.status);
            finalUrl = res.url;
            html = await res.text();
        } catch (err) {
            return hardNav(href);          // 404, sin red, etc.: navegación normal
        }
        if (token !== navToken) return;     // el usuario ya pidió otra página

        const doc = new DOMParser().parseFromString(html, 'text/html');
        const newRoot = doc.getElementById('page-root');
        const newStyle = doc.getElementById('page-style');
        if (!newRoot || !newStyle) return hardNav(href);

        dropPageListeners();
        if (typeof window.__pageCleanup === 'function') { try { window.__pageCleanup(); } catch (e) {} }
        window.__pageCleanup = null;

        const target = new URL(href, location.href);
        const final = new URL(finalUrl, location.href);
        if (final.origin !== location.origin) return hardNav(href);
        final.hash = target.hash;
        if (push) history.pushState({ y: 0 }, '', final.pathname + final.search + final.hash);
        currentPath = location.pathname;

        document.title = doc.title || document.title;
        syncMeta(doc);
        $('page-style').textContent = newStyle.textContent;
        root.replaceChildren(...Array.from(newRoot.childNodes).map(n => document.adoptNode(n)));

        renderNav(pageKey(final));
        const mm = $('mobile-menu'); if (mm) mm.classList.add('hidden');
        closeSearch();

        let y = 0;
        if (!push && history.state && typeof history.state.y === 'number') y = history.state.y;
        scrollTopNow(y);
        const ps = doc.querySelector('script[data-page]');
        runPageScript(ps ? ps.textContent : '');
        if (final.hash) {
            const el = document.getElementById(decodeURIComponent(final.hash.slice(1)));
            if (el && !el.hidden) el.scrollIntoView({ behavior: 'instant', block: 'start' });
        }
        requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('is-leaving')));
        window.dispatchEvent(new CustomEvent('aetherna:navigate', { detail: { url: location.href } }));
    }

    // Clics en enlaces internos
    nativeAdd.call(document, 'click', function (e) {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        const a = e.target.closest && e.target.closest('a[href]');
        if (!a) return;
        const raw = a.getAttribute('href');
        if (!raw || raw.charAt(0) === '#' || /^(mailto:|tel:|javascript:)/i.test(raw)) return;
        if ((a.target && a.target !== '_self') || a.hasAttribute('download')) return;
        const u = new URL(a.href, location.href);
        if (u.origin !== location.origin) return;
        const ext = u.pathname.match(/\.([a-z0-9]+)$/i);
        if (ext && ext[1].toLowerCase() !== 'html') return;     // imágenes, audio, pdf...

        if (pageKey(u) === pageKey(location)) {                 // misma página
            e.preventDefault();
            if (u.hash) {
                if (u.hash !== location.hash) location.hash = u.hash;
            } else if (location.hash) {
                history.pushState({ y: 0 }, '', location.pathname + location.search);
                window.dispatchEvent(new HashChangeEvent('hashchange'));
            } else {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
            return;
        }
        e.preventDefault();
        go(u.href);
    });

    // Botones atrás / adelante
    nativeAdd.call(window, 'popstate', function () {
        if (location.pathname === currentPath) return;           // solo cambió el #hash: lo gestiona la página
        go(location.href, { push: false });
    });
})();

