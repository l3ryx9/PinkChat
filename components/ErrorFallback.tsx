import { Feather } from "@expo/vector-icons";
  import { reloadAppAsync } from "expo";
  import React, { useState } from "react";
  import {
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
  } from "react-native";
  import { useSafeAreaInsets } from "react-native-safe-area-context";

  import { useColors } from "@/hooks/useColors";

  export type ErrorFallbackProps = {
    error: Error;
    resetError: () => void;
  };

  export function ErrorFallback({ error, resetError }: ErrorFallbackProps) {
    const colors = useColors();
    const insets = useSafeAreaInsets();
    const [isModalVisible, setIsModalVisible] = useState(false);

    const handleRestart = async () => {
      try {
        await reloadAppAsync();
      } catch {
        resetError();
      }
    };

    const monoFont = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });

    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Pressable
          onPress={() => setIsModalVisible(true)}
          style={({ pressed }) => [styles.topButton, { top: insets.top + 16, backgroundColor: colors.card, opacity: pressed ? 0.8 : 1 }]}
        >
          <Feather name="alert-circle" size={20} color={colors.foreground} />
        </Pressable>

        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.foreground }]}>Something went wrong</Text>

          <Text style={[styles.errorSummary, { color: "#ef4444", fontFamily: monoFont }]} selectable numberOfLines={4}>
            {error.message}
          </Text>

          <Text style={[styles.hint, { color: colors.mutedForeground }]}>
            Appuie sur l\'icône ⚠ en haut à droite pour voir le détail complet.
          </Text>

          <Pressable
            onPress={handleRestart}
            style={({ pressed }) => [styles.button, { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
          >
            <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>Réessayer</Text>
          </Pressable>
        </View>

        <Modal visible={isModalVisible} animationType="slide" transparent onRequestClose={() => setIsModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
              <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>Détails de l\'erreur</Text>
                <Pressable onPress={() => setIsModalVisible(false)} style={({ pressed }) => [styles.closeButton, { opacity: pressed ? 0.6 : 1 }]}>
                  <Feather name="x" size={24} color={colors.foreground} />
                </Pressable>
              </View>
              <ScrollView style={styles.modalScrollView} contentContainerStyle={[styles.modalScrollContent, { paddingBottom: insets.bottom + 16 }]}>
                <View style={[styles.errorContainer, { backgroundColor: colors.card }]}>
                  <Text style={[styles.errorText, { color: colors.foreground, fontFamily: monoFont }]} selectable>
                    {error.message}
                    {error.stack ? `\n\nStack:\n${error.stack}` : ""}
                  </Text>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  const styles = StyleSheet.create({
    container: { flex: 1, width: "100%", height: "100%", justifyContent: "center", alignItems: "center", padding: 24 },
    content: { alignItems: "center", justifyContent: "center", gap: 16, width: "100%", maxWidth: 600 },
    title: { fontSize: 28, fontWeight: "700", textAlign: "center", lineHeight: 40 },
    errorSummary: { fontSize: 13, textAlign: "center", lineHeight: 20, paddingHorizontal: 8 },
    hint: { fontSize: 14, textAlign: "center", lineHeight: 22 },
    topButton: { position: "absolute", right: 16, width: 44, height: 44, borderRadius: 8, alignItems: "center", justifyContent: "center", zIndex: 10 },
    button: { paddingVertical: 16, borderRadius: 8, paddingHorizontal: 24, minWidth: 200, elevation: 3 },
    buttonText: { fontWeight: "600", textAlign: "center", fontSize: 16 },
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    modalContainer: { width: "100%", height: "90%", borderTopLeftRadius: 16, borderTopRightRadius: 16 },
    modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1 },
    modalTitle: { fontSize: 20, fontWeight: "600" },
    closeButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    modalScrollView: { flex: 1 },
    modalScrollContent: { padding: 16 },
    errorContainer: { width: "100%", borderRadius: 8, padding: 16 },
    errorText: { fontSize: 12, lineHeight: 18 },
  });
  