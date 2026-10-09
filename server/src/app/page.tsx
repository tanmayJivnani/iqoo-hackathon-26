/* eslint-disable @next/next/no-html-link-for-pages -- These links open JSON API responses, not React pages. */
export default function Home() {
  return <main><span className="label">PUNE TREE RAKSHAK</span><h1>Your local backend is running.</h1><p>The Expo app can use this server to prepare tree complaints, save evidence, and follow up on reports.</p><p>Complaint records and photos are saved on this laptop.</p><nav><a href="/health">Check server health</a><a href="/api/v1/complaints">View complaint records</a></nav></main>;
}
