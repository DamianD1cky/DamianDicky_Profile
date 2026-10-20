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
  aboutTraits: [
    "Developer",
    "AI tinkerer",
    "Notes on LLMs & agents",
    "Interactive web experiments",
    "Based in Shanghai",
  ],
  aboutStatement:
    "Turning long-held ideas into useful software with language models, careful systems thinking, and expressive interfaces.",
  focus: ["LLM applications", "Agent workflows", "Interactive web"],
  capabilities: ["Product engineering", "TypeScript", "WebGL", "AI tooling", "Technical writing"],
  process: [
    {
      code: "P1.",
      title: "Explore",
      body: "Start from the real problem, inspect the evidence, and make uncertainty explicit before choosing a direction.",
    },
    {
      code: "P2.",
      title: "Model",
      body: "Clarify ownership, state, constraints, and the smallest coherent system that can support the goal.",
    },
    {
      code: "P3.",
      title: "Build",
      body: "Implement the complete path, verify it in the real interface, then remove anything that does not earn its cost.",
    },
  ],
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
