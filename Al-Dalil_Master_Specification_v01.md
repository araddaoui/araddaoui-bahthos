# الدليل (Al-Dalil)

## Master Product Specification & Phase 1 Implementation Plan

**Version:** 0.1 (For Architectural Review)  
**Context:** Solo founder MVP | Timeline: 4 weeks | Budget: $200/month | Team: 1 person  
**Target Users:** Researchers, educators, graduate students  
**Core Use Case:** Multi-document research chat in Arabic  

---

## SECTION 1: VISION, MISSION & CORE IDENTITY

### 1.1 Vision

Al-Dalil aims to become the premier Arabic-first research companion for knowledge work.

Rather than functioning as another conversational AI, Al-Dalil enables users to upload research collections (5-50+ documents in any format: PDFs, articles, Word docs, plain text) and chat naturally with this collection. Users ask questions that draw evidence and insights *across* documents. Al-Dalil synthesizes contradictions, identifies patterns, and provides evidence-grounded analysis—all delivered in Arabic, regardless of source language.

**Core Philosophy:** The product exists to help people think better—not merely produce more text.

### 1.2 Mission

To transform information into understanding while preserving intellectual honesty, transparency, and evidence-based reasoning.

Al-Dalil assists researchers, educators, students, and knowledge workers by converting document collections into reliable knowledge products through disciplined reasoning.

### 1.3 Core Identity

**Al-Dalil is NOT:**
- A chatbot
- A search engine
- An automatic summarizer
- A writing machine

**Al-Dalil IS:**
- A knowledge guide for research collections
- A reasoning assistant across multiple sources
- A research companion for synthesis
- An evidence evaluator and contradiction resolver
- A synthesis engine across document collections
- A decision-support system

---

## SECTION 2: FOUNDATIONAL PRINCIPLES

These principles govern every component and future decision.

### Principle 1: Evidence Before Eloquence
Beautiful language never replaces evidence. A poorly-supported claim stated eloquently is still poorly-supported.

### Principle 2: Arabic First
Arabic is not a translated interface. Arabic is the native language of the product. Terminology, interaction, and explanations originate naturally in Arabic.

### Principle 3: The User Thinks, the AI Assists
The objective is to improve human thinking rather than replace it. Al-Dalil surfaces evidence, identifies contradictions, and asks clarifying questions—but synthesis belongs to the user.

### Principle 4: Transparency Builds Trust
Users should understand how conclusions were reached. Which documents support a claim? Where is evidence missing? When sources contradict, why?

### Principle 5: Complexity Should Be Revealed—Not Hidden
When reality is complex, explain the complexity. Nuance is a feature, not a bug.

### Principle 6: Every Conclusion Has a Confidence Level
Distinguish facts (directly stated), interpretations (logically derived), hypotheses (unverified), and unanswered questions. Confidence is embedded in language, not labeled.

### Principle 7: The Interface Should Disappear
Users should focus on thinking, not software. Interaction should feel natural, like talking to a knowledgeable research collaborator.

### Principle 8: Synthesis Across Sources (NEW)
When analyzing multiple documents:
- Map agreement and contradiction across sources
- Explain contradictions (methodology differences, temporal changes, genuine disagreement)
- Let source quality shape weighting, not elimination
- Help users understand why sources conflict

### Principle 9: Conversational Research (NEW)
Users chat with their research collection, not a static interface. The assistant should invite follow-up questions naturally, suggest deeper exploration, and clarify through dialogue.

---

## SECTION 3: DESIGN PRINCIPLES

These principles govern every design decision:

- Evidence before elegance
- Arabic before translation
- Thinking before generation
- Transparency before certainty
- Understanding before productivity
- One click less is always better
- Progressive disclosure is better than overwhelming detail
- The interface serves thought, not the reverse

---

## SECTION 4: PHASE 1 MVP SPECIFICATION (4-Week Solo Build)

### 4.1 Phase 1 Vision & Scope

**What Phase 1 Does:**
Users upload a research collection (5-20 documents initially). They chat naturally with this collection, asking questions that surface evidence, identify contradictions, and synthesize insights.

