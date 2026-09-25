import { describe, it, expect } from 'vitest';
import { ScryptPasswordHasher } from '../public/authentication/password.js';

describe('ScryptPasswordHasher', () => {
  // Use lower cost parameter (2^10 = 1024) for fast test execution while verifying identical algorithm format
  const hasher = new ScryptPasswordHasher({ cost: 1024, blockSize: 8, parallelization: 1 });

  it('hashes password with random salt and standard modular format', async () => {
    const password = 'SuperSecretPassword123!';
    const hash1 = await hasher.hash(password);
    const hash2 = await hasher.hash(password);

    expect(hash1).toMatch(/^\$scrypt\$ln=10,r=8,p=1\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
    expect(hash2).toMatch(/^\$scrypt\$ln=10,r=8,p=1\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
    // Two hashes of identical password must be different due to random salt
    expect(hash1).not.toBe(hash2);
  });

  it('verifies correct password against hash', async () => {
    const password = 'CorrectHorseBatteryStaple';
    const hash = await hasher.hash(password);

    const isValid = await hasher.verify(password, hash);
    expect(isValid).toBe(true);
  });

  it('rejects incorrect password against hash', async () => {
    const hash = await hasher.hash('ValidPassword456');

    const isValid = await hasher.verify('WrongPassword789', hash);
    expect(isValid).toBe(false);
  });

  it('rejects malformed hashes safely without throwing unhandled exceptions', async () => {
    expect(await hasher.verify('any', 'not-a-hash')).toBe(false);
    expect(await hasher.verify('any', '$bcrypt$invalid$format')).toBe(false);
    expect(await hasher.verify('any', '$scrypt$invalid$format')).toBe(false);
  });

  it('correctly reports when hash needs rehashing after cost upgrade', async () => {
    const lowCostHasher = new ScryptPasswordHasher({ cost: 1024 });
    const highCostHasher = new ScryptPasswordHasher({ cost: 2048 });

    const hash = await lowCostHasher.hash('MyPassword');

    expect(lowCostHasher.needsRehash(hash)).toBe(false);
    expect(highCostHasher.needsRehash(hash)).toBe(true);
  });
});
