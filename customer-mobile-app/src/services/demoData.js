export const demoRates = [
  {
    id: 'gold',
    metal: 'Gold 24K',
    purity: '999',
    ratePerGram: 12500,
    source: 'Illustrative demo data',
    lastUpdatedAt: null,
  },
  {
    id: 'silver',
    metal: 'Silver',
    purity: '99.9%',
    ratePerGram: 180,
    source: 'Illustrative demo data',
    lastUpdatedAt: null,
  },
  {
    id: 'platinum',
    metal: 'Platinum',
    purity: '95%',
    ratePerGram: 4200,
    source: 'Illustrative demo data',
    lastUpdatedAt: null,
  },
];

export const demoPortfolio = {
  goldGrams: 0,
  silverGrams: 0,
  platinumGrams: 0,
  totalInvested: 0,
  currentValue: 0,
};

export const demoNotifications = [];

export const demoProfile = (mobileNumber) => ({
  name: 'Demo customer',
  mobileNumber,
});
