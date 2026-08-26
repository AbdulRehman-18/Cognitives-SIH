// Course catalog seed data — prisma/course-catalog.ts
//
// ~82 real iGOT / NSSTA courses transcribed from OFFICIAL MoSPI documents
// (docs/course-catalog-research.md — read it before editing this file):
//
//   A. iGOT AI Courses (Annexure I of NSSTA O.M. 01.04.2026)
//   B. iGOT Marketplace Courses (Annexure II — real deep links, page 1 of 2)
//   C. NSSTA Advance Training Calendar FY 2025-26 (Circular 22.04.2025)
//
// Every row carries its source citation inside `description` so the UI can
// attribute the catalog honestly. externalUrl uses REAL links where they
// exist (Annexure II); otherwise the portal root — never a fabricated deep
// link that would 404 in a live demo.
//
// Mapping notes (per docs/course-catalog-research.md "Seeding guidance"):
// - Level maps Beginner→2, Intermediate→3, Advanced→4 on our 1-5 scale.
// - NSSTA durations: 5 days ≈ 30 study hours, half-day ≈ 3h, 1 day ≈ 6h.
// - Annexure II publishes neither level nor duration; those are marked as
//   estimates in their descriptions rather than passed off as published data.
// - A few taxonomy competencies (Stata, SPSS, SAS, Digital Signatures,
//   Metadata Standards) are DELIBERATELY left with only weak or no matches —
//   the Recommendation Engine must exercise its "closest match" caveat path.

export interface CatalogCourse {
  source: "IGOT" | "NSSTA";
  title: string;
  description: string;
  /** Competency NAMES from the seed taxonomy (prisma/seed.ts COMPETENCIES). */
  competencies: string[];
  level: number;
  durationHours: number;
  externalUrl?: string;
}

const IGOT_PORTAL = "https://portal.igotkarmayogi.gov.in/";
const NSSTA_SITE = "https://nssta.gov.in/";

const ANNEX_I_CITATION =
  "Source: NSSTA O.M. on iGOT SADHANA Saptah, Annexure I (01.04.2026).";
const ANNEX_II_CITATION =
  "Source: NSSTA O.M. on iGOT SADHANA Saptah, Annexure II (01.04.2026).";
const CALENDAR_CITATION =
  "Source: NSSTA Advance Training Calendar FY 2025-26 (MoSPI circular, 22.04.2025).";

// ─────────────────────────────────────────────────────────────────────────
// A + B — iGOT (Annexure I AI courses + Annexure II marketplace courses)
// ─────────────────────────────────────────────────────────────────────────

interface IgotRow {
  title: string;
  provider: string;
  minutes: number | null; // null = not published (Annexure II)
  beginnerOrIntermediate: "Beginner" | "Intermediate" | null;
  competencies: string[];
  externalUrl?: string;
  note?: string;
}

