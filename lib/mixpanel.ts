import mixpanel from "mixpanel-browser";

const TOKEN = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN!;

let initialized = false;

export function initMixpanel() {
  // 서버 사이드에서 실행되면 window가 없으니까 브라우저 환경 체크
  if (typeof window === "undefined") return;
  if (initialized) return;

  mixpanel.init(TOKEN, {
    track_pageview: false, // 우리가 직접 찍을 거라서 자동 트래킹 끔
    persistence: "localStorage",
  });

  initialized = true;
}

export function trackEvent(
  event: string,
  properties?: Record<string, unknown>,
) {
  if (typeof window === "undefined") return;
  mixpanel.track(event, properties);
}
