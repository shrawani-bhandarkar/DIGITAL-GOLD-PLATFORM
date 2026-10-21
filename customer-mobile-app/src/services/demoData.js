export const demoRates = [
  { metal: 'Gold 24K', purity: '99.9%', ratePerGram: 12500, demoChange: '+0.4%', symbol: 'Au' },
  { metal: 'Silver', purity: '99.9%', ratePerGram: 180, demoChange: '+0.2%', symbol: 'Ag' },
];

export const demoPortfolio = {
  goldGrams: 0,
  silverGrams: 0,
  totalInvested: 0,
  currentValue: 0,
};

export const demoNotifications = [];

export const demoProfile = (mobileNumber) => ({
  name: 'Demo customer',
  mobileNumber,
});