const IGOT_ROWS: IgotRow[] = [
  // ——— Annexure I: AI Courses ———
  { title: "Artificial Intelligence for Public Governance", provider: "Kyndryl & Data Security Council of India", minutes: 162, beginnerOrIntermediate: "Intermediate", competencies: ["AI/ML", "Digital Public Infrastructure"] },
  { title: "Large Language Models: Concepts and Applications", provider: "IIT Hyderabad", minutes: 91, beginnerOrIntermediate: "Beginner", competencies: ["AI/ML"] },
  { title: "Deep Tech and India", provider: "ORF", minutes: 53, beginnerOrIntermediate: "Intermediate", competencies: ["AI/ML"] },
  { title: "AI in Government: Transforming Public Service Delivery", provider: "Indian Institute of Science (IISc) Bengaluru", minutes: 76, beginnerOrIntermediate: "Beginner", competencies: ["AI/ML", "Digital Public Infrastructure"] },
  { title: "Artificial Intelligence for Karmayogis", provider: "Karmayogi Bharat – Fractal", minutes: 94, beginnerOrIntermediate: "Beginner", competencies: ["AI/ML"] },
  { title: "YUVA AI for All", provider: "India AI Mission", minutes: 230, beginnerOrIntermediate: "Beginner", competencies: ["AI/ML"] },
  { title: "Fundamentals of Generative Artificial Intelligence", provider: "IIT Madras", minutes: 58, beginnerOrIntermediate: "Beginner", competencies: ["AI/ML"] },
  { title: "Introduction to Artificial Intelligence", provider: "IIT Madras", minutes: 62, beginnerOrIntermediate: "Beginner", competencies: ["AI/ML"] },
  { title: "AI Applications in Government", provider: "NeGD", minutes: 68, beginnerOrIntermediate: "Intermediate", competencies: ["AI/ML", "Digital Public Infrastructure"] },
  { title: "आर्टिफ़िशियल इंटेलिजेंस की मूल बातें: सीखना अनुप्रयोग और नैतिकता", provider: "Microsoft", minutes: 94, beginnerOrIntermediate: "Beginner", competencies: ["AI/ML"], note: "Hindi-language course." },
  { title: "प्रशासन के लिए उत्तरदायी एआई का उपयोग", provider: "Wadhwani Foundation", minutes: 44, beginnerOrIntermediate: "Beginner", competencies: ["AI/ML", "Ethics"], note: "Hindi-language course." },
  { title: "सुशासन में एआई नैतिकता", provider: "Wadhwani Foundation", minutes: 73, beginnerOrIntermediate: "Beginner", competencies: ["Ethics", "AI/ML"], note: "Hindi-language course." },
  { title: "Artificial Intelligence in Finance", provider: "XLRI", minutes: 104, beginnerOrIntermediate: "Beginner", competencies: ["AI/ML"] },
  { title: "Core Areas of Artificial Intelligence", provider: "IIT Madras", minutes: 45, beginnerOrIntermediate: "Beginner", competencies: ["AI/ML"] },
  { title: "युवा एआई फॉर ऑल", provider: "India AI Mission", minutes: 230, beginnerOrIntermediate: "Beginner", competencies: ["AI/ML"], note: "Hindi-language course." },
  { title: "Advanced Prompt Engineering for Everyone", provider: "Vanderbilt University", minutes: 520, beginnerOrIntermediate: "Intermediate", competencies: ["AI/ML"] },
  { title: "Build and Execute an Organisational AI Strategy", provider: "Coursera", minutes: 352, beginnerOrIntermediate: "Intermediate", competencies: ["AI/ML", "Change Management"] },
  { title: "AI for Education (Intermediate)", provider: "Kennesaw State University", minutes: 325, beginnerOrIntermediate: "Intermediate", competencies: ["AI/ML"] },
  { title: "AI for Energy and Biomedical Applications", provider: "University of Michigan", minutes: 409, beginnerOrIntermediate: "Intermediate", competencies: ["AI/ML"] },
  // ——— Annexure II: Marketplace Courses (real deep links; level/duration not published → estimated) ———
  { title: "Strategy and Game Theory for Management", provider: "IIM Ahmedabad", minutes: null, beginnerOrIntermediate: null, competencies: ["Decision Making"], externalUrl: "https://portal.igotkarmayogi.gov.in/app/toc/ext/ext_114471829986787328184", note: "Level and duration are not published in Annexure II; recorded as estimates." },
  { title: "Leadership Skills", provider: "IIM Ahmedabad", minutes: null, beginnerOrIntermediate: null, competencies: ["Leadership"], externalUrl: "https://portal.igotkarmayogi.gov.in/app/toc/ext/ext_114471828231954432176", note: "Level and duration are not published in Annexure II; recorded as estimates." },
  { title: "Law, Governance, and Public Policy", provider: "O.P. Jindal Global University", minutes: null, beginnerOrIntermediate: null, competencies: ["Ethics"], externalUrl: "https://portal.igotkarmayogi.gov.in/app/toc/ext/ext_114471817693544448133", note: "Level and duration are not published in Annexure II; recorded as estimates." },
  { title: "Introduction to Quantum Information", provider: "KAIST", minutes: null, beginnerOrIntermediate: null, competencies: ["AI/ML"], externalUrl: "https://portal.igotkarmayogi.gov.in/app/toc/ext/ext_114471836936683520192", note: "Adjacent to the computational curriculum rather than a direct competency match; level/duration estimated." },
  { title: "Negotiation Fundamentals", provider: "ESSEC Business School", minutes: null, beginnerOrIntermediate: null, competencies: ["Communication"], externalUrl: "https://portal.igotkarmayogi.gov.in/app/toc/ext/ext_114471842702008320196", note: "Level and duration are not published in Annexure II; recorded as estimates." },
  { title: "Analysis and Interpretation of Large-Scale Programs", provider: "Johns Hopkins University", minutes: null, beginnerOrIntermediate: null, competencies: ["Project Management", "Sampling"], externalUrl: "https://portal.igotkarmayogi.gov.in/app/toc/ext/ext_114471819367686144139", note: "Level and duration are not published in Annexure II; recorded as estimates." },
  { title: "Build and Execute an Organisational AI Strategy (Marketplace edition)", provider: "Coursera Instructor Network", minutes: null, beginnerOrIntermediate: null, competencies: ["AI/ML", "Change Management"], externalUrl: "https://portal.igotkarmayogi.gov.in/app/toc/ext/ext_114471818487185408124", note: "Marketplace edition of the Coursera course; level/duration estimated." },
  { title: "Forest Carbon Credits and Initiatives", provider: "Michigan State University", minutes: null, beginnerOrIntermediate: null, competencies: ["Agricultural Statistics"], externalUrl: "https://portal.igotkarmayogi.gov.in/app/toc/ext/ext_114471830248448000156", note: "Nearest taxonomy match is agricultural/environmental statistics; level/duration estimated." },
];

