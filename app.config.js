require("dotenv").config();

const supabaseUrl =
	process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseAnonKey =
	process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
const buildProfile = process.env.EAS_BUILD_PROFILE || "";
const useDevClient = buildProfile === "development";
const sentryDsn =
	process.env.SENTRY_DSN ||
	process.env.EXPO_PUBLIC_SENTRY_DSN ||
	"https://75f40b427f0cc0089243e3a498ab654f@o4510656157777920.ingest.us.sentry.io/4510656167608320";

const plugins = [
	"expo-router",
	[
		"expo-splash-screen",
		{
			image: "./assets/images/splash-icon.png",
			imageWidth: 200,
			resizeMode: "contain",
			backgroundColor: "#ffffff",
			dark: {
				backgroundColor: "#000000",
			},
		},
	],
	[
		"expo-image-picker",
		{
			cameraPermission: "Permitir acesso \u00e0 c\u00e2mera para tirar a foto do perfil.",
			photosPermission: "Permitir acesso \u00e0 galeria para escolher a foto do perfil.",
		},
	],
	"expo-font",
	[
		"expo-camera",
		{
			cameraPermission: "Permitir acesso \u00e0 c\u00e2mera para escanear QR Code.",
		},
	],
	"@react-native-community/datetimepicker",
	"@sentry/react-native",
	[
		"@sentry/react-native/expo",
		{
			url: "https://sentry.io/",
			project: "react-native",
			organization: "otaldogustas-company",
			dsn: sentryDsn,
		},
	],
];

if (useDevClient) {
	plugins.unshift("expo-dev-client");
}

module.exports = {
	expo: {
		name: "GoAtleta",
		slug: "goatleta",
		version: "1.0.0",
		orientation: "portrait",
		icon: "./assets/images/icon.png",
		scheme: "goatleta",
		userInterfaceStyle: "automatic",
		newArchEnabled: true,
		ios: {
			supportsTablet: true,
			bundleIdentifier: "com.otaldogusta.goatleta",
			associatedDomains: ["applinks:go-atleta.vercel.app"],
			usesNonExemptEncryption: false,
			infoPlist: {
				ITSAppUsesNonExemptEncryption: false,
			},
		},
		android: {
			adaptiveIcon: {
				backgroundColor: "#E6F4FE",
				foregroundImage: "./assets/images/android-icon-foreground.png",
				backgroundImage: "./assets/images/android-icon-background.png",
				monochromeImage: "./assets/images/android-icon-monochrome.png",
			},
			edgeToEdgeEnabled: true,
			softwareKeyboardLayoutMode: "resize",
			predictiveBackGestureEnabled: false,
			package: "com.otaldogusta.goatleta",
			intentFilters: [
				{
					action: "VIEW",
					autoVerify: true,
					data: [
						{
							scheme: "https",
							host: "go-atleta.vercel.app",
						},
					],
					category: ["BROWSABLE", "DEFAULT"],
				},
			],
		},
		web: {
			output: "static",
			favicon: "./assets/images/favicon.png",
		},
		plugins,
		updates: {
			enabled: true,
			checkAutomatically: "ON_LOAD",
			fallbackToCacheTimeout: 0,
			url: "https://u.expo.dev/ac21b1cd-e0e3-495f-ba43-e262c8185ef5",
		},
		runtimeVersion: {
			policy: "appVersion",
		},
		experiments: {
			typedRoutes: true,
			reactCompiler: true,
		},
		extra: {
			router: {},
			eas: {
				projectId: "ac21b1cd-e0e3-495f-ba43-e262c8185ef5",
			},
			SUPABASE_URL: supabaseUrl,
			SUPABASE_ANON_KEY: supabaseAnonKey,
		},
	},
};
