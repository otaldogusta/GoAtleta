/** Same linear-light tint as the perspective renderer; authored colors stay untouched. */
export function courtHoverColor(color: string): string {
  const match = /^#([\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.exec(color);
  if (!match) return color;
  const hex = match[1].length < 5 ? [...match[1]].map(value => value + value).join("") : match[1];
  const linear = (value: number) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
  const channels = [0, 2, 4].map(offset => linear(parseInt(hex.slice(offset, offset + 2), 16) / 255));
  const light = Math.min(...channels) > .7, strength = light ? .48 : .22;
  const tint = light ? [114, 182, 239] : [185, 224, 255];
  return "#" + channels.map((value, index) => {
    const mixed = value + (linear(tint[index] / 255) - value) * strength;
    const srgb = mixed <= .0031308 ? mixed * 12.92 : 1.055 * mixed ** (1 / 2.4) - .055;
    return Math.round(srgb * 255).toString(16).padStart(2, "0");
  }).join("") + hex.slice(6);
}
