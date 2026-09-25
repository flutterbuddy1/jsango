import { describe, it, expect } from 'vitest';
import { HttpHeaders } from './public/headers.js';
import { JsangoError } from '@jsango/core';

describe('HttpHeaders', () => {
  it('should get, set and check headers case-insensitively', () => {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'X-Custom-Header': 'CustomValue',
    });

    expect(headers.get('content-type')).toBe('application/json');
    expect(headers.get('CONTENT-TYPE')).toBe('application/json');
    expect(headers.has('x-custom-header')).toBe(true);
    expect(headers.has('X-CUSTOM-HEADER')).toBe(true);
    expect(headers.has('non-existent')).toBe(false);
  });

  it('should support multiple values and append()', () => {
    const headers = new HttpHeaders();
    headers.append('Accept', 'application/json');
    headers.append('accept', 'text/plain');

    expect(headers.get('accept')).toBe('application/json, text/plain');
    expect(headers.getAll('accept')).toEqual(['application/json', 'text/plain']);
  });

  it('should replace value on set()', () => {
    const headers = new HttpHeaders();
    headers.append('Accept', 'application/json');
    headers.set('accept', 'text/html');

    expect(headers.get('accept')).toBe('text/html');
    expect(headers.getAll('accept')).toEqual(['text/html']);
  });

  it('should delete headers case-insensitively', () => {
    const headers = new HttpHeaders({ 'X-Remove': 'bye' });
    expect(headers.has('x-remove')).toBe(true);
    headers.delete('X-REMOVE');
    expect(headers.has('x-remove')).toBe(false);
    expect(headers.get('x-remove')).toBeNull();
  });

  it('should correctly iterate entries and convert to record', () => {
    const headers = new HttpHeaders({
      Host: 'localhost',
      'User-Agent': 'Vitest',
    });

    const record = headers.toRecord();
    expect(record).toEqual({
      host: 'localhost',
      'user-agent': 'Vitest',
    });

    const entries = Array.from(headers.entries());
    expect(entries).toEqual([
      ['host', 'localhost'],
      ['user-agent', 'Vitest'],
    ]);
  });

  it('should prevent CRLF header injection in header names', () => {
    const headers = new HttpHeaders();
    expect(() => {
      headers.set('Bad\r\nHeader', 'value');
    }).toThrow(JsangoError);
  });

  it('should prevent CRLF header injection in header values', () => {
    const headers = new HttpHeaders();
    expect(() => {
      headers.set('X-Test', 'Value\r\nInjected-Header: 123');
    }).toThrow(JsangoError);
  });
});
