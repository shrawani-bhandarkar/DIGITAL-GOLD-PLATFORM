import { StatusBar } from "expo-status-bar";
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";

const sections = [
  "Buy Gold",
  "Sell Gold",
  "Portfolio & Transactions",
  "Redeem Physical Gold",
  "SIP / Recurring Buy",
  "Gift Gold",
  "Notifications & Support",
];

export default function App() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>DIGI GOLD</Text>
        <Text style={styles.title}>Home</Text>
        <Text style={styles.subtitle}>Your gold account and transactions.</Text>
        <View style={styles.list}>
          {sections.map((section, index) => (
            <View key={section} style={styles.card}>
              <View style={styles.number}>
                <Text style={styles.numberText}>{String(index + 1).padStart(2, "0")}</Text>
              </View>
              <Text style={styles.cardText}>{section}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.notice}>
          Rates, balances, and transaction actions will be connected to the API when those features are implemented.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: "#f5f7fb", flex: 1 },
  content: { padding: 24, paddingBottom: 40 },
  eyebrow: { color: "#627d98", fontSize: 11, fontWeight: "700", letterSpacing: 2, marginTop: 16 },
  title: { color: "#102a43", fontSize: 32, fontWeight: "700", marginTop: 8 },
  subtitle: { color: "#627d98", fontSize: 14, marginTop: 8 },
  list: { gap: 12, marginTop: 28 },
  card: { alignItems: "center", backgroundColor: "#fff", borderColor: "#e5eaf0", borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 14, minHeight: 68, padding: 14 },
  number: { alignItems: "center", backgroundColor: "#e8f3ff", borderRadius: 9, height: 40, justifyContent: "center", width: 40 },
  numberText: { color: "#1769aa", fontSize: 12, fontWeight: "700" },
  cardText: { color: "#243b53", flex: 1, fontSize: 14, fontWeight: "600" },
  notice: { color: "#627d98", fontSize: 12, lineHeight: 18, marginTop: 24 },
});
