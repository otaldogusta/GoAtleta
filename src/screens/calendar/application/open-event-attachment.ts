import { Linking } from "react-native";

export type OpenEventAttachmentOptions = { url: string; name: string; isCurrent: () => boolean; localFile?: { uri: string; file?: Blob } };

export async function openEventAttachment({ url, isCurrent }: OpenEventAttachmentOptions): Promise<void> {
  if (!isCurrent()) throw new Error("O contexto do evento mudou. Abra o anexo novamente.");
  await Linking.openURL(url);
}
