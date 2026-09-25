import { describe, it, expect } from 'vitest';
import { EventSerializer } from '../public/serializer.js';
import { createEvent } from '../public/event.js';
import { EventSerializationError } from '../public/errors.js';

describe('EventSerializer', () => {
  it('serializes and deserializes valid events', () => {
    const event = createEvent({
      type: 'order.created',
      payload: { id: 101, total: 49.99, tags: ['promo', 'express'] },
      metadata: { source: 'web' },
      schemaVersion: 2,
    });

    const json = EventSerializer.serialize(event);
    expect(typeof json).toBe('string');

    const revived = EventSerializer.deserialize(json);
    expect(revived.type).toBe('order.created');
    expect(revived.eventId).toBe(event.eventId);
    expect(revived.timestamp).toBe(event.timestamp);
    expect(revived.schemaVersion).toBe(2);
    expect(revived.metadata?.source).toBe('web');
    expect(revived.payload).toEqual({ id: 101, total: 49.99, tags: ['promo', 'express'] });
  });

  it('rejects circular references during serialization', () => {
    const circularObj: Record<string, unknown> = {};
    circularObj.self = circularObj;

    const event = createEvent({
      type: 'bad.event',
      payload: circularObj,
    });

    expect(() => EventSerializer.serialize(event)).toThrow(EventSerializationError);
  });

  it('rejects functions and symbols in payloads', () => {
    const fnPayload = {
      action: () => console.log('not serializable'),
    };

    const event = createEvent({
      type: 'fn.event',
      payload: fnPayload,
    });

    expect(() => EventSerializer.serialize(event)).toThrow(EventSerializationError);
  });

  it('rejects invalid JSON during deserialization', () => {
    expect(() => EventSerializer.deserialize('invalid json string')).toThrow(
      EventSerializationError
    );
  });

  it('rejects malformed event structure missing required fields', () => {
    expect(() => EventSerializer.deserialize('{"foo": "bar"}')).toThrow(EventSerializationError);
  });
});
