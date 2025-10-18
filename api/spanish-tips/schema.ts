import zod from "zod";

export default zod.object({
  category: zod.enum([
    "🔷 Core Grammar & Verb Use",
    "🟨 Vocabulary & Word Use",
    "🟩 Conversation & Usage",
    "🟫 Pronunciation & Listening",
    "🟪 Cultural / Regional Variation",
  ]),
  explanation: zod.string({
    description: "A clear explanation of the tip in a markdown format.",
  }),
  level: zod.enum([
    "🟢 A1: Beginner",
    "🟡 A2:Elementary",
    "🔵 B1: Intermediate",
    "🟣 B2: Upper Intermediate",
    "🔴 C1: Advanced",
    "⚫ C2: Proficient",
  ]),
  practicePrompt: zod.string({
    description:
      "Give a homework prompt for the user so that they can practice the tip. You can use markdown formatting for emphasis.",
  }),
  subcategory: zod.enum([
    "Verb Conjugation",
    "Verb Usage / Meaning Differences",
    "Tense & Mood",
    "Grammar Structures",
    "Vocabulary",
    "Common Mistakes / False Friends",
    "Synonyms & Word Nuances",
    "Phrase Patterns / Sentence Starters",
    "Questions & Interrogatives",
    "Idiomatic Expressions",
    "Formality & Register",
    "Pronunciation",
    "Listening Tips",
    "Regional Usage",
    "Cultural Notes",
  ]),
  title: zod.string({
    description: "A concise title for the tip, ideally 5-10 words.",
  }),
  uses: zod.string({
    description:
      "Put the tip into practice by providing 2-3 spanish sentences or phrases that show the tip in use in a markdown format.",
  }),
});
