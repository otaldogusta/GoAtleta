package com.goatleta.cameraprobe;

import java.io.File;
import java.io.IOException;
import java.io.RandomAccessFile;
import java.nio.file.Files;

/** JVM checks of the file source used by the native WebView bridge. */
public final class StudioOriginalFileTest {
  private static void check(boolean value, String message) {
    if (!value) throw new AssertionError(message);
  }

  private static void checkUnavailable(StudioOriginalFile.Source source, long offset, int length) throws IOException {
    try {
      StudioOriginalFile.read(source, offset, length);
      throw new AssertionError("unavailable range was read");
    } catch (IOException expected) {
      // The WebView gets chunk-error for the same failure.
    }
  }

  public static void main(String[] args) throws IOException {
    var root = Files.createTempDirectory("go-atleta-original");
    String id = "ad843d96-d751-47fa-9bc9-f092c10a7879";
    File room = StudioOriginalFile.roomDirectory(root.toFile(), "pair-a");
    try {
      File otherRoom = StudioOriginalFile.roomDirectory(root.toFile(), "pair-b");
      check(!room.equals(otherRoom), "pair capabilities are isolated");
      File pending = StudioOriginalFile.pending(room, id);
      check(StudioOriginalFile.growing(pending).bytes() == 0 && StudioOriginalFile.finalizedId(pending) == null,
          "a reserved file is not restored as finalized");
      int chunk = StudioOriginalFile.CHUNK_BYTES;
      try (var output = new RandomAccessFile(pending, "rw")) {
        output.setLength(2L * chunk + 10);
        output.write(123);
        output.seek(chunk);
        output.write(45);
        var growing = StudioOriginalFile.growing(pending);
        check(!growing.finalized() && growing.bytes() == 2L * chunk, "provisional frontier is aligned");
        check(StudioOriginalFile.read(growing, chunk, chunk)[0] == 45, "positional read uses the chunk offset");
        checkUnavailable(growing, 2L * chunk, 10);
        output.setLength(chunk + 5L);
        output.seek(0);
        output.write(76);
      }
      var finished = StudioOriginalFile.finish(pending);
      check(finished.finalized() && finished.bytes() == chunk + 5L && !pending.exists(),
          "finalization commits the exact, possibly shorter, file without copying");
      check(id.equals(StudioOriginalFile.finalizedId(finished.file())) && !otherRoom.exists(),
          "only the paired directory can restore the final file");
      byte[] prefix = StudioOriginalFile.read(finished, 0, chunk);
      check(prefix[0] == 76 && StudioOriginalFile.read(finished, chunk, 5).length == 5,
          "the final read exposes rewritten header and final short chunk");
      check(StudioOriginalFile.sha256(new byte[] {97, 98, 99})
          .equals("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"), "wire digest is SHA-256 lowercase hex");
      checkUnavailable(finished, Long.MAX_VALUE, 5);
      try (var output = new RandomAccessFile(finished.file(), "rw")) { output.setLength(chunk); }
      checkUnavailable(finished, 0, chunk);
    } finally {
      Files.deleteIfExists(room.toPath().resolve(id + ".mp4.part"));
      Files.deleteIfExists(room.toPath().resolve(id + ".mp4"));
      Files.deleteIfExists(room.toPath());
      Files.deleteIfExists(root.resolve(StudioOriginalFile.DIRECTORY));
      Files.delete(root);
    }
    System.out.println("StudioOriginalFile checks passed");
  }
}