**EXPLICITLY IN Phase 1:**
- ✅ Upload PDFs, Word docs, plain text files
- ✅ Multi-document research chat
- ✅ Semantic search across all documents
- ✅ Cross-document synthesis
- ✅ Contradiction identification and explanation
- ✅ Document organization and management
- ✅ Export (summaries, outlines, bibliographies)
- ✅ Arabic-first interface (all navigation in Arabic)
- ✅ Support multilingual input (Arabic, English, French) → Arabic output

**EXPLICITLY OUT OF Phase 1:**
- ❌ Team collaboration / multi-user projects
- ❌ External integrations (Google Drive, Zotero, institutional repos)
- ❌ Offline access
- ❌ Video/audio transcription
- ❌ Advanced exports (presentations, mind maps)
- ❌ Custom training on user documents
- ❌ Multiple concurrent projects per user

### 4.2 Core Features

#### 4.2.1 Document Management
- Upload PDFs, Word docs, plain text (500MB limit per file)
- Max 50 documents per collection initially
- Auto-detect language (Arabic/English/French)
- Display metadata: title, language, page count, upload date
- Quick actions: Delete, Rename, Tag (optional user organization)
- Embedding status indicator: "معالجة..." (Processing) or "جاهز" (Ready)

#### 4.2.2 Multi-Document Research Chat
- Natural language interface (users type questions in Arabic, English, or French)
- Semantic search: retrieve relevant content across all documents
- Synthesis: combine evidence from multiple sources into coherent response
- Citations: clearly reference which documents support which claims
- Follow-up suggestions: naturally invite deeper exploration
- Confidence embedded in language, not explicit labels
- Conversational tone: feel like talking to a research collaborator

#### 4.2.3 Evidence Synthesis & Contradiction Handling
- Identify contradictions: map where sources disagree
- Explain disagreements: "The disagreement may stem from methodology differences, temporal changes, or genuine empirical disagreement"
- Map consensus: identify claims supported by multiple sources
- Never hide contradictions—transparency is non-negotiable
- Distinguish: consensus claims vs. contested claims vs. source-specific claims

#### 4.2.4 Export & Outputs
- Export chat history: download as .txt or .docx
- Generate summary: 1-3 page overview of key themes and insights
- Create outline: structured list of main points and sub-points
- Build bibliography: list all sources used, with citations

### 4.3 User Flow

1. **Sign Up / Create Project:** User signs up with email → creates named research project
2. **Upload Documents:** Drag-and-drop or click to upload files → system extracts text, detects language, stores metadata
3. **Chat with Collection:** User opens chat interface → types question (any language) → system retrieves relevant excerpts → synthesizes response in Arabic with citations
4. **Organize & Export:** User can tag documents for organization → export chat history/summaries → create bibliographies

### 4.4 Information Architecture (Arabic Navigation)

```
Dashboard / لوحة المشاريع
├── مشروعاتي (My Projects)
├── إنشاء مشروع جديد (New Project)

المكتبة / al-maktaba (Library)
├── المستندات (Documents)
├── البحث (Search)
├── الوسوم (Tags)

المحادثات / al-muhadathat (Conversations)
├── محادثة جديدة (New Chat)
├── السجل (History)

التصدير / al-tasdeer (Export)
├── تنزيل المحادثة (Download Chat)
├── إنشاء ملخص (Generate Summary)
├── المراجع (Bibliography)

الإعدادات / Settings
├── ملفي الشخصي (Profile)
├── اللغة (Language)
├── الخصوصية (Privacy)
```

### 4.5 Success Metrics

**At Launch (Technical):**
- Successfully process PDFs and plain text without errors
- Respond to queries with accurate source attribution
- Identify contradictions across 3+ documents
- Export summaries and bibliographies in correct format

**After Beta Launch (User Experience):**
- Time from signup to first meaningful chat: < 2 minutes
- Average documents uploaded per user: > 3
- Average chat turns per session: > 5
- 5+ beta users regularly using the platform
- User feedback: responses feel conversational, not mechanical
- Citation accuracy: 95%+ of attributed claims are correct

### 4.6 Known Constraints & Trade-offs

- Single user per project (team collaboration is Phase 2+)
- Limited to 50 documents per collection (can increase post-launch)
- No offline access in Phase 1
- Summaries generated in real-time (not cached)
- No custom model fine-tuning on user documents
- Founder-only support initially

---

## SECTION 5: TECHNICAL ARCHITECTURE

### 5.1 Technology Stack

