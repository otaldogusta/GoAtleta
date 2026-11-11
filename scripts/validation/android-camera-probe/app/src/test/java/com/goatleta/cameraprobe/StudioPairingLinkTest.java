package com.goatleta.cameraprobe;

/** JVM checks for the camera-only capability accepted from the Android intent. */
public final class StudioPairingLinkTest {
  private static final String HOST = "192.168.1.20";
  private static final String ROOM = "00000000-0000-4000-8000-000000000000";
  private static final String TOKEN = "a".repeat(64);
  private static final String PAIR = "https://" + HOST + ":8097/camera#room=" + ROOM + "&token=" + TOKEN;

  private static void check(boolean value, String message) {
    if (!value) throw new AssertionError(message);
  }

  private static void rejects(String expectedHost, String candidate) {
    try {
      StudioPairingLink.forBrowser(expectedHost, candidate);
      throw new AssertionError("invalid pairing accepted");
    } catch (IllegalArgumentException expected) {
      check(!expected.getMessage().contains(TOKEN), "pairing capability leaked to the error");
    }
  }

  public static void main(String[] args) {
    check(PAIR.equals(StudioPairingLink.forBrowser(HOST, PAIR)), "accept the configured LAN companion");
    String legacy = PAIR.replace("/camera", "/native-camera");
    check(ROOM.equals(StudioPairingLink.parse(legacy).room()), "retain the legacy USB pairing route");
    rejects(HOST, legacy);
    rejects("", PAIR);
    rejects("192.168.1.21", PAIR);
    rejects(HOST, PAIR.replace("https:", "http:"));
    rejects(HOST, PAIR.replace(HOST, "127.0.0.1"));
    rejects("8.8.8.8", PAIR.replace(HOST, "8.8.8.8"));
    rejects(HOST, PAIR.replace(HOST, "user@" + HOST));
    rejects(HOST, PAIR.replace(":8097", ""));
    rejects(HOST, PAIR.replace(":8097", ":65536"));
    rejects(HOST, PAIR.replace("/camera#", "/camera?q=1#"));
    rejects(HOST, PAIR.replace("/camera#", "/%63amera#"));
    rejects(HOST, PAIR.replace(TOKEN, "b".repeat(63)));
    rejects(HOST, PAIR + "&token=" + TOKEN);
    rejects(HOST, PAIR + " ");
    rejects(HOST, null);
    System.out.println("StudioPairingLink checks passed");
  }
}
