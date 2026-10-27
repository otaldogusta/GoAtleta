import type { CourtVisualPayload } from '../../core/visual-court';
import type { CourtShareScope } from '../../api/court-sharing';

export type CourtSharingProps = { payload: CourtVisualPayload; scope: CourtShareScope; onClose: () => void };
