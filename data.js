// Базовая конфигурация ЧМ‑2026 для симулятора
// Группы и команды (включая ещё не разыгранные стыки как отдельные "команды‑заглушки")

const WORLD_CUP_2026_CONFIG = {
  name: "Чемпионат мира 2026",
  groups: [
    {
      id: "A",
      name: "Группа A",
      teams: [
        { id: "MEX", name: "Мексика", flag: "🇲🇽" },
        { id: "RSA", name: "ЮАР", flag: "🇿🇦" },
        { id: "KOR", name: "Южная Корея", flag: "🇰🇷" },
        {
          id: "EU_PO_D_WIN",
          name: "Победитель пути D (Европа)",
          shortName: "Путь D",
          flag: "❓",
        },
      ],
    },
    {
      id: "B",
      name: "Группа B",
      teams: [
        { id: "CAN", name: "Канада", flag: "🇨🇦" },
        {
          id: "EU_PO_A_WIN",
          name: "Победитель пути A (Европа)",
          shortName: "Путь A",
          flag: "❓",
        },
        { id: "QAT", name: "Катар", flag: "🇶🇦" },
        { id: "SUI", name: "Швейцария", flag: "🇨🇭" },
      ],
    },
    {
      id: "C",
      name: "Группа C",
      teams: [
        { id: "BRA", name: "Бразилия", flag: "🇧🇷" },
        { id: "MAR", name: "Марокко", flag: "🇲🇦" },
        { id: "HAI", name: "Гаити", flag: "🇭🇹" },
        { id: "SCO", name: "Шотландия", flag: "🏴" },
      ],
    },
    {
      id: "D",
      name: "Группа D",
      teams: [
        { id: "USA", name: "США", flag: "🇺🇸" },
        { id: "PAR", name: "Парагвай", flag: "🇵🇾" },
        { id: "AUS", name: "Австралия", flag: "🇦🇺" },
        {
          id: "EU_PO_C_WIN",
          name: "Победитель пути C (Европа)",
          shortName: "Путь C",
          flag: "❓",
        },
      ],
    },
    {
      id: "E",
      name: "Группа E",
      teams: [
        { id: "GER", name: "Германия", flag: "🇩🇪" },
        { id: "CUW", name: "Кюрасао", flag: "🇨🇼" },
        { id: "CIV", name: "Кот-д’Ивуар", flag: "🇨🇮" },
        { id: "ECU", name: "Эквадор", flag: "🇪🇨" },
      ],
    },
    {
      id: "F",
      name: "Группа F",
      teams: [
        { id: "NED", name: "Нидерланды", flag: "🇳🇱" },
        { id: "JPN", name: "Япония", flag: "🇯🇵" },
        {
          id: "EU_PO_B_WIN",
          name: "Победитель пути B (Европа)",
          shortName: "Путь B",
          flag: "❓",
        },
        { id: "TUN", name: "Тунис", flag: "🇹🇳" },
      ],
    },
    {
      id: "G",
      name: "Группа G",
      teams: [
        { id: "BEL", name: "Бельгия", flag: "🇧🇪" },
        { id: "EGY", name: "Египет", flag: "🇪🇬" },
        { id: "IRN", name: "Иран", flag: "🇮🇷" },
        { id: "NZL", name: "Новая Зеландия", flag: "🇳🇿" },
      ],
    },
    {
      id: "H",
      name: "Группа H",
      teams: [
        { id: "ESP", name: "Испания", flag: "🇪🇸" },
        { id: "CPV", name: "Кабо-Верде", flag: "🇨🇻" },
        { id: "KSA", name: "Саудовская Аравия", flag: "🇸🇦" },
        { id: "URU", name: "Уругвай", flag: "🇺🇾" },
      ],
    },
    {
      id: "I",
      name: "Группа I",
      teams: [
        { id: "FRA", name: "Франция", flag: "🇫🇷" },
        { id: "SEN", name: "Сенегал", flag: "🇸🇳" },
        {
          id: "IC_PO2_WIN",
          name: "Победитель межконт. пути 2",
          shortName: "Путь 2",
          flag: "❓",
        },
        { id: "NOR", name: "Норвегия", flag: "🇳🇴" },
      ],
    },
    {
      id: "J",
      name: "Группа J",
      teams: [
        { id: "ARG", name: "Аргентина", flag: "🇦🇷" },
        { id: "DZA", name: "Алжир", flag: "🇩🇿" },
        { id: "AUT", name: "Австрия", flag: "🇦🇹" },
        { id: "JOR", name: "Иордания", flag: "🇯🇴" },
      ],
    },
    {
      id: "K",
      name: "Группа K",
      teams: [
        { id: "POR", name: "Португалия", flag: "🇵🇹" },
        {
          id: "IC_PO1_WIN",
          name: "Победитель межконт. пути 1",
          shortName: "Путь 1",
          flag: "❓",
        },
        { id: "UZB", name: "Узбекистан", flag: "🇺🇿" },
        { id: "COL", name: "Колумбия", flag: "🇨🇴" },
      ],
    },
    {
      id: "L",
      name: "Группа L",
      teams: [
        { id: "ENG", name: "Англия", flag: "🏴" },
        { id: "CRO", name: "Хорватия", flag: "🇭🇷" },
        { id: "GHA", name: "Гана", flag: "🇬🇭" },
        { id: "PAN", name: "Панама", flag: "🇵🇦" },
      ],
    },
  ],
};

