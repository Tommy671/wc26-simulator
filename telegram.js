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
    // telegram.html всегда с темой миниаппа; в браузере SDK иногда не успевает при жёстком F5
    document.documentElement.classList.add('tg-webapp');

    if (!wa) return;

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
    { id: 'easy', title: 'Лёгкий', subtitle: 'Полная автоматическая симуляция' },
    { id: 'normal', title: 'Нормальный', subtitle: 'Ручной выбор победителя матча' },
    { id: 'hard', title: 'Сложный', subtitle: 'Настройка счёта и таблиц' },
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

  const hardState = {
    stage: 'groups',
    groupMatchesByGroup: {},
    knockoutResults: {},
    lastQualKey: null,
    focusAfterRender: null,
  };

  const shareState = {
    available: false,
    modeLabel: '',
    championName: '',
    finalScore: '',
    lines: [],
    poster: null,
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

  const TG_STAGE_TABS = [
    { id: 'groups', label: 'Группы' },
    { id: 'ko1', label: 'Левая сетка' },
    { id: 'ko2', label: 'Правая сетка' },
    { id: 'finals', label: 'Финал' },
  ];

  function renderStageTabs(currentStage, onSelect) {
    const tabs = document.createElement('div');
    tabs.className = 'tg-stage-tabs';
    tabs.setAttribute('role', 'tablist');

    TG_STAGE_TABS.forEach((st) => {
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className =
        'tg-stage-tab' + (currentStage === st.id ? ' tg-stage-tab--active' : '');
      tab.textContent = st.label;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', currentStage === st.id ? 'true' : 'false');
      tab.addEventListener('click', () => onSelect(st.id));
      tabs.appendChild(tab);
    });

    return tabs;
  }

  function formatGoalDiff(gd) {
    if (gd > 0) return `+${gd}`;
    return String(gd);
  }

  function setShareState(payload) {
    if (!payload || !payload.available) {
      shareState.available = false;
      shareState.modeLabel = '';
      shareState.championName = '';
      shareState.finalScore = '';
      shareState.lines = [];
      shareState.poster = null;
      return;
    }
    shareState.available = true;
    shareState.modeLabel = payload.modeLabel || '';
    shareState.championName = payload.championName || '';
    shareState.finalScore = payload.finalScore || '';
    shareState.lines = Array.isArray(payload.lines) ? payload.lines.slice(0, 6) : [];
    shareState.poster = payload.poster || null;
  }

  function getShareCaption() {
    const champ = shareState.championName || '—';
    const scorePart = shareState.finalScore ? `\nФинал: ${shareState.finalScore}` : '';
    const extra = shareState.lines.length ? `\n${shareState.lines.join('\n')}` : '';
    return `Мой результат в симуляторе ЧМ-2026 (${shareState.modeLabel}):\nЧемпион — ${champ}${scorePart}${extra}\n\nСобери свой турнир в МЯЧ Играх.`;
  }

  function shortenName(name, maxLen) {
    const n = String(name || '');
    if (n.length <= maxLen) return n;
    return `${n.slice(0, Math.max(1, maxLen - 1))}…`;
  }

  function buildGroupPosterData(standingsByGroup, withStats) {
    return WORLD_CUP_2026_CONFIG.groups.map((group) => {
      const rows = (standingsByGroup[group.id] || []).slice(0, 4).map((row, idx) => {
        const team = findTeamById(row.teamId);
        const gd = Number.isInteger(row.goalsFor) && Number.isInteger(row.goalsAgainst)
          ? row.goalsFor - row.goalsAgainst
          : null;
        return {
          pos: idx + 1,
          teamName: team ? team.name : row.teamId,
          points: Number.isInteger(row.points) ? row.points : null,
          gd,
        };
      });
      return { id: group.id, title: group.name, rows, withStats };
    });
  }

  function buildKnockoutPosterData(rounds, winners, results) {
    const defs = [
      { id: 'R32', label: '1/16', total: 16 },
      { id: 'R16', label: '1/8', total: 8 },
      { id: 'QF', label: '1/4', total: 4 },
      { id: 'SF', label: '1/2', total: 2 },
      { id: 'FINAL', label: 'Финал', total: 1 },
    ];
    const stages = defs.map((d) => {
      const list = rounds[d.id] || [];
      const played = list.filter((m) => !!winners[m.id]).length;
      return { label: d.label, played, total: d.total };
    });

    function teamNameById(teamId) {
      const t = teamId ? findTeamById(teamId) : null;
      return t ? t.name : '—';
    }

    function matchDisplay(match) {
      const teams = getMatchTeamsNormal(match, rounds, winners);
      const homeName = teamNameById(teams.homeId);
      const awayName = teamNameById(teams.awayId);
      const winnerId = winners[match.id] || null;
      const winnerName = winnerId ? teamNameById(winnerId) : '';
      const r = results && results[match.id] ? results[match.id] : null;
      const score =
        r && Number.isInteger(r.homeGoals) && Number.isInteger(r.awayGoals)
          ? `${r.homeGoals}:${r.awayGoals}`
          : '';
      const homeScore = r && Number.isInteger(r.homeGoals) ? String(r.homeGoals) : '—';
      const awayScore = r && Number.isInteger(r.awayGoals) ? String(r.awayGoals) : '—';
      return {
        homeName,
        awayName,
        winnerName,
        label: winnerName || `${homeName}/${awayName}`,
        score,
        homeScore,
        awayScore,
      };
    }

    const left = {
      R32: (rounds.R32 || []).slice(0, 8).map(matchDisplay),
      R16: (rounds.R16 || []).slice(0, 4).map(matchDisplay),
      QF: (rounds.QF || []).slice(0, 2).map(matchDisplay),
      SF: (rounds.SF || []).slice(0, 1).map(matchDisplay),
    };
    const right = {
      R32: (rounds.R32 || []).slice(8, 16).map(matchDisplay),
      R16: (rounds.R16 || []).slice(4, 8).map(matchDisplay),
      QF: (rounds.QF || []).slice(2, 4).map(matchDisplay),
      SF: (rounds.SF || []).slice(1, 2).map(matchDisplay),
    };

    const finalMatch = rounds.FINAL && rounds.FINAL[0] ? rounds.FINAL[0] : null;
    let finalistsLine = '';
    let finalLabel = '';
    let finalScore = '';
    if (finalMatch) {
      const t = getMatchTeamsNormal(finalMatch, rounds, winners);
      const h = t.homeId ? findTeamById(t.homeId) : null;
      const a = t.awayId ? findTeamById(t.awayId) : null;
      if (h && a) finalistsLine = `${h.name} vs ${a.name}`;
      const f = matchDisplay(finalMatch);
      finalLabel = f.label;
      finalScore = f.score;
    }

    const thirdMatch = rounds.THIRD && rounds.THIRD[0] ? rounds.THIRD[0] : null;
    let thirdLine = '';
    let thirdDisplay = null;
    if (thirdMatch) {
      const t3 = getMatchTeamsNormal(thirdMatch, rounds, winners);
      const h3 = t3.homeId ? findTeamById(t3.homeId) : null;
      const a3 = t3.awayId ? findTeamById(t3.awayId) : null;
      if (h3 && a3) {
        const r3 = results && results[thirdMatch.id] ? results[thirdMatch.id] : null;
        const score3 =
          r3 && Number.isInteger(r3.homeGoals) && Number.isInteger(r3.awayGoals)
            ? ` (${r3.homeGoals}:${r3.awayGoals})`
            : '';
        thirdLine = `${h3.name} vs ${a3.name}${score3}`;
      }
      thirdDisplay = matchDisplay(thirdMatch);
    }

    return { stages, finalistsLine, thirdLine, left, right, finalLabel, finalScore, thirdDisplay };
  }

  function createSharePosterDataUrl() {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    function roundedRect(x, y, w, h, r, fill, stroke) {
      const rr = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + rr, y);
      ctx.lineTo(x + w - rr, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
      ctx.lineTo(x + w, y + h - rr);
      ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
      ctx.lineTo(x + rr, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
      ctx.lineTo(x, y + rr);
      ctx.quadraticCurveTo(x, y, x + rr, y);
      ctx.closePath();
      if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
      }
      if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, '#3a18e0');
    grad.addColorStop(1, '#081a72');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    roundedRect(36, 36, 1008, 1848, 36, 'rgba(6,20,102,0.42)', 'rgba(95,140,255,0.45)');

    ctx.fillStyle = '#ffffff';
    ctx.font = '800 56px system-ui, Segoe UI, Arial';
    ctx.fillText('СИМУЛЯТОР ЧМ-2026', 72, 122);

    // Секция 1: Победитель
    roundedRect(72, 168, 936, 220, 24, 'rgba(8,33,130,0.9)', 'rgba(120,166,255,0.62)');
    ctx.fillStyle = '#ffd34d';
    ctx.font = '800 44px system-ui, Segoe UI, Arial';
    ctx.fillText('ЧЕМПИОН МИРА', 108, 244);
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 86px system-ui, Segoe UI, Arial';
    const champ = (shareState.championName || '—').toUpperCase();
    ctx.fillText(champ, 108, 336);

    // Секция 2: Плей-офф
    const ko = shareState.poster && shareState.poster.knockout ? shareState.poster.knockout : null;
    roundedRect(72, 410, 936, 760, 24, 'rgba(8,33,130,0.78)', 'rgba(120,166,255,0.5)');
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 38px system-ui, Segoe UI, Arial';
    ctx.fillText('ПЛЕЙ-ОФФ', 108, 476);

    const bracketCardW = 124;
    const bracketCardH = 34;
    const bracketOuterL = 84;
    const bracketOuterR = 872;
    const bracketCenterX = 540;
    const bracketInnerGap = 32;
    const r32Top = 504;
    const r32Bottom = 1158;
    const r32Step = (r32Bottom - r32Top - bracketCardH) / 7;

    function yR32(i) {
      return r32Top + i * r32Step;
    }

    function yMidPair(yA, yB) {
      return (yA + yB) / 2;
    }

    function bracketColumns(outerL, outerR, innerL, innerR, count) {
      const xs = [];
      for (let i = 0; i < count; i++) {
        const t = count === 1 ? 0 : i / (count - 1);
        xs.push(Math.round(outerL + (innerL - outerL) * t));
      }
      const xsR = [];
      for (let i = 0; i < count; i++) {
        const t = count === 1 ? 0 : i / (count - 1);
        xsR.push(Math.round(outerR + (innerR - outerR) * t));
      }
      return { left: xs, right: xsR };
    }

    const innerLeftX = bracketCenterX - bracketCardW - bracketInnerGap;
    const innerRightX = bracketCenterX + bracketInnerGap;
    const bracketCols = bracketColumns(
      bracketOuterL,
      bracketOuterR,
      innerLeftX,
      innerRightX,
      4
    );

    function drawMatchCard(x, y, w, h, item) {
      roundedRect(x, y, w, h, 10, 'rgba(24,72,210,0.45)', 'rgba(120,166,255,0.32)');
      const teamA = shortenName(item && item.homeName ? item.homeName : '—', 12);
      const teamB = shortenName(item && item.awayName ? item.awayName : '—', 12);
      const scoreA = item && item.homeScore ? item.homeScore : '—';
      const scoreB = item && item.awayScore ? item.awayScore : '—';

      const scoreColW = 20;
      const textX = x + 6;
      const textW = Math.max(28, w - scoreColW - 14);
      ctx.fillStyle = '#ffffff';
      ctx.font = '600 12px system-ui, Segoe UI, Arial';
      ctx.save();
      ctx.beginPath();
      ctx.rect(textX, y + 4, textW, h - 8);
      ctx.clip();
      ctx.fillText(teamA, textX, y + 14);
      ctx.fillText(teamB, textX, y + 28);
      ctx.restore();

      ctx.fillStyle = '#9fd6ff';
      ctx.font = '800 12px system-ui, Segoe UI, Arial';
      const swA = ctx.measureText(scoreA).width;
      const swB = ctx.measureText(scoreB).width;
      ctx.fillText(scoreA, x + w - swA - 6, y + 14);
      ctx.fillText(scoreB, x + w - swB - 6, y + 28);
      return { x, y, w, h, cy: y + h / 2, item };
    }

    function drawRoundAt(x, items, yList) {
      const out = [];
      const list = Array.isArray(items) ? items : [];
      list.forEach((item, i) => {
        const y = yList[Math.min(i, yList.length - 1)];
        out.push(drawMatchCard(x, y, bracketCardW, bracketCardH, item));
      });
      return out;
    }

    const leftX = bracketCols.left;
    const rightX = bracketCols.right;

    const r32Ys = Array.from({ length: 8 }, (_, i) => yR32(i));
    const r16Ys = [0, 1, 2, 3].map((i) => yMidPair(r32Ys[i * 2], r32Ys[i * 2 + 1]));
    const qfYs = [0, 1].map((i) => yMidPair(r16Ys[i * 2], r16Ys[i * 2 + 1]));
    const sfY = yMidPair(qfYs[0], qfYs[1]);

    const leftR32 = drawRoundAt(leftX[0], ko && ko.left && ko.left.R32, r32Ys);
    const leftR16 = drawRoundAt(leftX[1], ko && ko.left && ko.left.R16, r16Ys);
    const leftQF = drawRoundAt(leftX[2], ko && ko.left && ko.left.QF, qfYs);
    const leftSF = drawRoundAt(leftX[3], ko && ko.left && ko.left.SF, [sfY]);
    const rightR32 = drawRoundAt(rightX[0], ko && ko.right && ko.right.R32, r32Ys);
    const rightR16 = drawRoundAt(rightX[1], ko && ko.right && ko.right.R16, r16Ys);
    const rightQF = drawRoundAt(rightX[2], ko && ko.right && ko.right.QF, qfYs);
    const rightSF = drawRoundAt(rightX[3], ko && ko.right && ko.right.SF, [sfY]);

    function connectPolyline(points, stroke) {
      if (!Array.isArray(points) || points.length < 2) return;
      ctx.strokeStyle = stroke || 'rgba(140,182,255,0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.stroke();
    }

    // Линии в PNG отключены: оставляем только карточки.

    const finalCardH = 46;
    const finalCardW = 220;
    const finalsGapY = 110;
    const finalY = sfY - finalsGapY - finalCardH;
    const finalNode = drawMatchCard(
      Math.round(bracketCenterX - finalCardW / 2),
      finalY,
      finalCardW,
      finalCardH,
      {
      homeName: ko && ko.finalistsLine ? ko.finalistsLine.split(' vs ')[0] : '—',
      awayName: ko && ko.finalistsLine ? ko.finalistsLine.split(' vs ')[1] : '—',
      homeScore:
        ko && ko.finalScore && ko.finalScore.includes(':')
          ? ko.finalScore.split(':')[0]
          : '—',
      awayScore:
        ko && ko.finalScore && ko.finalScore.includes(':')
          ? ko.finalScore.split(':')[1]
          : '—',
      }
    );
    const third = ko && ko.thirdDisplay ? ko.thirdDisplay : null;
    const thirdNode = drawMatchCard(
      Math.round(bracketCenterX - finalCardW / 2),
      sfY + finalsGapY,
      finalCardW,
      finalCardH,
      {
      homeName: third ? third.homeName : '—',
      awayName: third ? third.awayName : '—',
      homeScore:
        third && third.score && third.score.includes(':') ? third.score.split(':')[0] : '—',
      awayScore:
        third && third.score && third.score.includes(':') ? third.score.split(':')[1] : '—',
      }
    );

    // Центр также без линий.

    // Секция 3: Группы
    const groups = shareState.poster && Array.isArray(shareState.poster.groups)
      ? shareState.poster.groups
      : [];
    roundedRect(72, 1260, 936, 470, 24, 'rgba(8,33,130,0.78)', 'rgba(120,166,255,0.5)');
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 38px system-ui, Segoe UI, Arial';
    ctx.fillText('ГРУППЫ', 108, 1322);

    const cols = 4;
    const gap = 12;
    const cardW = Math.floor((936 - gap * (cols - 1) - 18) / cols);
    const cardH = 124;
    const baseX = 88;
    const groupsBaseY = 1334;

    groups.slice(0, 12).forEach((g, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = baseX + col * (cardW + gap);
      const y = groupsBaseY + row * (cardH + 12);
      roundedRect(x, y, cardW, cardH, 14, 'rgba(24,72,210,0.35)', 'rgba(120,166,255,0.35)');
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 18px system-ui, Segoe UI, Arial';
      ctx.fillText(shortenName(g.title || g.id, 12), x + 8, y + 24);
      const rows = Array.isArray(g.rows) ? g.rows.slice(0, 4) : [];
      rows.forEach((r, ri) => {
        const yy = y + 42 + ri * 20;
        ctx.fillStyle = '#cfe4ff';
        ctx.font = '600 14px system-ui, Segoe UI, Arial';
        ctx.fillText(`${r.pos}.`, x + 6, yy);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(shortenName(r.teamName, 16), x + 20, yy);
        if (g.withStats && Number.isInteger(r.points)) {
          ctx.fillStyle = '#9fd6ff';
          ctx.font = '700 14px system-ui, Segoe UI, Arial';
          const ptsText = String(r.points);
          const tw = ctx.measureText(ptsText).width;
          ctx.fillText(ptsText, x + cardW - tw - 8, yy);
        }
      });
    });

    ctx.fillStyle = '#dbe9ff';
    roundedRect(72, 1770, 936, 98, 22, 'rgba(6,25,100,0.86)', 'rgba(120,166,255,0.45)');
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 34px system-ui, Segoe UI, Arial';
    ctx.fillText('Собери свой турнир в МЯЧ Играх', 108, 1820);
    ctx.font = '600 30px system-ui, Segoe UI, Arial';
    ctx.fillStyle = '#c7d8ff';
    ctx.fillText('@myach_games_bot', 108, 1852);

    return canvas.toDataURL('image/png');
  }

  function downloadSharePoster() {
    const dataUrl = createSharePosterDataUrl();
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'wc26-result.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function openShareLink(kind) {
    const text = encodeURIComponent(getShareCaption());
    const url = encodeURIComponent(window.location.origin + window.location.pathname);
    const shareUrl = `https://t.me/share/url?url=${url}&text=${text}`;
    const wa = window.Telegram && window.Telegram.WebApp;
    if (wa && typeof wa.openTelegramLink === 'function') {
      wa.openTelegramLink(shareUrl);
      return;
    }
    window.open(shareUrl, '_blank');
  }

  function closeShareSheet() {
    const el = document.querySelector('.tg-share-sheet');
    if (!el) return;
    el.remove();
  }

  function openShareSheet() {
    closeShareSheet();
    const sheet = document.createElement('div');
    sheet.className = 'tg-share-sheet';
    sheet.innerHTML = `
      <div class="tg-share-backdrop" data-close="1"></div>
      <div class="tg-share-panel">
        <div class="tg-share-title">Выберите способ</div>
        <div class="tg-share-grid">
          <button type="button" class="tg-share-btn" data-share-kind="chat">Отправить в чат</button>
          <button type="button" class="tg-share-btn" data-share-kind="friend">Отправить другу</button>
          <button type="button" class="tg-share-btn" data-share-kind="save">Сохранить на устройство</button>
        </div>
      </div>
    `;
    document.body.appendChild(sheet);
    sheet.querySelector('[data-close="1"]').addEventListener('click', closeShareSheet);
    sheet.querySelectorAll('.tg-share-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const kind = btn.dataset.shareKind;
        if (kind === 'save') downloadSharePoster();
        else openShareLink(kind);
      });
    });
  }

  function ensureStageNavActions(stageNav) {
    let actions = stageNav.querySelector('.tg-stage-nav-actions');
    if (!actions) {
      actions = document.createElement('div');
      actions.className = 'tg-stage-nav-actions';
      stageNav.appendChild(actions);
    }
    return actions;
  }

  function maybeAppendShareButton(stageNav) {
    if (!shareState.available) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tg-back-button tg-share-open-button';
    btn.textContent = 'Поделиться';
    btn.addEventListener('click', openShareSheet);
    ensureStageNavActions(stageNav).appendChild(btn);
  }

  function buildTournamentStats(groupMatches, rounds, knockoutResults, knockoutWinners) {
    const byTeam = {};
    const bump = (teamId, gf, ga) => {
      if (!teamId) return;
      if (!byTeam[teamId]) byTeam[teamId] = { gf: 0, ga: 0, played: 0 };
      byTeam[teamId].gf += gf;
      byTeam[teamId].ga += ga;
      byTeam[teamId].played += 1;
    };
    const addMatch = (homeId, awayId, hg, ag) => {
      if (!homeId || !awayId || !Number.isInteger(hg) || !Number.isInteger(ag)) return;
      bump(homeId, hg, ag);
      bump(awayId, ag, hg);
    };

    (groupMatches || []).forEach((m) => addMatch(m.homeTeamId, m.awayTeamId, m.homeGoals, m.awayGoals));

    const roundIds = ['R32', 'R16', 'QF', 'SF', 'FINAL', 'THIRD'];
    for (const rid of roundIds) {
      for (const match of (rounds && rounds[rid]) || []) {
        const res = knockoutResults && knockoutResults[match.id];
        if (!res || !Number.isInteger(res.homeGoals) || !Number.isInteger(res.awayGoals)) continue;
        const teams = getMatchTeamsNormal(match, rounds, knockoutWinners || {});
        addMatch(teams.homeId, teams.awayId, res.homeGoals, res.awayGoals);
      }
    }

    const rows = Object.keys(byTeam).map((id) => ({
      teamId: id,
      gf: byTeam[id].gf,
      ga: byTeam[id].ga,
      gd: byTeam[id].gf - byTeam[id].ga,
      played: byTeam[id].played,
    }));
    if (!rows.length) return null;

    const bestAttackRow = rows.slice().sort((a, b) => b.gf - a.gf || b.gd - a.gd)[0];
    const bestDefenseRow = rows
      .filter((r) => r.played > 0)
      .sort((a, b) => a.ga - b.ga || b.gd - a.gd)[0];

    let topMatch = null;
    let totalGoals = 0;
    let matchCount = 0;

    function considerTop(homeId, awayId, hg, ag) {
      if (!homeId || !awayId || !Number.isInteger(hg) || !Number.isInteger(ag)) return;
      const total = hg + ag;
      totalGoals += total;
      matchCount += 1;
      if (!topMatch || total > topMatch.total) {
        topMatch = { homeId, awayId, hg, ag, total };
      }
    }

    (groupMatches || []).forEach((m) =>
      considerTop(m.homeTeamId, m.awayTeamId, m.homeGoals, m.awayGoals)
    );
    for (const rid of roundIds) {
      for (const match of (rounds && rounds[rid]) || []) {
        const res = knockoutResults && knockoutResults[match.id];
        if (!res || !Number.isInteger(res.homeGoals) || !Number.isInteger(res.awayGoals)) continue;
        const teams = getMatchTeamsNormal(match, rounds, knockoutWinners || {});
        considerTop(teams.homeId, teams.awayId, res.homeGoals, res.awayGoals);
      }
    }

    const bestAttackTeam = bestAttackRow ? findTeamById(bestAttackRow.teamId) : null;
    const bestDefenseTeam = bestDefenseRow ? findTeamById(bestDefenseRow.teamId) : null;
    const topHome = topMatch ? findTeamById(topMatch.homeId) : null;
    const topAway = topMatch ? findTeamById(topMatch.awayId) : null;

    return {
      bestAttack: bestAttackTeam
        ? { name: bestAttackTeam.name, value: `${bestAttackRow.gf} гола` }
        : null,
      bestDefense: bestDefenseTeam
        ? { name: bestDefenseTeam.name, value: `${bestDefenseRow.ga} пропущено` }
        : null,
      topMatch:
        topHome && topAway
          ? {
              label: `${topHome.name} — ${topAway.name}`,
              value: `${topMatch.hg}:${topMatch.ag} (${topMatch.total} голов)`,
            }
          : null,
      summary: `${matchCount} матчей · ${totalGoals} голов`,
    };
  }

  function closeStatsSheet() {
    const el = document.querySelector('.tg-stats-sheet');
    if (el) el.remove();
  }

  function openStatsSheet(stats) {
    if (!stats) return;
    closeStatsSheet();
    const sheet = document.createElement('div');
    sheet.className = 'tg-stats-sheet';
    const rows = [
      { title: 'Лучшая атака', item: stats.bestAttack },
      { title: 'Лучшая защита', item: stats.bestDefense },
      { title: 'Самый результативный матч', item: stats.topMatch },
    ];
    const body = rows
      .filter((r) => r.item)
      .map(
        (r) => `
        <div class="tg-stats-row">
          <div class="tg-stats-row-title">${r.title}</div>
          <div class="tg-stats-row-main">${r.item.name || r.item.label}</div>
          <div class="tg-stats-row-sub">${r.item.value}</div>
        </div>`
      )
      .join('');

    sheet.innerHTML = `
      <div class="tg-stats-backdrop" data-close="1"></div>
      <div class="tg-stats-panel">
        <div class="tg-stats-title">Статистика турнира</div>
        <div class="tg-stats-summary">${stats.summary || ''}</div>
        <div class="tg-stats-list">${body || '<div class="tg-stats-empty">Нет данных</div>'}</div>
        <button type="button" class="tg-stats-close" data-close="1">Закрыть</button>
      </div>
    `;
    document.body.appendChild(sheet);
    sheet.querySelectorAll('[data-close="1"]').forEach((el) => {
      el.addEventListener('click', closeStatsSheet);
    });
  }

  function maybeAppendStatsButton(stageNav, stats) {
    if (!stats) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tg-back-button tg-stats-open-button';
    btn.textContent = 'Статистика';
    btn.addEventListener('click', () => openStatsSheet(stats));
    ensureStageNavActions(stageNav).appendChild(btn);
  }

  function createGroupMatchesForGroup(group) {
    const teamIds = group.teams.map((t) => t.id);
    const pairs = [
      [0, 1],
      [2, 3],
      [0, 2],
      [1, 3],
      [0, 3],
      [1, 2],
    ];
    return pairs.map(([i, j], idx) => ({
      id: `${group.id}-${idx + 1}`,
      groupId: group.id,
      homeTeamId: teamIds[i],
      awayTeamId: teamIds[j],
      homeGoals: null,
      awayGoals: null,
    }));
  }

  function ensureHardState() {
    if (typeof WORLD_CUP_2026_CONFIG === 'undefined') return;
    for (const group of WORLD_CUP_2026_CONFIG.groups) {
      if (!Array.isArray(hardState.groupMatchesByGroup[group.id])) {
        hardState.groupMatchesByGroup[group.id] = createGroupMatchesForGroup(group);
      }
    }
    if (!hardState.knockoutResults) hardState.knockoutResults = {};
  }

  function calcHardStandingsForGroup(group, matches) {
    const stats = {};
    for (const t of group.teams) {
      stats[t.id] = {
        teamId: t.id,
        groupId: group.id,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        points: 0,
      };
    }

    (matches || []).forEach((m) => {
      if (m.homeGoals == null || m.awayGoals == null) return;
      const home = stats[m.homeTeamId];
      const away = stats[m.awayTeamId];
      if (!home || !away) return;

      home.played += 1;
      away.played += 1;
      home.goalsFor += m.homeGoals;
      home.goalsAgainst += m.awayGoals;
      away.goalsFor += m.awayGoals;
      away.goalsAgainst += m.homeGoals;

      if (m.homeGoals > m.awayGoals) {
        home.wins += 1;
        away.losses += 1;
        home.points += 3;
      } else if (m.homeGoals < m.awayGoals) {
        away.wins += 1;
        home.losses += 1;
        away.points += 3;
      } else {
        home.draws += 1;
        away.draws += 1;
        home.points += 1;
        away.points += 1;
      }
    });

    return Object.values(stats).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const gdA = a.goalsFor - a.goalsAgainst;
      const gdB = b.goalsFor - b.goalsAgainst;
      if (gdB !== gdA) return gdB - gdA;
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
      const nameA = findTeamById(a.teamId)?.name || a.teamId;
      const nameB = findTeamById(b.teamId)?.name || b.teamId;
      return nameA.localeCompare(nameB, 'ru');
    });
  }

  function pickBestThirdsHard(standingsByGroup) {
    const thirds = [];
    for (const group of WORLD_CUP_2026_CONFIG.groups) {
      const st = standingsByGroup[group.id] || [];
      if (st[2]) thirds.push({ ...st[2], position: 3 });
    }
    thirds.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const gdA = a.goalsFor - a.goalsAgainst;
      const gdB = b.goalsFor - b.goalsAgainst;
      if (gdB !== gdA) return gdB - gdA;
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
      const nameA = findTeamById(a.teamId)?.name || a.teamId;
      const nameB = findTeamById(b.teamId)?.name || b.teamId;
      return nameA.localeCompare(nameB, 'ru');
    });
    return thirds.slice(0, 8).map((x) => ({
      groupId: x.groupId,
      teamId: x.teamId,
      points: x.points,
      goalsFor: x.goalsFor,
      goalsAgainst: x.goalsAgainst,
    }));
  }

  function parseScoreValue(raw) {
    if (raw === '' || raw == null) return null;
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    const i = Math.max(0, Math.min(99, Math.trunc(n)));
    return i;
  }

  function deriveHardKnockoutWinners(rounds, knockoutResults) {
    const winners = {};
    const order = ['R32', 'R16', 'QF', 'SF', 'FINAL', 'THIRD'];
    for (const roundId of order) {
      const list = rounds[roundId] || [];
      for (const match of list) {
        const teams = getMatchTeamsNormal(match, rounds, winners);
        if (!teams.homeId || !teams.awayId) continue;
        const res = knockoutResults[match.id];
        if (!res) continue;

        const homeGoals = Number.isInteger(res.homeGoals) ? res.homeGoals : null;
        const awayGoals = Number.isInteger(res.awayGoals) ? res.awayGoals : null;
        if (homeGoals == null || awayGoals == null) continue;

        if (homeGoals > awayGoals) {
          winners[match.id] = teams.homeId;
          continue;
        }
        if (awayGoals > homeGoals) {
          winners[match.id] = teams.awayId;
          continue;
        }

        const penHome = Number.isInteger(res.penHome) ? res.penHome : null;
        const penAway = Number.isInteger(res.penAway) ? res.penAway : null;
        if (penHome == null || penAway == null || penHome === penAway) continue;
        winners[match.id] = penHome > penAway ? teams.homeId : teams.awayId;
      }
    }
    return winners;
  }

  function isKoViewCompleteHard(rounds, viewId, winners) {
    const defs = getMatchesByView(rounds, viewId);
    for (const def of defs) {
      for (const match of def.matches || []) {
        if (!isMatchResolved(match, rounds, winners)) return false;
      }
    }
    return defs.length > 0;
  }

  function areHardGroupsComplete() {
    for (const group of WORLD_CUP_2026_CONFIG.groups) {
      const matches = hardState.groupMatchesByGroup[group.id] || [];
      for (const m of matches) {
        if (m.homeGoals == null || m.awayGoals == null) return false;
      }
    }
    return true;
  }

  function getNextInputFocusMeta(currentInput, selector) {
    if (!currentInput) return null;
    const list = Array.from(document.querySelectorAll(selector));
    const idx = list.indexOf(currentInput);
    if (idx === -1) return null;
    const next = list[idx + 1];
    if (!next) return null;
    return {
      selector,
      matchId: next.dataset.matchId || '',
      side: next.dataset.side || '',
    };
  }

  function restoreHardInputFocus() {
    if (!hardState.focusAfterRender) return;
    const { selector, matchId, side } = hardState.focusAfterRender;
    hardState.focusAfterRender = null;
    if (!selector || !matchId || !side) return;
    const el = document.querySelector(
      `${selector}[data-match-id="${matchId}"][data-side="${side}"]`
    );
    if (!el || el.disabled) return;
    el.focus();
    try {
      el.setSelectionRange(el.value.length, el.value.length);
    } catch (e) {
      /* ignore non-text input edge */
    }
  }

  function renderKoSectionTitle(stage) {
    const koTitle = document.createElement('h2');
    koTitle.className = 'tg-title tg-title--section';
    if (stage === 'ko1') koTitle.textContent = 'Левая сетка';
    else if (stage === 'ko2') koTitle.textContent = 'Правая сетка';
    else koTitle.textContent = 'Финал и 3-е место';
    return koTitle;
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
      const row = document.createElement('div');
      row.className = 'tg-ko-team-row';

      if (team) {
        const squadBtn = document.createElement('button');
        squadBtn.type = 'button';
        squadBtn.className = 'team-squad-btn team-squad-btn--ko';
        squadBtn.dataset.teamId = team.id;
        squadBtn.setAttribute('aria-label', 'Состав сборной');
        squadBtn.title = 'Состав';
        squadBtn.textContent = '👕';
        squadBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();
        });
        row.appendChild(squadBtn);
      } else {
        const spacer = document.createElement('span');
        spacer.className = 'team-squad-btn team-squad-btn--ko team-squad-btn--spacer';
        spacer.setAttribute('aria-hidden', 'true');
        row.appendChild(spacer);
      }

          const btn = document.createElement('button');
      btn.type = 'button';
          btn.className = 'tg-ko-team';
          if (!team) {
            btn.disabled = true;
            btn.textContent = '—';
        row.appendChild(btn);
        return row;
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
            const gridEl = document.querySelector('.tg-ko-grid');
            const scrollLeft = gridEl ? gridEl.scrollLeft : 0;
            normalState.knockoutWinners[match.id] = team.id;
            renderNormalMode();
            const newGrid = document.querySelector('.tg-ko-grid');
            if (newGrid) newGrid.scrollLeft = scrollLeft;
          });
      row.appendChild(btn);
      return row;
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
    container.className = 'tg-screen tg-level-screen tg-level-screen--compact';

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
          <div class="group-subtitle">Тап — сменить место</div>
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
    const normalFinalMatch = (bracket.FINAL && bracket.FINAL[0]) || null;
    const normalComplete = !!(
      normalFinalMatch &&
      isMatchResolved(normalFinalMatch, bracket, normalState.knockoutWinners)
    );
    const normalChampionId = normalComplete
      ? normalState.knockoutWinners[normalFinalMatch.id]
      : null;
    const normalChampion = normalChampionId ? findTeamById(normalChampionId) : null;
    const normalFinalTeams = normalFinalMatch
      ? getMatchTeamsNormal(normalFinalMatch, bracket, normalState.knockoutWinners)
      : { homeId: null, awayId: null };
    const normalHomeFinal = normalFinalTeams.homeId ? findTeamById(normalFinalTeams.homeId) : null;
    const normalAwayFinal = normalFinalTeams.awayId ? findTeamById(normalFinalTeams.awayId) : null;
    setShareState({
      available: normalComplete,
      modeLabel: 'Нормальный',
      championName: normalChampion ? normalChampion.name : '',
      finalScore: '',
      lines:
        normalComplete && normalHomeFinal && normalAwayFinal
          ? [`Финалисты: ${normalHomeFinal.name} vs ${normalAwayFinal.name}`]
          : [],
      poster: {
        groups: buildGroupPosterData(
          Object.fromEntries(
            WORLD_CUP_2026_CONFIG.groups.map((g) => [
              g.id,
              (normalState.groupOrder[g.id] || []).map((teamId, idx) => ({
                teamId,
                points: null,
                goalsFor: null,
                goalsAgainst: null,
                place: idx + 1,
              })),
            ])
          ),
          false
        ),
        knockout: buildKnockoutPosterData(bracket, normalState.knockoutWinners, {}),
      },
    });

    if (normalState.stage !== 'groups' && selected.length !== 8) {
      normalState.stage = 'groups';
    }

    const playoffsReady = selected.length === 8;

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
      if (playoffsReady) {
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
        rightBtn.textContent = 'Правая сетка →';
        rightBtn.addEventListener('click', () => {
          normalState.stage = 'ko2';
          renderNormalMode();
        });
        showRight = true;
      }
    } else if (normalState.stage === 'ko2') {
      leftBtn.textContent = '← Левая сетка';
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
        leftBtn.textContent = '← Правая сетка';
        leftBtn.addEventListener('click', () => {
          normalState.stage = 'ko2';
          renderNormalMode();
        });
      }
    }

    stageNav.appendChild(leftBtn);
    if (showRight) stageNav.appendChild(rightBtn);
    maybeAppendShareButton(stageNav);
    container.appendChild(stageNav);

    if (normalState.stage === 'groups') {
    container.appendChild(groupsGrid);
    container.appendChild(thirdsPanel);
    } else if (playoffsReady) {
      const koWrapper = document.createElement('div');
      koWrapper.className = 'tg-ko-wrapper';

      koWrapper.appendChild(
        renderKnockoutNormal(
          bracket,
          normalState.stage === 'ko1'
            ? 'ko1'
            : normalState.stage === 'ko2'
              ? 'ko2'
              : 'finals'
        )
      );
      container.appendChild(koWrapper);
    }

    root.appendChild(container);

    bindSquadOpenTriggers(container);

    let selectedTeamId = null;
    let selectedGroupId = null;

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

  function renderEasyGroupsGrid(simulated, standingsByGroup) {
    const grid = document.createElement('div');
    grid.className = 'groups-grid';

    for (const group of WORLD_CUP_2026_CONFIG.groups) {
      const card = document.createElement('div');
      card.className = 'group-card' + (simulated ? ' group-card--stats' : '');

      const header = document.createElement('div');
      header.className = 'group-header';
      header.innerHTML = `
        <div>
          <div class="group-title">${group.name}</div>
        </div>
      `;
      card.appendChild(header);

      const table = document.createElement('div');
      table.className = 'group-table';

      const head = document.createElement('div');
      head.className = 'group-table-head';
      head.innerHTML = `
        <span class="col-pos"></span>
        <span class="col-team"></span>
        <span class="col-stat">О</span>
        <span class="col-stat">ЗМ</span>
        <span class="col-stat">ПМ</span>
        <span class="col-stat">Р</span>
        <span class="col-squad"></span>
      `;
      table.appendChild(head);

      const standings = simulated ? standingsByGroup[group.id] || [] : [];
      const rows = simulated
        ? standings
        : group.teams.map((t) => ({ teamId: t.id }));

      rows.forEach((row, index) => {
        const team = findTeamById(row.teamId);
        if (!team) return;

        const line = document.createElement('div');
        line.className = 'group-table-row team-card team-card--easy';
        line.dataset.teamId = team.id;

        const gd = simulated ? row.goalsFor - row.goalsAgainst : null;

        line.innerHTML = `
          <span class="team-position">${index + 1}</span>
          <div class="standings-team" title="Двойной тап — состав">
            ${renderFlagHtmlSimple(team)}
            <span class="team-name">${team.name}</span>
          </div>
          <span class="team-stat">${simulated ? row.points : '—'}</span>
          <span class="team-stat">${simulated ? row.goalsFor : '—'}</span>
          <span class="team-stat">${simulated ? row.goalsAgainst : '—'}</span>
          <span class="team-stat">${simulated ? formatGoalDiff(gd) : '—'}</span>
          <button type="button" class="team-squad-btn" data-team-id="${team.id}" aria-label="Состав сборной" title="Состав">👕</button>
        `;
        table.appendChild(line);
      });

      card.appendChild(table);
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
    header.innerHTML = `<span class="thirds-title">Прошли из 3‑го места</span>`;
    panel.appendChild(header);

    const list = document.createElement('div');
    list.className = 'thirds-qualified-list';

    bestThirds.forEach((entry, idx) => {
      const team = findTeamById(entry.teamId);
      if (!team) return;

      const row = document.createElement('div');
      row.className = 'thirds-qualified-row';
      row.innerHTML = `
        <span class="thirds-qualified-num">${idx + 1}</span>
        <span class="badge">${entry.groupId}-3</span>
        ${renderFlagHtmlSimple(team)}
        <span class="team-name">${team.name}</span>
      `;
      list.appendChild(row);
    });

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

      if (team) {
        const squadBtn = document.createElement('button');
        squadBtn.type = 'button';
        squadBtn.className = 'team-squad-btn team-squad-btn--ko';
        squadBtn.dataset.teamId = team.id;
        squadBtn.setAttribute('aria-label', 'Состав сборной');
        squadBtn.title = 'Состав';
        squadBtn.textContent = '👕';
        row.appendChild(squadBtn);
      } else {
        const spacer = document.createElement('span');
        spacer.className =
          'team-squad-btn team-squad-btn--ko team-squad-btn--spacer';
        spacer.setAttribute('aria-hidden', 'true');
        row.appendChild(spacer);
      }

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

  function renderHardGroupsStage(standingsByGroup, groupMatchesByGroup) {
    const grid = document.createElement('div');
    grid.className = 'groups-grid';

    for (const group of WORLD_CUP_2026_CONFIG.groups) {
      const card = document.createElement('div');
      card.className = 'group-card group-card--stats';

      const header = document.createElement('div');
      header.className = 'group-header';
      header.innerHTML = `
        <div>
          <div class="group-title">${group.name}</div>
        </div>
      `;
      card.appendChild(header);

      const table = document.createElement('div');
      table.className = 'group-table';
      table.innerHTML = `
        <div class="group-table-head">
          <span class="col-pos"></span>
          <span class="col-team"></span>
          <span class="col-stat">О</span>
          <span class="col-stat">ЗМ</span>
          <span class="col-stat">ПМ</span>
          <span class="col-stat">Р</span>
          <span class="col-squad"></span>
        </div>
      `;
      const standings = standingsByGroup[group.id] || [];
      standings.forEach((row, index) => {
        const team = findTeamById(row.teamId);
        if (!team) return;
        const gd = row.goalsFor - row.goalsAgainst;
        const line = document.createElement('div');
        line.className = 'group-table-row team-card team-card--easy';
        line.dataset.teamId = team.id;
        line.innerHTML = `
          <span class="team-position">${index + 1}</span>
          <div class="standings-team" title="Двойной тап — состав">
            ${renderFlagHtmlSimple(team)}
            <span class="team-name">${team.name}</span>
          </div>
          <span class="team-stat">${row.points}</span>
          <span class="team-stat">${row.goalsFor}</span>
          <span class="team-stat">${row.goalsAgainst}</span>
          <span class="team-stat">${formatGoalDiff(gd)}</span>
          <button type="button" class="team-squad-btn" data-team-id="${team.id}" aria-label="Состав сборной" title="Состав">👕</button>
        `;
        table.appendChild(line);
      });
      card.appendChild(table);

      const matchesWrap = document.createElement('div');
      matchesWrap.className = 'tg-hard-group-matches';
      const matches = groupMatchesByGroup[group.id] || [];
      const labels = ['Тур 1', 'Тур 2', 'Тур 3'];
      for (let md = 0; md < 3; md += 1) {
        const sec = document.createElement('div');
        sec.className = 'tg-hard-matchday';
        sec.innerHTML = `<div class="tg-hard-matchday-title">${labels[md]}</div>`;
        const start = md * 2;
        const list = matches.slice(start, start + 2);
        list.forEach((m) => {
          const home = findTeamById(m.homeTeamId);
          const away = findTeamById(m.awayTeamId);
          if (!home || !away) return;
          const row = document.createElement('div');
          row.className = 'tg-hard-match-row';
          row.innerHTML = `
            <div class="tg-hard-team tg-hard-team--home">${renderFlagHtmlSimple(home)}<span class="team-name">${home.name}</span></div>
            <input class="tg-hard-score-input" type="number" min="0" max="99" inputmode="numeric" value="${m.homeGoals == null ? '' : m.homeGoals}" data-group-id="${group.id}" data-match-id="${m.id}" data-side="home" />
            <span class="tg-hard-dash">-</span>
            <input class="tg-hard-score-input" type="number" min="0" max="99" inputmode="numeric" value="${m.awayGoals == null ? '' : m.awayGoals}" data-group-id="${group.id}" data-match-id="${m.id}" data-side="away" />
            <div class="tg-hard-team tg-hard-team--away"><span class="team-name">${away.name}</span>${renderFlagHtmlSimple(away)}</div>
          `;
          sec.appendChild(row);
        });
        matchesWrap.appendChild(sec);
      }
      card.appendChild(matchesWrap);
      grid.appendChild(card);
    }

    return grid;
  }

  function renderKoMatchCardHard(match, rounds, winners, results) {
    const teams = getMatchTeamsNormal(match, rounds, winners);
    const homeTeam = teams.homeId ? findTeamById(teams.homeId) : null;
    const awayTeam = teams.awayId ? findTeamById(teams.awayId) : null;
    const res = results[match.id] || {};
    const card = document.createElement('div');
    card.className = 'tg-ko-match tg-ko-match--scored tg-ko-match--editable';

    function makeRow(team, side) {
      const row = document.createElement('div');
      row.className = 'tg-ko-team-row';
      const squad = document.createElement(team ? 'button' : 'span');
      squad.className = 'team-squad-btn team-squad-btn--ko' + (team ? '' : ' team-squad-btn--spacer');
      if (team) {
        squad.type = 'button';
        squad.dataset.teamId = team.id;
        squad.setAttribute('aria-label', 'Состав сборной');
        squad.title = 'Состав';
        squad.textContent = '👕';
      } else {
        squad.setAttribute('aria-hidden', 'true');
      }
      row.appendChild(squad);

      const name = document.createElement('div');
      name.className = 'tg-ko-team tg-ko-team--readonly';
      name.innerHTML = team
        ? `<span class="flag-wrap">${renderFlagHtmlSimple(team)}</span><span class="team-name">${team.name}</span>`
        : '—';
      row.appendChild(name);

      const input = document.createElement('input');
      input.className = 'tg-ko-score-input';
      input.type = 'number';
      input.min = '0';
      input.max = '99';
      input.inputMode = 'numeric';
      input.dataset.matchId = match.id;
      input.dataset.side = side === 'home' ? 'homeGoals' : 'awayGoals';
      input.value = Number.isInteger(side === 'home' ? res.homeGoals : res.awayGoals)
        ? String(side === 'home' ? res.homeGoals : res.awayGoals)
        : '';
      input.disabled = !team;
      row.appendChild(input);

      const hasMainTieNow =
        Number.isInteger(res.homeGoals) &&
        Number.isInteger(res.awayGoals) &&
        res.homeGoals === res.awayGoals &&
        !!homeTeam &&
        !!awayTeam;
      const penInput = document.createElement('input');
      penInput.className =
        'tg-ko-pen-input tg-ko-pen-input--inline' + (hasMainTieNow ? '' : ' tg-ko-pen-input--hidden');
      penInput.type = 'number';
      penInput.min = '0';
      penInput.max = '99';
      penInput.inputMode = 'numeric';
      penInput.dataset.matchId = match.id;
      penInput.dataset.side = side === 'home' ? 'penHome' : 'penAway';
      penInput.value = Number.isInteger(side === 'home' ? res.penHome : res.penAway)
        ? String(side === 'home' ? res.penHome : res.penAway)
        : '';
      penInput.disabled = !team || !hasMainTieNow;
      penInput.title = 'Серия пенальти';
      penInput.setAttribute('aria-label', 'Серия пенальти');
      const penBadge = document.createElement('span');
      penBadge.className = 'tg-ko-pen-badge' + (hasMainTieNow ? '' : ' tg-ko-pen-input--hidden');
      penBadge.textContent = 'П';
      row.appendChild(penBadge);
      row.appendChild(penInput);
      return row;
    }

    card.appendChild(makeRow(homeTeam, 'home'));
    card.appendChild(makeRow(awayTeam, 'away'));

    const hasMainTie =
      Number.isInteger(res.homeGoals) &&
      Number.isInteger(res.awayGoals) &&
      res.homeGoals === res.awayGoals &&
      !!homeTeam &&
      !!awayTeam;
    if (hasMainTie) card.classList.add('tg-ko-match--tie');
    return card;
  }

  function renderFinalsHard(rounds, winners, results) {
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

    let finalHomeTeam = null;
    let finalAwayTeam = null;
    let championTeam = null;
    if (finalMatch) {
      const t = getMatchTeamsNormal(finalMatch, rounds, winners);
      finalHomeTeam = t.homeId ? findTeamById(t.homeId) : null;
      finalAwayTeam = t.awayId ? findTeamById(t.awayId) : null;
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

    top.appendChild(leftFinalist);
    top.appendChild(championCard);
    top.appendChild(rightFinalist);
    wrapper.appendChild(top);

    const bottom = document.createElement('div');
    bottom.className = 'tg-ko-finals-bottom';

    const finalBlock = document.createElement('div');
    finalBlock.className = 'tg-ko-finals-match tg-ko-finals-third';
    finalBlock.innerHTML = `<div class="tg-ko-finals-title">Финал</div>`;
    if (finalMatch) {
      finalBlock.appendChild(renderKoMatchCardHard(finalMatch, rounds, winners, results));
    }

    const thirdBlock = document.createElement('div');
    thirdBlock.className = 'tg-ko-finals-match tg-ko-finals-third';
    thirdBlock.innerHTML = `<div class="tg-ko-finals-title">3‑е место</div>`;
    if (thirdMatch) {
      thirdBlock.appendChild(renderKoMatchCardHard(thirdMatch, rounds, winners, results));
    }

    bottom.appendChild(finalBlock);
    bottom.appendChild(thirdBlock);
    wrapper.appendChild(bottom);
    return wrapper;
  }

  function renderKnockoutHard(rounds, viewId, winners, results) {
    if (viewId === 'finals') {
      return renderFinalsHard(rounds, winners, results);
    }
    const wrapper = document.createElement('div');
    wrapper.className = 'tg-ko-grid tg-ko-grid--bracket tg-ko-grid--hard';
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
        const card = renderKoMatchCardHard(match, rounds, winners, results);
        const row = koSlotRow(rdef.id, i);
        card.style.gridRow = `${row} / span 2`;
        list.appendChild(card);
      });
      col.appendChild(list);
      wrapper.appendChild(col);
    });
    return wrapper;
  }

  function renderHardMode() {
    ensureHardState();
    root.innerHTML = '';

    const standingsByGroup = {};
    for (const group of WORLD_CUP_2026_CONFIG.groups) {
      standingsByGroup[group.id] = calcHardStandingsForGroup(
        group,
        hardState.groupMatchesByGroup[group.id] || []
      );
    }
    const groupsComplete = areHardGroupsComplete();
    const bestThirds = groupsComplete ? pickBestThirdsHard(standingsByGroup) : [];
    const qualifiers = { standingsByGroup: {}, bestThirds };
    for (const group of WORLD_CUP_2026_CONFIG.groups) {
      const source = groupsComplete ? standingsByGroup[group.id] || [] : [];
      qualifiers.standingsByGroup[group.id] = source.map((row) => ({
        teamId: row.teamId,
        groupId: row.groupId,
      }));
    }

    const qualKey = JSON.stringify(qualifiers);
    if (qualKey !== hardState.lastQualKey) {
      hardState.lastQualKey = qualKey;
      hardState.knockoutResults = {};
      hardState.stage = 'groups';
    }
    if (!groupsComplete && hardState.stage !== 'groups') {
      hardState.stage = 'groups';
    }

    const rounds = buildBracketNormal(qualifiers);
    const winners = deriveHardKnockoutWinners(rounds, hardState.knockoutResults);
    const hardFinalMatch = (rounds.FINAL && rounds.FINAL[0]) || null;
    const hardComplete = !!(hardFinalMatch && isMatchResolved(hardFinalMatch, rounds, winners));
    const hardChampionId = hardComplete ? winners[hardFinalMatch.id] : null;
    const hardChampion = hardChampionId ? findTeamById(hardChampionId) : null;
    const hardFinalResult =
      hardFinalMatch && hardState.knockoutResults[hardFinalMatch.id]
        ? hardState.knockoutResults[hardFinalMatch.id]
        : null;
    const hardFinalScore =
      hardFinalResult &&
      Number.isInteger(hardFinalResult.homeGoals) &&
      Number.isInteger(hardFinalResult.awayGoals)
        ? `${hardFinalResult.homeGoals}:${hardFinalResult.awayGoals}`
        : '';
    const hardFinalTeams = hardFinalMatch
      ? getMatchTeamsNormal(hardFinalMatch, rounds, winners)
      : { homeId: null, awayId: null };
    const hardFinalHome = hardFinalTeams.homeId ? findTeamById(hardFinalTeams.homeId) : null;
    const hardFinalAway = hardFinalTeams.awayId ? findTeamById(hardFinalTeams.awayId) : null;
    setShareState({
      available: hardComplete,
      modeLabel: 'Сложный',
      championName: hardChampion ? hardChampion.name : '',
      finalScore: hardFinalScore,
      lines:
        hardComplete && hardFinalHome && hardFinalAway
          ? [`Финалисты: ${hardFinalHome.name} vs ${hardFinalAway.name}`]
          : [],
      poster: {
        groups: buildGroupPosterData(standingsByGroup, true),
        knockout: buildKnockoutPosterData(rounds, winners, hardState.knockoutResults),
      },
    });

    const container = document.createElement('div');
    container.className = 'tg-screen tg-level-screen tg-level-screen--compact tg-hard-screen';

    const stageNav = document.createElement('div');
    stageNav.className = 'tg-stage-nav';
    const leftBtn = document.createElement('button');
    leftBtn.className = 'tg-back-button';
    const rightBtn = document.createElement('button');
    rightBtn.className = 'tg-back-button tg-next-button';
    let showRight = false;

    if (hardState.stage === 'groups') {
      leftBtn.textContent = launchContext.fromHub ? '← К списку игр' : '← Назад';
      leftBtn.addEventListener('click', launchContext.fromHub ? exitAppOrMenu : renderStartScreen);
      if (groupsComplete) {
        rightBtn.textContent = 'Перейти к плей‑офф →';
        rightBtn.addEventListener('click', () => {
          hardState.stage = 'ko1';
          renderHardMode();
        });
        showRight = true;
      }
    } else if (hardState.stage === 'ko1') {
      leftBtn.textContent = '← К группам';
      leftBtn.addEventListener('click', () => {
        hardState.stage = 'groups';
        renderHardMode();
      });
      if (isKoViewCompleteHard(rounds, 'ko1', winners)) {
        rightBtn.textContent = 'Правая сетка →';
        rightBtn.addEventListener('click', () => {
          hardState.stage = 'ko2';
          renderHardMode();
        });
        showRight = true;
      }
    } else if (hardState.stage === 'ko2') {
      leftBtn.textContent = '← Левая сетка';
      leftBtn.addEventListener('click', () => {
        hardState.stage = 'ko1';
        renderHardMode();
      });
      if (isKoViewCompleteHard(rounds, 'ko2', winners)) {
        rightBtn.textContent = 'К финалу →';
        rightBtn.addEventListener('click', () => {
          hardState.stage = 'finals';
          renderHardMode();
        });
        showRight = true;
      }
    } else {
      const finalMatch = (rounds.FINAL && rounds.FINAL[0]) || null;
      const finalDone = !!(finalMatch && isMatchResolved(finalMatch, rounds, winners));
      leftBtn.textContent = '← Правая сетка';
      leftBtn.addEventListener('click', () => {
        hardState.stage = 'ko2';
        renderHardMode();
      });
      if (finalDone) {
        rightBtn.textContent = launchContext.fromHub ? 'К списку игр →' : 'В главное меню →';
        rightBtn.addEventListener('click', launchContext.fromHub ? exitAppOrMenu : renderStartScreen);
        showRight = true;
      }
    }

    stageNav.appendChild(leftBtn);
    if (showRight) stageNav.appendChild(rightBtn);
    maybeAppendShareButton(stageNav);
    if (hardComplete) {
      const hardGroupMatches = [];
      for (const group of WORLD_CUP_2026_CONFIG.groups) {
        hardGroupMatches.push(...(hardState.groupMatchesByGroup[group.id] || []));
      }
      const hardStats = buildTournamentStats(
        hardGroupMatches,
        rounds,
        hardState.knockoutResults,
        winners
      );
      maybeAppendStatsButton(stageNav, hardStats);
    }
    container.appendChild(stageNav);

    if (hardState.stage === 'groups') {
      container.appendChild(renderHardGroupsStage(standingsByGroup, hardState.groupMatchesByGroup));
      if (groupsComplete) {
        container.appendChild(renderEasyThirdsPanel(bestThirds));
      }
    } else {
      const koWrapper = document.createElement('div');
      koWrapper.className = 'tg-ko-wrapper';
      koWrapper.appendChild(
        renderKnockoutHard(
          rounds,
          hardState.stage === 'ko1' ? 'ko1' : hardState.stage === 'ko2' ? 'ko2' : 'finals',
          winners,
          hardState.knockoutResults
        )
      );
      container.appendChild(koWrapper);
    }

    root.appendChild(container);
    bindSquadOpenTriggers(container);

    container.querySelectorAll('.tg-hard-score-input').forEach((input) => {
      input.addEventListener('input', () => {
        const focusMeta =
          input.value !== ''
            ? getNextInputFocusMeta(input, '.tg-hard-score-input')
            : null;
        const groupId = input.dataset.groupId;
        const matchId = input.dataset.matchId;
        const side = input.dataset.side;
        const list = hardState.groupMatchesByGroup[groupId] || [];
        const match = list.find((m) => m.id === matchId);
        if (!match) return;
        const val = parseScoreValue(input.value);
        if (side === 'home') match.homeGoals = val;
        else match.awayGoals = val;
        hardState.focusAfterRender = focusMeta;
        renderHardMode();
      });
    });

    container.querySelectorAll('.tg-ko-score-input, .tg-ko-pen-input').forEach((input) => {
      input.addEventListener('input', () => {
        const focusMeta =
          input.value !== ''
            ? getNextInputFocusMeta(
                input,
                input.classList.contains('tg-ko-pen-input')
                  ? '.tg-ko-pen-input'
                  : '.tg-ko-score-input'
              )
            : null;
        const matchId = input.dataset.matchId;
        const side = input.dataset.side;
        if (!matchId || !side) return;
        if (!hardState.knockoutResults[matchId]) hardState.knockoutResults[matchId] = {};
        hardState.knockoutResults[matchId][side] = parseScoreValue(input.value);

        const r = hardState.knockoutResults[matchId];
        const tieMain = Number.isInteger(r.homeGoals) && Number.isInteger(r.awayGoals) && r.homeGoals === r.awayGoals;
        if (!tieMain) {
          r.penHome = null;
          r.penAway = null;
        }
        hardState.focusAfterRender = focusMeta;
        renderHardMode();
      });
    });

    restoreHardInputFocus();
  }

  function renderEasyMode() {
    root.innerHTML = '';
    const data = easyState.data;
    const easyFinalMatch = data && data.rounds && data.rounds.FINAL ? data.rounds.FINAL[0] : null;
    const easyComplete = !!(
      easyFinalMatch &&
      data &&
      data.knockoutWinners &&
      data.knockoutWinners[easyFinalMatch.id]
    );
    const easyChampionId = easyComplete ? data.knockoutWinners[easyFinalMatch.id] : null;
    const easyChampion = easyChampionId ? findTeamById(easyChampionId) : null;
    const easyFinalRes =
      easyFinalMatch && data && data.knockoutResults
        ? data.knockoutResults[easyFinalMatch.id]
        : null;
    const easyFinalScore =
      easyFinalRes &&
      Number.isInteger(easyFinalRes.homeGoals) &&
      Number.isInteger(easyFinalRes.awayGoals)
        ? `${easyFinalRes.homeGoals}:${easyFinalRes.awayGoals}`
        : '';
    const easyFinalTeams =
      easyFinalMatch && data && data.knockoutWinners
        ? getMatchTeamsNormal(easyFinalMatch, data.rounds, data.knockoutWinners)
        : { homeId: null, awayId: null };
    const easyFinalHome = easyFinalTeams.homeId ? findTeamById(easyFinalTeams.homeId) : null;
    const easyFinalAway = easyFinalTeams.awayId ? findTeamById(easyFinalTeams.awayId) : null;
    setShareState({
      available: easyComplete,
      modeLabel: 'Лёгкий',
      championName: easyChampion ? easyChampion.name : '',
      finalScore: easyFinalScore,
      lines:
        easyComplete && easyFinalHome && easyFinalAway
          ? [`Финалисты: ${easyFinalHome.name} vs ${easyFinalAway.name}`]
          : [],
      poster: {
        groups: buildGroupPosterData(data ? data.standingsByGroup || {} : {}, true),
        knockout: buildKnockoutPosterData(
          data && data.rounds ? data.rounds : { R32: [], R16: [], QF: [], SF: [], FINAL: [], THIRD: [] },
          data && data.knockoutWinners ? data.knockoutWinners : {},
          data && data.knockoutResults ? data.knockoutResults : {}
        ),
      },
    });

    const container = document.createElement('div');
    container.className =
      'tg-screen tg-level-screen tg-level-screen--compact tg-easy-screen';

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

    maybeAppendShareButton(stageNav);
    if (easyComplete && data) {
      const easyStats = buildTournamentStats(
        data.groupMatches || [],
        data.rounds,
        data.knockoutResults || {},
        data.knockoutWinners || {}
      );
      maybeAppendStatsButton(stageNav, easyStats);
    }
    container.appendChild(stageNav);

    if (easyState.simulated) {
      container.appendChild(
        renderStageTabs(easyState.stage, (id) => {
          easyState.stage = id;
          renderEasyMode();
        })
      );
    }

    const standingsByGroup = data ? data.standingsByGroup : {};

    if (!easyState.simulated || easyState.stage === 'groups') {
      container.appendChild(renderEasyGroupsGrid(easyState.simulated, standingsByGroup));

      if (easyState.simulated && data) {
        container.appendChild(renderEasyThirdsPanel(data.bestThirds || []));
      }
    } else if (data && data.rounds) {
      const koWrapper = document.createElement('div');
      koWrapper.className = 'tg-ko-wrapper';
      koWrapper.appendChild(
        renderKnockoutEasy(
          data.rounds,
          easyState.stage,
          data.knockoutWinners,
          data.knockoutResults
        )
      );
      bindSquadOpenTriggers(koWrapper);
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
    if (level.id === 'hard') {
      renderHardMode();
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
    setShareState(null);
    closeShareSheet();
    root.innerHTML = '';

    const container = document.createElement('div');
    container.className = 'tg-screen tg-start-screen';

    if (launchContext.fromHub) {
      const hubBack = document.createElement('button');
      hubBack.type = 'button';
      hubBack.className = 'tg-back-button tg-start-hub-back';
      hubBack.textContent = '← К списку игр';
      hubBack.addEventListener('click', exitAppOrMenu);
      container.appendChild(hubBack);
    }

    const header = document.createElement('div');
    header.className = 'tg-header';

    const title = document.createElement('h1');
    title.className = 'tg-title';
    title.textContent = 'Симулятор ЧМ‑2026';

    header.appendChild(title);

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

      card.appendChild(lvlTitle);
      if (level.subtitle) {
        const lvlSubtitle = document.createElement('div');
        lvlSubtitle.className = 'tg-level-subtitle';
        lvlSubtitle.textContent = level.subtitle;
        card.appendChild(lvlSubtitle);
      }

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

