import 'dotenv/config';

const pe = process.env;

export const appConfig = {
  port: getNumber('PORT', 23623),
  pingTargets: pe.PING_TARGETS ? pe.PING_TARGETS.split(',') : [],
  hddWatch: pe.HDD_WATCHES ? pe.HDD_WATCHES.split(',') : [],
}

function getNumber(key: string, defaultValue = 0): number {
  return pe[key] ? parseFloat(pe[key]) : defaultValue;
}