export interface SocialLink {
  readonly label: string;
  readonly note: string;
  readonly href: string;
}

export interface Credit {
  readonly role: string;
  readonly name: string;
}

export const site = {
  name: "DamianDicky",
  brand: "DAMIANDICKY",
  introName: ["DAMIAN", "DICKY"],
  role: "Developer · AI & interactive web",
  city: "Shanghai",
  cityCode: "sh, cn",
  phonePrefix: "+86",
  timeZone: "Asia/Shanghai",
  about:
    "Hi, I'm Damian Dicky. I've always loved bold, interaction-heavy websites, but for a long time I couldn't build the ones I imagined. AI changed that: ideas I shelved years ago are finally within reach. I write notes on LLMs and agents, and build small experiments along the way.",
  socials: [
    { label: "GitHub", note: "Code & experiments", href: "https://github.com/DamianD1cky" },
    { label: "Blog", note: "Notes on LLMs & agents", href: "https://www.damiandicky.site" },
  ] satisfies readonly SocialLink[],
  credits: [
    { role: "Design & code", name: "DamianDicky" },
    { role: "Inspired by", name: "Huy Phan (huyml.co)" },
    { role: "Fonts", name: "Fraunces, Inter Tight (SIL OFL)" },
    { role: "Images", name: "Generated placeholders" },
  ] satisfies readonly Credit[],
} as const;