// Дополнительные команды, которые участвуют только в стыках
const PLAYOFF_TEAMS = [
  // Европа — путь A
  { id: "ITA", name: "Италия", flag: "🇮🇹" },
  { id: "NIR", name: "Северная Ирландия", flag: "🇬🇧" },
  { id: "WAL", name: "Уэльс", flag: "🏴" },
  { id: "BIH", name: "Босния и Герцеговина", flag: "🇧🇦" },
  // Европа — путь B
  { id: "UKR", name: "Украина", flag: "🇺🇦" },
  { id: "SWE", name: "Швеция", flag: "🇸🇪" },
  { id: "POL", name: "Польша", flag: "🇵🇱" },
  { id: "ALB", name: "Албания", flag: "🇦🇱" },
  // Европа — путь C
  { id: "SVK", name: "Словакия", flag: "🇸🇰" },
  { id: "XKX", name: "Косово", flag: "🇽🇰" },
  { id: "TUR", name: "Турция", flag: "🇹🇷" },
  { id: "ROU", name: "Румыния", flag: "🇷🇴" },
  // Европа — путь D
  { id: "DEN", name: "Дания", flag: "🇩🇰" },
  { id: "MKD", name: "Северная Македония", flag: "🇲🇰" },
  { id: "CZE", name: "Чехия", flag: "🇨🇿" },
  { id: "IRL", name: "Ирландия", flag: "🇮🇪" },
  // Межконтинентальные стыки — путь 1
  { id: "NCL", name: "Новая Каледония", flag: "🇳🇨" },
  { id: "JAM", name: "Ямайка", flag: "🇯🇲" },
  { id: "COD", name: "ДР Конго", flag: "🇨🇩" },
  // Межконтинентальные стыки — путь 2
  { id: "BOL", name: "Боливия", flag: "🇧🇴" },
  { id: "SUR", name: "Суринам", flag: "🇸🇷" },
  { id: "IRQ", name: "Ирак", flag: "🇮🇶" },
];

