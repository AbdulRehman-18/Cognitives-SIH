// UI string dictionaries — English and Hindi. Covers the learner shell,
// navigation, and primary page headings; AI-generated content is localised
// separately via the tutor/quiz language setting.

export type Locale = "en" | "hi";
export const LOCALES: Locale[] = ["en", "hi"];
export const LOCALE_COOKIE = "lang";

const en = {
  shell: { learner: "Learner", trainer: "Trainer", admin: "Admin", signOut: "Sign out", language: "Language" },
  learnerNav: { overview: "Overview", gaps: "Gap Report", path: "Learning Path", tutor: "Tutor", lab: "Lab", profile: "Profile", settings: "Settings" },
  dashboard: {
    eyebrow: "Overview",
    title: "Your competency snapshot",
    measured: (a: number, t: number) => `${a}/${t} competencies measured`,
    partial: "Measured ranges across the four-domain framework. This is a partial picture until you assess the rest.",
    learningTitle: "Learning on iGOT",
    learningHours: "learning hrs",
    inProgress: "in progress",
    completed: "completed",
    topGaps: "Top gaps",
  },
  tutor: {
    title: "Tutor",
    intro: (name: string) => `Hey ${name} — your measurement-aware tutor. It answers only from your course material and your own uploaded notes, cites every claim, and calibrates to your gaps.`,
    outOfScope: "Out-of-scope = declined, never guessed.",
  },
};

export type Dictionary = typeof en;

const hi: Dictionary = {
  shell: { learner: "शिक्षार्थी", trainer: "प्रशिक्षक", admin: "प्रशासक", signOut: "साइन आउट", language: "भाषा" },
  learnerNav: { overview: "सारांश", gaps: "कौशल अंतर", path: "अधिगम पथ", tutor: "ट्यूटर", lab: "प्रयोगशाला", profile: "प्रोफ़ाइल", settings: "सेटिंग्स" },
  dashboard: {
    eyebrow: "सारांश",
    title: "आपकी दक्षता का सारांश",
    measured: (a: number, t: number) => `${t} में से ${a} दक्षताएँ मापी गईं`,
    partial: "चार-क्षेत्रीय ढाँचे में मापी गई सीमाएँ। शेष दक्षताओं का आकलन होने तक यह आंशिक चित्र है।",
    learningTitle: "iGOT पर अधिगम",
    learningHours: "अधिगम घंटे",
    inProgress: "जारी",
    completed: "पूर्ण",
    topGaps: "प्रमुख कौशल अंतर",
  },
  tutor: {
    title: "ट्यूटर",
    intro: (name: string) => `नमस्ते ${name} — आपका मापन-आधारित ट्यूटर। यह केवल आपकी पाठ्य सामग्री और आपके अपलोड किए नोट्स से उत्तर देता है, हर तथ्य का स्रोत बताता है, और आपके कौशल अंतर के अनुसार समझाता है।`,
    outOfScope: "सामग्री से बाहर के प्रश्नों का उत्तर अनुमान से नहीं दिया जाता।",
  },
};

export const DICTIONARIES: Record<Locale, Dictionary> = { en, hi };
