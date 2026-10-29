/** Nigerian states, for the group's profile (the same list as the web). */
export const NIGERIAN_STATES = ['Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara'];

/** Splits a saved address ("12 Market Road, Aba, Abia") into the area and a trailing state, the way the profile step shows it. */
export function splitAddress(address: string | null | undefined): { area: string; state: string } {
  const parts = (address ?? '').split(',').map((x) => x.trim()).filter(Boolean);
  const last = parts[parts.length - 1];
  if (last && NIGERIAN_STATES.includes(last)) return { area: parts.slice(0, -1).join(', '), state: last };
  return { area: parts.join(', '), state: '' };
}
