import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Card } from './UI';
import { colors } from '../theme';
import { apiConfig } from '../config/apiConfig';
import { fetchProfile } from '../services/customerServices';

const statusDetails = {
  PENDING: {
    label: 'Pending',
    description: 'Your KYC is awaiting review.',
    icon: 'clock-outline',
    color: colors.muted,
  },
  APPROVED: {
    label: 'Approved',
    description: 'Your KYC has been approved.',
    icon: 'check-decagram-outline',
    color: colors.primary,
  },
  REJECTED: {
    label: 'Rejected',
    description: 'Your KYC was rejected. Please contact customer support for assistance.',
    icon: 'close-circle-outline',
    color: colors.error,
  },
};

export default function KycScreen() {
  const [kycStatus, setKycStatus] = useState('PENDING');
  const [statusError, setStatusError] = useState('');

  useEffect(() => {
    if (apiConfig.mode !== 'backend') return undefined;
    let active = true;
    const refreshStatus = async () => {
      try {
        const result = await fetchProfile();
        if (!result?.profile || !Object.prototype.hasOwnProperty.call(statusDetails, result.profile.kycStatus)) {
          throw new Error('The service did not return a valid KYC status.');
        }
        if (active) {
          setKycStatus(result.profile.kycStatus);
          setStatusError('');
        }
      } catch (error) {
        if (active) setStatusError(error.message);
      }
    };
    void refreshStatus();
    const interval = setInterval(refreshStatus, 15000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const status = statusDetails[kycStatus];

  return (
    <Card style={styles.card}>
      <Text style={styles.title}>KYC Status</Text>
      <View style={styles.statusRow}>
        <MaterialCommunityIcons name={status.icon} size={21} color={status.color} />
        <Text style={styles.statusText}>{status.label}</Text>
      </View>
      <Text style={styles.body}>{status.description}</Text>
      {statusError ? <Text accessibilityLiveRegion="polite" style={styles.error}>{statusError}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 16, padding: 16 },
  title: { color: colors.text, fontSize: 17, fontWeight: '900', marginBottom: 8 },
  statusRow: { alignItems: 'center', flexDirection: 'row', gap: 7, marginBottom: 8 },
  statusText: { color: colors.text, fontSize: 14, fontWeight: '800' },
  body: { color: colors.muted, fontSize: 12, lineHeight: 19 },
  error: { color: colors.error, fontSize: 12, lineHeight: 18, marginTop: 8 },
});
