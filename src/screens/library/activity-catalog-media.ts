import type { ImageSourcePropType } from "react-native";

import type { ActivityCatalogListItem } from "./activity-catalog-view-model";

export type ActivityCatalogThumbnailKey =
  | "continuity"
  | "defense-coverage"
  | "attack-transition"
  | "sideout"
  | "serve-reception"
  | "preventive-strength"
  | "transition"
  | "generic-court";

const thumbnailSources: Record<ActivityCatalogThumbnailKey, ImageSourcePropType> = {
  continuity: require("../../../assets/activity-catalog/thumbnails/continuity.png"),
  "defense-coverage": require("../../../assets/activity-catalog/thumbnails/defense-coverage.png"),
  "attack-transition": require("../../../assets/activity-catalog/thumbnails/attack-transition.png"),
  sideout: require("../../../assets/activity-catalog/thumbnails/sideout.png"),
  "serve-reception": require("../../../assets/activity-catalog/thumbnails/serve-reception.png"),
  "preventive-strength": require("../../../assets/activity-catalog/thumbnails/preventive-strength.png"),
  transition: require("../../../assets/activity-catalog/thumbnails/transition.png"),
  "generic-court": require("../../../assets/activity-catalog/thumbnails/generic-court.png"),
};

export const getCatalogActivityThumbnailKey = (
  item: ActivityCatalogListItem
): ActivityCatalogThumbnailKey => {
  if (item.family.id === "continuidade_tres_contatos") return "continuity";
  if (item.family.id === "troca_continua_tarefa_dupla") return "transition";
  if (item.family.id === "defesa_cobertura_fora_sistema") return "defense-coverage";
  if (item.family.id === "ataque_transicao_zona_livre") return "attack-transition";
  if (item.family.id === "forca_preventiva_integrada") return "preventive-strength";
  if (item.family.id === "sideout_saque_recepcao") {
    return item.variant.taxonomy.gamePhase === "sideout" ? "sideout" : "serve-reception";
  }
  if (item.variant.taxonomy.skill === "transicao") return "transition";
  return "generic-court";
};

export const getCatalogActivityThumbnailSource = (
  item: ActivityCatalogListItem
): ImageSourcePropType =>
  thumbnailSources[getCatalogActivityThumbnailKey(item)] ??
  thumbnailSources["generic-court"];
