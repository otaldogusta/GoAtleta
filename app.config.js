require("dotenv").config();

const appJson = require("./app.json");

const supabaseUrl =
	process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseAnonKey =
	process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";

module.exports = {
	...appJson,
	expo: {
		...appJson.expo,
		extra: {
			...(appJson.expo?.extra ?? {}),
			SUPABASE_URL: supabaseUrl,
			SUPABASE_ANON_KEY: supabaseAnonKey,
		},
	},
};
