import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { usePathname, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";


import type { ClassGroup } from "../src/core/models";

import { useAuth } from "../src/auth/auth";
import { canSafelyUnlinkProvider } from "../src/auth/identity-linking";
import { saveSession } from "../src/auth/session";
import { BackTitleHeader } from "../src/components/ui/BackTitleHeader";
import { ResponsiveGrid } from "../src/components/ui/ResponsiveGrid";
import { ResponsivePage } from "../src/components/ui/ResponsivePage";

import { useRole } from "../src/auth/role";

import { ENABLE_SOCIAL_LOGIN } from "../src/api/config";
import { getMyProfilePhoto, setMyProfilePhoto } from "../src/api/profile-photo";
import {
    removeMyProfilePhotoObject,
    uploadMyProfilePhoto,
} from "../src/api/profile-photo-storage";
import {
    removeStudentPhotoObject,
    uploadStudentPhoto,
} from "../src/api/student-photo-storage";
import { deleteMyAccount } from "../src/api/account-deletion";
import {
  ACCOUNT_DELETION_CONFIRMATION,
  isAccountDeletionConfirmationValid,
} from "../src/core/account-deletion";
import { resolveEffectiveProfile } from "../src/core/effective-profile";
import {
  getPasswordChangeValidationError,
  getSecurityContactEmailValidationError,
  normalizeSecurityContactEmail,
} from "../src/core/account-security";
import {
  PROFILE_NAME_FALLBACK,
  getProfileNameValidationError,
  normalizeProfileName,
  resolveProfileDisplayName,
} from "../src/core/profile-name";
import { getClasses, updateStudentPhoto } from "../src/db/seed";
import {
  canManageGlobalAcademicKnowledge,
  disconnectPersonalAcademicDrive,
  getPersonalAcademicDriveOAuthStatus,
  startPersonalAcademicDriveOAuth,
  syncPersonalAcademicDrive,
  type AcademicDriveOAuthStatus,
} from "../src/db/academic-knowledge";
import { navigateBackOrReplace } from "../src/navigation/safe-router";
import { useTrainerRouteScope } from "../src/navigation/use-trainer-route-scope";
import { useOrganization } from "../src/providers/OrganizationProvider";
import { getNotificationsModule, isExpoGo } from "../src/push/notificationRuntime";
import { useBiometricLock } from "../src/security/biometric-lock";
import { isBiometricsSupported, promptBiometrics } from "../src/security/biometrics";
import { useAppTheme } from "../src/ui/app-theme";
import { AppRefreshControl } from "../src/ui/AppRefreshControl";
import { useConfirmDialog } from "../src/ui/confirm-dialog";
import { getFriendlyErrorMessage } from "../src/ui/error-messages";
import { ModalSheet } from "../src/ui/ModalSheet";
import { Pressable } from "../src/ui/Pressable";
import { Button } from "../src/ui/Button";
import { SettingsRow } from "../src/ui/SettingsRow";
import { ScreenLoadingState } from "../src/components/ui/ScreenLoadingState";
import { useModalCardStyle } from "../src/ui/use-modal-card-style";
import { WebCameraCaptureModal } from "../src/ui/WebCameraCaptureModal";
import { radius, shadow } from "../src/theme/tokens";
import { GoAtletaIcon } from "../src/ui/icon-registry";
import {
  resolveAuthorizedProfileSwitchIds,
  type ProfileSwitchId,
} from "../src/ui/profile-switch-options";
import { useResponsiveLayout } from "../src/ui/use-responsive-layout";

type ProfilePreviewId = ProfileSwitchId;

const profileSwitchLabels: Record<ProfilePreviewId, string> = {
  professor: "Professor",
  student: "Aluno",
  admin: "Coordenação",
  family: "Família",
};

const getProfileMenuOptionStyle = (selected: boolean) => ({
  minHeight: 44,
  paddingHorizontal: 12,
  borderRadius: radius.internal,
  flexDirection: "row" as const,
  alignItems: "center" as const,
  justifyContent: "space-between" as const,
  backgroundColor: selected ? "rgba(86, 214, 154, 0.10)" : "transparent",
});

const getProfileMenuOptionTextStyle = (selected: boolean, color: string) => ({
  color,
  fontSize: 14,
  fontWeight: selected ? ("700" as const) : ("600" as const),
});

function FloatingFieldError({ message }: { message: string | null }) {
  const { colors } = useAppTheme();
  if (!message) return null;
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: -40,
        left: 8,
        zIndex: 20,
        maxWidth: "94%",
      }}
    >
      <View
        style={{
          minHeight: 32,
          paddingHorizontal: 10,
          paddingVertical: 7,
          borderRadius: 9,
          backgroundColor: colors.dangerSolidBg,
          flexDirection: "row",
          alignItems: "center",
          gap: 7,
        }}
      >
        <GoAtletaIcon name="warningCircle" size={15} color={colors.dangerSolidText} />
        <Text
          style={{
            flexShrink: 1,
            color: colors.dangerSolidText,
            fontSize: 12,
            fontWeight: "700",
          }}
        >
          {message}
        </Text>
      </View>
      <View
        style={{
          marginLeft: 18,
          width: 0,
          height: 0,
          borderLeftWidth: 6,
          borderRightWidth: 6,
          borderTopWidth: 7,
          borderLeftColor: "transparent",
          borderRightColor: "transparent",
          borderTopColor: colors.dangerSolidBg,
        }}
      />
    </View>
  );
}

