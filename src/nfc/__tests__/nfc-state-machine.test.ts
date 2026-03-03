import { describe, expect, it } from "@jest/globals";
import {
    emptyNfcLoopState,
    nfcStateReducer,
    shouldEmitTagRead
} from "../nfc-state-machine";

describe("nfc-state-machine", () => {
  describe("nfcStateReducer", () => {
    it("should initialize with idle state", () => {
      const state = emptyNfcLoopState();
      expect(state.status).toBe("idle");
      expect(state.totalTagsRead).toBe(0);
      expect(state.totalDuplicatesRejected).toBe(0);
    });

    it("should transition idle -> scanning on start", () => {
      const state = emptyNfcLoopState();
      const next = nfcStateReducer(state, { type: "start" });
      expect(next.status).toBe("scanning");
    });

    it("should ignore start event if already scanning", () => {
      let state = emptyNfcLoopState();
      state = nfcStateReducer(state, { type: "start" });
      expect(state.status).toBe("scanning");

      const next = nfcStateReducer(state, { type: "start" });
      expect(next.status).toBe("scanning");
      expect(next.totalTagsRead).toBe(state.totalTagsRead);
    });

    it("should transition scanning -> paused on pause", () => {
      let state = emptyNfcLoopState();
      state = nfcStateReducer(state, { type: "start" });
      expect(state.status).toBe("scanning");

      state = nfcStateReducer(state, { type: "pause" });
      expect(state.status).toBe("paused");
    });

    it("should ignore pause if not scanning", () => {
      const state = emptyNfcLoopState();
      const next = nfcStateReducer(state, { type: "pause" });
      expect(next.status).toBe("idle");
    });

    it("should transition paused -> scanning on resume", () => {
      let state = emptyNfcLoopState();
      state = nfcStateReducer(state, { type: "start" });
      state = nfcStateReducer(state, { type: "pause" });
      expect(state.status).toBe("paused");

      state = nfcStateReducer(state, { type: "resume" });
      expect(state.status).toBe("scanning");
    });

    it("should transition any -> idle on stop", () => {
      let state = emptyNfcLoopState();
      state = nfcStateReducer(state, { type: "start" });
      state = nfcStateReducer(state, { type: "pause" });

      const stopped = nfcStateReducer(state, { type: "stop" });
      expect(stopped.status).toBe("idle");
    });

    it("should accept tag_read event when scanning", () => {
      let state = emptyNfcLoopState();
      state = nfcStateReducer(state, { type: "start" });

      const next = nfcStateReducer(state, {
        type: "tag_read",
        uid: "TAG-001",
      });

      expect(next.totalTagsRead).toBe(1);
      expect(next.lastTagUid).toBe("TAG-001");
    });

    it("should reject tag_read if paused", () => {
      let state = emptyNfcLoopState();
      state = nfcStateReducer(state, { type: "start" });
      state = nfcStateReducer(state, { type: "pause" });

      const next = nfcStateReducer(state, {
        type: "tag_read",
        uid: "TAG-001",
      });

      expect(next.totalTagsRead).toBe(0);
    });

    it("should reject duplicate tag within window", () => {
      let state = emptyNfcLoopState();
      state = nfcStateReducer(state, { type: "start" });

      // First read
      state = nfcStateReducer(state, { type: "tag_read", uid: "TAG-001" });
      expect(state.totalTagsRead).toBe(1);

      // Immediate duplicate (well within 5000ms window)
      const next = nfcStateReducer(state, { type: "tag_read", uid: "TAG-001" }, { duplicateWindowMs: 5000 });
      expect(next.totalTagsRead).toBe(1); // No increment
      expect(next.totalDuplicatesRejected).toBe(1); // Counted as rejected
    });

    it("should accept same tag after window expires", () => {
      let state = emptyNfcLoopState();
      state = nfcStateReducer(state, { type: "start" });

      // First read
      state = nfcStateReducer(state, { type: "tag_read", uid: "TAG-001" });
      expect(state.totalTagsRead).toBe(1);

      // Simulate time passing: manually set last emit to 6s ago
      state = {
        ...state,
        lastTagEmitTime: Date.now() - 6000,
      };

      // Same tag, but outside window
      const next = nfcStateReducer(state, { type: "tag_read", uid: "TAG-001" }, { duplicateWindowMs: 5000 });
      expect(next.totalTagsRead).toBe(2);
      expect(next.totalDuplicatesRejected).toBe(0);
    });

    it("should accept different tag immediately (global dedup window)", () => {
      let state = emptyNfcLoopState();
      state = nfcStateReducer(state, { type: "start" });

      // First read
      state = nfcStateReducer(state, { type: "tag_read", uid: "TAG-001" });
      expect(state.totalTagsRead).toBe(1);

      // Different tag, within window, should still be rejected (global window)
      const next = nfcStateReducer(state, { type: "tag_read", uid: "TAG-002" }, { duplicateWindowMs: 5000 });
      expect(next.totalTagsRead).toBe(1); // Global window prevents all tags
      expect(next.totalDuplicatesRejected).toBe(1);
    });

    it("should accept different tag if per-UID dedup enabled", () => {
      let state = emptyNfcLoopState();
      state = nfcStateReducer(state, { type: "start" });

      // First read
      state = nfcStateReducer(state, { type: "tag_read", uid: "TAG-001" });
      expect(state.totalTagsRead).toBe(1);

      // Different tag, within window, but per-UID dedup only blocks same UID
      const next = nfcStateReducer(
        state,
        { type: "tag_read", uid: "TAG-002" },
        { duplicateWindowMs: 5000, perUidDedup: true }
      );
      expect(next.totalTagsRead).toBe(2); // Allowed because different UID
      expect(next.totalDuplicatesRejected).toBe(0);
    });

    it("should increment error counter on tag_error", () => {
      let state = emptyNfcLoopState();
      state = nfcStateReducer(state, { type: "start" });

      const next = nfcStateReducer(state, {
        type: "tag_error",
        error: new Error("NFC read failed"),
      });

      expect(next.totalErrors).toBe(1);
    });

    it("should handle loop_timeout as informational (no state change)", () => {
      let state = emptyNfcLoopState();
      state = nfcStateReducer(state, { type: "start" });

      const next = nfcStateReducer(state, { type: "loop_timeout", afterMs: 30_000 });
      expect(next.status).toBe("scanning");
      expect(next.totalErrors).toBe(0); // Timeout is not an error
    });

    it("should reset lastTagUid and lastTagEmitTime on stop", () => {
      let state = emptyNfcLoopState();
      state = nfcStateReducer(state, { type: "start" });
      state = nfcStateReducer(state, { type: "tag_read", uid: "TAG-001" });

      expect(state.lastTagUid).toBe("TAG-001");
      expect(state.lastTagEmitTime).toBeGreaterThan(0);

      state = nfcStateReducer(state, { type: "stop" });
      expect(state.lastTagUid).toBeNull();
      expect(state.lastTagEmitTime).toBe(0);
    });
  });

  describe("shouldEmitTagRead", () => {
    it("should return true if tag passes dedup check", () => {
      const state = emptyNfcLoopState();
      const next = { ...state, status: "scanning" as const };

      const result = shouldEmitTagRead(
        next,
        { type: "tag_read", uid: "TAG-001" },
        5000
      );

      expect(result).toBe(true);
    });

    it("should return false if tag is duplicate", () => {
      let state = emptyNfcLoopState();
      state = nfcStateReducer(state, { type: "start" });
      state = nfcStateReducer(state, { type: "tag_read", uid: "TAG-001" });

      const result = shouldEmitTagRead(
        state,
        { type: "tag_read", uid: "TAG-001" },
        5000
      );

      expect(result).toBe(false);
    });
  });
});
