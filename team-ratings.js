/**
 * Рейтинги сборных для лёгкого режима (автосимуляция).
 *
 * fifaRank   — место в рейтинге FIFA (меньше = сильнее).
 * fifaPoints — очки FIFA (основа для силы команды в sim-engine).
 * form       — последние 10 матчей: W / D / L, слева направо (новее → старее).
 *
 * form: null — нейтральная форма, пока не подставишь Sofascore.
 */

const TEAM_RATINGS = {};

const HOST_TEAM_IDS = new Set(['USA', 'MEX', 'CAN']);

/** FIFA (май 2026) — только 48 команд турнира */
const FIFA_WC2026 = {
  MEX: { fifaRank: 15, fifaPoints: 1681 },
  RSA: { fifaRank: 60, fifaPoints: 1429 },
  KOR: { fifaRank: 25, fifaPoints: 1588 },
  CZE: { fifaRank: 41, fifaPoints: 1501 },
  CAN: { fifaRank: 30, fifaPoints: 1556 },
  BIH: { fifaRank: 65, fifaPoints: 1385 },
  QAT: { fifaRank: 55, fifaPoints: 1454 },
  SUI: { fifaRank: 19, fifaPoints: 1649 },
  BRA: { fifaRank: 6, fifaPoints: 1761 },
  MAR: { fifaRank: 8, fifaPoints: 1755 },
  HAI: { fifaRank: 83, fifaPoints: 1291 },
  SCO: { fifaRank: 43, fifaPoints: 1498 },
  USA: { fifaRank: 16, fifaPoints: 1673 },
  PAR: { fifaRank: 40, fifaPoints: 1503 },
  AUS: { fifaRank: 27, fifaPoints: 1580 },
  TUR: { fifaRank: 22, fifaPoints: 1599 },
  GER: { fifaRank: 10, fifaPoints: 1730 },
  CUW: { fifaRank: 82, fifaPoints: 1294 },
  CIV: { fifaRank: 34, fifaPoints: 1532 },
  ECU: { fifaRank: 23, fifaPoints: 1594 },
  NED: { fifaRank: 7, fifaPoints: 1757 },
  JPN: { fifaRank: 18, fifaPoints: 1660 },
  SWE: { fifaRank: 38, fifaPoints: 1514 },
  TUN: { fifaRank: 44, fifaPoints: 1483 },
  BEL: { fifaRank: 9, fifaPoints: 1734 },
  EGY: { fifaRank: 29, fifaPoints: 1563 },
  IRN: { fifaRank: 21, fifaPoints: 1615 },
  NZL: { fifaRank: 85, fifaPoints: 1281 },
  ESP: { fifaRank: 2, fifaPoints: 1876 },
  CPV: { fifaRank: 69, fifaPoints: 1366 },
  KSA: { fifaRank: 61, fifaPoints: 1421 },
  URU: { fifaRank: 17, fifaPoints: 1673 },
  FRA: { fifaRank: 1, fifaPoints: 1877 },
  SEN: { fifaRank: 14, fifaPoints: 1688 },
  IRQ: { fifaRank: 57, fifaPoints: 1447 },
  NOR: { fifaRank: 31, fifaPoints: 1550 },
  ARG: { fifaRank: 3, fifaPoints: 1874 },
  DZA: { fifaRank: 28, fifaPoints: 1564 },
  AUT: { fifaRank: 24, fifaPoints: 1593 },
  JOR: { fifaRank: 63, fifaPoints: 1391 },
  POR: { fifaRank: 5, fifaPoints: 1763 },
  COD: { fifaRank: 46, fifaPoints: 1478 },
  UZB: { fifaRank: 50, fifaPoints: 1465 },
  COL: { fifaRank: 13, fifaPoints: 1693 },
  ENG: { fifaRank: 4, fifaPoints: 1825 },
  CRO: { fifaRank: 11, fifaPoints: 1717 },
  GHA: { fifaRank: 74, fifaPoints: 1346 },
  PAN: { fifaRank: 33, fifaPoints: 1540 },
};

(function initTeamRatings() {
  if (typeof WORLD_CUP_2026_CONFIG === 'undefined') return;
  for (const group of WORLD_CUP_2026_CONFIG.groups) {
    for (const team of group.teams) {
      const fifa = FIFA_WC2026[team.id] || {};
      TEAM_RATINGS[team.id] = {
        fifaRank: fifa.fifaRank ?? null,
        fifaPoints: fifa.fifaPoints ?? null,
        form: null,
      };
    }
  }
})();