// Конфигурация стыковых матчей: пути Европы и межконтинентальные
const PLAYOFFS_CONFIG = {
  paths: [
    {
      id: "EU-A",
      label: "Европа — путь A",
      slotId: "EU_PO_A_WIN",
      semifinals: [
        { id: "EU-A-SF1", homeTeamId: "ITA", awayTeamId: "NIR" },
        { id: "EU-A-SF2", homeTeamId: "WAL", awayTeamId: "BIH" },
      ],
      final: {
        id: "EU-A-FIN",
        homeFromId: "EU-A-SF1",
        awayFromId: "EU-A-SF2",
      },
    },
    {
      id: "EU-B",
      label: "Европа — путь B",
      slotId: "EU_PO_B_WIN",
      semifinals: [
        { id: "EU-B-SF1", homeTeamId: "UKR", awayTeamId: "SWE" },
        { id: "EU-B-SF2", homeTeamId: "POL", awayTeamId: "ALB" },
      ],
      final: {
        id: "EU-B-FIN",
        homeFromId: "EU-B-SF1",
        awayFromId: "EU-B-SF2",
      },
    },
    {
      id: "EU-C",
      label: "Европа — путь C",
      slotId: "EU_PO_C_WIN",
      semifinals: [
        { id: "EU-C-SF1", homeTeamId: "SVK", awayTeamId: "XKX" },
        { id: "EU-C-SF2", homeTeamId: "TUR", awayTeamId: "ROU" },
      ],
      final: {
        id: "EU-C-FIN",
        homeFromId: "EU-C-SF1",
        awayFromId: "EU-C-SF2",
      },
    },
    {
      id: "EU-D",
      label: "Европа — путь D",
      slotId: "EU_PO_D_WIN",
      semifinals: [
        { id: "EU-D-SF1", homeTeamId: "DEN", awayTeamId: "MKD" },
        { id: "EU-D-SF2", homeTeamId: "CZE", awayTeamId: "IRL" },
      ],
      final: {
        id: "EU-D-FIN",
        homeFromId: "EU-D-SF1",
        awayFromId: "EU-D-SF2",
      },
    },
    {
      id: "IC-1",
      label: "Межконтинентальные — путь 1",
      slotId: "IC_PO1_WIN",
      semifinals: [
        { id: "IC-1-SF1", homeTeamId: "NCL", awayTeamId: "JAM" },
      ],
      final: {
        id: "IC-1-FIN",
        homeTeamId: "COD",
        awayFromId: "IC-1-SF1",
      },
    },
    {
      id: "IC-2",
      label: "Межконтинентальные — путь 2",
      slotId: "IC_PO2_WIN",
      semifinals: [
        { id: "IC-2-SF1", homeTeamId: "BOL", awayTeamId: "SUR" },
      ],
      final: {
        id: "IC-2-FIN",
        homeTeamId: "IRQ",
        awayFromId: "IC-2-SF1",
      },
    },
  ],
};

// ISO‑коды флагов для загрузки с CDN (https://flagcdn.com)
const FLAG_CODE_BY_TEAM_ID = {
  MEX: "mx",
  RSA: "za",
  KOR: "kr",
  CAN: "ca",
  QAT: "qa",
  SUI: "ch",
  BRA: "br",
  MAR: "ma",
  HAI: "ht",
  SCO: "gb-sct",
  USA: "us",
  PAR: "py",
  AUS: "au",
  GER: "de",
  CUW: "cw",
  CIV: "ci",
  ECU: "ec",
  NED: "nl",
  JPN: "jp",
  TUN: "tn",
  BEL: "be",
  EGY: "eg",
  IRN: "ir",
  NZL: "nz",
  ESP: "es",
  CPV: "cv",
  KSA: "sa",
  URU: "uy",
  FRA: "fr",
  SEN: "sn",
  NOR: "no",
  ARG: "ar",
  DZA: "dz",
  AUT: "at",
  JOR: "jo",
  POR: "pt",
  UZB: "uz",
  COL: "co",
  ENG: "gb-eng",
  CRO: "hr",
  GHA: "gh",
  PAN: "pa",
  // Евростыки
  ITA: "it",
  NIR: "gb-nir",
  WAL: "gb-wls",
  BIH: "ba",
  UKR: "ua",
  SWE: "se",
  POL: "pl",
  ALB: "al",
  SVK: "sk",
  XKX: "xk",
  TUR: "tr",
  ROU: "ro",
  DEN: "dk",
  MKD: "mk",
  CZE: "cz",
  IRL: "ie",
  // Межконтинентальные
  NCL: "nc",
  JAM: "jm",
  COD: "cd",
  BOL: "bo",
  SUR: "sr",
  IRQ: "iq",
};


