import type { Metadata } from 'next';
import 'leaflet/dist/leaflet.css';
import './style.css';

export const metadata: Metadata = {
  title: 'Pune Civic Grievance & Complaint Public Map Dashboard',
  description: 'Public real-time map of Pune citizen civic complaints, evidence records, and authority routing',
};
export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
