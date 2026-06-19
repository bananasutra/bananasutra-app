export const MANIFESTO_META = {
  title: 'AI Art Fair Use Manifesto',
  description:
    "A framework for using AI without losing your soul, or someone else's work. Liberty, Equality, Fraternity. Human authorship, AI as instrument.",
  publishedAt: '2024-05-01',
} as const

export type ManifestoPrinciple = {
  readonly title: string
  readonly body: string
}

export type ManifestoPillar = {
  readonly name: string
  readonly sub: string
  readonly principles: readonly ManifestoPrinciple[]
}

export const MANIFESTO_FRAMEWORK_LEDE = 'Three principles. Nine commitments. One position.'

export const MANIFESTO_FRAMEWORK: readonly ManifestoPillar[] = [
  {
    name: 'LIBERTY',
    sub: 'EVOLUTION',
    principles: [
      {
        title: 'Creative Autonomy',
        body:
          "The tool serves the artist. The moment it starts the other way around, we have a problem, not a technical one, a philosophical one. AI should expand what's possible, not define what's permissible. No digital Bastilles. The door swings out, not in.",
      },
      {
        title: 'Consent & Control',
        body:
          "Your work is yours. If a system uses it to train, remix, or generate, it doesn't get to do that quietly. Consent isn't a bureaucratic formality. It's the minimum acknowledgment that a human made something, and that something matters. Artists should control how their work enters the machine, if it enters at all.",
      },
      {
        title: 'Access & Opportunity',
        body:
          'AI could genuinely democratize creativity: lower the floor, widen the door, give voice to people who never had a recording studio or a gallery. That potential is real. So is the risk that it only democratizes access for people who already have it. Watch that gap. Close it where you can.',
      },
    ],
  },
  {
    name: 'EQUALITY',
    sub: 'RECOGNITION',
    principles: [
      {
        title: 'Attribution',
        body:
          'Say who made the thing. Say what tools touched it. "Human-authored, AI-assisted" is not an admission of weakness. It\'s a description of a process, the same way "co-written" or "produced by" is. Transparency isn\'t shame. All artists are created equal. Their names deserve equal visibility.',
      },
      {
        title: 'Compensation',
        body:
          "Someone's work went into the machine. That work has value. The economic models don't fully exist yet for most of this, but that's not an excuse for not building them. It's an argument for urgency. Artists deserve fair compensation for their work's use in training, generation, and derivative creation. Sacrebleu.",
      },
      {
        title: 'Transparency',
        body:
          "If AI touched it, say so. Not buried in fine print. Legibly, at the point of encounter. The audience deserves to know what they're experiencing. It doesn't mean AI-made is lesser. It means honesty is a baseline, not a bonus. No ancien régime of hidden algorithms.",
      },
    ],
  },
  {
    name: 'FRATERNITY',
    sub: 'COLLABORATION',
    principles: [
      {
        title: 'Ethical Use',
        body:
          "Don't use AI to dehumanize, exploit, or erase. This applies to the obvious cases (deepfakes, plagiarism at scale) and to the subtle ones: replacing a session musician because the algorithm is cheaper, or generating work that mimics a living artist's style without acknowledgment. Solidarity in every pixel. Fraternité.",
      },
      {
        title: 'Community Engagement',
        body:
          "The people most affected by AI in art should be in the room where decisions get made, not as focus groups, as co-architects. The artistic community is not a market to be captured. It's a conversation to join. And conversations require listening.",
      },
      {
        title: 'Cultural Sensitivity',
        body:
          "AI trained on the internet inherits the internet's biases. Art produced without awareness of cultural context risks misrepresenting, flattening, or appropriating. Respect is not optional decoration. It is the tricolor flag of the whole enterprise. Know what you're borrowing from. Know who made it.",
      },
    ],
  },
]

export const MANIFESTO_PULL_QUOTE = {
  text:
    'In this era of technological revolution, the integration of artificial intelligence into authentic ideation for art presents both remarkable opportunities and significant challenges. Guided by the principles of liberty, equality, and fraternity, this manifesto aims to establish fair use practices for AI in art, ensuring that innovation enhances the integrity and value of human creativity.',
  em: 'Vive la révolution artistique.',
} as const

export type ManifestoDialogueBlock =
  | { readonly type: 'scene'; readonly text: string }
  | { readonly type: 'line'; readonly speaker: string; readonly text: string }
  | { readonly type: 'stage'; readonly text: string }

