export type MedalOption = {
  category: string;
  name: string;
  emojiFile?: string;
};

const SERVICE_VENERATION_YEAR_LABELS: Record<number, string> = {
  24: 'Veneration - 2 Years',
  36: 'Veneration - 3 Years',
  48: 'Veneration - 4 Years',
  60: 'Veneration - 5 Years'
};

function formatServiceVenerationName(months: number) {
  if (months % 12 === 0) {
    const years = months / 12;
    return `${years} YEAR VENERATION`;
  }

  return `${months} MONTH VENERATION`;
}

export const MEDAL_OPTIONS: MedalOption[] = [
  { category: 'Imperial Orders', name: "AHLGRIM'S CIRCLE", emojiFile: 'AhlgrimsCircle.png' },
  { category: 'Imperial Orders', name: 'IMPERIAL ORDER OF AHLGRIM', emojiFile: 'ImperialOrderOfAldiron.png' },
  { category: 'Imperial Orders', name: 'IMPERIAL ORDER OF AHLGRIM - KNIGHT', emojiFile: 'IOAKnight.png' },
  { category: 'Imperial Orders', name: 'IMPERIAL ORDER OF AHLGRIM - COMMANDER', emojiFile: 'IOACommander.png' },
  { category: 'Imperial Orders', name: 'IMPERIAL ORDER OF AHLGRIM - GRAND CROSS', emojiFile: 'IOAGrandCross.png' },
  { category: 'Imperial Orders', name: 'ORDER OF THE ANDOURAN EMPIRE', emojiFile: 'OAEKnight.png' },
  { category: 'Imperial Orders', name: 'ORDER OF THE ANDOURAN EMPIRE - KNIGHT', emojiFile: 'OAEKnight.png' },
  { category: 'Imperial Orders', name: 'ORDER OF THE ANDOURAN EMPIRE - COMMANDER', emojiFile: 'OAECommander.png' },
  { category: 'Imperial Orders', name: 'ORDER OF THE ANDOURAN EMPIRE - GRAND CROSS', emojiFile: 'OAGrandCross.png' },
  { category: 'Imperial Orders', name: 'ORDER OF THE ARCHITECTS', emojiFile: 'OAKnight.png' },
  { category: 'Imperial Orders', name: 'ORDER OF THE ARCHITECTS - KNIGHT', emojiFile: 'OAKnight.png' },
  { category: 'Imperial Orders', name: 'ORDER OF THE ARCHITECTS - KNIGHT COMMANDER', emojiFile: 'OAKnightCommander.png' },
  { category: 'Imperial Orders', name: 'ORDER OF THE CITADEL', emojiFile: 'OCKnight.png' },
  { category: 'Imperial Orders', name: 'ORDER OF THE CITADEL - KNIGHT', emojiFile: 'OCKnight.png' },
  { category: 'Imperial Orders', name: 'ORDER OF THE CITADEL - COMMANDER', emojiFile: 'OCCommander.png' },
  { category: 'Imperial Orders', name: 'ORDER OF THE GOLD GRIFFIN', emojiFile: 'OGG_Knight.png' },
  { category: 'Imperial Orders', name: 'ORDER OF THE GOLD GRIFFIN - ESQUIRE', emojiFile: 'OGG_Esquire.png' },
  { category: 'Imperial Orders', name: 'ORDER OF THE GOLD GRIFFIN - KNIGHT', emojiFile: 'OGG_Knight.png' },
  { category: 'Imperial Orders', name: 'ORDER OF THE GOLD GRIFFIN - BARON', emojiFile: 'OGG_Baron.png' },
  { category: 'Imperial Orders', name: 'ORDER OF THE GOLD GRIFFIN - EARL', emojiFile: 'OGG_Earl.png' },
  { category: 'Imperial Orders', name: 'ORDER OF THE GOLD GRIFFIN - DUKE', emojiFile: 'OGG_Duke.png' },
  { category: 'Imperial Orders', name: 'ORDER OF THE GOLD GRIFFIN - PRINCE', emojiFile: 'OGG_Prince.png' },

  { category: 'Shields', name: 'GOLD SHIELD (1ST CLASS)', emojiFile: 'GoldShield1stClass.png' },
  { category: 'Shields', name: 'GOLD SHIELD (2ND CLASS)', emojiFile: 'GoldShield2ndClass.png' },
  { category: 'Shields', name: 'GOLD SHIELD (3RD CLASS)', emojiFile: 'GoldShield3rdClass.png' },
  { category: 'Shields', name: 'SILVER SHIELD (1ST CLASS)', emojiFile: 'SilverShield1stClass.png' },
  { category: 'Shields', name: 'SILVER SHIELD (2ND CLASS)', emojiFile: 'SilverShield2ndClassold.png' },
  { category: 'Shields', name: 'SILVER SHIELD (3RD CLASS)', emojiFile: 'SilverShield3rdClassold.png' },
  { category: 'Shields', name: 'BRONZE SHIELD (1ST CLASS)', emojiFile: 'BronzeShield1stClass.png' },
  { category: 'Shields', name: 'BRONZE SHIELD (2ND CLASS)', emojiFile: 'BronzeShield2ndClass.png' },
  { category: 'Shields', name: 'BRONZE SHIELD (3RD CLASS)', emojiFile: 'BronzeShield3rdClass.png' },

  { category: 'Regional Awards', name: 'EMBODIMENT OF VASPIRIA' },

  { category: 'Corps Medals', name: 'GUARD KNIGHT COMMENDATION' },
  { category: 'Corps Medals', name: 'IMPERIAL GUARD CROSS (BRONZE)', emojiFile: 'BronzeGuardCross.png' },
  { category: 'Corps Medals', name: 'IMPERIAL GUARD CROSS (SILVER)', emojiFile: 'SilverGuardCross.png' },
  { category: 'Corps Medals', name: 'IMPERIAL GUARD CROSS (GOLD)', emojiFile: 'GoldGuardCross.png' },
  { category: 'Corps Medals', name: 'ORDER OF THE WHITE TIGER' },
  { category: 'Corps Medals', name: 'PROVINCIAL ARMY CROSS (BRONZE)', emojiFile: 'BronzeArmyCross.png' },
  { category: 'Corps Medals', name: 'PROVINCIAL ARMY CROSS (SILVER)', emojiFile: 'SilverArmyCross.png' },
  { category: 'Corps Medals', name: 'PROVINCIAL ARMY CROSS (GOLD)', emojiFile: 'GoldArmyCross.png' },

  { category: 'Regimental Awards', name: 'PARAGON OF MIGHT & HONOR', emojiFile: 'ParagonofMightHonor.png' },
  { category: 'Regimental Awards', name: 'IMPERIAL MERIT', emojiFile: 'ImperialMerit.png' },
  { category: 'Regimental Awards', name: 'CROSS OF CONSUMMATE VALOR', emojiFile: 'CrossofConsummateValor.png' },
  { category: 'Regimental Awards', name: 'ARTISANS ACCOLADE', emojiFile: 'ArtisansAccolade.png' },
  { category: 'Regimental Awards', name: 'SILVER ARCHITECT', emojiFile: 'SilverArchitect.png' },
  { category: 'Regimental Awards', name: 'CANNONEERS CROSS', emojiFile: 'CannoneersCross.png' },
  { category: 'Regimental Awards', name: 'RECRUITMENT CROSS (1ST CLASS)', emojiFile: 'RecruitmentCross1stClass.png' },
  { category: 'Regimental Awards', name: 'RECRUITMENT CROSS (2ND CLASS)', emojiFile: 'RecruitmentCross2ndClass.png' },
  { category: 'Regimental Awards', name: 'RECRUITMENT CROSS (3RD CLASS)', emojiFile: 'RecruitmentCross3rdClass.png' },
  { category: 'Regimental Awards', name: 'STAR OF SOLIDARITY', emojiFile: 'StarOfSolidarity.png' },
  { category: 'Regimental Awards', name: 'COLOR GUARD COMMENDATION', emojiFile: 'ColorGuardCommendation.png' },
  { category: 'Regimental Awards', name: 'VALOR IN DEATH (1ST CLASS)', emojiFile: 'ValorinDeath1stClass.png' },
  { category: 'Regimental Awards', name: 'VALOR IN DEATH (2ND CLASS)', emojiFile: 'ValorinDeath2ndClass.png' },
  { category: 'Regimental Awards', name: 'VALOR IN DEATH (3RD CLASS)', emojiFile: 'ValorinDeath3rdClass.png' },
  { category: 'Regimental Awards', name: 'HONORARY SERVICE (1ST CLASS)', emojiFile: 'HonoraryService1stClass.png' },
  { category: 'Regimental Awards', name: 'HONORARY SERVICE (2ND CLASS)', emojiFile: 'HonoraryService2ndClass.png' },
  { category: 'Regimental Awards', name: 'HONORARY SERVICE (3RD CLASS)', emojiFile: 'HonoraryService3rdClass.png' },

  { category: 'Campaign Venerations', name: '1ST PRUSSIAN CAMPAIGN VENERATION' },
  { category: 'Campaign Venerations', name: 'TOKUGAWA CAMPAIGN VENERATION' },
  { category: 'Campaign Venerations', name: 'IBERIAN CAMPAIGN VENERATION', emojiFile: 'IberianCampaignVeneration.png' },
  { category: 'Campaign Venerations', name: 'AMERICAN CAMPAIGN VENERATION', emojiFile: 'AmericanCampaignVeneration.png' },
  { category: 'Campaign Venerations', name: 'SHETLANDS CAMPAIGN VENERATION', emojiFile: 'ShetlandsCampaignVeneration.png' },

  { category: 'Service Venerations', name: formatServiceVenerationName(3), emojiFile: 'VEN3.png' },
  { category: 'Service Venerations', name: formatServiceVenerationName(6), emojiFile: 'VEN6.png' },
  { category: 'Service Venerations', name: formatServiceVenerationName(9), emojiFile: 'VEN9.png' },
  { category: 'Service Venerations', name: formatServiceVenerationName(12), emojiFile: 'VEN12.png' },
  { category: 'Service Venerations', name: formatServiceVenerationName(15), emojiFile: 'VEN15.png' },
  { category: 'Service Venerations', name: formatServiceVenerationName(18), emojiFile: 'VEN18.png' },
  { category: 'Service Venerations', name: formatServiceVenerationName(21), emojiFile: 'VEN21.png' },
  { category: 'Service Venerations', name: formatServiceVenerationName(24), emojiFile: 'VEN24.png' },
  { category: 'Service Venerations', name: formatServiceVenerationName(27), emojiFile: 'VEN27.png' },
  { category: 'Service Venerations', name: formatServiceVenerationName(30), emojiFile: 'VEN30.png' },
  { category: 'Service Venerations', name: formatServiceVenerationName(33), emojiFile: 'VEN33.png' },
  { category: 'Service Venerations', name: formatServiceVenerationName(36), emojiFile: 'VEN36.png' },
  { category: 'Service Venerations', name: formatServiceVenerationName(48), emojiFile: 'VEN48.png' },
  { category: 'Service Venerations', name: formatServiceVenerationName(60), emojiFile: 'Ven60.png' }
];

