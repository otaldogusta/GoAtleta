import { useEffect, useState } from "react";

type Props = {
  isoCode: string;
  size?: number;
};

type FlagComponent = (props: {
  "aria-hidden"?: boolean;
  style?: React.CSSProperties;
}) => React.JSX.Element;

type FlagModule = Record<string, FlagComponent>;
let flagsModule: Promise<FlagModule> | null = null;
const loadFlags = () => {
  if (!flagsModule) {
    flagsModule = import("country-flag-icons/react/3x2")
      .then(module => module as unknown as FlagModule)
      .catch(error => { flagsModule = null; throw error; });
  }
  return flagsModule;
};

export function CountryFlagIcon({ isoCode, size = 18 }: Props) {
  const [countryFlags, setCountryFlags] = useState<FlagModule | null>(null);
  useEffect(() => {
    let active = true;
    void loadFlags().then(module => { if (active) setCountryFlags(module); }).catch(() => {
      // Flags are decorative; a failed chunk must leave country/DDI fields usable.
    });
    return () => { active = false; };
  }, []);
  const style = {
    width: Math.round(size * 1.5),
    height: size,
    display: "block",
    borderRadius: 3,
    objectFit: "cover",
    flexShrink: 0,
  } as const;
  const Flag = countryFlags?.[isoCode.toUpperCase()];

  if (!countryFlags) return <span aria-hidden style={style} />;
  if (!Flag) return null;

  return <Flag aria-hidden style={style} />;
}
