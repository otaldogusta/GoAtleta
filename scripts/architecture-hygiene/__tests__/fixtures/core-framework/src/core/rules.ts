import Constants from "expo-constants";
import { useMemo } from "react";

export const useRule = () => useMemo(() => Constants.expoConfig?.name ?? "fixture", []);
