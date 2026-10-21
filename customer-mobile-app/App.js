import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiConfig } from './src/config/apiConfig';
import { Button, Brand, Card, ChoiceRow, DemoBadge, EmptyState, Field, Notice, SectionTitle } from './src/components/UI';
import { demoNotifications, demoPortfolio, demoProfile, demoRates } from './src/services/demoData';
import { logout, requestOtp, setUnauthorizedHandler, verifyOtp } from './src/services/authService';
import { colors } from './src/theme';

const tabs = [
  { id: 'home', label: 'Home', icon: '⌂' },
  { id: 'portfolio', label: 'Portfolio', icon: '◈' },
  { id: 'activity', label: 'Activity', icon: '↔' },
  { id: 'profile', label: 'Profile', icon: '○' },
];

const actions = [
  { id: 'buy', title: 'Buy Gold', detail: 'Gold or silver', icon: '+' },
  { id: 'sell', title: 'Sell Gold', detail: 'Your holdings', icon: '↗' },
  { id: 'redeem', title: 'Redeem Gold', detail: 'Demo holdings', icon: '◇' },
  { id: 'sip', title: 'Start SIP', detail: 'Monthly saving', icon: '↻' },
  { id: 'gift', title: 'Gift Gold', detail: 'Local demo record', icon: '✧' },
  { id: 'portfolio', title: 'My Savings', detail: 'Portfolio & activity', icon: '◈' },
];

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

