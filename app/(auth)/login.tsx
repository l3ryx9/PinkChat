import { Feather } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
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

import { useAuth } from "@/contexts/AuthContext";
import colors from "@/constants/colors";

const FERN_BG = require("../../assets/images/fern-bg.png");
const LOTUS_LOGO = require("../../assets/images/icon.png");

export default function LoginScreen() {
  const { signIn } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [failedAttempts, setFailedAttempts] = useState(0);

  async function handleLogin() {
    if (!email.trim() || !password) {
      setError("Remplis tous les champs.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await signIn(email.trim().toLowerCase(), password);
    } catch (e: any) {
      const msg =
        e.code === "auth/invalid-credential"
          ? "Email ou mot de passe incorrect."
          : "Une erreur est survenue. Réessaie.";
      setError(msg);
      setFailedAttempts((prev) => prev + 1);
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
          <Image source={LOTUS_LOGO} style={s.logo} resizeMode="contain" />
          <Text style={s.title}>Lovia</Text>
          <Text style={s.subtitle}>Uniquement vous deux.</Text>

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

            <View style={s.field}>
              <Text style={s.label}>Mot de passe</Text>
              <View style={s.inputWrap}>
                <Feather
                  name="lock"
                  size={18}
                  color={colors.foregroundMuted}
                  style={s.icon}
                />
                <TextInput
                  style={s.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor={colors.foregroundMuted}
                  secureTextEntry={!showPwd}
                  autoComplete="password"
                />
                <Pressable
                  onPress={() => setShowPwd(!showPwd)}
                  style={s.eyeBtn}
                >
                  <Feather
                    name={showPwd ? "eye-off" : "eye"}
                    size={18}
                    color={colors.foregroundMuted}
                  />
                </Pressable>
              </View>
            </View>

            {error ? <Text style={s.error}>{error}</Text> : null}

            {failedAttempts >= 3 && (
              <Pressable
                onPress={() => router.push("/(auth)/forgot-password")}
                style={s.forgotWrap}
              >
                <Text style={s.forgotText}>Mot de passe oublié ?</Text>
              </Pressable>
            )}

            <Pressable
              style={[s.btn, loading && { opacity: 0.7 }]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.btnText}>Se connecter</Text>
              )}
            </Pressable>

            <View style={s.divider}>
              <View style={s.dividerLine} />
              <Feather name="feather" size={14} color={colors.foregroundMuted} />
              <View style={s.dividerLine} />
            </View>

            <View style={s.row}>
              <Text style={s.rowText}>Pas encore inscrit·e ? </Text>
              <Link href="/(auth)/register" asChild>
                <Pressable>
                  <Text style={s.link}>Créer un compte →</Text>
                </Pressable>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const s = StyleSheet.create({
  bg: { flex: 1, backgroundColor: colors.background },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(6,14,10,0.62)",
  },
  root: { flex: 1, backgroundColor: "transparent" },
  scroll: { paddingHorizontal: 28, alignItems: "center" },
  logo: {
    width: 90,
    height: 90,
    marginBottom: 12,
  },
  title: {
    fontSize: 46,
    fontWeight: "800",
    color: colors.gold,
    letterSpacing: -1.5,
    fontFamily: "Inter_700Bold",
  },
  subtitle: {
    fontSize: 16,
    color: colors.foregroundMuted,
    marginBottom: 48,
    marginTop: 4,
    fontFamily: "Inter_400Regular",
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
  eyeBtn: { padding: 4 },
  error: {
    color: colors.destructive,
    fontSize: 13,
    textAlign: "center",
    fontFamily: "Inter_400Regular",
  },
  forgotWrap: {
    alignItems: "center",
    paddingVertical: 4,
  },
  forgotText: {
    color: colors.gold,
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    textDecorationLine: "underline",
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
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  row: { flexDirection: "row", justifyContent: "center" },
  rowText: {
    color: colors.foregroundMuted,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  link: {
    color: colors.gold,
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
});
