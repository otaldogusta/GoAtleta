import CountryFlag from "react-native-country-flag";

type Props = {
  isoCode: string;
  size?: number;
};

export function CountryFlagIcon({ isoCode, size = 18 }: Props) {
  return <CountryFlag isoCode={isoCode} size={size} style={{ borderRadius: 3 }} />;
}
