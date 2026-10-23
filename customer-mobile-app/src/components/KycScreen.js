import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, Card, Notice } from './UI';
import { colors } from '../theme';

const documentOptions = [
  { label: 'Aadhaar Card', value: 'aadhaar' },
  { label: 'PAN Card', value: 'pan' },
];

function normalizeDocumentNumber(documentType, value) {
  return documentType === 'pan' ? value.toUpperCase() : value;
}

function validateDocumentNumber(documentType, value) {
  if (!value.trim()) return 'Enter your document number to continue.';
  if (documentType === 'aadhaar' && !/^\d{12}$/.test(value.replace(/ /g, ''))) {
    return 'Enter a valid 12-digit Aadhaar number.';
  }
  if (documentType === 'pan' && !/^[A-Z]{5}\d{4}[A-Z]$/.test(value.trim())) {
    return 'Enter a valid PAN number in the format ABCDE1234F.';
  }
  return '';
}

function maskDocumentNumber(documentType, value) {
  const normalized = documentType === 'aadhaar'
    ? value.replace(/ /g, '')
    : value.trim();
  return `${'•'.repeat(Math.max(0, normalized.length - 4))}${normalized.slice(-4)}`;
}

function KycStatusCard() {
  return (
    <Card style={styles.statusCard}>
      <Text style={styles.title}>KYC Status</Text>
      <View style={styles.statusRow}>
        <MaterialCommunityIcons
          name="help-circle-outline"
          size={21}
          color={colors.muted}
        />
        <Text style={styles.disconnectedStatus}>Not connected</Text>
      </View>
      <Text style={styles.body}>
        A customer KYC status service is not connected, so your verification status cannot be confirmed. No status is assumed.
      </Text>
      <Text style={styles.statusFootnote}>
        Backend-provided status, action-required reasons, and correction or resubmission options will appear here when supported.
      </Text>
    </Card>
  );
}

