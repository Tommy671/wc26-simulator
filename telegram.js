document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('app-root');

  /**
   * Запуск из хаба игр (блогеры): start_param=hub или ?from=hub
   * Прямой старт симулятора: start_param=normal или ?mode=normal
   */
  const launchContext = {
    fromHub: false,
    autoNormal: false,
  };

  function initTelegramEnvironment() {
    const params = new URLSearchParams(window.location.search);
    let fromHub = params.get('from') === 'hub';
    let autoNormal = params.get('mode') === 'normal';

    const wa = window.Telegram && window.Telegram.WebApp;
    if (!wa) return;

    document.documentElement.classList.add('tg-webapp');

    try {
      wa.ready();
      wa.expand();
    } catch (e) {
      console.warn('Telegram WebApp init error:', e);
    }

    const startParam = (wa.initDataUnsafe && wa.initDataUnsafe.start_param) || '';
    if (startParam.includes('hub')) fromHub = true;
    if (startParam === 'normal' || startParam.endsWith(':normal')) autoNormal = true;

    if (fromHub) {
      document.documentElement.classList.add('tg-webapp--hub');
      // Из меню игр — сразу в симулятор, без экрана выбора режима
      autoNormal = true;
    }

    launchContext.fromHub = fromHub;
    launchContext.autoNormal = autoNormal;

    const syncViewport = () => {
      const h = wa.viewportStableHeight || wa.viewportHeight || window.innerHeight;
      document.documentElement.style.setProperty('--tg-vh', `${h}px`);
    };
    syncViewport();
    if (typeof wa.onEvent === 'function') {
      wa.onEvent('viewportChanged', syncViewport);
    } else {
      window.addEventListener('resize', syncViewport);
    }
  }

  function exitAppOrMenu() {
    if (launchContext.fromHub && window.Telegram && window.Telegram.WebApp) {
      try {
        window.Telegram.WebApp.close();
        return;
      } catch (e) {
        /* fallback */
      }
    }
    renderStartScreen();
  }

  initTelegramEnvironment();

  const LEVELS = [
    {
      id: 'easy',
      title: 'Лёгкий',
      subtitle: 'Автосимуляция турнира',
      description: 'Один клик — и мы сами просчитаем весь турнир: от групп до финала.',
    },
    {
      id: 'normal',
      title: 'Нормальный',
      subtitle: 'Ручной выбор победителей',
      description: 'Выбирай, кто проходит дальше в плей‑офф, без ввода счёта.',
    },
    {
      id: 'hard',
      title: 'Сложный',
      subtitle: 'Полный контроль',
      description: 'Стыки, группы и плей‑офф со счётом и таблицами — как в большой версии.',
    },
  ];

  // Простое состояние для нормального режима (без localStorage)
  const normalState = {
    groupOrder: {},
    bestThirds: [],
    knockoutWinners: {},
    lastQualKey: null,
    stage: 'groups',
  };

  // Лёгкий режим — автосимуляция
  const easyState = {
    stage: 'groups',
    simulated: false,
    data: null,
  };

  /** % внутри playarea (= рамка разметки); 0/100 ≈ на боковой линии, чуть за край — наезд на линию */
  const PITCH_LAYOUTS = {
    '4-3-3': [
      { pos: 'GK', x: 50, y: 94 },
      { pos: 'LB', x: 8, y: 68 },
      { pos: 'CB', x: 37, y: 68 },
      { pos: 'CB', x: 63, y: 68 },
      { pos: 'RB', x: 92, y: 68 },
      { pos: 'CM', x: 24, y: 48 },
      { pos: 'CM', x: 50, y: 48 },
      { pos: 'CM', x: 76, y: 48 },
      { pos: 'LW', x: 10, y: 12 },
      { pos: 'ST', x: 50, y: 8 },
      { pos: 'RW', x: 90, y: 12 },
    ],
    '4-2-3-1': [
      { pos: 'GK', x: 50, y: 94 },
      { pos: 'LB', x: 10, y: 68 },
      { pos: 'CB', x: 36, y: 68 },
      { pos: 'CB', x: 64, y: 68 },
      { pos: 'RB', x: 90, y: 68 },
      { pos: 'CDM', x: 38, y: 52 },
      { pos: 'CDM', x: 62, y: 52 },
      { pos: 'LM', x: 12, y: 30 },
      { pos: 'CAM', x: 50, y: 30 },
      { pos: 'RM', x: 88, y: 30 },
      { pos: 'ST', x: 50, y: 10 },
    ],
    '4-4-2': [
      { pos: 'GK', x: 50, y: 94 },
      { pos: 'LB', x: 10, y: 68 },
      { pos: 'CB', x: 36, y: 68 },
      { pos: 'CB', x: 64, y: 68 },
      { pos: 'RB', x: 90, y: 68 },
      { pos: 'LM', x: 10, y: 46 },
      { pos: 'CM', x: 38, y: 46 },
      { pos: 'CM', x: 62, y: 46 },
      { pos: 'RM', x: 90, y: 46 },
      { pos: 'ST', x: 38, y: 12 },
      { pos: 'ST', x: 62, y: 12 },
    ],
    '4-1-4-1': [
      { pos: 'GK', x: 50, y: 94 },
      { pos: 'LB', x: 10, y: 70 },
      { pos: 'CB', x: 36, y: 70 },
      { pos: 'CB', x: 64, y: 70 },
      { pos: 'RB', x: 90, y: 70 },
      { pos: 'CDM', x: 50, y: 50 },
      { pos: 'LM', x: 10, y: 32 },
      { pos: 'CM', x: 37, y: 26 },
      { pos: 'CM', x: 63, y: 26 },
      { pos: 'RM', x: 90, y: 32 },
      { pos: 'ST', x: 50, y: 8 },
    ],
    '4-5-1': [
      { pos: 'GK', x: 50, y: 94 },
      { pos: 'LB', x: 10, y: 70 },
      { pos: 'CB', x: 36, y: 70 },
      { pos: 'CB', x: 64, y: 70 },
      { pos: 'RB', x: 90, y: 70 },
      { pos: 'LM', x: 10, y: 38 },
      { pos: 'CM', x: 30, y: 42 },
      { pos: 'CM', x: 50, y: 44 },
      { pos: 'CM', x: 70, y: 42 },
      { pos: 'RM', x: 90, y: 38 },
      { pos: 'ST', x: 50, y: 8 },
    ],
    '3-4-3': [
      { pos: 'GK', x: 50, y: 94 },
      { pos: 'CB', x: 28, y: 68 },
      { pos: 'CB', x: 50, y: 64 },
      { pos: 'CB', x: 72, y: 68 },
      { pos: 'LM', x: 10, y: 46 },
      { pos: 'CM', x: 38, y: 46 },
      { pos: 'CM', x: 62, y: 46 },
      { pos: 'RM', x: 90, y: 46 },
      { pos: 'LW', x: 10, y: 12 },
      { pos: 'ST', x: 50, y: 8 },
      { pos: 'RW', x: 90, y: 12 },
    ],
    '5-4-1': [
      { pos: 'GK', x: 50, y: 94 },
      { pos: 'CB', x: 28, y: 66 },
      { pos: 'CB', x: 50, y: 62 },
      { pos: 'CB', x: 72, y: 66 },
      { pos: 'LB', x: 7, y: 52 },
      { pos: 'RB', x: 93, y: 52 },
      { pos: 'LM', x: 10, y: 30 },
      { pos: 'CM', x: 37, y: 34 },
      { pos: 'CM', x: 63, y: 34 },
      { pos: 'RM', x: 90, y: 30 },
      { pos: 'ST', x: 50, y: 8 },
    ],
  };

  const BENCH_GRID_SLOTS = 15;

  /**
   * Вид маркеров на поле и в запасе: 'cards' | 'dots'.
   * dots — молочные кружки (старый вариант, для сравнения с заказчиком).
   */
  const SQUAD_PITCH_MARKER = 'cards';

  const SQUAD_CARD_SILHOUETTE_SVG = `
    <svg class="tg-squad-card-figure" viewBox="0 0 32 34" aria-hidden="true" focusable="false">
      <ellipse cx="16" cy="7.4" rx="6.6" ry="6.2" fill="currentColor"/>
      <path fill="currentColor" d="M5 33.2c0-4.8 4.2-9.6 11-11.2 6.8 1.6 11 6.4 11 11.2 0 .1-22 0-22 0z"/>
    </svg>
  `;

  /** Слоты основы по схеме (11 позиций) — для отображения и проверки запаса */
  const FORMATION_SLOTS = {
    '4-3-3': ['GK', 'LB', 'CB', 'CB', 'RB', 'CM', 'CM', 'CM', 'LW', 'ST', 'RW'],
    '4-2-3-1': ['GK', 'LB', 'CB', 'CB', 'RB', 'CDM', 'CDM', 'LM', 'CAM', 'RM', 'ST'],
    '4-4-2': ['GK', 'LB', 'CB', 'CB', 'RB', 'LM', 'CM', 'CM', 'RM', 'ST', 'ST'],
    '4-1-4-1': ['GK', 'LB', 'CB', 'CB', 'RB', 'CDM', 'LM', 'CM', 'CM', 'RM', 'ST'],
    '4-5-1': ['GK', 'LB', 'CB', 'CB', 'RB', 'LM', 'CM', 'CM', 'CM', 'RM', 'ST'],
    '3-4-3': ['GK', 'CB', 'CB', 'CB', 'LM', 'CM', 'CM', 'RM', 'LW', 'ST', 'RW'],
    '5-4-1': ['GK', 'CB', 'CB', 'CB', 'LB', 'RB', 'LM', 'CM', 'CM', 'RM', 'ST'],
  };

  function getSquadEntry(teamId) {
    if (typeof SQUADS_BY_TEAM_ID === 'undefined') return null;
    return SQUADS_BY_TEAM_ID[teamId] || null;
  }

  // --- Модальное окно состава (заглушка под будущее поле) ---
  let squadModalEl = null;

  function ensureSquadModal() {
    if (squadModalEl) return squadModalEl;
    squadModalEl = document.createElement('div');
    squadModalEl.className = 'tg-squad-modal';
    squadModalEl.setAttribute('aria-hidden', 'true');
    squadModalEl.innerHTML = `
      <div class="tg-squad-modal-backdrop" data-close="1"></div>
      <div class="tg-squad-modal-sheet" role="dialog" aria-modal="true" aria-labelledby="tg-squad-modal-title">
        <header class="tg-squad-modal-header">
          <div class="tg-squad-modal-team" id="tg-squad-modal-team"></div>
          <button type="button" class="tg-squad-modal-close" aria-label="Закрыть">×</button>
        </header>
        <div class="tg-squad-modal-content" id="tg-squad-modal-content"></div>
      </div>
    `;
    document.body.appendChild(squadModalEl);
    squadModalEl.querySelector('.tg-squad-modal-close').addEventListener('click', closeSquadModal);
    squadModalEl.querySelector('.tg-squad-modal-backdrop').addEventListener('click', closeSquadModal);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && squadModalEl.classList.contains('tg-squad-modal-open')) {
        closeSquadModal();
      }
    });
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.BackButton) {
      try {
        window.Telegram.WebApp.BackButton.onClick(() => {
          if (squadModalEl.classList.contains('tg-squad-modal-open')) {
            closeSquadModal();
          }
        });
      } catch (e) {
        /* ignore */
      }
    }
    return squadModalEl;
  }

  function closeSquadModal() {
    if (!squadModalEl) return;
    squadModalEl.classList.remove('tg-squad-modal-open');
    squadModalEl.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('tg-squad-modal-body-lock');
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.BackButton) {
      try {
        window.Telegram.WebApp.BackButton.hide();
      } catch (e) {
        /* ignore */
      }
    }
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** Меньший шрифт в кружке (режим dots). */
  function squadNameSizeClass(name) {
    const len = String(name || '').length;
    if (len >= 20) return 'tg-squad-name--xs';
    if (len >= 15) return 'tg-squad-name--sm';
    if (len >= 11) return 'tg-squad-name--md';
    return '';
  }

  /** Подбор font-size, чтобы имя влезло в одну строку без «…». */
  function squadCardFitFontSize(name, variant) {
    const len = Math.max(1, String(name || '').length);
    const innerW = variant === 'bench' ? 44 : 48;
    const max = variant === 'bench' ? 7.5 : 9.5;
    const min = 4.75;
    let size = max;
    while (size > min && len * size * 0.54 > innerW) {
      size -= 0.2;
    }
    return Math.round(size * 100) / 100;
  }

  function useSquadCards() {
    return SQUAD_PITCH_MARKER === 'cards';
  }

  /** Раскладывает стартовых по слотам схемы (по полю position, порядок в squads.js). */
  function assignStartersToPitchSlots(starters, slotDefs) {
    const queues = {};
    starters.forEach((p) => {
      if (!queues[p.position]) queues[p.position] = [];
      queues[p.position].push(p);
    });
    return slotDefs.map((slot) => {
      const q = queues[slot.pos];
      const player = q && q.length ? q.shift() : null;
      return { ...slot, player };
    });
  }

  /** Кружок на поле (основной вариант для всех схем). */
  function renderPitchSlotDot(slot) {
    const rawName = slot.player ? slot.player.name : '—';
    const name = escapeHtml(rawName);
    const sizeCls = squadNameSizeClass(rawName);
    return `
      <div
        class="tg-squad-dot tg-squad-chip"
        style="left:${slot.x}%;top:${slot.y}%;"
        data-pos="${slot.pos}"
      >
        <span class="tg-squad-dot-name tg-squad-chip-label ${sizeCls}">${name}</span>
      </div>
    `;
  }

  function renderPlayerCard(player, variant) {
    if (!player) {
      return `<div class="tg-squad-card tg-squad-card--${variant} tg-squad-card--empty" aria-hidden="true"></div>`;
    }
    const rawName = player.name || '—';
    const name = escapeHtml(rawName);
    const pos = escapeHtml(player.position || '');
    const fontPx = squadCardFitFontSize(rawName, variant);
    return `
      <div class="tg-squad-card tg-squad-card--${variant}">
        <div class="tg-squad-card-silhouette">${SQUAD_CARD_SILHOUETTE_SVG}</div>
        <div class="tg-squad-card-name">
          <span class="tg-squad-card-name-text" style="font-size:${fontPx}px">${name}</span>
        </div>
        <div class="tg-squad-card-pos">${pos}</div>
      </div>
    `;
  }

  function renderPitchSlotCard(slot) {
    const player = slot.player
      ? { name: slot.player.name, position: slot.pos }
      : { name: '—', position: slot.pos };
    const inner = renderPlayerCard(player, 'pitch');
    const z = Math.round(100 - slot.y);
    return `<div class="tg-squad-card-anchor" style="left:${slot.x}%;top:${slot.y}%;z-index:${z}" data-pos="${escapeHtml(slot.pos)}">${inner}</div>`;
  }

  function renderPitchSlotHtml(slot) {
    if (useSquadCards()) {
      return renderPitchSlotCard(slot);
    }
    return renderPitchSlotDot(slot);
  }

  /** Запас: 5×3 кружки (режим dots). */
  function renderBenchDotsHtml(bench) {
    const benchCells = bench.slice(0, BENCH_GRID_SLOTS);
    while (benchCells.length < BENCH_GRID_SLOTS) {
      benchCells.push(null);
    }
    return benchCells
      .map((p) => {
        if (!p) {
          return '<div class="tg-squad-bench-chip tg-squad-chip tg-squad-bench-chip--empty" aria-hidden="true"></div>';
        }
        const sizeCls = squadNameSizeClass(p.name);
        return `<div class="tg-squad-bench-chip tg-squad-chip"><span class="tg-squad-chip-label ${sizeCls}">${escapeHtml(p.name)}</span></div>`;
      })
      .join('');
  }

  /** Запас: 5×3 карточки (режим cards). */
  function renderBenchCardsHtml(bench) {
    const benchCells = bench.slice(0, BENCH_GRID_SLOTS);
    while (benchCells.length < BENCH_GRID_SLOTS) {
      benchCells.push(null);
    }
    return benchCells.map((p) => renderPlayerCard(p, 'bench')).join('');
  }

  function renderBenchHtml(bench) {
    if (useSquadCards()) {
      return `<div class="tg-squad-bench-grid tg-squad-bench-grid--cards">${renderBenchCardsHtml(bench)}</div>`;
    }
    return `<div class="tg-squad-bench-grid">${renderBenchDotsHtml(bench)}</div>`;
  }

  function renderSquadPitchVisual(formation, team, starters, bench) {
    const teamLabel = team ? escapeHtml(team.name) : 'Сборная';
    const slotDefs = PITCH_LAYOUTS[formation];
    const slots = assignStartersToPitchSlots(starters, slotDefs);
    const useCards = useSquadCards();
    const dotsHtml = slots.map((slot) => renderPitchSlotHtml(slot)).join('');

    const benchHtml = renderBenchHtml(bench);

    return `
      <div class="tg-squad-visual tg-squad-visual-pitch${useCards ? ' tg-squad-visual--cards' : ' tg-squad-visual--dots'}">
        <div class="tg-squad-pitch" aria-label="Основной состав ${formation}">
          <div class="tg-squad-pitch-grass"></div>
          <div class="tg-squad-pitch-head">
            <div class="tg-squad-pitch-head-formation">${escapeHtml(formation)}</div>
            <div class="tg-squad-pitch-head-team">Состав · ${teamLabel}</div>
          </div>
          <div class="tg-squad-pitch-lines" aria-hidden="true"></div>
          <div class="tg-squad-pitch-playarea">
            <div class="tg-squad-pitch-dots">${dotsHtml}</div>
          </div>
        </div>
        <section class="tg-squad-bench">
          <h3 class="tg-squad-bench-title">Запас</h3>
          ${benchHtml}
        </section>
      </div>
    `;
  }

  function renderSquadListFallback(formation, starters, bench) {
    const slots = FORMATION_SLOTS[formation];
    const formationLine = slots
      ? `Схема ${formation}: ${slots.join(', ')}`
      : `Схема ${formation}`;
    return `
      <p class="tg-squad-modal-formation">${escapeHtml(formationLine)}</p>
      <p class="tg-squad-fallback-note">Для схемы «${escapeHtml(formation)}» пока показываем списком.</p>
      <section class="tg-squad-section">
        <h3 class="tg-squad-section-title">Основа (${starters.length})</h3>
        <ul class="tg-squad-player-list">${starters.map(renderSquadPlayerLi).join('')}</ul>
      </section>
      <section class="tg-squad-section">
        <h3 class="tg-squad-section-title">Запас (${bench.length})</h3>
        <ul class="tg-squad-player-list">${bench.map(renderSquadPlayerLi).join('')}</ul>
      </section>
    `;
  }

  function openSquadModal(teamId) {
    const team = findTeamById(teamId);
    const entry = getSquadEntry(teamId);
    ensureSquadModal();

    const sheet = squadModalEl.querySelector('.tg-squad-modal-sheet');
    const titleEl = squadModalEl.querySelector('#tg-squad-modal-title') || squadModalEl.querySelector('.tg-squad-modal-team');
    const contentEl = squadModalEl.querySelector('#tg-squad-modal-content');

    if (titleEl) {
      titleEl.id = 'tg-squad-modal-title';
      titleEl.innerHTML = team
        ? `${renderFlagHtmlSimple(team)}<span class="tg-squad-modal-name">${team.name}</span><span class="tg-squad-modal-code">${team.id}</span>`
        : `<span class="tg-squad-modal-name">Сборная</span>`;
    }

    sheet.classList.remove('tg-squad-modal-sheet--pitch');

    if (!entry || !entry.players || !entry.players.length) {
      contentEl.innerHTML =
        '<p class="tg-squad-modal-formation">Состав пока не добавлен в squads.js</p>';
    } else {
      const formation = entry.formation || '—';
      const starters = entry.players.filter((p) => p.role === 'starter');
      const bench = entry.players.filter((p) => p.role === 'bench');

      if (PITCH_LAYOUTS[formation] && starters.length >= 11) {
        sheet.classList.add('tg-squad-modal-sheet--pitch');
        contentEl.innerHTML = renderSquadPitchVisual(formation, team, starters, bench);
      } else {
        contentEl.innerHTML = renderSquadListFallback(formation, starters, bench);
      }
    }

    squadModalEl.classList.add('tg-squad-modal-open');
    squadModalEl.setAttribute('aria-hidden', 'false');
    document.body.classList.add('tg-squad-modal-body-lock');

    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.BackButton) {
      try {
        window.Telegram.WebApp.BackButton.show();
      } catch (e) {
        /* ignore */
      }
    }
  }

  function renderSquadPlayerLi(p) {
    return `<li><span class="tg-squad-pos">${escapeHtml(p.position)}</span><span class="tg-squad-player-name">${escapeHtml(p.name)}</span></li>`;
  }

  function bindSquadOpenTriggers(container) {
    const open = (teamId) => {
      if (!teamId) return;
      openSquadModal(teamId);
    };

    container.querySelectorAll('.team-squad-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        open(btn.dataset.teamId);
      });
    });

    container.querySelectorAll('.standings-team').forEach((el) => {
      el.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const row = el.closest('.team-card');
        if (row) open(row.dataset.teamId);
      });
    });
  }

  function findTeamById(teamId) {
    if (typeof WORLD_CUP_2026_CONFIG === 'undefined') return null;
    for (const group of WORLD_CUP_2026_CONFIG.groups) {
      const team = group.teams.find((t) => t.id === teamId);
      if (team) return team;
    }
    return null;
  }

  function renderFlagHtmlSimple(team) {
    if (!team) return '<span class="flag-emoji">🏳️</span>';
    const code =
      (typeof FLAG_CODE_BY_TEAM_ID !== 'undefined' &&
        FLAG_CODE_BY_TEAM_ID[team.id]) || null;
    if (!code) {
      const flag = team.flag || '🏳️';
      return `<span class="flag-emoji">${flag}</span>`;
    }
    const url = `https://flagcdn.com/24x18/${code}.png`;
    return `<img class="flag-img" src="${url}" alt="${team.name}" loading="lazy" />`;
  }

  function ensureNormalGroupOrder() {
    if (typeof WORLD_CUP_2026_CONFIG === 'undefined') return;
    for (const group of WORLD_CUP_2026_CONFIG.groups) {
      if (!normalState.groupOrder[group.id]) {
        normalState.groupOrder[group.id] = group.teams.map((t) => t.id);
      }
    }
    if (!Array.isArray(normalState.bestThirds)) {
      normalState.bestThirds = [];
    }
  }

  // --- Плей‑офф для нормального режима ---

  const ROUND_OF_32_TEMPLATE_TG = [
    {
      id: 'R32-1',
      home: { type: 'winner', groups: ['E'] },
      away: { type: 'third', groups: ['A', 'B', 'C', 'D', 'F'] },
    },
    {
      id: 'R32-2',
      home: { type: 'winner', groups: ['I'] },
      away: { type: 'third', groups: ['C', 'D', 'F', 'G', 'H'] },
    },
    {
      id: 'R32-3',
      home: { type: 'second', groups: ['A'] },
      away: { type: 'second', groups: ['B'] },
    },
    {
      id: 'R32-4',
      home: { type: 'winner', groups: ['F'] },
      away: { type: 'second', groups: ['C'] },
    },
    {
      id: 'R32-5',
      home: { type: 'second', groups: ['K'] },
      away: { type: 'second', groups: ['L'] },
    },
    {
      id: 'R32-6',
      home: { type: 'winner', groups: ['H'] },
      away: { type: 'second', groups: ['J'] },
    },
    {
      id: 'R32-7',
      home: { type: 'winner', groups: ['D'] },
      away: { type: 'third', groups: ['B', 'E', 'F', 'I', 'J'] },
    },
    {
      id: 'R32-8',
      home: { type: 'winner', groups: ['G'] },
      away: { type: 'third', groups: ['A', 'E', 'H', 'I', 'J'] },
    },
    {
      id: 'R32-9',
      home: { type: 'winner', groups: ['C'] },
      away: { type: 'second', groups: ['F'] },
    },
    {
      id: 'R32-10',
      home: { type: 'second', groups: ['E'] },
      away: { type: 'second', groups: ['I'] },
    },
    {
      id: 'R32-11',
      home: { type: 'winner', groups: ['A'] },
      away: { type: 'third', groups: ['C', 'E', 'F', 'H', 'I'] },
    },
    {
      id: 'R32-12',
      home: { type: 'winner', groups: ['L'] },
      away: { type: 'third', groups: ['E', 'H', 'I', 'J', 'K'] },
    },
    {
      id: 'R32-13',
      home: { type: 'winner', groups: ['J'] },
      away: { type: 'second', groups: ['H'] },
    },
    {
      id: 'R32-14',
      home: { type: 'second', groups: ['D'] },
      away: { type: 'second', groups: ['G'] },
    },
    {
      id: 'R32-15',
      home: { type: 'winner', groups: ['B'] },
      away: { type: 'third', groups: ['E', 'F', 'G', 'I', 'J'] },
    },
    {
      id: 'R32-16',
      home: { type: 'winner', groups: ['K'] },
      away: { type: 'third', groups: ['D', 'E', 'I', 'J', 'L'] },
    },
  ];

  function calcQualifiersNormalFromState() {
    ensureNormalGroupOrder();
    const standingsByGroup = {};
    const bestThirds = (normalState.bestThirds || []).map((x) => ({ ...x }));

    for (const group of WORLD_CUP_2026_CONFIG.groups) {
      const order =
        normalState.groupOrder[group.id] || group.teams.map((t) => t.id);
      const arr = order.map((teamId) => ({
        teamId,
        groupId: group.id,
      }));
      standingsByGroup[group.id] = arr;
    }

    return { standingsByGroup, bestThirds };
  }

  function buildBracketNormal(qualifiers) {
    const rounds = {
      R32: [],
      R16: [],
      QF: [],
      SF: [],
      FINAL: [],
      THIRD: [],
    };

    const firstByGroup = {};
    const secondByGroup = {};
    for (const group of WORLD_CUP_2026_CONFIG.groups) {
      const st = qualifiers.standingsByGroup[group.id] || [];
      if (st[0]) firstByGroup[group.id] = st[0];
      if (st[1]) secondByGroup[group.id] = st[1];
    }

    const bestThirds = qualifiers.bestThirds || [];
    const usedThird = new Set();

    function pickThird(allowedGroups) {
      for (let i = 0; i < bestThirds.length; i++) {
        if (usedThird.has(i)) continue;
        const cand = bestThirds[i];
        if (allowedGroups.includes(cand.groupId)) {
          usedThird.add(i);
          return cand;
        }
      }
      for (let i = 0; i < bestThirds.length; i++) {
        if (usedThird.has(i)) continue;
        const cand = bestThirds[i];
        usedThird.add(i);
        return cand;
      }
      return null;
    }

    function resolveSide(slot) {
      if (slot.type === 'winner') {
        const row = firstByGroup[slot.groups[0]];
        return row ? row.teamId : null;
      }
      if (slot.type === 'second') {
        const row = secondByGroup[slot.groups[0]];
        return row ? row.teamId : null;
      }
      if (slot.type === 'third') {
        const picked = pickThird(slot.groups);
        return picked ? picked.teamId : null;
      }
      return null;
    }

    ROUND_OF_32_TEMPLATE_TG.forEach((tpl) => {
      const homeTeamId = resolveSide(tpl.home);
      const awayTeamId = resolveSide(tpl.away);
      const match = {
        id: tpl.id,
        round: 'R32',
        homeTeamId,
        awayTeamId,
      };
      rounds.R32.push(match);
    });

    // Дальнейшие раунды — простая сетка 16 → 8 → 4 → 2 + матч за третье
    for (let i = 0; i < 8; i++) {
      const match = {
        id: `R16-${i + 1}`,
        round: 'R16',
        homeSource: { round: 'R32', index: i * 2 },
        awaySource: { round: 'R32', index: i * 2 + 1 },
      };
      rounds.R16.push(match);
    }

    for (let i = 0; i < 4; i++) {
      const match = {
        id: `QF-${i + 1}`,
        round: 'QF',
        homeSource: { round: 'R16', index: i * 2 },
        awaySource: { round: 'R16', index: i * 2 + 1 },
      };
      rounds.QF.push(match);
    }

    for (let i = 0; i < 2; i++) {
      const match = {
        id: `SF-${i + 1}`,
        round: 'SF',
        homeSource: { round: 'QF', index: i * 2 },
        awaySource: { round: 'QF', index: i * 2 + 1 },
      };
      rounds.SF.push(match);
    }

    rounds.FINAL.push({
      id: 'FINAL-1',
      round: 'FINAL',
      homeSource: { round: 'SF', index: 0 },
      awaySource: { round: 'SF', index: 1 },
    });

    rounds.THIRD.push({
      id: 'THIRD-1',
      round: 'THIRD',
      homeSource: { round: 'SF', index: 0, loser: true },
      awaySource: { round: 'SF', index: 1, loser: true },
    });

    return rounds;
  }

  function getMatchTeamsNormal(match, rounds, winners) {
    if (match.round === 'R32') {
      return { homeId: match.homeTeamId, awayId: match.awayTeamId };
    }
    const { homeSource, awaySource } = match;
    function resolveSource(src) {
      const srcMatch = rounds[src.round][src.index];
      if (!srcMatch) return null;
      const winner = winners[srcMatch.id];
      if (!winner) return null;
      if (!src.loser) return winner;
      const t = getMatchTeamsNormal(srcMatch, rounds, winners);
      if (!t.homeId || !t.awayId) return null;
      return winner === t.homeId ? t.awayId : t.homeId;
    }
    return {
      homeId: resolveSource(homeSource),
      awayId: resolveSource(awaySource),
    };
  }

  const KO_VIEWS = {
    ko1: [
      { id: 'R32', label: '1/16 финала', from: 0, to: 8 },
      { id: 'R16', label: '1/8 финала', from: 0, to: 4 },
      { id: 'QF', label: '1/4 финала', from: 0, to: 2 },
      { id: 'SF', label: 'Полуфинал', from: 0, to: 1 },
    ],
    ko2: [
      { id: 'R32', label: '1/16 финала', from: 8, to: 16 },
      { id: 'R16', label: '1/8 финала', from: 4, to: 8 },
      { id: 'QF', label: '1/4 финала', from: 2, to: 4 },
      { id: 'SF', label: 'Полуфинал', from: 1, to: 2 },
    ],
    finals: [
      { id: 'FINAL', label: 'Финал' },
      { id: 'THIRD', label: 'Матч за 3‑е место' },
    ],
  };

  function getMatchesByView(rounds, viewId) {
    const defs = KO_VIEWS[viewId] || [];
    return defs.map((def) => {
      const all = rounds[def.id] || [];
      const from = Number.isInteger(def.from) ? def.from : 0;
      const to = Number.isInteger(def.to) ? def.to : all.length;
      return {
        ...def,
        matches: all.slice(from, to),
      };
    });
  }

  function isMatchResolved(match, rounds, winners) {
    const teams = getMatchTeamsNormal(match, rounds, winners);
    if (!teams.homeId || !teams.awayId) return false;
    const picked = winners[match.id];
    return picked === teams.homeId || picked === teams.awayId;
  }

  function isKoViewComplete(rounds, viewId) {
    const defs = getMatchesByView(rounds, viewId);
    for (const def of defs) {
      for (const match of def.matches) {
        if (!isMatchResolved(match, rounds, normalState.knockoutWinners)) {
          return false;
        }
      }
    }
    return defs.length > 0;
  }

  function koSlotRow(roundId, index) {
    // Базовая вертикальная сетка: 16 рядов-слотов для половины сетки (8 матчей R32).
    // Матч рисуем как "span 2" по гриду, поэтому шаги такие:
    // R32: 1,3,5... (шаг 2)
    // R16: 2,6,10,14 (шаг 4)
    // QF: 4,12 (шаг 8)
    // SF: 8 (шаг 16)
    const base = { R32: 1, R16: 2, QF: 4, SF: 8 }[roundId];
    const step = { R32: 2, R16: 4, QF: 8, SF: 16 }[roundId];
    if (!base || !step) return 1;
    return base + index * step;
  }

  function renderKoMatchCard(match, rounds, viewId, opts) {
    const locked = !!(opts && opts.locked);
        const teams = getMatchTeamsNormal(match, rounds, normalState.knockoutWinners);
        const homeTeam = teams.homeId ? findTeamById(teams.homeId) : null;
        const awayTeam = teams.awayId ? findTeamById(teams.awayId) : null;

        const card = document.createElement('div');
        card.className = 'tg-ko-match';

        function makeRow(team) {
          const btn = document.createElement('button');
          btn.className = 'tg-ko-team';
          if (!team) {
            btn.disabled = true;
            btn.textContent = '—';
            return btn;
          }
          const isWinner = normalState.knockoutWinners[match.id] === team.id;
          if (isWinner) btn.classList.add('tg-ko-team-winner');
          btn.innerHTML = `
            <span class="flag-wrap">${renderFlagHtmlSimple(team)}</span>
            <span class="team-name">${team.name}</span>
            <span class="tg-ko-pick">✓</span>
          `;
          btn.addEventListener('click', (e) => {
        if (locked) return;
            if (!e.target.closest('.tg-ko-pick')) return;
            const gridEl = document.querySelector('.tg-ko-grid');
            const scrollLeft = gridEl ? gridEl.scrollLeft : 0;
            normalState.knockoutWinners[match.id] = team.id;
            renderNormalMode();
            const newGrid = document.querySelector('.tg-ko-grid');
            if (newGrid) newGrid.scrollLeft = scrollLeft;
          });
          return btn;
        }

        card.appendChild(makeRow(homeTeam));
        card.appendChild(makeRow(awayTeam));

    return card;
  }

  function renderFinalsNormal(rounds) {
    const finalMatch = (rounds.FINAL && rounds.FINAL[0]) || null;
    const thirdMatch = (rounds.THIRD && rounds.THIRD[0]) || null;

    const wrapper = document.createElement('div');
    wrapper.className = 'tg-ko-finals';

    const top = document.createElement('div');
    top.className = 'tg-ko-finals-top';

    const championCard = document.createElement('div');
    championCard.className = 'tg-ko-champion';
    championCard.innerHTML = `
      <div class="tg-ko-champion-label">Чемпион мира</div>
      <div class="tg-ko-champion-team">—</div>
    `;

    let championTeam = null;
    let finalHomeTeam = null;
    let finalAwayTeam = null;
    let locked = false;
    if (finalMatch) {
      const t = getMatchTeamsNormal(finalMatch, rounds, normalState.knockoutWinners);
      finalHomeTeam = t.homeId ? findTeamById(t.homeId) : null;
      finalAwayTeam = t.awayId ? findTeamById(t.awayId) : null;
      const winnerId = normalState.knockoutWinners[finalMatch.id];
      if (winnerId) {
        championTeam = findTeamById(winnerId);
        locked = true;
      }
    }

    if (locked) wrapper.classList.add('tg-ko-finals--locked');

    const leftFinalist = document.createElement('button');
    leftFinalist.type = 'button';
    leftFinalist.className = 'tg-ko-finalist';
    leftFinalist.disabled = locked || !finalHomeTeam || !finalAwayTeam;
    leftFinalist.innerHTML = finalHomeTeam
      ? `${renderFlagHtmlSimple(finalHomeTeam)}<span>${finalHomeTeam.name}</span>`
      : '<span>—</span>';

    const rightFinalist = document.createElement('button');
    rightFinalist.type = 'button';
    rightFinalist.className = 'tg-ko-finalist';
    rightFinalist.disabled = locked || !finalHomeTeam || !finalAwayTeam;
    rightFinalist.innerHTML = finalAwayTeam
      ? `${renderFlagHtmlSimple(finalAwayTeam)}<span>${finalAwayTeam.name}</span>`
      : '<span>—</span>';

    if (finalMatch && finalHomeTeam && finalAwayTeam && !locked) {
      leftFinalist.addEventListener('click', () => {
        normalState.knockoutWinners[finalMatch.id] = finalHomeTeam.id;
        renderNormalMode();
      });
      rightFinalist.addEventListener('click', () => {
        normalState.knockoutWinners[finalMatch.id] = finalAwayTeam.id;
        renderNormalMode();
      });
    }

    const champTeamEl = championCard.querySelector('.tg-ko-champion-team');
    if (champTeamEl) {
      champTeamEl.innerHTML = championTeam
        ? `${renderFlagHtmlSimple(championTeam)}<span>${championTeam.name}</span>`
        : '—';
    }

    top.appendChild(leftFinalist);
    top.appendChild(championCard);
    top.appendChild(rightFinalist);

    const bottom = document.createElement('div');
    bottom.className = 'tg-ko-finals-bottom';

    const thirdBlock = document.createElement('div');
    thirdBlock.className = 'tg-ko-finals-match tg-ko-finals-third';
    thirdBlock.innerHTML = `<div class="tg-ko-finals-title">3‑е место</div>`;
    if (thirdMatch)
      thirdBlock.appendChild(renderKoMatchCard(thirdMatch, rounds, 'finals', { locked }));

    bottom.appendChild(thirdBlock);

    wrapper.appendChild(top);
    wrapper.appendChild(bottom);
    return wrapper;
  }

  function renderKnockoutNormal(rounds, viewId) {
    if (viewId === 'finals') {
      return renderFinalsNormal(rounds);
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'tg-ko-grid tg-ko-grid--bracket';

    const roundDefs = getMatchesByView(rounds, viewId);
    roundDefs.forEach((rdef) => {
      const col = document.createElement('div');
      col.className = 'tg-ko-column';

      const head = document.createElement('div');
      head.className = 'tg-ko-column-title';
      head.textContent = rdef.label;
      col.appendChild(head);

      const list = document.createElement('div');
      list.className = 'tg-ko-column-matches tg-ko-bracket-col';
      list.style.setProperty('--ko-rows', '16');

      const matches = rdef.matches || [];
      matches.forEach((match, i) => {
        const card = renderKoMatchCard(match, rounds, viewId);
        const row = koSlotRow(rdef.id, i);
        card.style.gridRow = `${row} / span 2`;
        list.appendChild(card);
      });

      col.appendChild(list);
      wrapper.appendChild(col);
    });

    return wrapper;
  }

  function renderNormalMode() {
    ensureNormalGroupOrder();
    root.innerHTML = '';

    const container = document.createElement('div');
    container.className = 'tg-screen tg-level-screen';

    const title = document.createElement('h1');
    title.className = 'tg-title';
    title.textContent = 'Нормальный режим';

    const subtitle = document.createElement('p');
    subtitle.className = 'tg-subtitle';
    subtitle.textContent = 'Режим этапов: группы → плей‑офф (2 части) → финал.';

    const groupsGrid = document.createElement('div');
    groupsGrid.className = 'groups-grid';

    // Рендер групп
    for (const group of WORLD_CUP_2026_CONFIG.groups) {
      const card = document.createElement('div');
      card.className = 'group-card';

      const header = document.createElement('div');
      header.className = 'group-header';
      header.innerHTML = `
        <div>
          <div class="group-title">${group.name}</div>
          <div class="group-subtitle">Тап — смена мест (1–4)</div>
        </div>
      `;
      card.appendChild(header);

      const list = document.createElement('div');
      list.className = 'group-teams-list';

      const order = normalState.groupOrder[group.id] || group.teams.map((t) => t.id);

      order.forEach((teamId, index) => {
        const team = findTeamById(teamId);
        if (!team) return;
        const row = document.createElement('div');
        row.className = 'team-card';
        row.draggable = true;
        row.dataset.groupId = group.id;
        row.dataset.teamId = teamId;
        row.innerHTML = `
          <span class="team-position">${index + 1}</span>
          <div class="standings-team" title="Двойной тап — состав">
            ${renderFlagHtmlSimple(team)}
            <span class="team-name">${team.name}</span>
          </div>
          <button type="button" class="team-squad-btn" data-team-id="${teamId}" aria-label="Состав сборной" title="Состав">👕</button>
        `;
        list.appendChild(row);
      });

      card.appendChild(list);
      groupsGrid.appendChild(card);
    }

    // Панель выбора 8 лучших третьих мест
    const thirdsPanel = document.createElement('div');
    thirdsPanel.className = 'thirds-panel';

    // Нормализуем выбор третьих мест под текущее расположение команд
    const currentThirdByGroup = {};
    for (const group of WORLD_CUP_2026_CONFIG.groups) {
      const order = normalState.groupOrder[group.id] || group.teams.map((t) => t.id);
      if (order[2]) currentThirdByGroup[group.id] = order[2];
    }
    if (!Array.isArray(normalState.bestThirds)) {
      normalState.bestThirds = [];
    } else {
      normalState.bestThirds = normalState.bestThirds.filter(
        (x) => currentThirdByGroup[x.groupId] === x.teamId
      );
    }
    const selected = normalState.bestThirds;

    // Ключ для отслеживания изменения групп/третьих мест
    const qualKey = JSON.stringify({
      groupOrder: normalState.groupOrder,
      bestThirds: selected,
    });
    if (normalState.lastQualKey !== qualKey) {
      normalState.knockoutWinners = {};
      normalState.lastQualKey = qualKey;
    }
    const header = document.createElement('div');
    header.className = 'thirds-header';
    header.innerHTML = `
      <span class="thirds-title">Выбор 8 лучших третьих мест</span>
      <span class="badge">${selected.length} из 8 выбрано</span>
    `;
    thirdsPanel.appendChild(header);

    const listThirds = document.createElement('div');
    listThirds.className = 'thirds-list';

    for (const group of WORLD_CUP_2026_CONFIG.groups) {
      const order = normalState.groupOrder[group.id] || group.teams.map((t) => t.id);
      const thirdTeamId = order[2];
      if (!thirdTeamId) continue;
      const team = findTeamById(thirdTeamId);
      if (!team) continue;
      const isSelected = selected.some(
        (x) => x.groupId === group.id && x.teamId === thirdTeamId
      );
      const pill = document.createElement('button');
      pill.className = 'third-pill' + (isSelected ? ' third-pill-selected' : '');
      pill.dataset.groupId = group.id;
      pill.dataset.teamId = thirdTeamId;
      pill.innerHTML = `
        <span class="badge">${group.id}-3</span>
        ${renderFlagHtmlSimple(team)}
        <span class="team-name">${team.name}</span>
      `;
      listThirds.appendChild(pill);
    }

    thirdsPanel.appendChild(listThirds);

    const qualifiers = calcQualifiersNormalFromState();
    const bracket = buildBracketNormal(qualifiers);

    if (normalState.stage !== 'groups' && selected.length !== 8) {
      normalState.stage = 'groups';
    }

    const stageNav = document.createElement('div');
    stageNav.className = 'tg-stage-nav';

    const leftBtn = document.createElement('button');
    leftBtn.className = 'tg-back-button';

    const rightBtn = document.createElement('button');
    rightBtn.className = 'tg-back-button tg-next-button';
    let showRight = false;

    if (normalState.stage === 'groups') {
      if (launchContext.fromHub) {
        leftBtn.textContent = '← К списку игр';
        leftBtn.addEventListener('click', exitAppOrMenu);
      } else {
        leftBtn.textContent = '← Назад к выбору уровня';
        leftBtn.addEventListener('click', renderStartScreen);
      }
      if (selected.length === 8) {
        rightBtn.textContent = 'Перейти к плей‑офф →';
        rightBtn.addEventListener('click', () => {
          normalState.stage = 'ko1';
          renderNormalMode();
        });
        showRight = true;
      }
    } else if (normalState.stage === 'ko1') {
      leftBtn.textContent = '← К группам';
      leftBtn.addEventListener('click', () => {
        normalState.stage = 'groups';
        renderNormalMode();
      });
      if (isKoViewComplete(bracket, 'ko1')) {
        rightBtn.textContent = 'Вторая половина сетки →';
        rightBtn.addEventListener('click', () => {
          normalState.stage = 'ko2';
          renderNormalMode();
        });
        showRight = true;
      }
    } else if (normalState.stage === 'ko2') {
      leftBtn.textContent = '← Первая половина';
      leftBtn.addEventListener('click', () => {
        normalState.stage = 'ko1';
        renderNormalMode();
      });
      if (isKoViewComplete(bracket, 'ko2')) {
        rightBtn.textContent = 'К финалу →';
        rightBtn.addEventListener('click', () => {
          normalState.stage = 'finals';
          renderNormalMode();
        });
        showRight = true;
      }
    } else {
      const finalMatch = (bracket.FINAL && bracket.FINAL[0]) || null;
      const locked =
        !!(finalMatch && isMatchResolved(finalMatch, bracket, normalState.knockoutWinners));
      if (locked) {
        leftBtn.textContent = launchContext.fromHub ? '← К списку игр' : '← В главное меню';
        leftBtn.addEventListener('click', exitAppOrMenu);
      } else {
        leftBtn.textContent = '← Ко второй половине';
        leftBtn.addEventListener('click', () => {
          normalState.stage = 'ko2';
          renderNormalMode();
        });
      }
    }

    stageNav.appendChild(leftBtn);
    if (showRight) stageNav.appendChild(rightBtn);
    container.appendChild(stageNav);
    container.appendChild(title);
    container.appendChild(subtitle);

    const squadHint = document.createElement('p');
    squadHint.className = 'tg-hint tg-squad-hint';
    squadHint.textContent =
      'Состав на поле (карточки). Открыть: 👕 или двойной тап по названию.';

    if (normalState.stage === 'groups') {
    container.appendChild(groupsGrid);
      container.appendChild(squadHint);
    container.appendChild(thirdsPanel);
    } else if (selected.length === 8) {
      const koWrapper = document.createElement('div');
      koWrapper.className = 'tg-ko-wrapper';

      const koTitle = document.createElement('h2');
      koTitle.className = 'tg-title';
      if (normalState.stage === 'ko1') {
        koTitle.textContent = 'Плей‑офф · часть 1';
      } else if (normalState.stage === 'ko2') {
        koTitle.textContent = 'Плей‑офф · часть 2';
      } else {
        koTitle.textContent = 'Финал и 3-е место';
      }
      koWrapper.appendChild(koTitle);

      const koGrid = renderKnockoutNormal(
        bracket,
        normalState.stage === 'ko1'
          ? 'ko1'
          : normalState.stage === 'ko2'
            ? 'ko2'
            : 'finals'
      );
      koWrapper.appendChild(koGrid);

      container.appendChild(koWrapper);
    }

    root.appendChild(container);

    // Перестановка команд тапами (удобно на телефоне, работает и с мышью)
    let selectedTeamId = null;
    let selectedGroupId = null;

    bindSquadOpenTriggers(groupsGrid);

    groupsGrid.querySelectorAll('.team-card').forEach((row) => {
      row.addEventListener('click', () => {
        const teamId = row.dataset.teamId;
        const groupId = row.dataset.groupId;

        // первый тап — выбор
        if (!selectedTeamId || selectedGroupId !== groupId || selectedTeamId === teamId) {
          selectedTeamId = teamId;
          selectedGroupId = groupId;

          groupsGrid.querySelectorAll('.team-card').forEach((r) =>
            r.classList.remove('team-card-selected')
          );
          row.classList.add('team-card-selected');
          return;
        }

        // второй тап по другой команде в той же группе — обмен местами
        const arr = normalState.groupOrder[groupId] || [];
        const from = arr.indexOf(selectedTeamId);
        const to = arr.indexOf(teamId);
        if (from === -1 || to === -1) {
          selectedTeamId = null;
          selectedGroupId = null;
          groupsGrid.querySelectorAll('.team-card').forEach((r) =>
            r.classList.remove('team-card-selected')
          );
          return;
        }
        const tmp = arr[from];
        arr[from] = arr[to];
        arr[to] = tmp;

        selectedTeamId = null;
        selectedGroupId = null;
        normalState.stage = 'groups';
        renderNormalMode();
      });
    });

    // Клики по третьим местам
    thirdsPanel.querySelectorAll('.third-pill').forEach((pill) => {
      pill.addEventListener('click', () => {
        const groupId = pill.dataset.groupId;
        const teamId = pill.dataset.teamId;
        if (!Array.isArray(normalState.bestThirds)) {
          normalState.bestThirds = [];
        }
        const arr = normalState.bestThirds;
        const idx = arr.findIndex((x) => x.groupId === groupId && x.teamId === teamId);
        if (idx !== -1) {
          arr.splice(idx, 1);
          normalState.stage = 'groups';
          renderNormalMode();
          return;
        }
        if (arr.length >= 8) {
          alert('Можно выбрать максимум 8 команд.');
          return;
        }
        const existingIdx = arr.findIndex((x) => x.groupId === groupId);
        if (existingIdx !== -1) arr.splice(existingIdx, 1);
        arr.push({ groupId, teamId });
        normalState.stage = 'groups';
        renderNormalMode();
      });
    });
  }

  // --- Лёгкий режим (автосимуляция) ---

  const EASY_STAGES = [
    { id: 'groups', label: 'Группы' },
    { id: 'ko1', label: 'Плей‑офф 1' },
    { id: 'ko2', label: 'Плей‑офф 2' },
    { id: 'finals', label: 'Финал' },
  ];

  function runEasySimulation() {
    if (typeof SimEngine === 'undefined') {
      alert('Движок симуляции не загружен.');
      return;
    }
    easyState.data = SimEngine.runTournament(buildBracketNormal);
    easyState.simulated = true;
    easyState.stage = 'groups';
    renderEasyMode();
  }

  function formatGoalDiff(gd) {
    if (gd > 0) return `+${gd}`;
    return String(gd);
  }

  function renderEasyGroupStatsRow(stats) {
    if (!stats) {
      return '<span class="team-group-stats team-group-stats--empty">— — — —</span>';
    }
    const gd = stats.goalsFor - stats.goalsAgainst;
    return `
      <span class="team-group-stats" title="Очки · забито · пропущено · разница">
        <span class="team-stat">${stats.points}</span>
        <span class="team-stat">${stats.goalsFor}</span>
        <span class="team-stat">${stats.goalsAgainst}</span>
        <span class="team-stat">${formatGoalDiff(gd)}</span>
      </span>
    `;
  }

  function renderEasyGroupsGrid(simulated, standingsByGroup) {
    const grid = document.createElement('div');
    grid.className = 'groups-grid';

    for (const group of WORLD_CUP_2026_CONFIG.groups) {
      const card = document.createElement('div');
      card.className = 'group-card';

      const header = document.createElement('div');
      header.className = 'group-header';
      header.innerHTML = `
        <div>
          <div class="group-title">${group.name}</div>
          <div class="group-subtitle">${
            simulated
              ? 'О · ЗМ · ПМ · Р'
              : 'Нажми «Симулировать» — появятся очки и голы'
          }</div>
        </div>
      `;
      card.appendChild(header);

      const list = document.createElement('div');
      list.className = 'group-teams-list';

      const standings = simulated ? standingsByGroup[group.id] || [] : [];
      const rows = simulated
        ? standings
        : group.teams.map((t) => ({ teamId: t.id }));

      rows.forEach((row, index) => {
        const team = findTeamById(row.teamId);
        if (!team) return;

        const line = document.createElement('div');
        line.className = 'team-card team-card--easy';
        line.dataset.teamId = team.id;

        line.innerHTML = `
          <span class="team-position">${index + 1}</span>
          <div class="standings-team" title="Двойной тап — состав">
            ${renderFlagHtmlSimple(team)}
            <span class="team-name">${team.name}</span>
          </div>
          ${renderEasyGroupStatsRow(simulated ? row : null)}
          <button type="button" class="team-squad-btn" data-team-id="${team.id}" aria-label="Состав сборной" title="Состав">👕</button>
        `;
        list.appendChild(line);
      });

      card.appendChild(list);
      grid.appendChild(card);
    }

    bindSquadOpenTriggers(grid);
    return grid;
  }

  function renderEasyThirdsPanel(bestThirds) {
    const panel = document.createElement('div');
    panel.className = 'thirds-panel thirds-panel--readonly';

    const header = document.createElement('div');
    header.className = 'thirds-header';
    header.innerHTML = `
      <span class="thirds-title">8 лучших третьих мест</span>
      <span class="badge">${bestThirds.length} из 8</span>
    `;
    panel.appendChild(header);

    const list = document.createElement('div');
    list.className = 'thirds-list';

    const selectedSet = new Set(bestThirds.map((x) => `${x.groupId}:${x.teamId}`));

    for (const group of WORLD_CUP_2026_CONFIG.groups) {
      const st = easyState.data.standingsByGroup[group.id] || [];
      const third = st[2];
      if (!third) continue;
      const team = findTeamById(third.teamId);
      if (!team) continue;
      const isSelected = selectedSet.has(`${group.id}:${third.teamId}`);

      const pill = document.createElement('div');
      pill.className = 'third-pill' + (isSelected ? ' third-pill-selected' : ' third-pill-muted');
      pill.innerHTML = `
        <span class="badge">${group.id}-3</span>
        ${renderFlagHtmlSimple(team)}
        <span class="team-name">${team.name}</span>
        ${isSelected ? '' : '<span class="third-pill-out">не прошла</span>'}
      `;
      list.appendChild(pill);
    }

    panel.appendChild(list);
    return panel;
  }

  function renderKoMatchCardEasy(match, rounds, winners, results) {
    const teams = getMatchTeamsNormal(match, rounds, winners);
    const homeTeam = teams.homeId ? findTeamById(teams.homeId) : null;
    const awayTeam = teams.awayId ? findTeamById(teams.awayId) : null;
    const res = results[match.id] || {};
    const winnerId = winners[match.id];

    const card = document.createElement('div');
    card.className = 'tg-ko-match tg-ko-match--scored';

    function makeRow(team, score) {
      const row = document.createElement('div');
      row.className = 'tg-ko-team-row';

      const inner = document.createElement('div');
      inner.className = 'tg-ko-team tg-ko-team--readonly';
      if (team && winnerId === team.id) inner.classList.add('tg-ko-team-winner');

      if (!team) {
        inner.textContent = '—';
      } else {
        inner.innerHTML = `
          <span class="flag-wrap">${renderFlagHtmlSimple(team)}</span>
          <span class="team-name">${team.name}</span>
        `;
      }

      const scoreEl = document.createElement('span');
      scoreEl.className = 'tg-ko-score';
      scoreEl.textContent = score != null ? String(score) : '—';

      row.appendChild(inner);
      row.appendChild(scoreEl);
      return row;
    }

    card.appendChild(makeRow(homeTeam, res.homeGoals));
    card.appendChild(makeRow(awayTeam, res.awayGoals));
    return card;
  }

  function renderFinalsEasy(rounds, winners, results) {
    const finalMatch = (rounds.FINAL && rounds.FINAL[0]) || null;
    const thirdMatch = (rounds.THIRD && rounds.THIRD[0]) || null;

    const wrapper = document.createElement('div');
    wrapper.className = 'tg-ko-finals tg-ko-finals--locked';

    const top = document.createElement('div');
    top.className = 'tg-ko-finals-top';

    const championCard = document.createElement('div');
    championCard.className = 'tg-ko-champion';
    championCard.innerHTML = `
      <div class="tg-ko-champion-label">Чемпион мира</div>
      <div class="tg-ko-champion-team">—</div>
    `;

    let championTeam = null;
    let finalHomeTeam = null;
    let finalAwayTeam = null;
    let finalScore = '';

    if (finalMatch) {
      const t = getMatchTeamsNormal(finalMatch, rounds, winners);
      finalHomeTeam = t.homeId ? findTeamById(t.homeId) : null;
      finalAwayTeam = t.awayId ? findTeamById(t.awayId) : null;
      const res = results[finalMatch.id] || {};
      if (res.homeGoals != null && res.awayGoals != null) {
        finalScore = `${res.homeGoals}:${res.awayGoals}`;
      }
      const winnerId = winners[finalMatch.id];
      if (winnerId) championTeam = findTeamById(winnerId);
    }

    function finalistHtml(team) {
      return team
        ? `${renderFlagHtmlSimple(team)}<span>${team.name}</span>`
        : '<span>—</span>';
    }

    const leftFinalist = document.createElement('div');
    leftFinalist.className = 'tg-ko-finalist tg-ko-finalist--readonly';
    leftFinalist.innerHTML = finalHomeTeam ? finalistHtml(finalHomeTeam) : '<span>—</span>';

    const rightFinalist = document.createElement('div');
    rightFinalist.className = 'tg-ko-finalist tg-ko-finalist--readonly';
    rightFinalist.innerHTML = finalAwayTeam ? finalistHtml(finalAwayTeam) : '<span>—</span>';

    const champTeamEl = championCard.querySelector('.tg-ko-champion-team');
    if (champTeamEl) {
      champTeamEl.innerHTML = championTeam
        ? `${renderFlagHtmlSimple(championTeam)}<span>${championTeam.name}</span>`
        : '—';
    }

    if (finalScore) {
      const scoreNote = document.createElement('div');
      scoreNote.className = 'tg-ko-finals-score';
      scoreNote.textContent = `Финал: ${finalScore}`;
      championCard.appendChild(scoreNote);
    }

    top.appendChild(leftFinalist);
    top.appendChild(championCard);
    top.appendChild(rightFinalist);

    const bottom = document.createElement('div');
    bottom.className = 'tg-ko-finals-bottom';

    const thirdBlock = document.createElement('div');
    thirdBlock.className = 'tg-ko-finals-match tg-ko-finals-third';
    thirdBlock.innerHTML = `<div class="tg-ko-finals-title">3‑е место</div>`;
    if (thirdMatch) {
      thirdBlock.appendChild(renderKoMatchCardEasy(thirdMatch, rounds, winners, results));
    }

    bottom.appendChild(thirdBlock);
    wrapper.appendChild(top);
    wrapper.appendChild(bottom);
    return wrapper;
  }

  function renderKnockoutEasy(rounds, viewId, winners, results) {
    if (viewId === 'finals') {
      return renderFinalsEasy(rounds, winners, results);
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'tg-ko-grid tg-ko-grid--bracket';

    const roundDefs = getMatchesByView(rounds, viewId);
    roundDefs.forEach((rdef) => {
      const col = document.createElement('div');
      col.className = 'tg-ko-column';

      const head = document.createElement('div');
      head.className = 'tg-ko-column-title';
      head.textContent = rdef.label;
      col.appendChild(head);

      const list = document.createElement('div');
      list.className = 'tg-ko-column-matches tg-ko-bracket-col';
      list.style.setProperty('--ko-rows', '16');

      (rdef.matches || []).forEach((match, i) => {
        const card = renderKoMatchCardEasy(match, rounds, winners, results);
        const row = koSlotRow(rdef.id, i);
        card.style.gridRow = `${row} / span 2`;
        list.appendChild(card);
      });

      col.appendChild(list);
      wrapper.appendChild(col);
    });

    return wrapper;
  }

  function renderEasyMode() {
    root.innerHTML = '';

    const container = document.createElement('div');
    container.className = 'tg-screen tg-level-screen tg-easy-screen';

    const stageNav = document.createElement('div');
    stageNav.className = 'tg-stage-nav';

    const leftBtn = document.createElement('button');
    leftBtn.className = 'tg-back-button';
    leftBtn.textContent = launchContext.fromHub ? '← К списку игр' : '← Назад';
    leftBtn.addEventListener('click', launchContext.fromHub ? exitAppOrMenu : renderStartScreen);
    stageNav.appendChild(leftBtn);

    if (!easyState.simulated) {
      const simBtn = document.createElement('button');
      simBtn.className = 'tg-back-button tg-simulate-button';
      simBtn.textContent = 'Симулировать турнир';
      simBtn.addEventListener('click', runEasySimulation);
      stageNav.appendChild(simBtn);
    } else {
      const againBtn = document.createElement('button');
      againBtn.className = 'tg-back-button tg-simulate-button tg-simulate-button--secondary';
      againBtn.textContent = 'Заново';
      againBtn.addEventListener('click', runEasySimulation);
      stageNav.appendChild(againBtn);
    }

    container.appendChild(stageNav);

    const title = document.createElement('h1');
    title.className = 'tg-title';
    title.textContent = 'Лёгкий режим';

    const subtitle = document.createElement('p');
    subtitle.className = 'tg-subtitle';
    if (!easyState.simulated) {
      subtitle.textContent =
        'Автосимуляция всего турнира. Сначала нажми кнопку сверху — потом можно листать этапы.';
    } else if (
      easyState.data &&
      !easyState.data.ratingsConfigured &&
      typeof SimEngine !== 'undefined' &&
      !SimEngine.hasConfiguredRatings()
    ) {
      subtitle.textContent =
        'Демо-прогон на заглушках рейтинга. После добавления FIFA и формы результаты станут реалистичнее.';
    } else {
      subtitle.textContent = 'Турнир симулирован. Переключай этапы ниже.';
    }

    container.appendChild(title);
    container.appendChild(subtitle);

    if (easyState.simulated) {
      const tabs = document.createElement('div');
      tabs.className = 'tg-easy-tabs';
      tabs.setAttribute('role', 'tablist');

      EASY_STAGES.forEach((st) => {
        const tab = document.createElement('button');
        tab.type = 'button';
        tab.className =
          'tg-easy-tab' + (easyState.stage === st.id ? ' tg-easy-tab--active' : '');
        tab.textContent = st.label;
        tab.setAttribute('role', 'tab');
        tab.setAttribute('aria-selected', easyState.stage === st.id ? 'true' : 'false');
        tab.addEventListener('click', () => {
          easyState.stage = st.id;
          renderEasyMode();
        });
        tabs.appendChild(tab);
      });

      container.appendChild(tabs);
    }

    const data = easyState.data;
    const standingsByGroup = data ? data.standingsByGroup : {};

    if (!easyState.simulated || easyState.stage === 'groups') {
      container.appendChild(renderEasyGroupsGrid(easyState.simulated, standingsByGroup));

      if (easyState.simulated && data) {
        container.appendChild(renderEasyThirdsPanel(data.bestThirds || []));
      }
    } else if (data && data.rounds) {
      const koWrapper = document.createElement('div');
      koWrapper.className = 'tg-ko-wrapper';

      const koTitle = document.createElement('h2');
      koTitle.className = 'tg-title tg-title--section';
      if (easyState.stage === 'ko1') koTitle.textContent = 'Плей‑офф · часть 1';
      else if (easyState.stage === 'ko2') koTitle.textContent = 'Плей‑офф · часть 2';
      else koTitle.textContent = 'Финал и 3-е место';

      koWrapper.appendChild(koTitle);
      koWrapper.appendChild(
        renderKnockoutEasy(
          data.rounds,
          easyState.stage,
          data.knockoutWinners,
          data.knockoutResults
        )
      );
      container.appendChild(koWrapper);
    }

    root.appendChild(container);
  }

  function renderLevelStub(level) {
    if (level.id === 'normal') {
      renderNormalMode();
      return;
    }
    if (level.id === 'easy') {
      renderEasyMode();
      return;
    }
    root.innerHTML = '';

    const container = document.createElement('div');
    container.className = 'tg-screen tg-level-screen';

    const back = document.createElement('button');
    back.className = 'tg-back-button';
    back.textContent = launchContext.fromHub ? '← К списку игр' : '← Назад к выбору уровня';
    back.addEventListener('click', launchContext.fromHub ? exitAppOrMenu : renderStartScreen);

    const title = document.createElement('h1');
    title.className = 'tg-title';
    title.textContent = `Режим: ${level.title}`;

    const subtitle = document.createElement('p');
    subtitle.className = 'tg-subtitle';
    subtitle.textContent = level.subtitle;

    container.appendChild(back);
    container.appendChild(title);
    container.appendChild(subtitle);

    root.appendChild(container);
  }

  function renderStartScreen() {
    root.innerHTML = '';

    const container = document.createElement('div');
    container.className = 'tg-screen tg-start-screen';

    const header = document.createElement('div');
    header.className = 'tg-header';

    const title = document.createElement('h1');
    title.className = 'tg-title';
    title.textContent = 'Симулятор ЧМ‑2026';

    const subtitle = document.createElement('p');
    subtitle.className = 'tg-subtitle';
    subtitle.textContent = 'Выбери уровень сложности, с которого хочешь начать.';

    header.appendChild(title);
    header.appendChild(subtitle);

    const grid = document.createElement('div');
    grid.className = 'tg-level-grid';

    LEVELS.forEach((level) => {
      const card = document.createElement('button');
      card.className = 'tg-level-card';
      if (level.disabled) {
        card.classList.add('tg-level-card-disabled');
      }

      const lvlTitle = document.createElement('div');
      lvlTitle.className = 'tg-level-title';
      lvlTitle.textContent = level.title;

      const lvlSubtitle = document.createElement('div');
      lvlSubtitle.className = 'tg-level-subtitle';
      lvlSubtitle.textContent = level.subtitle;

      const lvlDesc = document.createElement('div');
      lvlDesc.className = 'tg-level-description';
      lvlDesc.textContent = level.description;

      card.appendChild(lvlTitle);
      card.appendChild(lvlSubtitle);
      card.appendChild(lvlDesc);

      if (!level.disabled) {
        card.addEventListener('click', () => renderLevelStub(level));
      }

      grid.appendChild(card);
    });

    container.appendChild(header);
    container.appendChild(grid);

    root.appendChild(container);
  }

  if (launchContext.autoNormal) {
    renderNormalMode();
  } else {
  renderStartScreen();
  }
});

