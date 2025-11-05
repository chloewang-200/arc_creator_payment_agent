// Generate trendy AI avatar names for creators
export function getAIName(creatorName: string): string {
  // Extract first name
  const firstName = creatorName.split(' ')[0];
  
  // Trendy naming patterns
  const patterns = [
    `${firstName}AI`,      // AlexAI, SarahAI
    `${firstName}Bot`,     // AlexBot, SarahBot
    `${firstName}Agent`,   // AlexAgent, SarahAgent
  ];
  
  // Simple: use AI suffix for most, but can customize per creator
  return `${firstName}AI`;
}

// Generate personalized greetings based on creator (friendly and welcoming)
export function getAIGreeting(creatorName: string, creatorBio?: string, pricing?: { monthlyUSD?: number, postPrice?: number }): string {
  const firstName = creatorName.split(' ')[0];

  // Friendly, welcoming greetings (variations for natural feel)
  const greetings = [
    `Hi! How are you doing today? I'm ${firstName}'s AI avatar. Would greatly appreciate your support! 😊`,
    `Hey there! Thanks for stopping by. I'm ${firstName}'s AI assistant. Your support means the world!`,
    `Hello! Hope you're having a great day. I'm ${firstName}'s AI. Would love your support!`,
    `Hi! Nice to meet you. I'm ${firstName}'s digital assistant. Any support would be amazing! 💜`,
  ];

  // Return a random greeting for variety
  return greetings[Math.floor(Math.random() * greetings.length)];
}

