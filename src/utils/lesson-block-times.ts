type LessonBlockTimes = {
  warmupMinutes: number;
  mainMinutes: number;
  cooldownMinutes: number;
  totalMinutes: number;
};

const normalizeDurationMinutes = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return 60;
  return Math.round(value);
};

export const getLessonBlockTimes = (durationMinutes: number): LessonBlockTimes => {
  const totalMinutes = normalizeDurationMinutes(durationMinutes);

  if (totalMinutes <= 60) {
    return {
      warmupMinutes: 10,
      mainMinutes: 45,
      cooldownMinutes: 5,
      totalMinutes,
    };
  }

  return {
    warmupMinutes: 15,
    mainMinutes: totalMinutes - 20,
    cooldownMinutes: 5,
    totalMinutes,
  };
};
