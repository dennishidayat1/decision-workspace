import { developmentApiUrl } from './development-api-url';

describe('development API routing', () => {
  it('uses the host bridge for Android emulator live reload', () => {
    expect(developmentApiUrl(new URL('http://10.0.2.2:4200').hostname))
      .toBe('http://10.0.2.2:5207/api');
  });

  it('preserves desktop development and non-browser defaults', () => {
    for (const hostname of ['localhost', '127.0.0.1', undefined]) {
      expect(developmentApiUrl(hostname)).toBe('http://localhost:5207/api');
    }
  });
});
