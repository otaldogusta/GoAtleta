import * as Clipboard from "expo-clipboard";
import { useCallback, useEffect, useRef, useState } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { ActivityIndicator, Platform, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";

import {
    createStudentRelationshipInvite,
    listStudentRelationshipInvites,
    listStudentRelationships,
    revokeStudentRelationshipInvite,
    revokeStudentRelationship,
    updateStudentRelationship,
    type StudentRelationship,
    type StudentRelationshipInvite,
    type StudentRelationshipKind,
    type StudentRelationshipPermissions,
} from "../../../api/student-relationship-invite";
import type { Student } from "../../../core/models";
import { normalizeRelationshipPermissions, permissionsForRelationshipKind, relationshipKindLabel } from "../../../family/application/relationship-presets";
import { radius } from "../../../theme/tokens";
import { AnchoredDropdown } from "../../../ui/AnchoredDropdown";
import { Button } from "../../../ui/Button";
import { ModalSheet } from "../../../ui/ModalSheet";
import { Pressable } from "../../../ui/Pressable";
import { useAppTheme } from "../../../ui/app-theme";
import { useConfirmDialog } from "../../../ui/confirm-dialog";
import { GoAtletaIcon } from "../../../ui/icon-registry";
import { useSaveToast } from "../../../ui/save-toast";

type AnchorLayout = { x: number; y: number; width: number; height: number };
type PanelMode = "quick" | "drawer" | null;

type RelationshipChoice = {
    label: string;
    kind: Exclude<StudentRelationshipKind, "athlete">;
};

const RELATIONSHIP_CHOICES: RelationshipChoice[] = [
    { label: "Responsável", kind: "guardian" },
    { label: "Mãe", kind: "guardian" },
    { label: "Pai", kind: "guardian" },
    { label: "Responsável financeiro", kind: "payer" },
    { label: "Acompanhante", kind: "viewer" },
];

const PERMISSION_CHOICES: Array<{
    key: keyof StudentRelationshipPermissions;
    label: string;
}> = [
    { key: "canViewSchedule", label: "Agenda" },
    { key: "canViewAttendance", label: "Frequência" },
    { key: "canViewProgress", label: "Evolução" },
    { key: "canViewFinancial", label: "Financeiro" },
    { key: "canPay", label: "Pagar" },
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const formatDate = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });
};

const permissionsFromRelationship = (relationship: StudentRelationship): StudentRelationshipPermissions => ({
    canViewProfile: relationship.canViewProfile,
    canViewSchedule: relationship.canViewSchedule,
    canViewAttendance: relationship.canViewAttendance,
    canViewProgress: relationship.canViewProgress,
    canViewHealth: false,
    canSignConsents: false,
    canViewFinancial: relationship.canViewFinancial,
    canPay: relationship.canPay,
});

type InviteSeed = {
    email?: string;
    kind: Exclude<StudentRelationshipKind, "athlete">;
    label: string;
    permissions: StudentRelationshipPermissions;
    replaceInvite?: StudentRelationshipInvite;
};

const defaultInviteSeed = (): InviteSeed => ({
    kind: "guardian",
    label: "Responsável",
    permissions: permissionsForRelationshipKind("guardian"),
});

const QUICK_INVITE_SEED = defaultInviteSeed();

