import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useCall } from "@/contexts/CallContext";
import colors from "@/constants/colors";

export default function IncomingCallModal() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { callStatus, incomingCall, acceptCall, declineCall } = useCall();
  const visible = callStatus === "ringing" && incomingCall !== null;

  const slideAnim = useRef(new Animated.Value(-200)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }).start();

      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.08,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 700,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return () => pulse.stop();
    } else {
      Animated.timing(slideAnim, {
        toValue: -200,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  if (!incomingCall) return null;

  const isVideo = incomingCall.type === "video";

  async function handleAccept() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await acceptCall();
    router.push({
      pathname: "/call",
      params: {
        partnerName: incomingCall!.callerName,
        partnerInitial: incomingCall!.callerInitial,
      },
    });
  }

  async function handleDecline() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    await declineCall();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
    >
      <View style={[s.overlay, { paddingTop: insets.top + 12 }]}>
        <Animated.View
          style={[
            s.card,
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          <View style={s.info}>
            <Animated.View
              style={[s.avatar, { transform: [{ scale: pulseAnim }] }]}
            >
              <Text style={s.avatarText}>{incomingCall.callerInitial}</Text>
            </Animated.View>
            <View style={s.text}>
              <Text style={s.name}>{incomingCall.callerName}</Text>
              <View style={s.typeBadge}>
                <Feather
                  name={isVideo ? "video" : "phone"}
                  size={11}
                  color={colors.primary}
                />
                <Text style={s.typeText}>
                  {isVideo ? "Appel vidéo entrant" : "Appel audio entrant"}
                </Text>
              </View>
            </View>
          </View>

          <View style={s.actions}>
            <Pressable style={s.declineBtn} onPress={handleDecline}>
              <Feather name="phone-off" size={22} color="#fff" />
              <Text style={s.btnLabel}>Refuser</Text>
            </Pressable>
            <Pressable style={s.acceptBtn} onPress={handleAccept}>
              <Feather
                name={isVideo ? "video" : "phone"}
                size={22}
                color="#fff"
              />
              <Text style={s.btnLabel}>Accepter</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 16,
    backgroundColor: "transparent",
    pointerEvents: "box-none",
  },
  card: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 16,
  },
  info: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 20,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primaryDim,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.primary,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
    fontFamily: "Inter_700Bold",
  },
  text: { flex: 1 },
  name: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.foreground,
    fontFamily: "Inter_700Bold",
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 4,
  },
  typeText: {
    fontSize: 12,
    color: colors.primary,
    fontFamily: "Inter_400Regular",
  },
  actions: {
    flexDirection: "row",
    gap: 12,
  },
  declineBtn: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#c0392b",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    flexDirection: "row",
  },
  acceptBtn: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#27ae60",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    flexDirection: "row",
  },
  btnLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
    fontFamily: "Inter_600SemiBold",
  },
});