function hoursFromMinutes(minutes: number): number {
  return Math.round((minutes / 60) * 10) / 10;
}

function buildIgotCourses(): CatalogCourse[] {
  return IGOT_ROWS.map((row) => {
    const durationHours = row.minutes !== null ? hoursFromMinutes(row.minutes) : 5; // estimate, flagged in description
    const level = row.beginnerOrIntermediate === "Beginner" ? 2 : row.beginnerOrIntermediate === "Intermediate" ? 3 : 3;
    const durationLabel =
      row.minutes !== null
        ? `${Math.floor(row.minutes / 60)}h ${row.minutes % 60}m`
        : "duration not published";
    const citation = row.externalUrl ? ANNEX_II_CITATION : ANNEX_I_CITATION;
    const description = [
      `${row.note ?? ""}`.trim(),
      `Offered on iGOT Karmayogi by ${row.provider} (${durationLabel}).`,
      citation,
    ]
      .filter(Boolean)
      .join(" ");
    return {
      source: "IGOT" as const,
      title: row.title,
      description,
      competencies: row.competencies,
      level,
      durationHours,
      externalUrl: row.externalUrl ?? IGOT_PORTAL,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────
// C — NSSTA Advance Training Calendar FY 2025-26
// ─────────────────────────────────────────────────────────────────────────

interface NsstaRow {
  topic: string;
  days: 0.5 | 1 | 5;
  participants?: string;
  institute: string;
  competencies: string[];
  level?: number;
}

const NSSTA_ROWS: NsstaRow[] = [
  { topic: "Survey Methodology and Data Analysis", days: 5, participants: "ISS(P) 46th Batch", institute: "ISI, Kolkata", competencies: ["Survey Design", "Sampling"] },
  { topic: "Basics of Macro Economic Theory", days: 5, participants: "ISS(P) 46th Batch", institute: "DSE, New Delhi", competencies: ["National Accounts"] },
  { topic: "Fundamentals of Official Statistics / Office Procedure", days: 5, participants: "ISS(P) 47th Batch", institute: "NSSTA", competencies: ["Metadata Standards"] },
  { topic: "Administrative Statistics", days: 5, participants: "ISS(P) 47th Batch", institute: "NSSTA", competencies: ["Data Quality Frameworks"] },
  { topic: "Current Economic Issues, Energy and Environment", days: 5, participants: "ISS(P) 46th Batch", institute: "IIM A / IGIDR, Mumbai", competencies: ["National Accounts"] },
  { topic: "Derived Statistics (Official Statistics)", days: 5, participants: "ISS(P) 47th Batch", institute: "NSSTA", competencies: ["National Accounts", "Industrial Statistics"] },
  { topic: "Population and Demography Statistics", days: 5, participants: "ISS(P) 46th Batch", institute: "IIPS Mumbai", competencies: ["Labour Statistics"] },
  { topic: "Agriculture & Allied Statistics", days: 5, participants: "ISS(P) 47th Batch", institute: "NSSTA", competencies: ["Agricultural Statistics"] },
  { topic: "Nuances of Data Collection", days: 0.5, participants: "SSOs, JSOs, field staff", institute: "NSSTA", competencies: ["Survey Design"], level: 2 },
  { topic: "Financial Statistics", days: 5, participants: "ISS(P) 46th Batch", institute: "NIBM, Pune", competencies: ["National Accounts"] },
  { topic: "Labour Force Statistics & Price Statistics", days: 5, participants: "ISS(P) 47th Batch", institute: "NSSTA", competencies: ["Labour Statistics", "Price Statistics"] },
  { topic: "Foundation Course on Machine Learning using Python", days: 5, participants: "ISS officers, 8-10 yrs service", institute: "IIT Madras / IISc / CR Rao / IIT KGP / IIT Delhi", competencies: ["Python", "AI/ML"] },
  { topic: "Big Data, Data Mining, Data Warehousing and Data Analytics, Artificial Intelligence, Python, Hadoop", days: 5, participants: "ISS(P) 46th Batch", institute: "IIT Madras / IISc / CR Rao / IITs", competencies: ["Python", "AI/ML", "Data Visualization"] },
  { topic: "National Account Statistics; Social Statistics & Education Statistics", days: 5, participants: "ISS(P) 47th Batch", institute: "NSSTA", competencies: ["National Accounts", "SDG Indicators"] },
  { topic: "Industrial Statistics & Trade Statistics", days: 5, participants: "ISS(P) 47th Batch", institute: "NSSTA", competencies: ["Industrial Statistics"] },
  { topic: "Official Statistics & Scope in this field", days: 1, participants: "University Students", institute: "University Campus", competencies: ["Metadata Standards"], level: 2 },
  { topic: "Application of GIS, Forest Statistics & Data tools", days: 5, participants: "ISS(P) 47th Batch", institute: "IIRS & FSI, Dehradun", competencies: ["GIS", "Agricultural Statistics"] },
  { topic: "GFR with emphasis on Procurement of Goods & Services", days: 5, participants: "SSOs / JSOs", institute: "AJ-NIFM, Faridabad", competencies: ["Project Management"] },
  { topic: "Public Speaking", days: 0.5, participants: "SSOs, JSOs, field staff", institute: "NSSTA", competencies: ["Communication"], level: 2 },
  { topic: "Sampling Techniques & Large Scale Sample Surveys", days: 5, participants: "DES Officers", institute: "NSSTA", competencies: ["Sampling", "Survey Design"] },
  { topic: "Cyber Security", days: 0.5, participants: "SSOs, JSOs, field staff", institute: "NSSTA", competencies: ["Cybersecurity"], level: 2 },
  { topic: "Monitoring & Evaluation", days: 5, participants: "ISS(P) 46th Batch", institute: "ASCI Hyderabad / NITI Aayog", competencies: ["Project Management", "Data Quality Frameworks"] },
  { topic: "Communication & Presentation Skills", days: 5, participants: "ISS(P) 47th Batch", institute: "IIPA New Delhi / IIMC / British Council", competencies: ["Communication"] },
  { topic: "Design, Evaluation and Execution of Projects", days: 5, participants: "ISS officers, 15-19 yrs", institute: "IIM-Kozhikode / IIT / IIM", competencies: ["Project Management", "Decision Making"], level: 4 },
  { topic: "Chat-GPT", days: 0.5, participants: "SSOs, JSOs, field staff", institute: "NSSTA", competencies: ["AI/ML"], level: 2 },
  { topic: "Regional & National Workshop on Data Ethics, Governance, and Quality in a Changing Data Ecosystem", days: 5, participants: "State DES / International", institute: "NSSTA (UN SIAP)", competencies: ["Ethics", "Data Privacy", "Data Quality Frameworks"] },
  { topic: "Poverty & Inequality Estimation", days: 5, participants: "ISS(P) 46th Batch", institute: "NSSTA / NIRD & PR, Hyderabad", competencies: ["Sampling", "Survey Design"] },
  { topic: "Leadership and Management Training Programme", days: 5, participants: "ISS(P) 47th Batch", institute: "IIMs", competencies: ["Leadership"] },
  { topic: "Advanced Management Programme", days: 5, participants: "ISS officers, 15-19 yrs", institute: "IIM-K / IIT / IIM", competencies: ["Leadership", "Change Management"], level: 4 },
  { topic: "Overview of Big Data & AI/ML", days: 0.5, participants: "SSOs, JSOs, field staff", institute: "NSSTA", competencies: ["AI/ML"], level: 2 },
  { topic: "National Security / Internal Security and Forensic Science", days: 5, participants: "ISS(P) 46th Batch", institute: "SVPNPA, Hyderabad", competencies: ["Cybersecurity"] },
  { topic: "Managing Budgets and Monitoring plans", days: 5, participants: "ISS(P) 47th Batch", institute: "AJNIFM, Faridabad", competencies: ["Project Management"] },
  { topic: "Basic Statistics, Official Statistics, Survey Methodology and Behavioural & Functional competencies", days: 5, participants: "JSOs", institute: "NSSTA", competencies: ["Survey Design", "Communication"], level: 2 },
  { topic: "Communication Skill & Development", days: 5, participants: "SSOs", institute: "DES Kerala", competencies: ["Communication"], level: 2 },
  { topic: "Data Analytics & Visualization", days: 0.5, participants: "SSOs, JSOs, field staff", institute: "NSSTA", competencies: ["Data Visualization"], level: 2 },
  { topic: "Time Series and Applied Econometrics", days: 5, participants: "ISS(P) 46th Batch", institute: "ISEC, Bengaluru", competencies: ["Price Statistics"] },
  { topic: "Technological Skills: Basic & Advance IT including NSS Data extraction", days: 5, participants: "ISS(P) 47th Batch", institute: "NSSTA through CDAC/CC", competencies: ["SQL", "APIs"] },
  { topic: "Collection of Statistics (CoS) Act", days: 0.5, participants: "SSOs, JSOs, field staff", institute: "NSSTA", competencies: ["Ethics"], level: 2 },
  { topic: "Professional skills development, Business module & presentation skills, Influence and persuasion for public speakers", days: 5, participants: "In-Service ISS Officers", institute: "NSSTA", competencies: ["Communication", "Leadership"] },
  { topic: "e-Office with special emphasis on hands-on practice", days: 5, participants: "JSOs / SSOs", institute: "ISTM / NIC / NSSTA", competencies: ["Government Cloud"] },
  { topic: "Data Analysis, its Interpretation and Visualization using R", days: 5, participants: "ISS(P) 47th Batch", institute: "IASRI, New Delhi", competencies: ["R", "Data Visualization"] },
  { topic: "Leadership and Strategic Management", days: 5, participants: "ISS officers, 23-28 yrs", institute: "IIM A", competencies: ["Leadership", "Decision Making"], level: 4 },
  { topic: "Price Statistics", days: 5, participants: "DES Officers", institute: "NSSTA", competencies: ["Price Statistics"] },
  { topic: "Population and Demography & Miscellaneous Statistics", days: 5, participants: "ISS(P) 47th Batch", institute: "NSSTA", competencies: ["Labour Statistics"] },
  { topic: "Large Scale Sample Survey", days: 5, participants: "State DES / International", institute: "NSSTA (UN SIAP)", competencies: ["Sampling", "Survey Design"] },
  { topic: "System of Environment-Economic Accounting (SEEA) & National Account Statistics (NAS)", days: 5, participants: "State DES / International", institute: "NSSTA (UN SIAP)", competencies: ["National Accounts", "SDG Indicators"] },
  { topic: "Ethics, Data Governance and Integrity in Public Service", days: 5, participants: "In-Service ISS Officers", institute: "NSSTA", competencies: ["Ethics", "Data Privacy"] },
  { topic: "Special Foundation Course (SFC) with AIS and CCS Officers", days: 5, participants: "ISS(P) 47th Batch", institute: "MCRHRD, Hyderabad", competencies: ["Communication"], level: 2 },
  { topic: "National Accounts Statistics", days: 5, participants: "DES Officers", institute: "NSSTA", competencies: ["National Accounts"] },
  { topic: "Soft Skills, Personality Development & Professional Excellence", days: 5, participants: "JSOs", institute: "DES Tripura", competencies: ["Communication"], level: 2 },
  { topic: "Effective Noting and Drafting", days: 0.5, participants: "SSOs, JSOs, field staff", institute: "NSSTA", competencies: ["Communication"], level: 2 },
  { topic: "Personality Development and Interpersonal Relationships", days: 0.5, participants: "SSOs, JSOs, field staff", institute: "NSSTA", competencies: ["Communication"], level: 2 },
  { topic: "Professional Communication and Effective Presentation", days: 0.5, participants: "SSOs, JSOs, field staff", institute: "NSSTA", competencies: ["Communication"], level: 2 },
  { topic: "Team Building and Leadership through Adventure Sports", days: 5, participants: "SSOs / In-Service ISS", institute: "NIM Uttarkashi / HMI Darjeeling", competencies: ["Leadership"] },
];

function nsstaHours(days: number): number {
  // 5-day ≈ 30 study hours; half-day ≈ 3h; 1 day ≈ 6h (research doc guidance).
  if (days === 0.5) return 3;
  return days * 6;
}

function buildNsstaCourses(): CatalogCourse[] {
  return NSSTA_ROWS.map((row) => {
    const duration = row.days === 0.5 ? "half-day" : `${row.days}-day`;
    const participants = row.participants ? ` for ${row.participants}` : "";
    const description = `${duration.charAt(0).toUpperCase() + duration.slice(1)} residential/classroom programme offered by ${row.institute}${participants}. ${CALENDAR_CITATION}`;
    return {
      source: "NSSTA" as const,
      title: row.topic,
      description,
      competencies: row.competencies,
      level: row.level ?? 3,
      durationHours: nsstaHours(row.days),
      externalUrl: NSSTA_SITE,
    };
  });
}

export const COURSE_CATALOG: CatalogCourse[] = [...buildIgotCourses(), ...buildNsstaCourses()];