export const MANIFESTO_DIALOGUE: readonly ManifestoDialogueBlock[] = [
  {
    type: 'scene',
    text:
      'Saint-Germain-des-Prés, some evening that feels like 1955. Camus is already here: Pernod, cigarette, the resigned posture of someone who has made peace with impermanence but not with boredom. Bertrand Russell arrives in English tweed, conspicuously overdressed for the arrondissement. Then Socrates appears, no one sees him arrive exactly, in a chiton, blinking at the electric light, immediately enchanted by the wine.',
  },
  { type: 'line', speaker: 'Camus', text: "You're both staring at that machine as if it declared war." },
  {
    type: 'line',
    speaker: 'Russell',
    text: "It's playing music it didn't compose, written by people it doesn't know, for an audience it can't see. I find that philosophically interesting and commercially suspicious.",
  },
  {
    type: 'line',
    speaker: 'Socrates',
    text: 'And yet it plays. Tell me: does the music become less itself because a machine carries it?',
  },
  {
    type: 'line',
    speaker: 'Camus',
    text: "I would say the machine is innocent. It has no intention. Intention is the problem, always the problem. The artist creates against something. Against silence. Against death. Against the Tuesday afternoon that has no meaning. The machine has nothing to create against.",
  },
  {
    type: 'line',
    speaker: 'Russell',
    text: "You're describing creation as a form of rebellion.",
  },
  {
    type: 'line',
    speaker: 'Camus',
    text: "I'm describing it as the only honest response to the absurd. What else do you do when the universe offers no explanation? You make something. A song. A manifesto. A rather good Pernod.",
  },
  {
    type: 'line',
    speaker: 'Socrates',
    text: '*(sniffing the Pernod with genuine interest)* Tell me about this artificial intelligence. I want to understand what it is before we decide what to do about it.',
  },
  {
    type: 'line',
    speaker: 'Russell',
    text: "It's a system trained on vast quantities of human work (writing, music, painting) that has learned to predict what comes next in any sequence. It's extraordinarily good at this. It has, in a sense, read everything.",
  },
  { type: 'line', speaker: 'Socrates', text: 'And has it understood anything?' },
  {
    type: 'line',
    speaker: 'Russell',
    text: '*(pause)* That is the question I find myself unable to answer with confidence. Which is unusual for me.',
  },
  {
    type: 'line',
    speaker: 'Socrates',
    text: "So we have a machine that has consumed all human knowledge, including, I imagine, the songs of our friend here, and produces new arrangements of that knowledge. And we're debating who owns those arrangements.",
  },
  { type: 'line', speaker: 'Camus', text: "Nobody. That's what makes it interesting and also maddening." },
  {
    type: 'line',
    speaker: 'Russell',
    text: "The law will find someone. The law always finds someone. My concern is that the someone will be whoever owns the machine, not whoever created the ideas the machine digested.",
  },
  {
    type: 'line',
    speaker: 'Socrates',
    text: 'So the machine is fed by artists. But the harvest belongs to whoever built the machine. That seems…',
  },
  { type: 'line', speaker: 'Camus', text: 'Bananas.' },
  { type: 'line', speaker: 'Socrates', text: 'I was going to say unjust. But yours is more vivid.' },
  {
    type: 'line',
    speaker: 'Camus',
    text: "The question that interests me more: what does this do to the artist who knows? Who knows that everything she makes is now raw material for a machine she never consented to feed? Does she stop creating? *(lights a cigarette)* She does not. Because silence is worse. The absurd hero doesn't stop. She makes more. Louder. More defiantly. She makes the songs the machine can't fake, because it cannot be desperate in quite the right way.",
  },
  { type: 'line', speaker: 'Russell', text: "You're romanticizing necessity." },
  {
    type: 'line',
    speaker: 'Camus',
    text: "I'm describing reality with more style than it deserves. That's what writers do.",
  },
  {
    type: 'line',
    speaker: 'Socrates',
    text: 'Then let me try a different question. If the machine produces something beautiful, something that genuinely moves a person, does it matter that no human intended it to be beautiful?',
  },
  { type: 'line', speaker: 'Russell', text: 'Functionally? Perhaps not. Ethically? Enormously.' },
  {
    type: 'line',
    speaker: 'Camus',
    text: "A sunset moves people and intends nothing. But a sunset doesn't file a patent.",
  },
  {
    type: 'line',
    speaker: 'Russell',
    text: '*(laughs despite himself)* That is the most useful thing you\'ve said all evening.',
  },
  { type: 'line', speaker: 'Socrates', text: 'So the harm is not in the beauty. The harm is in the claim.' },
  {
    type: 'line',
    speaker: 'Russell',
    text: 'The harm is in the invisibility. A machine trained on a million paintings produces a painting. The million painters receive nothing: not credit, not compensation, not even acknowledgment. They are the aquifer. The machine is the tap. And someone else sells the water.',
  },
  { type: 'line', speaker: 'Camus', text: 'And eventually the aquifer dries up.' },
  { type: 'line', speaker: 'Socrates', text: 'Unless…' },
  {
    type: 'line',
    speaker: 'Camus',
    text: "Unless we decide, together, that it won't. Unless we name the rules. What is fair. What a human owes another human when they borrow from their life's work, even through a machine.",
  },
  { type: 'line', speaker: 'Russell', text: 'A manifesto, in other words.' },
  {
    type: 'line',
    speaker: 'Camus',
    text: "*(shrugs)* I've written worse. Usually before breakfast.",
  },
  {
    type: 'line',
    speaker: 'Socrates',
    text: "Then that is our task tonight. Not to solve the problem. Problems of this kind aren't solved, only navigated. But to name what is true. What does the artist deserve? What does the audience deserve? What does the machine, for all its eloquence, not understand and never will?",
  },
  { type: 'line', speaker: 'Russell', text: 'That will take more than one evening.' },
  {
    type: 'line',
    speaker: 'Camus',
    text: '*(signals the bartender)* Then we order another round. And begin.',
  },
  {
    type: 'stage',
    text: 'The jukebox, unprompted, plays something beautiful. None of them wrote it. All of them recognize it.',
  },
]

export const MANIFESTO_CTA = [
  "This isn't a petition. It's a position.",
  "If you make things (songs, code, paintings, sentences), you're already implicated in what AI becomes.",
  "Read it. Argue with it. Share it if it says something you couldn't. The conversation is the point.",
] as const

export const MANIFESTO_ATTRIBUTION =
  'Written by Banana (Céline Nadeau) with AI tools. Living document. First published May 2024.'

/** W-070 /learn accordion teaser (MANIFESTO-SPEC §4). */
export const MANIFESTO_LEARN_TEASER = {
  pullQuote:
    "Human authorship, AI as instrument. A framework for using AI without losing your soul, or someone else's work.",
  frameworkLabels: 'LIBERTY · EQUALITY · FRATERNITY',
} as const
