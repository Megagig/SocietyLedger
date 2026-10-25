/** What the AI model may see about people: stand-ins, never names, phones or emails. */
import { aliasKnownNames, Pseudonymizer, sanitizeForModel, scrubContacts } from '../../src/modules/ai/ai-privacy';

const members = [
  { id: 14, firstName: 'Ada', lastName: 'Obi' },
  { id: 15, firstName: 'Bola', lastName: 'Adeyemi' },
  { id: 16, firstName: 'Ada', lastName: 'Okoro' },
];

describe('stand-ins', () => {
  it('gives the same member the same stand-in every time, and a new one to each other member', () => {
    const p = new Pseudonymizer();
    expect(p.alias(14, 'Ada Obi')).toBe('Member 1');
    expect(p.alias(15, 'Bola Adeyemi')).toBe('Member 2');
    expect(p.alias(14, 'Ada Obi')).toBe('Member 1');
    expect(p.size).toBe(2);
  });

  it('puts the real names back into what the model wrote', () => {
    const p = new Pseudonymizer();
    p.alias(14, 'Ada Obi');
    p.alias(15, 'Bola Adeyemi');
    expect(p.restore('Member 2 owes the most, then Member 1.')).toBe('Bola Adeyemi owes the most, then Ada Obi.');
  });

  it('does not confuse Member 1 with Member 10, and leaves a number it never handed out alone', () => {
    const p = new Pseudonymizer();
    for (let i = 1; i <= 10; i += 1) p.alias(i, `Person ${i}`);
    expect(p.restore('Member 10 and Member 1')).toBe('Person 10 and Person 1');
    expect(p.restore('Member 99 is unknown')).toBe('Member 99 is unknown');
  });
});

describe('contacts', () => {
  it('are taken out of text before it goes to the model', () => {
    expect(scrubContacts('Email ada@example.com or call 08031234567')).toBe('Email [email removed] or call [number removed]');
    expect(scrubContacts('Call +234 803 123 4567 now')).toBe('Call [number removed] now');
  });

  it('leave amounts of money alone', () => {
    expect(scrubContacts('They owe ₦1,250,000.00 and ₦45,000')).toBe('They owe ₦1,250,000.00 and ₦45,000');
  });
});

describe('names the officer typed, or that an earlier answer showed', () => {
  it('are swapped for stand-ins, in either order and any case', () => {
    const p = new Pseudonymizer();
    const result = aliasKnownNames('What does ada obi owe, and what about Adeyemi Bola?', members, p);
    expect(result.text).toBe('What does Member 1 owe, and what about Member 2?');
    expect(result.found).toEqual([14, 15]);
    expect(p.restore(result.text)).toBe('What does Ada Obi owe, and what about Bola Adeyemi?');
  });

  it('need the whole name, so a first name alone is not guessed at', () => {
    const p = new Pseudonymizer();
    expect(aliasKnownNames('How is Ada doing?', members, p)).toEqual({ text: 'How is Ada doing?', found: [] });
  });

  it('tell two people with the same first name apart', () => {
    const p = new Pseudonymizer();
    const { text, found } = aliasKnownNames('Compare Ada Okoro with Ada Obi', members, p);
    expect(found.sort()).toEqual([14, 16]);
    expect(text).not.toMatch(/Ada/);
  });

  it('are removed together with any contact, and the text is kept short', () => {
    const p = new Pseudonymizer();
    const { text } = sanitizeForModel('Remind Ada Obi on 08031234567 ' + 'x'.repeat(2000), members, p);
    expect(text).toContain('Remind Member 1 on [number removed]');
    expect(text.length).toBeLessThanOrEqual(1000);
  });
});