export const medalOptionsByCategory = MEDAL_OPTIONS.reduce<Record<string, string[]>>((accumulator, option) => {
  const existing = accumulator[option.category] || [];
  accumulator[option.category] = [...existing, option.name];
  return accumulator;
}, {});

function normalizeMedalName(value: string) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function formatVenerationName(months: number): string {
  const mapped = SERVICE_VENERATION_YEAR_LABELS[months];
  if (mapped) {
    return mapped;
  }

  return `Veneration - ${months} Months`;
}

export function formatMedalDisplayName(medalName: string): string {
  const trimmed = String(medalName || '').trim();
  const venMatch = /^ven\s*(\d+)$/i.exec(trimmed);
  if (!venMatch) {
    return trimmed;
  }

  return formatVenerationName(Number(venMatch[1]));
}

const emojiByNormalizedMedalName = new Map<string, string>();
MEDAL_OPTIONS.forEach((option) => {
  if (option.emojiFile) {
    emojiByNormalizedMedalName.set(normalizeMedalName(option.name), option.emojiFile);
  }
});

const LEGACY_MEDAL_NAME_ALIASES: Record<string, string> = {
  'gold shield': 'GoldShield1stClass.png',
  'silver shield': 'SilverShield1stClass.png',
  'bronze shield': 'BronzeShield1stClass.png',
  'imperial guard cross': 'BronzeGuardCross.png',
  'provincial army cross': 'BronzeArmyCross.png',
  'recruitment cross': 'RecruitmentCross3rdClass.png',
  'valor in death': 'ValorinDeath3rdClass.png',
  'honorary service': 'HonoraryService3rdClass.png',
  'color guard cross': 'ColorGuardCommendation.png',
  'order of the andouran empire': 'OAEKnight.png',
  'order of the citadel': 'OCKnight.png',
  'order of the architects': 'OAKnight.png',
  'order of the gold griffin': 'OGG_Knight.png',
  'imperial order of ahlgrim': 'ImperialOrderOfAldiron.png',
  '1st prussian campaign veneration': 'AmericanCampaignVeneration.png',
  'tokugawa campaign veneration': 'AmericanCampaignVeneration.png',
  'ven 3': 'VEN3.png',
  'ven 6': 'VEN6.png',
  'ven 9': 'VEN9.png',
  'ven 12': 'VEN12.png',
  'ven 15': 'VEN15.png',
  'ven 18': 'VEN18.png',
  'ven 21': 'VEN21.png',
  'ven 24': 'VEN24.png',
  'ven 27': 'VEN27.png',
  'ven 30': 'VEN30.png',
  'ven 33': 'VEN33.png',
  'ven 36': 'VEN36.png',
  'ven 48': 'VEN48.png',
  'ven 60': 'Ven60.png'
};

export function getMedalEmojiPath(medalName: string) {
  const normalized = normalizeMedalName(medalName);
  const direct = emojiByNormalizedMedalName.get(normalized);
  if (direct) {
    return `/medals/${direct}`;
  }

  const legacy = LEGACY_MEDAL_NAME_ALIASES[normalized];
  return legacy ? `/medals/${legacy}` : null;
}
