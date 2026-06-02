import { Fragment } from "react";

import type {
  CourtGymRelationship,
  ResistanceTrainingPlan,
  SessionEnvironment,
  WeeklyPhysicalEmphasis,
} from "../../../core/models";
import type { ThemeColors } from "../../../ui/app-theme";
import { SessionContextHeader } from "./SessionContextHeader";
import { SessionResistanceBlock } from "./SessionResistanceBlock";
import { SessionResistanceNotice } from "./SessionResistanceNotice";

type NoticeAction = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
};

type ResistancePreview = {
  sessionEnvironment: SessionEnvironment;
  weeklyContext?: {
    weeklyPhysicalEmphasis?: WeeklyPhysicalEmphasis;
    courtGymRelationship?: CourtGymRelationship;
  } | null;
  resistancePlan: ResistanceTrainingPlan;
  durationMin?: number;
};

type SessionResistanceTrainingSectionProps = {
  colors: ThemeColors;
  showUnavailableNotice: boolean;
  unavailableTitle: string;
  unavailableDescription: string;
  unavailableActions: NoticeAction[];
  resistancePreview: ResistancePreview | null;
  bridgeDescription: string;
};

export function SessionResistanceTrainingSection({
  colors,
  showUnavailableNotice,
  unavailableTitle,
  unavailableDescription,
  unavailableActions,
  resistancePreview,
  bridgeDescription,
}: SessionResistanceTrainingSectionProps) {
  return (
    <>
      {showUnavailableNotice ? (
        <SessionResistanceNotice
          colors={colors}
          tone="warning"
          title={unavailableTitle}
          description={unavailableDescription}
          actions={unavailableActions}
        />
      ) : null}
      {resistancePreview ? (
        <Fragment>
          <SessionContextHeader
            colors={colors}
            environment={resistancePreview.sessionEnvironment}
            weeklyPhysicalEmphasis={resistancePreview.weeklyContext?.weeklyPhysicalEmphasis}
            courtGymRelationship={resistancePreview.weeklyContext?.courtGymRelationship}
            transferTarget={resistancePreview.resistancePlan.transferTarget}
            durationMin={resistancePreview.durationMin}
          />
          <SessionResistanceBlock
            colors={colors}
            resistancePlan={resistancePreview.resistancePlan}
            durationMin={resistancePreview.durationMin}
          />
          {resistancePreview.sessionEnvironment === "mista" ? (
            <SessionResistanceNotice
              colors={colors}
              title="Ponte para a quadra"
              description={bridgeDescription}
            />
          ) : null}
        </Fragment>
      ) : null}
    </>
  );
}
