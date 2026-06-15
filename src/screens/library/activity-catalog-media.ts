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
  | "block-coverage"
  | "serve-pressure"
  | "second-contact"
  | "attack-coverage"
  | "out-of-system"
  | "generic-court";

const thumbnailSources: Record<ActivityCatalogThumbnailKey, ImageSourcePropType> = {
  continuity: require("../../../assets/activity-catalog/thumbnails/continuity.png"),
  "defense-coverage": require("../../../assets/activity-catalog/thumbnails/defense-coverage.png"),
  "attack-transition": require("../../../assets/activity-catalog/thumbnails/attack-transition.png"),
  sideout: require("../../../assets/activity-catalog/thumbnails/sideout.png"),
  "serve-reception": require("../../../assets/activity-catalog/thumbnails/serve-reception.png"),
  "preventive-strength": require("../../../assets/activity-catalog/thumbnails/preventive-strength.png"),
  transition: require("../../../assets/activity-catalog/thumbnails/transition.png"),
  "block-coverage": require("../../../assets/activity-catalog/thumbnails/block-coverage.png"),
  "serve-pressure": require("../../../assets/activity-catalog/thumbnails/serve-pressure.png"),
  "second-contact": require("../../../assets/activity-catalog/thumbnails/second-contact.png"),
  "attack-coverage": require("../../../assets/activity-catalog/thumbnails/attack-coverage.png"),
  "out-of-system": require("../../../assets/activity-catalog/thumbnails/out-of-system.png"),
  "generic-court": require("../../../assets/activity-catalog/thumbnails/generic-court.png"),
};

export const getCatalogActivityThumbnailKey = (
  item: ActivityCatalogListItem
): ActivityCatalogThumbnailKey => {
  if (item.family.id === "continuidade_tres_contatos") return "continuity";
  if (item.family.id === "troca_continua_tarefa_dupla") return "transition";
  if (item.family.id === "defesa_cobertura_fora_sistema") return "defense-coverage";
  if (item.family.id === "ataque_transicao_zona_livre") return "attack-transition";
  if (item.family.id === "bloqueio_cobertura_rede") return "block-coverage";
  if (item.family.id === "saque_recepcao_pressao_controlada") return "serve-pressure";
  if (item.family.id === "levantamento_organizacao_segundo_contato") return "second-contact";
  if (item.family.id === "ataque_cobertura_decisao") return "attack-coverage";
  if (item.family.id === "defesa_transicao_fora_sistema") return "out-of-system";
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
