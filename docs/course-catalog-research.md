# Course Catalog Research — Authentic iGOT / NSSTA Source Data

**Purpose:** seed data for the Recommendation Engine (Phase 6). Every entry below is transcribed from **official MoSPI/NSSTA published documents**, not invented.

**Why this matters for judging:** the PRD assumed a "clearly labelled mock dataset." We can do better — these are real programme titles, real providers, real durations, and (for the marketplace set) real `portal.igotkarmayogi.gov.in` course URLs. When a judge asks whether the recommendations point anywhere real, the answer is yes.

## Sources

1. **NSSTA Advance Training Calendar FY 2025-26** — Circular M-11013/01/2021-22/NSSTA-Part(1), dated 22.04.2025, signed Suraj Kumar Shukla, Deputy Director NSSTA.
   <https://mospi.gov.in/sites/default/files/announcements/Circular_NSSTA_Advance_Training_Calander_FY(25-26).pdf>
2. **NSSTA Office Memorandum on iGOT SADHANA Saptah** — M-11013/02/Misc/2024-25/NSSTA (75408), dated 01.04.2026. Contains *Annexure I — Indicative List of AI Courses* and *Annexure II — Indicative list of iGOT Marketplace Courses*.
   <https://www.mospi.gov.in/uploads/announcements/announcements_1775034332154_0ff2d7ab-39ac-49a5-b01a-8c9d5966bea3_NSSTA_OM_1.4.26_.pdf>

Useful context for the Admin dashboard narrative: 8,115 MoSPI employees onboarded to iGOT, 78,029 enrolments, 56,350+ completions. iGOT hosts 2,400+ courses from 200+ providers. DoPT O.M. 04.07.2025 makes prescribed iGOT courses + assessments mandatory, with results feeding APAR via SPARROW integration.

---

## A. iGOT AI Courses (Annexure I) — `source: IGOT`

Durations are as published; convert to fractional hours. `Level` maps to our 1-5 competency scale via Beginner→2, Intermediate→3, Advanced→4.

| # | Title | Provider | Duration | Level |
|---|---|---|---|---|
| 1 | Artificial Intelligence for Public Governance | Kyndryl & Data Security Council of India | 2h 42m | Intermediate |
| 2 | Large Language Models: Concepts and Applications | IIT Hyderabad | 1h 31m | Beginner |
| 3 | Deep Tech and India | ORF | 53m | Intermediate |
| 4 | AI in Government: Transforming Public Service Delivery | Indian Institute of Science (IISc) Bengaluru | 1h 16m | Beginner |
| 5 | Artificial Intelligence for Karmayogis | Karmayogi Bharat – Fractal | 1h 34m | Beginner |
| 6 | YUVA AI for All | India AI Mission | 3h 50m | Beginner |
| 7 | Fundamentals of Generative Artificial Intelligence | IIT Madras | 58m | Beginner |
| 8 | Introduction to Artificial Intelligence | IIT Madras | 1h 2m | Beginner |
| 9 | AI Applications in Government | NeGD | 1h 8m | Intermediate |
| 10 | आर्टिफ़िशियल इंटेलिजेंस की मूल बातें: सीखना अनुप्रयोग और नैतिकता | Microsoft | 1h 34m | Beginner |
| 11 | प्रशासन के लिए उत्तरदायी एआई का उपयोग | Wadhwani Foundation | 44m | Beginner |
| 12 | सुशासन में एआई नैतिकता | Wadhwani Foundation | 1h 13m | Beginner |
| 13 | Artificial Intelligence in Finance | XLRI | 1h 44m | Beginner |
| 14 | Core Areas of Artificial Intelligence | IIT Madras | 45m | Beginner |
| 15 | युवा एआई फॉर ऑल | India AI Mission | 3h 50m | Beginner |
| 16 | Advanced Prompt Engineering for Everyone | Vanderbilt University | 8h 40m | Intermediate |
| 17 | Build and Execute an Organisational AI Strategy | Coursera | 5h 52m | Intermediate |
| 18 | AI for Education (Intermediate) | Kennesaw State University | 5h 25m | Intermediate |
| 19 | AI for Energy and Biomedical Applications | University of Michigan | 6h 49m | Intermediate |

> Entries 10, 11, 12, 15 are Hindi-language versions. Keep them — they demonstrate the catalog's real multilingual nature. Do **not** build multilingual UI (explicit PRD non-goal); this is only course metadata.

## B. iGOT Marketplace Courses (Annexure II) — `source: IGOT`, real URLs

