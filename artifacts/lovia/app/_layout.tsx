import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { AppState, AppStateStatus } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { CallProvider } from "@/contexts/CallContext";
import IncomingCallModal from "@/components/IncomingCallModal";
import { db } from "@/firebase/config";
import colors from "@/constants/colors";

SplashScreen.preventAutoHideAsync();

function PresenceTracker() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const setOnline = async (online: boolean) => {
      try {
        await updateDoc(doc(db, "users", user.uid), {
          isOnline: online,
          lastSeen: serverTimestamp(),
        });
      } catch {}
    };

    setOnline(true);

    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      setOnline(state === "active");
    });

    return () => {
      sub.remove();
      setOnline(false);
    };
  }, [user?.uid]);

  return null;
}

function RootGuard() {
  const { user, profile, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuth = segments[0] === "(auth)";
    const inFind = segments[0] === "find-partner";
    const currentScreen = segments[1] as string | undefined;

    if (!user) {
      if (!inAuth) router.replace("/(auth)/login");
      return;
    }
    if (!user.emailVerified) {
      if (currentScreen !== "verify-email") router.replace("/(auth)/verify-email");
      return;
    }
    if (!profile?.username) {
      if (currentScreen !== "onboarding") router.replace("/(auth)/onboarding");
      return;
    }
    if (!profile?.partnerId) {
      if (!inFind) router.replace("/find-partner");
      return;
    }
    if (inAuth || inFind) {
      router.replace("/(tabs)");
    }
  }, [user, profile, loading, segments]);

  return null;
}

function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <AuthProvider>
          <CallProvider>
            <PresenceTracker />
            <StatusBar style="light" backgroundColor={colors.background} />
            <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
              <KeyboardProvider>
                <RootGuard />
                <Stack
                  screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: colors.background },
                    animation: "fade",
                  }}
                >
                  <Stack.Screen name="(auth)" />
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen name="find-partner" />
                  <Stack.Screen
                    name="call"
                    options={{
                      animation: "slide_from_bottom",
                      presentation: "fullScreenModal",
                    }}
                  />
                </Stack>
                <IncomingCallModal />
              </KeyboardProvider>
            </GestureHandlerRootView>
          </CallProvider>
        </AuthProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

export default RootLayout;