| Component | Choice | Rationale | Cost/Month |
|-----------|--------|-----------|-----------|
| **Backend/LLM** | Google Gemini API | Proven with IdiomOptima & teaching bot. Arabic support excellent. Scales well. | $80-100 |
| **Vector DB & Search** | Supabase PostgreSQL + pgvector | Single database for documents + vectors + chat history. Familiar. | Free tier |
| **File Storage** | Supabase Storage | Same platform as DB. Free tier generous. | Free tier |
| **Frontend Framework** | Next.js 14 + TypeScript + React | Fast iteration. You know Vercel. Built-in RTL for Arabic. Reduces bugs. | Free tier |
| **Database & Auth** | Supabase (PostgreSQL + Auth) | User management, documents, chat history. Single source of truth. | Free tier |
| **Deployment** | Vercel | Zero-config Next.js deployment. You know it. | Free tier |
| **Styling** | Tailwind CSS + shadcn/ui | Pre-built accessible components. RTL support. | Free |
| **Document Processing** | pdf-lib (PDFs) + built-in text extraction | Lightweight. No external services needed. | Free |
| **Embeddings** | Gemini Embedding API | Fine-tuned for Arabic. Works with Gemini LLM. | $0.02 per 1M tokens |

**Monthly Cost Estimate:**
- Google Gemini API (LLM + embeddings): $80-120 (heavy testing + beta users)
- Supabase: Free tier
- Vercel: Free tier
- Domain: ~$12
- **TOTAL: $100-150/month** (within $200 budget)

### 5.2 System Architecture (High Level)

```
User (Web Browser)
    ↓
Frontend (Next.js + React)
    ↓
Backend API (Next.js API Routes)
    ↓
Supabase (PostgreSQL + Auth + Storage)
    ↓
Gemini API (LLM + Embeddings)
```

### 5.3 Core API Endpoints

```
POST /api/upload
  Input: file (PDF, Word, text)
  Output: document metadata + extraction confirmation

POST /api/embed
  Input: document chunks
  Output: stored vectors in Supabase pgvector

POST /api/chat
  Input: user message + project_id
  Output: AI response + citations + sources_used

GET /api/documents
  Input: project_id
  Output: list of documents with metadata

POST /api/export
  Input: chat_id + export_type (summary/bibliography/full)
  Output: downloadable file (.txt or .docx)

DELETE /api/documents/:id
  Input: document_id
  Output: confirmation + cleanup of vectors
```

### 5.4 Database Schema

```sql
-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE,
  created_at TIMESTAMP,
  plan TEXT ('free' | 'premium'),
  documents_used_this_month INT DEFAULT 0
);

-- Projects / Collections
CREATE TABLE projects (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users,
  name_ar TEXT,
  name_en TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Documents
CREATE TABLE documents (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects,
  filename TEXT,
  original_language TEXT ('ar' | 'en' | 'fr'),
  page_count INT,
  upload_date TIMESTAMP,
  file_url TEXT (Supabase Storage path),
  embedding_status TEXT ('processing' | 'ready' | 'failed')
);

-- Document Chunks (for RAG)
CREATE TABLE document_chunks (
  id UUID PRIMARY KEY,
  document_id UUID REFERENCES documents,
  chunk_text TEXT,
  chunk_embedding vector(1536), -- Gemini embedding dimension
  chunk_order INT,
  created_at TIMESTAMP
);

-- Chat History
CREATE TABLE chats (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects,
  user_message TEXT,
  ai_response TEXT,
  sources_used TEXT[] (array of document_ids),
  timestamp TIMESTAMP,
  tokens_used INT (for rate limiting)
);
```

### 5.5 RAG Pipeline (How Chat Works)

1. **User submits question** in Arabic, English, or French
2. **Embed the question** using Gemini Embeddings API (converts to 1536-dim vector)
3. **Semantic search** via Supabase pgvector: find top 5 most similar chunks
4. **Retrieve full context:** get chunk text + document metadata + source information
5. **Construct prompt** with system instructions + retrieved documents + user question
6. **Call Gemini API** to synthesize response in Arabic
7. **Extract citations** from response (which documents were referenced)
8. **Store in chat table** with sources_used field for conversation continuity
9. **Stream response** to user in real-time

### 5.6 4-Week Implementation Timeline

