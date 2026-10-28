// Design tokens (spec Section 16.1). Mirrored in tailwind.config.ts.
export const tokens = {
  bg: "#F6F7F9", surface: "#FFFFFF", border: "#E6E8EC", inputBorder: "#D3D7DE",
  text: "#1C2128", text2: "#3D4450", textMuted: "#5F6773", navText: "#525A66",
  accent: "#2557D6", accentHover: "#1A3FA3", accentSoft: "#EEF2FC", focusRing: "#DDE6FB",
  danger: "#B42318", warningBg: "#FFF7E8", warningText: "#6B3A04", warningBorder: "#F3DDB3",
};
export const chipColors = {
  green: { bg: "#E4F4EA", fg: "#17663F" },
  amber: { bg: "#FDF0DA", fg: "#7A4204" },
  grey: { bg: "#EEF0F3", fg: "#3D4450" },
  red: { bg: "#FBE5E5", fg: "#9B1C1C" },
};
export type StepKind = "task" | "auto" | "email" | "decision" | "plain";
export const stepColors: Record<StepKind, {
  bg: string;
  fg: string;
  border: string;
}> = {
  task: { bg: "#EAF0FD", fg: "#1A3FA3", border: "#C9D6F5" },
  auto: { bg: "#E3F3F0", fg: "#0B5A52", border: "#BFE3DE" },
  email: { bg: "#FDF0DA", fg: "#7A4204", border: "#F3D7B4" },
  decision: { bg: "#F1EAFB", fg: "#5A2FA0", border: "#DCCDF3" },
  plain: { bg: "#EEF0F3", fg: "#3D4450", border: "#D5D9DF" },
};
// BPMN shape colours (spec Section 9.10)
export const bpmnColors = {
  task: "#2557D6", auto: "#0F766E", email: "#B45309", decision: "#6D3FC0", other: "#1C2128",
};

