import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCall } from "@/contexts/CallContext";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  ImageBackground,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Svg, { Path, G, Ellipse } from "react-native-svg";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  doc,
  where,
  limit,
} from "firebase/firestore";

import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/firebase/config";
import { sendPushNotification } from "@/services/notifications";
import { saveMessages, loadMessages } from "@/services/sqlite";
import {
  analyzeConversation,
  analyzeConflict,
  computeLiveScore,
  LiveScore,
  AnalysisResult,
} from "@/services/aiAnalysis";
import colors from "@/constants/colors";

const FERN_BG = require("../../assets/images/fern-bg.png");

interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  createdAt: number;
  deliveredAt: number | null;
  readAt: number | null;
}

function getBubbleId(uid1: string, uid2: string) {
  return [uid1, uid2].sort().join("_");
}

function formatLastSeen(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `il y a ${hrs}h`;
  return `il y a ${Math.floor(hrs / 24)}j`;
}

// ─── Feuilles décoratives (jungle) ────────────────────────────────────────────

function JungleLeaf({
  style,
  color = "rgba(47,174,108,0.18)",
  size = 60,
  rotation = 0,
}: {
  style?: any;
  color?: string;
  size?: number;
  rotation?: number;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={[{ position: "absolute", transform: [{ rotate: `${rotation}deg` }] }, style]}
    >
      <G>
        <Path
          d="M50 5 C70 20 95 40 90 70 C85 90 60 98 50 95 C40 98 15 90 10 70 C5 40 30 20 50 5 Z"
          fill={color}
        />
        <Path
          d="M50 5 L50 95"
          stroke="rgba(47,174,108,0.25)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <Path
          d="M50 30 C40 38 30 42 20 40"
          stroke="rgba(47,174,108,0.18)"
          strokeWidth="1"
          strokeLinecap="round"
        />
        <Path
          d="M50 30 C60 38 70 42 80 40"
          stroke="rgba(47,174,108,0.18)"
          strokeWidth="1"
          strokeLinecap="round"
        />
        <Path
          d="M50 55 C38 62 26 65 16 62"
          stroke="rgba(47,174,108,0.18)"
          strokeWidth="1"
          strokeLinecap="round"
        />
        <Path
          d="M50 55 C62 62 74 65 84 62"
          stroke="rgba(47,174,108,0.18)"
          strokeWidth="1"
          strokeLinecap="round"
        />
      </G>
    </Svg>
  );
}

// ─── Checkmarks ───────────────────────────────────────────────────────────────

const MessageTicks = React.memo(function MessageTicks({ msg }: { msg: Message }) {
  if (msg.readAt) return <Text style={[tick.base, tick.read]}>✓✓</Text>;
  if (msg.deliveredAt) return <Text style={[tick.base, tick.delivered]}>✓✓</Text>;
  return <Text style={[tick.base, tick.sent]}>✓</Text>;
});

const tick = StyleSheet.create({
  base: { fontSize: 11, marginLeft: 3 },
  sent: { color: "rgba(255,255,255,0.45)" },
  delivered: { color: "rgba(255,255,255,0.45)" },
  read: { color: "#4fc3f7" },
});

// ─── Live Score Badge ─────────────────────────────────────────────────────────

const LiveScoreBadge = React.memo(function LiveScoreBadge({
  score,
  onPress,
}: {
  score: LiveScore;
  onPress: () => void;
}) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(pulse, { toValue: 1.12, duration: 180, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
  }, [score.value]);

  const trendIcon =
    score.trend === "up" ? "trending-up" :
    score.trend === "down" ? "trending-down" : "minus";

  return (
    <Pressable onPress={onPress} style={ls.wrapper}>
      <Animated.View
        style={[
          ls.badge,
          { borderColor: score.color + "55", transform: [{ scale: pulse }] },
        ]}
      >
        <Feather name={trendIcon as any} size={11} color={score.color} />
        <Text style={[ls.value, { color: score.color }]}>{score.value}</Text>
        <Text style={ls.slash}>/100</Text>
      </Animated.View>
      <Text style={ls.label}>{score.label}</Text>
    </Pressable>
  );
});

