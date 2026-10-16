import { ShieldCheck } from 'lucide-react';

export default function SimulatedBanner({ children = 'All operations shown are simulated. No payments, metal transfers, deliveries, or customer notifications are executed.' }) {
  return <div className="simulated-banner"><ShieldCheck size={15} /><strong>SIMULATED OPERATIONS</strong><span>{children}</span></div>;
}
