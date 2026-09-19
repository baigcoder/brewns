export interface StoryBlock {
  eyebrow: string;
  headline: string;
  scriptAccent: string;
  lede: string;
  pillars: {
    title: string;
    description: string;
  }[];
  quotes: string[];
}

export const STORY_DATA: StoryBlock = {
  eyebrow: '// OUR PHILOSOPHY',
  headline: "THE CITY NEVER STOPS. YOUR COFFEE SHOULDN'T SLOW YOU DOWN.",
  scriptAccent: 'ritual',
  lede: 'Stay for a slow conversation or leave with the hot cup in your hand — both work, neither requires compromise. Nothing here is rushed, and nothing keeps you waiting longer than you intended to stay.',
  pillars: [
    {
      title: 'PURPOSEFUL SOURCING',
      description: 'We purchase exclusively from high-altitude smallholders in Huila, Sidama, and Huehuetenango, paying an average of 65% above Fair Trade minimums.',
    },
    {
      title: 'REVERENT EXTRACTION',
      description: 'Dialed in daily at 06:00 across multiple extraction profiles. Clean sweetness and delicate origin acids over heavy roast bitterness.',
    },
    {
      title: 'ZERO WAITING RITUAL',
      description: 'Mobile preorder timing calibrated so your cup is pulled seconds before you step through the door. Fresh crema, zero queue.',
    },
  ],
  quotes: ['GOOD COFFEE.', 'NO CEREMONY.', 'NO WAITING.'],
};
