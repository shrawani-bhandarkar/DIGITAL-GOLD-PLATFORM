import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, commonStyles } from '../theme';

export function Brand({ compact = false }) {
  return (
    <View style={styles.brandRow}>
      <View style={styles.brandMark}>
        <Text style={styles.brandMarkText}>D</Text>
      </View>
      <View>
        <Text style={styles.brandName}>DIGIGOLD</Text>
        {!compact ? <Text style={styles.brandCaption}>GROW YOUR GOLD SAVINGS</Text> : null}
      </View>
    </View>
  );
}

export function Button({ title, onPress, variant = 'primary', disabled, loading, style }) {
  const quiet = variant === 'secondary';
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled || loading) }}
      activeOpacity={0.82}
      disabled={disabled || loading}
      onPress={onPress}
      style={[
        styles.button,
        quiet ? styles.buttonSecondary : styles.buttonPrimary,
        (disabled || loading) && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={quiet ? colors.primary : colors.surface} />
      ) : (
        <Text style={[styles.buttonText, quiet && styles.buttonSecondaryText]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

export function Card({ children, style }) {
  return <View style={[commonStyles.card, commonStyles.shadow, style]}>{children}</View>;
}

export function DemoBadge({ label = 'DEMO DATA' }) {
  return (
    <View style={styles.demoBadge}>
      <Text style={styles.demoBadgeText}>{label}</Text>
    </View>
  );
}

export function Notice({ children, type = 'info', style }) {
  const warning = type === 'warning';
  const error = type === 'error';
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[
        styles.notice,
        warning && styles.noticeWarning,
        error && styles.noticeError,
        style,
      ]}
    >
      <Text
        style={[
          styles.noticeText,
          warning && styles.noticeWarningText,
          error && styles.noticeErrorText,
        ]}
      >
        {children}
      </Text>
    </View>
  );
}

export function SectionTitle({ title, action, onAction }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action ? (
        <TouchableOpacity accessibilityRole="button" onPress={onAction} hitSlop={8}>
          <Text style={styles.sectionAction}>{action}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function Field({ label, value, onChangeText, placeholder, keyboardType, error, ...props }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        autoCorrect={false}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        style={[styles.field, error && styles.fieldError]}
        value={value}
        {...props}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

export function ChoiceRow({ options, value, onChange, accessibilityLabel }) {
  return (
    <View accessibilityLabel={accessibilityLabel} style={styles.choiceRow}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ selected }}
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.choice, selected && styles.choiceSelected]}
          >
            <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function EmptyState({ title, body, symbol = '—' }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyMark}>
        <Text style={styles.emptySymbol}>{symbol}</Text>
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  brandRow: { alignItems: 'center', flexDirection: 'row' },
  brandMark: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 13,
    height: 42,
    justifyContent: 'center',
    marginRight: 11,
    width: 42,
  },
  brandMarkText: { color: colors.gold, fontSize: 22, fontWeight: '900' },
  brandName: { color: colors.primary, fontSize: 14, fontWeight: '900', letterSpacing: 1.6 },
  brandCaption: { color: colors.muted, fontSize: 8, fontWeight: '700', letterSpacing: 1, marginTop: 3 },
  button: {
    alignItems: 'center',
    borderRadius: 14,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 18,
  },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonSecondary: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
  buttonText: { color: colors.surface, fontSize: 15, fontWeight: '800' },
  buttonSecondaryText: { color: colors.primary },
  disabled: { opacity: 0.48 },
  demoBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.goldLight,
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  demoBadgeText: { color: colors.goldDark, fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },
  notice: { backgroundColor: colors.lightMint, borderRadius: 12, padding: 12 },
  noticeWarning: { backgroundColor: colors.warningBackground, borderColor: colors.warningBorder, borderWidth: 1 },
  noticeError: { backgroundColor: colors.errorBackground },
  noticeText: { color: colors.primaryDark, fontSize: 12, lineHeight: 18 },
  noticeWarningText: { color: colors.warningText },
  noticeErrorText: { color: colors.error },
  sectionRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  sectionAction: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  fieldWrap: { marginBottom: 14 },
  fieldLabel: { color: colors.text, fontSize: 13, fontWeight: '700', marginBottom: 8 },
  field: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 13,
    borderWidth: 1,
    color: colors.text,
    fontSize: 15,
    minHeight: 50,
    paddingHorizontal: 14,
  },
  fieldError: { borderColor: colors.error },
  errorText: { color: colors.error, fontSize: 11, marginTop: 5 },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 },
  choice: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 11,
    borderWidth: 1,
    marginBottom: 8,
    marginRight: 8,
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 13,
  },
  choiceSelected: { backgroundColor: colors.lightMint, borderColor: colors.primary },
  choiceText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  choiceTextSelected: { color: colors.primary },
  empty: { alignItems: 'center', paddingHorizontal: 18, paddingVertical: 27 },
  emptyMark: {
    alignItems: 'center',
    backgroundColor: colors.lightMint,
    borderRadius: 22,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  emptySymbol: { color: colors.primary, fontSize: 20, fontWeight: '700' },
  emptyTitle: { color: colors.text, fontSize: 14, fontWeight: '800', marginTop: 12 },
  emptyBody: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 5, textAlign: 'center' },
});
