import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  MediaStream,
  mediaDevices,
} from "react-native-webrtc";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  updateDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
  getDoc,
} from "firebase/firestore";
import { db } from "@/firebase/config";
import { useAuth } from "@/contexts/AuthContext";

export type CallType = "video" | "audio";
export type CallStatus = "idle" | "ringing" | "calling" | "active" | "ended";

export interface IncomingCall {
  callId: string;
  callerId: string;
  callerName: string;
  callerInitial: string;
  type: CallType;
}

interface CallContextValue {
  callStatus: CallStatus;
  callType: CallType | null;
  incomingCall: IncomingCall | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMuted: boolean;
  isCameraOff: boolean;
  isSpeakerOn: boolean;
  startCall: (partnerId: string, type: CallType) => Promise<void>;
  acceptCall: () => Promise<void>;
  declineCall: () => Promise<void>;
  endCall: () => Promise<void>;
  toggleMute: () => void;
  toggleCamera: () => void;
  toggleSpeaker: () => void;
}

const CallContext = createContext<CallContextValue | null>(null);

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
];

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();

  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [callType, setCallType] = useState<CallType | null>(null);
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const currentCallIdRef = useRef<string | null>(null);
  const unsubCallRef = useRef<(() => void) | null>(null);
  const unsubIncomingRef = useRef<(() => void) | null>(null);

  async function getLocalMedia(type: CallType): Promise<MediaStream> {
    const stream = await mediaDevices.getUserMedia({
      audio: true,
      video: type === "video"
        ? { facingMode: "user", width: 640, height: 480 }
        : false,
    });
    return stream as MediaStream;
  }

  function createPeerConnection(): RTCPeerConnection {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    pc.addEventListener("icecandidate", async (event: any) => {
      if (event.candidate && currentCallIdRef.current) {
        const callId = currentCallIdRef.current;
        const isCallee = incomingCall !== null;
        const sub = isCallee ? "calleeCandidates" : "callerCandidates";
        await addDoc(collection(db, "calls", callId, sub), {
          candidate: event.candidate.toJSON(),
        });
      }
    });

    pc.addEventListener("track", (event: any) => {
      if (event.streams?.[0]) {
        setRemoteStream(event.streams[0] as MediaStream);
      }
    });

    pc.addEventListener("connectionstatechange", () => {
      const state = (pc as any).connectionState;
      if (state === "connected") {
        setCallStatus("active");
      } else if (state === "disconnected" || state === "failed" || state === "closed") {
        cleanup();
      }
    });

    return pc;
  }

  function cleanup() {
    if (unsubCallRef.current) {
      unsubCallRef.current();
      unsubCallRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStream) {
      localStream.getTracks().forEach((t: any) => t.stop());
    }
    setLocalStream(null);
    setRemoteStream(null);
    setCallStatus("idle");
    setCallType(null);
    setIncomingCall(null);
    setIsMuted(false);
    setIsCameraOff(false);
    currentCallIdRef.current = null;
  }

  const startCall = useCallback(async (partnerId: string, type: CallType) => {
    if (!user || !profile) return;
    setCallType(type);
    setCallStatus("calling");

    const stream = await getLocalMedia(type);
    setLocalStream(stream);

    const pc = createPeerConnection();
    stream.getTracks().forEach((track: any) => pc.addTrack(track, stream));

    const offer = await pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: type === "video",
    } as any);
    await pc.setLocalDescription(new RTCSessionDescription(offer) as any);

    const callRef = await addDoc(collection(db, "calls"), {
      callerId: user.uid,
      callerName: profile.displayName || profile.username || "Moi",
      calleeId: partnerId,
      type,
      status: "ringing",
      offer: { type: offer.type, sdp: offer.sdp },
      createdAt: serverTimestamp(),
    });

    currentCallIdRef.current = callRef.id;

    unsubCallRef.current = onSnapshot(doc(db, "calls", callRef.id), async (snap) => {
      if (!snap.exists()) { cleanup(); return; }
      const data = snap.data();

      if (data.status === "declined" || data.status === "ended") {
        cleanup();
        return;
      }

      if (data.answer && pcRef.current && !(pcRef.current as any).remoteDescription) {
        const answer = new RTCSessionDescription(data.answer as any) as any;
        await pcRef.current.setRemoteDescription(answer);
      }
    });

    const calleeSub = onSnapshot(
      collection(db, "calls", callRef.id, "calleeCandidates"),
      (snap) => {
        snap.docChanges().forEach(async (change) => {
          if (change.type === "added" && pcRef.current) {
            const candidate = new RTCIceCandidate(change.doc.data().candidate) as any;
            await pcRef.current.addIceCandidate(candidate);
          }
        });
      }
    );

    const origUnsub = unsubCallRef.current;
    unsubCallRef.current = () => {
      origUnsub?.();
      calleeSub();
    };
  }, [user, profile]);

  const acceptCall = useCallback(async () => {
    if (!incomingCall || !user) return;
    setCallStatus("active");

    const { callId, type } = incomingCall;
    currentCallIdRef.current = callId;
    setCallType(type);

    const stream = await getLocalMedia(type);
    setLocalStream(stream);

    const pc = createPeerConnection();
    stream.getTracks().forEach((track: any) => pc.addTrack(track, stream));

    const callSnap = await getDoc(doc(db, "calls", callId));
    if (!callSnap.exists()) return;
    const callData = callSnap.data();

    const offer = new RTCSessionDescription(callData.offer as any) as any;
    await pc.setRemoteDescription(offer);

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(new RTCSessionDescription(answer) as any);

    await updateDoc(doc(db, "calls", callId), {
      answer: { type: answer.type, sdp: answer.sdp },
      status: "accepted",
    });

    const callerSub = onSnapshot(
      collection(db, "calls", callId, "callerCandidates"),
      (snap) => {
        snap.docChanges().forEach(async (change) => {
          if (change.type === "added" && pcRef.current) {
            const candidate = new RTCIceCandidate(change.doc.data().candidate) as any;
            await pcRef.current.addIceCandidate(candidate);
          }
        });
      }
    );

    unsubCallRef.current = () => callerSub();
  }, [incomingCall, user]);

  const declineCall = useCallback(async () => {
    if (!incomingCall) return;
    try {
      await updateDoc(doc(db, "calls", incomingCall.callId), { status: "declined" });
    } catch {}
    setIncomingCall(null);
    setCallStatus("idle");
  }, [incomingCall]);

  const endCall = useCallback(async () => {
    if (currentCallIdRef.current) {
      try {
        await updateDoc(doc(db, "calls", currentCallIdRef.current), { status: "ended" });
      } catch {}
    }
    cleanup();
  }, [localStream]);

  const toggleMute = useCallback(() => {
    if (!localStream) return;
    localStream.getAudioTracks().forEach((track: any) => {
      track.enabled = !track.enabled;
    });
    setIsMuted((prev) => !prev);
  }, [localStream]);

  const toggleCamera = useCallback(() => {
    if (!localStream) return;
    localStream.getVideoTracks().forEach((track: any) => {
      track.enabled = !track.enabled;
    });
    setIsCameraOff((prev) => !prev);
  }, [localStream]);

  const toggleSpeaker = useCallback(() => {
    setIsSpeakerOn((prev) => !prev);
  }, []);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "calls"),
      where("calleeId", "==", user.uid),
      where("status", "==", "ringing")
    );

    unsubIncomingRef.current = onSnapshot(q, async (snap) => {
      if (snap.empty || callStatus !== "idle") return;

      const callDoc = snap.docs[0];
      const data = callDoc.data();

      let callerName = "Quelqu'un";
      let callerInitial = "?";
      try {
        const callerSnap = await getDoc(doc(db, "users", data.callerId));
        if (callerSnap.exists()) {
          const cd = callerSnap.data();
          callerName = cd.displayName || cd.username || "Quelqu'un";
          callerInitial = (callerName[0] ?? "?").toUpperCase();
        }
      } catch {}

      setIncomingCall({
        callId: callDoc.id,
        callerId: data.callerId,
        callerName,
        callerInitial,
        type: data.type as CallType,
      });
      setCallStatus("ringing");
    });

    return () => {
      unsubIncomingRef.current?.();
    };
  }, [user?.uid, callStatus]);

  return (
    <CallContext.Provider
      value={{
        callStatus,
        callType,
        incomingCall,
        localStream,
        remoteStream,
        isMuted,
        isCameraOff,
        isSpeakerOn,
        startCall,
        acceptCall,
        declineCall,
        endCall,
        toggleMute,
        toggleCamera,
        toggleSpeaker,
      }}
    >
      {children}
    </CallContext.Provider>
  );
}

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useCall must be used inside CallProvider");
  return ctx;
}
