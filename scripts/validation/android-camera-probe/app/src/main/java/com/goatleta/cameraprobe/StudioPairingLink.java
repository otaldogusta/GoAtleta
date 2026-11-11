package com.goatleta.cameraprobe;

import java.net.URI;
import java.util.regex.Pattern;

/** Validates the room capability before it can reach the local WebView. */
record StudioPairingLink(URI address, String room) {
  static final String BROWSER_URI = "goatleta-camera://estudio/parear";
  static final String BROWSER_EXTRA = "studioPair";
  static final String NATIVE_PATH = "/native-camera";
  static final int MAX_BYTES = 512;
  private static final String CAMERA_PATH = "/camera";
  private static final Pattern ROOM = Pattern.compile("[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}");
  private static final Pattern TOKEN = Pattern.compile("[0-9a-fA-F]{64}");

  static StudioPairingLink parse(String value) {
    if (value == null || value.length() > MAX_BYTES) throw invalid();
    URI link;
    try {
      link = URI.create(value);
    } catch (IllegalArgumentException ignored) {
      // URI parsing errors may contain the complete camera capability.
      throw invalid();
    }
    String host = link.getHost();
    int port = link.getPort();
    if (!"https".equals(link.getScheme()) || !privateIpv4(host) || port < 1 || port > 65535
        || !(host + ":" + port).equals(link.getRawAuthority()) || link.getRawQuery() != null
        || !(CAMERA_PATH.equals(link.getRawPath()) || NATIVE_PATH.equals(link.getRawPath()))) {
      throw invalid();
    }
    return new StudioPairingLink(link, roomFromFragment(link.getRawFragment()));
  }

  static String forBrowser(String expectedHost, String candidate) {
    StudioPairingLink link = parse(candidate);
    if (!link.address().getHost().equals(expectedHost) || !CAMERA_PATH.equals(link.address().getRawPath())) {
      throw invalid();
    }
    return candidate;
  }

  private static boolean privateIpv4(String host) {
    if (host == null) return false;
    String[] pieces = host.split("\\.", -1);
    if (pieces.length != 4) return false;
    int[] bytes = new int[4];
    for (int index = 0; index < bytes.length; index++) {
      if (!pieces[index].matches("0|[1-9][0-9]{0,2}")) return false;
      bytes[index] = Integer.parseInt(pieces[index]);
      if (bytes[index] > 255) return false;
    }
    return bytes[0] == 10 || bytes[0] == 172 && bytes[1] >= 16 && bytes[1] <= 31
        || bytes[0] == 192 && bytes[1] == 168;
  }

  private static String roomFromFragment(String fragment) {
    String room = null;
    String token = null;
    if (fragment != null && fragment.length() == 112) {
      for (String field : fragment.split("&", -1)) {
        if (field.startsWith("room=") && room == null) room = field.substring(5);
        else if (field.startsWith("token=") && token == null) token = field.substring(6);
        else throw invalid();
      }
    }
    if (room == null || token == null || !ROOM.matcher(room).matches() || !TOKEN.matcher(token).matches()) {
      throw invalid();
    }
    return room;
  }

  private static IllegalArgumentException invalid() {
    return new IllegalArgumentException("Pareamento local inválido.");
  }
}
