import http from 'k6/http';
import { check, sleep } from 'k6';
import encoding from 'k6/encoding';

const BASE_URL = 'http://localhost:8080';
const AUTH = `Basic ${encoding.b64encode('ansat:Ansat12345')}`;
const HEADERS = { Authorization: AUTH, 'Content-Type': 'application/json' };

export const options = {
  scenarios: {
    smoke: {
      executor: 'constant-vus',
      vus: 1,
      duration: '20s',
      tags: { scenario: 'smoke' },
    },
    normal: {
      executor: 'constant-vus',
      vus: 5,
      duration: '30s',
      startTime: '25s',
      tags: { scenario: 'normal' },
    },
    peak: {
      executor: 'constant-vus',
      vus: 20,
      duration: '30s',
      startTime: '60s',
      tags: { scenario: 'peak' },
    },
    spike: {
      executor: 'ramping-vus',
      startTime: '95s',
      stages: [
        { duration: '10s', target: 50 },
        { duration: '15s', target: 50 },
        { duration: '10s', target: 0 },
      ],
      tags: { scenario: 'spike' },
    },
  },
};

export default function () {
  const endpoints = [
    ['GET', `${BASE_URL}/api/v1/repos/search?limit=10`, null],
    ['GET', `${BASE_URL}/api/v1/repos/ansat/perf-test-repo/contents/`, null],
    ['GET', `${BASE_URL}/api/v1/users/search?q=ansat`, null],
  ];
  const [method, url, body] = endpoints[Math.floor(Math.random() * endpoints.length)];
  const res = http.request(method, url, body, { headers: HEADERS });
  check(res, { 'status < 400': (r) => r.status < 400 });
  sleep(0.5);
}
