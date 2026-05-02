# GeoWatch Backend 🌍🔍

**GeoWatch** is an autonomous geopolitical intelligence agent backend designed to provide structured, evidence-based analysis of international relations (IR). It leverages advanced Large Language Models (LLMs) and real-time data retrieval tools to assist analysts, researchers, and policymakers in understanding complex global events.

## 🚀 Key Features

- **Autonomous Agent Loop:** Powered by Google Gemini (gemini-2.5-flash), the agent autonomously searches the web and queries specialized databases to answer complex geopolitical questions.
- **IR Analytical Frameworks:** The agent is grounded in established International Relations theories, including:
  - **Realism:** Power-balancing, military posture, and security competition.
  - **Liberalism:** International institutions, multilateral cooperation, and trade interdependence.
  - **Constructivism:** Identity politics, historical narratives, and soft power.
  - **Political Economy:** Sanctions, resource competition, and trade leverage.
- **Structured Intelligence Reporting:** Every analysis follows a professional briefing format (BLUF, Background, Current Situation, Analysis, Implications, and Sources).
- **Multi-Tool Integration:**
  - `web_search`: Targeted search for news, UN documents, and think-tank publications.
  - `call_api`: Retrieval of structured data from **ACLED** (conflict data) and **UN Comtrade** (trade flows).
  - `fetch_url`: Precise document scraping for deep analysis of treaties or statements.
- **Multilingual Support:** Capable of producing reports in English, French, Arabic, Spanish, and Portuguese.

---

## 🛠️ Tech Stack

- **Runtime:** Node.js with TypeScript
- **Framework:** Express.js
- **AI Core:** Google Generative AI (Gemini 2.5 Flash)
- **Database:** PostgreSQL via Prisma ORM
- **State & Concurrency:** Redis (for session locking and caching)
- **Validation:** Zod
- **Logging:** Pino & Pino-pretty
- **Documentation:** Swagger (OpenAPI 3.0)

---

## 📂 Project Structure

```text
src/
├── agent/            # Core AI logic (Agent loop, system prompts, report parsing)
├── config/           # Database, Redis, and Swagger configurations
├── controllers/      # API request handlers
├── middleware/       # Custom middleware (CORS, error handling, logging, validation)
├── routes/           # API route definitions
├── services/         # Business logic layer (User, Session, Message management)
├── tools/            # AI Tool implementations (Search, API calls, Web scraping)
├── utils/            # Shared utilities and custom error classes
└── validators/       # Zod schemas for request validation
```

---

## ⚙️ Getting Started

### Prerequisites

- Node.js (v18+)
- PostgreSQL
- Redis
- [Gemini API Key](https://aistudio.google.com/)

### Installation

1. Clone the repository:

   ```bash
   git clone git@github.com:Roiwhiz/geowatch-backend.git
   cd geowatch-backend
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Configure environment variables:
   Create a `.env.development` file in the root directory:

   ```env
   PORT=5000
   NODE_ENV=development
   DATABASE_URL="postgresql://user:password@localhost:5432/geowatch"
   REDIS_URL="redis://localhost:6379"
   GEMINI_API_KEY="your_api_key_here"
   TAVILY_API_KEY="your_tavily_key_here" # For web search
   ACLED_API_KEY="your_acled_key"
   ACLED_EMAIL="your_acled_email"
   ```

4. Run database migrations:

   ```bash
   npx prisma migrate dev
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

---

## 📖 API Documentation

The API is fully documented using Swagger. Once the server is running, you can access the interactive documentation at:

`http://localhost:5000/api-docs`

### Key Endpoints

- `POST /api/users/identify`: Restore or create user identity.
- `POST /api/sessions`: Initialize a new analysis session.
- `POST /api/chat`: Submit a query to the GeoWatch agent.
- `GET /api/sessions/:sessionId/reports`: Retrieve generated intelligence reports.

---
