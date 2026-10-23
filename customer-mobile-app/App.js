import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { apiConfig } from './src/config/apiConfig';
import { Button, Brand, Card, ChoiceRow, DigiGoldHeader, DemoBadge, EmptyState, ErrorState, Field, LoadingState, Notice, SectionTitle, StatusBadge } from './src/components/UI';
import { demoNotifications, demoPortfolio, demoProfile, demoRates } from './src/services/demoData';
import { logout, requestOtp, verifyOtp } from './src/services/authService';
import { setUnauthorizedHandler } from './src/services/apiClient';
import { fetchPortfolio, fetchRates, fetchTransactions } from './src/services/customerServices';
import {
  calculateBuyEstimate,
  calculateSellEstimate,
  formatINR,
  getMetalConfig,
  pricingLimits,
} from './src/services/pricingService';
import { colors } from './src/theme';

const tabs = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'savings', label: 'Savings', icon: 'account-balance-wallet' },
  { id: 'activity', label: 'Activity', icon: 'history' },
  { id: 'account', label: 'Account', icon: 'person' },
];

const actions = [
  { id: 'buy', title: 'Buy', detail: 'Buy gold, silver or platinum', icon: 'shopping-bag' },
  { id: 'sell', title: 'Sell', detail: 'Sell your eligible metal holdings', icon: 'account-balance-wallet' },
  { id: 'redeem', title: 'Redeem', detail: 'Redeem eligible metals', icon: 'redeem' },
  { id: 'sip', title: 'Start SIP', detail: 'Plan regular investments in precious metals', icon: 'event-repeat' },
  { id: 'gift', title: 'Gift Gold', detail: 'Send eligible precious metals to your loved ones', icon: 'card-giftcard' },
  { id: 'portfolio', title: 'My Saving', detail: 'View your holdings and portfolio value', icon: 'savings' },
];

const actionColors = {
  buy: { background: '#FFF3CC', iconInk: '#D4A017' },
  sell: { background: '#E5F7ED', iconInk: '#159957' },
  redeem: { background: '#F0EAFE', iconInk: '#805AD5' },
  sip: { background: '#E6F1FF', iconInk: '#2878D0' },
  gift: { background: '#FCE7F3', iconInk: '#D9468F' },
  portfolio: { background: '#DDF7F3', iconInk: '#0F9D91' },
};

const transactionTypes = [
  { label: 'All', value: 'all' },
  { label: 'Buy', value: 'buy' },
  { label: 'Sell', value: 'sell' },
  { label: 'SIP', value: 'sip' },
  { label: 'Gift', value: 'gift' },
  { label: 'Redeem', value: 'redeem' },
];

const transactionPresentation = {
  buy: { title: 'Buy', icon: '+', color: colors.successBackground, ink: colors.success },
  sell: { title: 'Sell', icon: '↗', color: colors.lightMint, ink: colors.primaryDark },
  redeem: { title: 'Redeem', icon: '◇', color: colors.goldLight, ink: colors.goldDark },
  sip: { title: 'Monthly SIP', icon: '↻', color: colors.lightMint, ink: colors.primary },
  gift: { title: 'Gift', icon: '✧', color: colors.goldLight, ink: colors.goldDark },
};

let demoTransactionSequence = 0;

