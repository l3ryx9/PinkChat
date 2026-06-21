import { Feather } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  collection,
  getDocs,
  orderBy,
  query,
  where,
  limit,
} from "firebase/firestore";

import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/firebase/config";
import {
  analyzeConversation,
  AnalysisResult,
  DownloadProgress,
  downloadModel,
  isModelLoaded,
  loadModel,
  MODEL_PATH,
} from "@/services/aiAnalysis";
import colors from "@/constants/colors";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMB(bytes: number): string {
  if (bytes <= 0) return "0 Mo";
  return (bytes / 1_048_576).toFixed(0) + " Mo";
}

// ─── Barre de progression du téléchargement ───────────────────────────────────

const DownloadBar = React.memo(function DownloadBar({
  pct,
  bytesWritten,
  bytesTotal,
  speedMBs,
}: {
  pct: number;
  bytesWritten: number;
  bytesTotal: number;
  speedMBs: number;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: Math.min(pct, 1),
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [pct]);

  const pctDisplay = Math.round(pct * 100);
  const hasTotal = bytesTotal > 0;

  return (
    <View style={dlBar.wrapper}>
      <View style={dlBar.row}>
        <Text style={dlBar.pct}>{pctDisplay}%</Text>
        {speedMBs > 0 && (
          <Text style={dlBar.speed}>{speedMBs.toFixed(1)} Mo/s</Text>
        )}
      </View>

      <View style={dlBar.track}>
        <Animated.View
          style={[
            dlBar.fill,
            {
              width: anim.interpolate({
                inputRange: [0, 1],
                outputRange: ["0%", "100%"],
              }),
            },
          ]}
        />
        <Animated.View
          style={[
            dlBar.shimmer,
            {
              left: anim.interpolate({
                inputRange: [0, 1],
                outputRange: ["-30%", "110%"],
              }),
            },
          ]}
        />
      </View>

      {hasTotal ? (
        <Text style={dlBar.bytes}>
          {fmtMB(bytesWritten)} / {fmtMB(bytesTotal)}
        </Text>
      ) : (
        <Text style={dlBar.bytes}>{fmtMB(bytesWritten)} téléchargés…</Text>
      )}
    </View>
  );
});

const dlBar = StyleSheet.create({
  wrapper: { width: "100%", gap: 8 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  pct: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.foreground,
    fontFamily: "Inter_700Bold",
  },
  speed: {
    fontSize: 12,
    color: colors.foregroundMuted,
    fontFamily: "Inter_400Regular",
  },
  track: {
    width: "100%",
    height: 10,
    backgroundColor: colors.border,
    borderRadius: 5,
    overflow: "hidden",
    position: "relative",
  },
  fill: {
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: 5,
  },
  shimmer: {
    position: "absolute",
    top: 0,
    width: "30%",
    height: "100%",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 5,
  },
  bytes: {
    fontSize: 12,
    color: colors.foregroundMuted,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
});

// ─── Score bar ────────────────────────────────────────────────────────────────

const ScoreBar = React.memo(function ScoreBar({ label, value, color = colors.primary }: { label: string; value: number; color?: string }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: value / 100,
      duration: 800,
      delay: 200,
      useNativeDriver: false,
    }).start();
  }, [value]);

  return (
    <View style={sb.row}>
      <Text style={sb.label}>{label}</Text>
      <View style={sb.track}>
        <Animated.View
          style={[
            sb.fill,
            { width: anim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }), backgroundColor: color },
          ]}
        />
      </View>
      <Text style={sb.value}>{value}</Text>
    </View>
  );
});

const sb = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  label: { width: 90, fontSize: 12, color: colors.foregroundMuted, fontFamily: "Inter_400Regular" },
  track: { flex: 1, height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 3 },
  value: { width: 30, fontSize: 12, color: colors.foreground, textAlign: "right", fontFamily: "Inter_500Medium" },
});

// ─── Flag ─────────────────────────────────────────────────────────────────────

const Flag = React.memo(function Flag({ type, text, severite, contexte }: { type: "red" | "green"; text: string; severite?: string; contexte: string }) {
  const c = type === "red" ? colors.destructive : colors.success;
  const icon = type === "red" ? "alert-triangle" : "check-circle";
  return (
    <View style={[fl.row, { borderColor: c + "33" }]}>
      <Feather name={icon as any} size={16} color={c} />
      <View style={{ flex: 1 }}>
        <Text style={[fl.text, { color: c }]}>
          {text}
          {severite && <Text style={fl.sev}> · {severite}</Text>}
        </Text>
        <Text style={fl.ctx}>{contexte}</Text>
      </View>
    </View>
  );
});

const fl = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    alignItems: "flex-start",
  },
  text: { fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  sev: { fontSize: 11, fontWeight: "400", color: colors.foregroundMuted, fontFamily: "Inter_400Regular" },
  ctx: { fontSize: 12, color: colors.foregroundMuted, marginTop: 2, fontFamily: "Inter_400Regular" },
});

// ─── Écran principal ──────────────────────────────────────────────────────────