const ls = StyleSheet.create({
  wrapper: { alignItems: "flex-end", gap: 2 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  value: { fontSize: 13, fontWeight: "700", fontFamily: "Inter_700Bold" },
  slash: { fontSize: 10, color: colors.foregroundMuted, fontFamily: "Inter_400Regular" },
  label: { fontSize: 10, color: colors.foregroundMuted, fontFamily: "Inter_400Regular" },
});

// ─── Score Bar ────────────────────────────────────────────────────────────────

function ScoreBar({ label, value, color = colors.primary }: { label: string; value: number; color?: string }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: value / 100, duration: 700, delay: 100, useNativeDriver: false }).start();
  }, [value]);
  return (
    <View style={sb.row}>
      <Text style={sb.label}>{label}</Text>
      <View style={sb.track}>
        <Animated.View
          style={[
            sb.fill,
            {
              width: anim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
              backgroundColor: color,
            },
          ]}
        />
      </View>
      <Text style={sb.val}>{value}</Text>
    </View>
  );
}

const sb = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  label: { width: 86, fontSize: 12, color: colors.foregroundMuted, fontFamily: "Inter_400Regular" },
  track: { flex: 1, height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 3 },
  val: { width: 28, fontSize: 12, color: colors.foreground, textAlign: "right", fontFamily: "Inter_500Medium" },
});

// ─── Analyse modale ────────────────────────────────────────────────────────────

