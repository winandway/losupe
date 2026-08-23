import type { Dict } from "./es";

export const en: Dict = {
  lang: "en" as unknown as "es",
  locale: "en-US",
  ogLocale: "en_US",
  brand: {
    name: "losupe",
    domain: "losupe.com",
    tagline: "What's happening, explained.",
    description:
      "News and guides on the economy, sales, technology and AI, crypto, and trends, explained clearly every morning. In English and Spanish.",
  },
  nav: {
    home: "Home",
    sections: "Sections",
    search: "Search",
    about: "About losupe",
    language: "Language",
    skip: "Skip to content",
  },
  hero: {
    kicker: "Today's edition",
    title: "What's happening, explained.",
    subtitle:
      "Economy, sales, tech and AI, crypto, and trends. Clear stories every morning, in English and Spanish.",
    searchPlaceholder: "What do you want to know today?",
    videoTitle: "Background video: aerial view of a city",
  },
  home: {
    latest: "Latest",
    topStory: "Today's top story",
    moreFrom: "More from",
    viewAll: "View the whole section",
    empty: "We're preparing our first stories. Check back soon.",
    welcomeTitle: "What's happening, explained.",
    welcomeBody:
      "Economy, sales, tech and AI, crypto, and trends. Clear stories and guides that are useful today and a year from now.",
  },
  article: {
    by: "By",
    published: "Published",
    updated: "Updated",
    minutes: (m: number) => `${m} min read`,
    sources: "Sources",
    aiNotice:
      "Written with help from artificial intelligence and reviewed by the losupe editorial team.",
    fallbackNotice: "This article is available in Spanish only for now.",
    legacyNotice: "Originally published on MundosCrypto, the site that became losupe.",
    related: "You may also like",
    share: "Share",
    shareOn: (network: string) => `Share on ${network}`,
    tags: "Topics",
    backTo: "Back to",
  },
  section: {
    count: (n: number) => (n === 1 ? "1 story" : `${n} stories`),
    empty: "No stories in this section yet. Our newsroom robot starts publishing very soon.",
    page: (n: number) => `Page ${n}`,
  },
  search: {
    title: "Search losupe",
    placeholder: "What do you want to know?",
    button: "Search",
    label: "Search",
    results: (n: number, q: string) =>
      n === 1 ? `1 result for “${q}”` : `${n} results for “${q}”`,
    none: (q: string) => `Nothing found for “${q}”. Try another word.`,
    hint: "Type at least 2 characters.",
  },
  author: {
    articlesBy: "Stories by",
    newsroom: "Newsroom",
  },
  about: {
    title: "About losupe",
    intro:
      "losupe is a bilingual (Spanish/English) digital publication that explains what's happening in the economy, sales and entrepreneurship, technology and AI, crypto, and culture. Every morning we publish short stories and guides that are useful today and a year from now.",
    principlesTitle: "How we work",
    principles: [
      "We read several sources before writing and cite where every fact comes from.",
      "We don't copy: every story is written from scratch, in plain language, with no filler.",
      "We keep news and opinion apart, and we correct mistakes publicly.",
      "We favor what lasts: guides, explainers, and advice that stay useful over time.",
    ],
    aiTitle: "Artificial intelligence, with rules",
    aiBody:
      "Part of our writing is done with help from artificial intelligence: an in-house system reads the sources, drafts stories, and illustrates them. The editorial team sets the topics, reviews what gets published, and is accountable for it. Every AI-assisted story says so at the bottom.",
    originTitle: "Where we come from",
    originBody:
      "losupe grew out of MundosCrypto, a cryptocurrency news site. We kept its archive and widened our focus to everything that moves money, work, and technology.",
  },
  footer: {
    sections: "Sections",
    site: "Site",
    feeds: "RSS in English",
    rights: "All rights reserved.",
    developedBy: "Developed by",
  },
  notFound: {
    title: "We couldn't find that page",
    body: "The link may be misspelled, or the story may no longer exist.",
    back: "Go to the homepage",
  },
  pagination: {
    prev: "Previous",
    next: "Next",
    label: "Pagination",
  },
  languages: {
    es: "Español",
    en: "English",
  },
};
