import type { ImageSourcePropType } from "react-native";

import type { ActivityCatalogMediaKey } from "../../core/volleyball/activity-catalog";
import type { ActivityCatalogListItem } from "./activity-catalog-view-model";

export const ACTIVITY_CATALOG_THUMBNAILS: Record<ActivityCatalogMediaKey, ImageSourcePropType> = {
  continuity: require("../../../assets/activity-catalog/thumbnails/continuity.png"),
  defenseCoverage: require("../../../assets/activity-catalog/thumbnails/defense-coverage.png"),
  attackTransition: require("../../../assets/activity-catalog/thumbnails/attack-transition.png"),
  sideout: require("../../../assets/activity-catalog/thumbnails/sideout.png"),
  serveReception: require("../../../assets/activity-catalog/thumbnails/serve-reception.png"),
  preventiveStrength: require("../../../assets/activity-catalog/thumbnails/preventive-strength.png"),
  transition: require("../../../assets/activity-catalog/thumbnails/transition.png"),
  blockCoverage: require("../../../assets/activity-catalog/thumbnails/block-coverage.png"),
  servePressure: require("../../../assets/activity-catalog/thumbnails/serve-pressure.png"),
  secondContact: require("../../../assets/activity-catalog/thumbnails/second-contact.png"),
  attackCoverage: require("../../../assets/activity-catalog/thumbnails/attack-coverage.png"),
  outOfSystem: require("../../../assets/activity-catalog/thumbnails/out-of-system.png"),
  genericCourt: require("../../../assets/activity-catalog/thumbnails/generic-court.png"),
};

export const resolveActivityCatalogThumbnail = (
  mediaKey?: ActivityCatalogMediaKey
): ImageSourcePropType =>
  mediaKey && ACTIVITY_CATALOG_THUMBNAILS[mediaKey]
    ? ACTIVITY_CATALOG_THUMBNAILS[mediaKey]
    : ACTIVITY_CATALOG_THUMBNAILS.genericCourt;

export const getCatalogActivityThumbnailKey = (
  item: ActivityCatalogListItem
): ActivityCatalogMediaKey =>
  item.variant.visualProfile?.mediaKey ??
  item.family.visualProfile?.mediaKey ??
  "genericCourt";

export const getCatalogActivityThumbnailSource = (
  item: ActivityCatalogListItem
): ImageSourcePropType =>
  resolveActivityCatalogThumbnail(getCatalogActivityThumbnailKey(item));
