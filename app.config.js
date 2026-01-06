const dotenv = require("dotenv");

dotenv.config({ path: ".env.local" });
dotenv.config();

const appJson = require("./app.json");

const base = appJson.expo ?? appJson;
const extra = base.extra ?? {};

module.exports = {
  expo: {
    ...base,
    extra: {
      ...extra,
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
