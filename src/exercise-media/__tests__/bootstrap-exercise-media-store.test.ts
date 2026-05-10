jest.mock("../../api/config", () => ({
  isSupabaseConfigured: false,
}));

jest.mock("../../auth/session", () => ({
  getValidAccessToken: jest.fn(),
}));

jest.mock("../stores/supabase-exercise-media-store", () => {
  return {
    SupabaseExerciseMediaStore: jest.fn().mockImplementation(() => ({
      kind: "supabase",
      list: jest.fn(() => []),
      getById: jest.fn(() => null),
      upsert: jest.fn((asset) => asset),
      update: jest.fn(() => null),
      reset: jest.fn(),
      hydrate: jest.fn(async () => undefined),
      persistUpsert: jest.fn(async (asset) => asset),
      persistUpdate: jest.fn(async () => null),
    })),
  };
});

import { getValidAccessToken } from "../../auth/session";
import {
  bootstrapExerciseMediaStore,
  isSupabaseExerciseMediaStoreActive,
  resetExerciseMediaStoreBootstrapForTests,
} from "../bootstrap-exercise-media-store";
import { bootstrapDevExerciseMedia } from "../bootstrap-dev-exercise-media";
import {
  createInMemoryExerciseMediaStore,
  getExerciseMediaStoreKind,
  setExerciseMediaStore,
} from "../exercise-media-store";
import { listExerciseMediaAssets, resetExerciseMediaRegistry } from "../exercise-media-registry";

const mockedGetValidAccessToken = getValidAccessToken as jest.MockedFunction<
  typeof getValidAccessToken
>;

describe("bootstrapExerciseMediaStore", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetExerciseMediaStoreBootstrapForTests();
    setExerciseMediaStore(createInMemoryExerciseMediaStore());
    resetExerciseMediaRegistry();
  });

  it("falls back to memory when Supabase is not configured", async () => {
    Object.defineProperty(require("../../api/config"), "isSupabaseConfigured", {
      value: false,
      configurable: true,
    });
    const result = await bootstrapExerciseMediaStore();

    expect(result).toBe("memory");
    expect(getExerciseMediaStoreKind()).toBe("memory");
  });

  it("falls back to memory when auth token is missing", async () => {
    mockedGetValidAccessToken.mockResolvedValueOnce("");
    Object.defineProperty(require("../../api/config"), "isSupabaseConfigured", {
      value: true,
      configurable: true,
    });

    resetExerciseMediaStoreBootstrapForTests();
    const result = await bootstrapExerciseMediaStore();

    expect(result).toBe("memory");
    expect(getExerciseMediaStoreKind()).toBe("memory");
  });

  it("uses Supabase store when configured and authenticated", async () => {
    mockedGetValidAccessToken.mockResolvedValueOnce("token");
    Object.defineProperty(require("../../api/config"), "isSupabaseConfigured", {
      value: true,
      configurable: true,
    });

    resetExerciseMediaStoreBootstrapForTests();
    const result = await bootstrapExerciseMediaStore();

    expect(result).toBe("supabase");
    expect(isSupabaseExerciseMediaStoreActive()).toBe(true);
  });

  it("does not register fake dev assets when Supabase store is active", async () => {
    mockedGetValidAccessToken.mockResolvedValueOnce("token");
    Object.defineProperty(require("../../api/config"), "isSupabaseConfigured", {
      value: true,
      configurable: true,
    });

    resetExerciseMediaStoreBootstrapForTests();
    await bootstrapExerciseMediaStore();
    bootstrapDevExerciseMedia({ enabled: true });

    expect(listExerciseMediaAssets()).toEqual([]);
  });

  it("does not break when bootstrap fails", async () => {
    Object.defineProperty(require("../../api/config"), "isSupabaseConfigured", {
      value: true,
      configurable: true,
    });
    mockedGetValidAccessToken.mockRejectedValueOnce(new Error("auth failed"));

    resetExerciseMediaStoreBootstrapForTests();
    const logger = { warn: jest.fn() };
    const result = await bootstrapExerciseMediaStore({ logger });

    expect(result).toBe("memory");
    expect(getExerciseMediaStoreKind()).toBe("memory");
    expect(logger.warn).toHaveBeenCalled();
  });
});
