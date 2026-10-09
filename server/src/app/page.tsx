/* eslint-disable @next/next/no-html-link-for-pages -- These links open JSON API responses, not React pages. */
export default function Home() {
  return <main><span className="label">PUNE FAST COMPLAINT</span><h1>Your local backend is running.</h1><p>The Expo app prepares notices for trees, roads, garbage and noise, saves evidence, and supports selected physical-repair follow-ups.</p><p>Complaint records, photos and audio are saved on this laptop.</p><nav><a href="/health">Check server health</a><a href="/api/v1/complaints">View complaint records</a></nav></main>;
}
