import zod from "zod";

export default zod.object({
  category: zod.enum([
    "🔷 Core Grammar & Verb Use",
    "🟨 Vocabulary & Word Use",
    "🟩 Conversation & Usage",
    "🟫 Pronunciation & Listening",
    "🟪 Cultural / Regional Variation",
  ]),
  explanation: zod
    .string()
    .describe(
      "A clear explanation of the tip in a markdown format. Write the explanation itself in English, including all headings, labels and commentary. Keep the Spanish words, phrases and example sentences being taught in Spanish, and follow each one with a short English translation or gloss.",
    ),
  level: zod.enum([
    "🟢 A1: Beginner",
    "🟡 A2:Elementary",
    "🔵 B1: Intermediate",
    "🟣 B2: Upper Intermediate",
    "🔴 C1: Advanced",
    "⚫ C2: Proficient",
  ]),
  practicePrompt: zod
    .string()
    .describe(
      "Give a homework prompt for the user so that they can practice the tip. You can use markdown formatting for emphasis. Write the instructions in English — the user will answer in Spanish — and keep only the Spanish material they must work with (words to use, sentences to translate) in Spanish. Before you finish, solve every exercise item yourself and confirm it has at least one answer that is grammatically correct and natural in Spanish, with the target word in a position the language actually allows. Watch for sentences that already carry their own negation or that force a word into a slot where a different expression is required. Rewrite or drop any item that has no valid answer rather than leaving it in.",
    ),
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
  title: zod
    .string()
    .describe(
      'A concise title for the tip, ideally 5-10 words, written in English apart from the Spanish word or phrase the tip is about, e.g. "Tal vez vs. Quizá(s): nuance and mood".',
    ),
  tldr: zod
    .string()
    .describe(
      "A brief summary of the explanation in 1-2 sentences for a general response to the prompt, written in English apart from the Spanish terms being discussed.",
    ),
  uses: zod
    .string()
    .describe(
      "Put the tip into practice by providing 2-3 spanish sentences or phrases that show the tip in use in a markdown format. The example sentences themselves must stay in Spanish; add a short English translation or note in parentheses after each one.",
    ),
});