type ModelStatus = "checking" | "not_downloaded" | "downloading" | "loading" | "ready" | "error";

export default function AnalysisScreen() {
  const { user, profile } = useAuth();
  const insets = useSafeAreaInsets();

  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [modelStatus, setModelStatus] = useState<ModelStatus>("checking");
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [dlProgress, setDlProgress] = useState<DownloadProgress>({ pct: 0, bytesWritten: 0, bytesTotal: 0 });
  const [speedMBs, setSpeedMBs] = useState(0);

  const lastUpdate = useRef<{ time: number; bytes: number }>({ time: Date.now(), bytes: 0 });

  useEffect(() => {
    checkModel();
  }, []);

  async function checkModel() {
    setModelStatus("checking");
    try {
      const info = await FileSystem.getInfoAsync(MODEL_PATH);
      if (!info.exists) {
        setModelStatus("not_downloaded");
        return;
      }
      let loaded = false;
      try { loaded = isModelLoaded(); } catch { loaded = false; }
      if (loaded) {
        setModelStatus("ready");
        return;
      }
      setModelStatus("loading");
      try {
        await loadModel();
        setModelStatus(isModelLoaded() ? "ready" : "not_downloaded");
      } catch {
        setModelStatus("not_downloaded");
      }
    } catch {
      // FileSystem ou module llama.rn non disponible
      setModelStatus("not_downloaded");
    }
  }

  async function handleDownloadModel() {
    setModelStatus("downloading");
    setDownloadError(null);
    setDlProgress({ pct: 0, bytesWritten: 0, bytesTotal: 0 });
    setSpeedMBs(0);
    lastUpdate.current = { time: Date.now(), bytes: 0 };

    const result = await downloadModel((progress) => {
      setDlProgress(progress);

      const now = Date.now();
      const elapsed = (now - lastUpdate.current.time) / 1000;
      if (elapsed >= 1) {
        const delta = progress.bytesWritten - lastUpdate.current.bytes;
        setSpeedMBs(delta / elapsed / 1_048_576);
        lastUpdate.current = { time: now, bytes: progress.bytesWritten };
      }
    });

    if (result.success) {
      setModelStatus("loading");
      await loadModel();
      setModelStatus(isModelLoaded() ? "ready" : "error");
      if (!isModelLoaded()) setDownloadError("Modèle téléchargé mais impossible à charger");
    } else {
      setModelStatus("error");
      setDownloadError(result.error ?? "Erreur inconnue");
    }
  }

  async function handleAnalyze() {
    if (!user || !profile?.partnerId) return;
    setLoading(true);
    try {
      const [snap1, snap2] = await Promise.all([
        getDocs(query(
          collection(db, "messages"),
          where("senderId", "==", user.uid),
          where("receiverId", "==", profile.partnerId),
          orderBy("createdAt", "asc"),
          limit(100)
        )),
        getDocs(query(
          collection(db, "messages"),
          where("senderId", "==", profile.partnerId),
          where("receiverId", "==", user.uid),
          orderBy("createdAt", "asc"),
          limit(100)
        )),
      ]);
      const msgs = [...snap1.docs, ...snap2.docs]
        .map((d) => ({ id: d.id, ...d.data() } as any))
        .sort((a: any, b: any) => a.createdAt - b.createdAt)
        .map((m: any) => ({ content: m.content, senderId: m.senderId }));

      const result = await analyzeConversation(msgs, user.uid);
      setAnalysis(result);
    } finally {
      setLoading(false);
    }
  }

  const topPad = Platform.OS === "web" ? 20 : insets.top;

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={[s.content, { paddingTop: topPad + 20 }]}
      showsVerticalScrollIndicator={false}
    >

      <View style={s.header}>
        <Text style={s.title}>Analyse 🧠</Text>
        <Text style={s.subtitle}>
          {analysis?.isAI ? "Analyse par Qwen 3 (local)" : "Analyse de votre relation"}
        </Text>
      </View>

      {modelStatus !== "ready" && (
        <View style={s.modelBox}>

          {modelStatus === "checking" && (
            <>
              <ActivityIndicator color={colors.primary} size="small" />
              <Text style={s.modelBody}>Vérification du modèle…</Text>
            </>
          )}

          {modelStatus === "not_downloaded" && (
            <>
              <Text style={s.modelIcon}>🤖</Text>
              <Text style={s.modelTitle}>Modèle IA non téléchargé</Text>
              <Text style={s.modelBody}>
                Télécharge Qwen 3 (~1.9 Go) pour une analyse IA locale.{"\n"}
                Tes données ne quittent jamais ton téléphone.
              </Text>
              <Pressable style={s.dlBtn} onPress={handleDownloadModel}>
                <Feather name="download" size={16} color="#fff" />
                <Text style={s.dlBtnText}>Télécharger Qwen 3</Text>
              </Pressable>
              <Text style={s.modelHint}>L'analyse par règles reste disponible sans le modèle.</Text>
            </>
          )}

          {modelStatus === "downloading" && (
            <>
              <Text style={s.modelTitle}>Téléchargement de Qwen 3…</Text>
              <DownloadBar
                pct={dlProgress.pct}
                bytesWritten={dlProgress.bytesWritten}
                bytesTotal={dlProgress.bytesTotal}
                speedMBs={speedMBs}
              />
              <Text style={s.modelHint}>Ne ferme pas l'app. Le téléchargement peut reprendre.</Text>
            </>
          )}

          {modelStatus === "loading" && (
            <>
              <ActivityIndicator color={colors.primary} size="large" />
              <Text style={s.modelTitle}>Chargement du modèle…</Text>
              <Text style={s.modelBody}>Quelques secondes…</Text>
            </>
          )}

          {modelStatus === "error" && (
            <>
              <View style={s.errorIcon}>
                <Feather name="alert-circle" size={28} color={colors.destructive} />
              </View>
              <Text style={[s.modelTitle, { color: colors.destructive }]}>Téléchargement échoué</Text>
              {downloadError && (
                <Text style={s.errorMsg}>{downloadError}</Text>
              )}
              <Pressable style={s.dlBtn} onPress={handleDownloadModel}>
                <Feather name="refresh-cw" size={16} color="#fff" />
                <Text style={s.dlBtnText}>Réessayer</Text>
              </Pressable>
              <Text style={s.modelHint}>L'analyse par règles reste disponible.</Text>
            </>
          )}
        </View>
      )}

      <Pressable
        style={[s.analyzeBtn, loading && { opacity: 0.6 }]}
        onPress={handleAnalyze}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator color="#fff" size="small" />
          : <>
            <Feather name="activity" size={18} color="#fff" />
            <Text style={s.analyzeBtnText}>Analyser maintenant</Text>
          </>
        }
      </Pressable>

      {analysis && (
        <>
          <View style={s.scoreCard}>
            <Text style={s.scoreGlobal}>{analysis.scores.global}</Text>
            <Text style={s.scoreLabel}>/100</Text>
          </View>

          <View style={s.section}>
            <Text style={s.sectionTitle}>Sous-scores</Text>
            <ScoreBar label="Respect" value={analysis.scores.respect} />
            <ScoreBar label="Empathie" value={analysis.scores.empathie} />
            <ScoreBar label="Honnêteté" value={analysis.scores.honnetete} />
            <ScoreBar label="Limites" value={analysis.scores.limites} />
            <ScoreBar label="Positivité" value={analysis.scores.positivite} color={colors.success} />
          </View>

          {analysis.redFlags.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>🚩 Points d'attention</Text>
              {analysis.redFlags.map((f, i) => (
                <Flag key={i} type="red" text={f.texte} severite={f.severite} contexte={f.contexte} />
              ))}
            </View>
          )}

          {analysis.greenFlags.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>💚 Points positifs</Text>
              {analysis.greenFlags.map((f, i) => (
                <Flag key={i} type="green" text={f.texte} contexte={f.contexte} />
              ))}
            </View>
          )}

          <View style={s.section}>
            <Text style={s.sectionTitle}>📝 Résumé</Text>
            <Text style={s.resume}>{analysis.resume}</Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingBottom: 100 },
  header: { marginBottom: 24 },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.foreground,
    fontFamily: "Inter_700Bold",
    marginBottom: 4,
  },
  subtitle: { fontSize: 13, color: colors.foregroundMuted, fontFamily: "Inter_400Regular" },
  modelBox: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    gap: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  modelIcon: { fontSize: 36 },
  modelTitle: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  modelBody: {
    color: colors.foregroundMuted,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
    fontFamily: "Inter_400Regular",
  },
  modelHint: {
    color: colors.foregroundMuted,
    fontSize: 11,
    textAlign: "center",
    fontFamily: "Inter_400Regular",
    opacity: 0.7,
  },
  dlBtn: {
    flexDirection: "row",
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 28,
    gap: 8,
    alignItems: "center",
    marginTop: 4,
  },
  dlBtnText: { color: "#fff", fontSize: 14, fontWeight: "700", fontFamily: "Inter_700Bold" },
  errorIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.destructive + "22",
    alignItems: "center",
    justifyContent: "center",
  },
  errorMsg: {
    color: colors.destructive,
    fontSize: 12,
    textAlign: "center",
    fontFamily: "Inter_400Regular",
    paddingHorizontal: 8,
  },
  analyzeBtn: {
    flexDirection: "row",
    backgroundColor: colors.primary,
    borderRadius: 14,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 24,
  },
  analyzeBtnText: { color: "#fff", fontSize: 16, fontWeight: "700", fontFamily: "Inter_700Bold" },
  scoreCard: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    marginBottom: 28,
    gap: 4,
  },
  scoreGlobal: {
    fontSize: 80,
    fontWeight: "800",
    color: colors.primary,
    fontFamily: "Inter_700Bold",
    lineHeight: 88,
  },
  scoreLabel: { fontSize: 24, color: colors.foregroundMuted, fontFamily: "Inter_400Regular", marginBottom: 12 },
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.foreground,
    fontFamily: "Inter_700Bold",
    marginBottom: 12,
  },
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
