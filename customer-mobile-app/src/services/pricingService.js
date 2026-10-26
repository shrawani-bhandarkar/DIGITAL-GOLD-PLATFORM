import { demoRates } from './demoData';

export const demoPricingConfig = {
  gold: {
    buy: { chargesConfigured: false, taxConfigured: false },
    sell: {
      makingCharge: {
        configured: true,
        type: 'fixed-per-transaction',
        value: 250,
        label: '₹250 demo charge per transaction',
      },
      tax: { configured: true, treatment: 'split', cgstRate: 1.5, sgstRate: 1.5 },
    },
    redemption: { chargesConfigured: false, taxConfigured: false },
    sip: { chargesConfigured: false, taxConfigured: false },
  },
  silver: {
    buy: { chargesConfigured: false, taxConfigured: false },
    sell: {
      makingCharge: { configured: false, type: null, value: null, label: 'Making charges not configured' },
      tax: { configured: true, treatment: 'split', cgstRate: 1.5, sgstRate: 1.5 },
    },
    redemption: { chargesConfigured: false, taxConfigured: false },
    sip: { chargesConfigured: false, taxConfigured: false },
  },
  platinum: {
    buy: { chargesConfigured: false, taxConfigured: false },
    sell: {
      makingCharge: { configured: false, type: null, value: null, label: 'Making charges not configured' },
      tax: { configured: true, treatment: 'split', cgstRate: 1.5, sgstRate: 1.5 },
    },
    redemption: { chargesConfigured: false, taxConfigured: false },
    sip: { chargesConfigured: false, taxConfigured: false },
  },
};

export const pricingLimits = {
  maxAmountINR: 10000000,
  maxQuantityGrams: 10000,
};

const roundCurrency = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

export function getMetalConfig(metalId) {
  const rate = demoRates.find((item) => item.id === metalId);
  if (!rate) throw new Error(`No demo rate is configured for metal "${metalId}".`);
  const pricing = demoPricingConfig[metalId];
  if (!pricing) throw new Error(`No demo pricing rules are configured for metal "${metalId}".`);
  return { ...rate, ...pricing };
}

function calculateMakingCharge(rule, metalValue, quantityGrams) {
  if (!rule.configured) return null;
  if (!Number.isFinite(rule.value) || rule.value < 0) {
    throw new Error('The configured demo making-charge rule is invalid.');
  }
  if (rule.type === 'fixed-per-transaction') return roundCurrency(rule.value);
  if (rule.type === 'percentage') return roundCurrency(metalValue * rule.value / 100);
  if (rule.type === 'fixed-per-gram') return roundCurrency(quantityGrams * rule.value);
  throw new Error('The configured demo making-charge type is not supported.');
}

function calculateTax(tax, taxableAmount) {
  if (!tax.configured) {
    return { gst: null, cgst: null, sgst: null, igst: null, taxTreatment: null };
  }
  let gst;
  let cgst = null;
  let sgst = null;
  let igst = null;
  if (tax.treatment === 'split') {
    const taxRate = tax.cgstRate + tax.sgstRate;
    gst = roundCurrency(taxableAmount * taxRate / 100);
    cgst = roundCurrency(taxableAmount * tax.cgstRate / 100);
    sgst = roundCurrency(gst - cgst);
  } else if (tax.treatment === 'igst') {
    gst = roundCurrency(taxableAmount * tax.igstRate / 100);
    igst = gst;
  } else {
    throw new Error('The configured demo tax treatment is not supported.');
  }
  return { gst, cgst, sgst, igst, taxTreatment: tax.treatment };
}

export function calculateBuyEstimate({ metalId, mode, value, ratePerGram }) {
  const config = getMetalConfig(metalId);
  const rate = ratePerGram ?? config.ratePerGram;
  const enteredValue = Number(value);
  if (!Number.isFinite(enteredValue) || enteredValue <= 0) {
    throw new Error('Enter an amount or quantity greater than zero.');
  }
  if (mode === 'amount' && enteredValue > pricingLimits.maxAmountINR) {
    throw new Error(`The demo amount cannot exceed ${formatINR(pricingLimits.maxAmountINR)}.`);
  }
  if (mode === 'grams' && enteredValue > pricingLimits.maxQuantityGrams) {
    throw new Error(`The demo quantity cannot exceed ${pricingLimits.maxQuantityGrams.toLocaleString('en-IN')} g.`);
  }
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error('A positive rate is not available for this demo metal.');
  }
  if (mode !== 'amount' && mode !== 'grams') {
    throw new Error('Choose whether to buy by amount or grams.');
  }

  const quantityGrams = mode === 'grams' ? enteredValue : enteredValue / rate;
  if (!Number.isFinite(quantityGrams) || quantityGrams <= 0) {
    throw new Error('The estimate is too small to represent a positive metal quantity.');
  }
  const normalizedQuantity = Math.round(quantityGrams * 1e6) / 1e6;
  if (normalizedQuantity <= 0) {
    throw new Error('The estimate is too small to represent a positive metal quantity.');
  }
  const metalValue = mode === 'amount' && metalId !== 'gold'
    ? roundCurrency(enteredValue)
    : roundCurrency(normalizedQuantity * rate);

  return {
    metalId,
    mode,
    enteredValue,
    quantityGrams: normalizedQuantity,
    ratePerGram: rate,
    metalValue,
    totalEstimate: metalValue,
    source: config.source,
  };
}

export function calculatePurchaseEstimate(input) {
  return calculateBuyEstimate(input);
}

export function calculateSellEstimate({ metalId, quantityGrams, ratePerGram }) {
  const config = getMetalConfig(metalId);
  const quantity = Number(quantityGrams);
  const rate = ratePerGram ?? config.ratePerGram;
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error('Enter a sell quantity greater than zero.');
  }
  if (quantity > pricingLimits.maxQuantityGrams) {
    throw new Error(`The demo quantity cannot exceed ${pricingLimits.maxQuantityGrams.toLocaleString('en-IN')} g.`);
  }
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error('A positive sell rate is not available for this demo metal.');
  }

  const quantityRounded = Math.round(quantity * 1e6) / 1e6;
  if (quantityRounded <= 0) {
    throw new Error('The sell quantity is too small to represent a positive metal quantity.');
  }
  const metalValue = roundCurrency(quantityRounded * rate);
  const sellConfig = config.sell;
  const makingCharge = calculateMakingCharge(sellConfig.makingCharge, metalValue, quantityRounded);
  const taxableAmount = roundCurrency(metalValue + (makingCharge || 0));
  const taxBreakdown = calculateTax(sellConfig.tax, taxableAmount);
  const totalEstimate = roundCurrency(taxableAmount + (taxBreakdown.gst || 0));

  return {
    metalId,
    quantityGrams: quantityRounded,
    ratePerGram: rate,
    metalValue,
    makingCharge,
    makingChargeConfigured: sellConfig.makingCharge.configured,
    makingRule: sellConfig.makingCharge,
    taxableAmount,
    ...taxBreakdown,
    taxRate: sellConfig.tax.configured
      ? sellConfig.tax.treatment === 'split'
        ? sellConfig.tax.cgstRate + sellConfig.tax.sgstRate
        : sellConfig.tax.igstRate
      : null,
    taxesConfigured: sellConfig.tax.configured,
    totalEstimate,
    includesUnconfiguredMakingCharge: !sellConfig.makingCharge.configured,
    includesUnconfiguredTax: !sellConfig.tax.configured,
    source: config.source,
  };
}

export function formatINR(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
