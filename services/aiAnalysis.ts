import * as FileSystem from "expo-file-system";
import { AppState, AppStateStatus } from "react-native";

export interface AnalysisScore {
  global: number;
  respect: number;
  empathie: number;
  honnetete: number;
  limites: number;
  positivite: number;
}

export interface RedFlag {
  texte: string;
  severite: "faible" | "modere" | "eleve";
  contexte: string;
}

export interface GreenFlag {
  texte: string;
  contexte: string;
}

export interface AnalysisResult {
  scores: AnalysisScore;
  redFlags: RedFlag[];
  greenFlags: GreenFlag[];
  resume: string;
  isAI: boolean;
}

export interface Message {
  content: string;
  senderId: string;
}

export interface LiveScore {
  value: number;
  trend: "up" | "down" | "stable";
  label: string;
  color: string;
}

export interface DownloadProgress {
  pct: number;
  bytesWritten: number;
  bytesTotal: number;
}

export interface DownloadResult {
  success: boolean;
  error?: string;
}

const MODEL_DIR = FileSystem.documentDirectory + "models/";
export const MODEL_PATH = MODEL_DIR + "Qwen3-1.7B-Q8_0.gguf";
const MODEL_URL =
  "https://huggingface.co/Qwen/Qwen3-1.7B-GGUF/resolve/main/Qwen3-1.7B-Q8_0.gguf";
const RESUME_DATA_PATH = MODEL_DIR + "download_resume.json";

let llamaCtx: any = null;
let modelLoaded = false;
let modelLoading = false;

// Référence au téléchargement en cours pour pouvoir le mettre en pause si l'app passe en arrière-plan
let activeDownload: FileSystem.DownloadResumable | null = null;

export const isModelLoaded = () => modelLoaded;

export async function ensureModelDir() {
  const info = await FileSystem.getInfoAsync(MODEL_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(MODEL_DIR, { intermediates: true });
  }
}

export async function downloadModel(
  onProgress: (progress: DownloadProgress) => void
): Promise<DownloadResult> {
  try {
    await ensureModelDir();

    // Si le fichier existe déjà, signaler 100 %
    const info = await FileSystem.getInfoAsync(MODEL_PATH);
    if (info.exists) {
      const size = (info as any).size ?? 0;
      onProgress({ pct: 1, bytesWritten: size, bytesTotal: size });
      return { success: true };
    }

    const progressCallback = (p: FileSystem.DownloadProgressData) => {
      const total = p.totalBytesExpectedToWrite;
      const written = p.totalBytesWritten;
      const pct = total > 0 ? Math.min(written / total, 1) : 0;
      onProgress({ pct, bytesWritten: written, bytesTotal: total });
    };

    // Tentative de reprise d'un téléchargement précédent
    let dl: FileSystem.DownloadResumable;
    try {
      const resumeInfo = await FileSystem.getInfoAsync(RESUME_DATA_PATH);
      if (resumeInfo.exists) {
        const savedData = await FileSystem.readAsStringAsync(RESUME_DATA_PATH);
        dl = FileSystem.createDownloadResumable(
          MODEL_URL,
          MODEL_PATH,
          { headers: { "Accept-Encoding": "identity" } },
          progressCallback,
          savedData
        );
      } else {
        dl = FileSystem.createDownloadResumable(
          MODEL_URL,
          MODEL_PATH,
          { headers: { "Accept-Encoding": "identity" } },
          progressCallback
        );
      }
    } catch {
      dl = FileSystem.createDownloadResumable(
        MODEL_URL,
        MODEL_PATH,
        { headers: { "Accept-Encoding": "identity" } },
        progressCallback
      );
    }

    activeDownload = dl;

    // Mettre en pause proprement si l'app passe en arrière-plan
    const handleAppState = async (state: AppStateStatus) => {
      if (state === "background" && activeDownload) {
        try {
          const pauseState = await activeDownload.pauseAsync();
          if (pauseState?.resumeData) {
            await FileSystem.writeAsStringAsync(RESUME_DATA_PATH, pauseState.resumeData);
          }
        } catch {}
      }
    };
    const subscription = AppState.addEventListener("change", handleAppState);

    let result: FileSystem.FileSystemDownloadResult | undefined;
    try {
      result = await dl.downloadAsync();
    } finally {
      activeDownload = null;
      subscription.remove();
    }

    // Nettoyer les données de reprise si le téléchargement est terminé
    try {
      await FileSystem.deleteAsync(RESUME_DATA_PATH, { idempotent: true });
    } catch {}

    if (!result) return { success: false, error: "Téléchargement interrompu" };
    if (result.status !== 200) {
      return { success: false, error: `Erreur serveur ${result.status}` };
    }

    return { success: true };
  } catch (e: any) {
    activeDownload = null;
    const msg: string = e?.message ?? String(e);
    if (msg.includes("Network") || msg.includes("network") || msg.includes("connexion")) {
      return { success: false, error: "Erreur réseau — vérifie ta connexion Wi-Fi" };
    }
    if (msg.includes("space") || msg.includes("Storage") || msg.includes("disk")) {
      return { success: false, error: "Espace insuffisant sur l'appareil (~2 Go requis)" };
    }
    if (msg.includes("cancelled") || msg.includes("canceled")) {
      return { success: false, error: "Téléchargement annulé" };
    }
    return { success: false, error: msg.slice(0, 120) };
  }
}

