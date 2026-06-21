import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/firebase/config";
import colors from "@/constants/colors";

const FERN_BG = require("../../assets/images/fern-bg.png");

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function handleReset() {
    if (!email.trim()) {
      setError("Entre ton adresse email.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await sendPasswordResetEmail(auth, email.trim().toLowerCase());
      setSent(true);
    } catch (e: any) {
      const msg =
        e.code === "auth/user-not-found" || e.code === "auth/invalid-email"
          ? "Aucun compte trouvé avec cet email."
          : "Une erreur est survenue. Réessaie.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ImageBackground source={FERN_BG} style={s.bg} resizeMode="cover">
      <View style={s.overlay} />
      <KeyboardAvoidingView
        style={s.root}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            s.scroll,
            { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable onPress={() => router.back()} style={s.backBtn}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </Pressable>

          {sent ? (
            <View style={s.successBox}>
              <Feather name="mail" size={52} color={colors.gold} />
              <Text style={s.successTitle}>Email envoyé !</Text>
              <Text style={s.successText}>
                Un lien pour changer ton mot de passe a été envoyé à{"\n"}
                <Text style={{ color: colors.gold }}>{email}</Text>
              </Text>
              <Pressable style={s.btn} onPress={() => router.back()}>
                <Text style={s.btnText}>Retour à la connexion</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={s.header}>
                <Feather name="lock" size={36} color={colors.gold} />
                <Text style={s.title}>Mot de passe oublié ?</Text>
                <Text style={s.subtitle}>
                  Saisis ton email et nous t'enverrons un lien pour changer ton
                  mot de passe.
                </Text>
              </View>

              <View style={s.form}>
                <View style={s.field}>
                  <Text style={s.label}>Email</Text>
                  <View style={s.inputWrap}>
                    <Feather
                      name="mail"
                      size={18}
                      color={colors.foregroundMuted}
                      style={s.icon}
                    />
                    <TextInput
                      style={s.input}
                      value={email}
                      onChangeText={setEmail}
                      placeholder="ton@email.com"
                      placeholderTextColor={colors.foregroundMuted}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoComplete="email"
                    />
                  </View>
                </View>

                {error ? <Text style={s.error}>{error}</Text> : null}

                <Pressable
                  style={[s.btn, loading && { opacity: 0.7 }]}
                  onPress={handleReset}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#2a1a08" />
                  ) : (
                    <Text style={s.btnText}>Envoyer le lien</Text>
                  )}
                </Pressable>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const s = StyleSheet.create({
  bg: { flex: 1, backgroundColor: colors.background },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(6,14,10,0.65)",
  },
  root: { flex: 1, backgroundColor: "transparent" },
  scroll: { paddingHorizontal: 28, alignItems: "center" },
  backBtn: {
    alignSelf: "flex-start",
    padding: 8,
    marginBottom: 24,
    backgroundColor: "rgba(15,31,23,0.7)",
    borderRadius: 10,
  },
  header: { alignItems: "center", gap: 12, marginBottom: 40 },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.gold,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    color: colors.foregroundMuted,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },
  form: { width: "100%", gap: 16 },
  field: { gap: 8 },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.foregroundMuted,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15,31,23,0.85)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    height: 52,
  },
  icon: { marginRight: 10 },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.foreground,
    fontFamily: "Inter_400Regular",
  },
  error: {
    color: colors.destructive,
    fontSize: 13,
    textAlign: "center",
    fontFamily: "Inter_400Regular",
  },
  btn: {
    backgroundColor: colors.gold,
    borderRadius: 14,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  btnText: {
    color: "#2a1a08",
    fontSize: 17,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  successBox: {
    alignItems: "center",
    gap: 16,
    paddingTop: 40,
    width: "100%",
  },
  successTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.gold,
    fontFamily: "Inter_700Bold",
  },
  successText: {
    fontSize: 15,
    color: colors.foregroundMuted,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },
});
