import { useEffect } from 'react';

export function useStudioInteractions({ enabled = true, modalOpen, canDeselect, onDeselect, onStep, onPlay }: {
  enabled?: boolean;
  modalOpen: boolean; canDeselect: boolean; onDeselect: () => void;
  onStep: (direction: number) => void; onPlay: () => void;
}) {
  useEffect(() => {
    if (!enabled) return;
    const key = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (modalOpen || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.code === 'Space' && target?.closest('.sv-seek input[type=range]')) {
        event.preventDefault();
        if (!event.repeat) onPlay();
        return;
      }
      if (!target?.closest('.sv-seek input[type=range]') && target?.closest('input,select,textarea,[contenteditable=true],[role=radiogroup],[role=menu],.sv-select,[data-studio-menu]')) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault(); onStep(event.key === 'ArrowLeft' ? -1 : 1);
      } else if (event.key === 'Escape' && canDeselect) {
        event.preventDefault(); onDeselect();
      } else if (event.code === 'Space' && !target?.closest('button,[role=button]')) {
        event.preventDefault(); onPlay();
      }
    };
    const outside = (event: PointerEvent) => {
      if (!modalOpen && canDeselect && !(event.target as HTMLElement | null)?.closest('.sv-contact-editor,.sv-marker,.sv-contact,.sv-floating-tip,[data-studio-menu]')) onDeselect();
    };
    // Clicks inside the cross-origin video do not bubble to the studio.
    let frame = 0;
    const blur = () => { frame = requestAnimationFrame(() => {
      if (!modalOpen && canDeselect && document.activeElement?.matches('.sv-stage iframe')) onDeselect();
    }); };
    window.addEventListener('keydown', key);
    document.addEventListener('pointerdown', outside);
    window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', key); document.removeEventListener('pointerdown', outside); window.removeEventListener('blur', blur); cancelAnimationFrame(frame); };
  }, [enabled, modalOpen, canDeselect, onDeselect, onStep, onPlay]);
}
