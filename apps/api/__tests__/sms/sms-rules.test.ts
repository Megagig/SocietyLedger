import { RuleError } from '../../src/modules/finance/rule-error';
import {
  ACTIVE_MEMBER,
  amountStillOwed,
  assertCampaignStartable,
  assertEnoughCredits,
  assertMessageUsable,
  classifyForSms,
  creditsNeeded,
  dedupeRecipients,
  normalizePhone,
  smsSegments,
} from '../../src/modules/sms/sms-rules';

const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(RuleError);
    return (e as RuleError).code;
  }
  return null;
};

describe('phone numbers', () => {
  it('turns the ways Nigerians write a number into the one the provider wants', () => {
    expect(normalizePhone('0803 123 4567')).toBe('2348031234567');
    expect(normalizePhone('+234 803 123 4567')).toBe('2348031234567');
    expect(normalizePhone('2348031234567')).toBe('2348031234567');
    expect(normalizePhone('8031234567')).toBe('2348031234567');
  });

  it('refuses what is not a number it could text', () => {
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone('12345')).toBeNull();
    expect(normalizePhone('call me')).toBeNull();
  });
});

describe('how many credits a text uses', () => {
  it('plain text: 160 characters is one, then 153 per segment', () => {
    expect(smsSegments('a'.repeat(160))).toBe(1);
    expect(smsSegments('a'.repeat(161))).toBe(2);
    expect(smsSegments('a'.repeat(306))).toBe(2);
    expect(smsSegments('a'.repeat(307))).toBe(3);
  });

  it('a ₦ sign or an emoji switches the whole message to the smaller segments', () => {
    expect(smsSegments('Pay ₦5,000 by Friday')).toBe(1);
    expect(smsSegments('a'.repeat(71) + '₦')).toBe(2);
    expect(smsSegments('📢 Meeting at 4pm')).toBe(1);
    expect(smsSegments('📢 ' + 'a'.repeat(80))).toBe(2);
  });

  it('a few characters count twice in plain text, and an empty message is one', () => {
    expect(smsSegments('['.repeat(80))).toBe(1); // 160 places
    expect(smsSegments('['.repeat(81))).toBe(2); // 162 places
    expect(smsSegments('')).toBe(1);
  });

  it('credits are recipients times segments', () => {
    expect(creditsNeeded(176, 2)).toBe(352);
  });
});

describe('credits', () => {
  it('say exactly what is short', () => {
    expect(code(() => assertEnoughCredits(100, 100))).toBeNull();
    expect(code(() => assertEnoughCredits(99, 100))).toBe('INSUFFICIENT_CREDITS');
    try {
      assertEnoughCredits(40, 100);
    } catch (e) {
      expect((e as RuleError).message).toBe('You need 100 SMS credits for this and have 40. Buy 60 more on the web to send it.');
    }
  });
});

describe('who gets a text', () => {
  const member = (over: object) => ({ id: 1, firstName: 'Ada', lastName: 'Obi', phone: '08031234567', userId: 10, ...over });

  it('every member with a usable number who has not opted out', () => {
    const audience = classifyForSms([member({ id: 1 }), member({ id: 2, phone: '08039999999', userId: 11 })], new Set());
    expect(audience.willText.map((r) => r.memberId)).toEqual([1, 2]);
    expect(audience.willText[0]).toMatchObject({ phone: '2348031234567', name: 'Ada Obi' });
  });

  it('counts the members it will miss, and why', () => {
    const audience = classifyForSms(
      [member({ id: 1 }), member({ id: 2, phone: null }), member({ id: 3, phone: 'n/a' }), member({ id: 4, phone: '08035555555', userId: 12 })],
      new Set([12]),
    );
    expect(audience.willText.map((r) => r.memberId)).toEqual([1]);
    expect(audience.noPhone.map((m) => m.id)).toEqual([2, 3]);
    expect(audience.optedOut.map((m) => m.id)).toEqual([4]);
  });

  it('a member with no login can be texted: opting out needs an account', () => {
    expect(classifyForSms([member({ userId: null })], new Set([10])).willText).toHaveLength(1);
  });

  it('members who share a number get one text, and a list with the same number twice is charged once', () => {
    expect(classifyForSms([member({ id: 1 }), member({ id: 2, phone: '+234 803 123 4567', userId: 11 })], new Set()).willText).toHaveLength(1);
    expect(dedupeRecipients([{ phone: '08031234567' }, { phone: '2348031234567' }, { phone: '08030000000' }])).toHaveLength(2);
  });

  it('"active" is lowercase, as members are stored', () => {
    expect(ACTIVE_MEMBER).toBe('active');
  });
});

describe('owing', () => {
  it('is what is still unpaid after payments, never below zero', () => {
    expect(amountStillOwed({ amount: 5000, payments: [{ amountPaid: 3000 }] })).toBe(2000);
    expect(amountStillOwed({ amount: '5000.00', payments: [] })).toBe(5000);
    expect(amountStillOwed({ amount: 5000, payments: [{ amountPaid: 6000 }] })).toBe(0);
  });
});

describe('campaigns and messages', () => {
  it('only a draft or scheduled campaign can be started', () => {
    expect(code(() => assertCampaignStartable('DRAFT'))).toBeNull();
    expect(code(() => assertCampaignStartable('SCHEDULED'))).toBeNull();
    expect(code(() => assertCampaignStartable('IN_PROGRESS'))).toBe('ALREADY_STARTED');
    expect(code(() => assertCampaignStartable('COMPLETED'))).toBe('ALREADY_STARTED');
  });

  it('a message has to have words, and not run to many credits per person', () => {
    expect(code(() => assertMessageUsable('   '))).toBe('EMPTY_MESSAGE');
    expect(assertMessageUsable('Meeting moved to 4pm')).toBe(1);
    expect(code(() => assertMessageUsable('a'.repeat(1200)))).toBe('MESSAGE_TOO_LONG');
  });
});