function FamilyInviteComposer({ organizationId, student, compact, seed, onCancel, onCreated }: { organizationId: string; student: Student; compact: boolean; seed: InviteSeed; onCancel?: () => void; onCreated: () => void | Promise<void> }) {
    const { colors } = useAppTheme();
    const { showSaveToast } = useSaveToast();
    const [email, setEmail] = useState(seed.email ?? "");
    const [choice, setChoice] = useState<RelationshipChoice>(() => ({
        kind: seed.kind,
        label: seed.label,
    }));
    const [permissions, setPermissions] = useState<StudentRelationshipPermissions>(seed.permissions);
    const [showChoices, setShowChoices] = useState(false);
    const [relationshipLayout, setRelationshipLayout] = useState<AnchorLayout | null>(null);
    const [showPermissions, setShowPermissions] = useState(!compact);
    const [busy, setBusy] = useState(false);
    const [inviteUrl, setInviteUrl] = useState("");
    const relationshipTriggerRef = useRef<View | null>(null);

    useEffect(() => {
        setEmail(seed.email ?? "");
        setChoice({ kind: seed.kind, label: seed.label });
        setPermissions(seed.permissions);
        setShowChoices(false);
        setRelationshipLayout(null);
        setShowPermissions(!compact);
        setBusy(false);
        setInviteUrl("");
    }, [compact, seed]);

    const selectChoice = (next: RelationshipChoice) => {
        setChoice(next);
        setPermissions(permissionsForRelationshipKind(next.kind));
        setShowChoices(false);
        setInviteUrl("");
    };

    const toggleChoices = () => {
        if (showChoices) {
            setShowChoices(false);
            return;
        }

        relationshipTriggerRef.current?.measureInWindow((x, y, width, height) => {
            setRelationshipLayout({ x, y, width, height });
            setShowChoices(true);
        });
    };

    const togglePermission = (key: keyof StudentRelationshipPermissions) => {
        setPermissions((current) => normalizeRelationshipPermissions({ ...current, [key]: !current[key] }));
    };

    const createInvite = async () => {
        const normalizedEmail = email.trim().toLowerCase();
        if (!EMAIL_PATTERN.test(normalizedEmail)) {
            showSaveToast({
                message: "Informe um e-mail válido.",
                variant: "warning",
            });
            return;
        }
        if (busy) return;
        setBusy(true);
        setInviteUrl("");
        let replaced = false;
        try {
            if (seed.replaceInvite) {
                await revokeStudentRelationshipInvite({
                    organizationId,
                    studentId: student.id,
                    inviteId: seed.replaceInvite.id,
                    reason: "replaced_by_coordination",
                });
                replaced = true;
            }
            const result = await createStudentRelationshipInvite({
                organizationId,
                studentId: student.id,
                invitedEmail: normalizedEmail,
                relationshipKind: choice.kind,
                relationshipLabel: choice.label,
                invitedVia: "link",
                permissions: normalizeRelationshipPermissions(permissions),
            });
            setInviteUrl(result.inviteUrl);
            showSaveToast({
                message: seed.replaceInvite ? "Novo convite criado." : "Convite criado.",
                variant: "success",
            });
            await onCreated();
        } catch (error) {
            showSaveToast(
                replaced
                    ? {
                          message: "O convite anterior foi cancelado. Tente criar o novo novamente.",
                          variant: "error",
                      }
                    : { error, variant: "error" },
            );
        } finally {
            setBusy(false);
        }
    };

    const copyInvite = async () => {
        if (!inviteUrl) return;
        await Clipboard.setStringAsync(inviteUrl);
        showSaveToast({ message: "Link copiado.", variant: "success" });
    };

    const shareInvite = async () => {
        if (!inviteUrl) return;
        await Share.share({
            message: `Convite Go Atleta para acessar ${student.name}: ${inviteUrl}`,
        });
    };

    return (
        <View style={[styles.composer, compact ? styles.composerCompact : null]}>
            <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: colors.textMuted }]}>E-mail</Text>
                <View style={[styles.inputFrame, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                    <TextInput
                        accessibilityLabel="E-mail do responsável"
                        autoCapitalize="none"
                        autoComplete="email"
                        keyboardType="email-address"
                        value={email}
                        onChangeText={(value) => {
                            setEmail(value);
                            setInviteUrl("");
                        }}
                        placeholder="responsavel@exemplo.com"
                        placeholderTextColor={colors.placeholder}
                        style={[styles.input, { color: colors.inputText }, Platform.OS === "web" ? ({ outlineStyle: "none" } as never) : null]}
                    />
                </View>
            </View>

            <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: colors.textMuted }]}>Relação</Text>
                <View ref={relationshipTriggerRef} collapsable={false} style={styles.relationshipTrigger}>
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Relação: ${choice.label}`}
                        accessibilityState={{ expanded: showChoices }}
                        onPress={toggleChoices}
                        style={[
                            styles.select,
                            {
                                backgroundColor: colors.inputBg,
                                borderColor: showChoices ? colors.primaryBg : colors.border,
                            },
                        ]}
                    >
                        <Text style={[styles.selectText, { color: colors.text }]}>{choice.label}</Text>
                        <GoAtletaIcon name={showChoices ? "chevronUp" : "chevronDown"} size={16} color={colors.muted} />
                    </Pressable>
                </View>
                <AnchoredDropdown
                    visible={showChoices}
                    layout={relationshipLayout}
                    container={null}
                    animationStyle={{}}
                    zIndex={21000}
                    maxHeight={230}
                    nestedScrollEnabled
                    fitContent
                    preferredWidth={relationshipLayout?.width}
                    portalToBodyOnWeb
                    interactiveRefs={[relationshipTriggerRef]}
                    density="menu"
                    showVerticalScrollIndicator={false}
                    onRequestClose={() => setShowChoices(false)}
                    panelStyle={{ backgroundColor: colors.surfaceElevated }}
                >
                    {RELATIONSHIP_CHOICES.map((option) => {
                        const selected = option.kind === choice.kind && option.label === choice.label;
                        return (
                            <Pressable key={option.label} onPress={() => selectChoice(option)} style={[styles.choice, selected ? { backgroundColor: colors.successBg } : null]}>
                                <Text style={[styles.choiceText, { color: selected ? colors.successText : colors.text }]}>{option.label}</Text>
                                {selected ? <GoAtletaIcon name="checkmark" size={15} color={colors.successText} /> : null}
                            </Pressable>
                        );
                    })}
                </AnchoredDropdown>
            </View>

            <Pressable onPress={() => setShowPermissions((current) => !current)} suppressWebHoverFeedback style={styles.moreOptions}>
                <GoAtletaIcon name="options" size={15} color={colors.muted} />
                <Text style={[styles.moreOptionsText, { color: colors.muted }]}>{showPermissions ? "Ocultar opções" : "Mais opções"}</Text>
            </Pressable>

            {showPermissions ? (
                <View style={styles.permissionList}>
                    {PERMISSION_CHOICES.map((option) => {
                        const selected = permissions[option.key];
                        return (
                            <Pressable
                                key={option.key}
                                accessibilityRole="checkbox"
                                accessibilityState={{ checked: selected }}
                                onPress={() => togglePermission(option.key)}
                                style={[
                                    styles.permission,
                                    {
                                        borderColor: selected ? colors.successBorder : colors.border,
                                        backgroundColor: selected ? colors.successBg : "transparent",
                                    },
                                ]}
                            >
                                <GoAtletaIcon name={selected ? "checkmark" : "circleOutline"} size={14} color={selected ? colors.successText : colors.muted} />
                                <Text style={[styles.permissionText, { color: colors.text }]}>{option.label}</Text>
                            </Pressable>
                        );
                    })}
                </View>
            ) : null}

            {inviteUrl ? (
                <View
                    style={[
                        styles.linkResult,
                        {
                            borderColor: colors.successBorder,
                            backgroundColor: colors.successBg,
                        },
                    ]}
                >
                    <View style={styles.linkCopy}>
                        <GoAtletaIcon name="link" size={15} color={colors.successText} />
                        <Text numberOfLines={2} selectable style={[styles.linkText, { color: colors.text }]}>
                            {inviteUrl}
                        </Text>
                    </View>
                    <View style={styles.linkActions}>
                        <Pressable onPress={() => void copyInvite()} style={styles.textAction}>
                            <GoAtletaIcon name="copy" size={15} color={colors.primaryBg} />
                            <Text style={[styles.textActionLabel, { color: colors.primaryBg }]}>Copiar</Text>
                        </Pressable>
                        <Pressable onPress={() => void shareInvite()} style={styles.textAction}>
                            <GoAtletaIcon name="share" size={15} color={colors.primaryBg} />
                            <Text style={[styles.textActionLabel, { color: colors.primaryBg }]}>Compartilhar</Text>
                        </Pressable>
                    </View>
                </View>
            ) : null}

            <View style={styles.composerActions}>
                {onCancel ? (
                    <Pressable onPress={onCancel} style={styles.cancelAction} suppressWebHoverFeedback>
                        <Text style={[styles.cancelText, { color: colors.muted }]}>Cancelar</Text>
                    </Pressable>
                ) : null}
                <View style={styles.primaryAction}>
                    <Button
                        label={inviteUrl ? "Criar outro" : "Salvar e convidar"}
                        loading={busy}
                        loadingLabel="Criando..."
                        disabled={!EMAIL_PATTERN.test(email.trim())}
                        onPress={() => {
                            if (inviteUrl) {
                                setEmail("");
                                setInviteUrl("");
                                return;
                            }
                            void createInvite();
                        }}
                    />
                </View>
            </View>
        </View>
    );
}

function RelationshipEditor({ organizationId, student, relationship, onCancel, onSaved }: { organizationId: string; student: Student; relationship: StudentRelationship; onCancel: () => void; onSaved: () => void | Promise<void> }) {
    const { colors } = useAppTheme();
    const { showSaveToast } = useSaveToast();
    const [choice, setChoice] = useState<RelationshipChoice>(() => {
        const relationshipKind = relationship.kind === "payer" || relationship.kind === "viewer" ? relationship.kind : "guardian";
        return (
            RELATIONSHIP_CHOICES.find((option) => option.kind === relationshipKind && option.label === relationship.label) ?? {
                kind: relationshipKind,
                label: relationship.label ?? relationshipKindLabel[relationshipKind],
            }
        );
    });
    const [permissions, setPermissions] = useState(() => permissionsFromRelationship(relationship));
    const [busy, setBusy] = useState(false);

    const save = async () => {
        if (busy) return;
        setBusy(true);
        try {
            await updateStudentRelationship({
                organizationId,
                studentId: student.id,
                relationshipId: relationship.id,
                relationshipKind: choice.kind,
                relationshipLabel: choice.label,
                permissions: normalizeRelationshipPermissions(permissions),
            });
            showSaveToast({ message: "Vínculo atualizado.", variant: "success" });
            await onSaved();
            onCancel();
        } catch (error) {
            showSaveToast({ error, variant: "error" });
        } finally {
            setBusy(false);
        }
    };

    return (
        <View
            style={[
                styles.editor,
                {
                    borderColor: colors.border,
                    backgroundColor: colors.backgroundSubtle,
                },
            ]}
        >
            <View style={styles.editorHeader}>
                <View style={styles.editorTitleGroup}>
                    <Text style={[styles.editorTitle, { color: colors.text }]}>Editar vínculo</Text>
                    <Text numberOfLines={1} style={[styles.editorMeta, { color: colors.muted }]}>
                        {relationship.contactEmail ?? "Conta vinculada"}
                    </Text>
                </View>
                <Pressable accessibilityLabel="Fechar edição" onPress={onCancel} style={styles.iconButton}>
                    <GoAtletaIcon name="close" size={17} color={colors.muted} />
                </Pressable>
            </View>
            <View style={styles.permissionList}>
                {RELATIONSHIP_CHOICES.map((option) => {
                    const selected = choice.kind === option.kind && choice.label === option.label;
                    return (
                        <Pressable
                            key={option.label}
                            onPress={() => {
                                if (choice.kind !== option.kind) {
                                    setPermissions(permissionsForRelationshipKind(option.kind));
                                }
                                setChoice(option);
                            }}
                            style={[
                                styles.permission,
                                {
                                    borderColor: selected ? colors.successBorder : colors.border,
                                    backgroundColor: selected ? colors.successBg : "transparent",
                                },
                            ]}
                        >
                            <Text style={[styles.permissionText, { color: colors.text }]}>{option.label}</Text>
                        </Pressable>
                    );
                })}
            </View>
            <View style={styles.permissionList}>
                {PERMISSION_CHOICES.map((option) => {
                    const selected = permissions[option.key];
                    return (
                        <Pressable
                            key={option.key}
                            onPress={() =>
                                setPermissions((current) =>
                                    normalizeRelationshipPermissions({
                                        ...current,
                                        [option.key]: !current[option.key],
                                    }),
                                )
                            }
                            style={[
                                styles.permission,
                                {
                                    borderColor: selected ? colors.successBorder : colors.border,
                                    backgroundColor: selected ? colors.successBg : "transparent",
                                },
                            ]}
                        >
                            <GoAtletaIcon name={selected ? "checkmark" : "circleOutline"} size={14} color={selected ? colors.successText : colors.muted} />
                            <Text style={[styles.permissionText, { color: colors.text }]}>{option.label}</Text>
                        </Pressable>
                    );
                })}
            </View>
            <View style={styles.editorActions}>
                <Pressable onPress={onCancel} style={styles.cancelAction} suppressWebHoverFeedback>
                    <Text style={[styles.cancelText, { color: colors.muted }]}>Cancelar</Text>
                </Pressable>
                <View style={styles.editorSave}>
                    <Button label="Salvar" loading={busy} loadingLabel="Salvando..." onPress={() => void save()} />
                </View>
            </View>
        </View>
    );
}

export function StudentFamilyAccessPanels({
    mode,
    organizationId,
    student,
    className,
    compact,
    anchorLayout,
    anchorAnimationStyle,
    onAccessChanged,
    onClose,
}: {
    mode: PanelMode;
    organizationId: string;
    student: Student | null;
    className: string;
    compact: boolean;
    anchorLayout: AnchorLayout | null;
    anchorAnimationStyle: StyleProp<ViewStyle>;
    onAccessChanged?: () => void | Promise<void>;
    onClose: () => void;
}) {
    const { colors } = useAppTheme();
    const { showSaveToast } = useSaveToast();
    const { confirm } = useConfirmDialog();
    const [relationships, setRelationships] = useState<StudentRelationship[]>([]);
    const [invites, setInvites] = useState<StudentRelationshipInvite[]>([]);
    const [loading, setLoading] = useState(false);
    const [composerSeed, setComposerSeed] = useState<InviteSeed | null>(null);
    const [editingRelationship, setEditingRelationship] = useState<StudentRelationship | null>(null);
    const [openActionsId, setOpenActionsId] = useState<string | null>(null);
    const studentId = student?.id ?? null;

    const loadAccess = useCallback(async () => {
        if (!studentId || !organizationId) return;
        setLoading(true);
        try {
            const [relationshipRows, inviteRows] = await Promise.all([listStudentRelationships(organizationId, studentId), listStudentRelationshipInvites(organizationId, studentId)]);
            setRelationships(relationshipRows.filter((item) => item.status === "active" && item.kind !== "athlete"));
            setInvites(inviteRows.filter((item) => item.status === "pending" && item.relationshipKind !== "athlete"));
        } catch (error) {
            setRelationships([]);
            setInvites([]);
            showSaveToast({ error, variant: "error" });
        } finally {
            setLoading(false);
        }
    }, [organizationId, showSaveToast, studentId]);

    useEffect(() => {
        setComposerSeed(null);
        setEditingRelationship(null);
        setOpenActionsId(null);
        setRelationships([]);
        setInvites([]);
    }, [mode, studentId]);

    useEffect(() => {
        if (mode === "drawer") void loadAccess();
    }, [loadAccess, mode]);

    const revokeRelationship = async (relationship: StudentRelationship) => {
        if (!student) return;
        await confirm({
            title: "Revogar acesso?",
            message: `A conta ${relationship.contactEmail ?? "selecionada"} deixará de acessar ${student.name}.`,
            confirmLabel: "Revogar acesso",
            cancelLabel: "Cancelar",
            tone: "danger",
            onConfirm: async () => {
                try {
                    await revokeStudentRelationship({
                        organizationId,
                        studentId: student.id,
                        relationshipId: relationship.id,
                        reason: "revoked_by_coordination",
                        clearLegacyLoginEmail: relationship.kind === "athlete",
                    });
                    showSaveToast({ message: "Acesso revogado.", variant: "success" });
                    await loadAccess();
                    await onAccessChanged?.();
                } catch (error) {
                    showSaveToast({ error, variant: "error" });
                }
            },
        });
    };

    const cancelInvite = async (invite: StudentRelationshipInvite) => {
        if (!student) return;
        await confirm({
            title: "Cancelar convite?",
            message: `O link enviado para ${invite.invitedEmail} deixará de funcionar.`,
            confirmLabel: "Cancelar convite",
            cancelLabel: "Manter",
            tone: "danger",
            onConfirm: async () => {
                try {
                    await revokeStudentRelationshipInvite({
                        organizationId,
                        studentId: student.id,
                        inviteId: invite.id,
                        reason: "revoked_by_coordination",
                    });
                    showSaveToast({ message: "Convite cancelado.", variant: "success" });
                    await loadAccess();
                    await onAccessChanged?.();
                } catch (error) {
                    showSaveToast({ error, variant: "error" });
                }
            },
        });
    };

    const quickContent = student ? (
        <View style={styles.quickCard}>
            <View style={styles.quickHeader}>
                <View style={styles.quickTitleGroup}>
                    <Text style={[styles.quickTitle, { color: colors.text }]}>Adicionar responsável</Text>
                    <Text numberOfLines={1} style={[styles.quickMeta, { color: colors.muted }]}>
                        {student.name}
                        {className ? ` · ${className}` : ""}
                    </Text>
                </View>
                <Pressable accessibilityLabel="Fechar convite" onPress={onClose} style={styles.iconButton}>
                    <GoAtletaIcon name="close" size={18} color={colors.muted} />
                </Pressable>
            </View>
            <FamilyInviteComposer
                organizationId={organizationId}
                student={student}
                compact
                seed={QUICK_INVITE_SEED}
                onCreated={async () => {
                    await onAccessChanged?.();
                    onClose();
                }}
            />
        </View>
    ) : null;

    if (!student) return null;

    return (
        <>
            {compact ? (
                <ModalSheet
                    visible={mode === "quick"}
                    onClose={onClose}
                    position="bottom"
                    backdropOpacity={0.66}
                    overlayZIndex={18000}
                    containerPadding={0}
                    cardStyle={{
                        width: "100%",
                        maxHeight: "92%",
                        borderTopLeftRadius: 24,
                        borderTopRightRadius: 24,
                        borderBottomLeftRadius: 0,
                        borderBottomRightRadius: 0,
                        borderWidth: StyleSheet.hairlineWidth,
                        borderColor: colors.border,
                        backgroundColor: colors.card,
                        padding: 18,
                    }}
                >
                    <View style={[styles.sheetHandle, { backgroundColor: colors.borderStrong }]} />
                    {quickContent}
                </ModalSheet>
            ) : (
                <AnchoredDropdown
                    visible={mode === "quick"}
                    layout={anchorLayout}
                    container={null}
                    animationStyle={anchorAnimationStyle}
                    zIndex={18000}
                    maxHeight={430}
                    preferredWidth={350}
                    density="popover"
                    fitContent
                    nestedScrollEnabled
                    showVerticalScrollIndicator={false}
                    onRequestClose={onClose}
                    panelStyle={{ backgroundColor: colors.card }}
                    scrollContentStyle={{ padding: 0 }}
                >
                    {quickContent}
                </AnchoredDropdown>
            )}

            <ModalSheet
                visible={mode === "drawer"}
                onClose={onClose}
                position={compact ? "bottom" : "right"}
                backdropOpacity={compact ? 0.7 : 0.48}
                overlayZIndex={17000}
                containerPadding={0}
                cardStyle={{
                    width: compact ? "100%" : 410,
                    maxWidth: compact ? "100%" : 410,
                    height: compact ? "92%" : "100%",
                    maxHeight: "100%",
                    borderRadius: compact ? 24 : 0,
                    borderTopLeftRadius: compact ? 24 : 0,
                    borderTopRightRadius: compact ? 24 : 0,
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: colors.border,
                    backgroundColor: colors.card,
                    padding: 0,
                    overflow: "hidden",
                    alignSelf: compact ? "stretch" : "flex-end",
                    marginBottom: 0,
                }}
            >
                {compact ? <View style={[styles.sheetHandle, { backgroundColor: colors.borderStrong }]} /> : null}
                <View style={[styles.drawerHeader, { borderBottomColor: colors.border }]}>
                    <View style={styles.drawerTitleGroup}>
                        <Text numberOfLines={1} style={[styles.drawerTitle, { color: colors.text }]}>
                            {student.name}
                        </Text>
                        <Text style={[styles.drawerMeta, { color: colors.muted }]}>{className || "Sem turma"}</Text>
                    </View>
                    <Pressable accessibilityLabel="Fechar acessos" onPress={onClose} style={styles.closeButton}>
                        <GoAtletaIcon name="close" size={20} color={colors.muted} />
                    </Pressable>
                </View>

                <ScrollView style={styles.drawerScroll} contentContainerStyle={styles.drawerContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator>
                    <View style={styles.sectionHeader}>
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Acessos familiares</Text>
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Adicionar outro responsável"
                            onPress={() => {
                                setEditingRelationship(null);
                                setComposerSeed(defaultInviteSeed());
                                setOpenActionsId(null);
                            }}
                            style={styles.addLink}
                            suppressWebHoverFeedback
                        >
                            <GoAtletaIcon name="add" size={16} color={colors.primaryBg} />
                            <Text style={[styles.addLinkText, { color: colors.primaryBg }]}>Adicionar</Text>
                        </Pressable>
                    </View>

                    {composerSeed ? (
                        <View style={[styles.drawerComposer, { borderColor: colors.border }]}>
                            <FamilyInviteComposer
                                organizationId={organizationId}
                                student={student}
                                compact={false}
                                seed={composerSeed}
                                onCancel={() => setComposerSeed(null)}
                                onCreated={async () => {
                                    await loadAccess();
                                    await onAccessChanged?.();
                                    setComposerSeed(null);
                                }}
                            />
                        </View>
                    ) : null}

                    {editingRelationship ? (
                        <RelationshipEditor
                            organizationId={organizationId}
                            student={student}
                            relationship={editingRelationship}
                            onCancel={() => setEditingRelationship(null)}
                            onSaved={async () => {
                                await loadAccess();
                                await onAccessChanged?.();
                            }}
                        />
                    ) : null}

                    {loading ? (
                        <View style={styles.loadingState}>
                            <ActivityIndicator color={colors.primaryBg} />
                            <Text style={[styles.loadingText, { color: colors.muted }]}>Carregando acessos...</Text>
                        </View>
                    ) : null}

                    {!loading && relationships.length === 0 && invites.length === 0 ? (
                        <View style={[styles.emptyState, { borderColor: colors.border }]}>
                            <GoAtletaIcon name="family" size={22} color={colors.muted} />
                            <Text style={[styles.emptyTitle, { color: colors.text }]}>Nenhum acesso criado</Text>
                            <Text style={[styles.emptyText, { color: colors.muted }]}>Convide um responsável sem sair da lista.</Text>
                        </View>
                    ) : null}

                    {relationships.map((relationship) => {
                        const actionsOpen = openActionsId === relationship.id;
                        return (
                            <View
                                key={relationship.id}
                                style={[
                                    styles.accessCard,
                                    {
                                        borderColor: colors.border,
                                        backgroundColor: colors.backgroundSubtle,
                                    },
                                ]}
                            >
                                <View style={[styles.avatar, { backgroundColor: colors.successBg }]}>
                                    <Text style={[styles.avatarText, { color: colors.successText }]}>{(relationship.contactEmail ?? "A").slice(0, 1).toUpperCase()}</Text>
                                </View>
                                <View style={styles.accessContent}>
                                    <Text numberOfLines={1} style={[styles.accessTitle, { color: colors.text }]}>
                                        {relationship.contactEmail ?? "Conta vinculada"}
                                    </Text>
                                    <Text style={[styles.accessMeta, { color: colors.muted }]}>{relationship.label ?? relationshipKindLabel[relationship.kind]}</Text>
                                    <View style={[styles.statusBadge, { backgroundColor: colors.successBg }]}>
                                        <Text style={[styles.statusText, { color: colors.successText }]}>Acesso ativo</Text>
                                    </View>
                                </View>
                                <Pressable accessibilityLabel="Ações do vínculo" accessibilityState={{ expanded: actionsOpen }} onPress={() => setOpenActionsId(actionsOpen ? null : relationship.id)} style={styles.iconButton}>
                                    <GoAtletaIcon name="ellipsisHorizontal" size={20} color={colors.muted} />
                                </Pressable>
                                {actionsOpen ? (
                                    <View
                                        style={[
                                            styles.actionMenu,
                                            {
                                                borderColor: colors.border,
                                                backgroundColor: colors.surfaceElevated,
                                            },
                                        ]}
                                    >
                                        {relationship.kind !== "athlete" ? (
                                            <Pressable
                                                onPress={() => {
                                                    setEditingRelationship(relationship);
                                                    setComposerSeed(null);
                                                    setOpenActionsId(null);
                                                }}
                                                style={styles.menuAction}
                                            >
                                                <GoAtletaIcon name="edit" size={16} color={colors.text} />
                                                <Text style={[styles.menuLabel, { color: colors.text }]}>Editar vínculo</Text>
                                            </Pressable>
                                        ) : null}
                                        <Pressable
                                            onPress={() => {
                                                const duplicateKind = relationship.kind === "athlete" ? "guardian" : relationship.kind;
                                                setComposerSeed({
                                                    kind: duplicateKind,
                                                    label: relationship.label ?? relationshipKindLabel[duplicateKind],
                                                    permissions: permissionsFromRelationship(relationship),
                                                });
                                                setEditingRelationship(null);
                                                setOpenActionsId(null);
                                            }}
                                            style={styles.menuAction}
                                        >
                                            <GoAtletaIcon name="copy" size={16} color={colors.text} />
                                            <Text style={[styles.menuLabel, { color: colors.text }]}>Duplicar acesso</Text>
                                        </Pressable>
                                        <Pressable
                                            onPress={() => {
                                                setOpenActionsId(null);
                                                void revokeRelationship(relationship);
                                            }}
                                            style={styles.menuAction}
                                        >
                                            <GoAtletaIcon name="remove" size={16} color={colors.dangerText} />
                                            <Text style={[styles.menuLabel, { color: colors.dangerText }]}>Revogar acesso</Text>
                                        </Pressable>
                                    </View>
                                ) : null}
                            </View>
                        );
                    })}

                    {invites.map((invite) => {
                        const actionsOpen = openActionsId === invite.id;
                        const replaceKind = invite.relationshipKind === "athlete" ? "guardian" : invite.relationshipKind;
                        return (
                            <View
                                key={invite.id}
                                style={[
                                    styles.accessCard,
                                    {
                                        borderColor: colors.border,
                                        backgroundColor: colors.backgroundSubtle,
                                    },
                                ]}
                            >
                                <View style={[styles.avatar, { backgroundColor: colors.infoBg }]}>
                                    <GoAtletaIcon name="message" size={17} color={colors.infoText} />
                                </View>
                                <View style={styles.accessContent}>
                                    <Text numberOfLines={1} style={[styles.accessTitle, { color: colors.text }]}>
                                        {invite.invitedEmail}
                                    </Text>
                                    <Text style={[styles.accessMeta, { color: colors.muted }]}>
                                        {invite.relationshipLabel ?? relationshipKindLabel[invite.relationshipKind]}
                                        {` · expira ${formatDate(invite.expiresAt)}`}
                                    </Text>
                                    <View style={[styles.statusBadge, { backgroundColor: colors.infoBg }]}>
                                        <Text style={[styles.statusText, { color: colors.infoText }]}>Convite enviado</Text>
                                    </View>
                                </View>
                                <Pressable accessibilityLabel="Ações do convite" accessibilityState={{ expanded: actionsOpen }} onPress={() => setOpenActionsId(actionsOpen ? null : invite.id)} style={styles.iconButton}>
                                    <GoAtletaIcon name="ellipsisHorizontal" size={20} color={colors.muted} />
                                </Pressable>
                                {actionsOpen ? (
                                    <View
                                        style={[
                                            styles.actionMenu,
                                            {
                                                borderColor: colors.border,
                                                backgroundColor: colors.surfaceElevated,
                                            },
                                        ]}
                                    >
                                        <Pressable
                                            onPress={() => {
                                                setComposerSeed({
                                                    email: invite.invitedEmail,
                                                    kind: replaceKind,
                                                    label: invite.relationshipLabel ?? relationshipKindLabel[replaceKind],
                                                    permissions: permissionsForRelationshipKind(replaceKind),
                                                    replaceInvite: invite,
                                                });
                                                setOpenActionsId(null);
                                            }}
                                            style={styles.menuAction}
                                        >
                                            <GoAtletaIcon name="edit" size={16} color={colors.text} />
                                            <Text style={[styles.menuLabel, { color: colors.text }]}>Editar convite</Text>
                                        </Pressable>
                                        <Pressable
                                            onPress={() => {
                                                setComposerSeed({
                                                    email: invite.invitedEmail,
                                                    kind: replaceKind,
                                                    label: invite.relationshipLabel ?? relationshipKindLabel[replaceKind],
                                                    permissions: permissionsForRelationshipKind(replaceKind),
                                                    replaceInvite: invite,
                                                });
                                                setOpenActionsId(null);
                                            }}
                                            style={styles.menuAction}
                                        >
                                            <GoAtletaIcon name="share" size={16} color={colors.text} />
                                            <Text style={[styles.menuLabel, { color: colors.text }]}>Gerar novo link</Text>
                                        </Pressable>
                                        <Pressable
                                            onPress={() => {
                                                setOpenActionsId(null);
                                                void cancelInvite(invite);
                                            }}
                                            style={styles.menuAction}
                                        >
                                            <GoAtletaIcon name="closeCircle" size={16} color={colors.dangerText} />
                                            <Text style={[styles.menuLabel, { color: colors.dangerText }]}>Cancelar convite</Text>
                                        </Pressable>
                                    </View>
                                ) : null}
                            </View>
                        );
                    })}

                    {invites.length > 0 ? <Text style={[styles.expiryNote, { color: colors.muted }]}>Convites pendentes expiram em 30 dias.</Text> : null}
                </ScrollView>
            </ModalSheet>
        </>
    );
}

const styles = StyleSheet.create({
    quickCard: { padding: 16, gap: 14 },
    quickHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
    quickTitleGroup: { flex: 1, minWidth: 0, gap: 3 },
    quickTitle: { fontSize: 16, fontWeight: "900" },
    quickMeta: { fontSize: 12 },
    composer: { gap: 12 },
    composerCompact: { gap: 10 },
    fieldGroup: { gap: 6 },
    label: { fontSize: 12, fontWeight: "800" },
    inputFrame: {
        minHeight: 50,
        borderRadius: 12,
        borderWidth: 1,
        paddingHorizontal: 14,
        justifyContent: "center",
    },
    input: {
        minHeight: 50,
        paddingVertical: 0,
        borderWidth: 0,
        borderRadius: 0,
        backgroundColor: "transparent",
        fontSize: 14,
    },
    select: {
        minHeight: 50,
        borderRadius: 12,
        borderWidth: 1,
        paddingHorizontal: 14,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    relationshipTrigger: { width: "100%" },
    selectText: { flex: 1, minWidth: 0, fontSize: 14, fontWeight: "700" },
    choice: {
        minHeight: 40,
        borderRadius: 9,
        paddingHorizontal: 10,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    choiceText: { flex: 1, minWidth: 0, fontSize: 12, fontWeight: "700" },
    moreOptions: {
        minHeight: 36,
        flexDirection: "row",
        alignItems: "center",
        gap: 7,
    },
    moreOptionsText: { fontSize: 12, fontWeight: "700" },
    permissionList: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
    permission: {
        minHeight: 36,
        borderRadius: radius.full,
        borderWidth: 1,
        paddingHorizontal: 10,
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
    },
    permissionText: { fontSize: 11, fontWeight: "800" },
    linkResult: { borderRadius: 12, borderWidth: 1, padding: 10, gap: 9 },
    linkCopy: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
    linkText: { flex: 1, minWidth: 0, fontSize: 11 },
    linkActions: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
    textAction: {
        minHeight: 34,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    textActionLabel: { fontSize: 12, fontWeight: "800" },
    composerActions: { flexDirection: "row", alignItems: "center", gap: 10 },
    cancelAction: {
        minHeight: 42,
        paddingHorizontal: 4,
        justifyContent: "center",
    },
    cancelText: { fontSize: 12, fontWeight: "800" },
    primaryAction: { flex: 1, minWidth: 0 },
    iconButton: {
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: "center",
        justifyContent: "center",
    },
    closeButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
    },
    sheetHandle: {
        width: 52,
        height: 5,
        borderRadius: 999,
        alignSelf: "center",
        marginTop: 10,
    },
    drawerHeader: {
        minHeight: 86,
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 12,
    },
    drawerTitleGroup: { flex: 1, minWidth: 0, gap: 4 },
    drawerTitle: { fontSize: 21, fontWeight: "900" },
    drawerMeta: { fontSize: 12 },
    drawerScroll: { flex: 1, minHeight: 0 },
    drawerContent: { padding: 20, paddingBottom: 40, gap: 12 },
    sectionHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
    sectionTitle: { flex: 1, minWidth: 0, fontSize: 15, fontWeight: "900" },
    addLink: {
        minHeight: 40,
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
    },
    addLinkText: { fontSize: 12, fontWeight: "900" },
    drawerComposer: { borderWidth: 1, borderRadius: 16, padding: 14 },
    editor: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 12 },
    editorHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
    editorTitleGroup: { flex: 1, minWidth: 0, gap: 3 },
    editorTitle: { fontSize: 14, fontWeight: "900" },
    editorMeta: { fontSize: 11 },
    editorActions: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 10,
    },
    editorSave: { minWidth: 112 },
    loadingState: {
        minHeight: 96,
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
    },
    loadingText: { fontSize: 12 },
    emptyState: {
        minHeight: 150,
        borderWidth: 1,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        gap: 6,
    },
    emptyTitle: { fontSize: 14, fontWeight: "900" },
    emptyText: { fontSize: 12, textAlign: "center" },
    accessCard: {
        minHeight: 86,
        borderWidth: 1,
        borderRadius: 14,
        padding: 12,
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 10,
        position: "relative",
    },
    avatar: {
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: "center",
        justifyContent: "center",
    },
    avatarText: { fontSize: 14, fontWeight: "900" },
    accessContent: { flex: 1, minWidth: 0, gap: 3 },
    accessTitle: { fontSize: 12, fontWeight: "900" },
    accessMeta: { fontSize: 11 },
    statusBadge: {
        alignSelf: "flex-start",
        borderRadius: 6,
        paddingHorizontal: 7,
        paddingVertical: 3,
        marginTop: 2,
    },
    statusText: { fontSize: 10, fontWeight: "800" },
    actionMenu: {
        position: "absolute",
        top: 48,
        right: 10,
        zIndex: 20,
        minWidth: 190,
        borderWidth: 1,
        borderRadius: 12,
        padding: 6,
    },
    menuAction: {
        minHeight: 42,
        borderRadius: 8,
        paddingHorizontal: 9,
        flexDirection: "row",
        alignItems: "center",
        gap: 9,
    },
    menuLabel: { fontSize: 12, fontWeight: "700" },
    expiryNote: { fontSize: 11, textAlign: "center", marginTop: 4 },
});
