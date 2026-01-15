const dotenv = require("dotenv");

dotenv.config({ path: ".env.local" });
dotenv.config();

const appJson = require("./app.json");

const base = appJson.expo ?? appJson;
const extra = base.extra ?? {};
const eas = extra.eas ?? {};
const cleanedEas = { ...eas };
delete cleanedEas.projectId;
const easProjectId = "ac21b1cd-e0e3-495f-ba43-e262c8185ef5";
const resolvedEas = { ...cleanedEas, projectId: easProjectId };

const cleanedExtra = { ...extra };
delete cleanedExtra.eas;

cleanedExtra.eas = resolvedEas;

module.exports = {
  expo: {
    ...base,
    owner: "otaldogusta",
    updates: {
      ...(base.updates ?? {}),
      url: `https://u.expo.dev/${easProjectId}`,
    },
    extra: {
      ...cleanedExtra,
      SUPABASE_URL:
        process.env.EXPO_PUBLIC_SUPABASE_URL ??
        process.env.SUPABASE_URL ??
        extra.SUPABASE_URL ??
        "",
      SUPABASE_ANON_KEY:
        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
        process.env.SUPABASE_ANON_KEY ??
        extra.SUPABASE_ANON_KEY ??
        "",
    },
  },
};
