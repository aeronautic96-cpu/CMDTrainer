// localStorage 래퍼: 사용할 수 없는 환경에서도 앱이 동작하도록 예외를 삼킨다.
const PREFIX = 'descent-trainer:';

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* 저장 실패는 무시 */
  }
}
