import { useState } from "react";
import { Image, Platform } from "react-native";

const PROFILE_AVATAR_PATH = /^\/storage\/v1\/object\/public\/profile-photos\/[^/]+\/avatar$/;

function getJxlSource(uri: string): string | null {
  try {
    const url = new URL(uri);
    if (!["http:", "https:"].includes(url.protocol) || !PROFILE_AVATAR_PATH.test(url.pathname)) return null;
    if (url.searchParams.get("jxl") !== "1" || !url.searchParams.get("v")) return null;
    url.pathname += ".jxl";
    url.searchParams.delete("jxl");
    return url.toString();
  } catch {
    return null;
  }
}

export function ProfileAvatarPhoto({ uri, size }: { uri: string; size: number }) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const jxlSource = Platform.OS === "web" ? getJxlSource(uri) : null;
  const style = { width: size, height: size, borderRadius: size / 2 };

  if (!jxlSource) return <Image source={{ uri }} style={style} />;

  return (
    <picture style={{ display: "block", width: size, height: size }}>
      {failedSource !== jxlSource ? <source srcSet={jxlSource} type="image/jxl" /> : null}
      <img alt="" src={uri} style={{ ...style, display: "block", objectFit: "cover" }} onError={() => setFailedSource(jxlSource)} />
    </picture>
  );
}
