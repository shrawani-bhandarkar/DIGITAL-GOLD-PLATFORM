import { apiRoutes } from '../config/apiRoutes';
import { apiRequest } from './apiClient';

export const fetchProfile = () => apiRequest(apiRoutes.profile, { cache: 'no-store' });
export const fetchRates = () => apiRequest(apiRoutes.rates);
export const fetchPortfolio = () => apiRequest(apiRoutes.portfolio);
export const fetchTransactions = (query) => apiRequest(apiRoutes.transactions, { query });
export const fetchTransaction = (transactionId) =>
  apiRequest({
    method: apiRoutes.transactionDetail.method,
    path: apiRoutes.transactionDetail.path.replace('{transactionId}', encodeURIComponent(transactionId)),
  });
export const fetchNotifications = (query) => apiRequest(apiRoutes.notifications, { query });

export const createPurchaseQuote = (input) =>
  apiRequest(apiRoutes.purchaseQuote, { body: input, cache: 'no-store' });
export const submitConfirmedPurchase = (input, idempotencyKey) =>
  apiRequest(apiRoutes.purchaseSubmit, { body: input, idempotencyKey });
export const createSellQuote = (input) =>
  apiRequest(apiRoutes.sellQuote, { body: input });
export const submitConfirmedSale = (input, idempotencyKey) =>
  apiRequest(apiRoutes.sellSubmit, { body: input, idempotencyKey });
export const createRedemptionQuote = (input) =>
  apiRequest(apiRoutes.redemptionQuote, { body: input });
export const submitConfirmedRedemption = (input, idempotencyKey) =>
  apiRequest(apiRoutes.redemptionSubmit, { body: input, idempotencyKey });
export const fetchSips = (query) => apiRequest(apiRoutes.sips, { query });
export const createSip = (input, idempotencyKey) =>
  apiRequest(apiRoutes.sipCreate, { body: input, idempotencyKey });
export const cancelSip = (sipId, idempotencyKey) =>
  apiRequest({
    method: apiRoutes.sipCancel.method,
    path: apiRoutes.sipCancel.path.replace('{sipId}', encodeURIComponent(sipId)),
  }, { idempotencyKey });
export const createGiftQuote = (input) =>
  apiRequest(apiRoutes.giftQuote, { body: input });
export const submitConfirmedGift = (input, idempotencyKey) =>
  apiRequest(apiRoutes.giftSubmit, { body: input, idempotencyKey });
