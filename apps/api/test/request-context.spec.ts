import type { Request } from 'express';
import { buildRequestContext } from '../src/common/request-context';

function req(headers: Record<string, string>, id?: string): Request {
  return { headers, id } as unknown as Request;
}

describe('buildRequestContext (docs/D3 §2 headers)', () => {
  it('parses all standard headers', () => {
    const ctx = buildRequestContext(
      req({
        'x-request-id': 'abc-123',
        'x-client': 'rider-android',
        'x-app-version': '1.4.0',
        'x-device-id': 'dev-1',
        'x-region': 'in-chn',
        'x-lat': '13.0827',
        'x-lng': '80.2707',
        'accept-language': 'ta-IN,en;q=0.8',
      }),
    );
    expect(ctx).toEqual({
      requestId: 'abc-123',
      client: 'rider-android',
      appVersion: '1.4.0',
      deviceId: 'dev-1',
      regionCode: 'IN-CHN',
      lat: 13.0827,
      lng: 80.2707,
      locale: 'ta',
    });
  });

  it('drops invalid values instead of trusting them', () => {
    const ctx = buildRequestContext(
      req(
        {
          'x-client': 'hacker-app',
          'x-region': 'chennai!!',
          'x-lat': '123',
          'x-lng': 'abc',
          'x-request-id': 'bad id with spaces',
        },
        'pino-id',
      ),
    );
    expect(ctx.client).toBeNull();
    expect(ctx.regionCode).toBeNull();
    expect(ctx.lat).toBeNull();
    expect(ctx.lng).toBeNull();
    expect(ctx.requestId).toBe('pino-id');
    expect(ctx.locale).toBe('en');
  });

  it('generates a request id when none is given', () => {
    const ctx = buildRequestContext(req({}));
    expect(ctx.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });
});
