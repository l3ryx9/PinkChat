import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { useAuth, UserProfile } from "@/contexts/AuthContext";
import colors from "@/constants/colors";

export default function FindPartnerScreen() {
  const { profile, searchByUsername, linkPartner, logOut } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [found, setFound] = useState<UserProfile | null>(null);
  const [searching, setSearching] = useState(false);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);

  async function handleSearch() {
    const q = query.trim().toLowerCase().replace(/^@/, "");
    if (!q) return;
    if (q === profile?.username) {
      setError("Tu ne peux pas te lier à toi-même 😅");
      return;
    }
    setSearching(true);
    setError("");
    setNotFound(false);
    setFound(null);
    try {
      const result = await searchByUsername(q);
      if (!result) {
        setNotFound(true);
      } else if (result.partnerId && result.partnerId !== profile?.uid) {
        // Déjà lié à quelqu'un d'autre (pas à moi)
        setError("Cette personne est déjà liée à quelqu'un.");
      } else {
        // Soit libre, soit déjà lié à moi (confirmation réciproque)
        setFound(result);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      setError("Une erreur est survenue.");
    } finally {
      setSearching(false);
    }
  }

  async function handleLink() {
    if (!found) return;
    setLinking(true);
    try {
      await linkPartner(found.uid);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Ne pas naviguer ici manuellement : le onSnapshot dans AuthContext
      // va mettre à jour profile.partnerId, ce qui déclenchera RootGuard
      // dans _layout.tsx pour naviguer vers /(tabs) au bon moment.
    } catch {
      setError("Impossible de créer le lien. Réessaie.");
      setLinking(false);
    }
    // Note: setLinking(false) est intentionnellement omis en cas de succès
    // car RootGuard va démonter cet écran automatiquement.
  }

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >

      <View style={[s.inner, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 40 }]}>
        <Text style={s.emoji}>💑</Text>
        <Text style={s.title}>Trouve ton partenaire</Text>
        <Text style={s.body}>
          Lie-toi à une seule personne.{"\n"}
          Ce lien sera <Text style={{ color: colors.primary }}>permanent</Text>.
        </Text>

        <Text style={s.myUsername}>
          Ton @username : <Text style={s.usernameVal}>@{profile?.username}</Text>
        </Text>

        <View style={s.searchRow}>
          <View style={s.inputWrap}>
            <Text style={s.at}>@</Text>
            <TextInput
              style={s.input}
              value={query}
              onChangeText={(t) => {
                setQuery(t);
                setFound(null);
                setNotFound(false);
                setError("");
              }}
              placeholder="username_partenaire"
              placeholderTextColor={colors.foregroundMuted}
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={handleSearch}
            />
          </View>
          <Pressable
            style={[s.searchBtn, searching && { opacity: 0.6 }]}
            onPress={handleSearch}
            disabled={searching}
          >
            {searching
              ? <ActivityIndicator color="#fff" size="small" />
              : <Feather name="search" size={20} color="#fff" />
            }
          </Pressable>
        </View>

        {notFound && <Text style={s.notFound}>Aucun utilisateur trouvé avec ce @username.</Text>}
        {error ? <Text style={s.error}>{error}</Text> : null}

        {found && (
          <View style={s.card}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>
                {found.displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={s.cardInfo}>
              <Text style={s.cardName}>{found.displayName}</Text>
              <Text style={s.cardUsername}>@{found.username}</Text>
            </View>
          </View>
        )}

        {found && (
          <View style={s.confirmBox}>
            <Text style={s.confirmText}>
              ⚠️ Ce lien est <Text style={s.bold}>définitif et irréversible</Text>.{"\n"}
              Tu es sûr·e ?
            </Text>
            <Pressable
              style={[s.linkBtn, linking && { opacity: 0.7 }]}
              onPress={handleLink}
              disabled={linking}
            >
              {linking
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.linkBtnText}>Créer le lien 💚</Text>
              }
            </Pressable>
          </View>
        )}

        <Pressable onPress={logOut} style={s.logout}>
          <Text style={s.logoutText}>Se déconnecter</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  inner: { flex: 1, paddingHorizontal: 24, alignItems: "center" },
  emoji: { fontSize: 56, marginBottom: 12 },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.foreground,
    fontFamily: "Inter_700Bold",
    marginBottom: 10,
    textAlign: "center",
  },
  body: {
    fontSize: 15,
    color: colors.foregroundMuted,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 24,
    fontFamily: "Inter_400Regular",
  },
  myUsername: {
    fontSize: 13,
    color: colors.foregroundMuted,
    marginBottom: 24,
    fontFamily: "Inter_400Regular",
  },
  usernameVal: { color: colors.primary, fontFamily: "Inter_600SemiBold" },
  searchRow: { flexDirection: "row", width: "100%", gap: 10, marginBottom: 16 },
  inputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    height: 52,
    gap: 6,
  },
  at: { fontSize: 20, color: colors.primary, fontWeight: "700", fontFamily: "Inter_700Bold" },
  input: { flex: 1, fontSize: 16, color: colors.foreground, fontFamily: "Inter_400Regular" },
  searchBtn: {
    backgroundColor: colors.primary,
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  notFound: { color: colors.foregroundMuted, fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 8 },
  error: { color: colors.destructive, fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 8 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    width: "100%",
    marginBottom: 16,
    gap: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontSize: 22, fontWeight: "700", fontFamily: "Inter_700Bold" },
  cardInfo: { flex: 1 },
  cardName: { color: colors.foreground, fontSize: 16, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  cardUsername: { color: colors.foregroundMuted, fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  confirmBox: {
    backgroundColor: colors.cardElevated,
    borderRadius: 16,
    padding: 20,
    width: "100%",
    alignItems: "center",
    gap: 16,
    borderWidth: 1,
    borderColor: colors.primary + "40",
  },
  confirmText: {
    color: colors.foregroundMuted,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 22,
    fontFamily: "Inter_400Regular",
  },
  bold: { fontWeight: "700", color: colors.foreground, fontFamily: "Inter_700Bold" },
  linkBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: "100%",
    alignItems: "center",
  },
  linkBtnText: { color: "#fff", fontSize: 16, fontWeight: "700", fontFamily: "Inter_700Bold" },
  logout: { marginTop: "auto" },
  logoutText: { color: colors.foregroundMuted, fontSize: 14, fontFamily: "Inter_400Regular" },
});