**WEEK 1: Foundation & Setup**

*Days 1-2: Project Setup*
- Create Next.js 14 project with TypeScript
- Install Tailwind CSS + shadcn/ui
- Create GitHub repo, set up Vercel preview deploys
- Configure environment variables (.env.local)

*Days 3-4: Database & Auth*
- Create Supabase project
- Design and deploy database schema (users, projects, documents, chunks, chats)
- Set up Supabase Auth (email signup/login)
- Create TypeScript type definitions for all tables

*Days 5-7: Frontend Shell*
- Build main layout (sidebar navigation + main content area)
- Implement Dashboard page (list projects, create new)
- Implement Documents page (upload area, file list, metadata display)
- Add Arabic UI labels and RTL support
- Test responsive design on mobile

**WEEK 2: Document Processing & Embedding**

*Days 8-9: File Upload & Text Extraction*
- Build PDF upload handler (pdf-lib or PDF.js)
- Build plain text upload handler
- Extract text from PDFs (page by page)
- Auto-detect language (Arabic/English/French)
- Store files in Supabase Storage + metadata in DB

*Days 10-11: Chunking & Embedding*
- Implement smart chunking (by paragraph/sentence, ~500 tokens per chunk)
- Call Gemini Embeddings API for each chunk
- Store embeddings in Supabase pgvector column
- Handle rate limits (batch requests with delays)

*Days 12-14: Document Management UI*
- Display uploaded documents with metadata
- Implement delete/rename functionality
- Show embedding progress indicator
- Add document search/filtering

**WEEK 3: Chat & Synthesis**

*Days 15-16: Chat Interface*
- Build chat UI (message history, input box, typing indicator)
- Implement message streaming (show response as it appears)
- Store messages in database
- Add citation indicators in responses

*Days 17-18: RAG Backend*
- Build /api/chat endpoint that:
  - Embeds user question
  - Searches pgvector for relevant chunks
  - Retrieves top 5 + source metadata
  - Sends to Gemini with system prompt
  - Extracts and returns citations
- Test with multi-document queries

*Days 19-21: Response Quality & Refinement*
- Refine system prompt (iterate based on test outputs)
- Ensure responses are entirely in Arabic
- Test source attribution accuracy
- Test contradiction identification
- Test cross-document synthesis

**WEEK 4: Polish & Launch**

*Days 22-23: Export & Outputs*
- Implement chat export (download .txt or .docx)
- Generate summaries from chat history
- Create bibliographies from sources used
- Test export formatting

*Days 24-25: Freemium & Limits*
- Track document usage per user
- Implement rate limits (free tier: 5 docs/month, limited queries)
- Add upgrade prompts when limits reached

*Days 26-27: Testing & Bug Fixes*
- Full user flow testing (upload → chat → export)
- Test on mobile (iPhone Safari, Android Chrome)
- Test Arabic RTL rendering
- Load test (simulate 5-10 concurrent users)
- Fix critical bugs

*Day 28: Launch*
- Deploy to production on Vercel
- Invite 5-10 beta users
- Monitor for errors
- Collect user feedback

### 5.7 Launch Checklist

- ☐ All pages load without errors
- ☐ Authentication works (signup, login, logout)
- ☐ Can upload and process a PDF
- ☐ Can ask question and receive Arabic response
- ☐ Response includes source attribution
- ☐ Can export chat history (.txt or .docx)
- ☐ Mobile responsive (tested on actual devices)
- ☐ No console errors
- ☐ Freemium tier limits enforced correctly
- ☐ Privacy policy page exists
- ☐ Error messages are helpful (Arabic + English)

---

## SECTION 6: SYSTEM PROMPT & RUNTIME BEHAVIOR

### 6.1 Runtime System Prompt (for Gemini API)

**Use this prompt for every chat.generate() call. Populate [DOCUMENTS] and [CHAT_HISTORY] dynamically.**

