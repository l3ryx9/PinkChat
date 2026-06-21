import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
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

export default function OnboardingScreen() {
  const { setUsername, logOut } = useAuth();
  const insets = useSafeAreaInsets();

  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [surnom, setSurnom] = useState("");
  const [username, setUsernameValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isUsernameValid = /^[a-zA-Z0-9-]{3,20}$/.test(username);
  const isSurnomValid = surnom.trim().length >= 2 && surnom.trim().length <= 30;
  const canSubmit = isUsernameValid && isSurnomValid && !loading;

  async function pickAvatar() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      setError("Autorise l'accès à ta galerie pour choisir un avatar.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
      setError("");
    }
  }

  async function handleConfirm() {
    if (!isSurnomValid) {
      setError("Le surnom doit faire entre 2 et 30 caractères.");
      return;
    }
    if (!isUsernameValid) {
      setError("3 à 20 caractères, lettres, chiffres et tirets seulement.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await setUsername(username, surnom, avatarUri ?? undefined);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      setError(e.message || "Erreur. Réessaie.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          s.inner,
          { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.emoji}>💚</Text>
        <Text style={s.title}>Crée ton profil</Text>
        <Text style={s.body}>
          Choisis ton surnom et ton @username.{"\n"}
          L'@username ne pourra <Text style={{ color: colors.primary }}>pas</Text> être changé.
        </Text>

        {/* Avatar picker */}
        <Pressable style={s.avatarWrap} onPress={pickAvatar}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={s.avatar} />
          ) : (
            <View style={s.avatarPlaceholder}>
              <Feather name="user" size={36} color={colors.foregroundMuted} />
            </View>
          )}
          <View style={s.cameraBtn}>
            <Feather name="camera" size={14} color="#fff" />
          </View>
        </Pressable>
        <Text style={s.avatarHint}>
          {avatarUri ? "Appuie pour changer" : "Ajouter une photo (optionnel)"}
        </Text>

        {/* Surnom */}
        <View style={s.field}>
          <Text style={s.label}>SURNOM *</Text>
          <View style={[s.inputWrap, surnom.length > 0 && !isSurnomValid && s.inputError]}>
            <Feather name="smile" size={18} color={colors.foregroundMuted} style={s.icon} />
            <TextInput
              style={s.input}
              value={surnom}
              onChangeText={(t) => {
                setError("");
                setSurnom(t);
              }}
              placeholder="Ton prénom ou surnom"
              placeholderTextColor={colors.foregroundMuted}
              autoCapitalize="words"
              autoCorrect={false}
              maxLength={30}
            />
            {surnom.length >= 2 && (
              <Feather
                name={isSurnomValid ? "check-circle" : "x-circle"}
                size={18}
                color={isSurnomValid ? colors.success : colors.destructive}
              />
            )}
          </View>
          <Text style={s.hint}>Visible par ton partenaire • 2-30 caractères</Text>
        </View>

        {/* Username */}
        <View style={s.field}>
          <Text style={s.label}>@USERNAME *</Text>
          <View style={[s.inputWrap, username.length > 0 && !isUsernameValid && s.inputError]}>
            <Text style={s.at}>@</Text>
            <TextInput
              style={s.input}
              value={username}
              onChangeText={(t) => {
                setError("");
                setUsernameValue(t.toLowerCase().replace(/[^a-z0-9-]/g, ""));
              }}
              placeholder="ton_username"
              placeholderTextColor={colors.foregroundMuted}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={20}
            />
            {username.length >= 3 && (
              <Feather
                name={isUsernameValid ? "check-circle" : "x-circle"}
                size={18}
                color={isUsernameValid ? colors.success : colors.destructive}
              />
            )}
          </View>
          <Text style={s.hint}>
            Ton partenaire te retrouvera avec ce nom • 3-20 caractères
          </Text>
        </View>

        {error ? <Text style={s.error}>{error}</Text> : null}

        <Pressable
          style={[s.btn, !canSubmit && { opacity: 0.5 }]}
          onPress={handleConfirm}
          disabled={!canSubmit}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.btnText}>Créer mon profil 💚</Text>
          )}
        </Pressable>

        <Pressable onPress={logOut} style={s.logout}>
          <Text style={s.logoutText}>Se déconnecter</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const AVATAR_SIZE = 96;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  inner: { paddingHorizontal: 28, alignItems: "center" },
  emoji: { fontSize: 48, marginBottom: 10 },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.foreground,
    fontFamily: "Inter_700Bold",
    marginBottom: 10,
    textAlign: "center",
  },
  body: {
    fontSize: 14,
    color: colors.foregroundMuted,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 28,
    fontFamily: "Inter_400Regular",
  },
  avatarWrap: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    marginBottom: 8,
    position: "relative",
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  avatarPlaceholder: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  cameraBtn: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.background,
  },
  avatarHint: {
    fontSize: 12,
    color: colors.foregroundMuted,
    fontFamily: "Inter_400Regular",
    marginBottom: 28,
  },
  field: { width: "100%", gap: 8, marginBottom: 20 },
  label: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.foregroundMuted,
    fontFamily: "Inter_600SemiBold",
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
    height: 56,
    gap: 8,
  },
  inputError: {
    borderColor: colors.destructive + "80",
  },
  icon: {},
  at: {
    fontSize: 22,
    color: colors.primary,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  input: {
    flex: 1,
    fontSize: 17,
    color: colors.foreground,
    fontFamily: "Inter_500Medium",
  },
  hint: {
    fontSize: 12,
    color: colors.foregroundMuted,
    fontFamily: "Inter_400Regular",
  },
  error: {
    color: colors.destructive,
    fontSize: 13,
    textAlign: "center",
    marginBottom: 12,
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
  btnText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  logout: { marginTop: 8 },
  logoutText: {
    color: colors.foregroundMuted,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
});
