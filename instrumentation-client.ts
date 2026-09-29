import mixpanel from "mixpanel-browser";

const token = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;

if (token && process.env.NODE_ENV === "production") {
  mixpanel.init(token, {
    track_pageview: true,
    autocapture: true,
  });
}
