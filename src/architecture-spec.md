
# SmartEdge AI - Global Architecture Specification

## 🏗 System Overview
The platform is built as a **Single Page Application (SPA)** using **Angular v20** with **Zoneless Change Detection**. It follows a **Domain-Driven Modular Design** for high scalability.

## 📂 Folder Structure Proposal (for VS Code Migration)
```
/src
  /app
    /core
      /auth (Guard, Auth Service)
      /layout (Header, Sidebar, Shell)
    /features
      /tutor (TutorPage, ChatWindow, SubjectSelector)
      /research (ResearchPage, CitationGen, SummaryTool)
      /analytics (PerformancePage, ChartWidgets)
    /shared
      /components (Button, GlassCard, Modal, Input)
      /services (AIService, StateService, ThemeService)
      /interfaces (Models, Types)
  /assets (Images, Lottie, Icons)
  /environments (Config)
```

## 🧠 AI Engine Architecture
- **Provider**: OpenAI (`gpt-4o-mini` via backend proxy)
- **Integration**: `AIService` acts as a facade pattern, abstracting model-specific logic from components.
- **Context Handling**: Uses systemInstructions to differentiate between 'Academic Tutor' and 'Legal Translator'.

## 📊 Database Schema (PostgreSQL/Supabase)
```sql
users (id, email, full_name, role, current_xp, level)
subscriptions (user_id, plan_type, expires_at, stripe_id)
courses (id, title, description, category_id, difficulty)
user_progress (user_id, course_id, mastery_percent, last_access)
ai_interactions (id, user_id, module_type, token_count, created_at)
achievements (id, user_id, badge_type, unlocked_at)
```

## 🔌 API Structure Proposal
- `POST /api/ai/chat` -> { message, history, context }
- `GET /api/user/analytics` -> { stats, history, insights }
- `PATCH /api/user/settings` -> { language, theme, notifications }

## 🚀 Migration Notes
1. **Routing**: Replace current signal-based view switching with `RouterModule` using `withHashLocation()`.
2. **State**: Transition local signals to a global state manager (SignalStore/NgRx) for complex data flows.
3. **PWA**: Add `manifest.json` and service worker for offline study capabilities.
```
