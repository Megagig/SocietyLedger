/**
 * Imported FIRST by demo-ajo.seed.ts. The Ajo services tell people about what happens (a payment confirmed, a payout approved) by email,
 * SMS and push, and this machine has real sending credentials. The demo tenant's addresses are fictional, so every sender is replaced
 * with one that does nothing before any service is loaded. Nothing is sent, and nothing in the demo data depends on it being sent.
 */
import Module from 'module';

type Loader = (request: string, parent: unknown, ...rest: unknown[]) => unknown;
const internals = Module as unknown as { _load: Loader };
const realLoad = internals._load;

const quiet: Array<[RegExp, unknown]> = [
  [/notification-preferences\.service$/, { dispatchNotification: async () => ({ inAppCreated: false, emailSent: false, smsSent: false }) }],
  [/sms[\\/]sms-engine$/, { dispatchMessages: async () => ({ accepted: 0, credits: 0, messageIds: [], done: Promise.resolve({ sent: 0, failed: 0, refunded: 0 }) }) }],
  [/lib[\\/]email$/, { sendEmail: async () => undefined }],
  [/services[\\/]push\.service$/, { sendPushToUsers: async () => undefined }],
];

internals._load = function patched(this: unknown, request: string, parent: unknown, ...rest: unknown[]) {
  for (const [pattern, replacement] of quiet) if (pattern.test(request)) return replacement;
  return realLoad.call(this, request, parent, ...rest);
};

export const demoSendersSilenced = true;
