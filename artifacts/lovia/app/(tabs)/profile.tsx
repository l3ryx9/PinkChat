import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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

const PARTNER_NICKNAME_KEY = "adeux_partner_nickname";

export default function ProfileScreen() {
  const { user, profile, logOut, updateDisplayName } = useAuth();
  const insets = useSafeAreaInsets();

  const [editingName, setEditingName] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.displayName ?? "");
  const [partnerNickname, setPartnerNickname] = useState("");
  const [editingNick, setEditingNick] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile?.displayName) setDisplayName(profile.displayName);
  }, [profile?.displayName]);

  useEffect(() => {
    AsyncStorage.getItem(PARTNER_NICKNAME_KEY).then((v) => {
      if (v) setPartnerNickname(v);
    });
  }, []);

  async function saveName() {
    if (!displayName.trim()) return;
    setSaving(true);
    try {
      await updateDisplayName(displayName.trim());
      setEditingName(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } finally {
      setSaving(false);
    }
  }

  async function saveNickname() {
    await AsyncStorage.setItem(PARTNER_NICKNAME_KEY, partnerNickname.trim());
    setEditingNick(false);
    Haptics.selectionAsync();
  }

  async function pickAvatar() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }

  function handleLogout() {
    Alert.alert(
      "Se déconnecter",
      "Tu pourras te reconnecter avec tes identifiants.",
      [
        { text: "Annuler", style: "cancel" },
        { text: "Se déconnecter", style: "destructive", onPress: logOut },
      ]
    );
  }

  const initials = (profile?.displayName ?? "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const topPad = Platform.OS === "web" ? 20 : insets.top;

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={[s.content, { paddingTop: topPad + 20 }]}
      showsVerticalScrollIndicator={false}
    >

      <View style={s.avatarSection}>
        <Pressable style={s.avatarWrap} onPress={pickAvatar}>
          {profile?.avatarUrl ? (
            <Image source={{ uri: profile.avatarUrl }} style={s.avatarImg} />
          ) : (
            <View style={s.avatarPlaceholder}>
              <Text style={s.avatarInitials}>{initials}</Text>
            </View>
          )}
          <View style={s.cameraBtn}>
            <Feather name="camera" size={14} color="#fff" />
          </View>
        </Pressable>

        {editingName ? (
          <View style={s.editNameRow}>
            <TextInput
              style={s.nameInput}
              value={displayName}
              onChangeText={setDisplayName}
              autoFocus
              maxLength={40}
              returnKeyType="done"
              onSubmitEditing={saveName}
            />
            <Pressable style={s.saveBtn} onPress={saveName} disabled={saving}>
              {saving
                ? <ActivityIndicator color="#fff" size="small" />
                : <Feather name="check" size={18} color="#fff" />
              }
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={() => setEditingName(true)} style={s.nameRow}>
            <Text style={s.name}>{profile?.displayName ?? "—"}</Text>
            <Feather name="edit-2" size={14} color={colors.foregroundMuted} />
          </Pressable>
        )}

        <Text style={s.username}>@{profile?.username ?? "—"}</Text>
        <Text style={s.email}>{user?.email}</Text>
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>💚 Surnom du partenaire</Text>
        <Text style={s.cardHint}>Uniquement visible par toi, jamais envoyé.</Text>
        {editingNick ? (
          <View style={s.nickRow}>
            <TextInput
              style={s.nickInput}
              value={partnerNickname}
              onChangeText={setPartnerNickname}
              placeholder="Mon ange, Chouchou…"
              placeholderTextColor={colors.foregroundMuted}
              autoFocus
              maxLength={30}
              returnKeyType="done"
              onSubmitEditing={saveNickname}
            />
            <Pressable style={s.saveBtn} onPress={saveNickname}>
              <Feather name="check" size={18} color="#fff" />
            </Pressable>
          </View>
        ) : (
          <Pressable style={s.nickDisplay} onPress={() => setEditingNick(true)}>
            <Text style={s.nickText}>
              {partnerNickname || "Ajouter un surnom…"}
            </Text>
            <Feather name="edit-2" size={14} color={colors.foregroundMuted} />
          </Pressable>
        )}
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Informations</Text>
        <View style={s.infoRow}>
          <Text style={s.infoLabel}>Statut</Text>
          <Text style={s.infoVal}>
            {profile?.partnerId ? "💑 Lié(e)" : "🔍 Sans partenaire"}
          </Text>
        </View>
        <View style={s.infoRow}>
          <Text style={s.infoLabel}>Lien permanent</Text>
          <Text style={s.infoVal}>
            {profile?.partnerLocked ? "🔒 Oui" : "Non"}
          </Text>
        </View>
      </View>

      <Pressable style={s.logoutBtn} onPress={handleLogout}>
        <Feather name="log-out" size={18} color={colors.destructive} />
        <Text style={s.logoutText}>Se déconnecter</Text>
      </Pressable>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingBottom: 100 },
  avatarSection: { alignItems: "center", marginBottom: 28 },
  avatarWrap: { marginBottom: 16 },
  avatarImg: { width: 90, height: 90, borderRadius: 45 },
  avatarPlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: { color: "#fff", fontSize: 34, fontWeight: "800", fontFamily: "Inter_700Bold" },
  cameraBtn: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.secondary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.background,
  },
  editNameRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  nameInput: {
    borderBottomWidth: 1,
    borderBottomColor: colors.primary,
    color: colors.foreground,
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    minWidth: 140,
    textAlign: "center",
    paddingBottom: 4,
  },
  saveBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  name: { fontSize: 22, fontWeight: "800", color: colors.foreground, fontFamily: "Inter_700Bold" },
  username: { fontSize: 14, color: colors.primary, fontFamily: "Inter_500Medium", marginBottom: 4 },
  email: { fontSize: 12, color: colors.foregroundMuted, fontFamily: "Inter_400Regular" },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.foreground,
    fontFamily: "Inter_700Bold",
  },
  cardHint: { fontSize: 12, color: colors.foregroundMuted, fontFamily: "Inter_400Regular" },
  nickRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  nickInput: {
    flex: 1,
    backgroundColor: colors.secondary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    color: colors.foreground,
    fontFamily: "Inter_400Regular",
  },
  nickDisplay: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.secondary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  nickText: { color: colors.foreground, fontSize: 15, fontFamily: "Inter_400Regular" },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  infoLabel: { color: colors.foregroundMuted, fontSize: 13, fontFamily: "Inter_400Regular" },
  infoVal: { color: colors.foreground, fontSize: 13, fontFamily: "Inter_500Medium" },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    marginTop: 8,
  },
  logoutText: { color: colors.destructive, fontSize: 16, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
});
