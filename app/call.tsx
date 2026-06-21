import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  Platform,
} from "react-native";
import { RTCView } from "react-native-webrtc";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

import { useCall } from "@/contexts/CallContext";
import colors from "@/constants/colors";

export default function CallScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    callStatus,
    callType,
    localStream,
    remoteStream,
    isMuted,
    isCameraOff,
    isSpeakerOn,
    endCall,
    toggleMute,
    toggleCamera,
    toggleSpeaker,
  } = useCall();

  const { partnerName, partnerInitial } = useLocalSearchParams<{
    partnerName: string;
    partnerInitial: string;
  }>();

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulse2Anim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (callStatus !== "active") {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 900,
            useNativeDriver: true,
          }),
        ])
      );
      const anim2 = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse2Anim, {
            toValue: 1.3,
            duration: 900,
            delay: 300,
            useNativeDriver: true,
          }),
          Animated.timing(pulse2Anim, {
            toValue: 1,
            duration: 900,
            useNativeDriver: true,
          }),
        ])
      );
      anim.start();
      anim2.start();
      return () => {
        anim.stop();
        anim2.stop();
      };
    }
  }, [callStatus]);

  useEffect(() => {
    if (callStatus === "idle") {
      router.back();
    }
  }, [callStatus]);

  async function handleEndCall() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    await endCall();
    router.back();
  }

  const statusLabel =
    callStatus === "calling"
      ? "Appel en cours…"
      : callStatus === "active"
      ? "En communication"
      : "Connexion…";

  const isVideo = callType === "video";
  const localStreamURL = localStream ? (localStream as any).toURL() : null;
  const remoteStreamURL = remoteStream ? (remoteStream as any).toURL() : null;

  return (
    <View style={s.root}>
      {isVideo && remoteStreamURL ? (
        <RTCView
          streamURL={remoteStreamURL}
          style={s.remoteVideo}
          objectFit="cover"
          mirror={false}
        />
      ) : (
        <LinearGradient
          colors={["#0a160f", "#0a140f", "#08110c"]}
          style={s.audioBackground}
        >
          <View style={s.avatarWrapper}>
            <Animated.View
              style={[
                s.avatarRing2,
                { transform: [{ scale: pulse2Anim }], opacity: 0.2 },
              ]}
            />
            <Animated.View
              style={[
                s.avatarRing,
                { transform: [{ scale: pulseAnim }], opacity: 0.35 },
              ]}
            />
            <View style={s.avatar}>
              <Text style={s.avatarInitial}>{partnerInitial ?? "?"}</Text>
            </View>
          </View>
        </LinearGradient>
      )}

      <LinearGradient
        colors={["rgba(0,0,0,0.7)", "transparent"]}
        style={[s.topOverlay, { paddingTop: insets.top + 12 }]}
      >
        <Text style={s.partnerName}>{partnerName ?? "Partenaire"}</Text>
        <Text style={s.statusLabel}>{statusLabel}</Text>
        <View style={s.callTypeBadge}>
          <Feather
            name={isVideo ? "video" : "phone"}
            size={11}
            color={colors.primary}
          />
          <Text style={s.callTypeText}>
            {isVideo ? "Appel vidéo" : "Appel audio"}
          </Text>
        </View>
      </LinearGradient>

      {isVideo && localStreamURL && (
        <View
          style={[
            s.localVideoWrapper,
            { bottom: insets.bottom + 160 },
          ]}
        >
          <RTCView
            streamURL={localStreamURL}
            style={s.localVideo}
            objectFit="cover"
            mirror={true}
            zOrder={1}
          />
          {isCameraOff && (
            <View style={s.cameraOffOverlay}>
              <Feather name="video-off" size={18} color="#fff" />
            </View>
          )}
        </View>
      )}

      <View style={[s.controls, { paddingBottom: insets.bottom + 24 }]}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            toggleMute();
          }}
          style={[s.controlBtn, isMuted && s.controlBtnActive]}
        >
          <Feather
            name={isMuted ? "mic-off" : "mic"}
            size={22}
            color={isMuted ? colors.primary : colors.foreground}
          />
          <Text style={s.controlLabel}>{isMuted ? "Muet" : "Micro"}</Text>
        </Pressable>

        {isVideo && (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              toggleCamera();
            }}
            style={[s.controlBtn, isCameraOff && s.controlBtnActive]}
          >
            <Feather
              name={isCameraOff ? "video-off" : "video"}
              size={22}
              color={isCameraOff ? colors.primary : colors.foreground}
            />
            <Text style={s.controlLabel}>Caméra</Text>
          </Pressable>
        )}

        <Pressable
          onPress={handleEndCall}
          style={s.endCallBtn}
        >
          <Feather name="phone-off" size={26} color="#fff" />
        </Pressable>

        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            toggleSpeaker();
          }}
          style={[s.controlBtn, isSpeakerOn && s.controlBtnActive]}
        >
          <Feather
            name={isSpeakerOn ? "volume-2" : "volume-x"}
            size={22}
            color={isSpeakerOn ? colors.primary : colors.foreground}
          />
          <Text style={s.controlLabel}>
            {isSpeakerOn ? "HP" : "Muet HP"}
          </Text>
        </Pressable>

        {!isVideo && (
          <View style={[s.controlBtn, { opacity: 0 }]} pointerEvents="none" />
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000",
  },
  remoteVideo: {
    flex: 1,
  },
  audioBackground: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarWrapper: {
    alignItems: "center",
    justifyContent: "center",
  },
  avatarRing: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.primary,
  },
  avatarRing2: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.primary,
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: colors.primaryDim,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: colors.primary,
  },
  avatarInitial: {
    fontSize: 48,
    fontWeight: "700",
    color: "#fff",
    fontFamily: "Inter_700Bold",
  },
  topOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingBottom: 40,
    alignItems: "center",
  },
  partnerName: {
    fontSize: 26,
    fontWeight: "700",
    color: "#fff",
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  statusLabel: {
    fontSize: 14,
    color: "rgba(255,255,255,0.75)",
    fontFamily: "Inter_400Regular",
    marginTop: 4,
  },
  callTypeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(47,174,108,0.18)",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 8,
  },
  callTypeText: {
    fontSize: 11,
    color: colors.primary,
    fontFamily: "Inter_500Medium",
  },
  localVideoWrapper: {
    position: "absolute",
    right: 16,
    width: 100,
    height: 150,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: colors.primary,
    elevation: 8,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  localVideo: {
    flex: 1,
  },
  cameraOffOverlay: {
    position: "absolute",
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  controls: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-evenly",
    paddingTop: 20,
    paddingHorizontal: 16,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  controlBtn: {
    alignItems: "center",
    gap: 6,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.12)",
    justifyContent: "center",
  },
  controlBtnActive: {
    backgroundColor: "rgba(47,174,108,0.22)",
  },
  controlLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.7)",
    fontFamily: "Inter_400Regular",
    position: "absolute",
    bottom: -18,
  },
  endCallBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#e05050",
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#e05050",
    shadowOpacity: 0.5,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
});
