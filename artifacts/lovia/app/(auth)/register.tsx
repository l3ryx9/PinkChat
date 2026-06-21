import { Feather } from "@expo/vector-icons";
import { Link } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
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

import { useAuth } from "@/contexts/AuthContext";
import colors from "@/constants/colors";

export default function RegisterScreen() {
  const { signUp } = useAuth();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function handleRegister() {
    if (!email.trim() || !password || !confirm) {
      setError("Remplis tous les champs.");
      return;
    }
    if (password.length < 6) {
      setError("Le mot de passe doit faire au moins 6 caractères.");
      return;
    }
    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await signUp(email.trim().toLowerCase(), password);
      setDone(true);
    } catch (e: any) {
      const msg = e.code === "auth/email-already-in-use"
        ? "Cet email est déjà utilisé."
        : "Une erreur est survenue. Réessaie.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <View style={[s.root, { justifyContent: "center", alignItems: "center", paddingHorizontal: 28 }]}>
        <Text style={{ fontSize: 64, marginBottom: 20 }}>📩</Text>
        <Text style={s.title}>Vérifie ton email</Text>
        <Text style={[s.subtitle, { textAlign: "center" }]}>
          Un lien de vérification a été envoyé à{"\n"}
          <Text style={{ color: colors.primary }}>{email}</Text>
        </Text>
        <Link href="/(auth)/verify-email" asChild>
          <Pressable style={s.btn}>
            <Text style={s.btnText}>J'ai vérifié →</Text>
          </Pressable>
        </Link>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingTop: insets.top + 30, paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.title}>Créer un compte</Text>
        <Text style={s.subtitle}>Rejoins ton autre moitié sur Lovia 💚</Text>

        <View style={s.form}>
          {[
            { label: "Email", value: email, set: setEmail, icon: "mail", kb: "email-address" as const, secure: false, ac: "email" as const },
            { label: "Mot de passe", value: password, set: setPassword, icon: "lock", kb: "default" as const, secure: !showPwd, ac: "new-password" as const },
            { label: "Confirmer", value: confirm, set: setConfirm, icon: "lock", kb: "default" as const, secure: !showPwd, ac: "new-password" as const },
          ].map(({ label, value, set, icon, kb, secure, ac }) => (
            <View key={label} style={s.field}>
              <Text style={s.label}>{label}</Text>
              <View style={s.inputWrap}>
                <Feather name={icon as any} size={18} color={colors.foregroundMuted} style={s.icon} />
                <TextInput
                  style={s.input}
                  value={value}
                  onChangeText={set}
                  placeholder={label === "Email" ? "ton@email.com" : "••••••••"}
                  placeholderTextColor={colors.foregroundMuted}
                  keyboardType={kb}
                  autoCapitalize="none"
                  secureTextEntry={secure}
                  autoComplete={ac}
                />
                {(label === "Mot de passe" || label === "Confirmer") && (
                  <Pressable onPress={() => setShowPwd(!showPwd)} style={s.eyeBtn}>
                    <Feather name={showPwd ? "eye-off" : "eye"} size={18} color={colors.foregroundMuted} />
                  </Pressable>
                )}
              </View>
            </View>
          ))}

          {error ? <Text style={s.error}>{error}</Text> : null}

          <Pressable
            style={[s.btn, loading && { opacity: 0.7 }]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.btnText}>Créer mon compte</Text>
            }
          </Pressable>

          <View style={s.row}>
            <Text style={s.rowText}>Déjà inscrit·e ? </Text>
            <Link href="/(auth)/login" asChild>
              <Pressable><Text style={s.link}>Se connecter</Text></Pressable>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: 28 },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: colors.foreground,
    letterSpacing: -1,
    fontFamily: "Inter_700Bold",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: colors.foregroundMuted,
    marginBottom: 36,
    fontFamily: "Inter_400Regular",
  },
  form: { gap: 16 },
  field: { gap: 8 },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.foregroundMuted,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
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
  eyeBtn: { padding: 4 },
  error: {
    color: colors.destructive,
    fontSize: 13,
    textAlign: "center",
    fontFamily: "Inter_400Regular",
  },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  btnText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  row: { flexDirection: "row", justifyContent: "center", marginTop: 8 },
  rowText: { color: colors.foregroundMuted, fontSize: 14, fontFamily: "Inter_400Regular" },
  link: { color: colors.primary, fontSize: 14, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
});
