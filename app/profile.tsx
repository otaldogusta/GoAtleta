import AsyncStorage from "@react-native-async-storage/async-storage";
import { canUseProfilePreview } from "../src/dev/profile-preview-access";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { usePathname, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import CountryList, { type Country } from "country-list-with-dial-code-and-flag";

// perf-check: ignore-inline-row-style - compact mapped form controls require live theme and selection colors; lists are bounded and non-virtualized.
import {
  Alert,
  Animated,
  LayoutAnimation,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";


import type { AthletePosition, ClassGroup } from "../src/core/models";

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
    getStudentPhotoAccessUrl,
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
import { getClasses } from "../src/db/seed";
import { updateStudent } from "../src/db/students";
import { setMyStudentPhoto } from "../src/api/student-self-photo";
import { useStudentProfilePhoto } from "../src/hooks/use-student-profile-photo";
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
import { AnchoredDropdown } from "../src/ui/AnchoredDropdown";
import { AnchoredDropdownOption } from "../src/ui/AnchoredDropdownOption";
import { useConfirmDialog } from "../src/ui/confirm-dialog";
import { useSaveToast } from "../src/ui/save-toast";
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
import { CountryFlagIcon } from "../src/ui/CountryFlagIcon";
import { NativeDateInput } from "../src/ui/NativeDateInput";
import {
  resolveAuthorizedProfileSwitchIds,
  type ProfileSwitchId,
} from "../src/ui/profile-switch-options";
import { useResponsiveLayout } from "../src/ui/use-responsive-layout";

const ATHLETE_POSITION_OPTIONS: { value: AthletePosition; label: string }[] = [
  { value: "indefinido", label: "Não definida" },
  { value: "levantador", label: "Levantador" },
  { value: "oposto", label: "Oposto" },
  { value: "ponteiro", label: "Ponteiro" },
  { value: "central", label: "Central" },
  { value: "libero", label: "Líbero" },
];

type ProfilePreviewId = ProfileSwitchId;

const QUICK_COUNTRY_CODES = ["BR", "PT", "US", "AR", "PY", "UY"] as const;
const COUNTRY_SEARCH_RESULT_LIMIT = 30;

const profileSwitchLabels: Record<ProfilePreviewId, string> = {
  professor: "Professor",
  student: "Aluno",
  admin: "Coordenação",
  family: "Família",
};

const mobileCountryOptions = CountryList.getAll({ withSecondary: false }).sort((left, right) => {
  const preferredOrder = new Map<string, number>(QUICK_COUNTRY_CODES.map((code, index) => [code, index]));
  const leftOrder = preferredOrder.get(left.code) ?? Number.MAX_SAFE_INTEGER;
  const rightOrder = preferredOrder.get(right.code) ?? Number.MAX_SAFE_INTEGER;
  if (leftOrder !== rightOrder) return leftOrder - rightOrder;
  return left.name.localeCompare(right.name, "pt-BR");
});

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

const formatStudentBirthDate = (value?: string | null) => {
  if (!value) return "Não informada";
  const dateOnly = value.slice(0, 10);
  const [year, month, day] = dateOnly.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
};

const formatStudentPhone = (value?: string | null) => {
  const digits = String(value ?? "").replace(/\D/g, "").replace(/^55/, "");
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return value || "Não informado";
};

const parseStudentBirthDate = (value: string) => {
  const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  const iso = `${year}-${month}-${day}`;
  const parsed = new Date(`${iso}T12:00:00`);
  return Number.isNaN(parsed.getTime()) || parsed.getDate() !== Number(day) || parsed.getMonth() + 1 !== Number(month)
    ? null
    : iso;
};

const ageFromBirthDate = (birthDate: string) => {
  const birth = new Date(`${birthDate}T12:00:00`);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const beforeBirthday = today.getMonth() < birth.getMonth()
    || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate());
  if (beforeBirthday) age -= 1;
  return Math.max(0, age);
};

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

function MobileProfileSection({
  icon,
  title,
  subtitle,
  expanded,
  onPress,
  children,
  grouped = false,
}: {
  icon: Parameters<typeof GoAtletaIcon>[0]["name"];
  title: string;
  subtitle: string;
  expanded: boolean;
  onPress: () => void;
  children: ReactNode;
  grouped?: boolean;
}) {
  const { colors } = useAppTheme();
  const [expansionAnim] = useState(() => new Animated.Value(expanded ? 1 : 0));
  const [renderChildren, setRenderChildren] = useState(expanded);

  useEffect(() => {
    const useNativeDriver = Platform.OS !== "web";
    if (expanded) {
      // Children must mount before the opening animation can reveal them.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRenderChildren(true);
      expansionAnim.stopAnimation();
      Animated.timing(expansionAnim, {
        toValue: 1,
        duration: 180,
        useNativeDriver,
      }).start();
      return;
    }
    expansionAnim.stopAnimation();
    Animated.timing(expansionAnim, {
      toValue: 0,
      duration: 140,
      useNativeDriver,
    }).start(({ finished }) => {
      if (finished) setRenderChildren(false);
    });
  }, [expanded, expansionAnim]);

  return (
    <View
      style={{
        overflow: "hidden",
        borderRadius: grouped ? 0 : 14,
        borderWidth: grouped ? 0 : 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${expanded ? "Recolher" : "Abrir"} ${title}`}
        onPress={onPress}
        suppressWebHoverFeedback
        disableWebPressScale
        style={(state) => ({
          minHeight: grouped ? 58 : 66,
          paddingHorizontal: grouped ? 14 : 12,
          paddingVertical: 12,
          flexDirection: "row",
          alignItems: "center",
          gap: 13,
          backgroundColor:
            state.pressed || Boolean((state as typeof state & { hovered?: boolean }).hovered)
              ? colors.secondaryBg
              : "transparent",
        })}
      >
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(61, 220, 132, 0.12)",
          }}
        >
          <GoAtletaIcon name={icon} size={20} color={colors.primaryBg} />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: "800" }}>{title}</Text>
          <Text style={{ color: colors.muted, fontSize: 11.5 }} numberOfLines={1}>{subtitle}</Text>
        </View>
        <GoAtletaIcon name={expanded ? "chevronUp" : "chevronForward"} size={18} color={colors.text} />
      </Pressable>
      {renderChildren ? (
        <Animated.View style={{
          borderTopWidth: 1,
          borderTopColor: colors.border,
          padding: 16,
          gap: 12,
          opacity: expansionAnim,
          transform: [{
            translateY: expansionAnim.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }),
          }],
        }}>
          {children}
        </Animated.View>
      ) : null}
    </View>
  );
}

function ProfileToggle({ enabled }: { enabled: boolean }) {
  const { colors } = useAppTheme();
  return (
    <View
      pointerEvents="none"
      style={{
        width: 44,
        height: 26,
        borderRadius: 13,
        paddingHorizontal: 3,
        justifyContent: "center",
        alignItems: enabled ? "flex-end" : "flex-start",
        backgroundColor: enabled ? colors.primaryBg : colors.secondaryBg,
        borderWidth: 1,
        borderColor: enabled ? colors.primaryBg : colors.border,
      }}
    >
      <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: enabled ? colors.primaryText : colors.muted }} />
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
  const { showSaveToast } = useSaveToast();
  const {
    signOut,
    session,
    resendSignupCode,
    signInWithOAuth,
    unlinkIdentityProvider,
    requestPhoneChange,
    verifyPhoneChange,
    removeVerifiedPhone,
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
  const [mobileExpandedSection, setMobileExpandedSection] = useState<string | null>("personal");
  const [mobileNameDraft, setMobileNameDraft] = useState("");
  const [mobileBirthDraft, setMobileBirthDraft] = useState("");
  const [mobilePhoneDraft, setMobilePhoneDraft] = useState("");
  const [mobileCpfDraft, setMobileCpfDraft] = useState("");
  const [mobileRgDraft, setMobileRgDraft] = useState("");
  const [mobileAddressDraft, setMobileAddressDraft] = useState("");
  const [mobileGenderIdentityDraft, setMobileGenderIdentityDraft] = useState("");
  const [mobileGuardianNameDraft, setMobileGuardianNameDraft] = useState("");
  const [mobileGuardianPhoneDraft, setMobileGuardianPhoneDraft] = useState("");
  const [mobileGuardianRelationDraft, setMobileGuardianRelationDraft] = useState("");
  const [mobileCountryCode, setMobileCountryCode] = useState("+55");
  const [mobileCountryIso, setMobileCountryIso] = useState("BR");
  const [mobileCountrySearch, setMobileCountrySearch] = useState("");
  const [mobileProfileBaseline, setMobileProfileBaseline] = useState({
    name: "",
    birth: "",
    phone: "",
    cpf: "",
    rg: "",
    address: "",
    genderIdentity: "",
    guardianName: "",
    guardianPhone: "",
    guardianRelation: "",
    countryCode: "+55",
  });
  const [mobileCountryMenuOpen, setMobileCountryMenuOpen] = useState(false);
  const [mobileCountryMenuLayout, setMobileCountryMenuLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [mobileMoreDataExpanded, setMobileMoreDataExpanded] = useState(false);
  const [savingMobileProfile, setSavingMobileProfile] = useState(false);
  const [pendingPhoneVerification, setPendingPhoneVerification] = useState("");
  const [phoneVerificationCode, setPhoneVerificationCode] = useState("");
  const [phoneVerificationError, setPhoneVerificationError] = useState<string | null>(null);
  const [requestingPhoneVerification, setRequestingPhoneVerification] = useState(false);
  const [verifyingPhone, setVerifyingPhone] = useState(false);
  const [removingPhone, setRemovingPhone] = useState(false);
  const [mobilePositionDraft, setMobilePositionDraft] = useState<AthletePosition>("indefinido");
  const [mobileHealthIssueDraft, setMobileHealthIssueDraft] = useState(false);
  const [mobileHealthIssueNotesDraft, setMobileHealthIssueNotesDraft] = useState("");
  const [mobileMedicationUseDraft, setMobileMedicationUseDraft] = useState(false);
  const [mobileMedicationNotesDraft, setMobileMedicationNotesDraft] = useState("");
  const [mobileHealthObservationsDraft, setMobileHealthObservationsDraft] = useState("");
  const [mobileSportsBaseline, setMobileSportsBaseline] = useState({
    position: "indefinido" as AthletePosition,
    healthIssue: false,
    healthIssueNotes: "",
    medicationUse: false,
    medicationNotes: "",
    healthObservations: "",
  });
  const [savingMobileSports, setSavingMobileSports] = useState(false);
  const [profileMenuAnchor, setProfileMenuAnchor] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const studentPhotoUri = useStudentProfilePhoto(student);
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
  const mobileCountryTriggerRef = useRef<View | null>(null);
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
          setPhotoUri(studentPhotoUri);
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
  }, [session?.user?.id, student, studentPhotoUri]);

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
  const canUseDevPreview = canUseProfilePreview(session?.user?.email) && Boolean(setDevProfilePreview);
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

  useEffect(() => {
    const resolvedName = student?.name || currentAccountName;
    const nextValues = {
      name: resolvedName === PROFILE_NAME_FALLBACK ? "" : resolvedName,
      birth: student?.birthDate && formatStudentBirthDate(student.birthDate) !== "Não informada" ? formatStudentBirthDate(student.birthDate) : "",
      phone: student?.phone && formatStudentPhone(student.phone) !== "Não informado" ? formatStudentPhone(student.phone) : "",
      cpf: student?.cpfMasked ?? "",
      rg: student?.rg ?? "",
      address: student?.address ?? "",
      genderIdentity: student?.genderIdentity ?? "",
      guardianName: student?.guardianName ?? "",
      guardianPhone: student?.guardianPhone ?? "",
      guardianRelation: student?.guardianRelation ?? "",
      countryCode: "+55",
    };
    // Reconcile the editable draft when the authenticated profile changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileNameDraft(nextValues.name);
    setMobileBirthDraft(nextValues.birth);
    setMobilePhoneDraft(nextValues.phone);
    setMobileCpfDraft(nextValues.cpf);
    setMobileRgDraft(nextValues.rg);
    setMobileAddressDraft(nextValues.address);
    setMobileGenderIdentityDraft(nextValues.genderIdentity);
    setMobileGuardianNameDraft(nextValues.guardianName);
    setMobileGuardianPhoneDraft(nextValues.guardianPhone);
    setMobileGuardianRelationDraft(nextValues.guardianRelation);
    setMobileCountryCode(nextValues.countryCode);
    setMobileProfileBaseline(nextValues);
  }, [currentAccountName, student]);

  useEffect(() => {
    const nextValues = {
      position: student?.positionPrimary ?? "indefinido",
      healthIssue: student?.healthIssue ?? false,
      healthIssueNotes: student?.healthIssueNotes ?? "",
      medicationUse: student?.medicationUse ?? false,
      medicationNotes: student?.medicationNotes ?? "",
      healthObservations: student?.healthObservations ?? "",
    };
    // Reconcile the sports draft when a different athlete profile is loaded.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobilePositionDraft(nextValues.position);
    setMobileHealthIssueDraft(nextValues.healthIssue);
    setMobileHealthIssueNotesDraft(nextValues.healthIssueNotes);
    setMobileMedicationUseDraft(nextValues.medicationUse);
    setMobileMedicationNotesDraft(nextValues.medicationNotes);
    setMobileHealthObservationsDraft(nextValues.healthObservations);
    setMobileSportsBaseline(nextValues);
  }, [student]);

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
  }, [session]);

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
        await setMyStudentPhoto(student.id, uri);
        setPhotoUri(await getStudentPhotoAccessUrl(uri));
        await refreshRole();
      } catch (error) {
        setPhotoUri(previousPhotoUri);
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

  const mobilePhoneE164 = mobilePhoneDraft.replace(/\D/g, "")
    ? `+${mobileCountryCode.replace(/\D/g, "")}${mobilePhoneDraft.replace(/\D/g, "")}`
    : "";
  const verifiedPhoneE164 = session?.user?.phone_confirmed_at ? String(session.user.phone ?? "") : "";
  const mobilePhoneNeedsVerification = Boolean(mobilePhoneE164 && mobilePhoneE164 !== verifiedPhoneE164);
  const phoneVerificationRequested = Boolean(
    pendingPhoneVerification && pendingPhoneVerification === mobilePhoneE164,
  );
  const mobileProfileHasChanges = Boolean(
    mobileNameDraft.trim() !== mobileProfileBaseline.name.trim()
      || mobileBirthDraft.trim() !== mobileProfileBaseline.birth.trim()
      || mobilePhoneDraft.trim() !== mobileProfileBaseline.phone.trim()
      || mobileCpfDraft.trim() !== mobileProfileBaseline.cpf.trim()
      || mobileRgDraft.trim() !== mobileProfileBaseline.rg.trim()
      || mobileAddressDraft.trim() !== mobileProfileBaseline.address.trim()
      || mobileGenderIdentityDraft.trim() !== mobileProfileBaseline.genderIdentity.trim()
      || mobileGuardianNameDraft.trim() !== mobileProfileBaseline.guardianName.trim()
      || mobileGuardianPhoneDraft.trim() !== mobileProfileBaseline.guardianPhone.trim()
      || mobileGuardianRelationDraft.trim() !== mobileProfileBaseline.guardianRelation.trim()
      || mobileCountryCode !== mobileProfileBaseline.countryCode,
  );
  const mobileSportsHasChanges = Boolean(
    mobilePositionDraft !== mobileSportsBaseline.position
      || mobileHealthIssueDraft !== mobileSportsBaseline.healthIssue
      || mobileHealthIssueNotesDraft.trim() !== mobileSportsBaseline.healthIssueNotes.trim()
      || mobileMedicationUseDraft !== mobileSportsBaseline.medicationUse
      || mobileMedicationNotesDraft.trim() !== mobileSportsBaseline.medicationNotes.trim()
      || mobileHealthObservationsDraft.trim() !== mobileSportsBaseline.healthObservations.trim(),
  );
  const mobileSecurityHasChanges = Boolean(
    mobileExpandedSection === "security"
      && (securityContactDraft.trim() !== accountSecurity.securityContactEmail.trim()
        || newPassword
        || passwordConfirmation),
  );
  const mobileHasUnsavedChanges = mobileProfileHasChanges || mobileSportsHasChanges || mobileSecurityHasChanges;
  const previousMobileDirtyRef = useRef(false);

  useEffect(() => {
    if (mobileHasUnsavedChanges && !previousMobileDirtyRef.current) {
      showSaveToast({
        message: "Você tem alterações não salvas.",
        variant: "warning",
        durationMs: 6500,
      });
    }
    previousMobileDirtyRef.current = mobileHasUnsavedChanges;
  }, [mobileHasUnsavedChanges, showSaveToast]);

  useEffect(() => {
    if (Platform.OS !== "web" || !mobileHasUnsavedChanges) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [mobileHasUnsavedChanges]);

  const saveMobileStudentProfile = async () => {
    if (savingMobileProfile) return;
    const normalizedName = mobileNameDraft.trim();
    const birthDate = parseStudentBirthDate(mobileBirthDraft);
    const phoneDigits = mobilePhoneDraft.replace(/\D/g, "");
    if (normalizedName.length < 2) {
      Alert.alert("Nome inválido", "Informe o nome completo do atleta.");
      return;
    }
    if (student && !birthDate) {
      Alert.alert("Data inválida", "Use o formato DD/MM/AAAA.");
      return;
    }
    if (student && (phoneDigits.length < 10 || phoneDigits.length > 11)) {
      Alert.alert("Celular inválido", "Informe um celular com DDD.");
      return;
    }
    setSavingMobileProfile(true);
    try {
      if (mobilePhoneNeedsVerification) {
        Alert.alert("Confirme o celular", "Toque em Validar e confirme o código recebido por SMS antes de salvar.");
        return;
      }
      if (student && birthDate) {
        await updateStudent({
          ...student,
          name: normalizedName,
          birthDate,
          age: ageFromBirthDate(birthDate),
          phone: `${mobileCountryCode.replace(/\D/g, "")}${phoneDigits}`,
          cpfMasked: mobileCpfDraft.trim() || null,
          rg: mobileRgDraft.trim() || null,
          address: mobileAddressDraft.trim(),
          genderIdentity: mobileGenderIdentityDraft.trim(),
          guardianName: mobileGuardianNameDraft.trim(),
          guardianPhone: mobileGuardianPhoneDraft.trim(),
          guardianRelation: mobileGuardianRelationDraft.trim(),
        });
      }
      if (normalizedName !== currentAccountName) await updateProfileName(normalizedName);
      await refreshRole();
      setMobileProfileBaseline({
        name: normalizedName,
        birth: mobileBirthDraft.trim(),
        phone: mobilePhoneDraft.trim(),
        cpf: mobileCpfDraft.trim(),
        rg: mobileRgDraft.trim(),
        address: mobileAddressDraft.trim(),
        genderIdentity: mobileGenderIdentityDraft.trim(),
        guardianName: mobileGuardianNameDraft.trim(),
        guardianPhone: mobileGuardianPhoneDraft.trim(),
        guardianRelation: mobileGuardianRelationDraft.trim(),
        countryCode: mobileCountryCode,
      });
      Alert.alert("Perfil atualizado", "Seus dados foram salvos.");
    } catch (error) {
      Alert.alert("Não foi possível salvar", getFriendlyErrorMessage(error));
    } finally {
      setSavingMobileProfile(false);
    }
  };

  const requestMobilePhoneVerification = async () => {
    const phoneDigits = mobilePhoneDraft.replace(/\D/g, "");
    if (requestingPhoneVerification || phoneDigits.length < 10 || phoneDigits.length > 11) return;

    setRequestingPhoneVerification(true);
    setPhoneVerificationError(null);
    try {
      await requestPhoneChange(mobilePhoneE164);
      setPendingPhoneVerification(mobilePhoneE164);
      setPhoneVerificationCode("");
      showSaveToast({ message: "Código enviado por SMS.", variant: "info" });
    } catch (error) {
      setPhoneVerificationError(getFriendlyErrorMessage(error, "Não foi possível enviar o código."));
    } finally {
      setRequestingPhoneVerification(false);
    }
  };

  const confirmMobilePhone = async () => {
    if (verifyingPhone || !pendingPhoneVerification) return;
    const birthDate = parseStudentBirthDate(mobileBirthDraft);
    setVerifyingPhone(true);
    setPhoneVerificationError(null);
    try {
      await verifyPhoneChange(pendingPhoneVerification, phoneVerificationCode);
      if (student && birthDate) {
        await updateStudent({
          ...student,
          name: mobileNameDraft.trim(),
          birthDate,
          age: ageFromBirthDate(birthDate),
          phone: pendingPhoneVerification.replace(/\D/g, ""),
          cpfMasked: mobileCpfDraft.trim() || null,
          rg: mobileRgDraft.trim() || null,
          address: mobileAddressDraft.trim(),
          genderIdentity: mobileGenderIdentityDraft.trim(),
          guardianName: mobileGuardianNameDraft.trim(),
          guardianPhone: mobileGuardianPhoneDraft.trim(),
          guardianRelation: mobileGuardianRelationDraft.trim(),
        });
      }
      if (mobileNameDraft.trim() !== currentAccountName) await updateProfileName(mobileNameDraft.trim());
      await refreshRole();
      setMobileProfileBaseline({
        name: mobileNameDraft.trim(),
        birth: mobileBirthDraft.trim(),
        phone: mobilePhoneDraft.trim(),
        cpf: mobileCpfDraft.trim(),
        rg: mobileRgDraft.trim(),
        address: mobileAddressDraft.trim(),
        genderIdentity: mobileGenderIdentityDraft.trim(),
        guardianName: mobileGuardianNameDraft.trim(),
        guardianPhone: mobileGuardianPhoneDraft.trim(),
        guardianRelation: mobileGuardianRelationDraft.trim(),
        countryCode: mobileCountryCode,
      });
      setPendingPhoneVerification("");
      setPhoneVerificationCode("");
      showSaveToast({ message: "Celular verificado e perfil atualizado.", variant: "success" });
    } catch (error) {
      setPhoneVerificationError(getFriendlyErrorMessage(error, "Código inválido ou expirado."));
    } finally {
      setVerifyingPhone(false);
    }
  };

  const removeMobilePhone = async () => {
    if (removingPhone) return;
    const approved = await confirm({
      title: "Remover celular?",
      message: "O número deixará de ser um contato verificado da sua conta.",
      confirmLabel: "Remover celular",
      cancelLabel: "Cancelar",
      tone: "danger",
      onConfirm: async () => {
        setRemovingPhone(true);
        try {
          await removeVerifiedPhone();
          if (student) await updateStudent({ ...student, phone: "" });
          await refreshRole();
          setMobilePhoneDraft("");
          setMobileProfileBaseline((current) => ({ ...current, phone: "" }));
          showSaveToast({ message: "Celular removido.", variant: "success" });
        } catch (error) {
          showSaveToast({ error, variant: "error" });
        } finally {
          setRemovingPhone(false);
        }
      },
    });
    void approved;
  };

  const saveMobileSportsProfile = async () => {
    if (!student || savingMobileSports) return;
    setSavingMobileSports(true);
    try {
      const nextValues = {
        position: mobilePositionDraft,
        healthIssue: mobileHealthIssueDraft,
        healthIssueNotes: mobileHealthIssueDraft ? mobileHealthIssueNotesDraft.trim() : "",
        medicationUse: mobileMedicationUseDraft,
        medicationNotes: mobileMedicationUseDraft ? mobileMedicationNotesDraft.trim() : "",
        healthObservations: mobileHealthObservationsDraft.trim(),
      };
      await updateStudent({
        ...student,
        positionPrimary: nextValues.position,
        healthIssue: nextValues.healthIssue,
        healthIssueNotes: nextValues.healthIssueNotes,
        medicationUse: nextValues.medicationUse,
        medicationNotes: nextValues.medicationNotes,
        healthObservations: nextValues.healthObservations,
      });
      await refreshRole();
      setMobileHealthIssueNotesDraft(nextValues.healthIssueNotes);
      setMobileMedicationNotesDraft(nextValues.medicationNotes);
      setMobileHealthObservationsDraft(nextValues.healthObservations);
      setMobileSportsBaseline(nextValues);
      Alert.alert("Perfil esportivo atualizado", "As informações do atleta foram salvas.");
    } catch (error) {
      Alert.alert("Não foi possível salvar", getFriendlyErrorMessage(error));
    } finally {
      setSavingMobileSports(false);
    }
  };

  if (loadingProfile) {
    return <ScreenLoadingState />;
  }

  const isStudentMobileProfile = selectedProfilePreview === "student";
  const visibleMobileCountries = (() => {
    const query = mobileCountrySearch.trim().toLocaleLowerCase("pt-BR");
    if (!query) return mobileCountryOptions.slice(0, QUICK_COUNTRY_CODES.length);
    return mobileCountryOptions.filter((country: Country) => {
      return country.name.toLocaleLowerCase("pt-BR").includes(query)
        || country.localName.toLocaleLowerCase("pt-BR").includes(query)
        || country.code.toLocaleLowerCase("pt-BR").includes(query)
        || country.dialCode.includes(query);
    }).slice(0, COUNTRY_SEARCH_RESULT_LIMIT);
  })();
  const mobileProfileCanSave = Boolean(
    mobileProfileHasChanges
      && mobileNameDraft.trim().length >= 2
      && (!student || Boolean(parseStudentBirthDate(mobileBirthDraft)))
      && (!student || mobilePhoneDraft.replace(/\D/g, "").length >= 10)
      && (!student || mobilePhoneDraft.replace(/\D/g, "").length <= 11)
      && !mobilePhoneNeedsVerification
      && !savingMobileProfile,
  );
  const discardMobileSectionChanges = (section: string) => {
    if (section === "personal") {
      setMobileNameDraft(mobileProfileBaseline.name);
      setMobileBirthDraft(mobileProfileBaseline.birth);
      setMobilePhoneDraft(mobileProfileBaseline.phone);
      setMobileCpfDraft(mobileProfileBaseline.cpf);
      setMobileRgDraft(mobileProfileBaseline.rg);
      setMobileAddressDraft(mobileProfileBaseline.address);
      setMobileGenderIdentityDraft(mobileProfileBaseline.genderIdentity);
      setMobileGuardianNameDraft(mobileProfileBaseline.guardianName);
      setMobileGuardianPhoneDraft(mobileProfileBaseline.guardianPhone);
      setMobileGuardianRelationDraft(mobileProfileBaseline.guardianRelation);
      setMobileCountryCode(mobileProfileBaseline.countryCode);
    } else if (section === "sports") {
      setMobilePositionDraft(mobileSportsBaseline.position);
      setMobileHealthIssueDraft(mobileSportsBaseline.healthIssue);
      setMobileHealthIssueNotesDraft(mobileSportsBaseline.healthIssueNotes);
      setMobileMedicationUseDraft(mobileSportsBaseline.medicationUse);
      setMobileMedicationNotesDraft(mobileSportsBaseline.medicationNotes);
      setMobileHealthObservationsDraft(mobileSportsBaseline.healthObservations);
    } else if (section === "security") {
      setSecurityContactDraft(accountSecurity.securityContactEmail);
      resetAccountEditorState();
    }
  };
  const sectionHasUnsavedChanges = (section: string | null) => (
    section === "personal" ? mobileProfileHasChanges
      : section === "sports" ? mobileSportsHasChanges
      : section === "security" ? mobileSecurityHasChanges
      : false
  );
  const toggleMobileSection = async (section: string) => {
    const currentSection = mobileExpandedSection;
    if (currentSection && currentSection !== section && sectionHasUnsavedChanges(currentSection)) {
      const shouldLeave = await confirm({
        title: "Sair sem salvar?",
        message: "Você tem alterações não salvas nesta seção.",
        confirmLabel: "Sair sem salvar",
        cancelLabel: "Continuar editando",
        tone: "danger",
        onConfirm: () => discardMobileSectionChanges(currentSection),
      });
      if (!shouldLeave) return;
    } else if (currentSection === section && sectionHasUnsavedChanges(currentSection)) {
      const shouldCollapse = await confirm({
        title: "Fechar sem salvar?",
        message: "As alterações desta seção serão descartadas.",
        confirmLabel: "Descartar alterações",
        cancelLabel: "Continuar editando",
        tone: "danger",
        onConfirm: () => discardMobileSectionChanges(currentSection),
      });
      if (!shouldCollapse) return;
    }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setMobileExpandedSection((current) => current === section ? null : section);
  };
  const leaveMobileProfile = () => {
    const navigate = () => navigateBackOrReplace({ router, fallback: scopedRoutes.home });
    if (!mobileHasUnsavedChanges) {
      navigate();
      return;
    }
    void confirm({
      title: "Sair sem salvar?",
      message: "Você tem alterações não salvas no perfil.",
      confirmLabel: "Sair sem salvar",
      cancelLabel: "Continuar editando",
      tone: "danger",
      onConfirm: navigate,
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={Platform.OS === "web" && responsiveLayout.usesWorkspaceShell
          ? ({ overflowY: "scroll" } as any)
          : undefined}
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

        {isStudentMobileProfile ? (
          <ResponsivePage variant="dashboard" gap={8} style={{ width: "100%", maxWidth: responsiveLayout.isMobile ? undefined : 760, alignSelf: "center", paddingBottom: 18 }}>
            <BackTitleHeader
              title="Configurações"
              onBack={leaveMobileProfile}
            />

            <View style={{ alignItems: "center", gap: 5, paddingTop: 0, paddingBottom: 2 }}>
              <View style={{ position: "relative" }}>
                <Pressable
                  accessibilityLabel="Visualizar foto de perfil"
                  accessibilityRole="button"
                  onPress={() => setShowPhotoViewer(true)}
                  style={{
                    width: 88,
                    height: 88,
                    borderRadius: 44,
                    backgroundColor: colors.secondaryBg,
                    borderWidth: 1,
                    borderColor: colors.border,
                    alignItems: "center",
                    justifyContent: "center",
                    ...shadow.card,
                  }}
                >
                  {photoUri ? (
                    <Image source={{ uri: photoUri }} style={{ width: 84, height: 84, borderRadius: 42 }} contentFit="cover" />
                  ) : (
                    <GoAtletaIcon name="personSolid" size={42} color={colors.primaryBg} />
                  )}
                </Pressable>
                <Pressable
                  accessibilityLabel="Alterar foto"
                  accessibilityRole="button"
                  onPress={() => setShowPhotoSheet(true)}
                  style={({ pressed }) => ({
                    position: "absolute",
                    right: -1,
                    bottom: 0,
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: pressed ? colors.secondaryBg : colors.primaryBg,
                    borderWidth: 2,
                    borderColor: colors.background,
                    alignItems: "center",
                    justifyContent: "center",
                  })}
                >
                  <GoAtletaIcon name="camera" size={18} color={colors.primaryText} />
                </Pressable>
              </View>
              <Text style={{ color: colors.text, fontSize: 20, lineHeight: 25, fontWeight: "800", textAlign: "center" }}>
                {displayName}
              </Text>
            </View>

            <View style={{ gap: 10 }}>
              <MobileProfileSection
                icon="personSolid"
                title="Dados pessoais"
                subtitle="Seus dados básicos de identificação"
                expanded={mobileExpandedSection === "personal"}
                onPress={() => toggleMobileSection("personal")}
              >
                <View style={{ gap: 7 }}>
                  <Text style={{ color: colors.muted, fontSize: 13 }}>Nome completo</Text>
                  <View style={{ minHeight: 50, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.inputBg, paddingHorizontal: 14, justifyContent: "center" }}>
                    <TextInput
                      accessibilityLabel="Nome completo"
                      autoCapitalize="words"
                      value={mobileNameDraft}
                      onChangeText={setMobileNameDraft}
                      style={{ color: colors.text, fontSize: 15, paddingVertical: 0, borderRadius: 0, ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}) }}
                    />
                  </View>
                </View>
                <View style={{ gap: 7 }}>
                  <Text style={{ color: colors.muted, fontSize: 13 }}>Data de nascimento</Text>
                  <View style={{ minHeight: 50, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.inputBg, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <NativeDateInput
                      accessibilityLabel="Data de nascimento"
                      value={Platform.OS === "web" ? (parseStudentBirthDate(mobileBirthDraft) ?? "") : mobileBirthDraft}
                      onChangeText={(value) => {
                        if (Platform.OS === "web") {
                          setMobileBirthDraft(value ? formatStudentBirthDate(value) : "");
                          return;
                        }
                        const digits = value.replace(/\D/g, "").slice(0, 8);
                        setMobileBirthDraft([digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join("/"));
                      }}
                    />
                    {Platform.OS === "web" ? null : <GoAtletaIcon name="calendar" size={18} color={colors.muted} />}
                  </View>
                </View>
                <View style={{ gap: 7 }}>
                  <Text style={{ color: colors.muted, fontSize: 13 }}>Celular</Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <View ref={mobileCountryTriggerRef} collapsable={false}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Selecionar código do país"
                        accessibilityState={{ expanded: mobileCountryMenuOpen }}
                        onPress={() => {
                          if (mobileCountryMenuOpen) {
                            setMobileCountryMenuOpen(false);
                            return;
                          }
                          mobileCountryTriggerRef.current?.measureInWindow((x, y, width, height) => {
                            setMobileCountryMenuLayout({ x, y, width, height });
                            setMobileCountryMenuOpen(true);
                          });
                        }}
                        style={({ pressed }) => ({ minHeight: 50, minWidth: 104, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: pressed ? colors.secondaryBg : colors.inputBg, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 7 })}
                      >
                        <CountryFlagIcon isoCode={mobileCountryIso} />
                        <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>{mobileCountryCode}</Text>
                        <GoAtletaIcon name="chevronDown" size={14} color={colors.muted} />
                      </Pressable>
                    </View>
                    <View style={{ minHeight: 50, flex: 1, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.inputBg, paddingLeft: 14, paddingRight: mobilePhoneNeedsVerification ? 6 : 14, flexDirection: "row", alignItems: "center" }}>
                      <TextInput
                        accessibilityLabel="Celular"
                        keyboardType="phone-pad"
                        placeholder="(00) 00000-0000"
                        placeholderTextColor={colors.muted}
                        value={mobilePhoneDraft}
                        onChangeText={(value) => {
                          const digits = value.replace(/\D/g, "").slice(0, 11);
                          setMobilePhoneDraft(digits ? formatStudentPhone(digits) : "");
                          setPendingPhoneVerification("");
                          setPhoneVerificationCode("");
                          setPhoneVerificationError(null);
                        }}
                        style={{ flex: 1, minWidth: 0, color: colors.text, fontSize: 15, paddingVertical: 0, paddingRight: 8, borderRadius: 0, ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}) }}
                      />
                      {mobilePhoneNeedsVerification && mobilePhoneDraft.replace(/\D/g, "").length >= 10 ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={phoneVerificationRequested ? "Reenviar código por SMS" : "Validar celular por SMS"}
                          onPress={() => void requestMobilePhoneVerification()}
                          disabled={requestingPhoneVerification}
                          disableWebPressScale
                          style={({ pressed }) => ({
                            minHeight: 38,
                            paddingHorizontal: 12,
                            borderRadius: 10,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: colors.primaryBg,
                            opacity: requestingPhoneVerification ? 0.55 : pressed ? 0.84 : 1,
                          })}
                        >
                          <Text style={{ color: colors.primaryText, fontSize: 12, fontWeight: "800" }}>
                            {requestingPhoneVerification
                              ? "Enviando..."
                              : phoneVerificationRequested
                                ? "Reenviar"
                                : "Validar"}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                  <AnchoredDropdown
                    visible={mobileCountryMenuOpen}
                    layout={mobileCountryMenuLayout}
                    container={null}
                    animationStyle={{ opacity: 1 }}
                    zIndex={6000}
                    maxHeight={344}
                    nestedScrollEnabled
                    density="menu"
                    fitContent
                    preferredWidth={320}
                    interactiveRefs={[mobileCountryTriggerRef]}
                    onRequestClose={() => setMobileCountryMenuOpen(false)}
                  >
                    <View style={{ paddingHorizontal: 6, paddingTop: 6, paddingBottom: 4 }}>
                      <View style={{ minHeight: 42, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.inputBg, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <GoAtletaIcon name="search" size={16} color={colors.muted} />
                        <TextInput
                          accessibilityLabel="Buscar país ou código"
                          placeholder="Buscar país ou código"
                          placeholderTextColor={colors.muted}
                          value={mobileCountrySearch}
                          onChangeText={setMobileCountrySearch}
                          style={{ flex: 1, color: colors.text, fontSize: 14, paddingVertical: 0, borderRadius: 0, ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}) }}
                        />
                      </View>
                    </View>
                    {visibleMobileCountries.map((country) => {
                      const countryName = country.localName || country.name;
                      return (
                      <AnchoredDropdownOption
                        key={`${country.code}-${country.dialCode}`}
                        active={mobileCountryIso === country.code}
                        density="compact"
                        onPress={() => {
                          setMobileCountryIso(country.code);
                          setMobileCountryCode(country.dialCode);
                          setMobileCountrySearch("");
                          setMobileCountryMenuOpen(false);
                          setPendingPhoneVerification("");
                          setPhoneVerificationCode("");
                          setPhoneVerificationError(null);
                        }}
                      >
                        <View style={{ minHeight: 34, flexDirection: "row", alignItems: "center", gap: 10 }}>
                          <CountryFlagIcon isoCode={country.code} />
                          <Text style={{ flex: 1, color: mobileCountryIso === country.code ? colors.primaryText : colors.text, fontSize: 14 }}>{countryName}</Text>
                          <Text style={{ color: mobileCountryIso === country.code ? colors.primaryText : colors.muted, fontSize: 13, fontWeight: "700" }}>{country.dialCode}</Text>
                        </View>
                      </AnchoredDropdownOption>
                      );
                    })}
                  </AnchoredDropdown>
                  {phoneVerificationRequested ? (
                    <View style={{ gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: phoneVerificationError ? colors.dangerBorder : colors.border, backgroundColor: colors.secondaryBg, overflow: "visible" }}>
                      <Text style={{ color: colors.text, fontSize: 13, fontWeight: "800" }}>Código recebido por SMS</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <View style={{ minHeight: 46, flex: 1, borderRadius: 12, borderWidth: 1, borderColor: phoneVerificationError ? colors.dangerBorder : colors.border, backgroundColor: colors.inputBg, paddingHorizontal: 14, justifyContent: "center", position: "relative", overflow: "visible" }}>
                          <FloatingFieldError message={phoneVerificationError} />
                          <TextInput
                            accessibilityLabel="Código de confirmação do celular"
                            keyboardType="number-pad"
                            autoComplete="one-time-code"
                            placeholder="000000"
                            placeholderTextColor={colors.muted}
                            maxLength={6}
                            value={phoneVerificationCode}
                            onChangeText={(value) => {
                              setPhoneVerificationCode(value.replace(/\D/g, "").slice(0, 6));
                              setPhoneVerificationError(null);
                            }}
                            onSubmitEditing={() => {
                              if (phoneVerificationCode.length === 6 && !verifyingPhone) void confirmMobilePhone();
                            }}
                            style={{ color: colors.text, fontSize: 17, fontWeight: "800", letterSpacing: 4, textAlign: "center", paddingVertical: 0, borderRadius: 0, ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}) }}
                          />
                        </View>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Confirmar código do celular"
                          onPress={() => void confirmMobilePhone()}
                          disabled={phoneVerificationCode.length !== 6 || verifyingPhone}
                          disableWebPressScale
                          style={({ pressed }) => ({
                            minHeight: 46,
                            paddingHorizontal: 14,
                            borderRadius: 12,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: colors.primaryBg,
                            opacity: phoneVerificationCode.length !== 6 || verifyingPhone ? 0.55 : pressed ? 0.84 : 1,
                          })}
                        >
                          <Text style={{ color: colors.primaryText, fontSize: 12, fontWeight: "800" }}>
                            {verifyingPhone ? "Confirmando..." : "Confirmar"}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : null}
                  <View style={{ minHeight: 28, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
                      <GoAtletaIcon
                        name={verifiedPhoneE164 && !mobilePhoneNeedsVerification ? "checkmarkCircle" : "warningCircle"}
                        size={15}
                        color={phoneVerificationError ? colors.dangerText : verifiedPhoneE164 && !mobilePhoneNeedsVerification ? colors.primaryBg : colors.muted}
                      />
                      <Text style={{ color: phoneVerificationError ? colors.dangerText : colors.muted, fontSize: 12, flex: 1 }}>
                        {phoneVerificationError
                          ? phoneVerificationError
                          : verifiedPhoneE164 && !mobilePhoneNeedsVerification
                          ? "Número verificado"
                          : mobilePhoneNeedsVerification
                            ? phoneVerificationRequested
                              ? "Código enviado; confirme para vincular o número"
                              : "Valide este número por SMS"
                            : "Nenhum número verificado"}
                      </Text>
                    </View>
                    {verifiedPhoneE164 && !mobilePhoneNeedsVerification ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Remover celular verificado"
                        onPress={() => void removeMobilePhone()}
                        disabled={removingPhone}
                        suppressWebHoverFeedback
                        disableWebPressScale
                        style={{ minHeight: 36, paddingHorizontal: 8, justifyContent: "center" }}
                      >
                        <Text style={{ color: colors.dangerText, fontSize: 12, fontWeight: "700", textDecorationLine: "underline" }}>
                          {removingPhone ? "Removendo..." : "Remover"}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: mobileMoreDataExpanded }}
                  onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setMobileMoreDataExpanded((current) => !current); }}
                  suppressWebHoverFeedback
                  disableWebPressScale
                  style={(state) => ({
                    minHeight: 50,
                    marginHorizontal: -16,
                    marginBottom: -16,
                    paddingHorizontal: 16,
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    backgroundColor:
                      state.pressed || Boolean((state as typeof state & { hovered?: boolean }).hovered)
                        ? colors.secondaryBg
                        : "transparent",
                  })}
                >
                  <View style={{ gap: 2 }}>
                    <Text style={{ color: colors.text, fontSize: 14, fontWeight: "800" }}>Mais dados</Text>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>Dados adicionais da conta</Text>
                  </View>
                  <GoAtletaIcon name={mobileMoreDataExpanded ? "chevronUp" : "chevronDown"} size={18} color={colors.text} />
                </Pressable>
                {mobileMoreDataExpanded ? (
                  <View style={{ gap: 10 }}>
                    {[
                      { label: "CPF", value: mobileCpfDraft, onChangeText: setMobileCpfDraft, placeholder: "000.000.000-00", keyboardType: "number-pad" as const },
                      { label: "RG", value: mobileRgDraft, onChangeText: setMobileRgDraft, placeholder: "Informe o RG", keyboardType: "default" as const },
                      { label: "Endereço", value: mobileAddressDraft, onChangeText: setMobileAddressDraft, placeholder: "Rua, número, bairro e cidade", keyboardType: "default" as const },
                      { label: "Gênero e identidade", value: mobileGenderIdentityDraft, onChangeText: setMobileGenderIdentityDraft, placeholder: "Como você se identifica", keyboardType: "default" as const },
                      { label: "Nome do responsável", value: mobileGuardianNameDraft, onChangeText: setMobileGuardianNameDraft, placeholder: "Nome completo", keyboardType: "default" as const },
                      { label: "Celular do responsável", value: mobileGuardianPhoneDraft, onChangeText: setMobileGuardianPhoneDraft, placeholder: "(00) 00000-0000", keyboardType: "phone-pad" as const },
                      { label: "Parentesco", value: mobileGuardianRelationDraft, onChangeText: setMobileGuardianRelationDraft, placeholder: "Ex.: mãe, pai ou responsável", keyboardType: "default" as const },
                    ].map((field) => (
                      <View key={field.label} style={{ gap: 7 }}>
                        <Text style={{ color: colors.muted, fontSize: 13 }}>{field.label}</Text>
                        <View style={{ minHeight: 50, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.inputBg, paddingHorizontal: 14, justifyContent: "center" }}>
                          <TextInput
                            accessibilityLabel={field.label}
                            keyboardType={field.keyboardType}
                            placeholder={field.placeholder}
                            placeholderTextColor={colors.muted}
                            value={field.value}
                            onChangeText={field.onChangeText}
                            style={{ color: colors.text, fontSize: 15, paddingVertical: 0, borderRadius: 0, ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}) }}
                          />
                        </View>
                      </View>
                    ))}
                  </View>
                ) : null}
                <Button
                  label={savingMobileProfile ? "Salvando..." : "Salvar alterações"}
                  onPress={() => void saveMobileStudentProfile()}
                  disabled={!mobileProfileCanSave}
                />
              </MobileProfileSection>

              <View style={{ overflow: "hidden", borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card }}>
              <MobileProfileSection
                icon="mainActivity"
                title="Perfil esportivo"
                subtitle="Posição e informações de saúde"
                expanded={mobileExpandedSection === "sports"}
                onPress={() => toggleMobileSection("sports")}
                grouped
              >
                <View style={{ gap: 8 }}>
                  <Text style={{ color: colors.muted, fontSize: 13 }}>Posição principal</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {ATHLETE_POSITION_OPTIONS.map((option) => {
                      const selected = mobilePositionDraft === option.value;
                      return (
                        <Pressable
                          key={option.value}
                          accessibilityRole="radio"
                          accessibilityState={{ selected }}
                          onPress={() => setMobilePositionDraft(option.value)}
                          suppressWebHoverFeedback
                          style={{
                            minHeight: 38,
                            borderRadius: 19,
                            borderWidth: 1,
                            borderColor: selected ? colors.primary : colors.border,
                            backgroundColor: selected ? colors.primaryBg : colors.inputBg,
                            paddingHorizontal: 14,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Text style={{ color: selected ? colors.primaryText : colors.text, fontSize: 13, fontWeight: "700" }}>{option.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
                <SettingsRow
                  icon="engagement"
                  iconBg="transparent"
                  label="Condição de saúde"
                  subtitle={mobileHealthIssueDraft ? "Sim" : "Não"}
                  onPress={() => setMobileHealthIssueDraft((value) => !value)}
                  rightContent={<ProfileToggle enabled={mobileHealthIssueDraft} />}
                />
                {mobileHealthIssueDraft ? (
                  <View style={{ gap: 7 }}>
                    <Text style={{ color: colors.muted, fontSize: 13 }}>Qual condição?</Text>
                    <View style={{ minHeight: 50, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.inputBg, paddingHorizontal: 14, justifyContent: "center" }}>
                      <TextInput accessibilityLabel="Condição de saúde" placeholder="Descreva a condição" placeholderTextColor={colors.muted} value={mobileHealthIssueNotesDraft} onChangeText={setMobileHealthIssueNotesDraft} style={{ color: colors.text, fontSize: 15, paddingVertical: 0, borderRadius: 0, ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}) }} />
                    </View>
                  </View>
                ) : null}
                <SettingsRow
                  icon="engagement"
                  iconBg="transparent"
                  label="Uso de medicamento"
                  subtitle={mobileMedicationUseDraft ? "Sim" : "Não"}
                  onPress={() => setMobileMedicationUseDraft((value) => !value)}
                  rightContent={<ProfileToggle enabled={mobileMedicationUseDraft} />}
                />
                {mobileMedicationUseDraft ? (
                  <View style={{ gap: 7 }}>
                    <Text style={{ color: colors.muted, fontSize: 13 }}>Qual medicamento?</Text>
                    <View style={{ minHeight: 50, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.inputBg, paddingHorizontal: 14, justifyContent: "center" }}>
                      <TextInput accessibilityLabel="Medicamento em uso" placeholder="Informe o medicamento" placeholderTextColor={colors.muted} value={mobileMedicationNotesDraft} onChangeText={setMobileMedicationNotesDraft} style={{ color: colors.text, fontSize: 15, paddingVertical: 0, borderRadius: 0, ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}) }} />
                    </View>
                  </View>
                ) : null}
                <View style={{ gap: 7 }}>
                  <Text style={{ color: colors.muted, fontSize: 13 }}>Observações de saúde</Text>
                  <View style={{ minHeight: 82, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.inputBg, paddingHorizontal: 14, paddingVertical: 12 }}>
                    <TextInput accessibilityLabel="Observações de saúde" multiline textAlignVertical="top" placeholder="Alergias, restrições ou cuidados importantes" placeholderTextColor={colors.muted} value={mobileHealthObservationsDraft} onChangeText={setMobileHealthObservationsDraft} style={{ minHeight: 56, color: colors.text, fontSize: 15, paddingVertical: 0, borderRadius: 0, ...(Platform.OS === "web" ? ({ outlineStyle: "none", resize: "none" } as any) : {}) }} />
                  </View>
                </View>
                <Button
                  label={savingMobileSports ? "Salvando..." : "Salvar perfil esportivo"}
                  onPress={() => void saveMobileSportsProfile()}
                  disabled={!student || !mobileSportsHasChanges || savingMobileSports}
                />
              </MobileProfileSection>

              <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 14 }} />

              <MobileProfileSection
                icon="notifications"
                title="Notificações"
                subtitle="Preferências de alertas"
                expanded={mobileExpandedSection === "notifications"}
                onPress={() => toggleMobileSection("notifications")}
                grouped
              >
                <SettingsRow
                  icon="notifications"
                  iconBg="transparent"
                  label="Notificações do app"
                  subtitle={notificationsEnabled ? "Ativadas" : "Desativadas"}
                  onPress={handleToggleNotifications}
                  rightContent={<ProfileToggle enabled={notificationsEnabled} />}
                />
              </MobileProfileSection>

              <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 14 }} />

              <MobileProfileSection
                icon="darkMode"
                title="Aparência"
                subtitle="Tema e visual do app"
                expanded={mobileExpandedSection === "appearance"}
                onPress={() => toggleMobileSection("appearance")}
                grouped
              >
                <SettingsRow icon="darkMode" iconBg="transparent" label="Modo escuro" subtitle={mode === "dark" ? "Ativado" : "Desativado"} onPress={toggleMode} rightContent={<ProfileToggle enabled={mode === "dark"} />} />
              </MobileProfileSection>

              <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 14 }} />

              <MobileProfileSection
                icon="google"
                title="Conta do Google"
                subtitle={accountSecurity.googleConnected ? `Conectada como ${accountSecurity.accountEmail}` : "Não conectada"}
                expanded={mobileExpandedSection === "google"}
                onPress={() => toggleMobileSection("google")}
                grouped
              >
                <SettingsRow icon="google" iconBg="transparent" label="Google" subtitle={accountSecurity.googleLabel} rightContent={<View />} />
                {accountSecurity.googleConnected ? (
                  <Button
                    variant="danger"
                    label={unlinkingGoogle ? "Desvinculando..." : "Desvincular Google"}
                    onPress={handleUnlinkGoogle}
                    disabled={unlinkingGoogle}
                  />
                ) : accountSecurity.socialLoginEnabled ? (
                  <Button label="Conectar Google" onPress={() => void signInWithOAuth("google", "profile")} />
                ) : null}
                <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>{accountSecurity.providerDescription}</Text>
              </MobileProfileSection>

              <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 14 }} />

              <MobileProfileSection
                icon="organization"
                title="Instituição"
                subtitle={activeOrganization?.name || "Nenhuma instituição vinculada"}
                expanded={mobileExpandedSection === "organization"}
                onPress={() => toggleMobileSection("organization")}
                grouped
              >
                <SettingsRow
                  icon="organization"
                  iconBg="transparent"
                  label="Instituição atual"
                  subtitle={activeOrganization?.name || "Nenhuma instituição vinculada"}
                  onPress={activeOrganization ? undefined : () => router.push({ pathname: "/pending", params: { returnTo: "/student/profile" } })}
                  rightContent={activeOrganization ? <View /> : <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primaryBg, alignItems: "center", justifyContent: "center" }}><GoAtletaIcon name="add" size={20} color={colors.primaryText} /></View>}
                />
                <SettingsRow icon="organization" iconBg="transparent" label="Turma" subtitle={currentClass?.name || "Nenhuma turma vinculada"} rightContent={<View />} />
                <SettingsRow icon="location" iconBg="transparent" label="Unidade" subtitle={currentClass?.unit || "Não informada"} rightContent={<View />} />
                {organizations.length > 1 ? <Text style={{ color: colors.muted, fontSize: 12 }}>{organizations.length} instituições disponíveis nesta conta.</Text> : null}
              </MobileProfileSection>

              <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 14 }} />

              <MobileProfileSection
                icon="shield"
                title="Conta e segurança"
                subtitle="Senha, acesso e exclusão de conta"
                expanded={mobileExpandedSection === "security"}
                onPress={() => {
                  if (mobileExpandedSection !== "security") {
                    setSecurityContactDraft(accountSecurity.securityContactEmail);
                    resetAccountEditorState();
                  }
                  toggleMobileSection("security");
                }}
                grouped
              >
                <View style={{ gap: 4 }}>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>E-mail da conta</Text>
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>{accountSecurity.loginLabel}</Text>
                </View>
                <AccountTextField
                  label="E-mail alternativo"
                  value={securityContactDraft}
                  onChangeText={(value) => { setSecurityContactDraft(value); setSecurityContactError(null); setSecurityContactSuccess(false); }}
                  placeholder="email@exemplo.com"
                  error={securityContactError}
                  autoComplete="email"
                />
                <Button variant="secondary" label={savingSecurityContact ? "Salvando..." : "Salvar e-mail"} onPress={() => void saveSecurityContact()} disabled={!canSaveSecurityContact} />
                <View style={{ height: 1, backgroundColor: colors.border }} />
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: "800" }}>Alterar senha</Text>
                <AccountTextField label="Nova senha" value={newPassword} onChangeText={(value) => { setNewPassword(value); setNewPasswordError(null); setPasswordChanged(false); }} placeholder="Mínimo de 8 caracteres" error={newPasswordError} secureTextEntry passwordVisible={showNewPassword} onTogglePassword={() => setShowNewPassword((current) => !current)} autoComplete="new-password" />
                <AccountTextField label="Confirmar nova senha" value={passwordConfirmation} onChangeText={(value) => { setPasswordConfirmation(value); setPasswordConfirmationError(value && newPassword && value !== newPassword ? "As senhas não conferem." : null); }} placeholder="Repita a nova senha" error={passwordConfirmationError} secureTextEntry passwordVisible={showPasswordConfirmation} onTogglePassword={() => setShowPasswordConfirmation((current) => !current)} autoComplete="new-password" returnKeyType="done" onSubmitEditing={() => { if (canChangePassword) void savePassword(); }} />
                <Button label={savingPassword ? "Alterando..." : "Alterar senha"} onPress={() => void savePassword()} disabled={!canChangePassword} />
                {securityContactSuccess ? <Text style={{ color: colors.primaryBg, fontSize: 12 }}>E-mail alternativo atualizado.</Text> : null}
                {passwordChanged ? <Text style={{ color: colors.primaryBg, fontSize: 12 }}>Senha alterada com sucesso.</Text> : null}
              </MobileProfileSection>
              </View>

              <SettingsRow
                icon="logout"
                iconBg="rgba(255, 130, 130, 0.12)"
                label="Sair"
                onPress={async () => { await signOut(); }}
                rightContent={<View />}
              />
              <View style={{ gap: 8 }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: dangerZoneExpanded }}
                  accessibilityLabel={dangerZoneExpanded ? "Recolher zona sensível" : "Mostrar zona sensível"}
                  onPress={() => setDangerZoneExpanded((current) => !current)}
                  suppressWebHoverFeedback
                  style={{ minHeight: 40, alignSelf: "flex-start", paddingHorizontal: 4, flexDirection: "row", alignItems: "center", gap: 7 }}
                >
                  <Text style={{ color: colors.dangerText, fontSize: 13, fontWeight: "700", textDecorationLine: "underline" }}>Zona sensível</Text>
                  <GoAtletaIcon name={dangerZoneExpanded ? "chevronUp" : "chevronDown"} size={15} color={colors.dangerText} />
                </Pressable>
                {dangerZoneExpanded ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Excluir conta"
                    onPress={openAccountDeletion}
                    style={({ pressed }) => ({
                      minHeight: 64,
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      borderRadius: radius.card,
                      borderWidth: 1,
                      borderColor: colors.dangerBorder,
                      backgroundColor: pressed ? colors.dangerSolidBg : colors.dangerBg,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                    })}
                  >
                    <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.dangerSolidBg, alignItems: "center", justifyContent: "center" }}>
                      <GoAtletaIcon name="trash" size={19} color={colors.dangerSolidText} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <Text style={{ color: colors.dangerText, fontSize: 14, fontWeight: "800" }}>Excluir conta</Text>
                      <Text style={{ color: colors.dangerText, fontSize: 12 }}>Apaga seus dados pessoais e encerra o acesso.</Text>
                    </View>
                    <GoAtletaIcon name="chevronForward" size={17} color={colors.dangerText} />
                  </Pressable>
                ) : null}
              </View>
            </View>
          </ResponsivePage>
        ) : (
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
        )}
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
                  padding: 5,
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
                    borderRadius: radius.internal,
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
                  padding: 5,
                  gap: 2,
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
                      borderRadius: radius.internal,
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