| # | Title | Provider | Course Link |
|---|---|---|---|
| 1 | Strategy and Game Theory for Management | IIM Ahmedabad | https://portal.igotkarmayogi.gov.in/app/toc/ext/ext_114471829986787328184 |
| 2 | Leadership Skills | IIM Ahmedabad | https://portal.igotkarmayogi.gov.in/app/toc/ext/ext_114471828231954432176 |
| 3 | Law, Governance, and Public Policy | O.P. Jindal Global University | https://portal.igotkarmayogi.gov.in/app/toc/ext/ext_114471817693544448133 |
| 4 | Introduction to Quantum Information | KAIST | https://portal.igotkarmayogi.gov.in/app/toc/ext/ext_114471836936683520192 |
| 5 | Negotiation Fundamentals | ESSEC Business School | https://portal.igotkarmayogi.gov.in/app/toc/ext/ext_114471842702008320196 |
| 6 | Analysis and Interpretation of Large-Scale Programs | Johns Hopkins University | https://portal.igotkarmayogi.gov.in/app/toc/ext/ext_114471819367686144139 |
| 7 | Build and Execute an Organisational AI Strategy | Coursera Instructor Network | https://portal.igotkarmayogi.gov.in/app/toc/ext/ext_114471818487185408124 |
| 8 | Forest Carbon Credits and Initiatives | Michigan State University | https://portal.igotkarmayogi.gov.in/app/toc/ext/ext_114471830248448000156 |

> Annexure II is "Page 1 of 2"; only page 1 was retrievable. Eight entries is sufficient.

## C. NSSTA Training Programmes (FY 2025-26 Calendar) — `source: NSSTA`

Real classroom/residential programmes. Duration is in **days** (5 days ≈ 30 study hours; half-day ≈ 3h; 1 day ≈ 6h). "Participants" maps well onto our `Role` seed data.