export default function KycScreen() {
  const [step, setStep] = useState('identity');
  const [documentType, setDocumentType] = useState('');
  const [documentMenuOpen, setDocumentMenuOpen] = useState(false);
  const [documentNumber, setDocumentNumber] = useState('');
  const [showDocumentNumber, setShowDocumentNumber] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [consentChecked, setConsentChecked] = useState(false);

  const selectDocument = (nextType) => {
    setDocumentType(nextType);
    setDocumentMenuOpen(false);
    setDocumentNumber('');
    setShowDocumentNumber(false);
    setValidationError('');
    setConsentChecked(false);
  };

  const continueToReview = () => {
    const message = validateDocumentNumber(documentType, documentNumber);
    setValidationError(message);
    if (!message) {
      setConsentChecked(false);
      setStep('review');
    }
  };

  return (
    <>
      {step === 'identity' ? (
        <Card style={styles.card}>
          <Text style={styles.title}>Identity Verification</Text>
          <Text style={styles.body}>
            Verify your identity to access eligible DigiGold services.
          </Text>
          <Text style={styles.fieldLabel}>Select Document</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Select Document"
            accessibilityState={{ expanded: documentMenuOpen }}
            onPress={() => setDocumentMenuOpen((open) => !open)}
            style={styles.documentSelector}
          >
            <Text style={[styles.documentSelectorText, !documentType && styles.documentPlaceholder]}>
              {documentOptions.find((option) => option.value === documentType)?.label || 'Select Document'}
            </Text>
            <MaterialCommunityIcons
              name={documentMenuOpen ? 'chevron-up' : 'chevron-down'}
              size={22}
              color={colors.muted}
            />
          </Pressable>
          {documentMenuOpen ? (
            <View style={styles.documentMenu}>
              {documentOptions.map((option) => {
                const selected = documentType === option.value;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    key={option.value}
                    onPress={() => selectDocument(option.value)}
                    style={[
                      styles.documentMenuOption,
                      selected && styles.documentMenuOptionSelected,
                    ]}
                  >
                    <Text style={[
                      styles.documentMenuOptionText,
                      selected && styles.documentMenuOptionTextSelected,
                    ]}>
                      {option.label}
                    </Text>
                    {selected ? (
                      <MaterialCommunityIcons name="check" size={19} color={colors.primary} />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {documentType ? (
            <View style={styles.inputSection}>
              <Text style={styles.fieldLabel}>
                {documentType === 'aadhaar' ? 'Aadhaar Number' : 'PAN Number'}
              </Text>
              <View style={[styles.inputWrap, validationError && styles.inputWrapError]}>
                <TextInput
                  accessibilityLabel={documentType === 'aadhaar' ? 'Aadhaar Number' : 'PAN Number'}
                  autoCapitalize={documentType === 'pan' ? 'characters' : 'none'}
                  autoCorrect={false}
                  keyboardType={documentType === 'aadhaar' ? 'number-pad' : 'default'}
                  onChangeText={(value) => {
                    setDocumentNumber(normalizeDocumentNumber(documentType, value));
                    setConsentChecked(false);
                    if (validationError) setValidationError('');
                  }}
                  placeholder={documentType === 'aadhaar'
                    ? 'Enter your 12-digit Aadhaar number'
                    : 'Enter your PAN number'}
                  placeholderTextColor={colors.muted}
                  secureTextEntry={!showDocumentNumber}
                  style={styles.input}
                  value={documentNumber}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={showDocumentNumber ? 'Hide document number' : 'Show document number'}
                  onPress={() => setShowDocumentNumber((visible) => !visible)}
                  hitSlop={8}
                  style={styles.visibilityButton}
                >
                  <Text style={styles.visibilityText}>{showDocumentNumber ? 'Hide' : 'Show'}</Text>
                </Pressable>
              </View>
              {validationError ? (
                <Text accessibilityLiveRegion="polite" style={styles.validationError}>
                  {validationError}
                </Text>
              ) : null}
              <Text style={styles.privacyNote}>
                Your number stays in this screen and is not saved. Submission is unavailable while the KYC service is disconnected.
              </Text>
              <Button
                title="Continue"
                onPress={continueToReview}
                style={styles.button}
              />
            </View>
          ) : null}
        </Card>
      ) : null}

      {step === 'review' ? (
        <Card style={styles.card}>
          <Text style={styles.eyebrow}>REVIEW & CONSENT</Text>
          <Text style={styles.title}>Review your information</Text>
          <Text style={styles.body}>
            Check the selected document and masked number before continuing. Your account profile details are not requested again.
          </Text>
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Document type</Text>
            <Text style={styles.reviewValue}>
              {documentType === 'aadhaar' ? 'Aadhaar Card' : 'PAN Card'}
            </Text>
          </View>
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Document number</Text>
            <Text style={styles.reviewValue}>
              {maskDocumentNumber(documentType, documentNumber)}
            </Text>
          </View>
          <Text style={[styles.body, styles.consentExplanation]}>
            The approved verification service would use this information to verify your identity for eligible DigiGold services, subject to applicable requirements.
          </Text>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: consentChecked }}
            onPress={() => setConsentChecked((checked) => !checked)}
            style={styles.consentRow}
          >
            <View style={[styles.checkbox, consentChecked && styles.checkboxSelected]}>
              {consentChecked ? <Text style={styles.checkmark}>✓</Text> : null}
            </View>
            <Text style={styles.consentText}>
              I have reviewed the information and consent to its use for identity verification.
            </Text>
          </Pressable>
          <Notice type="warning" style={styles.consentNotice}>
            The KYC backend is not connected. Consent cannot be recorded and this information will not be submitted.
          </Notice>
          <Button
            title="KYC submission unavailable"
            disabled
            style={styles.button}
          />
          <Button
            title="Edit document details"
            variant="secondary"
            onPress={() => setStep('identity')}
            style={styles.secondaryButton}
          />
        </Card>
      ) : null}

      <KycStatusCard />
    </>
  );
}

const styles = StyleSheet.create({
  statusCard: { marginBottom: 14, padding: 16 },
  statusRow: { alignItems: 'center', flexDirection: 'row', gap: 7, marginBottom: 8 },
  disconnectedStatus: { color: colors.muted, fontSize: 13, fontWeight: '800' },
  statusFootnote: { color: colors.muted, fontSize: 11, lineHeight: 17 },
  card: { marginBottom: 16, padding: 16 },
  eyebrow: { color: colors.goldDark, fontSize: 10, fontWeight: '900', letterSpacing: 0.7, marginBottom: 7 },
  title: { color: colors.text, fontSize: 17, fontWeight: '900', marginBottom: 8 },
  body: { color: colors.muted, fontSize: 12, lineHeight: 19, marginBottom: 13 },
  fieldLabel: { color: colors.text, fontSize: 13, fontWeight: '700', marginBottom: 8 },
  documentSelector: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 13,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    minHeight: 50,
    paddingHorizontal: 14,
  },
  documentSelectorText: { color: colors.text, flex: 1, fontSize: 14, fontWeight: '700' },
  documentPlaceholder: { color: colors.muted, fontWeight: '400' },
  documentMenu: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 13,
    borderWidth: 1,
    marginBottom: 16,
    marginTop: -8,
    overflow: 'hidden',
  },
  documentMenuOption: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: 14,
  },
  documentMenuOptionSelected: { backgroundColor: colors.lightMint },
  documentMenuOptionText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  documentMenuOptionTextSelected: { color: colors.primary, fontWeight: '900' },
  inputSection: { marginTop: 3 },
  inputWrap: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 13,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 50,
    paddingLeft: 14,
    paddingRight: 12,
  },
  inputWrapError: { borderColor: colors.error },
  input: { color: colors.text, flex: 1, fontSize: 14, minHeight: 48, paddingVertical: 10 },
  visibilityButton: { justifyContent: 'center', minHeight: 44, paddingLeft: 10 },
  visibilityText: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  validationError: { color: colors.error, fontSize: 11, marginTop: 6 },
  privacyNote: { color: colors.muted, fontSize: 10, lineHeight: 16, marginTop: 8 },
  button: { marginTop: 13 },
  reviewRow: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12 },
  reviewLabel: { color: colors.muted, flex: 1, fontSize: 12 },
  reviewValue: { color: colors.text, fontSize: 12, fontWeight: '800', textAlign: 'right' },
  consentExplanation: { marginBottom: 5, marginTop: 13 },
  consentRow: { alignItems: 'flex-start', flexDirection: 'row', marginVertical: 15 },
  checkbox: { alignItems: 'center', borderColor: colors.border, borderRadius: 5, borderWidth: 1, height: 21, justifyContent: 'center', marginRight: 10, width: 21 },
  checkboxSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkmark: { color: colors.surface, fontSize: 14, fontWeight: '900' },
  consentText: { color: colors.text, flex: 1, fontSize: 12, lineHeight: 18 },
  consentNotice: { marginBottom: 3 },
  secondaryButton: { marginTop: 9 },
});