function BottomNavigation({ selected, onSelect }) {
  return (
    <View style={styles.bottomNav}>
      {tabs.map((tab) => {
        const active = selected === tab.id;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open ${tab.label}`}
            accessibilityState={{ selected: active }}
            key={tab.id}
            onPress={() => onSelect(tab.id)}
            style={({ pressed }) => [
              styles.navItem,
              active && styles.navItemActive,
              pressed && styles.navItemPressed,
            ]}
          >
            <MaterialIcons
              name={tab.icon}
              size={21}
              color={active ? colors.primary : colors.muted}
              style={styles.navIcon}
            />
            <Text style={[styles.navLabel, active && styles.navLabelActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function LoginScreen({ mobile, setMobile, error, busy, onContinue }) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.authScroll} keyboardShouldPersistTaps="handled">
          <Brand />
          <View style={styles.authIntro}>
            <Text style={styles.eyebrow}>A BRIGHTER WAY TO SAVE</Text>
            <Text style={styles.authTitle}>Welcome to DigiGold</Text>
            <Text style={styles.muted}>Sign in with your mobile number to explore your gold savings.</Text>
          </View>
          <Card style={styles.authCard}>
            <Text style={styles.formLabel}>Mobile number</Text>
            <View style={[styles.phoneInput, error && styles.phoneInputError]}>
              <Text style={styles.prefixText}>+91</Text>
              <View style={styles.prefixDivider} />
              <TextInput
                accessibilityLabel="10-digit Indian mobile number"
                accessibilityHint="Enter a valid Indian mobile number"
                autoComplete="tel-national"
                autoCorrect={false}
                keyboardType="number-pad"
                maxLength={10}
                onChangeText={(value) => setMobile(value.replace(/\D/g, '').slice(0, 10))}
                placeholder="10-digit mobile number"
                placeholderTextColor={colors.muted}
                returnKeyType="done"
                style={styles.mobileInput}
                value={mobile}
              />
            </View>
            {error ? <Text style={styles.formError}>{error}</Text> : null}
            <Button
              title="Continue"
              onPress={onContinue}
              loading={busy}
              disabled={busy}
              state={error ? 'error' : 'idle'}
            />
            <Text style={styles.centerHelper}>We’ll guide you through verification.</Text>
          </Card>
          <Notice type="warning" style={styles.authNotice}>
            DEMO AUTHENTICATION · No SMS is sent. This local demo is not secure account authentication.
          </Notice>
          <Text style={styles.authDisclaimer}>
            No real account, payment, investment, or transaction is created in this demonstration.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function OtpScreen({ mobile, otp, setOtp, error, busy, seconds, onVerify, onResend, onBack }) {
  const masked = mobile.replace(/^(\d{2})\d{5}(\d{3})$/, '$1•••••$2');
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.authScroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity accessibilityRole="button" onPress={onBack} style={styles.backLink}>
            <Text style={styles.backLinkText}>‹  Edit mobile number</Text>
          </TouchableOpacity>
          <Brand />
          <View style={styles.authIntro}>
            <Text style={styles.eyebrow}>DEMO VERIFICATION</Text>
            <Text style={styles.authTitle}>Enter your code</Text>
            <Text style={styles.muted}>Enter the six-digit code for +91 {masked}.</Text>
          </View>
          <Card style={styles.authCard}>
            <Field
              label="Six-digit one-time code"
              value={otp}
              onChangeText={(value) => setOtp(value.replace(/\D/g, '').slice(0, 6))}
              placeholder="Enter code"
              keyboardType="number-pad"
              maxLength={6}
              error={error}
              textContentType="oneTimeCode"
            />
            <Button
              title="Verify code"
              onPress={onVerify}
              loading={busy}
              disabled={busy}
              state={error ? 'error' : 'idle'}
            />
            <View style={styles.resendRow}>
              <Text style={styles.smallMuted}>Didn’t receive a code? </Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityState={{ disabled: seconds > 0 || busy }}
                disabled={seconds > 0 || busy}
                onPress={onResend}
              >
                <Text style={[styles.resendText, (seconds > 0 || busy) && styles.disabledText]}>
                  {seconds > 0 ? `Resend in ${seconds}s` : 'Resend code'}
                </Text>
              </TouchableOpacity>
            </View>
          </Card>
          {apiConfig.mode === 'demo' ? (
            <Notice type="warning" style={styles.authNotice}>
              DEMO OTP: 123456 · No SMS was sent. Do not use this code to access a real account.
            </Notice>
          ) : (
            <Notice style={styles.authNotice}>OTP delivery depends on the configured backend service.</Notice>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function calculatePortfolioValue(portfolio, rates = demoRates) {
  if (!portfolio) return null;
  let total = 0;
  for (const configuredRate of demoRates) {
    const grams = portfolio[`${configuredRate.id}Grams`];
    if (!Number.isFinite(grams) || grams < 0) return null;
    if (grams === 0) continue;
    const rate = rates.find((item) => item.id === configuredRate.id);
    if (!rate || !Number.isFinite(rate.ratePerGram) || rate.ratePerGram <= 0) {
      return null;
    }
    total += grams * rate.ratePerGram;
  }
  return Number.isFinite(total) ? total : null;
}

function getResponseCollection(payload, keys, label) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  for (const key of keys) {
    if (payload && Array.isArray(payload[key])) return payload[key];
    if (payload?.data && Array.isArray(payload.data[key])) return payload.data[key];
  }
  throw new Error(`The service returned an unsupported ${label} response.`);
}

function normalizeBackendRate(rate) {
  if (!rate || typeof rate !== 'object') return null;
  const rawMetal = String(rate.metalId || rate.id || rate.metal || rate.name || '').toLowerCase();
  const id = ['gold', 'silver', 'platinum'].find((metal) => rawMetal.includes(metal));
  if (!id) return null;
  const configuredMetal = demoRates.find((item) => item.id === id);
  const rawRate = rate.ratePerGram ?? rate.rate_per_gram;
  const ratePerGram = Number(rawRate);
  return {
    id,
    metal: configuredMetal.metal,
    purity: typeof rate.purity === 'string' || typeof rate.purity === 'number' ? String(rate.purity) : '',
    ratePerGram: Number.isFinite(ratePerGram) && ratePerGram > 0 ? ratePerGram : null,
    source: 'Backend',
  };
}

function normalizeBackendActivity(item, index) {
  if (!item || typeof item !== 'object') {
    throw new Error('The service returned an invalid transaction record.');
  }
  const rawType = String(item.type || item.transactionType || item.action || item.eventType || '').toLowerCase();
  const type = rawType.includes('buy') || rawType.includes('purchase')
    ? 'buy'
    : rawType.includes('sell') || rawType.includes('sale')
      ? 'sell'
      : rawType.includes('redeem')
        ? 'redeem'
        : rawType.includes('sip')
          ? 'sip'
          : rawType.includes('gift')
            ? 'gift'
            : 'other';
  const rawMetal = String(item.metalId || item.metal || item.asset || '').toLowerCase();
  const metalId = ['gold', 'silver', 'platinum'].find((metal) => rawMetal.includes(metal)) || '';
  const configuredMetal = demoRates.find((rate) => rate.id === metalId);
  const rawAmount = item.amount ?? item.totalAmount ?? item.amountInr;
  const amount = rawAmount === undefined || rawAmount === null || rawAmount === ''
    ? null
    : Number(rawAmount);
  const rawQuantity = item.quantityGrams ?? item.quantity ?? item.grams;
  const quantity = rawQuantity === undefined || rawQuantity === null || rawQuantity === ''
    ? null
    : Number(rawQuantity);
  const createdAt = item.createdAt || item.transactionDate || item.created_at || item.timestamp || null;
  const presentation = transactionPresentation[type] || { title: 'Activity' };
  const itemTitle = typeof item.title === 'string' && item.title.trim()
    ? item.title
    : type === 'other' && rawType
      ? rawType.replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
      : `${presentation.title}${configuredMetal ? ` ${configuredMetal.metal}` : ''}`;
  const normalizedDate = typeof createdAt === 'number' && Number.isFinite(createdAt)
    ? new Date(createdAt).toISOString()
    : typeof createdAt === 'string'
      ? createdAt
      : null;

  return {
    ...item,
    id: String(item.id || item.transactionId || item.referenceId || `activity-${index}`),
    type,
    title: itemTitle,
    metal: metalId,
    metalName: configuredMetal?.metal || (typeof item.metal === 'string' ? item.metal : ''),
    amount: Number.isFinite(amount) && amount >= 0 ? amount : null,
    quantity: Number.isFinite(quantity) && quantity >= 0 ? quantity : null,
    createdAt: normalizedDate,
    status: typeof item.status === 'string' && item.status.trim() ? item.status : 'Status unavailable',
  };
}

function normalizeBackendPortfolio(payload) {
  const raw = payload?.portfolio || payload?.data?.portfolio || payload?.data || payload;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('The service returned an unsupported portfolio response.');
  }
  const holdings = raw.holdings || raw.items;
  if (Array.isArray(holdings)) {
    const result = { ...raw };
    for (const { id } of demoRates) {
      const holding = holdings.find((item) => {
        const metal = String(item.metalId || item.metal || item.asset || '').toLowerCase();
        return metal.includes(id);
      });
      const quantity = holding?.quantityGrams ?? holding?.quantity ?? holding?.grams;
      result[`${id}Grams`] = quantity === undefined ? 0 : Number(quantity);
    }
    return result;
  }
  const configuredFields = demoRates
    .map(({ id }) => [`${id}Grams`, `${id}QuantityGrams`, `${id}_grams`])
    .flat();
  const hasConfiguredHolding = configuredFields.some((key) => Object.prototype.hasOwnProperty.call(raw, key));
  if (!hasConfiguredHolding) throw new Error('The service returned an unsupported portfolio response.');
  const result = { ...raw };
  for (const { id } of demoRates) {
    const value = raw[`${id}Grams`] ?? raw[`${id}QuantityGrams`] ?? raw[`${id}_grams`];
    if (value !== undefined) result[`${id}Grams`] = Number(value);
  }
  return result;
}

function sortActivitiesByDate(items) {
  return items
    .map((item, index) => ({ item, index, time: Date.parse(item.createdAt || '') }))
    .sort((left, right) => {
      const leftValid = Number.isFinite(left.time);
      const rightValid = Number.isFinite(right.time);
      if (leftValid && rightValid) return right.time - left.time || left.index - right.index;
      if (leftValid) return -1;
      if (rightValid) return 1;
      return left.index - right.index;
    })
    .map(({ item }) => item);
}

function ExploreActionCard({ action, onPress, unavailable, disabled = false, width }) {
  const tone = actionColors[action.id];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${action.title}: ${disabled ? 'unavailable until customer transactions are connected' : unavailable ? 'no demo holdings available; tap to view details' : action.detail}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionCard,
        { width },
        disabled && styles.actionCardDisabled,
        pressed && styles.actionCardPressed,
      ]}
    >
      <View style={[styles.actionArt, { backgroundColor: tone.background }]}>
        <MaterialIcons
          name={action.icon}
          size={23}
          color={tone.iconInk}
        />
      </View>
      <Text style={styles.actionTitle} numberOfLines={1}>
        {action.title}
      </Text>
      <View style={styles.actionCardFooter}>
        <View style={styles.actionCardCopy}>
          <Text style={styles.actionDetail} numberOfLines={2}>
            {disabled ? 'Unavailable in backend mode' : unavailable ? 'No demo holdings yet · tap for details' : action.detail}
          </Text>
        </View>
        <View style={styles.actionArrow}>
          <Text style={styles.actionArrowText}>›</Text>
        </View>
      </View>
    </Pressable>
  );
}

function PortfolioCard({ value, loading = false, empty = false }) {
  return (
    <View style={styles.portfolioCard}>
      <View style={styles.portfolioAccent} />
      <Text style={styles.portfolioEyebrow}>TOTAL PORTFOLIO VALUE</Text>
      {apiConfig.mode === 'demo' ? <DemoBadge label="DEMO ESTIMATE" /> : null}
      {loading ? (
        <Text style={styles.portfolioHelper}>Loading portfolio value…</Text>
      ) : empty ? (
        <>
          <Text style={styles.portfolioUnavailable}>No holdings yet</Text>
          <Text style={styles.portfolioHelper}>Your portfolio value will appear when holdings are available.</Text>
        </>
      ) : value === null ? (
        <Text style={styles.portfolioUnavailable}>Portfolio value unavailable</Text>
      ) : (
        <>
          <Text style={styles.portfolioValue}>{formatINR(value)}</Text>
          <Text style={styles.portfolioHelper}>
            {apiConfig.mode === 'demo' ? 'Estimated from local demo holdings and sample rates' : 'Current portfolio value'}
          </Text>
        </>
      )}
    </View>
  );
}

function HomeScreen({
  name,
  onOpenAction,
  onSupport,
  onSelectTab,
  onRateSelect,
  onQuickBuyLayout,
  quickBuyMetalId,
  quickBuyExpanded,
  onQuickBuyToggle,
  rates,
  ratesLoading,
  ratesError,
  onRetryRates,
  activities,
  activitiesLoading,
  activitiesError,
  onRetryActivities,
  onQuickBuy,
}) {
  const { width: screenWidth } = useWindowDimensions();
  const contentWidth = screenWidth - 40;
  const columnCount = screenWidth >= 600 ? 3 : 2;
  const columnGap = 10;
  const actionWidth = (contentWidth - columnGap * (columnCount - 1)) / columnCount;
  const rateGap = 8;
  const rateCardWidth = Math.floor((contentWidth - rateGap * 2) / 3);
  return (
    <>
      <DigiGoldHeader
        home
        name={name}
        onNotifications={() => onSelectTab('notifications')}
        onSupport={onSupport}
      />
      <SectionTitle title="Current Metal Rates" />
      {apiConfig.mode === 'demo' ? (
        <Text style={styles.ratesDisclosure}>Illustrative demo rates · not live market prices</Text>
      ) : null}
      {ratesLoading ? (
        <LoadingState label="Loading metal rates…" />
      ) : ratesError ? (
        <ErrorState message={ratesError} onRetry={onRetryRates} />
      ) : (
        <View style={[styles.rateGrid, { columnGap: rateGap }]}>
          {rates.map((rate) => (
            <MetalRateCard
              key={rate.id}
              rate={rate}
              compact
              selected={rate.id === quickBuyMetalId}
              onPress={() => onRateSelect(rate)}
              width={rateCardWidth}
            />
          ))}
        </View>
      )}
      {!ratesLoading && !ratesError && rates.length === 0 ? (
        <EmptyState title="Rates unavailable" body="No current metal rates are available." symbol="◈" />
      ) : null}
      <View onLayout={onQuickBuyLayout}>
        <QuickBuyCalculator
          rates={rates}
          ratesLoading={ratesLoading}
          ratesError={ratesError}
          selectedMetalId={quickBuyMetalId}
          expanded={quickBuyExpanded}
          onToggle={onQuickBuyToggle}
          onBuy={(draft) => onQuickBuy(draft)}
          purchaseAvailable={apiConfig.mode === 'demo'}
        />
      </View>
      <SectionTitle title="Explore DigiGold" />
      <Text style={styles.exploreSectionDescription}>
        Discover a smarter way to own and manage precious metals.
      </Text>
      {apiConfig.mode === 'backend' ? (
        <Notice type="warning" style={styles.sectionNotice}>
          Buy, sell, SIP, redemption and gift actions remain disabled until their backend transaction flow is connected.
        </Notice>
      ) : null}
      <View style={[styles.actionsGrid, { columnGap, rowGap: 10 }]}>
        {actions.map((action) => (
          <ExploreActionCard
            key={action.id}
            action={action}
            width={actionWidth}
            disabled={apiConfig.mode === 'backend' && action.id !== 'portfolio'}
            onPress={() => onOpenAction(action.id)}
          />
        ))}
      </View>

      <RecentActivity
        activities={activities}
        loading={activitiesLoading}
        error={activitiesError}
        onRetry={onRetryActivities}
        onViewAll={() => onSelectTab('activity')}
      />
      {apiConfig.mode === 'demo' ? (
        <Notice type="warning" style={styles.disclaimer}>
          Sample rates and local demo records only. Nothing is sent to the backend and no real ownership, payment, purchase, sale, redemption, or transfer occurs.
        </Notice>
      ) : null}
    </>
  );
}

function RecentActivity({ activities, loading, error, onRetry, onViewAll }) {
  return (
    <View style={styles.recentActivitySection}>
      <SectionTitle title="Recent Activity" action="View All" onAction={onViewAll} />
      {apiConfig.mode === 'demo' && activities.length > 0 ? (
        <DemoBadge label="DEMO ACTIVITY" />
      ) : null}
      {loading ? (
        <View style={styles.dataLoading}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.dataLoadingText}>Loading recent activity…</Text>
        </View>
      ) : error ? (
        <View style={styles.dataError}>
          <Text style={styles.dataErrorText}>{error}</Text>
          <TouchableOpacity accessibilityRole="button" onPress={onRetry} style={styles.retryLink}>
            <Text style={styles.retryLinkText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : activities.length === 0 ? (
        <Text style={styles.noRecentActivity}>No recent activity yet.</Text>
      ) : (
        <Card style={styles.recentActivityCard}>
          {activities.slice(0, 3).map((activity) => (
            <RecentActivityRow key={activity.id} activity={activity} />
          ))}
        </Card>
      )}
    </View>
  );
}

function RecentActivityRow({ activity, compact = false }) {
  const knownPresentation = transactionPresentation[activity.type];
  const presentation = knownPresentation || {
    title: 'Activity',
    icon: 'history',
    color: colors.lightMint,
    ink: colors.primary,
  };
  const icon = {
    buy: 'add-shopping-cart',
    sell: 'sell',
    redeem: 'redeem',
    sip: 'event-repeat',
    gift: 'card-giftcard',
    other: 'history',
  }[activity.type] || 'history';
  const when = activity.createdAt ? new Date(activity.createdAt) : null;
  const dateLabel = when && !Number.isNaN(when.getTime())
    ? when.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : 'Date unavailable';
  const amount = Number.isFinite(activity.amount) ? formatINR(activity.amount) : 'Amount unavailable';
  const configuredMetal = demoRates.find((rate) => rate.id === activity.metal);
  const details = [
    activity.metalName || configuredMetal?.metal,
    Number.isFinite(activity.quantity) && activity.quantity > 0 ? `${activity.quantity} g` : '',
    dateLabel,
  ].filter(Boolean).join(' · ');
  const title = activity.title || transactionDisplayTitle(activity);

  return (
    <View style={[styles.recentActivityRow, compact && styles.recentActivityRowCompact]}>
      <View style={[styles.recentActivityIcon, { backgroundColor: presentation.color }]}>
        <MaterialIcons name={icon} size={18} color={presentation.ink} />
      </View>
      <View style={styles.recentActivityCopy}>
        <Text style={styles.recentActivityTitle} numberOfLines={1}>{title}</Text>
        <Text style={styles.recentActivityDetails} numberOfLines={1}>{details || dateLabel}</Text>
        <Text style={styles.recentActivityStatus} numberOfLines={1}>{activity.status}</Text>
      </View>
      <Text style={styles.recentActivityAmount} numberOfLines={1}>{amount}</Text>
    </View>
  );
}

function MetalRateCard({ rate, onPress, width, compact = false, selected = false }) {
  const availableRate = Number.isFinite(rate.ratePerGram) && rate.ratePerGram > 0;
  const metalIcon = rate.id === 'gold'
    ? 'monetization-on'
    : rate.id === 'silver'
      ? 'view-in-ar'
      : 'diamond';
  const content = (
    <>
      <View style={[styles.metalIcon, compact && styles.metalIconCompact, styles[`metalIcon_${rate.id}`]]}>
        <MaterialIcons name={metalIcon} size={compact ? 23 : 28} color={rate.id === 'gold' ? colors.goldDark : rate.id === 'silver' ? colors.muted : colors.primary} />
      </View>
      <Text style={[styles.rateName, compact && styles.rateNameCompact]} numberOfLines={1}>{rate.metal}</Text>
      <Text style={[styles.ratePurity, compact && styles.rateTextCompact]} numberOfLines={1}>
        {rate.purity ? `Purity ${rate.purity}` : 'Purity unavailable'}
      </Text>
      <Text style={[styles.ratePrice, compact && styles.ratePriceCompact]} numberOfLines={1}>
        {availableRate ? formatINR(rate.ratePerGram) : 'Rate unavailable'}
      </Text>
      {availableRate ? (
        <Text style={[styles.ratePerGram, compact && styles.rateTextCompact]}>
          per gram{apiConfig.mode === 'demo' ? ' · demo' : ''}
        </Text>
      ) : null}
    </>
  );
  const cardStyle = [
    styles.metalRateCard,
    compact && styles.metalRateCardCompact,
    width ? { width } : null,
    compact ? { marginRight: 0 } : null,
  ];
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${rate.metal}, ${availableRate ? `${apiConfig.mode === 'demo' ? 'illustrative demo' : 'current'} rate ${formatINR(rate.ratePerGram)} per gram` : 'rate unavailable'}. Open Quick Buy with this metal selected.`}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        cardStyle,
        selected && styles.metalRateCardSelected,
        pressed && styles.metalRateCardPressed,
      ]}
    >
      {content}
    </Pressable>
  ) : (
    <View style={cardStyle}>{content}</View>
  );
}

function SellEstimateBreakdown({ estimate, compact = false }) {
  return (
    <View style={[styles.priceBreakdown, compact && styles.priceBreakdownCompact]}>
      <SummaryRow label="Applicable sell rate" value={`${formatINR(estimate.ratePerGram)} / g`} />
      <SummaryRow label="Metal value" value={formatINR(estimate.metalValue)} />
      <SummaryRow
        label="Making charges"
        value={estimate.makingChargeConfigured ? formatINR(estimate.makingCharge) : 'Not configured'}
      />
      <SummaryRow label="Taxable amount" value={formatINR(estimate.taxableAmount)} />
      {estimate.taxesConfigured ? (
        estimate.taxTreatment === 'split' ? (
          <>
            <SummaryRow label={`GST (${estimate.taxRate}% demo)`} value={formatINR(estimate.gst)} />
            <SummaryRow label="CGST (included above)" value={formatINR(estimate.cgst)} />
            <SummaryRow label="SGST (included above)" value={formatINR(estimate.sgst)} />
          </>
        ) : (
          <>
            <SummaryRow label={`GST (${estimate.taxRate}% demo)`} value={formatINR(estimate.gst)} />
            <SummaryRow label="IGST (included above)" value={formatINR(estimate.igst)} />
          </>
        )
      ) : (
        <SummaryRow label="GST" value="Not configured" />
      )}
      <SummaryRow label="Other configured fees" value="None configured" />
      <View style={styles.priceBreakdownDivider} />
      <SummaryRow
        label={estimate.includesUnconfiguredMakingCharge
          ? 'Estimated amount · charge excluded'
          : 'Total estimated amount'}
        value={formatINR(estimate.totalEstimate)}
      />
      <Text style={styles.calculationNote}>
        Demo sell estimate only. This amount is not a guaranteed settlement. GST is the requested demo rule, not verified settlement or tax treatment.
        {estimate.includesUnconfiguredMakingCharge ? ' The amount excludes the unconfigured making charge.' : ''}
      </Text>
    </View>
  );
}

