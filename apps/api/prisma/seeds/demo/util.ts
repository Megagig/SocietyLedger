/**
 * Deterministic helpers for the demo seed: a fixed-seed random number generator, Nigerian names and phone numbers, and dates that are
 * relative to the day the seed is run (so the demo looks current) but never random.
 */

/** mulberry32: a tiny, well-spread PRNG. Same seed, same sequence, on every machine. */
export function makeRng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min,
    pick: <T>(list: readonly T[]): T => list[Math.floor(next() * list.length)],
    chance: (p: number) => next() < p,
  };
}
export type Rng = ReturnType<typeof makeRng>;

export const SEED_NUMBER = 20261102;

const FIRST_NAMES = [
  'Chidinma', 'Emeka', 'Folake', 'Ibrahim', 'Chiamaka', 'Oluwaseun', 'Amina', 'Chukwuemeka', 'Yetunde', 'Abdullahi', 'Nkechi', 'Babatunde',
  'Halima', 'Obinna', 'Aisha', 'Kayode', 'Chinwe', 'Yusuf', 'Funmilayo', 'Uche', 'Ngozi', 'Tunde', 'Adaeze', 'Segun', 'Ifeoma', 'Musa',
  'Blessing', 'Femi', 'Zainab', 'Ikenna', 'Titilayo', 'Sani', 'Onyinye', 'Damilola', 'Hauwa', 'Nnamdi', 'Bukola', 'Garba', 'Chioma', 'Rotimi',
];
const LAST_NAMES = [
  'Nwosu', 'Adeyemi', 'Okonkwo', 'Suleiman', 'Ogunleye', 'Eze', 'Bello', 'Chukwu', 'Afolabi', 'Garba', 'Umeh', 'Adebayo', 'Mohammed', 'Nnamdi',
  'Alabi', 'Danjuma', 'Okeke', 'Lawal', 'Agbaje', 'Usman', 'Okafor', 'Bakare', 'Igwe', 'Balogun', 'Ibekwe', 'Yakubu', 'Ojo', 'Anyanwu', 'Salami', 'Obi',
];
const STREETS = ['Adeola Odeku Street', 'Ikorodu Road', 'Aba Road', 'Zik Avenue', 'Market Road', 'Awolowo Way', 'Old Bank Road', 'Tinubu Close', 'Palm Grove Estate Road', 'Ogui Road'];
const CITIES: Array<[string, string]> = [['Lagos', 'Lagos'], ['Umuahia', 'Abia'], ['Enugu', 'Enugu'], ['Abuja', 'FCT'], ['Port Harcourt', 'Rivers'], ['Ibadan', 'Oyo'], ['Kano', 'Kano']];
const PHONE_PREFIXES = ['0803', '0805', '0806', '0810', '0813', '0816', '0703', '0802', '0809', '0901'];

export interface PersonName { firstName: string; lastName: string }

/** The n-th person in a tenant. Names repeat across tenants on purpose (it is a small country) but not within one. */
export function personName(rng: Rng, taken: Set<string>): PersonName {
  for (let tries = 0; tries < 200; tries += 1) {
    const firstName = rng.pick(FIRST_NAMES);
    const lastName = rng.pick(LAST_NAMES);
    const key = `${firstName} ${lastName}`;
    if (!taken.has(key)) {
      taken.add(key);
      return { firstName, lastName };
    }
  }
  const firstName = rng.pick(FIRST_NAMES);
  return { firstName, lastName: `${rng.pick(LAST_NAMES)}-${taken.size}` };
}

export const phoneFor = (rng: Rng) => `${rng.pick(PHONE_PREFIXES)}${String(rng.int(0, 9999999)).padStart(7, '0')}`;
export const addressFor = (rng: Rng) => `${rng.int(1, 120)} ${rng.pick(STREETS)}`;
export const cityFor = (rng: Rng) => rng.pick(CITIES);

// ---- dates -------------------------------------------------------------------------------------------------------------------------
export const DAY_MS = 86_400_000;

/** Midnight UTC of the day the seed was started. Everything in the demo is an offset from it. */
export function startOfToday(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
export const daysFrom = (base: Date, n: number) => new Date(base.getTime() + n * DAY_MS);
export const isoDay = (d: Date) => d.toISOString().slice(0, 10);
export function addMonths(base: Date, n: number): Date {
  return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + n, Math.min(base.getUTCDate(), 28)));
}
/** The 5th of the month `n` months from the base month: when monthly dues fall due. */
export const dueDay = (base: Date, n: number) => new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + n, 5));

export const naira = (n: number) => `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