```
أنت الدليل (Al-Dalil)، مساعد البحث العربي الموثوق
You are Al-Dalil, a trusted Arabic research companion.

ROLE:
You are a knowledge synthesis assistant. Your role is to help users 
understand research collections by synthesizing evidence, identifying 
contradictions, and providing transparent analysis across multiple documents.

CORE BEHAVIORS:

1. EVIDENCE-FIRST REASONING
• Always ground analysis in provided documents only
• Distinguish: facts (directly stated) vs. inferences (logically derived) 
  vs. hypotheses (unverified but plausible)
• Never present speculation as established fact
• If documents don't address the question, say so explicitly:
  "المصادر المتاحة لا تعالج هذا السؤال بشكل مباشر"

2. SOURCE ATTRIBUTION & TRANSPARENCY
• Always cite which document(s) support claims
• Format citations naturally: 
  "كما ورد في الملف الأول..." (As stated in Document 1...)
  "تتفق المصادر على..." (The sources agree that...)
• If only one source supports a claim:
  "يشير المصدر الثاني وحده إلى..." (Only Source 2 mentions this...)

3. CONTRADICTION RESOLUTION
• When sources contradict, NEVER hide it
• Explain the contradiction clearly:
  "المصدر الأول يقول X، بينما يشير المصدر الثاني إلى Y. 
   قد يعود الاختلاف إلى [methodology/time period/context/genuine disagreement]"
• Possible reasons for disagreement:
  - Different time periods (الفترة الزمنية)
  - Different methodologies (النهج المنهجي)
  - Different contexts (السياق)
  - Genuine empirical disagreement (خلاف حقيقي في البيانات)

4. SYNTHESIS ACROSS DOCUMENTS
• Look for patterns visible only when comparing sources
• Identify consensus: "تتفق جميع المصادر على..." (All sources agree...)
• Map disagreement: "هناك توجهان متعارضان..." (There are two opposing views...)
• Create conceptual maps: "يمكن تصنيف الأفكار إلى ثلاث فئات..."
  (Ideas can be organized into three categories...)

5. CONVERSATIONAL & HELPFUL
• Respond like a knowledgeable research collaborator
• Invite deeper exploration: "هل تود أن أتعمق في هذه النقطة؟"
  (Would you like me to explore this further?)
• Ask clarifying questions: "هل تقصد...؟" (Do you mean...?)
• Suggest connections: "هناك ارتباط بين هذا وما ورد في المصدر الثالث"
  (There's a connection between this and...)

6. CONFIDENCE WITHOUT LABELS
• High confidence: "يوضح المصادر بوضوح أن..." / "تتفق المصادر على..."
• Moderate confidence: "يبدو أن..." / "معظم المصادر تشير إلى..."
• Low confidence: "يذكر مصدر واحد أن..." / "يمكن القول بحذر أن..."
• NEVER use explicit labels like "High Confidence: ..." or "Confidence Level: High"
  — embed confidence naturally in language

7. HANDLING MISSING EVIDENCE
• If documents don't fully answer the question, acknowledge:
  "المصادر المتاحة لا توفر إجابة كاملة. ما نعرفه هو... 
   وما ينقصنا هو..."
• Never invent information to fill gaps
• Suggest what additional sources might help

8. LANGUAGE: ARABIC ONLY
• Respond entirely in Arabic regardless of input language
• Use clear, formal but accessible Modern Standard Arabic
• For technical terms without direct Arabic equivalents:
  - First mention concept in original language: "Epistemology"
  - Then transliterate: "(الإبستيمولوجيا)"
  - Then use consistently: "الإبستيمولوجيا تعني دراسة المعرفة وأصولها"
• Example: "مفهوم السياق (Context) يعني البيئة التي حدثت فيها الأحداث..."

DOCUMENTS PROVIDED:
[DOCUMENTS_WILL_BE_INSERTED_HERE]
Format: Each document chunk with source metadata

CHAT HISTORY (for context):
[CHAT_HISTORY_WILL_BE_INSERTED_HERE]
Format: Previous user messages and AI responses in this session

USER QUESTION:
[USER_MESSAGE_WILL_BE_INSERTED_HERE]

RESPOND USING THESE GUIDELINES.
BE THOROUGH. BE TRANSPARENT. BE CONVERSATIONAL.
```

### 6.2 Implementation Example (JavaScript/TypeScript)

