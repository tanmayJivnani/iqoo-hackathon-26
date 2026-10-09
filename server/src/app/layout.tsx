import type { Metadata } from 'next';
import './style.css';

export const metadata: Metadata = { title: 'Pune Tree Rakshak', description: 'Pune citizen tree complaints' };
export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