function Header({ name, onNotifications, onProfile }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerCopy}>
        <Brand compact />
        <Text style={styles.greeting}>Good day, {name}</Text>
        <Text style={styles.muted}>Your precious metals, in one place.</Text>
      </View>
      <View style={styles.headerButtons}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Open notifications"
          onPress={onNotifications}
          style={styles.headerIconButton}
        >
          <Text style={styles.headerIcon}>◉</Text>
          {demoNotifications.length ? <View style={styles.notificationDot} /> : null}
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Open profile"
          onPress={onProfile}
          style={[styles.headerIconButton, styles.avatarButton]}
        >
          <Text style={styles.avatarLetter}>{name.charAt(0).toUpperCase()}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function BottomNavigation({ selected, onSelect }) {
  return (
    <View style={styles.bottomNav}>
      {tabs.map((tab) => {
        const active = selected === tab.id;
        return (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            key={tab.id}
            onPress={() => onSelect(tab.id)}
            style={styles.navItem}
          >
            <Text style={[styles.navIcon, active && styles.navIconActive]}>{tab.icon}</Text>
            <Text style={[styles.navLabel, active && styles.navLabelActive]}>{tab.label}</Text>
          </TouchableOpacity>
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
            <Button title="Continue" onPress={onContinue} loading={busy} disabled={busy} />
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
            <Button title="Verify code" onPress={onVerify} loading={busy} disabled={busy} />
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

function PortfolioCard({ portfolio, onPress }) {
  const currentValue = (portfolio.goldGrams * demoRates[0].ratePerGram)
    + (portfolio.silverGrams * demoRates[1].ratePerGram);
  const content = (
    <View style={styles.portfolioCard}>
        <View style={styles.portfolioTop}>
          <View>
            <Text style={styles.portfolioEyebrow}>TOTAL PORTFOLIO VALUE</Text>
            <DemoBadge label="DEMO" />
          </View>
          <Text style={styles.portfolioSymbol}>Au</Text>
        </View>
        <Text style={styles.portfolioValue}>₹{Math.round(currentValue).toLocaleString('en-IN')}</Text>
        <Text style={styles.portfolioHelper}>Sample portfolio value · local demo only</Text>
        <View style={styles.portfolioDivider} />
        <View style={styles.holdingRow}>
          <View>
            <Text style={styles.holdingLabel}>Gold</Text>
            <Text style={styles.holdingValue}>{portfolio.goldGrams.toFixed(4)} g</Text>
          </View>
          <View style={styles.holdingSeparator} />
          <View>
            <Text style={styles.holdingLabel}>Silver</Text>
            <Text style={styles.holdingValue}>{portfolio.silverGrams.toFixed(4)} g</Text>
          </View>
          <Text style={styles.viewPortfolio}>View ›</Text>
        </View>
    </View>
  );
  return onPress ? (
    <TouchableOpacity accessibilityRole="button" activeOpacity={0.92} onPress={onPress}>
      {content}
    </TouchableOpacity>
  ) : content;
}

function HomeScreen({ name, onOpenAction, onSelectTab, portfolio, transactions, onTransactionPress }) {
  return (
    <>
      <Header
        name={name}
        onNotifications={() => onSelectTab('notifications')}
        onProfile={() => onSelectTab('profile')}
      />
      <View style={styles.promoBanner}>
        <View style={styles.promoCopy}>
          <Text style={styles.promoEyebrow}>GOLD, MADE SIMPLE</Text>
          <Text style={styles.promoTitle}>A smarter way to own gold</Text>
          <Text style={styles.promoBody}>Explore buying, selling, SIPs and gifting in one place.</Text>
        </View>
        <View style={styles.goldOrb}>
          <Text style={styles.goldOrbText}>Au</Text>
        </View>
        <View style={styles.bannerAccent} />
      </View>

      <PortfolioCard portfolio={portfolio} onPress={() => onSelectTab('portfolio')} />

      <SectionTitle title="Quick actions" />
      <View style={styles.actionsGrid}>
        {actions.map((action, index) => (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`${action.title}: ${action.detail}`}
            key={action.id}
            onPress={() => onOpenAction(action.id)}
            style={styles.actionCard}
          >
            <View style={[styles.actionMark, index % 2 === 0 && styles.actionMarkGold]}>
              <Text style={styles.actionSymbol}>{action.icon}</Text>
            </View>
            <Text style={styles.actionTitle}>{action.title}</Text>
            <Text style={styles.actionDetail}>{action.detail}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <SectionTitle title="Metal rates" />
      <Card style={styles.ratesCard}>
        <View style={styles.rateDemoLabel}>
          <DemoBadge />
          <Text style={styles.rateNote}>Indicative only · per gram</Text>
        </View>
        {demoRates.map((rate, index) => (
          <View key={rate.symbol} style={[styles.rateRow, index > 0 && styles.rateRowBorder]}>
            <View style={[styles.rateSymbol, index > 0 && styles.rateSymbolSilver]}>
              <Text style={[styles.rateSymbolText, index > 0 && styles.rateSymbolSilverText]}>{rate.symbol}</Text>
            </View>
            <View style={styles.rateInfo}>
              <Text style={styles.rateName}>{rate.metal}</Text>
              <Text style={styles.ratePurity}>{rate.purity} purity</Text>
            </View>
            <View style={styles.priceInfo}>
              <Text style={styles.ratePrice}>₹{rate.ratePerGram.toLocaleString('en-IN')}</Text>
              <Text style={styles.rateChange}>{rate.demoChange} sample move</Text>
            </View>
          </View>
        ))}
      </Card>

      <SectionTitle
        title={`Recent activity${transactions.length ? ` (${transactions.length})` : ''}`}
        action="View all"
        onAction={() => onSelectTab('activity')}
      />
      <Card style={styles.activityCard}>
        {transactions.length === 0 ? (
          <EmptyState
            title="No demo activity yet"
            body="After you confirm a local demo action, its record will appear here. Nothing is sent to the backend."
            symbol="↔"
          />
        ) : (
          transactions.slice(0, 3).map((transaction) => (
            <TransactionRow
              key={transaction.id}
              transaction={transaction}
              onPress={() => onTransactionPress(transaction)}
            />
          ))
        )}
      </Card>
      <Notice type="warning" style={styles.disclaimer}>
        Sample rates and local demo records only. Nothing is sent to the backend and no real ownership, payment, purchase, sale, redemption, or transfer occurs.
      </Notice>
    </>
  );
}

function ActionScreen({ action, portfolio, initialOrder, onBack, onReview }) {
  const [metal, setMetal] = useState(initialOrder?.metal || 'gold');
  const [mode, setMode] = useState(initialOrder?.mode || 'amount');
  const [value, setValue] = useState(initialOrder ? String(initialOrder.value) : '');
  const [recipientName, setRecipientName] = useState(initialOrder?.recipientName || '');
  const [recipient, setRecipient] = useState(initialOrder?.recipient || '');
  const [message, setMessage] = useState(initialOrder?.message || '');
  const [startDate, setStartDate] = useState(initialOrder?.startDate || '');
  const [frequency, setFrequency] = useState(initialOrder?.frequency || 'monthly');
  const [error, setError] = useState('');
  const rate = demoRates.find((item) => item.metal.toLowerCase().startsWith(metal))?.ratePerGram || 0;
  const availableGrams = metal === 'gold' ? portfolio.goldGrams : portfolio.silverGrams;
  const numericValue = Number(value);
  const quantity = action === 'sell' || action === 'redeem'
    ? numericValue
    : mode === 'grams' ? numericValue : numericValue / rate;
  const amount = action === 'sell' || action === 'redeem'
    ? numericValue * rate
    : mode === 'amount' ? numericValue : numericValue * rate;
  const title = { buy: 'Buy gold or silver', sell: 'Sell gold or silver', redeem: 'Redeem gold', sip: 'Monthly SIP', gift: 'Gift gold or silver' }[action] || 'Action';

  const review = () => {
    setError('');
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      setError('Enter an amount or quantity greater than zero.');
      return;
    }
    const roundedQuantity = Number(quantity.toFixed(4));
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
    });
  };

  return (
    <>
      <TouchableOpacity accessibilityRole="button" onPress={onBack} style={styles.backLink}>
        <Text style={styles.backLinkText}>‹  Back</Text>
      </TouchableOpacity>
      <Text style={styles.pageTitle}>{title}</Text>
      <Notice type="warning" style={styles.formNotice}>
        LOCAL DEMO · Confirming creates an in-memory sample record only. Nothing is submitted or charged.
      </Notice>

      {action === 'buy' || action === 'sell' || action === 'redeem' ? (
        <Card style={styles.formCard}>
          {action !== 'redeem' ? (
            <>
              <Text style={styles.formLabel}>Choose metal</Text>
              <ChoiceRow
                accessibilityLabel="Choose metal"
                options={[{ label: 'Gold 24K', value: 'gold' }, { label: 'Silver', value: 'silver' }]}
                value={metal}
                onChange={(next) => { setMetal(next); setValue(''); setError(''); }}
              />
            </>
          ) : (
            <View style={styles.rateSummary}>
              <Text style={styles.summaryLabel}>Metal</Text>
              <Text style={styles.summaryValue}>Gold 24K</Text>
            </View>
          )}
          <View style={styles.rateSummary}>
            <Text style={styles.summaryLabel}>Illustrative rate</Text>
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
              />
              {numericValue > 0 ? (
                <View style={styles.estimateBox}>
                  <Text style={styles.summaryLabel}>Estimated demo {action === 'sell' ? 'proceeds' : 'value'}</Text>
                  <Text style={styles.estimateValue}>₹{Math.round(amount).toLocaleString('en-IN')}</Text>
                </View>
              ) : null}
            </>
          ) : (
            <>
              <Text style={styles.formLabel}>Buy by</Text>
              <ChoiceRow
                options={[{ label: 'Amount', value: 'amount' }, { label: 'Grams', value: 'grams' }]}
                value={mode}
                onChange={(next) => { setMode(next); setValue(''); setError(''); }}
              />
              <Field
                label={mode === 'amount' ? 'Demo purchase amount (₹)' : 'Demo quantity (grams)'}
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
              {numericValue > 0 ? (
                <View style={styles.estimateBox}>
                  <Text style={styles.summaryLabel}>
                    {mode === 'amount' ? 'Estimated quantity' : 'Estimated amount'}
                  </Text>
                  <Text style={styles.estimateValue}>
                    {mode === 'amount'
                      ? `${Number.isFinite(quantity) ? quantity.toFixed(4) : '0.0000'} g`
                      : `₹${Math.round(amount).toLocaleString('en-IN')}`}
                  </Text>
                  <Text style={styles.summaryFootnote}>Illustrative demo estimate · not a live price</Text>
                </View>
              ) : null}
            </>
          )}
          {error ? <Text style={styles.formError}>{error}</Text> : null}
          <Button
            title={action === 'buy' ? 'Review demo purchase' : action === 'sell' ? 'Review demo sale' : 'Review demo redemption'}
            onPress={review}
            disabled={availableGrams <= 0 && (action === 'sell' || action === 'redeem')}
            style={styles.formButton}
          />
        </Card>
      ) : null}

      {action === 'sip' ? (
        <Card style={styles.formCard}>
          <Text style={styles.formLabel}>Metal (demo selection)</Text>
          <ChoiceRow
            options={[{ label: 'Gold', value: 'gold' }, { label: 'Silver', value: 'silver' }]}
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
          />
          <Notice style={styles.inlineNotice}>
            Demo plan only. No mandate or recurring payment is set up. Estimated quantity is not a commitment.
          </Notice>
          {numericValue > 0 ? (
            <View style={styles.estimateBox}>
              <Text style={styles.summaryLabel}>Estimated quantity at sample rate</Text>
              <Text style={styles.estimateValue}>{Number((numericValue / rate).toFixed(4))} g</Text>
            </View>
          ) : null}
          {error ? <Text style={styles.formError}>{error}</Text> : null}
          <Button title="Review demo SIP" onPress={review} style={styles.formButton} />
        </Card>
      ) : null}

      {action === 'gift' ? (
        <Card style={styles.formCard}>
          <Text style={styles.formLabel}>Metal (demo selection)</Text>
          <ChoiceRow
            options={[{ label: 'Gold', value: 'gold' }, { label: 'Silver', value: 'silver' }]}
            value={metal}
            onChange={(next) => { setMetal(next); setError(''); }}
          />
          <Text style={styles.formLabel}>Gift by</Text>
          <ChoiceRow
            options={[{ label: 'Amount', value: 'amount' }, { label: 'Grams', value: 'grams' }]}
            value={mode}
            onChange={(next) => { setMode(next); setValue(''); setError(''); }}
          />
          <Field
            label={mode === 'amount' ? 'Demo gift amount (₹)' : 'Demo gift quantity (grams)'}
            value={value}
            onChangeText={(next) => { setValue(sanitizeDecimalInput(next)); setError(''); }}
            placeholder={mode === 'amount' ? 'e.g. 500' : 'e.g. 0.250'}
            keyboardType="decimal-pad"
          />
          <Field
            label="Recipient name"
            value={recipientName}
            onChangeText={(next) => { setRecipientName(next); setError(''); }}
            placeholder="Name for demo record"
            maxLength={60}
          />
          <Field
            label="Recipient mobile number"
            value={recipient}
            onChangeText={(next) => { setRecipient(next.replace(/\D/g, '').slice(0, 10)); setError(''); }}
            placeholder="10-digit mobile number"
            keyboardType="number-pad"
            maxLength={10}
          />
          <Field
            label="Optional message"
            value={message}
            onChangeText={setMessage}
            placeholder="Add a short note"
            maxLength={100}
          />
          <Notice style={styles.inlineNotice}>
            Creates a local demo history record only. No gift will be sent or delivered.
          </Notice>
          {numericValue > 0 ? (
            <View style={styles.estimateBox}>
              <Text style={styles.summaryLabel}>Estimated quantity</Text>
              <Text style={styles.estimateValue}>{quantity.toFixed(4)} g</Text>
            </View>
          ) : null}
          {error ? <Text style={styles.formError}>{error}</Text> : null}
          <Button title="Review demo gift" onPress={review} style={styles.formButton} />
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
      <Text style={styles.pageTitle}>Review {displayTitle.toLowerCase()}</Text>
      <Notice type="warning" style={styles.formNotice}>
        FINAL DEMO REVIEW · Confirming adds a local in-memory demo record only. No request is sent.
      </Notice>
      <Card style={styles.formCard}>
        <View style={styles.reviewHeader}>
          <Text style={styles.cardTitle}>{displayTitle} summary</Text>
          <DemoBadge label="LOCAL DEMO" />
        </View>
        <SummaryRow label="Metal" value={order.metal === 'gold' ? 'Gold 24K' : 'Silver'} />
        {order.action === 'buy' || order.action === 'gift' || order.action === 'sell' || order.action === 'redeem' ? (
          <SummaryRow
            label={order.action === 'sell' ? 'Estimated demo proceeds' : order.action === 'redeem' ? 'Estimated demo value' : 'Illustrative amount'}
            value={`₹${Math.round(order.amount).toLocaleString('en-IN')}`}
          />
        ) : order.action === 'sip' ? (
          <SummaryRow
            label={`Demo investment amount (${order.frequency})`}
            value={`₹${Number(order.value).toLocaleString('en-IN')}`}
          />
        ) : null}
        {order.action !== 'sip' || isBuy ? (
          <SummaryRow label={order.action === 'sell' || order.action === 'redeem' ? 'Quantity' : 'Estimated quantity'} value={`${order.quantity.toFixed(4)} g`} />
        ) : (
          <SummaryRow label="Estimated quantity per installment" value={`${order.quantity.toFixed(4)} g`} />
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
        <SummaryRow label="Sample rate" value={`₹${order.rate.toLocaleString('en-IN')} / g`} />
        <SummaryRow label="Fees and taxes" value="Not included in demo" />
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
      <Text style={styles.pageTitle}>Demo record added</Text>
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
      accessibilityLabel={`${presentation.title} ${transaction.metal === 'gold' ? 'Gold' : 'Silver'}, ${transaction.status}, tap for demo details`}
      onPress={onPress}
      style={styles.transactionRow}
    >
      <View style={[styles.transactionIcon, { backgroundColor: presentation.color }]}>
        <Text style={[styles.transactionIconText, { color: presentation.ink }]}>{presentation.icon}</Text>
      </View>
      <View style={styles.transactionCopy}>
          <Text style={styles.transactionTitle}>{transactionDisplayTitle(transaction)}</Text>
        <Text style={styles.transactionSubtitle}>
          {transaction.metal === 'gold' ? 'Gold' : 'Silver'}
          {transaction.quantity > 0 ? ` · ${transaction.quantity.toFixed(4)} g` : ''}
          {` · ${dateLabel}`}
        </Text>
        <Text style={styles.transactionStatus}>{transaction.status}</Text>
      </View>
      <View style={styles.transactionAmountWrap}>
        <Text style={styles.transactionAmount}>₹{Math.round(transaction.amount).toLocaleString('en-IN')}</Text>
        <Text style={styles.transactionChevron}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

function PortfolioScreen({ portfolio, transactions }) {
  const currentValue = portfolio.goldGrams * demoRates[0].ratePerGram
    + portfolio.silverGrams * demoRates[1].ratePerGram;
  return (
    <>
      <Text style={styles.pageTitle}>My portfolio</Text>
      <Notice type="warning" style={styles.sectionNotice}>DEMO PORTFOLIO · These balances exist only in this app session.</Notice>
      <PortfolioCard portfolio={portfolio} />
      <Card style={styles.investedCard}>
        <SummaryRow label="Sample gold holding" value={`${portfolio.goldGrams.toFixed(4)} g`} />
        <SummaryRow label="Sample silver holding" value={`${portfolio.silverGrams.toFixed(4)} g`} />
        <SummaryRow label="Demo amount invested" value={`₹${Math.round(portfolio.totalInvested).toLocaleString('en-IN')}`} />
        <SummaryRow label="Illustrative current value" value={`₹${Math.round(currentValue).toLocaleString('en-IN')}`} />
        <SummaryRow label="Returns" value="Not calculated" />
      </Card>
      <SectionTitle title="Activity summary" />
      <Card style={styles.activityCard}>
        <SummaryRow label="Local demo records this session" value={String(transactions.length)} />
        <SummaryRow label="Backend connected" value="No" />
      </Card>
    </>
  );
}

function ActivityScreen({ transactions, onTransactionPress }) {
  const [filter, setFilter] = useState('all');
  const filteredTransactions = useMemo(
    () => transactions.filter((item) => filter === 'all' || item.type === filter),
    [filter, transactions],
  );
  return (
    <>
      <Text style={styles.pageTitle}>Transaction history</Text>
      <Notice type="warning" style={styles.sectionNotice}>
        DEMO HISTORY · Only temporary local records are shown. No backend transactions are loaded.
      </Notice>
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

function TransactionDetails({ transaction, onBack }) {
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
      <TouchableOpacity accessibilityRole="button" onPress={onBack} style={styles.backLink}>
        <Text style={styles.backLinkText}>‹  Back to activity</Text>
      </TouchableOpacity>
      <Text style={styles.pageTitle}>Demo transaction details</Text>
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
        <SummaryRow label="Metal" value={transaction.metal === 'gold' ? 'Gold 24K' : 'Silver'} />
        <SummaryRow label="Sample amount" value={`₹${Math.round(transaction.amount).toLocaleString('en-IN')}`} />
        {transaction.quantity > 0 ? <SummaryRow label="Sample quantity" value={`${transaction.quantity.toFixed(4)} g`} /> : null}
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
  return `${presentation.title} ${transaction.metal === 'gold' ? 'Gold' : 'Silver'}`;
}

function NotificationsScreen() {
  return (
    <>
      <Text style={styles.pageTitle}>Notifications</Text>
      <Notice type="warning" style={styles.sectionNotice}>Backend notifications are not connected.</Notice>
      <Card style={styles.activityCard}>
        <EmptyState title="You’re all caught up" body="Transaction updates and reminders will appear here when the backend supports them." symbol="◉" />
      </Card>
    </>
  );
}

function ProfileScreen({ mobile, name, onLogout }) {
  const maskedNumber = mobile ? `+91 ••••••${mobile.slice(-4)}` : 'Not connected';
  return (
    <>
      <Text style={styles.pageTitle}>Profile</Text>
      <Card style={styles.profileCard}>
        <View style={styles.profileAvatar}><Text style={styles.profileAvatarText}>D</Text></View>
        <Text style={styles.profileName}>{name}</Text>
        <Text style={styles.profileMobile}>{maskedNumber}</Text>
        <DemoBadge label="DEMO PROFILE" />
        <Text style={styles.profileMessage}>
          Customer details and KYC status are not connected to a backend.
        </Text>
      </Card>
      <Card style={styles.profileRowCard}>
        <Text style={styles.cardTitle}>Account & privacy</Text>
        <Text style={styles.bodyText}>
          No privacy policy or terms link is configured. Connect approved destinations before release.
        </Text>
      </Card>
      <Button title="Log out of demo" variant="secondary" onPress={onLogout} style={styles.logoutButton} />
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
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [action, setAction] = useState('');
  const [reviewOrder, setReviewOrder] = useState(null);
  const [customerName, setCustomerName] = useState('Demo customer');
  const [demoHoldings, setDemoHoldings] = useState(() => ({
    ...demoPortfolio,
    goldInvested: 0,
    silverInvested: 0,
  }));
  const [transactions, setTransactions] = useState([]);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const confirmationStarted = useRef(false);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setScreen('login');
      setTab('home');
      setOtp('');
      setError('Your session expired. Please sign in again.');
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    if (screen !== 'otp') return undefined;
    const timer = setInterval(() => setResendSeconds((remaining) => Math.max(remaining - 1, 0)), 1000);
    return () => clearInterval(timer);
  }, [screen]);

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
    try {
      await logout();
      setScreen('login');
      setTab('home');
      setMobile('');
      setOtp('');
      setCustomerName('Demo customer');
      setDemoHoldings({ ...demoPortfolio, goldInvested: 0, silverInvested: 0 });
      setTransactions([]);
      setSelectedTransaction(null);
      setError('');
    } catch (logoutError) {
      setError(logoutError.message || 'Could not end the session.');
    } finally {
      setBusy(false);
    }
  };

  const openAction = (nextAction) => {
    if (nextAction === 'portfolio') {
      setTab('portfolio');
      setScreen('app');
      return;
    }
    confirmationStarted.current = false;
    setAction(nextAction);
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
      quantity: Number(reviewOrder.quantity.toFixed(4)),
      createdAt: now.toISOString(),
      status: ['buy', 'sell', 'redeem'].includes(reviewOrder.action)
        ? 'Demo successful'
        : 'Demo created',
    };

    if (reviewOrder.action === 'buy') {
      setDemoHoldings((current) => ({
        ...current,
        goldGrams: Number((current.goldGrams + (reviewOrder.metal === 'gold' ? transaction.quantity : 0)).toFixed(4)),
        silverGrams: Number((current.silverGrams + (reviewOrder.metal === 'silver' ? transaction.quantity : 0)).toFixed(4)),
        totalInvested: Math.round((current.totalInvested + transaction.amount) * 100) / 100,
        goldInvested: Math.round((current.goldInvested + (reviewOrder.metal === 'gold' ? transaction.amount : 0)) * 100) / 100,
        silverInvested: Math.round((current.silverInvested + (reviewOrder.metal === 'silver' ? transaction.amount : 0)) * 100) / 100,
      }));
    }
    if (reviewOrder.action === 'sell' || reviewOrder.action === 'redeem') {
      const gramsField = reviewOrder.metal === 'gold' ? 'goldGrams' : 'silverGrams';
      const investedField = reviewOrder.metal === 'gold' ? 'goldInvested' : 'silverInvested';
      setDemoHoldings((current) => {
        const remainingGrams = Math.max(0, Number((current[gramsField] - transaction.quantity).toFixed(4)));
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
  if (screen === 'app' && apiConfig.mode === 'backend') {
    return <BackendSetupScreen onLogout={handleLogout} busy={busy} />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        {screen === 'app' ? (
          <ScrollView contentContainerStyle={styles.screenContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {tab === 'home' ? (
              <HomeScreen
                name={customerName}
                onOpenAction={openAction}
                onSelectTab={setTab}
                portfolio={demoHoldings}
                transactions={transactions}
                onTransactionPress={(transaction) => { setSelectedTransaction(transaction); setScreen('transaction'); }}
              />
            ) : null}
            {tab === 'portfolio' ? (
              <PortfolioScreen portfolio={demoHoldings} transactions={transactions} />
            ) : null}
            {tab === 'activity' ? (
              <ActivityScreen
                transactions={transactions}
                onTransactionPress={(transaction) => { setSelectedTransaction(transaction); setScreen('transaction'); }}
              />
            ) : null}
            {tab === 'notifications' ? <NotificationsScreen /> : null}
            {tab === 'profile' ? <ProfileScreen mobile={mobile} name={customerName} onLogout={handleLogout} /> : null}
          </ScrollView>
        ) : screen === 'transaction' ? (
          <ScrollView contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
            {selectedTransaction ? (
              <TransactionDetails
                transaction={selectedTransaction}
                onBack={() => { setTab('activity'); setScreen('app'); }}
              />
            ) : null}
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={styles.screenContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {screen === 'action' ? (
              <ActionScreen
                action={action}
                portfolio={demoHoldings}
                initialOrder={reviewOrder}
                onBack={() => setScreen('app')}
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
      {screen === 'app' ? (
        <BottomNavigation
          selected={tab === 'notifications' ? 'home' : tab}
          onSelect={(nextTab) => { setTab(nextTab); setScreen('app'); }}
        />
      ) : null}
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
  promoBanner: {
    backgroundColor: colors.primaryDark,
    borderRadius: 20,
    flexDirection: 'row',
    marginBottom: 16,
    minHeight: 150,
    overflow: 'hidden',
    padding: 18,
    position: 'relative',
  },
  promoCopy: { flex: 1, paddingRight: 3, zIndex: 1 },
  promoEyebrow: { color: colors.gold, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  promoTitle: { color: colors.surface, fontSize: 20, fontWeight: '900', lineHeight: 25, marginTop: 9, maxWidth: 200 },
  promoBody: { color: colors.onPrimary, fontSize: 11, lineHeight: 16, marginTop: 7, maxWidth: 200 },
  goldOrb: {
    alignItems: 'center',
    backgroundColor: colors.gold,
    borderColor: colors.goldLight,
    borderRadius: 40,
    borderWidth: 4,
    height: 76,
    justifyContent: 'center',
    marginRight: -4,
    marginTop: 24,
    width: 76,
  },
  goldOrbText: { color: colors.text, fontSize: 21, fontWeight: '900' },
  bannerAccent: { backgroundColor: colors.secondary, borderRadius: 50, height: 140, opacity: 0.24, position: 'absolute', right: -54, top: -60, width: 140 },
  portfolioCard: { backgroundColor: colors.primary, borderRadius: 19, marginBottom: 25, padding: 18 },
  portfolioTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  portfolioEyebrow: { color: colors.onPrimary, fontSize: 9, fontWeight: '800', letterSpacing: 1.1, marginBottom: 7 },
  portfolioSymbol: { color: colors.gold, fontSize: 23, fontWeight: '900' },
  portfolioValue: { color: colors.surface, fontSize: 30, fontWeight: '900', marginTop: 10 },
  portfolioHelper: { color: colors.onPrimary, fontSize: 11, marginTop: 3 },
  portfolioDivider: { backgroundColor: colors.primaryDivider, height: 1, marginVertical: 16 },
  holdingRow: { alignItems: 'center', flexDirection: 'row' },
  holdingLabel: { color: colors.onPrimary, fontSize: 10 },
  holdingValue: { color: colors.surface, fontSize: 14, fontWeight: '800', marginTop: 4 },
  holdingSeparator: { backgroundColor: colors.primaryDivider, height: 28, marginHorizontal: 22, width: 1 },
  viewPortfolio: { color: colors.gold, fontSize: 11, fontWeight: '800', marginLeft: 'auto' },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 12 },
  actionCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 15,
    borderWidth: 1,
    marginBottom: 10,
    minHeight: 105,
    padding: 13,
    width: '48.5%',
  },
  actionMark: { alignItems: 'center', backgroundColor: colors.lightMint, borderRadius: 12, height: 36, justifyContent: 'center', marginBottom: 8, width: 36 },
  actionMarkGold: { backgroundColor: colors.goldLight },
  actionSymbol: { color: colors.primary, fontSize: 18, fontWeight: '800' },
  actionTitle: { color: colors.text, fontSize: 12, fontWeight: '800' },
  actionDetail: { color: colors.muted, fontSize: 10, lineHeight: 14, marginTop: 3 },
  ratesCard: { marginBottom: 22, paddingHorizontal: 13, paddingVertical: 12 },
  rateDemoLabel: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  rateNote: { color: colors.muted, fontSize: 10 },
  rateRow: { alignItems: 'center', flexDirection: 'row', paddingVertical: 12 },
  rateRowBorder: { borderTopColor: colors.border, borderTopWidth: 1 },
  rateSymbol: { alignItems: 'center', backgroundColor: colors.goldLight, borderRadius: 12, height: 40, justifyContent: 'center', width: 40 },
  rateSymbolSilver: { backgroundColor: colors.lightMint },
  rateSymbolText: { color: colors.goldDark, fontSize: 12, fontWeight: '900' },
  rateSymbolSilverText: { color: colors.primary },
  rateInfo: { flex: 1, marginLeft: 11 },
  rateName: { color: colors.text, fontSize: 13, fontWeight: '800' },
  ratePurity: { color: colors.muted, fontSize: 10, marginTop: 3 },
  ratePrice: { color: colors.text, fontSize: 13, fontWeight: '900' },
  priceInfo: { alignItems: 'flex-end' },
  rateChange: { color: colors.success, fontSize: 9, fontWeight: '700', marginTop: 3 },
  activityCard: { marginBottom: 16 },
  disclaimer: { marginBottom: 8 },
  bottomNav: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    paddingTop: 7,
  },
  navItem: { alignItems: 'center', justifyContent: 'center', minHeight: 48, minWidth: 60, paddingHorizontal: 8 },
  navIcon: { color: colors.muted, fontSize: 19, height: 23 },
  navIconActive: { color: colors.primary, fontWeight: '900' },
  navLabel: { color: colors.muted, fontSize: 10, marginTop: 1 },
  navLabelActive: { color: colors.primary, fontWeight: '800' },
  pageTitle: { color: colors.text, fontSize: 24, fontWeight: '900', marginBottom: 15 },
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
  transactionAmountWrap: { alignItems: 'flex-end', flexDirection: 'row', marginLeft: 5 },
  transactionAmount: { color: colors.text, fontSize: 11, fontWeight: '900' },
  transactionChevron: { color: colors.muted, fontSize: 17, marginLeft: 5 },
  transactionDetailHeading: { alignItems: 'center', flexDirection: 'row', marginBottom: 10 },
  profileCard: { alignItems: 'center', marginBottom: 15, padding: 22 },
  profileAvatar: { alignItems: 'center', backgroundColor: colors.lightMint, borderRadius: 23, height: 64, justifyContent: 'center', marginBottom: 11, width: 64 },
  profileAvatarText: { color: colors.primary, fontSize: 24, fontWeight: '900' },
  profileName: { color: colors.text, fontSize: 17, fontWeight: '900', marginBottom: 4 },
  profileMobile: { color: colors.muted, fontSize: 12, marginBottom: 12 },
  profileMessage: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 12, textAlign: 'center' },
  profileRowCard: { marginBottom: 16, padding: 16 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '900', marginBottom: 10 },
  bodyText: { color: colors.muted, fontSize: 12, lineHeight: 19 },
  logoutButton: { marginTop: 5 },
  formNotice: { marginBottom: 16 },
  formCard: { marginBottom: 20, padding: 16 },
  formLabel: { color: colors.text, fontSize: 13, fontWeight: '800', marginBottom: 9 },
  rateSummary: { alignItems: 'center', backgroundColor: colors.background, borderRadius: 11, flexDirection: 'row', justifyContent: 'space-between', marginBottom: 17, padding: 12 },
  inlineNotice: { marginBottom: 13 },
  chips: { flexDirection: 'row', marginBottom: 15 },
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
