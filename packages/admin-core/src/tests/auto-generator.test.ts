import { describe, it, expect } from 'vitest';
import { ModelMetadata, fields } from '@jsango/orm';
import { AutoResourceGenerator } from '../public/auto-generator.js';

describe('AutoResourceGenerator', () => {
  it('automatically derives resource fields, labels, search fields, and masks sensitive fields', () => {
    const metadata = new ModelMetadata({
      name: 'User',
      table: 'users',
      fields: {
        id: fields.integer({ primaryKey: true, autoIncrement: true }),
        email: fields.string({ unique: true }),
        name: fields.string(),
        passwordHash: fields.string(),
        apiKey: fields.string({ nullable: true }),
        bio: fields.text({ nullable: true }),
        isActive: fields.boolean({ default: true }),
      },
      timestamps: true,
      softDelete: true,
    });

    const resource = AutoResourceGenerator.generateFromModel(metadata);

    expect(resource.id).toBe('user');
    expect(resource.label).toBe('User');
    expect(resource.canSoftDelete).toBe(true);

    const emailField = resource.getField('email');
    expect(emailField?.type).toBe('email');
    expect(emailField?.searchable).toBe(true);

    const passwordField = resource.getField('passwordHash');
    expect(passwordField?.sensitive).toBe(true);
    expect(passwordField?.hidden).toBe(true);

    const apiKeyField = resource.getField('apiKey');
    expect(apiKeyField?.sensitive).toBe(true);
    expect(apiKeyField?.hidden).toBe(true);

    // List fields should omit sensitive fields by default
    expect(resource.listFields).not.toContain('passwordHash');
    expect(resource.listFields).not.toContain('apiKey');
  });
});
