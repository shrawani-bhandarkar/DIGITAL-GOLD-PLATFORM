import { Activity, BadgeCheck, Banknote, Coins, Gem, Users, WalletCards } from 'lucide-react';

export const dashboardStats = [
  { label: 'Registered customers', value: '12,846', change: '8.2%', trend: 'up', detail: 'vs. last month', icon: Users, tone: 'teal' },
  { label: 'Verified customers', value: '10,284', change: '6.4%', trend: 'up', detail: 'of total customers', icon: BadgeCheck, tone: 'blue' },
  { label: 'Buy / sell volume', value: '₹26.28L', change: '12.8%', trend: 'up', detail: 'this month · sample', icon: Coins, tone: 'violet' },
  { label: 'Gross transaction value', value: '₹1.84Cr', change: '4.6%', trend: 'up', detail: 'vs. last month', icon: Banknote, tone: 'amber' },
  { label: 'Pending payments', value: '18', change: '3.1%', trend: 'down', changeTone: 'positive', detail: 'awaiting confirmation', icon: WalletCards, tone: 'red' },
  { label: 'Failed orders', value: '7', change: '2.4%', trend: 'down', changeTone: 'positive', detail: 'in the last 24 hours', icon: Activity, tone: 'slate' },
  { label: 'Pending redemptions', value: '23', change: '5.2%', trend: 'down', changeTone: 'positive', detail: 'awaiting review', icon: Gem, tone: 'teal' },
  { label: 'Active SIPs', value: '3,492', change: '9.7%', trend: 'up', detail: 'recurring instructions', icon: Coins, tone: 'blue' },
];

export const metalRates = [
  { key: 'gold', name: 'Gold', purity: '24K · 999 purity', buy: 7248.5, sell: 7112.25, change: '+0.84%', updated: '10:42 AM' },
  { key: 'silver', name: 'Silver', purity: '999 purity', buy: 92.65, sell: 89.8, change: '+1.12%', updated: '10:42 AM' },
  { key: 'platinum', name: 'Platinum', purity: '950 purity', buy: 3120, sell: 2990, change: 'Sample rate', updated: '10:42 AM' },
];

export const monthlyVolume = [
  { date: '16 Sep', buy: 34, sell: 18 }, { date: '19 Sep', buy: 42, sell: 22 },
  { date: '22 Sep', buy: 38, sell: 25 }, { date: '25 Sep', buy: 55, sell: 31 },
  { date: '28 Sep', buy: 46, sell: 27 }, { date: '01 Oct', buy: 61, sell: 36 },
  { date: '04 Oct', buy: 52, sell: 30 }, { date: '07 Oct', buy: 72, sell: 42 },
  { date: '10 Oct', buy: 64, sell: 38 }, { date: '13 Oct', buy: 84, sell: 49 },
  { date: '15 Oct', buy: 78, sell: 45 },
];

export const recentTransactions = [
  { id: 'TXN-84291', customer: 'Ananya Sharma', initials: 'AS', email: 'ananya.s@email.com', date: '15 Oct, 10:38 AM', type: 'Buy', metal: 'Gold', amount: 14497, status: 'Completed' },
  { id: 'TXN-84290', customer: 'Rohan Mehta', initials: 'RM', email: 'rohan.m@email.com', date: '15 Oct, 10:24 AM', type: 'Sell', metal: 'Silver', amount: 4633, status: 'Processing' },
  { id: 'TXN-84289', customer: 'Priya Nair', initials: 'PN', email: 'priya.n@email.com', date: '15 Oct, 09:56 AM', type: 'Buy', metal: 'Gold', amount: 7249, status: 'Completed' },
  { id: 'TXN-84288', customer: 'Vikram Desai', initials: 'VD', email: 'vikram.d@email.com', date: '15 Oct, 09:41 AM', type: 'Buy', metal: 'Silver', amount: 9265, status: 'Pending' },
  { id: 'TXN-84287', customer: 'Meera Iyer', initials: 'MI', email: 'meera.i@email.com', date: '15 Oct, 09:17 AM', type: 'Sell', metal: 'Gold', amount: 21337, status: 'Failed' },
];

export const activityItems = [
  { id: 1, initials: 'RK', actor: 'Rahul K.', action: 'reviewed verification for', target: 'Customer #CUS-2041', time: '10:36 AM · Customer verification', tone: 'teal' },
  { id: 2, initials: 'SY', actor: 'System', action: 'flagged a payment exception on', target: 'Order #ORD-83902', time: '10:18 AM · Payment monitoring', tone: 'violet' },
  { id: 3, initials: 'AM', actor: 'Anita M.', action: 'submitted a rate change for', target: '24K Gold', time: '09:52 AM · Rate management', tone: 'blue' },
  { id: 4, initials: 'SY', actor: 'System', action: 'sent an installment reminder for', target: 'SIP #SIP-12085', time: '09:30 AM · SIP operations', tone: 'amber' },
];