function AccountTextField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  secureTextEntry = false,
  passwordVisible = false,
  onTogglePassword,
  autoComplete,
  returnKeyType = "next",
  onSubmitEditing,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  error: string | null;
  secureTextEntry?: boolean;
  passwordVisible?: boolean;
  onTogglePassword?: () => void;
  autoComplete?: "email" | "current-password" | "new-password" | "off";
  returnKeyType?: "next" | "done";
  onSubmitEditing?: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={{ gap: 8, overflow: "visible" }}>
      <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>{label}</Text>
      <View style={{ position: "relative", overflow: "visible" }}>
        <FloatingFieldError message={error} />
        <View
          style={{
            minHeight: 50,
            borderRadius: 12,
            paddingHorizontal: 14,
            backgroundColor: colors.inputBg,
            borderWidth: 1,
            borderColor: error ? colors.dangerBorder : colors.border,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
          }}
        >
          <TextInput
            accessibilityLabel={label}
            autoCapitalize="none"
            autoComplete={autoComplete}
            autoCorrect={false}
            maxLength={secureTextEntry ? 128 : 254}
            placeholder={placeholder}
            placeholderTextColor={colors.muted}
            returnKeyType={returnKeyType}
            secureTextEntry={secureTextEntry && !passwordVisible}
            value={value}
            onChangeText={onChangeText}
            onSubmitEditing={onSubmitEditing}
            style={{
              flex: 1,
              color: colors.text,
              fontSize: 15,
              paddingVertical: 0,
              borderRadius: 0,
              ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}),
            }}
          />
          {secureTextEntry && onTogglePassword ? (
            <Pressable
              accessibilityLabel={passwordVisible ? "Ocultar senha" : "Mostrar senha"}
              accessibilityRole="button"
              onPress={onTogglePassword}
              suppressWebHoverFeedback
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <GoAtletaIcon
                name={passwordVisible ? "eyeOff" : "view"}
                size={18}
                color={colors.muted}
              />
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

// perf-check: ignore-render
// perf-check: ignore-measure
export default function ProfileScreen() {
  const { colors, mode, toggleMode } = useAppTheme();
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const responsiveLayout = useResponsiveLayout("dashboard");
  const insets = useSafeAreaInsets();
  const { confirm } = useConfirmDialog();
  const {
    signOut,
    session,
    resendSignupCode,
    signInWithOAuth,
    unlinkIdentityProvider,
    updatePassword,
    updateProfileName,
    updateSecurityContactEmail,
  } = useAuth();
  const {
    role: userRole,
    availableRoles,
    student,
    refresh: refreshRole,
    setActiveRole,
  } = useRole();
  const { organizations, activeOrganization, setActiveOrganizationId, devProfilePreview, setDevProfilePreview } = useOrganization();
  const {
    isEnabled: biometricsEnabled,
    isUnlocked,
    ensureUnlocked,
    setEnabled: setBiometricsEnabled,
  } = useBiometricLock();
  const router = useRouter();
  const pathname = usePathname();
  const scopedRoutes = useTrainerRouteScope();
  const LEGACY_PHOTO_STORAGE_KEY = "profile_photo_uri_v1";
  const NOTIFY_SETTINGS_KEY = "notify_settings_v1";
  const isWeb = Platform.OS === "web";
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingPhoto, setLoadingPhoto] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showPhotoSheet, setShowPhotoSheet] = useState(false);
  const [showNameEditor, setShowNameEditor] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);
  const [showAccountEditor, setShowAccountEditor] = useState(false);
  const [showAccountDeletion, setShowAccountDeletion] = useState(false);
  const [accountDeletionConfirmation, setAccountDeletionConfirmation] = useState("");
  const [accountDeletionError, setAccountDeletionError] = useState<string | null>(null);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [securityContactDraft, setSecurityContactDraft] = useState("");
  const [securityContactError, setSecurityContactError] = useState<string | null>(null);
  const [securityContactSuccess, setSecurityContactSuccess] = useState(false);
  const [savingSecurityContact, setSavingSecurityContact] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [currentPasswordError, setCurrentPasswordError] = useState<string | null>(null);
  const [newPasswordError, setNewPasswordError] = useState<string | null>(null);
  const [passwordConfirmationError, setPasswordConfirmationError] = useState<string | null>(null);
  const [passwordChanged, setPasswordChanged] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showPasswordConfirmation, setShowPasswordConfirmation] = useState(false);
  const [showCameraCapture, setShowCameraCapture] = useState(false);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [workspaceExpanded, setWorkspaceExpanded] = useState(false);
  const [dangerZoneExpanded, setDangerZoneExpanded] = useState(false);
  const [profileMenuAnchor, setProfileMenuAnchor] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [updatingBiometrics, setUpdatingBiometrics] = useState(false);
  const [unlinkingGoogle, setUnlinkingGoogle] = useState(false);
  const [googleMenuOpen, setGoogleMenuOpen] = useState(false);
  const [googleMenuAnchor, setGoogleMenuAnchor] = useState<{
    top: number;
    right: number;
  } | null>(null);
  const [academicDriveStatus, setAcademicDriveStatus] =
    useState<AcademicDriveOAuthStatus>({ status: "not_connected" });
  const [academicDriveMenuOpen, setAcademicDriveMenuOpen] = useState(false);
  const [academicDriveMenuAnchor, setAcademicDriveMenuAnchor] = useState<{
    top: number;
    right: number;
  } | null>(null);
  const [academicDriveOperation, setAcademicDriveOperation] = useState<
    "idle" | "connecting" | "syncing" | "disconnecting"
  >("idle");
  const [canManageAcademicKnowledge, setCanManageAcademicKnowledge] =
    useState(false);
  const academicDriveBusy = academicDriveOperation !== "idle";
  const profileMenuTriggerRef = useRef<View | null>(null);
  const academicDriveMenuTriggerRef = useRef<View | null>(null);
  const googleMenuTriggerRef = useRef<View | null>(null);
  const photoSheetStyle = useModalCardStyle({
    maxHeight: "70%",
    radius: 22,
  });
  const accountEditorStyle = useModalCardStyle({
    maxHeight: "92%",
    maxWidth: 520,
    radius: 20,
  });
  const accountDeletionStyle = useModalCardStyle({
    maxHeight: "82%",
    maxWidth: 480,
    radius: 20,
  });
  const defaultProfile = resolveEffectiveProfile({
    role: userRole,
    orgRoleLevel: activeOrganization?.role_level,
  });
  const defaultProfilePreview: ProfilePreviewId =
    defaultProfile === "admin"
      ? "admin"
      : defaultProfile === "student"
        ? "student"
        : defaultProfile === "family"
          ? "family"
        : "professor";
  const routeProfilePreview = useMemo<ProfilePreviewId | null>(() => {
    if (/^\/prof(\/|$)/.test(pathname)) return "professor";
    if (/^\/coord(\/|$)/.test(pathname) || pathname === "/coordination") return "admin";
    if (/^\/student(\/|$)/.test(pathname) || pathname === "/student-home") return "student";
    if (/^\/family(\/|$)/.test(pathname)) return "family";
    return null;
  }, [pathname]);
  const selectedProfilePreview: ProfilePreviewId =
    routeProfilePreview ?? (devProfilePreview === "auto" ? defaultProfilePreview : devProfilePreview);


  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await getClasses();
        if (alive) setClasses(data);
      } finally {
        if (alive) setLoadingClasses(false);
      }
    })();

    return () => {

      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (student) {
        if (alive) {
          setPhotoUri(student.photoUrl ?? null);
          setLoadingPhoto(false);
        }
        return;
      }
      try {
        const remotePhoto = await getMyProfilePhoto();
        if (!alive) return;
        if (remotePhoto) {
          setPhotoUri(remotePhoto);
          return;
        }

        const stored = await AsyncStorage.getItem(LEGACY_PHOTO_STORAGE_KEY);
        if (!alive) return;
        if (Platform.OS === "web" && stored?.startsWith("blob:")) {
          await AsyncStorage.removeItem(LEGACY_PHOTO_STORAGE_KEY);
          setPhotoUri(null);
          return;
        }
        if (stored) {
          const userId = session?.user?.id ?? "";
          if (userId) {
            const migratedPhoto = stored.startsWith("http")
              ? stored
              : await uploadMyProfilePhoto({
                  userId,
                  uri: stored,
                  contentType: "image/jpeg",
                });
            await setMyProfilePhoto(migratedPhoto);
            await AsyncStorage.removeItem(LEGACY_PHOTO_STORAGE_KEY);
            setPhotoUri(migratedPhoto);
            return;
          }
          setPhotoUri(stored);
          return;
        }
        setPhotoUri(null);
      } catch (error) {
        console.error("Failed to load profile photo", error);
      } finally {
        if (alive) setLoadingPhoto(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [session?.user?.id, student]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(NOTIFY_SETTINGS_KEY);
        if (!raw || !alive) return;
        const data = JSON.parse(raw) as { enabled: boolean };
        setNotificationsEnabled(Boolean(data.enabled));
      } catch (error) {
        console.error("Failed to load notification settings", error);
      }
    })();
    return () => {
      alive = false;
    };
  }, [NOTIFY_SETTINGS_KEY]);

  useEffect(() => {
    let alive = true;
    if (student || Platform.OS !== "web" || !activeOrganization?.id) {
      return () => {
        alive = false;
      };
    }
    void canManageGlobalAcademicKnowledge().then(async (allowed) => {
      if (!alive) return;
      setCanManageAcademicKnowledge(allowed);
      if (!allowed) return;
      const status = await getPersonalAcademicDriveOAuthStatus({
        organizationId: activeOrganization.id,
      });
      if (alive) setAcademicDriveStatus(status);
    });
    return () => {
      alive = false;
    };
  }, [activeOrganization?.id, student]);

  const loadingProfile = loadingClasses || loadingPhoto;
  const showWorkspaceSwitcher = !student && organizations.length > 1;
  const hasTrainerRole = userRole === "trainer" || availableRoles.includes("trainer");
  const hasStudentRole = userRole === "student" || availableRoles.includes("student");
  const hasFamilyRole = userRole === "family" || availableRoles.includes("family");
  const isOrgAdmin = (activeOrganization?.role_level ?? 0) >= 50;
  const canUseDevPreview =
    __DEV__ &&
    session?.user?.email === "gusantinho753@gmail.com" &&
    Boolean(setDevProfilePreview);
  const authorizedProfileSwitchIds = useMemo(
    () =>
      resolveAuthorizedProfileSwitchIds({
        hasTrainerRole,
        hasStudentRole,
        hasFamilyRole,
        isOrgAdmin,
        canUseDevPreview,
      }),
    [canUseDevPreview, hasFamilyRole, hasStudentRole, hasTrainerRole, isOrgAdmin],
  );
  const canSwitchProfile = authorizedProfileSwitchIds.length > 1;
  const closeProfileMenu = useCallback(() => {
    setProfileMenuOpen(false);
    setProfileMenuAnchor(null);
  }, []);
  const closeAcademicDriveMenu = useCallback(() => {
    setAcademicDriveMenuOpen(false);
    setAcademicDriveMenuAnchor(null);
  }, []);
  const closeGoogleMenu = useCallback(() => {
    setGoogleMenuOpen(false);
    setGoogleMenuAnchor(null);
  }, []);

  const toggleProfileMenu = useCallback(() => {
    if (!canSwitchProfile) return;
    closeAcademicDriveMenu();
    closeGoogleMenu();
    if (profileMenuOpen) {
      closeProfileMenu();
      return;
    }

    const trigger = profileMenuTriggerRef.current;
    if (!trigger) return;
    const menuHeight = authorizedProfileSwitchIds.length * 44 + 16;
    const setMeasuredAnchor = (
      x: number,
      y: number,
      _width: number,
      height: number,
    ) => {
      const menuWidth = Math.min(260, viewportWidth - 32);
      const belowTop = y + height + 8;
      const top =
        belowTop + menuHeight <= viewportHeight - 16
          ? belowTop
          : Math.max(16, y - menuHeight - 8);
      setProfileMenuAnchor({
        top,
        left: Math.max(16, Math.min(x, viewportWidth - menuWidth - 16)),
      });
      setProfileMenuOpen(true);
    };

    const webTrigger = trigger as unknown as HTMLElement;
    if (Platform.OS === "web" && webTrigger.getBoundingClientRect) {
      const rect = webTrigger.getBoundingClientRect();
      setMeasuredAnchor(rect.left, rect.top, rect.width, rect.height);
      return;
    }

    trigger.measureInWindow(setMeasuredAnchor);
  }, [
    authorizedProfileSwitchIds.length,
    canSwitchProfile,
    closeAcademicDriveMenu,
    closeGoogleMenu,
    closeProfileMenu,
    profileMenuOpen,
    viewportHeight,
    viewportWidth,
  ]);

  const toggleAcademicDriveMenu = useCallback(() => {
    if (
      academicDriveStatus.status !== "connected" ||
      academicDriveBusy
    ) {
      return;
    }
    if (academicDriveMenuOpen) {
      closeAcademicDriveMenu();
      return;
    }

    const trigger = academicDriveMenuTriggerRef.current;
    if (!trigger) return;
    closeGoogleMenu();
    closeProfileMenu();

    const menuHeight = 126;
    const setMeasuredAnchor = (
      x: number,
      y: number,
      width: number,
      height: number,
    ) => {
      const belowTop = y + height + 6;
      const top =
        belowTop + menuHeight <= viewportHeight - 12
          ? belowTop
          : Math.max(12, y - menuHeight - 6);
      setAcademicDriveMenuAnchor({
        top,
        right: Math.max(12, viewportWidth - (x + width)),
      });
      setAcademicDriveMenuOpen(true);
    };

    const webTrigger = trigger as unknown as HTMLElement;
    if (Platform.OS === "web" && webTrigger.getBoundingClientRect) {
      const rect = webTrigger.getBoundingClientRect();
      setMeasuredAnchor(rect.left, rect.top, rect.width, rect.height);
      return;
    }

    trigger.measureInWindow(setMeasuredAnchor);
  }, [
    academicDriveBusy,
    academicDriveMenuOpen,
    academicDriveStatus.status,
    closeAcademicDriveMenu,
    closeGoogleMenu,
    closeProfileMenu,
    viewportHeight,
    viewportWidth,
  ]);

  useEffect(() => {
    if (!profileMenuOpen || typeof document === "undefined") return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeProfileMenu();
    };

    document.addEventListener("scroll", closeProfileMenu, true);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("scroll", closeProfileMenu, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeProfileMenu, profileMenuOpen]);

  useEffect(() => {
    if (!academicDriveMenuOpen || typeof document === "undefined") return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeAcademicDriveMenu();
    };

    document.addEventListener("scroll", closeAcademicDriveMenu, true);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("scroll", closeAcademicDriveMenu, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [academicDriveMenuOpen, closeAcademicDriveMenu]);

  useEffect(() => {
    if (academicDriveStatus.status !== "connected") {
      Promise.resolve().then(() => {
        closeAcademicDriveMenu();
      });
    }
  }, [academicDriveStatus.status, closeAcademicDriveMenu]);

  const handleAcademicDrive = useCallback(async () => {
    if (!activeOrganization?.id || Platform.OS !== "web") return;
    const isConnected = academicDriveStatus.status === "connected";
    setAcademicDriveOperation(isConnected ? "syncing" : "connecting");
    try {
      if (!isConnected) {
        const redirectTo =
          typeof window !== "undefined"
            ? `${window.location.origin}${pathname}`
            : "https://goatleta.com/profile";
        const result = await startPersonalAcademicDriveOAuth({
          organizationId: activeOrganization.id,
          redirectTo,
        });
        if (result.authorizationUrl && typeof window !== "undefined") {
          window.location.assign(result.authorizationUrl);
          return;
        }
        Alert.alert(
          "Base acadêmica",
          result.warning || "Não foi possível conectar o Google Drive.",
        );
        return;
      }

      const result = await syncPersonalAcademicDrive({
        organizationId: activeOrganization.id,
      });
      const summary = result.summary;
      Alert.alert(
        "Base acadêmica",
        result.status === "in_progress"
          ? "Sincronização iniciada. A base acadêmica continuará sendo atualizada em segundo plano."
          : result.status === "succeeded" || result.status === "partial"
            ? [
              "Sincronização concluída.",
              summary ? `${summary.ready} arquivo(s) pronto(s).` : "",
              summary?.reviewRequired
                ? `${summary.reviewRequired} arquivo(s) exigem revisão.`
                : "",
              ]
                .filter(Boolean)
                .join(" ")
          : result.warnings[0] || "Não foi possível sincronizar agora.",
      );
      setAcademicDriveStatus(
        await getPersonalAcademicDriveOAuthStatus({
          organizationId: activeOrganization.id,
        }),
      );
    } finally {
      setAcademicDriveOperation("idle");
    }
  }, [
    academicDriveStatus.status,
    activeOrganization?.id,
    pathname,
  ]);

  const handleDisconnectAcademicDrive = useCallback(() => {
    if (!activeOrganization?.id || academicDriveBusy) return;
    confirm({
      title: "Desconectar Google Drive",
      message:
        "O acesso armazenado será removido. Os documentos já sincronizados e os planos confirmados serão preservados.",
      confirmLabel: "Desconectar",
      cancelLabel: "Cancelar",
      tone: "danger",
      onConfirm: async () => {
        setAcademicDriveOperation("disconnecting");
        try {
          const result = await disconnectPersonalAcademicDrive({
            organizationId: activeOrganization.id,
          });
          if (result.status === "not_connected") {
            setAcademicDriveStatus({ status: "not_connected" });
            Alert.alert(
              "Base acadêmica",
              "Google Drive desconectado. Os documentos já sincronizados foram preservados.",
            );
            return;
          }
          Alert.alert(
            "Base acadêmica",
            result.warning || "Não foi possível desconectar o Google Drive.",
          );
        } finally {
          setAcademicDriveOperation("idle");
        }
      },
    });
  }, [
    academicDriveBusy,
    activeOrganization?.id,
    confirm,
  ]);

  const currentClass = useMemo(() => {
    if (!student || !student.classId) return null;
    return classes.find((item) => item.id === student.classId) ?? null;
  }, [classes, student]);

  const currentAccountName = useMemo(() => {
    const metadata = session?.user?.user_metadata ?? {};
    return resolveProfileDisplayName({
      displayName: metadata.full_name || metadata.name,
      email: session?.user?.email,
      fallback: PROFILE_NAME_FALLBACK,
    });
  }, [session?.user?.email, session?.user?.user_metadata]);

  const openNameEditor = useCallback(() => {
    setNameDraft(currentAccountName === PROFILE_NAME_FALLBACK ? "" : currentAccountName);
    setNameError(null);
    setShowNameEditor(true);
  }, [currentAccountName]);

  const closeNameEditor = useCallback(() => {
    setShowNameEditor(false);
    setNameError(null);
  }, []);

  const requestCloseNameEditor = useCallback(() => {
    if (savingName) return;
    const originalName = currentAccountName === PROFILE_NAME_FALLBACK ? "" : currentAccountName;
    const hasUnsavedChange = normalizeProfileName(nameDraft) !== normalizeProfileName(originalName);
    if (!hasUnsavedChange) {
      closeNameEditor();
      return;
    }
    confirm({
      title: "Descartar alteração?",
      message: "O nome digitado não será salvo.",
      confirmLabel: "Descartar",
      cancelLabel: "Continuar editando",
      tone: "danger",
      onConfirm: closeNameEditor,
    });
  }, [closeNameEditor, confirm, currentAccountName, nameDraft, savingName]);

  const saveProfileName = useCallback(async () => {
    const validationError = getProfileNameValidationError(nameDraft);
    if (validationError) {
      setNameError(validationError);
      return;
    }
    setSavingName(true);
    setNameError(null);
    try {
      const normalizedName = normalizeProfileName(nameDraft);
      await updateProfileName(normalizedName);
      setShowNameEditor(false);
      Alert.alert("Nome atualizado", "O novo nome já será usado no Go Atleta.");
    } catch (error) {
      setNameError(getFriendlyErrorMessage(error, "Não foi possível atualizar o nome."));
    } finally {
      setSavingName(false);
    }
  }, [nameDraft, updateProfileName]);

  const originalAccountName =
    currentAccountName === PROFILE_NAME_FALLBACK ? "" : currentAccountName;
  const normalizedNameDraft = normalizeProfileName(nameDraft);
  const canSaveProfileName = Boolean(
    !savingName &&
      !getProfileNameValidationError(nameDraft) &&
      normalizedNameDraft !== normalizeProfileName(originalAccountName)
  );

  const nameParts = useMemo(() => {
    const full = (
      (selectedProfilePreview === "student" ? student?.name : null) ||
      currentAccountName ||
      PROFILE_NAME_FALLBACK
    ).trim();
    if (!full) return { first: PROFILE_NAME_FALLBACK, last: "" };
    const parts = full.split(" ");
    const first = parts[0] ?? "Aluno";
    const last = parts.slice(1).join(" ");
    return { first, last };
  }, [currentAccountName, selectedProfilePreview, student?.name]);
  const displayName = [nameParts.first, nameParts.last].filter(Boolean).join(" ");

  const profileDisplay = useMemo(() => {
    if (selectedProfilePreview === "professor") {
      return {
        icon: "school-outline",
        label: "Professor",
        subtitle: "Treinador",
      };
    }
    if (selectedProfilePreview === "admin") {
      return {
        icon: "briefcase-outline",
        label: "Coordenação",
        subtitle: "Administrador",
      };
    }
    return {
      icon: "person-outline",
      label: currentClass?.name || "Sem turma",
      subtitle: currentClass?.unit || "Sem unidade",
    };
  }, [currentClass, selectedProfilePreview]);

  const accountSecurity = useMemo(() => {
    const confirmedAt =
      session?.user?.email_confirmed_at ?? session?.user?.confirmed_at ?? null;
    const metadata = session?.user?.user_metadata ?? {};
    const hybridVerifiedAt =
      typeof session?.user?.app_metadata?.email_verified_hybrid_at === "string"
        ? session.user.app_metadata.email_verified_hybrid_at
        : null;
    const requiresHybridVerification =
      metadata.requires_email_hybrid_verification === true;
    const identityProviders = (session?.user?.identities ?? [])
      .map((item) => item.provider ?? "")
      .map((item) => String(item).toLowerCase().trim())
      .filter(Boolean);
    const metadataProviders = [
      ...(session?.user?.app_metadata?.providers ?? []),
      session?.user?.app_metadata?.provider ?? "",
    ]
      .map((item) => String(item).toLowerCase().trim())
      .filter(Boolean);
    const hasGoogle = identityProviders.includes("google")
      || (identityProviders.length === 0 && metadataProviders.includes("google"));
    const canUnlinkGoogle = canSafelyUnlinkProvider(
      session?.user?.identities ?? [],
      "google"
    );
    const emailConfirmed = requiresHybridVerification
      ? Boolean(hybridVerifiedAt)
      : Boolean(confirmedAt || hybridVerifiedAt);
    const accountEmail = String(session?.user?.email ?? "").trim();
    const securityContactEmail =
      typeof metadata.security_contact_email === "string"
        ? normalizeSecurityContactEmail(metadata.security_contact_email)
        : "";

    return {
      emailConfirmed,
      canUseEmailCode: !hasGoogle,
      googleConnected: hasGoogle,
      canUnlinkGoogle,
      socialLoginEnabled: ENABLE_SOCIAL_LOGIN,
      accountEmail,
      securityContactEmail,
      loginLabel: accountEmail || "Sem e-mail",
      googleLabel: hasGoogle ? "Conectado" : "Não conectado",
      providerDescription: requiresHybridVerification
        ? emailConfirmed
          ? "Conta verificada no modo híbrido."
          : "Conta em modo híbrido: confirme o e-mail por código para liberar ações sensíveis."
        : "Sua conta usa autenticação por e-mail e senha.",
    };
  }, [session?.user?.app_metadata?.email_verified_hybrid_at, session?.user?.app_metadata?.provider, session?.user?.app_metadata?.providers, session?.user?.confirmed_at, session?.user?.email, session?.user?.email_confirmed_at, session?.user?.identities, session?.user?.user_metadata]);

  const openAccountDeletion = useCallback(() => {
    confirm({
      title: "Excluir sua conta?",
      message: "Você realmente quer continuar?",
      confirmLabel: "Sim, continuar",
      cancelLabel: "Cancelar",
      tone: "danger",
      onConfirm: () => {
        setAccountDeletionConfirmation("");
        setAccountDeletionError(null);
        setShowAccountDeletion(true);
      },
    });
  }, [confirm]);

  const closeAccountDeletion = useCallback(() => {
    if (deletingAccount) return;
    setShowAccountDeletion(false);
    setAccountDeletionConfirmation("");
    setAccountDeletionError(null);
  }, [deletingAccount]);

  const canDeleteAccount = Boolean(
    !deletingAccount &&
      isAccountDeletionConfirmationValid(accountDeletionConfirmation),
  );

  const handleDeleteAccount = useCallback(async () => {
    if (!isAccountDeletionConfirmationValid(accountDeletionConfirmation)) {
      setAccountDeletionError("Digite EXCLUIR exatamente para confirmar.");
      return;
    }
    setDeletingAccount(true);
    setAccountDeletionError(null);
    try {
      await deleteMyAccount(accountDeletionConfirmation);
      await Promise.allSettled([
        AsyncStorage.removeItem(LEGACY_PHOTO_STORAGE_KEY),
        AsyncStorage.removeItem(NOTIFY_SETTINGS_KEY),
        biometricsEnabled
          ? setBiometricsEnabled(false)
          : Promise.resolve(),
      ]);
      await signOut();
      router.replace("/login");
    } catch (error) {
      setAccountDeletionError(
        getFriendlyErrorMessage(error, "Não foi possível excluir a conta."),
      );
    } finally {
      setDeletingAccount(false);
    }
  }, [
    accountDeletionConfirmation,
    biometricsEnabled,
    router,
    setBiometricsEnabled,
    signOut,
  ]);

  const resetAccountEditorState = useCallback(() => {
    setSecurityContactError(null);
    setSecurityContactSuccess(false);
    setCurrentPassword("");
    setNewPassword("");
    setPasswordConfirmation("");
    setCurrentPasswordError(null);
    setNewPasswordError(null);
    setPasswordConfirmationError(null);
    setPasswordChanged(false);
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowPasswordConfirmation(false);
  }, []);

  const openAccountEditor = useCallback(() => {
    setSecurityContactDraft(accountSecurity.securityContactEmail);
    resetAccountEditorState();
    setShowAccountEditor(true);
  }, [accountSecurity.securityContactEmail, resetAccountEditorState]);

  const closeAccountEditor = useCallback(() => {
    setShowAccountEditor(false);
    resetAccountEditorState();
  }, [resetAccountEditorState]);

  const requestCloseAccountEditor = useCallback(() => {
    if (savingSecurityContact || savingPassword) return;
    const contactChanged =
      normalizeSecurityContactEmail(securityContactDraft)
      !== accountSecurity.securityContactEmail;
    const hasPasswordDraft = Boolean(
      currentPassword || newPassword || passwordConfirmation,
    );
    if (!contactChanged && !hasPasswordDraft) {
      closeAccountEditor();
      return;
    }
    confirm({
      title: "Descartar alterações?",
      message: "Os dados que ainda não foram salvos serão perdidos.",
      confirmLabel: "Descartar",
      cancelLabel: "Continuar editando",
      tone: "danger",
      onConfirm: closeAccountEditor,
    });
  }, [
    accountSecurity.securityContactEmail,
    closeAccountEditor,
    confirm,
    currentPassword,
    newPassword,
    passwordConfirmation,
    savingPassword,
    savingSecurityContact,
    securityContactDraft,
  ]);

  const securityContactValidationError = getSecurityContactEmailValidationError(
    securityContactDraft,
    accountSecurity.accountEmail,
  );
  const canSaveSecurityContact = Boolean(
    !savingSecurityContact
      && !securityContactValidationError
      && normalizeSecurityContactEmail(securityContactDraft)
        !== accountSecurity.securityContactEmail,
  );
  const passwordValidationError = getPasswordChangeValidationError({
    currentPassword,
    newPassword,
    confirmation: passwordConfirmation,
  });
  const canChangePassword = Boolean(
    !savingPassword
      && !passwordValidationError
      && newPassword
      && passwordConfirmation,
  );

  const saveSecurityContact = useCallback(async () => {
    const validationError = getSecurityContactEmailValidationError(
      securityContactDraft,
      accountSecurity.accountEmail,
    );
    if (validationError) {
      setSecurityContactError(validationError);
      return;
    }
    setSavingSecurityContact(true);
    setSecurityContactError(null);
    setSecurityContactSuccess(false);
    try {
      await updateSecurityContactEmail(securityContactDraft);
      setSecurityContactDraft(normalizeSecurityContactEmail(securityContactDraft));
      setSecurityContactSuccess(true);
    } catch (error) {
      setSecurityContactError(
        getFriendlyErrorMessage(error, "Não foi possível salvar o e-mail alternativo."),
      );
    } finally {
      setSavingSecurityContact(false);
    }
  }, [accountSecurity.accountEmail, securityContactDraft, updateSecurityContactEmail]);

  const savePassword = useCallback(async () => {
    const validationError = getPasswordChangeValidationError({
      currentPassword,
      newPassword,
      confirmation: passwordConfirmation,
    });
    setCurrentPasswordError(null);
    setNewPasswordError(null);
    setPasswordConfirmationError(null);
    setPasswordChanged(false);
    if (validationError) {
      if (validationError.field === "confirmation") {
        setPasswordConfirmationError(validationError.message);
      } else {
        setNewPasswordError(validationError.message);
      }
      return;
    }
    setSavingPassword(true);
    try {
      await updatePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setPasswordConfirmation("");
      setPasswordChanged(true);
    } catch (error) {
      const friendly = getFriendlyErrorMessage(error, "Não foi possível alterar a senha.");
      const comparable = friendly.toLowerCase();
      if (comparable.includes("senha atual") || comparable.includes("current password")) {
        setCurrentPasswordError(friendly);
      } else {
        setNewPasswordError(friendly);
      }
    } finally {
      setSavingPassword(false);
    }
  }, [currentPassword, newPassword, passwordConfirmation, updatePassword]);

  const toggleGoogleMenu = useCallback(() => {
    if (!accountSecurity.googleConnected || unlinkingGoogle) return;
    if (googleMenuOpen) {
      closeGoogleMenu();
      return;
    }

    const trigger = googleMenuTriggerRef.current;
    if (!trigger) return;
    closeAcademicDriveMenu();
    closeProfileMenu();

    const menuHeight = 48;
    const setMeasuredAnchor = (
      x: number,
      y: number,
      width: number,
      height: number,
    ) => {
      const belowTop = y + height + 6;
      const top =
        belowTop + menuHeight <= viewportHeight - 12
          ? belowTop
          : Math.max(12, y - menuHeight - 6);
      setGoogleMenuAnchor({
        top,
        right: Math.max(12, viewportWidth - (x + width)),
      });
      setGoogleMenuOpen(true);
    };

    const webTrigger = trigger as unknown as HTMLElement;
    if (Platform.OS === "web" && webTrigger.getBoundingClientRect) {
      const rect = webTrigger.getBoundingClientRect();
      setMeasuredAnchor(rect.left, rect.top, rect.width, rect.height);
      return;
    }

    trigger.measureInWindow(setMeasuredAnchor);
  }, [
    accountSecurity.googleConnected,
    closeAcademicDriveMenu,
    closeGoogleMenu,
    closeProfileMenu,
    googleMenuOpen,
    unlinkingGoogle,
    viewportHeight,
    viewportWidth,
  ]);

  useEffect(() => {
    if (!googleMenuOpen || typeof document === "undefined") return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeGoogleMenu();
    };

    document.addEventListener("scroll", closeGoogleMenu, true);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("scroll", closeGoogleMenu, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeGoogleMenu, googleMenuOpen]);

  useEffect(() => {
    if (!accountSecurity.googleConnected) {
      Promise.resolve().then(() => {
        closeGoogleMenu();
      });
    }
  }, [accountSecurity.googleConnected, closeGoogleMenu]);

  const handleUnlinkGoogle = useCallback(() => {
    if (!accountSecurity.canUnlinkGoogle) {
      Alert.alert(
        "Mantenha um acesso",
        "Configure outro método de login antes de desvincular o Google.",
      );
      return;
    }
    confirm({
      title: "Desvincular Google",
      message:
        "Isso remove apenas o acesso pelo Google. Sua conta, seus dados e os outros métodos de login serão mantidos.",
      confirmLabel: "Desvincular",
      cancelLabel: "Cancelar",
      tone: "danger",
      onConfirm: async () => {
        try {
          setUnlinkingGoogle(true);
          await unlinkIdentityProvider("google");
          Alert.alert("Google", "Conta Google desvinculada com sucesso.");
        } catch (error) {
          const detail =
            error instanceof Error
              ? error.message
              : "Não foi possível desvincular agora.";
          Alert.alert("Google", detail);
        } finally {
          setUnlinkingGoogle(false);
        }
      },
    });
  }, [accountSecurity.canUnlinkGoogle, confirm, unlinkIdentityProvider]);

  const handleOrganizationChange = useCallback(
    async (orgId: string) => {
      if (activeOrganization?.id === orgId) return;
      try {
        if (biometricsEnabled && !isUnlocked) {
          const ok = await ensureUnlocked("Confirmar troca de workspace");
          if (!ok) return;
        }
        await setActiveOrganizationId(orgId);
        setWorkspaceExpanded(false);
      } catch (error) {
        console.error("Failed to change active organization", error);
        Alert.alert("Erro", "Não foi possível trocar de workspace.");
      }
    },
    [activeOrganization?.id, biometricsEnabled, ensureUnlocked, isUnlocked, setActiveOrganizationId]
  );

  const handleToggleNotifications = useCallback(async () => {
    const nextEnabled = !notificationsEnabled;
    setNotificationsEnabled(nextEnabled);

    try {
      await AsyncStorage.setItem(
        NOTIFY_SETTINGS_KEY,
        JSON.stringify({ enabled: nextEnabled })
      );

      if (nextEnabled && !isWeb && !isExpoGo) {
        const Notifications = getNotificationsModule();
        if (!Notifications) return;
        const { status } = await Notifications.getPermissionsAsync();
        if (status !== "granted") {
          const result = await Notifications.requestPermissionsAsync();
          if (result.status !== "granted") {
            Alert.alert("Permissão negada", "Ative notificações nas configurações do dispositivo.");
            setNotificationsEnabled(false);
            await AsyncStorage.setItem(
              NOTIFY_SETTINGS_KEY,
              JSON.stringify({ enabled: false })
            );
          }
        }
      } else if (!nextEnabled && !isWeb && !isExpoGo) {
        const Notifications = getNotificationsModule();
        if (!Notifications) return;
        await Notifications.cancelAllScheduledNotificationsAsync();
      }
    } catch (error) {
      console.error("Failed to toggle notifications", error);
      Alert.alert("Erro", "Não foi possível alterar configurações de notificação.");
    }
  }, [notificationsEnabled, isWeb, NOTIFY_SETTINGS_KEY]);

  const handleToggleBiometrics = useCallback(async () => {
    if (updatingBiometrics) return;
    setUpdatingBiometrics(true);
    try {
      if (biometricsEnabled) {
        await setBiometricsEnabled(false);
        return;
      }
      const support = await isBiometricsSupported();
      if (!support.hasHardware) {
        Alert.alert("Biometria indisponível", "Este aparelho não possui hardware biométrico.");
        return;
      }
      if (!support.isEnrolled) {
        Alert.alert(
          "Biometria não configurada",
          "Cadastre sua biometria nas configurações do aparelho para ativar este recurso."
        );
        return;
      }
      const result = await promptBiometrics("Ativar biometria no Go Atleta");
      if (!result.success) return;
      if (session) {
        await saveSession(session);
      }
      await setBiometricsEnabled(true);
    } catch (error) {
      console.error("Failed to toggle biometrics", error);
      Alert.alert("Erro", "Não foi possível atualizar a biometria agora.");
    } finally {
      setUpdatingBiometrics(false);
    }
  }, [biometricsEnabled, session, setBiometricsEnabled, updatingBiometrics]);

  const applyProfilePreview = useCallback(
    async (preview: ProfilePreviewId) => {
      if (!authorizedProfileSwitchIds.includes(preview)) return;
      closeProfileMenu();

      if (canUseDevPreview) {
        if (preview === "family") {
          await setDevProfilePreview("auto");
          const changed = await setActiveRole("family");
          if (!changed && userRole !== "family") return;
        } else {
          await setDevProfilePreview(preview);
          await refreshRole();
        }
      } else {
        await setDevProfilePreview("auto");
        const nextRole =
          preview === "student"
            ? "student"
            : preview === "family"
              ? "family"
              : "trainer";
        const changed = await setActiveRole(nextRole);
        if (!changed && userRole !== nextRole) return;
      }

      if (preview === "student") {
        router.replace("/student/home" as Parameters<typeof router.replace>[0]);
      } else if (preview === "family") {
        router.replace("/family/home" as Parameters<typeof router.replace>[0]);
      } else if (preview === "professor") {
        router.replace("/prof/home" as Parameters<typeof router.replace>[0]);
      } else {
        router.replace("/coord/dashboard" as Parameters<typeof router.replace>[0]);
      }
    },
    [
      authorizedProfileSwitchIds,
      canUseDevPreview,
      closeProfileMenu,
      refreshRole,
      router,
      setActiveRole,
      setDevProfilePreview,
      userRole,
    ],
  );

  const savePhoto = async (uri: string | null) => {
    const previousPhotoUri = photoUri;
    setPhotoUri(uri);
    if (student?.id) {
      try {
        if (!uri) {
          await removeStudentPhotoObject({
            organizationId: student.organizationId ?? "",
            studentId: student.id,
          });
        }
        await updateStudentPhoto(student.id, uri);
        await refreshRole();
      } catch (error) {
        console.error("Failed to update student photo", error);
        Alert.alert("Erro", "Não foi possível salvar a foto.");
      }
      return;
    }
    try {
      if (!uri && session?.user?.id) {
        await removeMyProfilePhotoObject(session.user.id);
      }
      await setMyProfilePhoto(uri);
      await AsyncStorage.removeItem(LEGACY_PHOTO_STORAGE_KEY);
    } catch (error) {
      setPhotoUri(previousPhotoUri);
      console.error("Failed to persist profile photo", error);
      Alert.alert("Erro", "Não foi possível salvar a foto.");
    }
  };

  const persistPickedPhoto = async (uri: string, mimeType?: string | null) => {
    const currentUserId = session?.user?.id ?? "";
    const uploadedUri = student?.id
      ? await uploadStudentPhoto({
          organizationId: student.organizationId ?? "",
          studentId: student.id,
          uri,
          contentType: mimeType,
        })
      : currentUserId
        ? await uploadMyProfilePhoto({
            userId: currentUserId,
            uri,
            contentType: mimeType,
          })
        : null;
    if (!uploadedUri && !student?.id) {
      throw new Error("Sua sessão expirou. Entre novamente.");
    }
    await savePhoto(uploadedUri);
  };

  const pickPhoto = async (source: "camera" | "library") => {
    if (source === "camera") {
      setShowPhotoSheet(false);
      setShowCameraCapture(true);
      return;
    }

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert(
          "Permissão necessária",
          "Ative a galeria para escolher uma foto."
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: student?.id ? 0.85 : 0.6,
        allowsEditing: true,
        aspect: [1, 1],
        base64: false,
      });
      const asset = result.assets?.[0];
      if (!result.canceled && asset?.uri) {
        await persistPickedPhoto(asset.uri, asset.mimeType);
      }
    } catch (error) {
      console.error("Failed to pick profile photo", error);
      Alert.alert("Erro", "Não foi possível selecionar a foto.");
    } finally {
      setShowPhotoSheet(false);
    }
  };

  if (loadingProfile) {
    return <ScreenLoadingState />;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: 16,
          paddingBottom: Math.max(
            16,
            insets.bottom + (responsiveLayout.isMobile ? 92 : 16),
          ),
        }}
        refreshControl={
          <AppRefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              try {
                await refreshRole();
                const data = await getClasses();
                setClasses(data);
              } finally {
                setRefreshing(false);
              }
            }}
            tintColor={colors.text}
            colors={[colors.text]}
          />
        }
      >

        <ResponsivePage variant="dashboard" gap={20} style={{ paddingBottom: 32 }}>
          <BackTitleHeader
            title="Perfil"
            onBack={() => navigateBackOrReplace({ router, fallback: scopedRoutes.home })}
          />

          <ResponsiveGrid columns={{ compact: "1", split: "4/8" }} gap={24}>
            <View
              key="identity"
              style={{
                flex: 1,
                minWidth: 0,
                padding: responsiveLayout.isMobile ? 16 : 24,
                paddingLeft: responsiveLayout.supportsSplitView ? 8 : undefined,
                borderRadius: responsiveLayout.supportsSplitView ? 0 : radius.container,
                borderWidth: responsiveLayout.supportsSplitView ? 0 : 1,
                borderRightWidth: responsiveLayout.supportsSplitView ? 1 : undefined,
                borderColor: colors.border,
                backgroundColor: responsiveLayout.supportsSplitView ? "transparent" : colors.card,
                gap: 24,
              }}
            >
              <View
                style={{
                  flexDirection: responsiveLayout.isMobile ? "row" : "column",
                  alignItems: responsiveLayout.isMobile ? "center" : "stretch",
                  gap: 16,
                }}
              >
                <View
                  style={{
                    position: "relative",
                    alignSelf: responsiveLayout.isMobile ? "auto" : "center",
                  }}
                >
                  <Pressable
                    accessibilityLabel="Visualizar foto de perfil"
                    accessibilityRole="button"
                    onPress={() => setShowPhotoViewer(true)}
                    style={{
                      width: responsiveLayout.isMobile ? 88 : 132,
                      height: responsiveLayout.isMobile ? 88 : 132,
                      borderRadius: responsiveLayout.isMobile ? 44 : 66,
                      backgroundColor: colors.secondaryBg,
                      borderWidth: 1,
                      borderColor: colors.border,
                      alignItems: "center",
                      justifyContent: "center",
                      ...shadow.card,
                    }}
                  >
                    {photoUri ? (
                      <Image
                        source={{ uri: photoUri }}
                        style={{
                          width: responsiveLayout.isMobile ? 78 : 120,
                          height: responsiveLayout.isMobile ? 78 : 120,
                          borderRadius: responsiveLayout.isMobile ? 39 : 60,
                        }}
                        contentFit="cover"
                      />
                    ) : (
                      <GoAtletaIcon
                        name="personSolid"
                        size={responsiveLayout.isMobile ? 34 : 46}
                        color={colors.text}
                      />
                    )}
                  </Pressable>
                  <Pressable
                    accessibilityLabel="Alterar foto"
                    accessibilityRole="button"
                    onPress={() => setShowPhotoSheet(true)}
                    style={({ pressed }) => ({
                      position: "absolute",
                      right: 2,
                      bottom: 2,
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      backgroundColor: pressed ? colors.secondaryBg : colors.card,
                      borderWidth: 1,
                      borderColor: colors.border,
                      alignItems: "center",
                      justifyContent: "center",
                    })}
                  >
                    <GoAtletaIcon name="pencil" size={15} color={colors.text} />
                  </Pressable>
                </View>

                <View
                  style={{
                    flex: 1,
                    minWidth: 0,
                    width: "100%",
                    alignItems: responsiveLayout.isMobile ? "stretch" : "center",
                    gap: 14,
                  }}
                >
                  {showNameEditor ? (
                    <View
                      style={{
                        width: "100%",
                        maxWidth: responsiveLayout.isMobile ? undefined : 300,
                        alignSelf: "center",
                        gap: 5,
                      }}
                    >
                      <View
                        style={{
                          minHeight: 38,
                          flexDirection: "row",
                          alignItems: "center",
                          borderBottomWidth: 1,
                          borderBottomColor: nameError ? colors.dangerBorder : colors.primaryBg,
                        }}
                      >
                        <TextInput
                          accessibilityLabel="Nome do perfil"
                          autoCapitalize="words"
                          autoComplete="name"
                          autoCorrect={false}
                          autoFocus
                          maxLength={80}
                          returnKeyType="done"
                          selectTextOnFocus
                          value={nameDraft}
                          onChangeText={(value) => {
                            setNameDraft(value);
                            if (nameError) setNameError(null);
                          }}
                          onSubmitEditing={() => {
                            if (canSaveProfileName) void saveProfileName();
                          }}
                          style={{
                            flex: 1,
                            minWidth: 0,
                            color: colors.text,
                            fontSize: responsiveLayout.isMobile ? 20 : 18,
                            lineHeight: responsiveLayout.isMobile ? 26 : 24,
                            fontWeight: "800",
                            paddingHorizontal: 4,
                            paddingVertical: 4,
                            textAlign: "center",
                            borderRadius: 0,
                            ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}),
                          }}
                        />
                        <Pressable
                          accessibilityLabel="Salvar nome"
                          accessibilityRole="button"
                          disabled={!canSaveProfileName}
                          onPress={() => void saveProfileName()}
                          suppressWebHoverFeedback
                          style={{
                            width: 32,
                            height: 32,
                            alignItems: "center",
                            justifyContent: "center",
                            opacity: canSaveProfileName ? 1 : 0.45,
                          }}
                        >
                          <GoAtletaIcon name="checkmark" size={19} color={colors.primaryBg} />
                        </Pressable>
                        <Pressable
                          accessibilityLabel="Cancelar edição do nome"
                          accessibilityRole="button"
                          disabled={savingName}
                          onPress={requestCloseNameEditor}
                          suppressWebHoverFeedback
                          style={{
                            width: 32,
                            height: 32,
                            alignItems: "center",
                            justifyContent: "center",
                            opacity: savingName ? 0.45 : 1,
                          }}
                        >
                          <GoAtletaIcon name="close" size={18} color={colors.muted} />
                        </Pressable>
                      </View>
                      {nameError ? (
                        <Text
                          style={{
                            color: colors.dangerText,
                            fontSize: 11,
                            textAlign: "center",
                          }}
                        >
                          {nameError}
                        </Text>
                      ) : null}
                    </View>
                  ) : (
                    <View
                      style={{
                        width: "100%",
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: responsiveLayout.isMobile ? "flex-start" : "center",
                        gap: 6,
                        minWidth: 0,
                      }}
                    >
                      <Text
                        numberOfLines={responsiveLayout.isMobile ? 1 : 2}
                        ellipsizeMode="tail"
                        style={{
                          flexShrink: 1,
                          minWidth: 0,
                          color: colors.text,
                          fontSize: responsiveLayout.isMobile ? 22 : 20,
                          lineHeight: responsiveLayout.isMobile ? 28 : 26,
                          fontWeight: "800",
                          textAlign: responsiveLayout.isMobile ? "left" : "center",
                        }}
                      >
                        {displayName}
                      </Text>
                      {selectedProfilePreview !== "student" ? (
                        <Pressable
                          accessibilityLabel="Editar nome"
                          accessibilityRole="button"
                          onPress={openNameEditor}
                          suppressWebHoverFeedback
                          style={{
                            width: 30,
                            height: 30,
                            flexShrink: 0,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <GoAtletaIcon name="pencil" size={15} color={colors.muted} />
                        </Pressable>
                      ) : null}
                    </View>
                  )}

                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: responsiveLayout.isMobile ? "flex-start" : "center",
                      gap: 10,
                      flexWrap: "wrap",
                    }}
                  >
                    <View ref={profileMenuTriggerRef}>
                      <Pressable
                        accessibilityLabel={canSwitchProfile ? "Trocar perfil" : profileDisplay.label}
                        accessibilityRole={canSwitchProfile ? "button" : undefined}
                        accessibilityState={canSwitchProfile ? { expanded: profileMenuOpen } : undefined}
                        disabled={!canSwitchProfile}
                        onPress={toggleProfileMenu}
                        style={({ pressed }) => ({
                          minHeight: 38,
                          paddingHorizontal: 14,
                          borderRadius: radius.internal,
                          borderWidth: 1,
                          borderColor: colors.primaryBg,
                          backgroundColor: pressed ? colors.secondaryBg : "transparent",
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                        })}
                      >
                        <Text style={{ color: colors.primaryBg, fontSize: 14, fontWeight: "700" }}>
                          {profileDisplay.label}
                        </Text>
                        {canSwitchProfile ? (
                          <GoAtletaIcon
                            name={profileMenuOpen ? "chevronUp" : "chevronDown"}
                            size={15}
                            color={colors.primaryBg}
                          />
                        ) : null}
                      </Pressable>
                    </View>
                    <View style={{ width: 1, height: 22, backgroundColor: colors.border }} />
                    <Text style={{ color: colors.muted, fontSize: 14 }}>
                      {profileDisplay.subtitle}
                    </Text>
                  </View>

                </View>
              </View>

              {!loadingProfile && showWorkspaceSwitcher ? (
                <View style={{ gap: 10, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 20 }}>
                  <Pressable
                    accessibilityLabel="Trocar workspace"
                    accessibilityRole="button"
                    accessibilityState={{ expanded: workspaceExpanded }}
                    onPress={() => setWorkspaceExpanded((current) => !current)}
                    style={({ pressed }) => ({
                      minHeight: 56,
                      paddingHorizontal: 12,
                      borderRadius: radius.internal,
                      backgroundColor: pressed ? colors.secondaryBg : "transparent",
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                    })}
                  >
                    <View
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 19,
                        backgroundColor: "rgba(61, 220, 132, 0.12)",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <GoAtletaIcon name="organization" size={19} color={colors.primaryBg} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ color: colors.text, fontWeight: "700", fontSize: 14 }} numberOfLines={1}>
                        {activeOrganization?.name || "Selecione um workspace"}
                      </Text>
                      <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                        {organizations.length} disponíveis
                      </Text>
                    </View>
                    <GoAtletaIcon
                      name={workspaceExpanded ? "chevronUp" : "chevronDown"}
                      size={16}
                      color={colors.muted}
                    />
                  </Pressable>
                  {workspaceExpanded ? (
                    <View style={{ gap: 6 }}>
                      {organizations.map((org) => {
                        const isActive = activeOrganization?.id === org.id;
                        return (
                          <Pressable
                            key={org.id}
                            accessibilityRole="button"
                            onPress={() => void handleOrganizationChange(org.id)}
                            style={({ pressed }) => ({
                              minHeight: 42,
                              paddingHorizontal: 12,
                              borderRadius: radius.internal,
                              backgroundColor: isActive || pressed ? colors.secondaryBg : "transparent",
                              flexDirection: "row",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 10,
                            })}
                          >
                            <Text style={{ flex: 1, color: colors.text, fontSize: 13, fontWeight: isActive ? "700" : "500" }} numberOfLines={1}>
                              {org.name}
                            </Text>
                            {isActive ? <GoAtletaIcon name="checkmark" size={16} color={colors.primaryBg} /> : null}
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>

            <View key="settings" style={{ minWidth: 0, gap: 24 }}>
            <View style={{ gap: 8 }}>
              <Text style={{ color: colors.text, fontSize: 15, fontWeight: "700" }}>
                Preferências
              </Text>
              <SettingsRow
                icon="notifications"
                iconBg="rgba(135, 120, 255, 0.14)"
                label="Notificações"
                onPress={handleToggleNotifications}
                rightContent={
                  <View
                    style={{
                      width: 42,
                      height: 24,
                      borderRadius: 999,
                      backgroundColor: notificationsEnabled ? colors.primaryBg : colors.secondaryBg,
                      alignItems: notificationsEnabled ? "flex-end" : "flex-start",
                      justifyContent: "center",
                      paddingHorizontal: 3,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <View
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: 8,
                        backgroundColor: colors.card,
                      }}
                    />
                  </View>
                }
              />
              {Platform.OS !== "web" ? (
                <SettingsRow
                  icon="biometrics"
                  iconBg="rgba(100, 190, 255, 0.16)"
                  label="Entrar com biometria"
                  onPress={() => {
                    void handleToggleBiometrics();
                  }}
                  rightContent={
                    <View
                      style={{
                        paddingVertical: 5,
                        paddingHorizontal: 10,
                        borderRadius: 999,
                        backgroundColor: biometricsEnabled ? colors.primaryBg : colors.secondaryBg,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <Text
                        style={{
                          color: biometricsEnabled ? colors.primaryText : colors.text,
                          fontWeight: "700",
                          fontSize: 12,
                        }}
                      >
                        {updatingBiometrics ? "..." : biometricsEnabled ? "Ligado" : "Desligado"}
                      </Text>
                    </View>
                  }
                />
              ) : null}
              {!student && Platform.OS !== "web" ? (
                <SettingsRow
                  icon="nfc"
                  iconBg="rgba(120, 220, 180, 0.16)"
                  label="Presença NFC"
                  subtitle="Modo presença por tag UID"
                  onPress={() => router.push(scopedRoutes.nfcAttendance)}
                  rightContent={<GoAtletaIcon name="chevronForward" size={16} color={colors.muted} />}
                />
              ) : null}
              <SettingsRow
                icon="darkMode"
                iconBg="rgba(96, 187, 255, 0.16)"
                label="Modo escuro"
                onPress={toggleMode}
                rightContent={
                  <View
                    style={{
                      width: 42,
                      height: 24,
                      borderRadius: 999,
                      backgroundColor: mode === "dark" ? colors.primaryBg : colors.secondaryBg,
                      alignItems: mode === "dark" ? "flex-end" : "flex-start",
                      justifyContent: "center",
                      paddingHorizontal: 3,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <View
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: 8,
                        backgroundColor: colors.card,
                      }}
                    />
                  </View>
                }
              />
            </View>

            <View style={{ gap: 8 }}>
              <Text style={{ color: colors.text, fontSize: 15, fontWeight: "700" }}>Conta</Text>
              <Pressable
                accessibilityLabel="Abrir conta e segurança"
                accessibilityRole="button"
                onPress={openAccountEditor}
                style={({ pressed }) => ({
                  borderRadius: radius.card,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: pressed ? colors.secondaryBg : colors.card,
                  paddingHorizontal: 12,
                  paddingVertical: 11,
                  minHeight: 62,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                })}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>E-mail</Text>
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }} numberOfLines={1}>
                    {accountSecurity.loginLabel}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>E-mail e senha</Text>
                  <GoAtletaIcon name="chevronForward" size={16} color={colors.muted} />
                </View>
              </Pressable>

            </View>

            <View style={{ gap: 8 }}>
              <Text style={{ color: colors.text, fontSize: 15, fontWeight: "700" }}>
                Integrações
              </Text>

              {!student &&
              Platform.OS === "web" &&
              canManageAcademicKnowledge ? (
                <View
                  style={{
                    width: "100%",
                    maxWidth: "100%",
                    minWidth: 0,
                    overflow: "hidden",
                    borderRadius: radius.card,
                    backgroundColor: colors.card,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <View
                    style={{
                      minHeight: 58,
                      paddingVertical: 10,
                      paddingHorizontal: 8,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <View
                      style={{
                        flex: 1,
                        minWidth: 0,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <View
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 18,
                          backgroundColor: colors.secondaryBg,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Image
                          source={require("../assets/images/google-drive-logo.png")}
                          accessibilityLabel="Google Drive"
                          contentFit="contain"
                          style={{ width: 22, height: 22 }}
                        />
                      </View>
                      <View style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
                        <Text style={{ color: colors.text, fontWeight: "600" }}>
                          Base acadêmica
                        </Text>
                        <Text
                          style={{
                            color: colors.muted,
                            fontSize: 12,
                            marginTop: 2,
                          }}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {academicDriveOperation === "syncing"
                            ? "Sincronizando Google Drive..."
                            : academicDriveOperation === "disconnecting"
                              ? "Desconectando Google Drive..."
                              : academicDriveStatus.status === "connected"
                                ? academicDriveStatus.googleAccountEmail
                                  ? `Google Drive conectado: ${academicDriveStatus.googleAccountEmail}`
                                  : "Google Drive conectado"
                                : "Conecte seu Google Drive com acesso somente leitura"}
                        </Text>
                      </View>
                    </View>
                    {academicDriveStatus.status === "connected" ? (
                      <View ref={academicDriveMenuTriggerRef}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Mais opções da base acadêmica"
                          accessibilityState={{ expanded: academicDriveMenuOpen }}
                          disabled={academicDriveBusy}
                          onPress={toggleAcademicDriveMenu}
                          style={(state) => {
                            const hovered = Boolean(
                              (state as typeof state & { hovered?: boolean }).hovered,
                            );
                            return {
                              width: 34,
                              height: 34,
                              borderRadius: radius.full,
                              alignItems: "center",
                              justifyContent: "center",
                              backgroundColor:
                                state.pressed || hovered || academicDriveMenuOpen
                                  ? colors.secondaryBg
                                  : "transparent",
                              opacity: academicDriveBusy ? 0.55 : 1,
                            };
                          }}
                        >
                          <GoAtletaIcon
                            name="ellipsisVertical"
                            size={17}
                            color={colors.muted}
                          />
                        </Pressable>
                      </View>
                    ) : (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Conectar Google Drive"
                        disabled={academicDriveOperation === "connecting"}
                        onPress={() => {
                          void handleAcademicDrive();
                        }}
                        style={{
                          minHeight: 34,
                          paddingVertical: 6,
                          paddingHorizontal: 12,
                          borderRadius: radius.full,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: colors.primaryBg,
                          opacity:
                            academicDriveOperation === "connecting" ? 0.65 : 1,
                        }}
                      >
                        <Text
                          style={{
                            color: colors.primaryText,
                            fontSize: 12,
                            fontWeight: "700",
                          }}
                        >
                          {academicDriveOperation === "connecting"
                            ? "Conectando..."
                            : "Conectar"}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              ) : null}

              <View
                style={{
                  borderRadius: radius.card,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  minHeight: 58,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <View
                  style={{
                    flex: 1,
                    minWidth: 0,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: colors.secondaryBg,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <GoAtletaIcon
                      name="google"
                      size={18}
                      color={colors.muted}
                    />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      style={{
                        color: colors.text,
                        fontSize: 14,
                        fontWeight: "600",
                      }}
                    >
                      Google
                    </Text>
                    <Text
                      style={{
                        color: colors.muted,
                        fontSize: 12,
                        marginTop: 2,
                      }}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {unlinkingGoogle
                        ? "Desvinculando Google..."
                        : accountSecurity.googleConnected
                          ? "Conta conectada"
                          : "Conecte sua conta Google"}
                    </Text>
                  </View>
                </View>

                {accountSecurity.googleConnected ? (
                  <View ref={googleMenuTriggerRef}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Mais opções da conta Google"
                      accessibilityState={{ expanded: googleMenuOpen }}
                      disabled={unlinkingGoogle}
                      onPress={toggleGoogleMenu}
                      style={(state) => {
                        const hovered = Boolean(
                          (state as typeof state & { hovered?: boolean }).hovered,
                        );
                        return {
                          width: 34,
                          height: 34,
                          borderRadius: radius.full,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor:
                            state.pressed || hovered || googleMenuOpen
                              ? colors.card
                              : "transparent",
                          opacity: unlinkingGoogle ? 0.55 : 1,
                        };
                      }}
                    >
                      <GoAtletaIcon
                        name="ellipsisVertical"
                        size={17}
                        color={colors.muted}
                      />
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Conectar conta Google"
                    onPress={async () => {
                      try {
                        await signInWithOAuth("google", "profile");
                      } catch {
                        Alert.alert(
                          "Google",
                          "Não foi possível iniciar o vínculo com Google agora.",
                        );
                      }
                    }}
                    style={{
                      minHeight: 34,
                      paddingVertical: 6,
                      paddingHorizontal: 12,
                      borderRadius: radius.full,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: colors.primaryBg,
                    }}
                  >
                    <Text
                      style={{
                        color: colors.primaryText,
                        fontSize: 12,
                        fontWeight: "700",
                      }}
                    >
                      Conectar
                    </Text>
                  </Pressable>
                )}
              </View>

              {!accountSecurity.emailConfirmed && accountSecurity.canUseEmailCode ? (
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable
                    onPress={() =>
                      router.push(
                        `/verify-email?email=${encodeURIComponent(session?.user?.email ?? "")}`
                      )
                    }
                    style={{
                      flex: 1,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.secondaryBg,
                      paddingVertical: 10,
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                      Inserir código
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={async () => {
                      const accountEmail = session?.user?.email ?? "";
                      if (!accountEmail) return;
                      try {
                        await resendSignupCode(accountEmail, "verify-email");
                        Alert.alert("Email", "Código reenviado para seu e-mail.");
                      } catch {
                        Alert.alert("Email", "Não foi possível reenviar o código agora.");
                      }
                    }}
                    style={{
                      flex: 1,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.secondaryBg,
                      paddingVertical: 10,
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                      Reenviar código
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
            <SettingsRow
              icon="logout"
              iconBg="rgba(255, 130, 130, 0.16)"
              label="Sair"
              onPress={async () => {
                await signOut();
              }}
              rightContent={<View />}
            />
            <View style={{ gap: 8 }}>
              <Pressable
                accessibilityLabel={
                  dangerZoneExpanded ? "Recolher zona sensível" : "Mostrar zona sensível"
                }
                accessibilityRole="button"
                accessibilityState={{ expanded: dangerZoneExpanded }}
                onPress={() => setDangerZoneExpanded((current) => !current)}
                suppressWebHoverFeedback
                style={({ pressed }) => ({
                  minHeight: 32,
                  alignSelf: "flex-start",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text
                  style={{
                    color: colors.dangerText,
                    fontSize: 13,
                    fontWeight: "700",
                    textDecorationLine: "underline",
                  }}
                >
                  Zona sensível
                </Text>
                <GoAtletaIcon
                  name={dangerZoneExpanded ? "chevronUp" : "chevronDown"}
                  size={15}
                  color={colors.dangerText}
                />
              </Pressable>
              {dangerZoneExpanded ? (
                <Pressable
                  accessibilityLabel="Excluir conta"
                  accessibilityRole="button"
                  onPress={openAccountDeletion}
                  style={({ pressed }) => ({
                    minHeight: 62,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    borderRadius: radius.card,
                    borderWidth: 1,
                    borderColor: colors.dangerBorder,
                    backgroundColor: pressed ? colors.dangerBg : colors.card,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                  })}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: colors.dangerBg,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <GoAtletaIcon name="trash" size={18} color={colors.dangerText} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <Text style={{ color: colors.dangerText, fontSize: 14, fontWeight: "700" }}>
                      Excluir conta
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 12 }} numberOfLines={2}>
                      Apaga seus dados pessoais e encerra o acesso.
                    </Text>
                  </View>
                  <GoAtletaIcon name="chevronForward" size={16} color={colors.dangerText} />
                </Pressable>
              ) : null}
            </View>
            </View>
          </ResponsiveGrid>
        </ResponsivePage>
      </ScrollView>
      <Modal
        visible={googleMenuOpen && Boolean(googleMenuAnchor)}
        animationType="none"
        transparent
        onRequestClose={closeGoogleMenu}
      >
        <View
          pointerEvents="box-none"
          style={{ flex: 1 }}
          accessibilityViewIsModal
        >
          <Pressable
            accessibilityLabel="Fechar opções da conta Google"
            onPress={closeGoogleMenu}
            suppressWebHoverFeedback
            disableWebPressScale
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              backgroundColor: "rgba(0,0,0,0.001)",
            }}
          />
          {googleMenuAnchor ? (
            <View
              accessibilityRole="menu"
              style={[
                {
                  position: "absolute",
                  top: googleMenuAnchor.top,
                  right: googleMenuAnchor.right,
                  width: Math.min(190, viewportWidth - 24),
                  paddingVertical: 5,
                  borderRadius: radius.internal,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                },
                Platform.OS === "web"
                  ? ({
                      boxShadow: "0px 12px 24px rgba(0, 0, 0, 0.24)",
                    } as any)
                  : shadow.elevated,
              ]}
            >
              <Pressable
                accessibilityRole="menuitem"
                onPress={() => {
                  closeGoogleMenu();
                  handleUnlinkGoogle();
                }}
                style={(state) => {
                  const hovered = Boolean(
                    (state as typeof state & { hovered?: boolean }).hovered,
                  );
                  return {
                    minHeight: 38,
                    paddingHorizontal: 12,
                    paddingVertical: 9,
                    justifyContent: "center",
                    backgroundColor:
                      state.pressed || hovered
                        ? colors.secondaryBg
                        : "transparent",
                  };
                }}
              >
                <Text
                  style={{
                    color: colors.dangerText,
                    fontSize: 12,
                    fontWeight: "800",
                  }}
                >
                  Desvincular Google
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </Modal>
      <Modal
        visible={academicDriveMenuOpen && Boolean(academicDriveMenuAnchor)}
        animationType="none"
        transparent
        onRequestClose={closeAcademicDriveMenu}
      >
        <View
          pointerEvents="box-none"
          style={{ flex: 1 }}
          accessibilityViewIsModal
        >
          <Pressable
            accessibilityLabel="Fechar opções da base acadêmica"
            onPress={closeAcademicDriveMenu}
            suppressWebHoverFeedback
            disableWebPressScale
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              backgroundColor: "rgba(0,0,0,0.001)",
            }}
          />
          {academicDriveMenuAnchor ? (
            <View
              accessibilityRole="menu"
              style={[
                {
                  position: "absolute",
                  top: academicDriveMenuAnchor.top,
                  right: academicDriveMenuAnchor.right,
                  width: Math.min(190, viewportWidth - 24),
                  paddingVertical: 5,
                  borderRadius: radius.internal,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                },
                Platform.OS === "web"
                  ? ({
                      boxShadow: "0px 12px 24px rgba(0, 0, 0, 0.24)",
                    } as any)
                  : shadow.elevated,
              ]}
            >
              {[
                {
                  label: "Abrir documentos",
                  danger: false,
                  action: () => router.push("/academic-knowledge"),
                },
                {
                  label: "Sincronizar agora",
                  danger: false,
                  action: () => {
                    void handleAcademicDrive();
                  },
                },
                {
                  label: "Desconectar",
                  danger: true,
                  action: handleDisconnectAcademicDrive,
                },
              ].map((menuItem) => (
                <Pressable
                  key={menuItem.label}
                  accessibilityRole="menuitem"
                  onPress={() => {
                    closeAcademicDriveMenu();
                    menuItem.action();
                  }}
                  style={(state) => {
                    const hovered = Boolean(
                      (state as typeof state & { hovered?: boolean }).hovered,
                    );
                    return {
                      minHeight: 38,
                      paddingHorizontal: 12,
                      paddingVertical: 9,
                      justifyContent: "center",
                      backgroundColor:
                        state.pressed || hovered
                          ? colors.secondaryBg
                          : "transparent",
                    };
                  }}
                >
                  <Text
                    style={{
                      color: menuItem.danger
                        ? colors.dangerText
                        : colors.text,
                      fontSize: 12,
                      fontWeight: "800",
                    }}
                  >
                    {menuItem.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      </Modal>
      <Modal
        visible={profileMenuOpen && Boolean(profileMenuAnchor)}
        animationType="none"
        transparent
        onRequestClose={closeProfileMenu}
      >
        <View
          pointerEvents="box-none"
          style={{ flex: 1 }}
          accessibilityViewIsModal
        >
          <Pressable
            accessibilityLabel="Fechar troca de perfil"
            onPress={closeProfileMenu}
            suppressWebHoverFeedback
            disableWebPressScale
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              backgroundColor: "rgba(0,0,0,0.001)",
            }}
          />
          {profileMenuAnchor ? (
            <View
              accessibilityRole="menu"
              style={[
                {
                  position: "absolute",
                  top: profileMenuAnchor.top,
                  left: profileMenuAnchor.left,
                  width: Math.min(260, viewportWidth - 32),
                  padding: 8,
                  borderRadius: radius.card,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                  gap: 2,
                },
                Platform.OS === "web"
                  ? ({
                      boxShadow: "0 18px 44px rgba(0,0,0,0.35)",
                    } as any)
                  : shadow.elevated,
              ]}
            >
              {authorizedProfileSwitchIds.map((profileId) => {
                const selected = selectedProfilePreview === profileId;
                return (
                  <Pressable
                    key={profileId}
                    accessibilityRole="menuitem"
                    accessibilityState={{ selected }}
                    onPress={() => {
                      void applyProfilePreview(profileId);
                    }}
                    style={getProfileMenuOptionStyle(selected)}
                  >
                    <Text
                      style={getProfileMenuOptionTextStyle(selected, colors.text)}
                    >
                      {profileSwitchLabels[profileId]}
                    </Text>
                    {selected ? (
                      <GoAtletaIcon
                        name="checkmarkCircle"
                        size={18}
                        color={colors.primaryBg}
                      />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>
      </Modal>
      <Modal
        visible={showPhotoViewer}
        animationType="fade"
        transparent={false}
        onRequestClose={() => setShowPhotoViewer(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
              paddingHorizontal: 16,
              paddingVertical: 10,
              backgroundColor: colors.background,
            }}
          >
            <Pressable
              onPress={() => setShowPhotoViewer(false)}
              style={{
                width: 36,
                height: 36,
                borderRadius: radius.full,
                backgroundColor: colors.secondaryBg,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <GoAtletaIcon name="chevronBack" size={18} color={colors.text} />
            </Pressable>
            <Text style={{ color: colors.text, fontWeight: "700", fontSize: 16 }}>
              Foto do perfil
            </Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable
                onPress={() => {
                  setShowPhotoViewer(false);
                  setShowPhotoSheet(true);
                }}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: radius.full,
                  backgroundColor: colors.secondaryBg,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <GoAtletaIcon name="edit" size={18} color={colors.text} />
              </Pressable>
              <Pressable
                onPress={() => setShowPhotoViewer(false)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: radius.full,
                  backgroundColor: colors.secondaryBg,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <GoAtletaIcon name="share" size={18} color={colors.text} />
              </Pressable>
            </View>
          </View>
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            { photoUri ? (
              <Image
                source={{ uri: photoUri }}
                style={{ width: "100%", height: "100%" }}
                contentFit="contain"
              />
            ) : (
              <View
                style={{
                  width: 220,
                  height: 220,
                  borderRadius: 110,
                  backgroundColor: colors.secondaryBg,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <GoAtletaIcon name="personSolid" size={96} color={colors.text} />
              </View>
            )}
          </View>
        </SafeAreaView>
      </Modal>
      <ModalSheet
        visible={showAccountEditor}
        onClose={requestCloseAccountEditor}
        cardStyle={[accountEditorStyle, { overflow: "hidden" }]}
        position="center"
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
            <Text style={{ color: colors.text, fontSize: 20, fontWeight: "800" }}>
              Conta e segurança
            </Text>
            <Text style={{ color: colors.muted, fontSize: 13 }}>
              Gerencie seu contato alternativo e sua senha.
            </Text>
          </View>
          <Pressable
            accessibilityLabel="Fechar conta e segurança"
            accessibilityRole="button"
            onPress={requestCloseAccountEditor}
            style={({ pressed }) => ({
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: pressed ? colors.card : colors.secondaryBg,
              alignItems: "center",
              justifyContent: "center",
            })}
          >
            <GoAtletaIcon name="close" size={18} color={colors.text} />
          </Pressable>
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: 22, paddingBottom: 2 }}
          style={{ width: "100%", flexShrink: 1, minHeight: 0 }}
        >

          <View style={{ gap: 14, overflow: "visible" }}>
            <View style={{ gap: 8 }}>
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: "800" }}>
                E-mails
              </Text>
              <View
                style={{
                  minHeight: 50,
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  backgroundColor: colors.secondaryBg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  justifyContent: "center",
                  gap: 2,
                }}
              >
                <Text style={{ color: colors.muted, fontSize: 11 }}>E-mail de acesso</Text>
                <Text
                  selectable
                  numberOfLines={1}
                  style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}
                >
                  {accountSecurity.loginLabel}
                </Text>
              </View>
            </View>

            <AccountTextField
              label="E-mail alternativo (opcional)"
              value={securityContactDraft}
              placeholder="contato@exemplo.com"
              error={securityContactError}
              autoComplete="email"
              returnKeyType="done"
              onChangeText={(value) => {
                setSecurityContactDraft(value);
                if (securityContactError) setSecurityContactError(null);
                if (securityContactSuccess) setSecurityContactSuccess(false);
              }}
              onSubmitEditing={() => {
                if (canSaveSecurityContact) void saveSecurityContact();
              }}
            />
            {securityContactSuccess ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                <GoAtletaIcon name="success" size={16} color={colors.successText} />
                <Text style={{ color: colors.successText, fontSize: 12, fontWeight: "700" }}>
                  E-mail alternativo salvo.
                </Text>
              </View>
            ) : null}
            <Button
              label={
                securityContactDraft.trim()
                  ? "Salvar e-mail"
                  : accountSecurity.securityContactEmail
                    ? "Remover e-mail"
                    : "Salvar e-mail"
              }
              loading={savingSecurityContact}
              loadingLabel="Salvando"
              disabled={!canSaveSecurityContact}
              onPress={() => void saveSecurityContact()}
            />
          </View>

          <View style={{ height: 1, backgroundColor: colors.border }} />

          <View style={{ gap: 14, overflow: "visible" }}>
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: "800" }}>
              Alterar senha
            </Text>
            <AccountTextField
              label="Senha atual (se houver)"
              value={currentPassword}
              placeholder="Sua senha atual"
              error={currentPasswordError}
              secureTextEntry
              passwordVisible={showCurrentPassword}
              onTogglePassword={() => setShowCurrentPassword((current) => !current)}
              autoComplete="current-password"
              onChangeText={(value) => {
                setCurrentPassword(value);
                if (currentPasswordError) setCurrentPasswordError(null);
                if (passwordChanged) setPasswordChanged(false);
              }}
            />
            <AccountTextField
              label="Nova senha"
              value={newPassword}
              placeholder="Mínimo de 8 caracteres"
              error={newPasswordError}
              secureTextEntry
              passwordVisible={showNewPassword}
              onTogglePassword={() => setShowNewPassword((current) => !current)}
              autoComplete="new-password"
              onChangeText={(value) => {
                setNewPassword(value);
                if (newPasswordError) setNewPasswordError(null);
                if (passwordChanged) setPasswordChanged(false);
              }}
            />
            <AccountTextField
              label="Confirmar nova senha"
              value={passwordConfirmation}
              placeholder="Repita a nova senha"
              error={passwordConfirmationError}
              secureTextEntry
              passwordVisible={showPasswordConfirmation}
              onTogglePassword={() =>
                setShowPasswordConfirmation((current) => !current)
              }
              autoComplete="new-password"
              returnKeyType="done"
              onChangeText={(value) => {
                setPasswordConfirmation(value);
                if (passwordConfirmationError) setPasswordConfirmationError(null);
                if (passwordChanged) setPasswordChanged(false);
              }}
              onSubmitEditing={() => {
                if (canChangePassword) void savePassword();
              }}
            />
            {passwordChanged ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                <GoAtletaIcon name="success" size={16} color={colors.successText} />
                <Text style={{ color: colors.successText, fontSize: 12, fontWeight: "700" }}>
                  Senha alterada com sucesso.
                </Text>
              </View>
            ) : null}
            <Button
              label="Alterar senha"
              loading={savingPassword}
              loadingLabel="Alterando"
              disabled={!canChangePassword}
              onPress={() => void savePassword()}
            />
          </View>
        </ScrollView>
      </ModalSheet>
      <ModalSheet
        visible={showAccountDeletion}
        onClose={closeAccountDeletion}
        cardStyle={[accountDeletionStyle, { overflow: "visible" }]}
        position="center"
      >
        <View style={{ gap: 20, overflow: "visible" }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 16,
            }}
          >
            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
              <Text style={{ color: colors.dangerText, fontSize: 20, fontWeight: "800" }}>
                Excluir conta
              </Text>
              <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 18 }}>
                Esta ação não pode ser desfeita.
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Fechar exclusão de conta"
              accessibilityRole="button"
              disabled={deletingAccount}
              onPress={closeAccountDeletion}
              style={({ pressed }) => ({
                width: 38,
                height: 38,
                borderRadius: 19,
                backgroundColor: pressed ? colors.card : colors.secondaryBg,
                alignItems: "center",
                justifyContent: "center",
                opacity: deletingAccount ? 0.45 : 1,
              })}
            >
              <GoAtletaIcon name="close" size={18} color={colors.text} />
            </Pressable>
          </View>

          <View style={{ gap: 8, overflow: "visible" }}>
            <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>
              Digite {ACCOUNT_DELETION_CONFIRMATION} para confirmar
            </Text>
            <View style={{ position: "relative", overflow: "visible" }}>
              <FloatingFieldError message={accountDeletionError} />
              <View
                style={{
                  minHeight: 50,
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  backgroundColor: colors.inputBg,
                  borderWidth: 1,
                  borderColor: accountDeletionError ? colors.dangerBorder : colors.border,
                  justifyContent: "center",
                }}
              >
                <TextInput
                  accessibilityLabel="Confirmação da exclusão da conta"
                  autoCapitalize="characters"
                  autoComplete="off"
                  autoCorrect={false}
                  editable={!deletingAccount}
                  maxLength={ACCOUNT_DELETION_CONFIRMATION.length}
                  placeholder={ACCOUNT_DELETION_CONFIRMATION}
                  placeholderTextColor={colors.muted}
                  returnKeyType="done"
                  value={accountDeletionConfirmation}
                  onChangeText={(value) => {
                    setAccountDeletionConfirmation(value);
                    if (accountDeletionError) setAccountDeletionError(null);
                  }}
                  onSubmitEditing={() => {
                    if (canDeleteAccount) void handleDeleteAccount();
                  }}
                  style={{
                    color: colors.text,
                    fontSize: 15,
                    paddingVertical: 0,
                    borderRadius: 0,
                    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}),
                  }}
                />
              </View>
            </View>
          </View>

          <Button
            label="Excluir conta"
            loading={deletingAccount}
            loadingLabel="Excluindo"
            variant="danger"
            disabled={!canDeleteAccount}
            onPress={() => void handleDeleteAccount()}
          />
        </View>
      </ModalSheet>
      <ModalSheet
        visible={showPhotoSheet}
        onClose={() => setShowPhotoSheet(false)}
        cardStyle={photoSheetStyle}
        position="center"
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Pressable
            onPress={() => setShowPhotoSheet(false)}
            style={{
              width: 36,
              height: 36,
              borderRadius: radius.full,
              backgroundColor: colors.secondaryBg,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <GoAtletaIcon name="close" size={18} color={colors.text} />
          </Pressable>
          <Text style={{ color: colors.text, fontWeight: "700" }}>Foto do perfil</Text>
          <View style={{ width: 36, height: 36 }} />
        </View>
        <View style={{ gap: 12 }}>
          {([
            { label: "Câmera", icon: "camera", value: "camera" },
            { label: "Galeria", icon: "gallery", value: "library" },
          ] as const).map((item) => (
            <Pressable
              key={item.label}
              onPress={() => pickPhoto(item.value)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingVertical: 12,
                paddingHorizontal: 12,
                borderRadius: 14,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  backgroundColor: colors.secondaryBg,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <GoAtletaIcon name={item.icon} size={18} color={colors.text} />
              </View>
              <Text style={{ color: colors.text, fontWeight: "600" }}>{item.label}</Text>
            </Pressable>
          ))}
          {photoUri ? (
            <Pressable
              onPress={() => {
                confirm({
                  title: "Remover foto",
                  message: "Tem certeza que deseja remover sua foto de perfil?",
                  confirmLabel: "Remover",
                  cancelLabel: "Cancelar",
                  tone: "danger",
                  onConfirm: async () => {
                    await savePhoto(null);
                    setShowPhotoSheet(false);
                  },
                });
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingVertical: 12,
                paddingHorizontal: 12,
                borderRadius: 14,
                backgroundColor: colors.dangerSolidBg,
              }}
            >
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  backgroundColor: "rgba(255,255,255,0.18)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <GoAtletaIcon name="trash" size={18} color={colors.dangerSolidText} />
              </View>
              <Text style={{ color: colors.dangerSolidText, fontWeight: "600" }}>
                Remover foto
              </Text>
            </Pressable>
          ) : null}
        </View>
      </ModalSheet>
      <WebCameraCaptureModal
        visible={showCameraCapture}
        captureQuality={student?.id ? 0.85 : 0.7}
        initialFacing="back"
        title="Foto do perfil"
        subtitle="Posicione-se no centro da imagem."
        onClose={() => setShowCameraCapture(false)}
        onCapture={({ uri, mimeType }) => persistPickedPhoto(uri, mimeType)}
      />
    </SafeAreaView>
  );
}
