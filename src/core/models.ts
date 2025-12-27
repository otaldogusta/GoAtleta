export type AgeBand = "8-9" | "10-12" | "13-15";
export type Goal =
  | "Fundamentos"
  | "Força Geral"
  | "Potência/Agilidade"
  | "Força+Potência";
export type Equipment = "quadra" | "funcional" | "academia" | "misto";

export type ClassGroup = {
  id: string;
  name: string;
  ageBand: AgeBand;
  daysPerWeek: number;
  goal: Goal;
  equipment: Equipment;
  level: 1 | 2 | 3;
};

export type SessionPlan = {
  block: string;
  warmup: string[];
  main: string[];
  cooldown: string[];
};

export type SessionLog = {
  classId: string;
  rpe: number;
  technique: "boa" | "ok" | "ruim";
  attendance: number;
  createdAt: string;
};
