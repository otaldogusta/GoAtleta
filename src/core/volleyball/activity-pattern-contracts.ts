import type {
  PedagogicalIntent,
  PhaseIntent,
  ProgressionDimension,
  VolleyballSkill,
  WeeklyLoadIntent,
} from "../models";
import type { SessionPlanningContext } from "../session-planning-context";
import type { ActivityFocusVariant } from "./activity-knowledge-patterns";
import type {
  ActivityPatternAgeStage,
  ActivityPatternStage,
} from "./activity-pattern-types";

export type ActivityPatternAgeProfile = {
  stage: ActivityPatternAgeStage;
  label: string;
  gameForm:
    | "mini_2x2"
    | "mini_3x3"
    | "mini_4x4"
    | "game_applied";
  organizationCue: string;
  challengeCue: string;
};

export type ActivityPatternSelectionContext = {
  primarySkill: VolleyballSkill;
  focusVariant?: ActivityFocusVariant;
  ageProfile: ActivityPatternAgeProfile;
  periodizationPhase?: SessionPlanningContext["periodizationPhase"];
  phaseIntent?: PhaseIntent;
  progressionDimension?: ProgressionDimension;
  pedagogicalIntent?: PedagogicalIntent;
  loadIntent?: WeeklyLoadIntent;
  materials: string[];
  classSize: number;
  recentActivityFamilies: string[];
  recentActivityNames?: string[];
  recentActivityPatternIds?: string[];
  upcomingEvents?: SessionPlanningContext["upcomingEvents"];
};

export type ActivityPatternActivitySpec = {
  id: string;
  stage: ActivityPatternStage;
  name: string;
  participants: string;
  organization: string;
  starter: string;
  action: string;
  rotation: string;
  simpleRule: string;
  scoring?: string;
  materials: string[];
  space: string;
  execution: string;
  coachFocus: string;
  successCriteria: string;
  adaptation: string;
  sourcePatternId?: string;
};