export async function loadModel(): Promise<boolean> {
  if (modelLoaded || modelLoading) return modelLoaded;
  modelLoading = true;
  try {
    const info = await FileSystem.getInfoAsync(MODEL_PATH);
    if (!info.exists) return false;
    const { initLlama } = await import("llama.rn");
    llamaCtx = await initLlama({ model: MODEL_PATH, n_ctx: 2048, n_threads: 4 });
    modelLoaded = true;
    return true;
  } catch {
    modelLoaded = false;
    return false;
  } finally {
    modelLoading = false;
  }
}

// ─── Patterns de détection rapide ────────────────────────────────────────────

const NEG_PATTERNS = [
  /tu es nul|c'est ta faute|idiot|stupide|ferme.la|shut up|hate|déteste/gi,
  /jamais|toujours tort|ta gueule|je m'en fous/gi,
  /\bcon\b|\bconne\b|imbécile|crétin|sale/gi,
  /tu comprends rien|t'es impossible|j'en ai marre de toi/gi,
];

const POS_PATTERNS = [
  /je t'aime|t'aime|je t'adore/gi,
  /merci|pardon|excuse[z-]?|désolé/gi,
  /je comprends|je suis là|câlin|bisous|❤|💕|😘|🥰/gi,
  /super|génial|formidable|tu es belle|tu es beau|fier de toi|je suis fier/gi,
  /on va y arriver|ensemble|on en parle|discutons/gi,
];

export function computeLiveScore(
  messages: Message[],
  windowSize = 20
): LiveScore {
  if (messages.length === 0) {
    return { value: 70, trend: "stable", label: "💬 En attente", color: "#7fa18e" };
  }

  const recent = messages.slice(-windowSize);
  const text = recent.map((m) => m.content).join(" ");

  let neg = 0;
  let pos = 0;
  for (const p of NEG_PATTERNS) neg += (text.match(p) ?? []).length;
  for (const p of POS_PATTERNS) pos += (text.match(p) ?? []).length;

  const raw = Math.max(10, Math.min(100, 65 + pos * 4 - neg * 6));
  const value = Math.round(raw);

  const half = Math.floor(recent.length / 2);
  let trend: "up" | "down" | "stable" = "stable";
  if (half >= 2) {
    const firstHalf = recent.slice(0, half).map((m) => m.content).join(" ");
    const secondHalf = recent.slice(half).map((m) => m.content).join(" ");
    let n1 = 0, p1 = 0, n2 = 0, p2 = 0;
    for (const pat of NEG_PATTERNS) {
      n1 += (firstHalf.match(pat) ?? []).length;
      n2 += (secondHalf.match(pat) ?? []).length;
    }
    for (const pat of POS_PATTERNS) {
      p1 += (firstHalf.match(pat) ?? []).length;
      p2 += (secondHalf.match(pat) ?? []).length;
    }
    const score1 = p1 - n1;
    const score2 = p2 - n2;
    trend = score2 > score1 + 0.5 ? "up" : score2 < score1 - 0.5 ? "down" : "stable";
  }

  let label: string;
  let color: string;
  if (value >= 80) {
    label = "💚 Très bien";
    color = "#5fe39a";
  } else if (value >= 65) {
    label = "💛 Bien";
    color = "#e8d479";
  } else if (value >= 45) {
    label = "🟠 Tensions";
    color = "#e8a479";
  } else {
    label = "🔴 Difficile";
    color = "#e8746f";
  }

  return { value, trend, label, color };
}

