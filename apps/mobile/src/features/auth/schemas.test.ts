import { forgotPasswordSchema, loginSchema, newPasswordSchema, otpSchema, registerSchema } from './schemas';

describe('loginSchema', () => {
  it('accepts a valid email and non-empty password', () => {
    expect(loginSchema.safeParse({ email: 'ada@example.com', password: 'secret' }).success).toBe(true);
  });

  it('lowercases and trims the email', () => {
    const result = loginSchema.safeParse({ email: '  Ada@Example.com  ', password: 'secret' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe('ada@example.com');
  });

  it('rejects an invalid email', () => {
    expect(loginSchema.safeParse({ email: 'not-an-email', password: 'secret' }).success).toBe(false);
  });

  it('rejects an empty password', () => {
    expect(loginSchema.safeParse({ email: 'ada@example.com', password: '' }).success).toBe(false);
  });
});

describe('otpSchema', () => {
  it('accepts exactly 6 digits', () => {
    expect(otpSchema.safeParse({ code: '123456' }).success).toBe(true);
  });

  it('rejects anything other than 6 characters', () => {
    expect(otpSchema.safeParse({ code: '12345' }).success).toBe(false);
    expect(otpSchema.safeParse({ code: '1234567' }).success).toBe(false);
  });
});

const validRegisterInput = {
  firstName: 'Ada',
  lastName: 'Eze',
  email: 'ada@example.com',
  password: 'secret1',
  confirmPassword: 'secret1',
  acceptTerms: true,
};

describe('registerSchema', () => {
  it('accepts matching passwords and accepted terms', () => {
    expect(registerSchema.safeParse(validRegisterInput).success).toBe(true);
  });

  it('rejects mismatched passwords', () => {
    const result = registerSchema.safeParse({ ...validRegisterInput, confirmPassword: 'different' });
    expect(result.success).toBe(false);
  });

  it('rejects unaccepted terms', () => {
    expect(registerSchema.safeParse({ ...validRegisterInput, acceptTerms: false }).success).toBe(false);
  });

  it('rejects a password under 6 characters', () => {
    expect(registerSchema.safeParse({ ...validRegisterInput, password: 'ab1', confirmPassword: 'ab1' }).success).toBe(false);
  });
});

describe('forgotPasswordSchema', () => {
  it('accepts a valid email', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'ada@example.com' }).success).toBe(true);
  });

  it('rejects an invalid email', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'not-an-email' }).success).toBe(false);
  });
});

describe('newPasswordSchema', () => {
  it('accepts matching passwords of at least 6 characters', () => {
    expect(newPasswordSchema.safeParse({ password: 'secret1', confirmPassword: 'secret1' }).success).toBe(true);
  });

  it('rejects mismatched passwords', () => {
    expect(newPasswordSchema.safeParse({ password: 'secret1', confirmPassword: 'secret2' }).success).toBe(false);
  });
});
