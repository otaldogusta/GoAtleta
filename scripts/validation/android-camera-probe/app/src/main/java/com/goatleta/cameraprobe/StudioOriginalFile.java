package com.goatleta.cameraprobe;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.regex.Pattern;

/** Room-scoped seekable output. A finalized filename is the durable commit marker. */
final class StudioOriginalFile {
  static final String DIRECTORY = "studio-recordings";
  static final int CHUNK_BYTES = 256 * 1024;
  static final int HASH_BYTES = 1024 * 1024;
  static final long MAX_BYTES = 24L * 1024 * 1024 * 1024;
  private static final Pattern RECORDING_ID = Pattern.compile("[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}");

  record Source(File file, long bytes, boolean finalized) {}

  static File roomDirectory(File files, String capability) {
    return new File(new File(files, DIRECTORY), sha256(capability.getBytes(StandardCharsets.US_ASCII)));
  }

  static File pending(File directory, String id) throws IOException {
    if (!RECORDING_ID.matcher(id).matches()) throw new IOException("Identidade de gravação inválida.");
    if (!directory.mkdirs() && !directory.isDirectory()) throw new IOException("Pasta de gravações indisponível.");
    File file = new File(directory, id + ".mp4.part");
    if (!file.createNewFile()) throw new IOException("A gravação já existe.");
    return file;
  }

  static Source growing(File pending) {
    long bytes = Math.min(MAX_BYTES, pending.length());
    return new Source(pending, bytes / CHUNK_BYTES * CHUNK_BYTES, false);
  }

  static Source finish(File pending) throws IOException {
    long bytes = pending.length();
    if (bytes <= 0 || bytes > MAX_BYTES) throw new IOException("Tamanho do original fora do limite.");
    String name = pending.getName();
    File finalFile = new File(pending.getParentFile(), name.substring(0, name.length() - ".part".length()));
    if (finalFile.exists()) throw new IOException("O original finalizado já existe.");
    Files.move(pending.toPath(), finalFile.toPath(), StandardCopyOption.ATOMIC_MOVE);
    return new Source(finalFile, bytes, true);
  }

  static String finalizedId(File file) {
    String name = file.getName();
    if (!name.endsWith(".mp4") || !file.isFile()) return null;
    String id = name.substring(0, name.length() - ".mp4".length());
    return RECORDING_ID.matcher(id).matches() ? id : null;
  }

  static byte[] read(Source source, long offset, int length) throws IOException {
    if (offset < 0 || length <= 0 || length > HASH_BYTES || offset > source.bytes() - length) {
      throw new IOException("Trecho fora do original disponível.");
    }
    ByteBuffer bytes = ByteBuffer.allocate(length);
    try (var input = new FileInputStream(source.file()); var channel = input.getChannel()) {
      if (source.finalized() && channel.size() != source.bytes()) throw new IOException("O original mudou.");
      while (bytes.hasRemaining()) {
        if (channel.read(bytes, offset + bytes.position()) <= 0) throw new IOException("Trecho indisponível.");
      }
    }
    return bytes.array();
  }

  static String sha256(byte[] bytes) {
    try {
      byte[] digest = MessageDigest.getInstance("SHA-256").digest(bytes);
      char[] hex = new char[digest.length * 2];
      String digits = "0123456789abcdef";
      for (int index = 0; index < digest.length; index++) {
        int value = Byte.toUnsignedInt(digest[index]);
        hex[2 * index] = digits.charAt(value >>> 4);
        hex[2 * index + 1] = digits.charAt(value & 15);
      }
      return new String(hex);
    } catch (NoSuchAlgorithmException impossible) {
      throw new IllegalStateException(impossible);
    }
  }

  private StudioOriginalFile() {}
}
