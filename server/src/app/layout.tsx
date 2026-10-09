import type { Metadata } from 'next';
import './style.css';

export const metadata: Metadata = { title: 'Pune Fast Complaint', description: 'Pune civic complaints and evidence' };
export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
