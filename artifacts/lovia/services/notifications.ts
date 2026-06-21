import * as Notifications from "expo-notifications";
import * as BackgroundFetch from "expo-background-fetch";
import * as TaskManager from "expo-task-manager";
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/firebase/config";
import { Platform } from "react-native";

const BG_TASK = "adeux-bg-fetch";
const EXPO_PROJECT_ID = "72b9d676-075e-4bd5-bbb2-a05650a52155";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

TaskManager.defineTask(BG_TASK, async () => {
  try {
    const { getAuth } = await import("firebase/auth");
    const user = getAuth().currentUser;
    if (!user) return BackgroundFetch.BackgroundFetchResult.NoData;

    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (!userDoc.exists()) return BackgroundFetch.BackgroundFetchResult.NoData;
    const partnerId = userDoc.data().partnerId;
    if (!partnerId) return BackgroundFetch.BackgroundFetchResult.NoData;

    const q = query(
      collection(db, "messages"),
      where("receiverId", "==", user.uid),
      where("deliveredAt", "==", null),
      orderBy("createdAt", "desc"),
      limit(5)
    );
    const snap = await getDocs(q);
    if (snap.empty) return BackgroundFetch.BackgroundFetchResult.NoData;

    for (const d of snap.docs) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Lovia",
          body: d.data().content,
          sound: true,
        },
        trigger: null,
      });
      await updateDoc(doc(db, "messages", d.id), {
        deliveredAt: serverTimestamp(),
      });
    }
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === "web") return null;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return null;

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: EXPO_PROJECT_ID,
    });
    return tokenData.data;
  } catch {
    return null;
  }
}

export async function registerBackgroundFetch() {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BG_TASK);
    if (!isRegistered) {
      await BackgroundFetch.registerTaskAsync(BG_TASK, {
        minimumInterval: 60,
        stopOnTerminate: false,
        startOnBoot: true,
      });
    }
  } catch {}
}

export async function savePushToken(uid: string, token: string) {
  const { setDoc } = await import("firebase/firestore");
  await setDoc(
    doc(db, "push_tokens", uid),
    { userId: uid, token, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

export async function scheduleLocalNotification(title: string, body: string) {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true },
    trigger: null,
  });
}
