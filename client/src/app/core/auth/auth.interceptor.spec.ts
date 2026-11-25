import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

describe('API bearer scope', () => {
  it('only sends the session token to the configured API path and origin', () => {
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting(),
      { provide: AuthService, useValue: { accessToken: 'test-token' } },
    ] });
    const client = TestBed.inject(HttpClient);
    const http = TestBed.inject(HttpTestingController);
    const api = new URL(environment.apiUrl);
    for (const url of [environment.apiUrl + '/decisions', api.origin + '/outside',
      'https://external.example/api/decisions', api.origin + api.pathname + '-other']) {
      client.get(url).subscribe();
      const req = http.expectOne(url);
      expect(req.request.headers.get('Authorization')).toBe(url === environment.apiUrl + '/decisions' ? 'Bearer test-token' : null);
      req.flush({});
    }
    http.verify();
  });
});