function BuyEstimateSummary({ estimate }) {
  const metal = getMetalConfig(estimate.metalId);
  return (
    <View style={styles.quickBuySummary}>
      <SummaryRow label="Metal" value={metal.metal} />
      <SummaryRow label="Rate per gram" value={`${formatINR(estimate.ratePerGram)} / g`} />
      <SummaryRow label="Estimated quantity" value={`${estimate.quantityGrams.toFixed(6)} g`} />
      <SummaryRow label="Metal value" value={formatINR(estimate.metalValue)} />
      <View style={styles.quickBuyTotal}>
        <SummaryRow label="Total estimated purchase amount" value={formatINR(estimate.totalEstimate)} />
      </View>
    </View>
  );
}

function QuickBuyCalculator({
  rates,
  ratesLoading,
  ratesError,
  selectedMetalId,
  expanded,
  onToggle,
  onBuy,
  purchaseAvailable,
}) {
  const [mode, setMode] = useState('amount');
  const [valuesByMode, setValuesByMode] = useState({ amount: '', grams: '' });
  const [validationError, setValidationError] = useState('');
  const [purchaseError, setPurchaseError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const value = valuesByMode[mode];
  const selectedRate = rates.find((rate) => rate.id === selectedMetalId);
  const rateAvailable = Number.isFinite(selectedRate?.ratePerGram) && selectedRate.ratePerGram > 0;
  let estimate = null;
  let estimateError = '';
  if (value.trim() && rateAvailable) {
    try {
      estimate = calculateBuyEstimate({
        metalId: selectedMetalId,
        mode,
        value,
        ratePerGram: selectedRate.ratePerGram,
      });
    } catch (error) {
      estimateError = error.message;
    }
  }

  const updateValue = (next) => {
    setValuesByMode((current) => ({ ...current, [mode]: sanitizeDecimalInput(next) }));
    setValidationError('');
    setPurchaseError('');
  };
  const submit = () => {
    if (submitting) return;
    setPurchaseError('');
    if (!rateAvailable) {
      setValidationError('A valid rate is not available for this metal.');
      return;
    }
    if (!value.trim()) {
      setValidationError('Enter an amount or quantity to see an estimate.');
      return;
    }
    const numericValue = Number(value);
    const maximum = mode === 'amount' ? pricingLimits.maxAmountINR : pricingLimits.maxQuantityGrams;
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      setValidationError('Enter an amount or quantity greater than zero.');
      return;
    }
    if (numericValue > maximum) {
      setValidationError(
        mode === 'amount'
          ? `Amount cannot exceed ${formatINR(maximum)}.`
          : `Quantity cannot exceed ${maximum.toLocaleString('en-IN')} g.`,
      );
      return;
    }
    if (estimateError || !estimate) {
      setValidationError(estimateError || 'Enter a valid amount or quantity.');
      return;
    }
    setValidationError('');
    Keyboard.dismiss();
    if (!purchaseAvailable) {
      setPurchaseError('Purchases are unavailable in backend mode until the purchase quote and review flow are connected.');
      return;
    }
    setSubmitting(true);
    onBuy({ metalId: selectedMetalId, mode, value, estimate });
  };
  const updateMode = (nextMode) => {
    setMode(nextMode);
    setValidationError('');
    setPurchaseError('');
  };
  const activeError = validationError || (estimateError && value.trim() ? estimateError : '');
  const modeShortcuts = mode === 'amount'
    ? ['500', '1000', '2000', '5000']
    : ['0.5', '1', '2', '5', '10'];

  return (
    <Card style={[styles.calculatorCard, expanded && styles.calculatorCardExpanded]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Quick Buy, ${expanded ? 'collapse' : 'expand'} purchase estimate`}
        accessibilityState={{ expanded }}
        onPress={onToggle}
        style={({ pressed }) => [
          styles.calculatorHeader,
          expanded && styles.calculatorHeaderExpanded,
          pressed && styles.calculatorHeaderPressed,
        ]}
      >
        <View style={styles.calculatorHeadingCopy}>
          <Text style={styles.calculatorTitle}>Quick Buy</Text>
          <Text style={styles.calculatorSubheading}>
            Estimate your purchase before you buy.
          </Text>
        </View>
        <View style={styles.calculatorHeaderActions}>
          {apiConfig.mode === 'demo' ? <DemoBadge label="DEMO ESTIMATE" /> : null}
          <MaterialIcons
            name={expanded ? 'expand-less' : 'expand-more'}
            size={23}
            color={colors.primary}
          />
        </View>
      </Pressable>
      {expanded ? (
      <>
      <Text style={styles.quickBuySelectedMetal}>
        Buying {selectedRate?.metal || selectedMetalId}
      </Text>
      {ratesLoading ? (
        <View style={styles.quickBuyRateState}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.dataLoadingText}>Loading rate…</Text>
        </View>
      ) : ratesError ? (
        <Notice type="error" style={styles.quickBuyNotice}>{ratesError}</Notice>
      ) : (
        <View style={styles.quickRate}>
          <Text style={styles.summaryLabel}>
            {apiConfig.mode === 'demo' ? 'Demo rate' : 'Rate'} per gram
          </Text>
          <Text style={styles.summaryValue}>
            {rateAvailable ? `${formatINR(selectedRate.ratePerGram)} / g` : 'Rate unavailable'}
          </Text>
        </View>
      )}
      <View accessibilityLabel="Buy calculation mode" style={styles.quickBuyModeRow}>
        {[
          { label: 'Buy by Grams', value: 'grams' },
          { label: 'Buy by Amount', value: 'amount' },
        ].map((option) => {
          const selected = mode === option.value;
          return (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={option.value}
              onPress={() => updateMode(option.value)}
              style={[styles.quickBuyModeOption, selected && styles.quickBuyModeOptionSelected]}
            >
              <Text style={[styles.quickBuyModeText, selected && styles.quickBuyModeTextSelected]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={styles.formLabel}>
        {mode === 'amount' ? 'Investment amount' : 'Quantity in grams'}
      </Text>
      <View style={[styles.quickBuyInputWrap, activeError && styles.quickBuyInputError]}>
        <TextInput
          accessibilityLabel={mode === 'amount' ? 'Investment amount in rupees' : 'Quantity in grams'}
          autoCorrect={false}
          keyboardType="decimal-pad"
          onChangeText={updateValue}
          placeholder={mode === 'amount' ? 'Enter amount' : 'Enter quantity'}
          placeholderTextColor={colors.muted}
          returnKeyType="done"
          style={styles.quickBuyInput}
          value={value}
        />
        <Text style={styles.quickBuyInputUnit}>{mode === 'amount' ? 'INR' : 'grams'}</Text>
      </View>
      {activeError ? <Text style={styles.formError}>{activeError}</Text> : null}
      <View style={styles.chips}>
        {modeShortcuts.map((chip) => (
          <TouchableOpacity
            accessibilityLabel={mode === 'amount' ? `Set amount to ${formatINR(Number(chip))}` : `Set quantity to ${chip} grams`}
            accessibilityRole="button"
            key={chip}
            onPress={() => updateValue(chip)}
            style={styles.quickChip}
          >
            <Text style={styles.quickChipText}>
              {mode === 'amount' ? `₹${Number(chip).toLocaleString('en-IN')}` : `${chip} g`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {estimate ? (
        <>
          <View style={styles.quickBuySummary}>
            <SummaryRow label="Selected metal" value={selectedRate.metal} />
            <SummaryRow label="Rate per gram" value={`${formatINR(estimate.ratePerGram)} / g`} />
            <SummaryRow label="Estimated quantity" value={`${estimate.quantityGrams.toFixed(6)} g`} />
            <SummaryRow label="Estimated metal value" value={formatINR(estimate.metalValue)} />
            <SummaryRow label="Making charges" value="Not configured" />
            <SummaryRow label="Taxes" value="Not configured" />
            <View style={styles.quickBuyTotal}>
              <SummaryRow label="Estimated payable · configured charges excluded" value={formatINR(estimate.totalEstimate)} />
            </View>
          </View>
        </>
      ) : !ratesLoading && !ratesError && !rateAvailable ? (
        <Notice type="warning" style={styles.calculatorHint}>
          A rate is not available for this metal. An estimate and purchase preview cannot be prepared.
        </Notice>
      ) : !value.trim() ? (
        <Notice style={styles.calculatorHint}>
          {mode === 'amount'
            ? 'Enter a rupee amount or choose a shortcut to see your estimate.'
            : 'Enter a quantity in grams or choose a shortcut to see your estimate.'}
        </Notice>
      ) : null}
      {purchaseError ? <Notice type="error" style={styles.quickBuyNotice}>{purchaseError}</Notice> : null}
      <Button
        title="Buy Now"
        onPress={submit}
        loading={submitting}
        disabled={submitting || ratesLoading || !rateAvailable}
        style={styles.formButton}
      />
      <Text style={styles.calculationNote}>
        {purchaseAvailable
          ? 'Demo only · continuing opens the existing local purchase review; no payment is made.'
          : 'Estimate only · the backend purchase quote and review flow are not connected. No order is sent.'}
      </Text>
      </>
      ) : null}
    </Card>
  );
}

function MetalDetailsScreen({ rate, onBuy }) {
  return (
    <>
      <MetalRateCard rate={rate} />
      {apiConfig.mode === 'demo' ? (
        <Notice type="warning" style={styles.detailNotice}>
          Illustrative demo rate only. This is not a live market feed or purchase quote.
        </Notice>
      ) : null}
      <Button
        title={onBuy ? `Buy ${rate.metal}` : 'Purchases unavailable'}
        disabled={!onBuy}
        onPress={onBuy ? () => onBuy(rate.id) : undefined}
        style={styles.formButton}
      />
    </>
  );
}

function ActionScreen({
  action,
  portfolio,
  initialOrder,
  onReview,
}) {
  const [metal, setMetal] = useState(
    action === 'gift' ? 'gold' : initialOrder?.metal || 'gold',
  );
  const [mode, setMode] = useState(
    action === 'gift'
      ? 'amount'
      : initialOrder?.mode || (action === 'sell' || action === 'redeem' ? 'grams' : 'amount'),
  );
  const [valuesByMode, setValuesByMode] = useState(() => ({
    amount: action === 'gift' ? String(initialOrder?.value ?? '') : initialOrder?.mode === 'amount' ? String(initialOrder.value) : '',
    grams: initialOrder?.mode === 'grams' ? String(initialOrder.value) : '',
  }));
  const [recipientName, setRecipientName] = useState(initialOrder?.recipientName || '');
  const [recipient, setRecipient] = useState(initialOrder?.recipient || '');
  const [message, setMessage] = useState(initialOrder?.message || '');
  const [startDate, setStartDate] = useState(initialOrder?.startDate || '');
  const [frequency, setFrequency] = useState(initialOrder?.frequency || 'monthly');
  const [error, setError] = useState('');
  const value = valuesByMode[mode];
  const setValue = (next) => {
    setValuesByMode((current) => ({ ...current, [mode]: next }));
  };
  const metalConfig = getMetalConfig(metal);
  const rate = metalConfig.ratePerGram;
  const availableGrams = portfolio[`${metal}Grams`] || 0;
  const numericValue = Number(value);
  let buyEstimate = null;
  let estimateError = '';
  if ((action === 'buy' || action === 'sip' || action === 'gift') && value.trim()) {
    try {
      buyEstimate = calculateBuyEstimate({ metalId: metal, mode, value });
    } catch (calculationError) {
      estimateError = calculationError.message;
    }
  }
  let sellEstimate = null;
  if (action === 'sell' && value.trim()) {
    try {
      sellEstimate = calculateSellEstimate({ metalId: metal, quantityGrams: value, ratePerGram: rate });
    } catch (calculationError) {
      estimateError = calculationError.message;
    }
  }
  const quantity = (action === 'sell' || action === 'redeem')
    ? numericValue
    : buyEstimate?.quantityGrams || 0;
  const amount = action === 'sell'
    ? sellEstimate?.totalEstimate || 0
    : action === 'redeem'
      ? numericValue * rate
      : buyEstimate?.totalEstimate || 0;
  const isReviewDisabled = (() => {
    if (!Number.isFinite(numericValue) || numericValue <= 0) return true;
    if (!Number.isFinite(amount) || amount <= 0 || Number(quantity.toFixed(6)) <= 0) return true;
    if (action === 'buy' && !buyEstimate) return true;
    if (action === 'sell' && (!sellEstimate || numericValue > availableGrams)) return true;
    if (action === 'redeem' && numericValue > availableGrams) return true;
    if (action === 'sip' && (!buyEstimate || !isValidDemoDate(startDate))) return true;
    if (action === 'gift' && (
      !buyEstimate
      || !recipientName.trim()
      || !/^[6-9]\d{9}$/.test(recipient)
    )) return true;
    return false;
  })();
  const title = {
    buy: 'Buy a metal',
    sell: 'Sell a metal',
    redeem: 'Redeem a metal',
    sip: 'Monthly SIP',
    gift: 'Gift a metal',
  }[action] || 'Action';
  const description = {
    buy: 'Estimate a metal purchase using illustrative demo rates.',
    sell: 'Review your available demo holdings and an indicative sale estimate.',
    redeem: 'Check your available demo balance before recording a local redemption.',
    sip: 'Set up a sample recurring-investment plan; no payment is scheduled.',
  }[action];

  const review = () => {
    setError('');
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      setError('Enter an amount or quantity greater than zero.');
      return;
    }
    if ((action === 'buy' || action === 'sip' || action === 'gift') && !buyEstimate) {
      setError(estimateError || 'Enter a valid amount or quantity.');
      return;
    }
    if (action === 'sell' && !sellEstimate) {
      setError(estimateError || 'Enter a valid sell quantity.');
      return;
    }
    const roundedQuantity = Number(quantity.toFixed(6));
    const roundedAmount = Math.round(amount * 100) / 100;
    if (roundedQuantity <= 0 || roundedAmount <= 0) {
      setError('The amount is too small to represent a positive metal quantity.');
      return;
    }
    if ((action === 'sell' || action === 'redeem') && roundedQuantity > availableGrams) {
      setError(`You can use up to ${availableGrams.toFixed(4)} demo grams.`);
      return;
    }
    if (action === 'gift' && !recipientName.trim()) {
      setError('Enter the recipient’s name.');
      return;
    }
    if (action === 'gift' && !/^[6-9]\d{9}$/.test(recipient)) {
      setError('Enter a valid 10-digit Indian recipient mobile number.');
      return;
    }
    if (action === 'sip' && !isValidDemoDate(startDate)) {
      setError('Enter a valid proposed start date in DD/MM/YYYY format.');
      return;
    }
    onReview({
      action,
      metal,
      mode,
      value: numericValue,
      amount: roundedAmount,
      quantity: roundedQuantity,
      recipientName: recipientName.trim(),
      recipient,
      message: message.trim(),
      startDate,
      frequency,
      rate,
      estimate: action === 'sell' ? sellEstimate : buyEstimate,
    });
  };

  return (
    <>
      {action === 'gift' ? (
        <>
          <Text style={styles.giftPageSubtitle}>
            Send gold to someone. Recipient verification is not connected in this demo.
          </Text>
        </>
      ) : (
        <>
          <Text style={styles.actionPageDescription}>{description}</Text>
          <Notice type="warning" style={styles.formNotice}>
            LOCAL DEMO · Confirming creates an in-memory sample record only. Nothing is submitted or charged.
          </Notice>
        </>
      )}

      {action === 'buy' || action === 'sell' || action === 'redeem' ? (
        <Card style={styles.formCard}>
          <Text style={styles.formLabel}>Choose metal</Text>
          <ChoiceRow
            accessibilityLabel="Choose metal"
            variant="metal"
            options={demoRates.map((item) => ({ label: item.metal, value: item.id }))}
            value={metal}
            onChange={(next) => { setMetal(next); setError(''); }}
          />
          <View style={styles.rateSummary}>
            <Text style={styles.summaryLabel}>{action === 'sell' ? 'Illustrative sell rate' : 'Illustrative rate'}</Text>
            <Text style={styles.summaryValue}>₹{rate.toLocaleString('en-IN')} / g</Text>
          </View>
          {action !== 'buy' ? (
            <>
              <View style={styles.rateSummary}>
                <Text style={styles.summaryLabel}>Available demo balance</Text>
                <Text style={styles.summaryValue}>{availableGrams.toFixed(4)} g</Text>
              </View>
              {availableGrams <= 0 ? (
                <Notice style={styles.inlineNotice}>No demo holding is available yet. Add a local demo buy first to try this flow.</Notice>
              ) : null}
              <Field
                label={action === 'sell' ? 'Quantity to sell (grams)' : 'Quantity to redeem (grams)'}
                value={value}
                onChangeText={(next) => { setValue(sanitizeDecimalInput(next)); setError(''); }}
                placeholder="e.g. 0.0500"
                keyboardType="decimal-pad"
                error={numericValue > availableGrams ? `You can use up to ${availableGrams.toFixed(4)} demo grams.` : ''}
              />
              {numericValue > 0 ? (
                <View style={styles.estimateBox}>
                  <Text style={styles.summaryLabel}>Estimated demo {action === 'sell' ? 'proceeds' : 'value'}</Text>
                  <Text style={styles.estimateValue}>{formatINR(amount)}</Text>
                </View>
              ) : null}
              {action === 'sell' && sellEstimate ? <SellEstimateBreakdown estimate={sellEstimate} compact /> : null}
              {action === 'sell' && estimateError ? <Text style={styles.formError}>{estimateError}</Text> : null}
              {action === 'redeem' ? (
                <Notice style={styles.inlineNotice}>
                  Redemption methods, fees, and tax treatment are not configured. No Sell-specific charges are applied and no delivery option is available in this demo.
                </Notice>
              ) : null}
            </>
          ) : (
            <>
              <Text style={styles.formLabel}>Buy by</Text>
              <ChoiceRow
                options={[{ label: 'Amount', value: 'amount' }, { label: 'Grams', value: 'grams' }]}
                value={mode}
                onChange={(next) => { setMode(next); setError(''); }}
              />
              <Field
                label={mode === 'amount' ? 'Total purchase budget (₹)' : 'Quantity to buy (grams)'}
                value={value}
                onChangeText={(next) => { setValue(sanitizeDecimalInput(next)); setError(''); }}
                placeholder={mode === 'amount' ? 'e.g. 1,000' : 'e.g. 0.500'}
                keyboardType="decimal-pad"
              />
              <View style={styles.chips}>
                {(mode === 'amount' ? ['500', '1000', '2000'] : ['0.5', '1', '2']).map((chip) => (
                  <TouchableOpacity key={chip} onPress={() => { setValue(chip); setError(''); }} style={styles.quickChip}>
                    <Text style={styles.quickChipText}>{mode === 'amount' ? `₹${chip}` : `${chip} g`}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {buyEstimate ? (
                <View style={styles.estimateBox}>
                  <Text style={styles.summaryLabel}>
                    {mode === 'amount'
                      ? 'Estimated quantity'
                      : 'Estimated purchase amount'}
                  </Text>
                  <Text style={styles.estimateValue}>
                    {mode === 'amount'
                      ? `${quantity.toFixed(6)} g`
                      : formatINR(amount)}
                  </Text>
                  <Text style={styles.summaryFootnote}>Illustrative demo estimate · not a live price</Text>
                </View>
              ) : null}
              {buyEstimate ? <BuyEstimateSummary estimate={buyEstimate} /> : null}
              {estimateError && value.trim() ? (
                <Text style={styles.formError}>{estimateError}</Text>
              ) : null}
            </>
          )}
          {error ? <Text style={styles.formError}>{error}</Text> : null}
          <Button
            title={action === 'buy' ? 'Review demo purchase' : action === 'sell' ? 'Review demo sale' : 'Review demo redemption'}
            onPress={review}
            disabled={isReviewDisabled}
            state={error ? 'error' : 'idle'}
            style={styles.formButton}
          />
        </Card>
      ) : null}

      {action === 'sip' ? (
        <Card style={styles.formCard}>
          <Text style={styles.formLabel}>Metal (demo selection)</Text>
          <ChoiceRow
            variant="metal"
            options={demoRates.map((item) => ({ label: item.metal, value: item.id }))}
            value={metal}
            onChange={(next) => { setMetal(next); setError(''); }}
          />
          <Field
            label="Demo monthly amount (₹)"
            value={value}
            onChangeText={(next) => { setValue(sanitizeDecimalInput(next)); setError(''); }}
            placeholder="e.g. 1,000"
            keyboardType="decimal-pad"
          />
          <Text style={styles.formLabel}>Frequency</Text>
          <ChoiceRow
            options={[{ label: 'Monthly', value: 'monthly' }, { label: 'Weekly', value: 'weekly' }]}
            value={frequency}
            onChange={setFrequency}
          />
          <Field
            label="Proposed start date"
            value={startDate}
            onChangeText={(next) => { setStartDate(next); setError(''); }}
            placeholder="DD/MM/YYYY"
            error={!isValidDemoDate(startDate) ? 'Enter a valid date in DD/MM/YYYY format.' : ''}
          />
          <Notice style={styles.inlineNotice}>
            Demo plan only. No mandate or recurring payment is set up. Estimated quantity is not a commitment.
          </Notice>
          {buyEstimate ? (
            <View style={styles.estimateBox}>
              <Text style={styles.summaryLabel}>Estimated quantity at sample rate</Text>
              <Text style={styles.estimateValue}>{buyEstimate.quantityGrams.toFixed(6)} g</Text>
            </View>
          ) : null}
          {estimateError && value.trim() ? (
            <Text style={styles.formError}>{estimateError}</Text>
          ) : null}
          {error ? <Text style={styles.formError}>{error}</Text> : null}
          <Button
            title="Review demo SIP"
            onPress={review}
            disabled={isReviewDisabled}
            state={error ? 'error' : 'idle'}
            style={styles.formButton}
          />
        </Card>
      ) : null}

      {action === 'gift' ? (
        <Card style={styles.formCard}>
          <View style={styles.giftFormIcon}>
            <MaterialIcons name="card-giftcard" size={24} color={colors.goldDark} />
          </View>
          <Field
            label="Recipient name"
            value={recipientName}
            onChangeText={(next) => { setRecipientName(next); setError(''); }}
            placeholder="Enter recipient name"
            maxLength={60}
            error={!recipientName.trim() ? 'Recipient name is required.' : ''}
          />
          <Field
            label="Recipient mobile number"
            value={recipient}
            onChangeText={(next) => { setRecipient(next.replace(/\D/g, '').slice(0, 10)); setError(''); }}
            placeholder="10-digit mobile number"
            keyboardType="number-pad"
            maxLength={10}
            error={!recipient
              ? 'Recipient mobile number is required.'
              : !/^[6-9]\d{9}$/.test(recipient)
                ? 'Enter a valid 10-digit Indian mobile number.'
                : ''}
          />
          <Field
            label="Gift amount (₹)"
            value={value}
            onChangeText={(next) => { setValue(sanitizeDecimalInput(next)); setError(''); }}
            placeholder="Enter gift amount"
            keyboardType="decimal-pad"
            error={value.trim() && (!Number.isFinite(numericValue) || numericValue <= 0)
              ? 'Enter a gift amount greater than zero.'
              : ''}
          />
          <Notice style={styles.inlineNotice}>
            Demo only. Recipient verification and gift delivery are not connected.
          </Notice>
          {buyEstimate ? (
            <View style={styles.estimateBox}>
              <Text style={styles.summaryLabel}>Estimated quantity</Text>
              <Text style={styles.estimateValue}>{buyEstimate.quantityGrams.toFixed(6)} g</Text>
            </View>
          ) : null}
          {estimateError && value.trim() ? (
            <Text style={styles.formError}>{estimateError}</Text>
          ) : null}
          {error ? <Text style={styles.formError}>{error}</Text> : null}
          <Button
            title="Review Gift"
            onPress={review}
            disabled={isReviewDisabled}
            state={error ? 'error' : 'idle'}
            style={styles.formButton}
          />
        </Card>
      ) : null}
    </>
  );
}

function sanitizeDecimalInput(value) {
  const normalized = value.replace(/[^\d.-]/g, '');
  const negative = normalized.startsWith('-');
  const unsigned = normalized.replace(/-/g, '');
  const [whole, ...fraction] = unsigned.split('.');
  return `${negative ? '-' : ''}${whole}${fraction.length ? `.${fraction.join('')}` : ''}`;
}

function isValidDemoDate(value) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return false;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function ReviewScreen({ order, onBack, onConfirm }) {
  const isBuy = order.action === 'buy';
  const displayTitle = { buy: 'Demo purchase', sell: 'Demo sale', redeem: 'Demo redemption', sip: 'Demo SIP', gift: 'Demo gift' }[order.action] || 'Demo action';
  return (
    <>
      <TouchableOpacity accessibilityRole="button" onPress={onBack} style={styles.backLink}>
        <Text style={styles.backLinkText}>‹  Edit details</Text>
      </TouchableOpacity>
      <Notice type="warning" style={styles.formNotice}>
        FINAL DEMO REVIEW · Confirming adds a local in-memory demo record only. No request is sent.
      </Notice>
      <Card style={styles.formCard}>
        <View style={styles.reviewHeader}>
          <Text style={styles.cardTitle}>{displayTitle} summary</Text>
          <DemoBadge label="LOCAL DEMO" />
        </View>
        <SummaryRow label="Metal" value={getMetalConfig(order.metal).metal} />
        {order.action === 'buy' || order.action === 'gift' || order.action === 'sell' || order.action === 'redeem' ? (
          <SummaryRow
            label={order.action === 'sell' ? 'Estimated demo proceeds' : order.action === 'redeem' ? 'Estimated demo value' : 'Illustrative amount'}
            value={formatINR(order.amount)}
          />
        ) : order.action === 'sip' ? (
          <SummaryRow
            label={`Demo investment amount (${order.frequency})`}
            value={`₹${Number(order.value).toLocaleString('en-IN')}`}
          />
        ) : null}
        {order.action !== 'sip' || isBuy ? (
          <SummaryRow label={order.action === 'sell' || order.action === 'redeem' ? 'Quantity' : 'Estimated quantity'} value={`${order.quantity.toFixed(6)} g`} />
        ) : (
          <SummaryRow label="Estimated quantity per installment" value={`${order.quantity.toFixed(6)} g`} />
        )}
        {order.action === 'sip' ? (
          <>
            <SummaryRow label="Frequency" value={order.frequency} />
            <SummaryRow label="Proposed start date" value={order.startDate} />
          </>
        ) : null}
        {order.action === 'gift' ? (
          <>
            <SummaryRow label="Recipient" value={order.recipientName} />
            <SummaryRow label="Recipient mobile" value={`+91 ••••••${order.recipient.slice(-4)}`} />
            {order.message ? <SummaryRow label="Message" value={order.message} /> : null}
          </>
        ) : null}
        <SummaryRow label="Sample rate" value={`${formatINR(order.rate)} / g`} />
        {order.action === 'sell' && order.estimate ? (
          <SellEstimateBreakdown estimate={order.estimate} compact />
        ) : order.action === 'buy' && order.estimate ? (
          <BuyEstimateSummary estimate={order.estimate} />
        ) : null}
        <View style={styles.reviewDivider} />
        <Text style={styles.bodyText}>
          {order.action === 'gift'
            ? 'The record is local only. No recipient will be contacted and no metal will be transferred.'
            : order.action === 'sip'
              ? 'The demo SIP is a history entry only. No mandate, payment, or future installment is scheduled.'
              : `This ${isBuy ? 'sample purchase' : 'sample action'} updates only the temporary demo view. No real money or metal is involved.`}
        </Text>
        <Button title="Confirm local demo record" onPress={onConfirm} style={styles.formButton} />
        <Text style={styles.centerHelper}>This record will reset when the app restarts or you log out.</Text>
      </Card>
    </>
  );
}

function ResultScreen({ transaction, onHome, onViewActivity }) {
  return (
    <>
      <Card style={styles.resultCard}>
        <View style={styles.resultMark}><Text style={styles.resultMarkText}>✓</Text></View>
        <DemoBadge label={transaction.status.toUpperCase()} />
        <Text style={styles.resultTitle}>{transactionDisplayTitle(transaction)} recorded</Text>
        <Text style={styles.bodyText}>
          This sample record is visible in Recent Activity and transaction history. It was stored only in app memory; nothing was sent to a backend, payment provider, or recipient.
        </Text>
        <Button title="View activity" variant="secondary" onPress={onViewActivity} style={styles.formButton} />
        <Button title="Return to home" onPress={onHome} style={styles.formButton} />
      </Card>
    </>
  );
}

function TransactionRow({ transaction, onPress }) {
  const presentation = transactionPresentation[transaction.type] || transactionPresentation.buy;
  const when = new Date(transaction.createdAt);
  const dateLabel = Number.isNaN(when.getTime())
    ? 'Date unavailable'
    : when.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`${transactionDisplayTitle(transaction)}, ${transaction.status}, tap for demo details`}
      onPress={onPress}
      style={styles.transactionRow}
    >
      <View style={[styles.transactionIcon, { backgroundColor: presentation.color }]}>
        <Text style={[styles.transactionIconText, { color: presentation.ink }]}>{presentation.icon}</Text>
      </View>
      <View style={styles.transactionCopy}>
        <Text style={styles.transactionTitle}>{transactionDisplayTitle(transaction)}</Text>
        <Text style={styles.transactionSubtitle}>
          {getMetalConfig(transaction.metal).metal}
          {transaction.quantity > 0 ? ` · ${transaction.quantity.toFixed(6)} g` : ''}
          {` · ${dateLabel}`}
        </Text>
        <View style={styles.transactionMetaRow}>
          <StatusBadge status={transaction.status} />
          {String(transaction.status).toLowerCase().startsWith('demo') ? <DemoBadge label="DEMO" /> : null}
        </View>
      </View>
      <View style={styles.transactionAmountWrap}>
        <Text style={styles.transactionAmount}>{formatINR(transaction.amount)}</Text>
        <Text style={styles.transactionChevron}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

function SavingsScreen({ portfolio, rates = demoRates, loading = false, error = '', onRetry }) {
  const currentValue = calculatePortfolioValue(portfolio, rates);
  const hasHoldings = rates.some((rate) => (portfolio?.[`${rate.id}Grams`] || 0) > 0);
  return (
    <>
      <Text style={styles.screenDescription}>
        {apiConfig.mode === 'demo'
          ? 'Review your available metal quantities and their estimated portfolio value.'
          : 'Review the savings information returned by your customer account.'}
      </Text>
      {apiConfig.mode === 'demo' ? (
        <Notice type="warning" style={styles.sectionNotice}>
          DEMO SAVINGS · This portfolio uses temporary local demo data and sample rates.
        </Notice>
      ) : null}
      {loading ? (
        <View style={styles.dataLoading}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.dataLoadingText}>Loading savings…</Text>
        </View>
      ) : error ? (
        <View style={styles.dataError}>
          <Text style={styles.dataErrorText}>{error}</Text>
          <TouchableOpacity accessibilityRole="button" onPress={onRetry} style={styles.retryLink}>
            <Text style={styles.retryLinkText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : !portfolio ? (
        <EmptyState title="Savings unavailable" body="No customer portfolio data is available." symbol="◈" />
      ) : (
        <>
          <PortfolioCard value={currentValue} empty={!hasHoldings} />
          {hasHoldings ? (
        <Card style={styles.savingsCard}>
          {rates.map((rate) => (
            <SummaryRow
              key={rate.id}
              label={`${rate.metal} available ${apiConfig.mode === 'demo' ? 'demo ' : ''}holdings`}
              value={formatWeight(portfolio[`${rate.id}Grams`])}
            />
          ))}
        </Card>
          ) : (
            <EmptyState
              title="No savings holdings yet"
              body="Available portfolio information will appear here when data is present."
              symbol="◈"
            />
          )}
        </>
      )}
    </>
  );
}

function formatWeight(value) {
  return Number.isFinite(value) ? `${value.toFixed(3)} g` : 'Weight not available';
}

function ActivityScreen({
  transactions,
  onTransactionPress,
  mode = 'demo',
  loading = false,
  error = '',
  onRetry,
}) {
  const [filter, setFilter] = useState('all');
  const filteredTransactions = useMemo(
    () => transactions.filter((item) => filter === 'all' || item.type === filter),
    [filter, transactions],
  );
  if (mode === 'backend') {
    return (
      <>
        <Text style={styles.screenDescription}>Activity returned by your customer account.</Text>
        {loading ? (
          <View style={styles.dataLoading}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.dataLoadingText}>Loading activity…</Text>
          </View>
        ) : error ? (
          <View style={styles.dataError}>
            <Text style={styles.dataErrorText}>{error}</Text>
            <TouchableOpacity accessibilityRole="button" onPress={onRetry} style={styles.retryLink}>
              <Text style={styles.retryLinkText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : transactions.length === 0 ? (
          <EmptyState title="No recent activity yet." body="Completed or requested transactions will appear here when available." symbol="↔" />
        ) : (
          <Card style={styles.activityCard}>
            {transactions.map((transaction) => (
              <RecentActivityRow key={transaction.id} activity={transaction} compact />
            ))}
          </Card>
        )}
      </>
    );
  }
  return (
    <>
      <Text style={styles.screenDescription}>
        Browse locally recorded demo actions. These are not real payments or completed metal transfers.
      </Text>
      <Text style={styles.filterLabel}>Filter by type</Text>
      <ChoiceRow options={transactionTypes} value={filter} onChange={setFilter} />
      <Card style={styles.activityCard}>
        {filteredTransactions.length === 0 ? (
          <EmptyState
            title={filter === 'all' ? 'No demo activity yet' : `No ${filter} records`}
            body="Confirm a demo action to add a sample record to this list."
            symbol="↔"
          />
        ) : (
          filteredTransactions.map((transaction) => (
            <TransactionRow
              key={transaction.id}
              transaction={transaction}
              onPress={() => onTransactionPress(transaction)}
            />
          ))
        )}
      </Card>
    </>
  );
}

function TransactionDetails({ transaction }) {
  const presentation = transactionPresentation[transaction.type] || transactionPresentation.buy;
  const timestamp = new Date(transaction.createdAt).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  return (
    <>
      <Notice type="warning" style={styles.formNotice}>
        LOCAL DEMO RECORD · Not an actual purchase, sale, redemption, SIP, or gift.
      </Notice>
      <Card style={styles.formCard}>
        <View style={styles.transactionDetailHeading}>
          <View style={[styles.transactionIcon, { backgroundColor: presentation.color }]}>
            <Text style={[styles.transactionIconText, { color: presentation.ink }]}>{presentation.icon}</Text>
          </View>
          <View>
            <Text style={styles.cardTitle}>{transactionDisplayTitle(transaction)}</Text>
            <DemoBadge label={transaction.status.toUpperCase()} />
          </View>
        </View>
        <SummaryRow label="Demo reference" value={transaction.id} />
        <SummaryRow label="Metal" value={getMetalConfig(transaction.metal).metal} />
        <SummaryRow label="Sample amount" value={formatINR(transaction.amount)} />
        {transaction.quantity > 0 ? <SummaryRow label="Sample quantity" value={`${transaction.quantity.toFixed(6)} g`} /> : null}
        <SummaryRow label="Created locally" value={timestamp} />
        {transaction.frequency ? <SummaryRow label="Frequency" value={transaction.frequency} /> : null}
        {transaction.startDate ? <SummaryRow label="Proposed start date" value={transaction.startDate} /> : null}
        {transaction.recipientName ? <SummaryRow label="Recipient" value={transaction.recipientName} /> : null}
        {transaction.recipient ? <SummaryRow label="Recipient mobile" value={`+91 ••••••${transaction.recipient.slice(-4)}`} /> : null}
        {transaction.message ? <SummaryRow label="Message" value={transaction.message} /> : null}
        <View style={styles.reviewDivider} />
        <Text style={styles.bodyText}>Stored in React state only. This record is not visible to the admin panel and will be cleared when the app session resets.</Text>
      </Card>
    </>
  );
}

function transactionDisplayTitle(transaction) {
  const presentation = transactionPresentation[transaction.type] || transactionPresentation.buy;
  if (transaction.type === 'sip') return presentation.title;
  return `${presentation.title} ${getMetalConfig(transaction.metal).metal}`;
}

function NotificationsScreen() {
  return (
    <>
      <Notice type="warning" style={styles.sectionNotice}>Backend notifications are not connected.</Notice>
      <Card style={styles.activityCard}>
        <EmptyState title="You’re all caught up" body="Transaction updates and reminders will appear here when the backend supports them." symbol="◉" />
      </Card>
    </>
  );
}

function StatementsScreen() {
  return (
    <>
      <Notice type="warning" style={styles.sectionNotice}>
        Statement retrieval is not connected to a backend.
      </Notice>
      <Card style={styles.activityCard}>
        <EmptyState
          title="No bill statements available yet"
          body="Statements will appear here when the service provides them."
          symbol="▤"
        />
      </Card>
    </>
  );
}

const profileSections = [
  { id: 'account', title: 'Account Details', icon: '○', detail: 'View your registered information' },
  { id: 'kyc', title: 'KYC Status', icon: '◇', detail: 'Verification information' },
  { id: 'payment', title: 'Bank/Payment Settings', icon: '▤', detail: 'Payment methods and bank settings' },
  { id: 'security', title: 'Security', icon: '⌑', detail: 'Session and sign-out options' },
  { id: 'help', title: 'Help', icon: '?', detail: 'FAQs and support availability' },
];

function ProfileScreen({ onOpenSection, onLogout }) {
  return (
    <>
      <Text style={styles.profileIntro}>
        {apiConfig.mode === 'demo'
          ? 'Manage your demo account information, review available settings, and find support details.'
          : 'Review account settings and support information available in this app.'}
      </Text>
      <Card style={styles.profileMenuCard}>
        {profileSections.map((section) => (
          <TouchableOpacity
            accessibilityRole="button"
            key={section.id}
            onPress={() => onOpenSection(section.id)}
            style={styles.profileMenuItem}
          >
            <View style={styles.profileMenuIcon}>
              <Text style={styles.profileMenuIconText}>{section.icon}</Text>
            </View>
            <View style={styles.profileMenuCopy}>
              <Text style={styles.profileMenuTitle}>{section.title}</Text>
              <Text style={styles.profileMenuDetail}>{section.detail}</Text>
            </View>
            <Text style={styles.profileMenuChevron}>›</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          accessibilityRole="button"
          onPress={onLogout}
          style={styles.profileMenuItem}
        >
          <View style={styles.profileMenuIcon}>
            <MaterialIcons name="logout" size={21} color={colors.primary} />
          </View>
          <View style={styles.profileMenuCopy}>
            <Text style={styles.profileMenuTitle}>Logout</Text>
            <Text style={styles.profileMenuDetail}>Sign out of your account</Text>
          </View>
          <Text style={styles.profileMenuChevron}>›</Text>
        </TouchableOpacity>
      </Card>
    </>
  );
}

function ProfileDetailScreen({ section, mobile, name, onLogout, busy, error }) {
  const current = profileSections.find((item) => item.id === section);
  const maskedNumber = mobile ? `+91 ••••••${mobile.slice(-4)}` : 'Not available';
  return (
    <>
      {error ? <Notice type="error" style={styles.formNotice}>{error}</Notice> : null}
      {section === 'account' ? (
        <Card style={styles.profileDetailCard}>
          {apiConfig.mode === 'demo' ? <DemoBadge label="DEMO ACCOUNT" /> : null}
          <SummaryRow label="Name" value={name || 'Not available'} />
          <SummaryRow label="Registered mobile" value={maskedNumber} />
          <SummaryRow label="Email" value="Not available" />
          <SummaryRow label="Customer ID" value="Not available" />
          <Text style={styles.bodyText}>Account details are read-only; no profile editing service is configured.</Text>
        </Card>
      ) : null}
      {section === 'kyc' ? (
        <Card style={styles.profileDetailCard}>
          <DemoBadge label="STATUS UNAVAILABLE" />
          <Text style={styles.cardTitle}>KYC status not available</Text>
          <Text style={styles.bodyText}>
            No KYC service is connected. This app does not mark the account as verified, and KYC submission is not available here.
          </Text>
        </Card>
      ) : null}
      {section === 'payment' ? (
        <Card style={styles.profileDetailCard}>
          <DemoBadge label="NOT CONNECTED" />
          <Text style={styles.cardTitle}>No payment method connected</Text>
          <Text style={styles.bodyText}>
            Payment and bank settings are not provided by the current service. No bank or card credentials are collected or displayed.
          </Text>
        </Card>
      ) : null}
      {section === 'security' ? (
        <Card style={styles.profileDetailCard}>
          <Text style={styles.cardTitle}>Session security</Text>
          <Text style={styles.bodyText}>
            Sign out using the configured authentication service. Password or session-management controls are not available in this app.
          </Text>
          <Button
            title={apiConfig.mode === 'demo' ? 'Log out of demo' : 'Log out'}
            variant="secondary"
            onPress={onLogout}
            loading={busy}
            disabled={busy}
            style={styles.logoutButton}
          />
        </Card>
      ) : null}
      {section === 'help' ? (
        <Card style={styles.profileDetailCard}>
          <Text style={styles.cardTitle}>Help & FAQs</Text>
          <Text style={styles.helpQuestion}>Are demo rates live?</Text>
          <Text style={styles.bodyText}>No. Demo rates and calculations are illustrative and do not represent a live market quote.</Text>
          <Text style={styles.helpQuestion}>Do demo actions move money or metal?</Text>
          <Text style={styles.bodyText}>No. Demo confirmations create temporary local records only.</Text>
          <Text style={styles.helpQuestion}>How can I contact support?</Text>
          <Text style={styles.bodyText}>Support contact details are not configured in this project.</Text>
        </Card>
      ) : null}
    </>
  );
}

function BackendSetupScreen({ onLogout, busy }) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <View style={styles.setupContent}>
        <Brand />
        <Text style={styles.pageTitle}>Backend connection required</Text>
        <Notice type="warning" style={styles.formNotice}>
          Backend mode is active. The proposed API routes and response contracts have not been confirmed or connected to these screens.
        </Notice>
        <Card style={styles.formCard}>
          <Text style={styles.cardTitle}>No customer data loaded</Text>
          <Text style={styles.bodyText}>
            Demo rates, balances, notifications, and transaction history are intentionally hidden in backend mode. No financial action is available until the customer API is implemented and verified.
          </Text>
        </Card>
        <Button
          title="Log out"
          variant="secondary"
          onPress={onLogout}
          loading={busy}
          disabled={busy}
        />
      </View>
    </SafeAreaView>
  );
}

function SummaryRow({ label, value }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

export default function App() {
  const [screen, setScreen] = useState('login');
  const [tab, setTab] = useState('home');
  const [quickBuyMetalId, setQuickBuyMetalId] = useState('gold');
  const [quickBuyExpanded, setQuickBuyExpanded] = useState(false);
  const [quickBuyScrollRequest, setQuickBuyScrollRequest] = useState(0);
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [action, setAction] = useState('');
  const [actionDraft, setActionDraft] = useState(null);
  const [reviewOrder, setReviewOrder] = useState(null);
  const [customerName, setCustomerName] = useState('Demo customer');
  const [demoHoldings, setDemoHoldings] = useState(() => ({
    ...demoPortfolio,
    goldInvested: 0,
    silverInvested: 0,
    platinumInvested: 0,
  }));
  const [transactions, setTransactions] = useState([]);
  const [backendRates, setBackendRates] = useState({ items: [], loading: false, error: '' });
  const [backendActivities, setBackendActivities] = useState({ items: [], loading: false, error: '' });
  const [backendPortfolio, setBackendPortfolio] = useState({ data: null, loading: false, error: '' });
  const [backendRefreshKey, setBackendRefreshKey] = useState(null);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [selectedRate, setSelectedRate] = useState(demoRates[0]);
  const [profileSection, setProfileSection] = useState('account');
  const confirmationStarted = useRef(false);
  const scrollViewRef = useRef(null);
  const quickBuyOffset = useRef(0);

  useEffect(() => {
    if (!quickBuyExpanded || screen !== 'app' || tab !== 'home' || quickBuyScrollRequest === 0) return undefined;
    const frame = requestAnimationFrame(() => {
      scrollViewRef.current?.scrollTo({
        y: Math.max(0, quickBuyOffset.current - 12),
        animated: true,
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [quickBuyExpanded, quickBuyScrollRequest, screen, tab]);

  const startBackendRefresh = useCallback(() => {
    if (apiConfig.mode !== 'backend') return;
    setBackendRates({ items: [], loading: true, error: '' });
    setBackendActivities({ items: [], loading: true, error: '' });
    setBackendPortfolio({ data: null, loading: true, error: '' });
    setBackendRefreshKey((current) => (current === null ? 0 : current + 1));
  }, []);

  const clearBackendData = useCallback(() => {
    setBackendRates({ items: [], loading: false, error: '' });
    setBackendActivities({ items: [], loading: false, error: '' });
    setBackendPortfolio({ data: null, loading: false, error: '' });
    setBackendRefreshKey(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearBackendData();
      setScreen('login');
      setTab('home');
      setOtp('');
      setError('Your session expired. Please sign in again.');
    });
    return () => setUnauthorizedHandler(null);
  }, [clearBackendData]);

  useEffect(() => {
    if (screen !== 'otp') return undefined;
    const timer = setInterval(() => setResendSeconds((remaining) => Math.max(remaining - 1, 0)), 1000);
    return () => clearInterval(timer);
  }, [screen]);

  useEffect(() => {
    if (backendRefreshKey === null || apiConfig.mode !== 'backend') return undefined;
    let active = true;

    Promise.allSettled([
      fetchRates(),
      fetchTransactions({ limit: 20 }),
      fetchPortfolio(),
    ]).then(([ratesResult, activitiesResult, portfolioResult]) => {
      if (!active) return;
      if (ratesResult.status === 'fulfilled') {
        try {
          const items = getResponseCollection(ratesResult.value, ['rates', 'items'], 'rates')
            .map(normalizeBackendRate)
            .filter(Boolean)
            .sort((left, right) => (
              demoRates.findIndex((rate) => rate.id === left.id)
              - demoRates.findIndex((rate) => rate.id === right.id)
            ));
          const completeMetalList = demoRates.map((configuredMetal) => (
            items.find((rate) => rate.id === configuredMetal.id)
            || {
              id: configuredMetal.id,
              metal: configuredMetal.metal,
              purity: '',
              ratePerGram: null,
              source: 'Backend',
            }
          ));
          setBackendRates({ items: completeMetalList, loading: false, error: '' });
        } catch (loadError) {
          setBackendRates({ items: [], loading: false, error: loadError.message });
        }
      } else {
        setBackendRates({ items: [], loading: false, error: ratesResult.reason?.message || 'Could not load metal rates.' });
      }
      if (activitiesResult.status === 'fulfilled') {
        try {
          const items = getResponseCollection(
            activitiesResult.value,
            ['transactions', 'activities', 'items', 'events'],
            'transaction history',
          ).map(normalizeBackendActivity);
          setBackendActivities({ items: sortActivitiesByDate(items), loading: false, error: '' });
        } catch (loadError) {
          setBackendActivities({ items: [], loading: false, error: loadError.message });
        }
      } else {
        setBackendActivities({
          items: [],
          loading: false,
          error: activitiesResult.reason?.message || 'Could not load recent activity.',
        });
      }
      if (portfolioResult.status === 'fulfilled') {
        try {
          const data = normalizeBackendPortfolio(portfolioResult.value);
          setBackendPortfolio({ data, loading: false, error: '' });
        } catch (loadError) {
          setBackendPortfolio({ data: null, loading: false, error: loadError.message });
        }
      } else {
        setBackendPortfolio({
          data: null,
          loading: false,
          error: portfolioResult.reason?.message || 'Could not load savings data.',
        });
      }
    });
    return () => { active = false; };
  }, [backendRefreshKey]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (screen === 'login' || screen === 'otp') return false;
      if (screen === 'app') {
        if (tab !== 'home') {
          setTab('home');
          return true;
        }
        return false;
      }
      if (screen === 'review') {
        setScreen('action');
        return true;
      }
      if (screen === 'transaction') setTab('activity');
      if (screen === 'profileDetail') setTab('account');
      if (screen === 'statements' || screen === 'metalDetails' || screen === 'action' || screen === 'result') {
        setTab('home');
      }
      setScreen('app');
      return true;
    });
    return () => subscription.remove();
  }, [screen, tab]);

  const handleContinue = async () => {
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      setError(mobile ? 'Enter a valid 10-digit Indian mobile number.' : 'Enter your 10-digit Indian mobile number.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await requestOtp(mobile);
      setOtp('');
      setResendSeconds(30);
      setScreen('otp');
    } catch (requestError) {
      setError(requestError.message || 'Could not request a verification code.');
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async () => {
    if (!/^\d{6}$/.test(otp)) {
      setError('Enter the complete six-digit code.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await verifyOtp(mobile, otp);
      if (!result.verified) {
        setError('That demo code is incorrect. Check the code and try again.');
        return;
      }
      setCustomerName(result.profile && result.profile.name ? result.profile.name : demoProfile(mobile).name);
      setTab('home');
      startBackendRefresh();
      setScreen('app');
    } catch (verificationError) {
      setError(verificationError.message || 'Could not verify this code.');
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    setBusy(true);
    setError('');
    try {
      await requestOtp(mobile);
      setOtp('');
      setResendSeconds(30);
    } catch (requestError) {
      setError(requestError.message || 'Could not resend the code.');
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    setBusy(true);
    setError('');
    let logoutErrorMessage = '';
    try {
      await logout();
    } catch (logoutError) {
      logoutErrorMessage = logoutError.message || 'Could not end the session.';
    } finally {
      clearBackendData();
      setScreen('login');
      setTab('home');
      setMobile('');
      setOtp('');
      setCustomerName('Demo customer');
      setDemoHoldings({ ...demoPortfolio, goldInvested: 0, silverInvested: 0, platinumInvested: 0 });
      setTransactions([]);
      setSelectedTransaction(null);
      setError(logoutErrorMessage);
      setBusy(false);
    }
  };

  const confirmLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => { void handleLogout(); } },
    ]);
  };

  const openAction = (nextAction, draft = null) => {
    if (nextAction === 'portfolio') {
      setTab('savings');
      setScreen('app');
      return;
    }
    confirmationStarted.current = false;
    setAction(nextAction);
    setActionDraft(draft);
    setReviewOrder(null);
    setScreen('action');
  };

  const confirmDemoAction = () => {
    if (confirmationStarted.current || !reviewOrder) return;
    confirmationStarted.current = true;

    const now = new Date();
    demoTransactionSequence += 1;
    const transaction = {
      ...reviewOrder,
      id: `DEMO-${now.getTime()}-${demoTransactionSequence.toString(36)}`,
      type: reviewOrder.action,
      amount: Math.round(reviewOrder.amount * 100) / 100,
      quantity: Number(reviewOrder.quantity.toFixed(6)),
      createdAt: now.toISOString(),
      status: ['buy', 'sell', 'redeem'].includes(reviewOrder.action)
        ? 'Demo successful'
        : 'Demo created',
    };

    if (reviewOrder.action === 'buy') {
      setDemoHoldings((current) => ({
        ...current,
        [`${reviewOrder.metal}Grams`]: Number(
          (current[`${reviewOrder.metal}Grams`] + transaction.quantity).toFixed(6),
        ),
        totalInvested: Math.round((current.totalInvested + transaction.amount) * 100) / 100,
        [`${reviewOrder.metal}Invested`]: Math.round(
          (current[`${reviewOrder.metal}Invested`] + transaction.amount) * 100,
        ) / 100,
      }));
    }
    if (reviewOrder.action === 'sell' || reviewOrder.action === 'redeem') {
      const gramsField = `${reviewOrder.metal}Grams`;
      const investedField = `${reviewOrder.metal}Invested`;
      setDemoHoldings((current) => {
        const remainingGrams = Math.max(0, Number((current[gramsField] - transaction.quantity).toFixed(6)));
        const remainingInvestment = current[gramsField] > 0
          ? current[investedField] * (remainingGrams / current[gramsField])
          : 0;
        const investedReduction = current[investedField] - remainingInvestment;
        return {
          ...current,
          [gramsField]: remainingGrams,
          [investedField]: Math.round(remainingInvestment * 100) / 100,
          totalInvested: Math.max(0, Math.round((current.totalInvested - investedReduction) * 100) / 100),
        };
      });
    }
    setTransactions((current) => [transaction, ...current]);
    setReviewOrder(transaction);
    setScreen('result');
  };

  const backendRatesItems = apiConfig.mode === 'backend' ? backendRates.items : demoRates;
  const activityItems = apiConfig.mode === 'backend'
    ? backendActivities.items
    : sortActivitiesByDate(transactions);
  const onOpenHelp = () => {
    setProfileSection('help');
    setTab('account');
    setScreen('profileDetail');
  };
  const onOpenNotifications = () => {
    setTab('notifications');
    setScreen('app');
  };
  const retryBackendData = startBackendRefresh;
  const draftBuyMetal = action === 'buy'
    ? demoRates.find((metal) => metal.id === actionDraft?.metal)?.metal || 'Gold'
    : null;
  const headerTitle = screen === 'app'
    ? ({ home: '', savings: 'Savings', activity: 'Transaction History', account: 'Account', notifications: 'Notifications' }[tab] || 'DigiGold')
    : screen === 'action'
      ? (action === 'buy'
        ? `Buy ${draftBuyMetal}`
        : ({ sell: 'Sell Metal', redeem: 'Redeem Metal', sip: 'Start SIP', gift: 'Gift Gold' }[action] || 'DigiGold'))
      : screen === 'review'
        ? 'Review Transaction'
        : screen === 'result'
          ? 'Transaction Result'
          : screen === 'transaction'
            ? 'Transaction Details'
            : screen === 'profileDetail'
              ? profileSections.find((section) => section.id === profileSection)?.title || 'Account'
              : screen === 'metalDetails'
                ? selectedRate.metal
                : 'Bill Statements';

  if (screen === 'login') {
    return (
      <LoginScreen
        mobile={mobile}
        setMobile={(value) => { setMobile(value); setError(''); }}
        error={error}
        busy={busy}
        onContinue={handleContinue}
      />
    );
  }
  if (screen === 'otp') {
    return (
      <OtpScreen
        mobile={mobile}
        otp={otp}
        setOtp={(value) => { setOtp(value); setError(''); }}
        error={error}
        busy={busy}
        seconds={resendSeconds}
        onVerify={handleVerify}
        onResend={handleResend}
        onBack={() => { setScreen('login'); setOtp(''); setError(''); setResendSeconds(0); }}
      />
    );
  }
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        {screen === 'app' ? (
          <ScrollView
            ref={scrollViewRef}
            contentContainerStyle={styles.screenContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {tab !== 'home' ? (
              <DigiGoldHeader
                title={headerTitle}
                onNotifications={onOpenNotifications}
                onSupport={onOpenHelp}
              />
            ) : null}
            {tab === 'home' ? (
              <HomeScreen
                name={customerName}
                onOpenAction={openAction}
                onSupport={onOpenHelp}
                onSelectTab={setTab}
                onRateSelect={(rate) => {
                  setQuickBuyMetalId(rate.id);
                  setQuickBuyExpanded(true);
                  setQuickBuyScrollRequest((request) => request + 1);
                }}
                onQuickBuyLayout={(event) => { quickBuyOffset.current = event.nativeEvent.layout.y; }}
                quickBuyMetalId={quickBuyMetalId}
                quickBuyExpanded={quickBuyExpanded}
                onQuickBuyToggle={() => setQuickBuyExpanded((expanded) => !expanded)}
                rates={backendRatesItems}
                ratesLoading={apiConfig.mode === 'backend' && backendRates.loading}
                ratesError={apiConfig.mode === 'backend' ? backendRates.error : ''}
                onRetryRates={retryBackendData}
                activities={activityItems}
                activitiesLoading={apiConfig.mode === 'backend' && backendActivities.loading}
                activitiesError={apiConfig.mode === 'backend' ? backendActivities.error : ''}
                onRetryActivities={retryBackendData}
                onQuickBuy={({ metalId, mode, value }) => openAction('buy', {
                  metal: metalId,
                  mode,
                  value,
                })}
              />
            ) : null}
            {tab === 'savings' ? (
              <SavingsScreen
                portfolio={apiConfig.mode === 'demo' ? demoHoldings : backendPortfolio.data}
                rates={backendRatesItems}
                loading={apiConfig.mode === 'backend' && backendPortfolio.loading}
                error={apiConfig.mode === 'backend' ? backendPortfolio.error : ''}
                onRetry={retryBackendData}
              />
            ) : null}
            {tab === 'activity' ? (
              <ActivityScreen
                transactions={activityItems}
                mode={apiConfig.mode}
                loading={apiConfig.mode === 'backend' && backendActivities.loading}
                error={apiConfig.mode === 'backend' ? backendActivities.error : ''}
                onRetry={retryBackendData}
                onTransactionPress={(transaction) => { setSelectedTransaction(transaction); setScreen('transaction'); }}
              />
            ) : null}
            {tab === 'notifications' ? <NotificationsScreen /> : null}
            {tab === 'account' ? (
              <ProfileScreen
                onOpenSection={(section) => { setProfileSection(section); setScreen('profileDetail'); }}
                onLogout={confirmLogout}
              />
            ) : null}
          </ScrollView>
        ) : screen === 'statements' ? (
          <ScrollView contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
            <DigiGoldHeader title={headerTitle} onNotifications={onOpenNotifications} onSupport={onOpenHelp} />
            <StatementsScreen />
          </ScrollView>
        ) : screen === 'metalDetails' ? (
          <ScrollView contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
            <DigiGoldHeader title={headerTitle} onNotifications={onOpenNotifications} onSupport={onOpenHelp} />
            <MetalDetailsScreen
              rate={selectedRate}
              onBuy={apiConfig.mode === 'demo'
                ? (metalId) => openAction('buy', { metal: metalId, mode: 'amount', value: '' })
                : undefined}
            />
          </ScrollView>
        ) : screen === 'profileDetail' ? (
          <ScrollView contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
            <DigiGoldHeader title={headerTitle} onNotifications={onOpenNotifications} onSupport={onOpenHelp} />
            <ProfileDetailScreen
              section={profileSection}
              mobile={mobile}
              name={customerName}
              onLogout={confirmLogout}
              busy={busy}
              error={error}
            />
          </ScrollView>
        ) : screen === 'transaction' ? (
          <ScrollView contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
            <DigiGoldHeader title={headerTitle} onNotifications={onOpenNotifications} onSupport={onOpenHelp} />
            {selectedTransaction ? (
              <TransactionDetails
                transaction={selectedTransaction}
              />
            ) : null}
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={styles.screenContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <DigiGoldHeader title={headerTitle} onNotifications={onOpenNotifications} onSupport={onOpenHelp} />
            {screen === 'action' ? (
              <ActionScreen
                action={action}
                portfolio={demoHoldings}
                initialOrder={reviewOrder || actionDraft}
                onReview={(order) => { setReviewOrder(order); setScreen('review'); }}
              />
            ) : null}
            {screen === 'review' ? (
              <ReviewScreen
                order={reviewOrder}
                onBack={() => setScreen('action')}
                onConfirm={confirmDemoAction}
              />
            ) : null}
            {screen === 'result' ? (
              <ResultScreen
                transaction={reviewOrder}
                onViewActivity={() => { setTab('activity'); setScreen('app'); }}
                onHome={() => { setTab('home'); setScreen('app'); }}
              />
            ) : null}
          </ScrollView>
        )}
      </KeyboardAvoidingView>
      <BottomNavigation
        selected={screen === 'transaction'
          ? 'activity'
          : screen === 'profileDetail'
            ? 'account'
            : screen === 'statements'
              ? 'home'
              : tab === 'notifications'
                ? 'home'
                : tab}
        onSelect={(nextTab) => { setTab(nextTab); setScreen('app'); }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { backgroundColor: colors.background, flex: 1 },
  authScroll: { flexGrow: 1, justifyContent: 'center', padding: 24, paddingBottom: 32 },
  authIntro: { marginBottom: 22, marginTop: 44 },
  eyebrow: { color: colors.goldDark, fontSize: 10, fontWeight: '900', letterSpacing: 1.3, marginBottom: 9 },
  authTitle: { color: colors.text, fontSize: 28, fontWeight: '900', letterSpacing: -0.5, marginBottom: 8 },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  authCard: { padding: 18 },
  phoneInput: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 11,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 12,
    paddingHorizontal: 13,
    minHeight: 52,
  },
  phoneInputError: { borderColor: colors.error },
  prefixText: { color: colors.text, fontSize: 12, fontWeight: '800' },
  prefixDivider: { backgroundColor: colors.border, height: 21, marginHorizontal: 11, width: 1 },
  mobileInput: { color: colors.text, flex: 1, fontSize: 14, minWidth: 0, paddingVertical: 0 },
  centerHelper: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 12, textAlign: 'center' },
  authNotice: { marginTop: 18 },
  authDisclaimer: { color: colors.muted, fontSize: 10, lineHeight: 15, marginHorizontal: 8, marginTop: 18, textAlign: 'center' },
  backLink: { alignSelf: 'flex-start', justifyContent: 'center', marginBottom: 18, minHeight: 44, paddingRight: 12 },
  backLinkText: { color: colors.primary, fontSize: 14, fontWeight: '800' },
  smallMuted: { color: colors.muted, fontSize: 12 },
  resendRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'center', marginTop: 17 },
  resendText: { color: colors.primary, fontSize: 12, fontWeight: '800', paddingVertical: 6 },
  disabledText: { color: colors.muted },
  screenContent: { paddingBottom: 24, paddingHorizontal: 20, paddingTop: 16 },
  setupContent: { flex: 1, justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 19 },
  headerCopy: { flex: 1 },
  greeting: { color: colors.text, fontSize: 21, fontWeight: '900', marginTop: 15 },
  headerButtons: { alignItems: 'center', flexDirection: 'row', marginLeft: 8 },
  headerIconButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    marginLeft: 8,
    position: 'relative',
    width: 44,
  },
  headerIcon: { color: colors.primary, fontSize: 20 },
  notificationDot: { backgroundColor: colors.gold, borderColor: colors.surface, borderRadius: 5, borderWidth: 1, height: 9, position: 'absolute', right: 8, top: 8, width: 9 },
  avatarButton: { backgroundColor: colors.lightMint },
  avatarLetter: { color: colors.primary, fontSize: 16, fontWeight: '900' },
  portfolioCard: { backgroundColor: colors.primary, borderRadius: 20, marginBottom: 24, overflow: 'hidden', padding: 18 },
  portfolioAccent: { backgroundColor: colors.gold, borderRadius: 2, height: 3, marginBottom: 12, width: 36 },
  portfolioEyebrow: { color: colors.onPrimary, fontSize: 11, fontWeight: '800', letterSpacing: 1.1, marginBottom: 7 },
  portfolioValue: { color: colors.surface, fontSize: 30, fontWeight: '900', marginTop: 10 },
  portfolioHelper: { color: colors.onPrimary, fontSize: 11, lineHeight: 17, marginTop: 6 },
  portfolioUnavailable: { color: colors.surface, fontSize: 17, fontWeight: '800', lineHeight: 23, marginTop: 10 },
  dashboardSavingsCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    elevation: 1,
    flexDirection: 'row',
    marginBottom: 16,
    padding: 14,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  dashboardCardPressed: { opacity: 0.86, transform: [{ scale: 0.99 }] },
  dashboardSavingsIcon: {
    alignItems: 'center',
    backgroundColor: colors.lightMint,
    borderRadius: 14,
    height: 46,
    justifyContent: 'center',
    marginRight: 12,
    width: 46,
  },
  dashboardSavingsCopy: { flex: 1, minWidth: 0 },
  dashboardCardTitle: { color: colors.text, fontSize: 15, fontWeight: '900', marginBottom: 5 },
  dashboardSavingsValue: { color: colors.primary, fontSize: 17, fontWeight: '900', marginTop: 7 },
  dashboardCardDescription: { color: colors.muted, fontSize: 10, lineHeight: 14, marginTop: 3 },
  dashboardSavingsAction: {
    alignItems: 'center',
    flexDirection: 'row',
    marginLeft: 5,
  },
  dashboardSavingsActionText: { color: colors.primary, fontSize: 10, fontWeight: '800' },
  statementCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    elevation: 1,
    flexDirection: 'row',
    marginBottom: 16,
    padding: 14,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  statementIcon: {
    alignItems: 'center',
    backgroundColor: colors.lightMint,
    borderRadius: 13,
    height: 42,
    justifyContent: 'center',
    marginRight: 11,
    width: 42,
  },
  statementCopy: { flex: 1, minWidth: 0 },
  statementEmpty: { color: colors.muted, fontSize: 10, lineHeight: 14, marginTop: 5 },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', marginBottom: 20 },
  exploreSectionDescription: { color: colors.muted, fontSize: 12, lineHeight: 18, marginBottom: 12, marginTop: -6 },
  actionCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 15,
    borderWidth: 1,
    elevation: 1,
    minHeight: 132,
    overflow: 'hidden',
    padding: 12,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  actionCardPressed: {
    elevation: 0,
    borderColor: colors.primary,
    opacity: 0.92,
    shadowOpacity: 0,
    transform: [{ scale: 0.985 }],
  },
  actionCardDisabled: { opacity: 0.7 },
  actionArt: {
    alignItems: 'center',
    alignSelf: 'center',
    borderRadius: 11,
    height: 40,
    justifyContent: 'center',
    marginBottom: 8,
    width: 40,
  },
  actionCardFooter: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionCardCopy: { flex: 1, paddingRight: 5 },
  actionArrow: {
    alignItems: 'center',
    borderRadius: 12,
    height: 28,
    justifyContent: 'center',
    marginLeft: 4,
    width: 24,
  },
  actionArrowText: { color: colors.muted, fontSize: 20, fontWeight: '600', lineHeight: 24 },
  actionTitle: { color: colors.text, fontSize: 14, fontWeight: '900', textAlign: 'center' },
  actionDetail: { color: colors.muted, fontSize: 10, lineHeight: 14, marginTop: 3 },
  ratesDisclosure: { color: colors.muted, fontSize: 10, marginBottom: 9, marginTop: -6 },
  rateGrid: { alignItems: 'stretch', flexDirection: 'row', marginBottom: 14 },
  metalRateCard: {
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    elevation: 1,
    flexShrink: 0,
    marginBottom: 2,
    marginRight: 8,
    minHeight: 128,
    padding: 8,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    width: 136,
  },
  metalRateCardCompact: { alignItems: 'center', minHeight: 122, paddingHorizontal: 5, paddingVertical: 7 },
  metalRateCardSelected: { borderBottomColor: colors.gold, borderBottomWidth: 3, borderColor: colors.primary },
  metalRateCardPressed: {
    backgroundColor: colors.softTeal,
    borderColor: colors.primary,
    borderWidth: 2,
    elevation: 0,
    transform: [{ scale: 0.98 }],
  },
  metalIcon: { alignItems: 'center', borderRadius: 12, height: 38, justifyContent: 'center', marginBottom: 6, width: 38 },
  metalIconCompact: { borderRadius: 10, height: 30, marginBottom: 4, width: 30 },
  metalIcon_gold: { backgroundColor: colors.goldLight },
  metalIcon_silver: { backgroundColor: colors.silverSurface },
  metalIcon_platinum: { backgroundColor: colors.platinumSurface },
  ratePerGram: { color: colors.muted, fontSize: 10, marginTop: 2 },
  ratePurity: { color: colors.muted, fontSize: 10, marginTop: 4 },
  ratePrice: { color: colors.text, fontSize: 16, fontWeight: '900', marginTop: 7 },
  rateName: { color: colors.text, fontSize: 13, fontWeight: '800' },
  rateNameCompact: { fontSize: 11, textAlign: 'center' },
  ratePriceCompact: { fontSize: 12, marginTop: 5, textAlign: 'center' },
  rateTextCompact: { fontSize: 9, textAlign: 'center' },
  dataLoading: { alignItems: 'center', flexDirection: 'row', gap: 10, justifyContent: 'center', minHeight: 70 },
  dataLoadingText: { color: colors.muted, fontSize: 12 },
  dataError: { backgroundColor: colors.errorBackground, borderRadius: 12, marginBottom: 12, padding: 12 },
  dataErrorText: { color: colors.error, fontSize: 12, lineHeight: 18 },
  retryLink: { alignSelf: 'flex-start', marginTop: 7, paddingVertical: 4 },
  retryLinkText: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  recentActivitySection: { marginTop: 3 },
  recentActivityCard: { marginBottom: 16, paddingHorizontal: 12 },
  recentActivityRow: { alignItems: 'center', flexDirection: 'row', minHeight: 68, paddingVertical: 10 },
  recentActivityRowCompact: { minHeight: 72 },
  recentActivityIcon: { alignItems: 'center', borderRadius: 12, height: 36, justifyContent: 'center', marginRight: 10, width: 36 },
  recentActivityCopy: { flex: 1, minWidth: 0 },
  recentActivityTitle: { color: colors.text, fontSize: 12, fontWeight: '800' },
  recentActivityDetails: { color: colors.muted, fontSize: 10, marginTop: 3 },
  recentActivityStatus: { color: colors.primary, fontSize: 10, fontWeight: '700', marginTop: 3 },
  recentActivityAmount: { color: colors.text, fontSize: 11, fontWeight: '800', marginLeft: 7, maxWidth: 88 },
  noRecentActivity: { color: colors.muted, fontSize: 12, marginBottom: 18, paddingVertical: 16, textAlign: 'center' },
  calculatorCard: { marginBottom: 18, padding: 16 },
  calculatorCardExpanded: { borderColor: colors.primary },
  calculatorHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 0, minHeight: 48 },
  calculatorHeaderExpanded: { marginBottom: 15 },
  calculatorHeaderPressed: { opacity: 0.78 },
  calculatorHeadingCopy: { flex: 1, paddingRight: 8 },
  calculatorHeaderActions: { alignItems: 'center', flexDirection: 'row', gap: 5 },
  calculatorTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  calculatorSubheading: { color: colors.muted, fontSize: 11, marginTop: 3 },
  quickBuySelectedMetal: { color: colors.primary, fontSize: 14, fontWeight: '900', marginBottom: 8 },
  quickBuyModeRow: {
    backgroundColor: colors.background,
    borderRadius: 12,
    flexDirection: 'row',
    marginBottom: 15,
    padding: 4,
  },
  quickBuyModeOption: { alignItems: 'center', borderRadius: 9, flex: 1, justifyContent: 'center', minHeight: 40, paddingHorizontal: 5 },
  quickBuyModeOptionSelected: { backgroundColor: colors.surface, elevation: 1 },
  quickBuyModeText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  quickBuyModeTextSelected: { color: colors.primary, fontWeight: '900' },
  quickBuyInputWrap: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 50,
    paddingHorizontal: 13,
  },
  quickBuyInputError: { borderColor: colors.error },
  quickBuyInput: { color: colors.text, flex: 1, fontSize: 15, minWidth: 0, paddingVertical: 10 },
  quickBuyInputUnit: { color: colors.muted, fontSize: 11, fontWeight: '700', marginLeft: 8 },
  quickBuyRateState: { alignItems: 'center', flexDirection: 'row', gap: 8, marginBottom: 13, minHeight: 42 },
  quickBuyNotice: { marginBottom: 12 },
  quickBuySummary: {
    backgroundColor: colors.background,
    borderRadius: 12,
    marginBottom: 12,
    paddingHorizontal: 12,
  },
  quickBuyTotal: { borderTopColor: colors.border, borderTopWidth: 1 },
  quickRate: { alignItems: 'center', backgroundColor: colors.background, borderRadius: 10, flexDirection: 'row', justifyContent: 'space-between', marginBottom: 13, padding: 11 },
  priceBreakdown: { backgroundColor: colors.background, borderRadius: 12, marginBottom: 14, paddingHorizontal: 12, paddingVertical: 4 },
  priceBreakdownCompact: { marginTop: 5 },
  priceBreakdownDivider: { backgroundColor: colors.border, height: 1, marginBottom: 3 },
  calculationNote: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 8 },
  calculatorHint: { marginBottom: 12 },
  detailNotice: { marginTop: 6 },
  rateRowBorder: { borderTopColor: colors.border, borderTopWidth: 1 },
  rateSymbol: { alignItems: 'center', backgroundColor: colors.goldLight, borderRadius: 12, height: 40, justifyContent: 'center', width: 40 },
  rateSymbolSilver: { backgroundColor: colors.lightMint },
  rateSymbolText: { color: colors.goldDark, fontSize: 12, fontWeight: '900' },
  rateSymbolSilverText: { color: colors.primary },
  rateInfo: { flex: 1, marginLeft: 11 },
  activityCard: { marginBottom: 16 },
  disclaimer: { marginBottom: 8 },
  bottomNav: {
    alignItems: 'stretch',
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 10,
    paddingTop: 5,
  },
  navItem: {
    alignItems: 'center',
    borderRadius: 12,
    flex: 1,
    justifyContent: 'center',
    marginHorizontal: 3,
    minHeight: 50,
    paddingHorizontal: 5,
  },
  navItemActive: { backgroundColor: colors.lightMint },
  navItemPressed: { opacity: 0.72, transform: [{ scale: 0.96 }] },
  navIcon: { marginBottom: 1 },
  navLabel: { color: colors.muted, fontSize: 10, marginTop: 1 },
  navLabelActive: { color: colors.primary, fontWeight: '800' },
  giftPageSubtitle: { color: colors.muted, fontSize: 12, lineHeight: 18, marginBottom: 14, marginTop: -8 },
  giftFormIcon: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.goldLight,
    borderRadius: 16,
    height: 48,
    justifyContent: 'center',
    marginBottom: 15,
    width: 48,
  },
  pageTitle: { color: colors.text, fontSize: 24, fontWeight: '900', marginBottom: 8 },
  screenDescription: { color: colors.muted, fontSize: 12, lineHeight: 18, marginBottom: 14 },
  actionPageDescription: { color: colors.muted, fontSize: 12, lineHeight: 18, marginBottom: 14, marginTop: -3 },
  sectionNotice: { marginBottom: 16 },
  investedCard: { marginBottom: 24, paddingHorizontal: 15, paddingVertical: 4 },
  summaryRow: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 11 },
  summaryLabel: { color: colors.muted, flex: 1, fontSize: 12 },
  summaryValue: { color: colors.text, flexShrink: 1, fontSize: 12, fontWeight: '800', textAlign: 'right' },
  filterLabel: { color: colors.muted, fontSize: 11, fontWeight: '700', marginBottom: 7 },
  transactionRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    minHeight: 76,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  transactionIcon: {
    alignItems: 'center',
    borderRadius: 13,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  transactionIconText: { fontSize: 18, fontWeight: '900' },
  transactionCopy: { flex: 1, marginLeft: 11, minWidth: 0 },
  transactionTitle: { color: colors.text, fontSize: 12, fontWeight: '800' },
  transactionSubtitle: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 3 },
  transactionStatus: { color: colors.primary, fontSize: 9, fontWeight: '800', marginTop: 3 },
  transactionMetaRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 3, paddingRight: 12 },
  transactionAmountWrap: { alignItems: 'flex-end', flexDirection: 'row', marginLeft: 5 },
  transactionAmount: { color: colors.text, fontSize: 11, fontWeight: '900' },
  transactionChevron: { color: colors.muted, fontSize: 17, marginLeft: 5 },
  transactionDetailHeading: { alignItems: 'center', flexDirection: 'row', marginBottom: 10 },
  profileIntro: { color: colors.muted, fontSize: 12, marginBottom: 12, marginTop: -8 },
  profileMenuCard: { marginBottom: 18, overflow: 'hidden', paddingHorizontal: 14 },
  profileMenuItem: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', minHeight: 76, paddingVertical: 10 },
  profileMenuIcon: { alignItems: 'center', backgroundColor: colors.lightMint, borderRadius: 12, height: 40, justifyContent: 'center', width: 40 },
  profileMenuIconText: { color: colors.primary, fontSize: 17, fontWeight: '800' },
  profileMenuCopy: { flex: 1, marginLeft: 12 },
  profileMenuTitle: { color: colors.text, fontSize: 13, fontWeight: '800' },
  profileMenuDetail: { color: colors.muted, fontSize: 10, marginTop: 4 },
  profileMenuChevron: { color: colors.muted, fontSize: 21, marginLeft: 8 },
  profileDetailCard: { marginBottom: 18, padding: 16 },
  savingsCard: { marginBottom: 22, paddingHorizontal: 15, paddingVertical: 5 },
  helpQuestion: { color: colors.text, fontSize: 13, fontWeight: '800', marginBottom: 5, marginTop: 15 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '900', marginBottom: 10 },
  bodyText: { color: colors.muted, fontSize: 12, lineHeight: 19 },
  logoutButton: { marginTop: 5 },
  formNotice: { marginBottom: 16 },
  formCard: { marginBottom: 20, padding: 16 },
  formLabel: { color: colors.text, fontSize: 13, fontWeight: '800', marginBottom: 9 },
  rateSummary: { alignItems: 'center', backgroundColor: colors.background, borderRadius: 11, flexDirection: 'row', justifyContent: 'space-between', marginBottom: 17, padding: 12 },
  inlineNotice: { marginBottom: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 15, rowGap: 8 },
  quickChip: { backgroundColor: colors.lightMint, borderRadius: 10, marginRight: 8, paddingHorizontal: 12, paddingVertical: 8 },
  quickChipText: { color: colors.primary, fontSize: 11, fontWeight: '800' },
  estimateBox: { backgroundColor: colors.lightMint, borderRadius: 12, marginBottom: 14, padding: 13 },
  estimateValue: { color: colors.primary, fontSize: 21, fontWeight: '900', marginTop: 5 },
  summaryFootnote: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 4 },
  formError: { color: colors.error, fontSize: 12, lineHeight: 18, marginBottom: 7 },
  formButton: { marginTop: 12 },
  spacer: { height: 10 },
  reviewHeader: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  reviewDivider: { backgroundColor: colors.border, height: 1, marginBottom: 14, marginTop: 4 },
  resultCard: { alignItems: 'center', padding: 22 },
  resultMark: { alignItems: 'center', backgroundColor: colors.successBackground, borderRadius: 26, height: 52, justifyContent: 'center', marginBottom: 13, width: 52 },
  resultMarkText: { color: colors.success, fontSize: 22, fontWeight: '900' },
  resultTitle: { color: colors.text, fontSize: 19, fontWeight: '900', marginBottom: 8, marginTop: 15 },
});