| Topic | Days | Participants | Institute |
|---|---|---|---|
| Survey Methodology and Data Analysis | 5 | ISS(P) 46th Batch | ISI, Kolkata |
| Basics of Macro Economic Theory | 5 | ISS(P) 46th Batch | DSE, New Delhi |
| Fundamentals of Official Statistics / Office Procedure | 5 | ISS(P) 47th Batch | NSSTA |
| Administrative Statistics | 5 | ISS(P) 47th Batch | NSSTA |
| Current Economic Issues, Energy and Environment | 5 | ISS(P) 46th Batch | IIM A / IGIDR, Mumbai |
| Derived Statistics (Official Statistics) | 5 | ISS(P) 47th Batch | NSSTA |
| Population and Demography Statistics | 5 | ISS(P) 46th Batch | IIPS Mumbai |
| Agriculture & Allied Statistics | 5 | ISS(P) 47th Batch | NSSTA |
| Nuances of Data Collection | half-day | SSOs, JSOs, field staff | NSSTA |
| Financial Statistics | 5 | ISS(P) 46th Batch | NIBM, Pune |
| Labour Force Statistics & Price Statistics | 5 | ISS(P) 47th Batch | NSSTA |
| Foundation Course on Machine Learning using Python | 5 | ISS officers, 8-10 yrs service | IIT Madras / IISc / CR Rao / IIT KGP / IIT Delhi |
| Big Data, Data Mining, Data Warehousing and Data Analytics, Artificial Intelligence, Python, Hadoop | 5 | ISS(P) 46th Batch | IIT Madras / IISc / CR Rao / IITs |
| National Account Statistics; Social Statistics & Education Statistics | 5 | ISS(P) 47th Batch | NSSTA |
| Industrial Statistics & Trade Statistics | 5 | ISS(P) 47th Batch | NSSTA |
| Official Statistics & Scope in this field | 1 | University Students | University Campus |
| Application of GIS, Forest Statistics & Data tools | 5 | ISS(P) 47th Batch | IIRS & FSI, Dehradun |
| GFR with emphasis on Procurement of Goods & Services | 5 | SSOs / JSOs | AJ-NIFM, Faridabad |
| Public Speaking | half-day | SSOs, JSOs, field staff | NSSTA |
| Sampling Techniques & Large Scale Sample Surveys | 5 | DES Officers | NSSTA |
| Cyber Security | half-day | SSOs, JSOs, field staff | NSSTA |
| Monitoring & Evaluation | 5 | ISS(P) 46th Batch | ASCI Hyderabad / NITI Aayog |
| Communication & Presentation Skills | 5 | ISS(P) 47th Batch | IIPA New Delhi / IIMC / British Council |
| Design, Evaluation and Execution of Projects | 5 | ISS officers, 15-19 yrs | IIM-Kozhikode / IIT / IIM |
| Chat-GPT | half-day | SSOs, JSOs, field staff | NSSTA |
| Regional & National Workshop on Data Ethics, Governance, and Quality in a Changing Data Ecosystem | 5 | State DES / International | NSSTA (UN SIAP) |
| Poverty & Inequality Estimation | 5 | ISS(P) 46th Batch | NSSTA / NIRD & PR, Hyderabad |
| Leadership and Management Training Programme | 5 | ISS(P) 47th Batch | IIMs |
| Advanced Management Programme | 5 | ISS officers, 15-19 yrs | IIM-K / IIT / IIM |
| Overview of Big Data & AI/ML | half-day | SSOs, JSOs, field staff | NSSTA |
| National Security / Internal Security and Forensic Science | 5 | ISS(P) 46th Batch | SVPNPA, Hyderabad |
| Managing Budgets and Monitoring plans | 5 | ISS(P) 47th Batch | AJNIFM, Faridabad |
| Basic Statistics, Official Statistics, Survey Methodology and Behavioural & Functional competencies | 5 | JSOs | NSSTA |
| Communication Skill & Development | 5 | SSOs | DES Kerala |
| Data Analytics & Visualization | half-day | SSOs, JSOs, field staff | NSSTA |
| Time Series and Applied Econometrics | 5 | ISS(P) 46th Batch | ISEC, Bengaluru |
| Technological Skills: Basic & Advance IT including NSS Data extraction | 5 | ISS(P) 47th Batch | NSSTA through CDAC/CC |
| Collection of Statistics (CoS) Act | half-day | SSOs, JSOs, field staff | NSSTA |
| Professional skills development, Business module & presentation skills, Influence and persuasion for public speakers | 5 | In-Service ISS Officers | NSSTA |
| e-Office with special emphasis on hands-on practice | 5 | JSOs / SSOs | ISTM / NIC / NSSTA |
| Data Analysis, its Interpretation and Visualization using R | 5 | ISS(P) 47th Batch | IASRI, New Delhi |
| Leadership and Strategic Management | 5 | ISS officers, 23-28 yrs | IIM A |
| Price Statistics | 5 | DES Officers | NSSTA |
| Population and Demography & Miscellaneous Statistics | 5 | ISS(P) 47th Batch | NSSTA |
| Large Scale Sample Survey | 5 | State DES / International | NSSTA (UN SIAP) |
| System of Environment-Economic Accounting (SEEA) & National Account Statistics (NAS) | 5 | State DES / International | NSSTA (UN SIAP) |
| Ethics, Data Governance and Integrity in Public Service | 5 | In-Service ISS Officers | NSSTA |
| Special Foundation Course (SFC) with AIS and CCS Officers | 5 | ISS(P) 47th Batch | MCRHRD, Hyderabad |
| National Accounts Statistics | 5 | DES Officers | NSSTA |
| Soft Skills, Personality Development & Professional Excellence | 5 | JSOs | DES Tripura |
| Effective Noting and Drafting | half-day | SSOs, JSOs, field staff | NSSTA |
| Personality Development and Interpersonal Relationships | half-day | SSOs, JSOs, field staff | NSSTA |
| Professional Communication and Effective Presentation | half-day | SSOs, JSOs, field staff | NSSTA |
| Team Building and Leadership through Adventure Sports | 5 | SSOs / In-Service ISS | NIM Uttarkashi / HMI Darjeeling |

**Total: ~82 courses across A + B + C** — comfortably exceeding the ~60 target.

---

## Seeding guidance

- Map each course to competencies from our 33-item taxonomy. Coverage is strong across all four domains: Statistical (survey methodology, national accounts, price/labour/agricultural/industrial statistics, sampling, SEEA), Technical (Python, R, ML, big data, GIS, data visualization, IT skills), Digital Governance (cyber security, data ethics/governance, CoS Act, e-Office), Behavioural (leadership, communication, negotiation, project management, ethics, team building).
- `externalUrl`: use the real link for Annexure II courses. For the rest, `https://portal.igotkarmayogi.gov.in/` (iGOT) or `https://nssta.gov.in/` (NSSTA) — do **not** fabricate deep links that would 404 in a live demo.
- Store the source citation on each row so the UI can attribute the catalog honestly.
- Deliberately leave a few taxonomy competencies with only weak matches. The Recommendation Engine must handle the "closest match" caveat path, and a demo where every gap has a perfect course is less credible than one that admits catalog limits.
