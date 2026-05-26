/**
 * Рейтинги сборных для лёгкого режима (автосимуляция).
 *
 * fifaRank — место в рейтинге FIFA (меньше = сильнее).
 * form     — последние 10 матчей: W / D / L, слева направо (новее → старее).
 *
 * null = заглушка: движок использует нейтральные значения, пока не заполнишь.
 * После подстановки свежего FIFA и формы с Sofascore симуляция станет осмысленной.
 */

const TEAM_RATINGS = {};

const HOST_TEAM_IDS = new Set(['USA', 'MEX', 'CAN']);

(function initTeamRatings() {
  if (typeof WORLD_CUP_2026_CONFIG === 'undefined') return;
  for (const group of WORLD_CUP_2026_CONFIG.groups) {
    for (const team of group.teams) {
      if (!TEAM_RATINGS[team.id]) {
        TEAM_RATINGS[team.id] = { fifaRank: null, form: null };
      }
    }
  }
})();
