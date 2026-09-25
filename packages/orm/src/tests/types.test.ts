import { describe, it, expect } from 'vitest';
import { defineModel } from '../public/model.js';
import { fields } from '../public/fields.js';

describe('TypeScript Type Inference', () => {
  it('should infer model attribute types correctly at compile time', async () => {
    const Person = defineModel({
      name: 'Person',
      table: 'persons',
      fields: {
        id: fields.integer({ primaryKey: true, autoIncrement: true }),
        name: fields.string(),
        email: fields.string({ nullable: true }),
        isActive: fields.boolean({ default: true }),
        score: fields.float({ default: 0 }),
      },
    });

    const person = new Person({
      name: 'Alice',
      email: null,
      isActive: true,
      score: 95.5,
    });

    // Compile-time type assertions
    const _name: string = person.name;
    const _email: string | null = person.email;
    const _isActive: boolean = person.isActive;
    const _score: number = person.score;

    expect(typeof _name).toBe('string');
    expect(_email).toBeNull();
    expect(typeof _isActive).toBe('boolean');
    expect(typeof _score).toBe('number');
  });
});
