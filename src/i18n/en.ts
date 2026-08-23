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
    menu: "Menu",
    closeMenu: "Close menu",
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
    more: "More",
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
    seeAll: (q: string) => `See all results for “${q}”`,
    typing: "Start typing and we will suggest stories.",
    seeAllTemplate: "See all results for “{q}”",
    noneTemplate: "Nothing found for “{q}”. Try another word.",
    close: "Close search",
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
    editorial: "Editorial policy",
    privacy: "Privacy",
    terms: "Terms and conditions",
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
  legal: {
    updated: "Last updated: August 23, 2026",
    contact:
      "Requests for corrections, right of reply, or about personal data are handled in writing at losupe's contact email (we will publish it in the footer as soon as the mailbox is active).",
    editorial: {
      title: "Editorial policy",
      intro:
        "This is how losupe decides what to publish, how it writes, and how it responds when it gets something wrong. We wrote it so that any reader, advertiser, or search engine knows what to expect.",
      sections: [
        {
          h: "What we publish",
          p: [
            "Short news stories and guides that stay useful over time, in five sections: economy, sales and motivation, technology and artificial intelligence, crypto, and artists and trends. Everything is published in Spanish and English.",
          ],
        },
        {
          h: "How we work",
          p: [
            "We read several sources before writing and cite where every fact comes from. We don't copy: every story is written from scratch, in plain language, with no filler. Figures that come from a company or a person are attributed as such. We keep information and opinion apart.",
          ],
        },
        {
          h: "Artificial intelligence, with rules",
          p: [
            "Part of our writing is done with help from an in-house AI system that reads sources, drafts stories, and illustrates them. The editorial team sets the topics, reviews what gets published, and is accountable for it. Every AI-assisted story says so at the bottom. No figure without a source, no invented quotes.",
          ],
        },
        {
          h: "Authors and bylines",
          p: [
            "Stories carry the byline of a real person with their own page, who is accountable for what is published. Collective pieces are signed by the losupe editorial team.",
          ],
        },
        {
          h: "Corrections",
          p: [
            "When we get something wrong, we fix it quickly and publicly: the story is updated and the date of the change appears at the bottom. If the error changes the meaning of the story, we explain it.",
          ],
        },
        {
          h: "Independence and sponsorship",
          p: [
            "We do not publish advertising disguised as news. If we ever publish sponsored content or affiliate links, they will be clearly and visibly labeled.",
          ],
        },
        {
          h: "Images and rights",
          p: [
            "We use our own images, AI-generated images (labeled as such), or free stock images with credit, plus screenshots of the sites we cite, with the source indicated.",
          ],
        },
        {
          h: "Use of our content by AI systems",
          p: [
            "We declare our preferences with Content Signals in robots.txt: search engines and assistants may index, read, and cite us with a link (search=yes, ai-input=yes), and we do not authorize using our content to train models (ai-train=no).",
          ],
        },
      ],
    },
    privacy: {
      title: "Privacy policy",
      intro:
        "Here is what data is processed when you visit losupe.com, why, and what you can do about it. In short: we don't require an account, we don't use our own tracking cookies, and we don't sell data.",
      sections: [
        {
          h: "What data is processed",
          p: [
            "We currently do not require an account or sign-up. The site search does not store your queries linked to you. The platform that hosts the site (YaDominios Cloud, on Cloudflare's network) processes technical data such as IP address, browser type, and country for security, performance, and aggregate visit statistics (no cookies, no individual profiles).",
          ],
        },
        {
          h: "Email newsletter",
          p: [
            "Once the newsletter exists, we will only email people who subscribe and confirm their address. Every email will include a one-click unsubscribe link. We do not sell or share the list.",
          ],
        },
        {
          h: "Links to other sites",
          p: [
            "Stories link to external sources. We are not responsible for those sites' privacy policies.",
          ],
        },
        {
          h: "Your rights",
          p: [
            "You can request access to, correction of, or deletion of any data we hold about you. We handle requests in writing.",
          ],
        },
        {
          h: "Children",
          p: [
            "losupe is not directed at children under 13 and does not knowingly collect data from children.",
          ],
        },
        {
          h: "Changes",
          p: ["If this policy changes, we will update the date shown above."],
        },
      ],
    },
    terms: {
      title: "Terms and conditions",
      intro: "By using losupe.com you accept these terms. They are short on purpose.",
      sections: [
        {
          h: "Informational content",
          p: [
            "What we publish is journalism and general information. It is not financial, legal, medical, or investment advice. Check with a professional before making decisions.",
          ],
        },
        {
          h: "What you can do with the content",
          p: [
            "Read it, share it with a link, and quote short excerpts with attribution to losupe. Reproducing full stories, bulk scraping, or using them to train AI models without written permission is not allowed.",
          ],
        },
        {
          h: "Intellectual property",
          p: [
            "losupe's texts, brand, and design belong to losupe. Third-party images appear with credit and belong to their authors.",
          ],
        },
        {
          h: "Accuracy and liability",
          p: [
            "We work to get everything right and correct it when we don't, but the content is provided without warranties. We are not liable for decisions made based on what we publish.",
          ],
        },
        {
          h: "Third-party links",
          p: ["Linked sites are the responsibility of their owners."],
        },
        {
          h: "Changes and governing law",
          p: [
            "We may update these terms; the date above indicates the current version. They are governed by the laws of the United States.",
          ],
        },
      ],
    },
  },
  languages: {
    es: "Español",
    en: "English",
  },
};