function regexFallback(messages: Message[], myId: string): AnalysisResult {
  const text = messages.map((m) => m.content).join(" ").toLowerCase();

  let negCount = 0;
  let posCount = 0;
  for (const p of NEG_PATTERNS) negCount += (text.match(p) || []).length;
  for (const p of POS_PATTERNS) posCount += (text.match(p) || []).length;

  const global = Math.max(20, Math.min(100, 65 + posCount * 3 - negCount * 5));

  const redFlags: RedFlag[] = [];
  if (text.includes("jamais") || text.includes("toujours"))
    redFlags.push({
      texte: "Généralisation excessive",
      severite: "modere",
      contexte: "Utilisation de termes absolus",
    });
  if (negCount > 2)
    redFlags.push({
      texte: "Ton négatif détecté",
      severite: negCount > 5 ? "eleve" : "modere",
      contexte: "Plusieurs expressions négatives",
    });

  const greenFlags: GreenFlag[] = [];
  if (text.includes("merci") || text.includes("pardon") || text.includes("désolé"))
    greenFlags.push({ texte: "Gratitude et excuses", contexte: "Communication saine" });
  if (posCount > 2)
    greenFlags.push({ texte: "Expressions positives", contexte: "Bonne dynamique" });

  return {
    scores: {
      global,
      respect: Math.max(20, global - negCount * 2),
      empathie: Math.max(20, global + posCount - 5),
      honnetete: global,
      limites: Math.max(20, 70 - negCount * 3),
      positivite: Math.max(20, 50 + posCount * 5),
    },
    redFlags,
    greenFlags,
    resume: `Analyse basique (modèle IA non chargé). Score global : ${global}/100. ${negCount > 0 ? "Des tensions ont été détectées." : "La communication semble saine."}`,
    isAI: false,
  };
}

export async function analyzeConversation(
  messages: Message[],
  myId: string
): Promise<AnalysisResult> {
  if (!modelLoaded || !llamaCtx) {
    return regexFallback(messages, myId);
  }

  const transcript = messages
    .slice(-50)
    .map((m) => `${m.senderId === myId ? "Moi" : "Partenaire"}: ${m.content}`)
    .join("\n");

  const prompt = `Tu es un expert en psychologie relationnelle. Analyse cette conversation de couple et réponds UNIQUEMENT avec un JSON valide.

Conversation:
${transcript}

Réponds avec ce JSON exact:
{
  "scores": {"global":0,"respect":0,"empathie":0,"honnetete":0,"limites":0,"positivite":0},
  "redFlags": [{"texte":"","severite":"faible|modere|eleve","contexte":""}],
  "greenFlags": [{"texte":"","contexte":""}],
  "resume": ""
}

Les scores sont sur 100. Réponds en français. JSON uniquement.`;

  try {
    const res = await llamaCtx.completion(
      { prompt, n_predict: 800, temperature: 0.2 },
      () => {}
    );
    const json = JSON.parse(res.text.trim());
    return { ...json, isAI: true };
  } catch {
    return regexFallback(messages, myId);
  }
}

export async function analyzeConflict(
  messages: Message[],
  myId: string
): Promise<string> {
  if (!modelLoaded || !llamaCtx) {
    return "Chargez le modèle IA pour obtenir des conseils personnalisés sur la résolution de conflits.";
  }

  const last30 = messages.slice(-30);
  const transcript = last30
    .map((m) => `${m.senderId === myId ? "Moi" : "Partenaire"}: ${m.content}`)
    .join("\n");

  const prompt = `Tu es un thérapeute de couple bienveillant. Analyse ces 30 derniers messages et donne 3 conseils pratiques et personnalisés pour résoudre la tension. Réponds en français, de manière chaleureuse et constructive, en 200 mots max.

Messages:
${transcript}

Conseils:`;

  try {
    const res = await llamaCtx.completion(
      { prompt, n_predict: 400, temperature: 0.5 },
      () => {}
    );
    return res.text.trim();
  } catch {
    return "Une erreur est survenue lors de l'analyse. Veuillez réessayer.";
  }
}
