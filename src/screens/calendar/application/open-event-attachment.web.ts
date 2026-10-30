import { readEventAttachmentDownloadBlob } from "../../../api/event-attachment-file.web";

export type OpenEventAttachmentOptions = { url: string; name: string; isCurrent: () => boolean; localFile?: { uri: string; file?: Blob } };

/** A Blob download avoids popup blocking after the asynchronous signed-URL request. */
export async function openEventAttachment({ url, name, isCurrent, localFile }: OpenEventAttachmentOptions): Promise<void> {
  const assertCurrent = () => { if (!isCurrent()) throw new Error("O contexto do evento mudou. Abra o anexo novamente."); };
  const blob = await readEventAttachmentDownloadBlob({ url, name, localFile }, assertCurrent);
  const objectUrl = URL.createObjectURL(blob);
  let link: HTMLAnchorElement | undefined, clicked = false;
  try {
    assertCurrent();
    link = document.createElement("a");
    link.href = objectUrl;
    link.download = name;
    link.style.display = "none";
    document.body.appendChild(link);
    assertCurrent();
    link.click();
    clicked = true;
  } finally {
    link?.remove();
    if (clicked) setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    else URL.revokeObjectURL(objectUrl);
  }
}