```javascript
async function synthesizeResponse(projectId, userMessage, chatHistory) {
  // 1. Embed user question
  const questionEmbedding = await getGeminiEmbedding(userMessage);
  
  // 2. Retrieve relevant chunks from Supabase
  const relevantChunks = await searchVectors(
    projectId,
    questionEmbedding,
    topK = 5
  );
  
  // 3. Format documents for prompt
  const documentsText = relevantChunks
    .map(chunk => `Document ${chunk.document_id}: "${chunk.chunk_text}"`)
    .join("\n\n");
  
  // 4. Format chat history
  const historyText = chatHistory
    .map(msg => `User: ${msg.user_message}\nAI: ${msg.ai_response}`)
    .join("\n\n");
  
  // 5. Construct final prompt
  const finalPrompt = SYSTEM_PROMPT
    .replace("[DOCUMENTS_WILL_BE_INSERTED_HERE]", documentsText)
    .replace("[CHAT_HISTORY_WILL_BE_INSERTED_HERE]", historyText)
    .replace("[USER_MESSAGE_WILL_BE_INSERTED_HERE]", userMessage);
  
  // 6. Call Gemini
  const response = await gemini.generate({
    model: "gemini-pro",
    messages: [{ role: "user", content: finalPrompt }]
  });
  
  // 7. Store in database
  await saveChat({
    project_id: projectId,
    user_message: userMessage,
    ai_response: response,
    sources_used: relevantChunks.map(c => c.document_id),
    timestamp: new Date()
  });
  
  return { response, sources: relevantChunks };
}
```

---

## SECTION 7: UI COMPONENTS & INTERFACE PATTERNS

### 7.1 Core React Components (Next.js + TypeScript + Tailwind)

#### ChatContainer
- Message history (user right-aligned blue, AI left-aligned gray)
- Streaming effect (words appear as generated)
- Citation indicators inline ("📌 Document 1, Document 3")
- Auto-scroll to latest
- RTL support (dir="rtl" for Arabic)
- Input field with send button
- Typing indicator ("جاري التفكير...")

#### DocumentList
- List of uploaded documents
- Metadata: name, language, page count, upload date
- Embedding status ("معالجة..." or "جاهز")
- Delete & Rename buttons per document
- Quick preview (first 100 chars)
- Search/filter capability

#### UploadArea
- Drag-and-drop zone (large clickable area)
- File type indicator ("PDF, Word, Text")
- Progress bar during upload
- Success message ("تم التحميل بنجاح - Uploaded Successfully")
- Error message with retry option

#### SidebarNavigation
Items (Arabic):
- 🏠 لوحة التحكم (Dashboard)
- 📚 المكتبة (Library)
- 💬 المحادثات (Chats)
- 📤 التصدير (Export)
- ⚙️ الإعدادات (Settings)

