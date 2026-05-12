import type { EvidenceConfidence } from "../evidence";
import type { ClassPlan } from "../models";
import type { ScoutingAction } from "../scouting-action";
import type {
  CoachIntervention,
  ScoutingImpact,
  TeamEvent,
  TeamPlanningContext,
  TeamPlanningLoadBias,
  TeamPlanningMode,
} from "../team-context";

export type GoldenScenarioExpected = {
  planningMode?: TeamPlanningMode;
  recommendedLoadBias?: TeamPlanningLoadBias;
  expectedFocusIncludes?: string[];
  expectedAvoidIncludes?: string[];
  expectedEvidenceRuleIds?: string[];
  shouldNotInclude?: string[];
  shouldPreserveManualOverride?: boolean;
  shouldAllowModerateLoad?: boolean;
  minEvidenceRules?: number;
  maxLoadBias?: TeamPlanningLoadBias;
};

export type GoldenScenario = {
  id: string;
  label: string;
  description: string;
  classContext: {
    classId: string;
    label: string;
    ageBand?: string;
    youth?: boolean;
    referenceDate: string;
    weekStartDate: string;
  };
  events?: TeamEvent[];
  interventions?: CoachIntervention[];
  scoutingActions?: ScoutingAction[];
  scoutingImpacts?: ScoutingImpact[];
  manualOverride?: boolean;
  baseWeekPlan?: Partial<ClassPlan>;
  expected: GoldenScenarioExpected;
};

export type GoldenScenarioCheck = {
  id: string;
  passed: boolean;
  message: string;
};

export type GoldenScenarioResult = {
  scenarioId: string;
  planningMode: TeamPlanningMode;
  recommendedLoadBias: TeamPlanningLoadBias;
  focus: string[];
  avoid: string[];
  evidenceRuleIds: string[];
  evidenceConfidence: EvidenceConfidence[];
  explanation: string;
  teamPlanningContext: TeamPlanningContext;
  generatedScoutingImpact: ScoutingImpact | null;
  scoutingImpacts: ScoutingImpact[];
  adaptedWeekPlan: ClassPlan;
  checks: GoldenScenarioCheck[];
  passed: boolean;
};