function AnalysisModal({
  visible,
  onClose,
  messages,
  myId,
}: {
  visible: boolean;
  onClose: () => void;
  messages: Message[];
  myId: string;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!visible) return;
    setResult(null);
    setLoading(true);
    const msgs = messages.map((m) => ({ content: m.content, senderId: m.senderId }));
    analyzeConversation(msgs, myId)
      .then(setResult)
      .finally(() => setLoading(false));
  }, [visible]);

  const scoreColor =
    result && result.scores.global >= 80 ? colors.success :
    result && result.scores.global >= 55 ? "#e8d479" :
    colors.destructive;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[am.root, { paddingTop: insets.top + 8 }]}>
        <View style={am.header}>
          <Text style={am.title}>Analyse IA</Text>
          <Pressable onPress={onClose} style={am.closeBtn}>
            <Feather name="x" size={20} color={colors.foreground} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={am.content} showsVerticalScrollIndicator={false}>
          {loading && (
            <View style={am.loadingBox}>
              <ActivityIndicator color={colors.primary} size="large" />
              <Text style={am.loadingText}>Analyse de la conversation en cours…</Text>
              <Text style={am.loadingHint}>{messages.length} messages analysés</Text>
            </View>
          )}

          {!loading && result && (
            <>
              <View style={am.scoreCard}>
                <Text style={[am.scoreNum, { color: scoreColor }]}>{result.scores.global}</Text>
                <Text style={am.scoreDenom}>/100</Text>
                {result.isAI && (
                  <View style={am.aiBadge}>
                    <Feather name="cpu" size={10} color={colors.primary} />
                    <Text style={am.aiBadgeText}>IA locale</Text>
                  </View>
                )}
              </View>

              <View style={am.section}>
                <Text style={am.sectionTitle}>Sous-scores</Text>
                <ScoreBar label="Respect" value={result.scores.respect} />
                <ScoreBar label="Empathie" value={result.scores.empathie} />
                <ScoreBar label="Honnêteté" value={result.scores.honnetete} />
                <ScoreBar label="Limites" value={result.scores.limites} />
                <ScoreBar label="Positivité" value={result.scores.positivite} color={colors.success} />
              </View>

              {result.redFlags.length > 0 && (
                <View style={am.section}>
                  <Text style={am.sectionTitle}>Points d'attention</Text>
                  {result.redFlags.map((f, i) => (
                    <View key={i} style={[am.flagRow, { borderColor: colors.destructive + "33" }]}>
                      <Feather name="alert-triangle" size={14} color={colors.destructive} />
                      <View style={{ flex: 1 }}>
                        <Text style={[am.flagText, { color: colors.destructive }]}>
                          {f.texte}
                          {f.severite && <Text style={am.flagSev}> · {f.severite}</Text>}
                        </Text>
                        <Text style={am.flagCtx}>{f.contexte}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {result.greenFlags.length > 0 && (
                <View style={am.section}>
                  <Text style={am.sectionTitle}>Points positifs</Text>
                  {result.greenFlags.map((f, i) => (
                    <View key={i} style={[am.flagRow, { borderColor: colors.success + "33" }]}>
                      <Feather name="check-circle" size={14} color={colors.success} />
                      <View style={{ flex: 1 }}>
                        <Text style={[am.flagText, { color: colors.success }]}>{f.texte}</Text>
                        <Text style={am.flagCtx}>{f.contexte}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              <View style={am.section}>
                <Text style={am.sectionTitle}>Résumé</Text>
                <Text style={am.resume}>{result.resume}</Text>
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const am = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 20, fontWeight: "800", color: colors.foreground, fontFamily: "Inter_700Bold" },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 60 },
  loadingBox: { alignItems: "center", paddingVertical: 60, gap: 12 },
  loadingText: { color: colors.foreground, fontSize: 15, fontFamily: "Inter_400Regular" },
  loadingHint: { color: colors.foregroundMuted, fontSize: 12, fontFamily: "Inter_400Regular" },
  scoreCard: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    marginBottom: 32,
    gap: 4,
    position: "relative",
  },
  scoreNum: { fontSize: 80, fontWeight: "800", fontFamily: "Inter_700Bold", lineHeight: 88 },
  scoreDenom: { fontSize: 22, color: colors.foregroundMuted, fontFamily: "Inter_400Regular", marginBottom: 12 },
  aiBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.primaryMuted,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  aiBadgeText: { color: colors.primary, fontSize: 10, fontFamily: "Inter_400Regular" },
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.foreground,
    fontFamily: "Inter_700Bold",
    marginBottom: 12,
  },
  flagRow: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    alignItems: "flex-start",
  },
  flagText: { fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  flagSev: { fontWeight: "400", color: colors.foregroundMuted },
  flagCtx: { fontSize: 11, color: colors.foregroundMuted, marginTop: 2, fontFamily: "Inter_400Regular" },
  resume: {
    color: colors.foreground,
    fontSize: 14,
    lineHeight: 22,
    fontFamily: "Inter_400Regular",
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
  },
});

// ─── Écran principal ──────────────────────────────────────────────────────────

export default function MessagesScreen() {
  const { user, profile } = useAuth();
  const { startCall, callStatus } = useCall();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const flatRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [partnerName, setPartnerName] = useState("Partenaire");
  const [partnerUsername, setPartnerUsername] = useState("");
  const [partnerInitial, setPartnerInitial] = useState("?");
  const [partnerOnline, setPartnerOnline] = useState(false);
  const [partnerLastSeen, setPartnerLastSeen] = useState<number | null>(null);
  const [conflictAdvice, setConflictAdvice] = useState<string | null>(null);
  const [loadingConflict, setLoadingConflict] = useState(false);
  const [analysisVisible, setAnalysisVisible] = useState(false);

  const messagesRef = useRef<Message[]>([]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const partnerId = profile?.partnerId;

  const liveScore = useMemo(
    () => computeLiveScore(messages.map((m) => ({ content: m.content, senderId: m.senderId }))),
    [messages]
  );

  useEffect(() => {
    if (!partnerId) return;
    const unsub = onSnapshot(doc(db, "users", partnerId), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      const name = data.displayName || data.username || "Partenaire";
      setPartnerName(name);
      setPartnerUsername(data.username ?? "");
      setPartnerInitial((name[0] ?? "?").toUpperCase());
      setPartnerOnline(data.isOnline === true);
      const lastSeenTs = data.lastSeen?.toMillis?.();
      setPartnerLastSeen(lastSeenTs ?? null);
    });
    return unsub;
  }, [partnerId]);

  useEffect(() => {
    if (!user || !partnerId) return;

    const cached = loadMessages(user.uid, partnerId, 50).reverse();
    if (cached.length > 0) setMessages(cached);

    let sent: Message[] = [];
    let received: Message[] = [];

    function merge() {
      const all = [...sent, ...received].sort((a, b) => a.createdAt - b.createdAt);
      const seen = new Set<string>();
      const unique = all.filter((m) => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      });
      setMessages(unique);
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => saveMessages(unique), 1000);
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    }

    const qSent = query(
      collection(db, "messages"),
      where("senderId", "==", user.uid),
      where("receiverId", "==", partnerId),
      orderBy("createdAt", "asc"),
      limit(50)
    );

    const qReceived = query(
      collection(db, "messages"),
      where("senderId", "==", partnerId),
      where("receiverId", "==", user.uid),
      orderBy("createdAt", "asc"),
      limit(50)
    );

    const unsubSent = onSnapshot(qSent, (snap) => {
      sent = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Message));
      merge();
    }, (err) => console.error("[Firestore] sent:", err.code, err.message));

    const unsubReceived = onSnapshot(qReceived, (snap) => {
      received = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Message));
      merge();

      snap.docs.forEach((d) => {
        const m = d.data() as Message;
        const updates: Record<string, any> = {};
        if (!m.deliveredAt) updates.deliveredAt = serverTimestamp();
        if (!m.readAt) updates.readAt = serverTimestamp();
        if (Object.keys(updates).length > 0) {
          updateDoc(doc(db, "messages", d.id), updates);
        }
      });
    }, (err) => console.error("[Firestore] received:", err.code, err.message));

    return () => { unsubSent(); unsubReceived(); };
  }, [user?.uid, partnerId]);

  async function handleSend() {
    if (!text.trim() || !user || !partnerId) return;
    const content = text.trim();
    setText("");
    setSending(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await addDoc(collection(db, "messages"), {
        senderId: user.uid,
        receiverId: partnerId,
        content,
        createdAt: Date.now(),
        deliveredAt: null,
        readAt: null,
      });
      // Envoi notification push au partenaire
      const tokenSnap = await import("firebase/firestore").then(({ getDoc, doc: firestoreDoc }) =>
        getDoc(firestoreDoc(db, "push_tokens", partnerId))
      );
      if (tokenSnap.exists()) {
        const token = tokenSnap.data().token as string;
        const senderName = profile?.displayName || "Votre partenaire";
        sendPushNotification(token, senderName, content);
      }
    } catch (err) {
      console.error("[Firestore] Envoi message échoué:", err);
    } finally {
      setSending(false);
    }
  }

  const handleLongPress = useCallback(async (msg: Message) => {
    if (msg.senderId !== user?.uid) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoadingConflict(true);
    setConflictAdvice(null);
    const advice = await analyzeConflict(
      messagesRef.current.map((m) => ({ content: m.content, senderId: m.senderId })),
      user!.uid
    );
    setConflictAdvice(advice);
    setLoadingConflict(false);
  }, [user?.uid]);

  const presenceLabel = partnerOnline
    ? "En ligne"
    : partnerLastSeen
      ? `Vu ${formatLastSeen(partnerLastSeen)}`
      : partnerUsername
        ? `@${partnerUsername}`
        : "";

  const handleStartCall = useCallback(async (type: "video" | "audio") => {
    if (!partnerId || callStatus !== "idle") return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await startCall(partnerId, type);
    router.push({
      pathname: "/call",
      params: { partnerName, partnerInitial },
    });
  }, [partnerId, callStatus, startCall, router, partnerName, partnerInitial]);

  const renderMessage = useCallback(
    ({ item }: { item: Message }) => {
      const isMe = item.senderId === user?.uid;
      return (
        <Pressable
          onLongPress={() => handleLongPress(item)}
          style={[s.bubble, isMe ? s.bubbleMe : s.bubbleThem]}
          delayLongPress={600}
        >
          <Text style={[s.bubbleText, isMe ? s.bubbleTextMe : s.bubbleTextThem]}>
            {item.content}
          </Text>
          <View style={s.bubbleFooter}>
            <Text style={[s.bubbleTime, isMe && { color: "rgba(255,255,255,0.6)" }]}>
              {new Date(item.createdAt).toLocaleTimeString("fr-FR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
            {isMe && <MessageTicks msg={item} />}
          </View>
        </Pressable>
      );
    },
    [user?.uid, handleLongPress]
  );

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === "ios" ? "padding" : "padding"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 80}
    >
      {/* ── Header avec décorations forêt ── */}
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        {/* Feuilles décoratives dans le header */}
        <JungleLeaf
          style={{ top: 0, left: -10, opacity: 0.6 }}
          size={55}
          rotation={-30}
          color="rgba(47,174,108,0.22)"
        />
        <JungleLeaf
          style={{ top: -5, right: -10, opacity: 0.5 }}
          size={48}
          rotation={210}
          color="rgba(47,174,108,0.18)"
        />

        <View style={s.headerLeft}>
          <View style={s.headerAvatar}>
            <Text style={s.headerAvatarText}>{partnerInitial}</Text>
            <View style={[s.onlineDot, { backgroundColor: partnerOnline ? colors.success : "#555577" }]} />
          </View>
          <View>
            <Text style={s.headerName}>{partnerName}</Text>
            <Text style={[s.headerSub, partnerOnline && { color: colors.success }]}>
              {presenceLabel}
            </Text>
          </View>
        </View>

        <View style={s.headerRight}>
          {messages.length > 0 && (
            <LiveScoreBadge
              score={liveScore}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setAnalysisVisible(true);
              }}
            />
          )}
          <View style={s.callBtns}>
            <Pressable
              style={[s.callBtn, callStatus !== "idle" && { opacity: 0.4 }]}
              onPress={() => handleStartCall("audio")}
              disabled={callStatus !== "idle"}
            >
              <Feather name="phone" size={18} color={colors.primary} />
            </Pressable>
            <Pressable
              style={[s.callBtn, callStatus !== "idle" && { opacity: 0.4 }]}
              onPress={() => handleStartCall("video")}
              disabled={callStatus !== "idle"}
            >
              <Feather name="video" size={18} color={colors.primary} />
            </Pressable>
          </View>
        </View>
      </View>

      {/* ── Zone de chat avec fond forêt ── */}
      <ImageBackground
        source={FERN_BG}
        style={s.chatBg}
        resizeMode="cover"
        imageStyle={{ opacity: 0.22 }}
      >
        {/* Feuilles décoratives dans les coins */}
        <JungleLeaf
          style={{ bottom: 80, left: -15 }}
          size={90}
          rotation={25}
          color="rgba(47,174,108,0.14)"
        />
        <JungleLeaf
          style={{ bottom: 140, right: -20 }}
          size={80}
          rotation={-160}
          color="rgba(47,174,108,0.12)"
        />
        <JungleLeaf
          style={{ top: 20, right: -10 }}
          size={65}
          rotation={200}
          color="rgba(47,174,108,0.10)"
        />

        <FlatList
          ref={flatRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={renderMessage}
          contentContainerStyle={[s.list, { paddingBottom: 16 }]}
          showsVerticalScrollIndicator={false}
          onLayout={() => flatRef.current?.scrollToEnd({ animated: false })}
          removeClippedSubviews={true}
          maxToRenderPerBatch={15}
          windowSize={10}
          initialNumToRender={20}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={s.empty}>
              <Feather name="heart" size={42} color={colors.primaryDim} />
              <Text style={s.emptyText}>Dis bonjour à ton autre moitié</Text>
            </View>
          }
        />
      </ImageBackground>

      {conflictAdvice && (
        <View style={s.conflictBox}>
          <View style={s.conflictHeader}>
            <Text style={s.conflictTitle}>Conseils IA</Text>
            <Pressable onPress={() => setConflictAdvice(null)}>
              <Feather name="x" size={18} color={colors.foregroundMuted} />
            </Pressable>
          </View>
          <Text style={s.conflictText}>{conflictAdvice}</Text>
        </View>
      )}
      {loadingConflict && (
        <View style={s.conflictLoading}>
          <ActivityIndicator color={colors.primary} size="small" />
          <Text style={s.conflictLoadingText}>Analyse en cours…</Text>
        </View>
      )}

      <View style={[s.inputRow, { paddingBottom: insets.bottom + 8 }]}>
        <TextInput
          style={s.input}
          value={text}
          onChangeText={setText}
          placeholder="Message…"
          placeholderTextColor={colors.foregroundMuted}
          multiline
          maxLength={1000}
          onSubmitEditing={handleSend}
        />
        <Pressable
          style={[s.sendBtn, (!text.trim() || sending) && { opacity: 0.4 }]}
          onPress={handleSend}
          disabled={!text.trim() || sending}
        >
          {sending
            ? <ActivityIndicator color="#fff" size="small" />
            : <Feather name="send" size={18} color="#fff" />
          }
        </Pressable>
      </View>

      <AnalysisModal
        visible={analysisVisible}
        onClose={() => setAnalysisVisible(false)}
        messages={messages}
        myId={user?.uid ?? ""}
      />
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  chatBg: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
    overflow: "hidden",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12, zIndex: 1 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8, zIndex: 1 },
  callBtns: { flexDirection: "row", gap: 6 },
  callBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: colors.primary + "40",
    alignItems: "center",
    justifyContent: "center",
  },
  headerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  headerAvatarText: { color: "#fff", fontSize: 18, fontWeight: "700", fontFamily: "Inter_700Bold" },
  onlineDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.background,
  },
  headerName: {
    color: colors.foreground,
    fontSize: 17,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  headerSub: {
    color: colors.foregroundMuted,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  list: { paddingHorizontal: 16, paddingTop: 12, flexGrow: 1 },
  bubble: {
    maxWidth: "78%",
    marginVertical: 3,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 3,
    elevation: 2,
  },
  bubbleMe: {
    backgroundColor: "rgba(34,197,94,0.88)",
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.35)",
  },
  bubbleThem: {
    backgroundColor: "rgba(22,38,28,0.92)",
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bubbleText: { fontSize: 15, lineHeight: 22, fontFamily: "Inter_400Regular" },
  bubbleTextMe: { color: "#ffffff" },
  bubbleTextThem: { color: colors.foreground },
  bubbleFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 4,
    gap: 2,
  },
  bubbleTime: {
    fontSize: 10,
    color: "rgba(255,255,255,0.55)",
    fontFamily: "Inter_400Regular",
  },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 12 },
  emptyText: {
    color: colors.foregroundMuted,
    fontSize: 15,
    textAlign: "center",
    fontFamily: "Inter_400Regular",
  },
  conflictBox: {
    margin: 16,
    backgroundColor: colors.cardElevated,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.primary + "40",
  },
  conflictHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  conflictTitle: { color: colors.primary, fontWeight: "700", fontSize: 14, fontFamily: "Inter_700Bold" },
  conflictText: { color: colors.foreground, fontSize: 14, lineHeight: 22, fontFamily: "Inter_400Regular" },
  conflictLoading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 12,
  },
  conflictLoadingText: { color: colors.foregroundMuted, fontSize: 13, fontFamily: "Inter_400Regular" },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.foreground,
    fontFamily: "Inter_400Regular",
    maxHeight: 120,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
});
