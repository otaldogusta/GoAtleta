import * as countryFlags from "country-flag-icons/react/3x2";

type Props = {
  isoCode: string;
  size?: number;
};

type FlagComponent = (props: {
  "aria-hidden"?: boolean;
  style?: React.CSSProperties;
}) => React.JSX.Element;

export function CountryFlagIcon({ isoCode, size = 18 }: Props) {
  const Flag = (countryFlags as Record<string, FlagComponent>)[isoCode.toUpperCase()];

  if (!Flag) return null;

  return (
    <Flag
      aria-hidden
      style={{
        width: Math.round(size * 1.5),
        height: size,
        display: "block",
        borderRadius: 3,
        objectFit: "cover",
        flexShrink: 0,
      }}
    />
  );
}