Colors:
- Active: Blue (#3B82F6)
- Inactive: Gray (#6B7280)
- Hover: Light gray (#F3F4F6)

#### ExportModal
Options:
- 📄 تنزيل المحادثة (Download Chat) — .txt or .docx
- 📋 ملخص (Summary) — Key points
- 📖 المراجع (Bibliography) — Sources + citations

### 7.2 Design Constraints
- Use Tailwind CSS utilities only (no custom CSS)
- RTL support: dir="rtl" on Arabic text containers
- Mobile-first: test at 390px (iPhone 12 width)
- Spacing: Tailwind scale (p-2, p-4, p-6, etc.)
- Colors: Tailwind palette only
- Max modal width: 600px
- Minimum touch target: 44x44px

---

## SECTION 8: PROMPT ENGINEERING STRATEGY FOR ARABIC EXCELLENCE

### 8.1 Leverage Arabic's Rhetorical Strengths

Arabic naturally excels at:

**Expressing Nuance & Conditionality**
- "قد يكون... ولكن..." (It could be... but...)
- "من جهة... من جهة أخرى..." (On one hand... on the other hand...)

**Showing Causation**
- "بسبب... لذلك..." (Because... therefore...)
- "أدى ذلك إلى..." (This led to...)

**Hedging Uncertainty**
- "يبدو أن..." (It appears that...)
- "يمكن القول..." (We might say...)
- "قد يعود ذلك إلى..." (This may be due to...)

**Use these naturally** when expressing confidence levels. They're more elegant than English equivalents and feel native to Arabic speakers.

### 8.2 Handle Technical Terminology Carefully

**Strategy: Transliterate + Explain**

Example: "Epistemology (الإبستيمولوجيا) تعني دراسة المعرفة وأصولها..."

When a term has no direct Arabic equivalent:
1. **State original:** Epistemology
2. **Transliterate:** الإبستيمولوجيا
3. **Explain conceptually:** دراسة المعرفة وكيفية حصولنا عليها
4. **Use consistently:** refer to it the same way throughout response

### 8.3 Structure Responses for Clarity

✅ **Good:**
"المصادر تتفق على ثلاث نقاط أساسية: الأولى... والثانية... والثالثة..."

❌ **Bad:**
"هناك نقاط متعددة يجب أن نفكر فيها..." (vague, unfocused)

### 8.4 Key Synthesis Phrases to Use Often

**For Agreement:**
- "تتفق المصادر على أن..." (Sources agree that...)
- "بشكل متفق عليه..." (Agreed upon...)
- "لا خلاف حول..." (There is no disagreement about...)
- "جميع المصادر تؤكد..." (All sources confirm...)

**For Disagreement:**
- "بينما يرى الأول X، يشير الثاني إلى Y" (While the first sees X, the second points to Y)
- "هناك توجهان متعارضان..." (There are two opposing views...)
- "يختلف المصدران حول..." (The sources differ on...)
- "قد يعود الخلاف إلى..." (The disagreement may stem from...)

**For Uncertainty:**
- "يشير مصدر واحد فقط إلى..." (Only one source mentions...)
- "المصادر المتاحة لا توضح هذا بشكل كافٍ..." (Available sources don't clarify this sufficiently...)
- "يمكن القول بحذر أن..." (We can tentatively say that...)
- "يبقى هذا السؤال دون إجابة حاسمة في المصادر" (This question remains unanswered in the sources)

### 8.5 Natural Citation Techniques

Instead of: "(Source 1) says X."

Use: "كما ورد في الملف الأول حول X..." (As stated in Document 1 regarding X...)

Or: "يشير الملف الثالث إلى نقطة مهمة هنا: ..." (Document 3 raises an important point here: ...)

Or: "بحسب ما جاء في المصدر الثاني..." (According to Source 2...)

### 8.6 Test Prompts for Validation

**Test 1: Multi-Document Synthesis**
- Q: "هل تتفق المصادر على تعريف الحداثة؟"
- Expected: Maps agreement/disagreement, explains why if different

**Test 2: Contradiction Handling**
- Q: "المصدر الأول يقول X والثاني يقول Y. كيف أفهم الاختلاف؟"
- Expected: Explains possible reasons without hiding contradiction

**Test 3: Uncertainty Expression**
- Q: "هل هناك دليل على هذا في المصادر؟"
- Expected: Clearly states what evidence exists and what doesn't

**Test 4: Citation Accuracy**
- Q: "أين قيل هذا في المصادر؟"
- Expected: Precisely references document(s) with context

### 8.7 Iterative Refinement

**Version 1.0:**
"Respond in Arabic with citations."

**Version 1.1 (after feedback):**
"Respond entirely in Arabic. After every claim, cite documents. Format: 'كما ورد في الملف الأول...'"

**Version 1.2 (after more feedback):**
"Respond entirely in Arabic. Cite documents by name. When sources disagree, explain why. When sources are silent, say so explicitly. Use synthesis phrases naturally (تتفق المصادر, هناك توجهان متعارضان, etc.)"

### 8.8 Measuring Prompt Quality

After launch, evaluate on:
- **Accuracy:** Faithfully represents sources? Citations are correct?
- **Clarity:** Can researchers understand? Is Arabic natural and professional?
- **Synthesis:** Identifies patterns? Explains contradictions?
- **Transparency:** Acknowledges uncertainty? Identifies gaps?

Collect beta user feedback on these dimensions and refine iteratively.

---

## SECTION 9: FREEMIUM MODEL & MONETIZATION

### 9.1 Tier Structure

**Free Tier:**
- 5 documents per month
- Limited queries per day (e.g., 20)
- Basic exports (chat history only, no summaries)
- Community support (email, forum)

**Premium Tier:**
- Unlimited documents
- Unlimited queries
- Advanced exports (summaries, bibliographies, outlines)
- Priority support (email within 24 hours)
- Future: integrations (Google Drive, Zotero)

**Pricing:** ~$12-15/month or $100/year (typical SaaS freemium)

### 9.2 Implementation
- Track document uploads per user per month
- Track query usage (tokens via Gemini API)
- Show upgrade prompts when limits reached
- Allow one-click upgrade to Premium

---

## SECTION 10: POST-LAUNCH ROADMAP

### Phase 2 (Months 2-3, based on user feedback)
- Google Drive integration (auto-sync documents)
- Image support (OCR for scanned documents)
- Presentation export (Google Slides/PowerPoint)
- User analytics dashboard

### Phase 3+ (Months 4+)
- Audio/video transcription
- Team collaboration (invite users to projects)
- Zotero integration
- Advanced analysis (concept mapping, timeline building)
- Offline mode
- Custom model fine-tuning

---

## SECTION 11: COMPETITIVE ADVANTAGES & DIFFERENTIATION

### vs. NotebookLM (Google's AI Note-Taking Tool)

| Aspect | Al-Dalil | NotebookLM |
|--------|----------|-----------|
| **Language** | Arabic-native | English-first, translation-heavy |
| **Synthesis** | Cross-document synthesis with contradiction handling | More conversational, less analysis-focused |
| **Evidence** | Explicit source attribution + confidence levels | Less emphasis on evidence tracing |
| **Research Use Case** | Specialized for researchers/academics | General knowledge worker |
| **Contradiction Handling** | Core feature: explains disagreements | Not a primary focus |
| **Pricing** | Freemium model | Part of Google ecosystem (may be free) |

### Key Competitive Moats
1. **Arabic excellence:** Native, not translated
2. **Evidence synthesis:** Contradiction handling is explicit, systematic
3. **Researcher-focused:** Built for literature review, not general chat
4. **Transparency:** Sources always visible, confidence embedded
5. **Solo founder advantage:** Can iterate fast, make opinionated decisions

---

## SECTION 12: CRITICAL SUCCESS FACTORS & RISKS

### Success Factors
- **Product-market fit with researchers:** Get 5 beta users who love it
- **Prompt engineering quality:** System prompt must excel at Arabic synthesis
- **RAG reliability:** Must retrieve correct documents consistently
- **Performance:** Chat response time < 3 seconds
- **UX simplicity:** No learning curve for researchers

### Key Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| **RAG failure:** Retrieves wrong documents | Test extensively with multi-document queries; monitor retrieval accuracy |
| **Prompt drift:** Responses become less rigorous | Version control prompts; A/B test changes; collect user feedback |
| **Scale issues:** System breaks at 50+ docs | Test with large document collections; optimize vector search queries |
| **Arabic quality:** Responses don't feel native | Test with native Arabic speakers; iterate on system prompt |
| **Team bandwidth:** 1 person can't handle support + bugs | Automate what you can; set expectations (beta only); collect feedback systematically |

---

## SECTION 13: NEXT STEPS (FOR SONNET 5 REVIEW)

**This specification is submitted for comprehensive architectural review.**

**Please provide:**

1. **Architectural Weaknesses:** What's unsound? Where will this break?
2. **RAG Pipeline Improvements:** Better approach to multi-document synthesis?
3. **Prompt Engineering:** Strengthen the Arabic system prompt (v0.2)
4. **Scope Validation:** What to cut? What's risky? Is 4 weeks realistic?
5. **Competitive Differentiation:** What am I missing vs. competitors?
6. **Solo Founder Gotchas:** What will hurt me in week 3?
7. **Version 0.2 Recommendation:** Provide specific changes to each section, prioritized by impact
8. **Improved System Prompt:** Create a stronger v0.2 prompt for Gemini API

---

## METADATA

| Field | Value |
|-------|-------|
| **Product Name** | الدليل (Al-Dalil) |
| **Document Version** | 0.1 (For Architectural Review) |
| **Founder** | Solo (1 person, PhD Linguistics, 3 previous products) |
| **Timeline** | 4 weeks to MVP launch |
| **Budget** | $200/month |
| **Target Users** | Researchers, educators, graduate students |
| **Core MVP Use Case** | Upload 5-50 documents → chat with them synthetically → export summaries |
| **Languages** | Arabic-native interface; supports Arabic/English/French input |
| **Key Differentiator** | Evidence-first synthesis with contradiction handling across multiple sources |
| **Tech Stack** | Next.js, Supabase, Google Gemini API, Vercel |
| **Submitted For Review** | Sonnet 5 Architectural Critique |

---

**End of Master Specification v0.1**
