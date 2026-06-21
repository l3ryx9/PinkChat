import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { useAuth } from "@/contexts/AuthContext";
import colors from "@/constants/colors";

export default function VerifyEmailScreen() {
  const { user, logOut, resendVerification } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleResend() {
    setLoading(true);
    try {
      await resendVerification();
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  async function handleCheck() {
    setLoading(true);
    try {
      await user?.reload();
      if (user?.emailVerified) {
        router.replace("/(auth)/onboarding");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[s.root, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 40 }]}>
      <Text style={s.emoji}>📩</Text>
      <Text style={s.title}>Vérifie ton email</Text>
      <Text style={s.body}>
        Un lien de vérification a été envoyé à{"\n"}
        <Text style={s.email}>{user?.email}</Text>
      </Text>
      <Text style={s.hint}>
        Clique sur le lien puis reviens ici pour continuer.
      </Text>

      <Pressable
        style={[s.btn, loading && { opacity: 0.7 }]}
        onPress={handleCheck}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={s.btnText}>J'ai vérifié ✓</Text>
        }
      </Pressable>

      {sent
        ? <Text style={s.sent}>Email renvoyé !</Text>
        : (
          <Pressable onPress={handleResend} style={s.link}>
            <Text style={s.linkText}>Renvoyer l'email</Text>
          </Pressable>
        )
      }

      <Pressable onPress={logOut} style={s.logout}>
        <Text style={s.logoutText}>Se déconnecter</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    paddingHorizontal: 28,
  },
  emoji: { fontSize: 64, marginBottom: 16 },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.foreground,
    fontFamily: "Inter_700Bold",
    marginBottom: 12,
  },
  body: {
    fontSize: 16,
    color: colors.foregroundMuted,
    textAlign: "center",
    lineHeight: 24,
    fontFamily: "Inter_400Regular",
  },
  email: { color: colors.primary, fontFamily: "Inter_600SemiBold" },
  hint: {
    fontSize: 14,
    color: colors.foregroundMuted,
    textAlign: "center",
    marginTop: 12,
    marginBottom: 36,
    fontFamily: "Inter_400Regular",
  },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    height: 54,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  btnText: { color: "#fff", fontSize: 17, fontWeight: "700", fontFamily: "Inter_700Bold" },
  sent: { color: colors.success, fontSize: 14, fontFamily: "Inter_400Regular", marginBottom: 16 },
  link: { marginBottom: 16 },
  linkText: { color: colors.primary, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  logout: { marginTop: "auto" },
  logoutText: { color: colors.foregroundMuted, fontSize: 14, fontFamily: "Inter_400Regular" },
});
