import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { defaultSources } from "./data/defaultSources.js";
import { Source, SourceDraft, Message, Conversation, Synthesis, GlossaryTerm, ActiveTab, Project, DalilBriefing } from "./types.js";
import Sidebar from "./components/Sidebar.js";
import SourcesList from "./components/SourcesList.js";
import ChatWindow from "./components/ChatWindow.js";
const loadSourceViewer = () => import("./components/SourceViewer.js");
const loadSynthesisEditor = () => import("./components/SynthesisEditor.js");
const loadSynthesisHistory = () => import("./components/SynthesisHistory.js");
const loadSettingsView = () => import("./components/SettingsView.js");

const SourceViewer = lazy(loadSourceViewer);
const synthesisEditorModule = loadSynthesisEditor();
const SynthesisEditor = lazy(() => synthesisEditorModule);
const SynthesisHistory = lazy(loadSynthesisHistory);
const SettingsView = lazy(loadSettingsView);
import LandingPage from "./components/LandingPage.js";
import TermsOfService from "./components/TermsOfService.js";
import PrivacyPolicy from "./components/PrivacyPolicy.js";
import { extractFallbackTermsFromText, isTrivialOrCitationTerm, ensureArabicSummary, sanitizeSourceSummary, areTermsEquivalent, cleanAndSanitizeAcademicTerm, spellcheckAndRepairArabicAndEnglishText, buildContextDefinition } from "./utils/termExtractor.js";
import { BookOpen, Sparkles, MessageSquare, AlertCircle, Loader2 } from "lucide-react";
import { 
  auth, 
  loadUserProjects, 
  saveUserProject, 
  deleteUserProject, 
  saveProjectData, 
  loadProjectData,
  markProjectAsDeleted,
  isProjectDeleted,
  clearDeletedProjectsRegistry,
  isQuotaExceeded
} from "./firebase.js";
import { onAuthStateChanged, User as FirebaseUser, signOut } from "firebase/auth";
import AuthView from "./components/AuthView.js";

const GUEST_STORAGE_PREFIX = "bahthos:guest:";

function guestStorageKey(name: string, projectId?: string): string {
  return `${GUEST_STORAGE_PREFIX}${name}${projectId ? `:${projectId}` : ""}`;
}

function WorkspaceViewFallback() {
  const [showIndicator, setShowIndicator] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setShowIndicator(true), 180);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="h-full w-full flex items-center justify-center bg-[#fafaf8]" aria-label="جاري تحميل مساحة العمل">
      <div className={`flex items-center rounded-xl border border-[#d9e7e1] bg-white p-3 text-[#094d4e] shadow-sm transition-opacity duration-150 ${showIndicator ? "opacity-100" : "opacity-0"}`}>
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      </div>
    </div>
  );
}

function purgeLegacySharedStorage(): void {
  if (typeof window === "undefined") return;
  try {
    const legacyPrefixes = ["bahthos_", "tawlif_", "al_dalil_"];
    const keep = new Set(["bahthos_entered_app", "bahthos_firestore_quota_exceeded"]);
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && legacyPrefixes.some((prefix) => key.startsWith(prefix)) && !keep.has(key)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch (error) {
    console.warn("Unable to purge legacy shared project storage", error);
  }
}

purgeLegacySharedStorage();

export function computeSourceFingerprint(sources: Source[]): string {
  let hash = 2166136261;
  const snapshot = JSON.stringify((sources || []).map((source) => ({
    id: source.id,
    title: source.title,
    content: source.content,
    summary: source.summary || "",
    language: source.language,
  })));
  for (let index = 0; index < snapshot.length; index += 1) {
    hash ^= snapshot.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${sources.length}:${(hash >>> 0).toString(16)}`;
}

export function isBriefingCurrent(briefing: DalilBriefing | null, sources: Source[]): boolean {
  if (!briefing || !Array.isArray(sources) || sources.length === 0) return false;
  const currentIds = sources.map((source) => source.id);
  const briefingIds = Array.isArray(briefing.sourceIdsAtTime) ? briefing.sourceIdsAtTime : [];
  if (briefingIds.length !== currentIds.length || briefingIds.some((id) => !currentIds.includes(id))) {
    return false;
  }
  return Boolean(briefing.sourceFingerprint) && briefing.sourceFingerprint === computeSourceFingerprint(sources);
}

function briefingMatchesSourceIds(briefing: DalilBriefing | null, sources: Source[]): boolean {
  if (!briefing || !Array.isArray(sources) || sources.length === 0) return false;
  const currentIds = new Set(sources.map((source) => source.id));
  const briefingIds = Array.isArray(briefing.sourceIdsAtTime) ? briefing.sourceIdsAtTime : [];
  return briefingIds.length === sources.length && briefingIds.every((id) => currentIds.has(id));
}

// Default glossary terms to populate on first load (empty by default)
const initialGlossary: GlossaryTerm[] = [];

// Pre-baked high-quality academic synthesis report
const initialSyntheses: Synthesis[] = [];

// Helper to clean phonetic transliterations of academic/technical terms to real Arabic equivalents
export function cleanAndMigrateGlossary(terms: GlossaryTerm[], sources?: Source[]): GlossaryTerm[] {
  if (!terms || !Array.isArray(terms)) terms = [];

  // If sources array is provided and empty, return [] immediately to prevent lingering contamination
  if (sources && Array.isArray(sources) && sources.length === 0) return [];

  const validSourceIds = sources && sources.length > 0 ? new Set(sources.map((s) => s.id)) : null;

  const fallbackSourceId = sources && sources.length > 0 ? sources[0].id : undefined;

  const validTerms = terms.filter((t) => {
    if (!t) return false;
    const sanitized = cleanAndSanitizeAcademicTerm(t.term, t.draft_term, t.verified_term || t.transliteration, t.definition);
    if (!sanitized.isValid) return false;

    if (isTrivialOrCitationTerm(sanitized.term, t.definition)) return false;
    if (isTrivialOrCitationTerm(sanitized.verified_term, t.definition)) return false;
    if (t.definition && (/\b\d{1,4}\s*[-–]\s*\d{1,4}\b/.test(t.definition) || t.definition.includes("جامعة") || t.definition.includes("أنموذجا"))) {
      return false;
    }
    return true;
  });

  // Deduplicate terms across sources and cap to max 6 items per source
  const sourceCounts: Record<string, number> = {};
  const cappedTerms: GlossaryTerm[] = [];
  for (const t of validTerms) {
    let sId = t.sourceId;
    if (!sId || (validSourceIds && !validSourceIds.has(sId))) {
      sId = fallbackSourceId;
    }
    if (!sId) continue;

    const currentCount = sourceCounts[sId] || 0;
    if (currentCount < 6) {
      const sanitized = cleanAndSanitizeAcademicTerm(t.term, t.draft_term, t.verified_term || t.transliteration, t.definition);
      const eng = sanitized.term;
      const ar = sanitized.verified_term;

      // Scope duplicate checks per source so new sources can introduce their own concepts freely
      const isDuplicate = cappedTerms.some(
        (ex) =>
          ex.sourceId === sId &&
          (areTermsEquivalent(ex.term, eng) ||
           areTermsEquivalent(ex.verified_term || ex.transliteration, ar) ||
           eng.trim().toLowerCase() === (ex.term || "").trim().toLowerCase() ||
           ar.trim().toLowerCase() === (ex.verified_term || ex.transliteration || "").trim().toLowerCase())
      );
      if (!isDuplicate) {
        sourceCounts[sId] = currentCount + 1;
        const cleanDef = (t.definition &&
          !t.definition.includes('""') &&
          !t.definition.includes(':\s*""') &&
          !t.definition.includes("مفهوم تحليلي يُقصد به في النص: \"\"") &&
          t.definition.length > 25)
          ? spellcheckAndRepairArabicAndEnglishText(t.definition)
          : buildContextDefinition(eng, "", ar);

        cappedTerms.push({
          ...t,
          sourceId: sId,
          term: eng,
          draft_term: sanitized.draft_term,
          verified_term: ar,
          transliteration: ar,
          definition: cleanDef,
        });
      }
    }
  }

  // Backfill genuine concepts for any active source that has fewer than 2 terms
  if (sources && Array.isArray(sources)) {
    for (const src of sources) {
      const count = sourceCounts[src.id] || 0;
      if (count < 2) {
        const fallbacks = extractFallbackTermsFromText(src.content || "", src.id, src.title);
        for (const fb of fallbacks) {
          if ((sourceCounts[src.id] || 0) < 6) {
            // Check for duplicates only within this specific source's list in cappedTerms
            const isDuplicateForSource = cappedTerms.some(
              (ex) => ex.sourceId === src.id && areTermsEquivalent(ex.term, fb.term)
            );
            if (!isDuplicateForSource) {
              cappedTerms.push({ ...fb, sourceId: src.id });
              sourceCounts[src.id] = (sourceCounts[src.id] || 0) + 1;
            }
          }
        }
      }
    }
  }

  return cappedTerms;
}

// Helper to ensure EVERY source in sources has between 2 and 3 concepts
export function ensureEverySourceHasTerms(sources: Source[], currentTerms: GlossaryTerm[]): GlossaryTerm[] {
  if (!sources || sources.length === 0) return [];

  let updatedTerms = cleanAndMigrateGlossary(currentTerms || [], sources);

  sources.forEach((source) => {
    const existingForSource = updatedTerms.filter((t) => t.sourceId === source.id);
    if (existingForSource.length < 2) {
      const textToExtract = source.content || source.title || "مستند بحثي";
      const extracted = extractFallbackTermsFromText(textToExtract, source.id, source.title);
      const toAdd = extracted.filter(
        (t) =>
          !updatedTerms.some(
            (ex) =>
              ex.sourceId === source.id && (
                areTermsEquivalent(ex.term, t.term) ||
                areTermsEquivalent(ex.verified_term || ex.transliteration, t.verified_term || t.transliteration || t.term)
              )
          )
      );
      updatedTerms = [...updatedTerms, ...toAdd];
    }
  });

  return cleanAndMigrateGlossary(updatedTerms, sources);
}

export const VOCALIZED_BASELINE_TEXT = `لَمْ تُوَلَّدْ بَعْدُ إِحَاطَةٌ مُحَدَّثَةٌ لِمَصَادِرِ المَشْرُوعِ الحَالِيِّ. || سَيَسْتَنِدُ التَّحْلِيلُ القَادِمُ إِلَى المَصَادِرِ المَرْفُوعَةِ فِي هَذَا المَشْرُوعِ فَقَطْ، دُونَ اِسْتِعَارَةِ مَعْلُومَاتٍ مِنْ مَشْرُوعٍ سَابِقٍ.`;

export function sanitizeDalilBriefing(briefing: DalilBriefing | null, sourcesCount: number): DalilBriefing | null {
  if (!briefing || !briefing.text) return null;
  const harakatCount = (briefing.text.match(/[\u064B-\u0652]/g) || []).length;
  if (harakatCount < 15 || briefing.text.includes(".pdf") || briefing.text.includes("أهلاً بك في نظام بحث")) {
    const text = sourcesCount > 0
      ? `تَجْرِي الآنَ إِعَادَةُ تَوْلِيدِ الإِحَاطَةِ بِالِاعْتِمَادِ عَلَى ${sourcesCount} مَصَادِرَ حَالِيَّةٍ فَقَطْ.`
      : VOCALIZED_BASELINE_TEXT;
    return {
      ...briefing,
      text
    };
  }
  return briefing;
}

export default function App() {
  const [showLandingPage, setShowLandingPage] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("bahthos_entered_app");
      return saved ? false : true;
    } catch (e) {
      return true;
    }
  });

  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [authChecking, setAuthChecking] = useState<boolean>(true);
  const [useAsGuest, setUseAsGuest] = useState<boolean>(false);
  const [isFirebaseLoading, setIsFirebaseLoading] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) setIsFirebaseLoading(true);
      setCurrentUser(user);
      setAuthChecking(false);
    });
    // Fast non-blocking timeout (100ms) to guarantee zero UI latency on refresh
    const timer = setTimeout(() => {
      setAuthChecking(false);
    }, 100);
    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (currentUser) {
      loadedProjectIdRef.current = "__loading_authenticated_project__";
      setProjects([]);
      setCurrentProjectId("default");
      setSources([]);
      setMessages([]);
      setSyntheses([]);
      setGlossaryTerms([]);
      setDalilBriefing(null);
      setIsFirebaseLoading(true);
    }
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!currentUser) return;

    const syncAndLoadFirebaseData = async () => {
      setIsFirebaseLoading(true);
      if (isQuotaExceeded()) {
        setIsFirebaseLoading(false);
        return;
      }
      try {
        let cloudProjects = await loadUserProjects(currentUser.uid);
        
        if (!isQuotaExceeded() && cloudProjects.length === 0) {
          const defaultProject: Project = {
            id: "default",
            name: "المشروع التجريبي الأول",
            dateCreated: new Date().toISOString().split("T")[0],
            temperature: 0.2,
          };
          await saveUserProject(currentUser.uid, defaultProject);
          cloudProjects = [defaultProject];
        }

        if (cloudProjects.length > 0) {
          setProjects(cloudProjects);
        }

        let activeId = currentProjectId;
        if (cloudProjects.length > 0 && !cloudProjects.some(p => p.id === activeId)) {
          activeId = cloudProjects[0]?.id || "default";
        }

        const { sources: cloudSources, messages: cloudMessages, syntheses: cloudSyntheses, glossaryTerms: cloudGlossary } = 
          isQuotaExceeded() 
            ? { sources: [], messages: [], syntheses: [], glossaryTerms: [] } 
            : await loadProjectData(currentUser.uid, activeId);

        const activeProjObj = cloudProjects.find(p => p.id === activeId);
        const cloudTemp = activeProjObj?.temperature ?? 0.2;

        // Authenticated users read only from their own Firestore subtree.
        // Guest localStorage is deliberately never used as an account fallback.
        const effectiveSources = cloudSources || [];
        const effectiveGlossary = effectiveSources.length > 0 ? cloudGlossary : [];
        const effectiveSyntheses = effectiveSources.length > 0 ? cloudSyntheses : [];

        loadedProjectIdRef.current = activeId;
        setSources((prev) => (JSON.stringify(prev) === JSON.stringify(effectiveSources) ? prev : effectiveSources));
        setMessages((prev) => (JSON.stringify(prev) === JSON.stringify(cloudMessages) ? prev : cloudMessages));
        setSyntheses((prev) => (JSON.stringify(prev) === JSON.stringify(effectiveSyntheses) ? prev : effectiveSyntheses));
        const isolatedGlossary = cleanAndMigrateGlossary(effectiveGlossary, effectiveSources);
        setGlossaryTerms((prev) => (JSON.stringify(prev) === JSON.stringify(isolatedGlossary) ? prev : isolatedGlossary));
        setTemperature((prev) => (prev === cloudTemp ? prev : cloudTemp));
        setCurrentProjectId((prev) => (prev === activeId ? prev : activeId));

      } catch (err) {
        console.error("Failed to load Firebase data:", err);
      } finally {
        setIsFirebaseLoading(false);
      }
    };

    syncAndLoadFirebaseData();
  }, [currentUser]);

  const [currentPath, setCurrentPath] = useState<string>(() => {
    try {
      return window.location.pathname;
    } catch (e) {
      return "/";
    }
  });

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  const navigateTo = (path: string) => {
    try {
      window.history.pushState({}, "", path);
      setCurrentPath(path);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setCurrentPath(path);
    }
  };

  // Projects list
  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const saved = localStorage.getItem(guestStorageKey("projects"));
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const valid = parsed.filter((p: Project) => p && p.id && !isProjectDeleted(p.id));
          if (valid.length > 0) return valid;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return [
      {
        id: "default",
        name: "المشروع التجريبي الأول",
        dateCreated: "2026-07-09",
      }
    ];
  });

  // Active project ID
  const [currentProjectId, setCurrentProjectId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(guestStorageKey("current_project_id"));
      if (saved) return saved;
    } catch (e) {
      console.error(e);
    }
    return "default";
  });

  // Prevent race conditions when state updates during project switches
  const loadedProjectIdRef = useRef<string>(currentProjectId);

  // Sync active project ID to the ref
  useEffect(() => {
    loadedProjectIdRef.current = currentProjectId;
  }, [currentProjectId, currentUser]);

  // Save projects on change
  useEffect(() => {
    if (currentUser) return;
    try {
      localStorage.setItem(guestStorageKey("projects"), JSON.stringify(projects));
    } catch (e) {
      console.error(e);
    }
  }, [projects, currentUser]);

  // Save active project ID on change
  useEffect(() => {
    if (currentUser) return;
    try {
      localStorage.setItem(guestStorageKey("current_project_id"), currentProjectId);
    } catch (e) {
      console.error(e);
    }
  }, [currentProjectId, currentUser]);

  // Lazily load sources for the current project
  const [sources, setSources] = useState<Source[]>(() => {
    try {
      const activeId = localStorage.getItem(guestStorageKey("current_project_id")) || "default";
      const saved = localStorage.getItem(guestStorageKey("sources", activeId));
      let rawSources: Source[] = [];
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) rawSources = parsed;
      }
      return rawSources.map(s => ({
        ...s,
        summary: ensureArabicSummary(s.summary, s.content, s.title)
      }));
    } catch (e) {
      console.error(e);
      return [];
    }
  });

  // Live refs prevent asynchronous uploads, glossary requests, and project switches
  // from writing results into a stale project or overwriting a newer source list.
  const activeProjectIdRef = useRef<string>(currentProjectId);
  const latestSourcesRef = useRef<Source[]>([]);
  const sourceIdSequenceRef = useRef(0);

  const [activeTab, setActiveTab] = useState<ActiveTab>("home");
  // Paint the sidebar selection first, then hand the heavy view to React on the
  // next animation frame. Unlike useDeferredValue, this cannot remain stale for
  // seconds when the editor or source list is expensive to mount.
  const [editorWarm, setEditorWarm] = useState(false);
  useEffect(() => {
    const warmEditor = () => setEditorWarm(true);
    let cancelWarmEditor: () => void;
    const requestIdle = (window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
    }).requestIdleCallback;
    if (typeof requestIdle === "function") {
      const idleId = requestIdle(warmEditor, { timeout: 1800 });
      cancelWarmEditor = () => window.cancelIdleCallback(idleId);
    } else {
      const timeoutId = window.setTimeout(warmEditor, 900);
      cancelWarmEditor = () => window.clearTimeout(timeoutId);
    }
    return cancelWarmEditor;
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSourceViewer();
      void loadSynthesisHistory();
      void loadSettingsView();
    }, 1200);
    return () => window.clearTimeout(timer);
  }, []);
  // Lazily load messages for the current project
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const activeId = localStorage.getItem(guestStorageKey("current_project_id")) || "default";
      const saved = localStorage.getItem(guestStorageKey("messages", activeId));
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  const [isThinking, setIsThinking] = useState(false);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [activeMainView, setActiveMainView] = useState<"chat" | "source">("chat");

  // Lazily load syntheses for the current project
  const [syntheses, setSyntheses] = useState<Synthesis[]>(() => {
    try {
      const activeId = localStorage.getItem(guestStorageKey("current_project_id")) || "default";
      const savedSources = localStorage.getItem(guestStorageKey("sources", activeId));
      const parsedSources = savedSources ? JSON.parse(savedSources) : [];
      if (!Array.isArray(parsedSources) || parsedSources.length === 0) {
        return [];
      }
      const saved = localStorage.getItem(guestStorageKey("syntheses", activeId));
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  // Lazily load temperature for the current project
  const [temperature, setTemperature] = useState(() => {
    try {
      const activeId = localStorage.getItem(guestStorageKey("current_project_id")) || "default";
      const saved = localStorage.getItem(guestStorageKey("temperature", activeId));
      if (saved) return parseFloat(saved);
    } catch (e) {
      console.error(e);
    }
    return 0.2;
  });

  // Lazily load Dalil briefing for the current project
  const [dalilBriefing, setDalilBriefing] = useState<DalilBriefing | null>(() => {
    try {
      const activeId = localStorage.getItem(guestStorageKey("current_project_id")) || "default";
      const saved = localStorage.getItem(guestStorageKey("dalil", activeId));
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === "object" && parsed.id) {
          return parsed as DalilBriefing;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return null;
  });

  // Track only lightweight source identity metadata in render-critical effects.
  // The previous effects depended on the whole sources array and repeatedly
  // serialized full document contents, which could freeze the browser.
  const sourceIdentityKey = useMemo(
    () => sources.map((source) => `${source.id}:${source.summary?.length || 0}`).join("|"),
    [sources]
  );

  useEffect(() => {
    if (!briefingMatchesSourceIds(dalilBriefing, sources)) {
      if (dalilBriefing !== null) setDalilBriefing(null);
    }
  }, [sourceIdentityKey, currentProjectId, dalilBriefing?.id]);

  // Normalize summaries only after the source collection changes; navigation
  // state must never schedule a full-document normalization pass.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSources((previousSources) => {
        let changed = false;
        const normalizedSources = previousSources.map((source) => {
          const normalizedSummary = sanitizeSourceSummary(source.summary, source.title, source.content);
          if (normalizedSummary !== source.summary) {
            changed = true;
            return { ...source, summary: normalizedSummary };
          }
          return source;
        });
        return changed ? normalizedSources : previousSources;
      });
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [sourceIdentityKey]);

  const [dalilCountdown, setDalilCountdown] = useState<number | null>(null);
  const [isDalilGenerating, setIsDalilGenerating] = useState(false);
  const [dalilError, setDalilError] = useState<string | null>(null);
  const dalilTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingNewSourceIdsRef = useRef<Set<string>>(new Set());

  // Lazily load glossary terms for the current project
  const [glossaryTerms, setGlossaryTerms] = useState<GlossaryTerm[]>(() => {
    try {
      const activeId = localStorage.getItem(guestStorageKey("current_project_id")) || "default";
      const savedSources = localStorage.getItem(guestStorageKey("sources", activeId));
      const parsedSources = savedSources ? JSON.parse(savedSources) : [];
      if (!Array.isArray(parsedSources) || parsedSources.length === 0) {
        return [];
      }
      const saved = localStorage.getItem(guestStorageKey("glossary", activeId));
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return cleanAndMigrateGlossary(parsed, parsedSources);
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  const [isSweeping, setIsSweeping] = useState(false);
  const [sweepCorrectionCount, setSweepCorrectionCount] = useState<number | null>(null);
  const latestGlossaryTermsRef = useRef<GlossaryTerm[]>([]);

  useEffect(() => {
    activeProjectIdRef.current = currentProjectId;
    latestSourcesRef.current = sources;
    latestGlossaryTermsRef.current = glossaryTerms;
  }, [currentProjectId, sourceIdentityKey, glossaryTerms]);

  useEffect(() => {
    if (sources.length === 0) {
      if (glossaryTerms.length > 0) setGlossaryTerms([]);
      if (syntheses.length > 0) setSyntheses([]);
    } else {
      setGlossaryTerms((prev) => {
        const cleaned = cleanAndMigrateGlossary(prev, sources);
        return cleaned.length !== prev.length ? cleaned : prev;
      });
    }
  }, [sourceIdentityKey]);

  useEffect(() => {
    const runSweep = async () => {
      const projectIdAtStart = activeProjectIdRef.current;
      const termsAtStart = latestGlossaryTermsRef.current;
      const toSweep = termsAtStart.filter((t) => !t.verified_term);
      if (toSweep.length === 0 || isSweeping) return;

      setIsSweeping(true);
      try {
        console.log(`Retroactive sweep started for ${toSweep.length} glossary terms...`);
        const response = await fetch("/api/sweep-glossary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ terms: toSweep }),
        });
        if (response.ok && activeProjectIdRef.current === projectIdAtStart) {
          const data = await response.json();
          if (data.terms && Array.isArray(data.terms)) {
            let corrections = 0;
            const updatedTerms = termsAtStart.map((orig) => {
              const matched = data.terms.find((t: any) =>
                t.term && orig.term && t.term.toLowerCase() === orig.term.toLowerCase()
              );
              if (matched) {
                if (matched.draft_term !== matched.verified_term) {
                  corrections++;
                }
                return {
                  ...orig,
                  draft_term: matched.draft_term,
                  verified_term: matched.verified_term,
                  transliteration: matched.verified_term,
                  definition: matched.definition,
                };
              }
              return {
                ...orig,
                draft_term: orig.transliteration,
                verified_term: orig.transliteration,
              };
            });

            const currentSources = latestSourcesRef.current;
            const isolatedTerms = cleanAndMigrateGlossary(updatedTerms, currentSources);
            setSweepCorrectionCount(corrections);
            setGlossaryTerms(isolatedTerms);
            console.log(`Retroactive sweep completed. ${corrections} terms corrected.`);
          }
        }
      } catch (e) {
        console.warn("Failed to sweep glossary terms retroactively:", e);
      } finally {
          setIsSweeping(false);
      }
    };

    const timer = setTimeout(() => {
      runSweep();
    }, 1500);

    return () => clearTimeout(timer);
  }, [glossaryTerms, isSweeping]);

  // Project Switch, Create, and Delete handlers
  const handleSwitchProject = async (newProjectId: string) => {
    if (newProjectId === currentProjectId) return;

    // Establish a hard source/context boundary before any asynchronous load.
    // The old briefing must not remain visible while the next project is fetched.
    setDalilBriefing(null);
    pendingNewSourceIdsRef.current.clear();
    dalilAttemptedRef.current = true;
    latestSourcesRef.current = [];
    latestGlossaryTermsRef.current = [];
    setSources([]);
    setMessages([]);
    setSyntheses([]);
    setGlossaryTerms([]);

    if (currentUser && !isQuotaExceeded()) {
      setIsFirebaseLoading(true);
      try {
        // 1. Save current state of the old project to Firestore first if old project still exists in projects
        if (currentProjectId && projects.some((p) => p.id === currentProjectId)) {
          await saveProjectData(currentUser.uid, currentProjectId, {
            sources,
            messages,
            syntheses,
            glossaryTerms,
            dalilBriefings: dalilBriefing ? [dalilBriefing] : []
          });
        }

        // 2. Load the new project's state from Firestore
        const { sources: cloudSources, messages: cloudMessages, syntheses: cloudSyntheses, glossaryTerms: cloudGlossary, dalilBriefings: cloudDalil } = 
          await loadProjectData(currentUser.uid, newProjectId);

        const newProjObj = projects.find((p) => p.id === newProjectId);
        const cloudTemp = newProjObj?.temperature ?? 0.2;

        loadedProjectIdRef.current = newProjectId;
        setSources(cloudSources);
        setMessages(cloudMessages);
        setSyntheses(cloudSyntheses);
        setGlossaryTerms(cleanAndMigrateGlossary(cloudGlossary, cloudSources));
        const cloudBriefing = cloudDalil && cloudDalil.length > 0 ? cloudDalil[cloudDalil.length - 1] : null;
        setDalilBriefing(isBriefingCurrent(cloudBriefing, cloudSources) ? cloudBriefing : null);
        setTemperature(cloudTemp);
        setCurrentProjectId(newProjectId);

        setSelectedSourceId(null);
        setActiveMainView("chat");
      } catch (e) {
        console.error("Failed to switch project on Firestore:", e);
      } finally {
        setIsFirebaseLoading(false);
      }
      return;
    }

    // 1. Save current state of the old project to its specific keys if it still exists
    if (currentProjectId && projects.some((p) => p.id === currentProjectId)) {
      try {
        localStorage.setItem(guestStorageKey("sources", currentProjectId), JSON.stringify(sources));
        localStorage.setItem(guestStorageKey("messages", currentProjectId), JSON.stringify(messages));
        localStorage.setItem(guestStorageKey("syntheses", currentProjectId), JSON.stringify(syntheses));
        localStorage.setItem(guestStorageKey("glossary", currentProjectId), JSON.stringify(glossaryTerms));
        if (dalilBriefing) {
          localStorage.setItem(guestStorageKey("dalil", currentProjectId), JSON.stringify(dalilBriefing));
        } else {
          localStorage.removeItem(guestStorageKey("dalil", currentProjectId));
        }
        localStorage.setItem(guestStorageKey("temperature", currentProjectId), temperature.toString());
      } catch (e) {
        console.error("Failed to save state during switch:", e);
      }
    }

    // 2. Load the new project's state
    try {
      const savedSources = localStorage.getItem(guestStorageKey("sources", newProjectId));
      const savedMessages = localStorage.getItem(guestStorageKey("messages", newProjectId));
      const savedSyntheses = localStorage.getItem(guestStorageKey("syntheses", newProjectId));
      const savedGlossary = localStorage.getItem(guestStorageKey("glossary", newProjectId));
      const savedDalil = localStorage.getItem(guestStorageKey("dalil", newProjectId));
      const savedTemp = localStorage.getItem(guestStorageKey("temperature", newProjectId));

      const loadedSources = savedSources ? JSON.parse(savedSources) : [];
      const loadedMessages = savedMessages ? JSON.parse(savedMessages) : [];
      const loadedSyntheses = savedSyntheses ? JSON.parse(savedSyntheses) : [];
      const loadedGlossary = savedGlossary ? JSON.parse(savedGlossary) : [];
      const loadedDalil = savedDalil ? JSON.parse(savedDalil) : null;
      const loadedTemp = savedTemp ? parseFloat(savedTemp) : 0.2;

      // 3. Update the ref immediately to block reactive saving of old values during render
      loadedProjectIdRef.current = newProjectId;

      // 4. Update the state
      setSources(loadedSources);
      setMessages(loadedMessages);
      setSyntheses(loadedSyntheses);
      setGlossaryTerms(cleanAndMigrateGlossary(loadedGlossary, loadedSources));
      setDalilBriefing(isBriefingCurrent(loadedDalil, loadedSources) ? loadedDalil : null);
      setTemperature(loadedTemp);
      
      // 5. Update current project ID
      setCurrentProjectId(newProjectId);
      
      // Close reading view if open
      setSelectedSourceId(null);
      setActiveMainView("chat");
    } catch (e) {
      console.error("Failed to switch project:", e);
    }
  };

  const handleCreateProject = async (name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    const newProj: Project = {
      id: "proj-" + Date.now(),
      name: trimmedName,
      dateCreated: new Date().toISOString().split("T")[0],
      temperature: 0.2
    };

    if (currentUser && !isQuotaExceeded()) {
      try {
        await saveUserProject(currentUser.uid, newProj);
      } catch (err) {
        console.error("Failed to save new project to Firestore:", err);
      }
    }

    setProjects((prev) => [...prev, newProj]);
    handleSwitchProject(newProj.id);
  };

  const handleDeleteProject = async (projectId: string) => {
    const targetProject = projects.find((p) => p.id === projectId);
    if (!targetProject) return;

    // 1. Immediately mark project ID as deleted globally to block all race-condition auto-saves
    markProjectAsDeleted(projectId);
    if (projectId === currentProjectId) {
      setDalilBriefing(null);
      pendingNewSourceIdsRef.current.clear();
      dalilAttemptedRef.current = true;
      latestSourcesRef.current = [];
      latestGlossaryTermsRef.current = [];
    }

    // 2. Filter project out of state immediately
    const updatedProjects = projects.filter((p) => p.id !== projectId);

    // 3. Persist updated projects list to localStorage right away
    try {
      localStorage.setItem("bahthos_projects", JSON.stringify(updatedProjects));
    } catch (e) {
      console.error(e);
    }

    // 4. Remove all localStorage keys belonging to this deleted project
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes(projectId) || key.endsWith(`_${projectId}`))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch (e) {
      console.error(e);
    }

    // 5. Delete from Firestore in the background (non-blocking) if user is logged in
    if (currentUser && !isQuotaExceeded()) {
      deleteUserProject(currentUser.uid, projectId).catch((err) => {
        console.error("Failed to delete project from Firestore:", err);
      });
    }

    // 6. Handle UI and state transition cleanly
    if (updatedProjects.length === 0) {
      const newProj: Project = {
        id: "proj-" + Date.now(),
        name: "المشروع التجريبي الأول",
        dateCreated: new Date().toISOString().split("T")[0],
        temperature: 0.2
      };

      setProjects([newProj]);
      setCurrentProjectId(newProj.id);
      loadedProjectIdRef.current = newProj.id;
      setSources([]);
      setMessages([]);
      setSyntheses([]);
      setGlossaryTerms([]);
      setDalilBriefing(null);
      pendingNewSourceIdsRef.current.clear();
      dalilAttemptedRef.current = false;
      latestSourcesRef.current = [];
      latestGlossaryTermsRef.current = [];
      setSelectedSourceId(null);

      try {
        localStorage.setItem("bahthos_projects", JSON.stringify([newProj]));
        localStorage.setItem("bahthos_current_project_id", newProj.id);
      } catch (e) {}

      if (currentUser && !isQuotaExceeded()) {
        await saveUserProject(currentUser.uid, newProj);
        await saveProjectData(currentUser.uid, newProj.id, {
          sources: [],
          messages: [],
          syntheses: [],
          glossaryTerms: []
        });
      }
    } else {
      setProjects(updatedProjects);

      if (currentProjectId === projectId) {
        // Active project WAS deleted; switch to next project
        const nextActiveProject = updatedProjects[0];
        setCurrentProjectId(nextActiveProject.id);
        loadedProjectIdRef.current = nextActiveProject.id;

        try {
          localStorage.setItem("bahthos_current_project_id", nextActiveProject.id);
        } catch (e) {}

        if (currentUser && !isQuotaExceeded()) {
          setIsFirebaseLoading(true);
          try {
            const { sources: cloudSources, messages: cloudMessages, syntheses: cloudSyntheses, glossaryTerms: cloudGlossary } = 
              await loadProjectData(currentUser.uid, nextActiveProject.id);

            setSources(cloudSources);
            setMessages(cloudMessages);
            setSyntheses(cloudSyntheses);
            setGlossaryTerms(cleanAndMigrateGlossary(cloudGlossary, cloudSources));
            setTemperature(nextActiveProject.temperature ?? 0.2);
            setSelectedSourceId(null);
            setActiveMainView("chat");
          } catch (e) {
            console.error("Failed to load next project from Firestore:", e);
          } finally {
            setIsFirebaseLoading(false);
          }
        } else {
          const savedSources = localStorage.getItem(guestStorageKey("sources", nextActiveProject.id));
          const savedMessages = localStorage.getItem(guestStorageKey("messages", nextActiveProject.id));
          const savedSyntheses = localStorage.getItem(guestStorageKey("syntheses", nextActiveProject.id));
          const savedGlossary = localStorage.getItem(guestStorageKey("glossary", nextActiveProject.id));
          const savedTemp = localStorage.getItem(guestStorageKey("temperature", nextActiveProject.id));

          const nextSources = savedSources ? JSON.parse(savedSources) : [];
          const nextMessages = savedMessages ? JSON.parse(savedMessages) : [];
          const nextSyntheses = savedSyntheses ? JSON.parse(savedSyntheses) : [];
          const nextGlossary = savedGlossary ? JSON.parse(savedGlossary) : [];

          setSources(nextSources);
          setMessages(nextMessages);
          setSyntheses(nextSyntheses);
          setGlossaryTerms(cleanAndMigrateGlossary(nextGlossary, nextSources));
          setTemperature(savedTemp ? parseFloat(savedTemp) : 0.2);
          setSelectedSourceId(null);
          setActiveMainView("chat");
        }
      } else {
        // Deleted non-active project: keep loadedProjectIdRef intact for current project
        loadedProjectIdRef.current = currentProjectId;
      }
    }
  };

  // Save sources to localStorage on change
  useEffect(() => {
    if (currentUser || currentProjectId !== loadedProjectIdRef.current) return;
    try {
      localStorage.setItem(guestStorageKey("sources", currentProjectId), JSON.stringify(sources));
    } catch (e) {
      console.error("Failed to save sources to localStorage", e);
    }
  }, [sources, currentProjectId, currentUser]);

  // Save messages to localStorage on change
  useEffect(() => {
    if (currentUser || currentProjectId !== loadedProjectIdRef.current) return;
    try {
      localStorage.setItem(guestStorageKey("messages", currentProjectId), JSON.stringify(messages));
    } catch (e) {
      console.error("Failed to save messages to localStorage", e);
    }
  }, [messages, currentProjectId, currentUser]);

  // Save syntheses to localStorage on change
  useEffect(() => {
    if (currentUser || currentProjectId !== loadedProjectIdRef.current) return;
    try {
      localStorage.setItem(guestStorageKey("syntheses", currentProjectId), JSON.stringify(syntheses));
    } catch (e) {
      console.error("Failed to save syntheses to localStorage", e);
    }
  }, [syntheses, currentProjectId, currentUser]);

  // Save temperature to localStorage on change
  useEffect(() => {
    if (currentUser || currentProjectId !== loadedProjectIdRef.current) return;
    try {
      localStorage.setItem(guestStorageKey("temperature", currentProjectId), temperature.toString());
    } catch (e) {
      console.error(e);
    }
  }, [temperature, currentProjectId, currentUser]);

  // Save glossary to localStorage on change
  useEffect(() => {
    if (currentUser || currentProjectId !== loadedProjectIdRef.current) return;
    try {
      localStorage.setItem(guestStorageKey("glossary", currentProjectId), JSON.stringify(glossaryTerms));
    } catch (e) {
      console.error("Failed to save glossary to localStorage", e);
    }
  }, [glossaryTerms, currentProjectId, currentUser]);

  // Save dalilBriefing to localStorage on change
  useEffect(() => {
    if (currentUser || currentProjectId !== loadedProjectIdRef.current) return;
    try {
      if (dalilBriefing && briefingMatchesSourceIds(dalilBriefing, sources)) {
        localStorage.setItem(guestStorageKey("dalil", currentProjectId), JSON.stringify(dalilBriefing));
      } else {
        localStorage.removeItem(guestStorageKey("dalil", currentProjectId));
      }
    } catch (e) {
      console.error("Failed to save dalilBriefing to localStorage", e);
    }
  }, [dalilBriefing, currentProjectId, currentUser, sourceIdentityKey]);

  // Save sources and glossary terms immediately (critical data)
  useEffect(() => {
    if (!currentUser || isFirebaseLoading || isQuotaExceeded()) return;
    if (currentProjectId !== loadedProjectIdRef.current) return;
    if (isProjectDeleted(currentProjectId)) return;

    // Sources and glossary are critical; save immediately to prevent loss on refresh
    saveProjectData(currentUser.uid, currentProjectId, {
      sources,
      glossaryTerms,
      syntheses, // include syntheses here too as they are small
      dalilBriefings: dalilBriefing ? [dalilBriefing] : []
    }).catch((err) => console.error("Failed to sync critical project data to Firestore:", err));
  }, [sources, glossaryTerms, syntheses, dalilBriefing, currentUser, currentProjectId, isFirebaseLoading]);

  // Save messages (larger payload) with debounce
  useEffect(() => {
    if (!currentUser || isFirebaseLoading || isQuotaExceeded()) return;
    if (currentProjectId !== loadedProjectIdRef.current) return;
    if (isProjectDeleted(currentProjectId)) return;

    const timer = setTimeout(() => {
      saveProjectData(currentUser.uid, currentProjectId, {
        messages,
      }).catch((err) => console.error("Failed to sync messages to Firestore:", err));

      const currentProjectObj = projects.find((p) => p.id === currentProjectId);
      if (currentProjectObj) {
        saveUserProject(currentUser.uid, {
          ...currentProjectObj,
          temperature
        }).catch((err) => console.error("Failed to sync project config to Firestore:", err));
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [messages, temperature, currentUser, currentProjectId, isFirebaseLoading]);

  const handleResetWorkspace = async () => {
    clearDeletedProjectsRegistry();
    if (currentUser && !isQuotaExceeded()) {
      setIsFirebaseLoading(true);
      try {
        for (const proj of projects) {
          await deleteUserProject(currentUser.uid, proj.id);
        }
        
        const defaultProj: Project = {
          id: "default",
          name: "المشروع التجريبي الأول",
          dateCreated: new Date().toISOString().split("T")[0],
          temperature: 0.2
        };
        await saveUserProject(currentUser.uid, defaultProj);
        await saveProjectData(currentUser.uid, "default", {
          sources: [],
          messages: [],
          syntheses: [],
          glossaryTerms: initialGlossary
        });
      } catch (err) {
        console.error("Failed to reset Firestore workspace:", err);
      } finally {
        setIsFirebaseLoading(false);
      }
    }

    try {
      // Clear all project localStorage keys
      projects.forEach((p) => {
        localStorage.removeItem(guestStorageKey("sources", p.id));
        localStorage.removeItem(guestStorageKey("messages", p.id));
        localStorage.removeItem(guestStorageKey("syntheses", p.id));
        localStorage.removeItem(guestStorageKey("glossary", p.id));
        localStorage.removeItem(guestStorageKey("temperature", p.id));
        localStorage.removeItem(`tawlif_sources_${p.id}`);
        localStorage.removeItem(`tawlif_messages_${p.id}`);
        localStorage.removeItem(`tawlif_syntheses_${p.id}`);
        localStorage.removeItem(`tawlif_glossary_${p.id}`);
        localStorage.removeItem(`tawlif_temperature_${p.id}`);
      });
      localStorage.removeItem(guestStorageKey("projects"));
      localStorage.removeItem(guestStorageKey("current_project_id"));
      localStorage.removeItem("tawlif_projects");
      localStorage.removeItem("tawlif_current_project_id");

      // Robust prefix-based clearing to eliminate any lingering/legacy key leaking
      const prefixes = ["bahthos_", "tawlif_", "al_dalil_"];
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && prefixes.some((prefix) => key.startsWith(prefix))) {
          if (key.endsWith("_entered_app")) {
            continue; // Keep the user's landing page entry state
          }
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key));
    } catch (e) {
      console.error(e);
    }

    // Set ref immediately to allow state saving for "default"
    loadedProjectIdRef.current = "default";

    setProjects([
      {
        id: "default",
        name: "المشروع التجريبي الأول",
        dateCreated: new Date().toISOString().split("T")[0],
      }
    ]);
    setCurrentProjectId("default");
    setSources([]);
    setMessages([]);
      setSyntheses(initialSyntheses);
      setTemperature(0.2);
      setGlossaryTerms(initialGlossary);
      setDalilBriefing(null);
      pendingNewSourceIdsRef.current.clear();
      dalilAttemptedRef.current = false;
      setSelectedSourceId(null);
    setActiveMainView("chat");
    setActiveTab("home");
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setUseAsGuest(false);
      // Clear state and revert to defaults
      setProjects([
        {
          id: "default",
          name: "المشروع التجريبي الأول",
          dateCreated: new Date().toISOString().split("T")[0],
        }
      ]);
      setCurrentProjectId("default");
      setSources([]);
      setMessages([]);
      setSyntheses(initialSyntheses);
      setTemperature(0.2);
      setGlossaryTerms(initialGlossary);
      setDalilBriefing(null);
      pendingNewSourceIdsRef.current.clear();
      dalilAttemptedRef.current = false;
      setSelectedSourceId(null);
      setActiveMainView("chat");
      setActiveTab("home");
    } catch (err) {
      console.error("Failed to sign out:", err);
    }
  };

  // Passive background extraction of technical/academic terms
  const extractGlossaryTerms = async (text: string, sourceId?: string) => {
    if (!text || text.trim().length < 10 || !sourceId) return;
    const requestProjectId = activeProjectIdRef.current;
    const existingTerms = latestGlossaryTermsRef.current;
    let extractedCount = 0;

    try {
      const response = await fetch("/api/extract-glossary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, sourceId, existingTerms }),
      });
      if (response.ok && activeProjectIdRef.current === requestProjectId) {
        const data = await response.json();
        if (data.terms && Array.isArray(data.terms) && data.terms.length > 0) {
          addGlossaryTermsDirectly(data.terms, sourceId);
          extractedCount = data.terms.length;
        }
      }
    } catch (e) {
      console.warn("Passive glossary extraction API failed:", e);
    }

    // Always run local fallback extractor if server API returned 0 terms.
    if (extractedCount === 0 && activeProjectIdRef.current === requestProjectId) {
      const fallbackTerms = extractFallbackTermsFromText(
        text,
        sourceId,
        undefined
      );
      if (fallbackTerms.length > 0) {
        addGlossaryTermsDirectly(fallbackTerms, sourceId);
      }
    }
  };

  // Add pre-extracted terms directly to the glossary
  const addGlossaryTermsDirectly = (terms: any[], targetSourceId?: string) => {
    if (!terms || !Array.isArray(terms) || terms.length === 0) return;

    const resolvedSourceId = targetSourceId;
    const activeSourceIds = new Set(latestSourcesRef.current.map((source) => source.id));
    // Never attach a term to an arbitrary first source or a synthetic default ID.
    // Every generated concept must belong to a currently active source.
    if (!resolvedSourceId || !activeSourceIds.has(resolvedSourceId)) return;

    setGlossaryTerms((prev) => {
      const normalizedNewTerms = terms
        .filter((t: any) => {
          if (!t) return false;
          const mainTerm = t.term || t.transliteration || t.verified_term || t.draft_term || "";
          const verified = t.verified_term || t.draft_term || t.transliteration || "";
          if (!mainTerm) return false;
          if (isTrivialOrCitationTerm(mainTerm, t.definition)) return false;
          if (isTrivialOrCitationTerm(verified, t.definition)) return false;
          return true;
        })
        .map((t: any) => ({
          term: t.term || t.transliteration || t.verified_term || t.draft_term,
          transliteration: t.transliteration || t.verified_term || t.draft_term || t.term,
          definition: t.definition,
          draft_term: t.draft_term || t.transliteration || t.term,
          verified_term: t.verified_term || t.transliteration || t.draft_term || t.term,
          sourceId: resolvedSourceId
        }));

      // Scoped duplicate check: only suppress duplicates if they belong to the SAME source.
      // This ensures that different sources can contribute their own terminology independently.
      const filteredNew = normalizedNewTerms.filter(
        (t) =>
          !prev.some(
            (ex) =>
              ex.sourceId === t.sourceId && (
                areTermsEquivalent(ex.term, t.term) ||
                areTermsEquivalent(ex.verified_term || ex.transliteration, t.verified_term || t.transliteration || t.term)
              )
          )
      );

      if (filteredNew.length > 0) {
        return cleanAndMigrateGlossary([...prev, ...filteredNew], latestSourcesRef.current);
      }
      return cleanAndMigrateGlossary(prev, latestSourcesRef.current);
    });
  };

  // Ensure every uploaded source automatically has an Arabic summary and 2 to 3 concepts.
  // This work is scheduled only after the source collection changes, never after a menu click.
  useEffect(() => {
    if (sources.length === 0) {
      setGlossaryTerms([]);
      return;
    }

    const timer = window.setTimeout(() => {
      let sourcesNeedsUpdate = false;
      const sanitizedSources = sources.map((s) => {
        const cleanSummary = ensureArabicSummary(s.summary, s.title, s.content);
        if (cleanSummary !== s.summary) {
          sourcesNeedsUpdate = true;
          return { ...s, summary: cleanSummary };
        }
        return s;
      });

      if (sourcesNeedsUpdate) {
        setSources(sanitizedSources);
      }

      setGlossaryTerms((prev) => ensureEverySourceHasTerms(sanitizedSources, prev));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [sourceIdentityKey]);

  // Guard ref to track whether initial briefing was triggered for the active sources
  const dalilAttemptedRef = useRef<boolean>(false);

  // Auto-trigger Al-Dalil initial briefing if active project has sources but briefing is not generated yet
  useEffect(() => {
    const briefingText = dalilBriefing?.text || "";
    const hasMetaOpening = /تتناول هذه الإحاطة|تركز المقارنة|من الناحية المنهجية|تكشف المقارنة الأولية|تُقرأ هذه المجموعة|يقتصر هذا الوصف|الموضوع التخصصي لمستند/i.test(briefingText);
    const isKnownSyntheticFallback = /لا يتوفر في الوثيقة|تتجاور في «[^»]+» و«[^»]+» قضيتان|تضيف الأدلة الواردة في/.test(briefingText);
    const paragraphCount = briefingText.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean).length;
    const briefingNeedsDepth = Boolean(
      dalilBriefing && (briefingText.trim().length < 1400 || paragraphCount < 6 || hasMetaOpening || isKnownSyntheticFallback)
    );
    if (sources.length > 0 && (!dalilBriefing || briefingNeedsDepth) && !isDalilGenerating && !dalilAttemptedRef.current) {
      dalilAttemptedRef.current = true;
      void triggerDalilUpdateBriefing(sources, true);
    }
  }, [sources.length, dalilBriefing, isDalilGenerating]);

  // Reset briefing attempted flag when sources list completely changes
  useEffect(() => {
    if (sources.length === 0) {
      dalilAttemptedRef.current = false;
      setDalilBriefing(null);
    }
  }, [sources.length]);

  // Toggle single source checkbox
  const handleToggleSource = (id: string) => {
    setSources((prev) => {
      const updated = prev.map((src) => (src.id === id ? { ...src, enabled: !src.enabled } : src));
      return updated;
    });
  };

  // Enable all sources
  const handleEnableAll = () => {
    setSources((prev) => prev.map((src) => ({ ...src, enabled: true })));
  };

  // Disable all sources
  const handleDisableAll = () => {
    setSources((prev) => prev.map((src) => ({ ...src, enabled: false })));
  };

  const triggerDalilUpdateBriefing = useCallback(async (currentSourcesList: Source[], force = false) => {
    if (!force && pendingNewSourceIdsRef.current.size === 0 && currentSourcesList.length === 0) return;
    const newIds = Array.from(pendingNewSourceIdsRef.current);
    pendingNewSourceIdsRef.current.clear();
    setIsDalilGenerating(true);
    setDalilError(null);

    let briefingText = "";

    try {
      const res = await fetch("/api/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sources: currentSourcesList,
          toolType: "dalil-update",
          newSourceIds: newIds,
        })
      });

      const data = await res.json().catch(() => null);
      if (res.ok && data && !data.silent && data.text && data.text.trim().length > 5) {
        briefingText = data.text.trim();
      } else {
        setDalilError(
          (data && typeof data.error === "string" && data.error.trim())
            ? data.error.trim()
            : "تعذر توليد الإحاطة من المصادر الحالية. تحقق من الاتصال ثم أعد المحاولة."
        );
      }
    } catch (err) {
      console.error("Failed to generate al-Dalil update briefing:", err);
      setDalilError("تعذر الوصول إلى خدمة التوليف. تحقق من الاتصال ثم أعد المحاولة.");
    } finally {
      // Do not replace a failed model response with synthetic prose. Keeping
      // the prior briefing is safer than presenting generic claims as evidence.
      if (!briefingText) {
        console.warn("No model-generated Al-Dalil briefing was returned; preserving the previous briefing.");
      }

      if (briefingText) {
        setDalilError(null);
        const newBriefing: DalilBriefing = {
          id: "dalil-" + Date.now(),
          text: briefingText,
          sourceIdsAtTime: currentSourcesList.map((s) => s.id),
          sourceFingerprint: computeSourceFingerprint(currentSourcesList),
          dateCreated: new Date().toISOString()
        };
        setDalilBriefing(newBriefing);
      }

      setIsDalilGenerating(false);
    }
  }, []);

  const scheduleDalilUpdateBriefing = () => {
    if (dalilTimerRef.current) {
      clearTimeout(dalilTimerRef.current);
    }

    // Debounce the briefing request so a six-file upload produces one synthesis
    // request after the queue completes instead of six concurrent requests.
    setDalilCountdown(1);
    dalilTimerRef.current = setTimeout(() => {
      dalilTimerRef.current = null;
      setDalilCountdown(null);
      void triggerDalilUpdateBriefing(latestSourcesRef.current, true);
    }, 1200);
  };

  const createSourceFromDraft = (draft: SourceDraft, index: number): Source => {
    const wordCount = draft.content ? draft.content.trim().split(/\s+/).filter(Boolean).length : 0;
    return {
      id: `source-${Date.now()}-${sourceIdSequenceRef.current++}-${index}`,
      title: draft.title,
      content: draft.content,
      dateAdded: new Date().toISOString().split("T")[0],
      wordCount,
      enabled: !draft.error,
      language: draft.language,
      ...(draft.error || draft.summary ? { summary: draft.error || draft.summary } : {}),
      ...(draft.error ? { error: draft.error } : {}),
    };
  };

  const commitSourceDrafts = (drafts: SourceDraft[], runMissingTermExtraction = true) => {
    if (!drafts || drafts.length === 0) return;

    const newSources = drafts.map((draft, index) => createSourceFromDraft(draft, index));
    const successfulSources = newSources.filter((source) => !source.error);
    const nextSourcesCandidate = [...latestSourcesRef.current, ...newSources];
    latestSourcesRef.current = nextSourcesCandidate;

    // Commit the complete batch using one functional update. The duplicate-ID
    // guard also makes retries idempotent if a browser event is delivered twice.
    setSources((previousSources) => {
      const existingIds = new Set(previousSources.map((source) => source.id));
      const additions = newSources.filter((source) => !existingIds.has(source.id));
      const nextSources = [...previousSources, ...additions];
      latestSourcesRef.current = nextSources;
      return nextSources;
    });

    if (successfulSources.length === 0) return;

    // A previous briefing describes a previous source set. Remove it before
    // scheduling a fresh synthesis so stale content cannot remain visible.
    setDalilBriefing(null);
    dalilAttemptedRef.current = true;
    successfulSources.forEach((source) => pendingNewSourceIdsRef.current.add(source.id));
    setSelectedSourceId(successfulSources[successfulSources.length - 1].id);
    setActiveMainView("source");
    scheduleDalilUpdateBriefing();

    drafts.forEach((draft, index) => {
      const source = newSources[index];
      // Always attempt to add terms from draft, and always run local extraction 
      // as a reliable fallback to ensure the "min 2 terms" rule is met.
      if (draft.terms && draft.terms.length > 0) {
        addGlossaryTermsDirectly(draft.terms, source.id);
      }
      
      // Force local fallback extraction for every new source to ensure glossary growth
      void extractGlossaryTerms(draft.content.substring(0, 5000), source.id);
    });
  };

  // Add one source through the same atomic commit path used by multi-upload.
  const handleAddSource = (
    title: string,
    content: string,
    language: "ar" | "en" | "fr",
    summary?: string,
    error?: string,
    terms?: any[]
  ) => {
    commitSourceDrafts([{ title, content, language, summary, error, terms }], true);
  };

  const handleAddSources = (drafts: SourceDraft[]) => {
    // Batch analysis already produced fallback terms where possible. Missing
    // terms are backfilled locally by the sources effect, avoiding six extra
    // glossary API requests during one upload operation.
    commitSourceDrafts(drafts, false);
  };

  // Delete research source
  const handleDeleteSource = (id: string) => {
    const nextSources = sources.filter((src) => src.id !== id);
    setSources(nextSources);
    if (selectedSourceId === id) {
      setSelectedSourceId(null);
      setActiveMainView("chat");
    }

    // Filter out terms derived from this source and sanitize against nextSources
    const nextTerms = cleanAndMigrateGlossary(glossaryTerms.filter((t) => t.sourceId !== id), nextSources);

    if (nextSources.length === 0) {
      setGlossaryTerms([]);
      setSyntheses([]);
      setMessages([]);
    } else {
      setGlossaryTerms(nextTerms);
    }

    if (currentUser && currentProjectId && !isQuotaExceeded()) {
      saveProjectData(currentUser.uid, currentProjectId, {
        sources: nextSources,
        glossaryTerms: nextSources.length === 0 ? [] : nextTerms,
        syntheses: nextSources.length === 0 ? [] : syntheses,
        messages: nextSources.length === 0 ? [] : messages
      }).catch(console.error);
    }
  };

  // Delete all research sources completely
  const handleDeleteAllSources = () => {
    setSources([]);
    setGlossaryTerms([]);
    setSyntheses([]);
    setMessages([]);
    setSelectedSourceId(null);
    setActiveMainView("chat");

    if (currentUser && currentProjectId && !isQuotaExceeded()) {
      saveProjectData(currentUser.uid, currentProjectId, {
        sources: [],
        glossaryTerms: [],
        syntheses: [],
        messages: []
      }).catch(console.error);
    }
  };

  // Select source card for reading
  const handleSelectSource = (id: string) => {
    setSelectedSourceId(id);
    setActiveMainView("source");
  };

  // Chat with a single source (disables all other sources temporarily)
  const handleChatWithSingleSource = (id: string) => {
    setSources((prev) =>
      prev.map((src) => ({
        ...src,
        enabled: src.id === id,
      }))
    );
    setActiveTab("home");
    setActiveMainView("chat");
  };

  // Save generated synthesis report to history
  const handleSaveSynthesis = (synthesis: Synthesis) => {
    setSyntheses((prev) => [synthesis, ...prev]);
  };

  // Delete saved synthesis report
  const handleDeleteSynthesis = (id: string) => {
    setSyntheses((prev) => prev.filter((s) => s.id !== id));
  };

  // Send message to Gemini via Express Backend API
  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isThinking) return;

    const userMsg: Message = {
      id: "msg-" + Date.now(),
      role: "user",
      text,
      timestamp: new Date().toLocaleTimeString("ar-SA", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setIsThinking(true);
    setActiveMainView("chat");
    if (activeTab !== "home") {
      setActiveTab("home");
    }

    try {
      // Send ONLY enabled sources as context for the call
      let activeSources = sources.filter((s) => s.enabled);
      
      // If no sources are enabled, let's automatically enable and use ALL of them!
      if (activeSources.length === 0 && sources.length > 0) {
        setSources((prev) => prev.map((src) => ({ ...src, enabled: true })));
        activeSources = sources.map((src) => ({ ...src, enabled: true }));
      }
      
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          sources: activeSources,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok && !data.text) {
        throw new Error(data.error || "عذراً، تعذر الاتصال بالخادم. يرجى المحاولة مرة أخرى.");
      }

      const replyContent = data.text || "المصادر المتاحة لا توفر إجابة كافية عن هذا السؤال.";

      const assistantMsg: Message = {
        id: "msg-" + (Date.now() + 1),
        role: "assistant",
        text: replyContent,
        timestamp: new Date().toLocaleTimeString("ar-SA", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (error: any) {
      console.error(error);
      const errorMsg: Message = {
        id: "msg-err-" + Date.now(),
        role: "assistant",
        text: error.message || "عذراً، حدث خطأ غير متوقع أثناء الاتصال بمساعد بحث OS الذكي. يرجى التحقق من اتصالك بالإنترنت وإعادة إرسال السؤال.",
        timestamp: new Date().toLocaleTimeString("ar-SA", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsThinking(false);
    }
  };

  // Find currently active source
  const activeSelectedSource = sources.find((s) => s.id === selectedSourceId);

  // These hooks must run on every render, including landing, terms, and privacy routes.
  const enabledSourcesCount = useMemo(
    () => sources.reduce((count, source) => count + (source.enabled ? 1 : 0), 0),
    [sources]
  );

  const handleTriggerDalilBriefing = useCallback(() => {
    void triggerDalilUpdateBriefing(sources, true);
  }, [sources, triggerDalilUpdateBriefing]);

  const preloadWorkspaceTab = (tab: ActiveTab) => {
    if (tab === "editor") void loadSynthesisEditor();
    else if (tab === "history") void loadSynthesisHistory();
    else if (tab === "settings") void loadSettingsView();
    else if (tab === "home") void loadSourceViewer();
  };

  const handleWorkspaceTabChange = (tab: ActiveTab) => {
    // The click path performs one urgent state update only. Every destination
    // stays mounted behind a CSS visibility boundary, so this does not mount,
    // unmount, or serialize source-scale data.
    setActiveTab(tab);
  };

  if (currentPath === "/terms") {
    return (
      <TermsOfService
        navigateTo={navigateTo}
        onEnterApp={() => {
          setShowLandingPage(false);
          navigateTo("/");
          try {
            localStorage.setItem("bahthos_entered_app", "true");
          } catch (e) {}
        }}
      />
    );
  }

  if (currentPath === "/privacy") {
    return (
      <PrivacyPolicy
        navigateTo={navigateTo}
        onEnterApp={() => {
          setShowLandingPage(false);
          navigateTo("/");
          try {
            localStorage.setItem("bahthos_entered_app", "true");
          } catch (e) {}
        }}
      />
    );
  }

  if (authChecking || (currentUser && isFirebaseLoading)) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#fafaf8] space-y-4" dir="rtl" id="auth-checking-loader">
        <Loader2 className="w-10 h-10 text-[#0d6264] animate-spin" />
        <span className="text-xs text-gray-500 font-bold">جاري التحقق من حساب الباحث...</span>
      </div>
    );
  }

  if (showLandingPage || (!currentUser && !useAsGuest)) {
    return (
      <LandingPage
        onEnterApp={() => {
          setShowLandingPage(false);
          setUseAsGuest(true);
          try {
            localStorage.setItem("bahthos_entered_app", "true");
          } catch (e) {}
        }}
        onEnterAsUser={() => {
          setShowLandingPage(false);
          try {
            localStorage.setItem("bahthos_entered_app", "true");
          } catch (e) {}
        }}
        onContinueAsGuest={() => {
          setUseAsGuest(true);
          setShowLandingPage(false);
          try {
            localStorage.setItem("bahthos_entered_app", "true");
          } catch (e) {}
        }}
        navigateTo={navigateTo}
        currentUser={currentUser}
        onSignOut={handleSignOut}
      />
    );
  }

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-[#fafaf8] text-[#1f1f1f] font-sans antialiased" dir="rtl" id="bahthos-root-container">
      {/* 1. RIGHT COLUMN (Narrow Sidebar Navigation) */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={handleWorkspaceTabChange}
        activeSourcesCount={enabledSourcesCount}
        projects={projects}
        currentProjectId={currentProjectId}
        onSwitchProject={handleSwitchProject}
        onCreateProject={handleCreateProject}
        onDeleteProject={handleDeleteProject}
        onShowLandingPage={() => setShowLandingPage(true)}
        onNavigateIntent={preloadWorkspaceTab}
      />

      {/* Main Grid Wrapper for responsive layout:
          On Large Screens (>= 1024px): 3 columns (Sidebar + SourcesList + MainContent)
          On Medium Screens (720px - 1024px): 2 columns (Sidebar + MainContent) (Sources tab shows SourcesList)
          On Small Screens (< 720px): Stacks / Toggles
      */}
      <div className="flex-1 flex overflow-hidden h-full">
        
        {/* 2. MIDDLE COLUMN (Research Sources List)
            Visible on desktop always when on Home or Sources tabs.
            On smaller viewports, it's only shown if the user explicitly opens the "sources" tab.
        */}
        <div className={`h-full flex-shrink-0 ${
          activeTab === "sources"
            ? "w-full md:w-80 flex" 
            : "hidden lg:w-80 lg:flex"
        }`}>
          <SourcesList
            sources={sources}
            activeTab={activeTab}
            onToggleSource={handleToggleSource}
            onEnableAll={handleEnableAll}
            onDisableAll={handleDisableAll}
            onAddSource={handleAddSource}
            onAddSources={handleAddSources}
            onDeleteSource={handleDeleteSource}
            onDeleteAllSources={handleDeleteAllSources}
            selectedSourceId={selectedSourceId}
            onSelectSource={handleSelectSource}
            onChatWithSingleSource={handleChatWithSingleSource}
            onAskQuestionFromSearch={handleSendMessage}
            glossaryTerms={glossaryTerms}
            isSweeping={isSweeping}
            sweepCorrectionCount={sweepCorrectionCount}
            dalilBriefing={dalilBriefing}
            dalilCountdown={dalilCountdown}
            isDalilGenerating={isDalilGenerating}
            onTriggerDalilBriefing={handleTriggerDalilBriefing}
          />
        </div>

        {/* 3. MAIN COLUMN (Content Area) */}
        <main className={`flex-1 h-full overflow-hidden relative ${
          activeTab === "sources" && selectedSourceId === null ? "hidden md:flex" : "flex"
        }`}>
          <div className={`absolute inset-0 ${activeTab === "home" ? "" : "hidden"}`} aria-hidden={activeTab !== "home"}>
            <Suspense fallback={<WorkspaceViewFallback />}>
              {activeMainView === "chat" || !activeSelectedSource ? (
                <ChatWindow
                  messages={messages}
                  sources={sources}
                  onSendMessage={handleSendMessage}
                  isThinking={isThinking}
                  onSourceClick={(id) => {
                    setSelectedSourceId(id);
                    setActiveMainView("source");
                  }}
                  onAddSource={handleAddSource}
                  dalilBriefing={dalilBriefing}
                  dalilCountdown={dalilCountdown}
                  isDalilGenerating={isDalilGenerating}
                  onTriggerDalilBriefing={handleTriggerDalilBriefing}
                />
              ) : (
                <SourceViewer
                  source={activeSelectedSource}
                  glossaryTerms={glossaryTerms}
                  onToggleSource={handleToggleSource}
                  onClose={() => setActiveMainView("chat")}
                  onBackToChat={() => setActiveMainView("chat")}
                  onChatWithSingleSource={handleChatWithSingleSource}
                />
              )}
            </Suspense>
          </div>

          <div className={`absolute inset-0 ${activeTab === "sources" ? "" : "hidden"}`} aria-hidden={activeTab !== "sources"}>
            <Suspense fallback={<WorkspaceViewFallback />}>
              {activeSelectedSource ? (
                <SourceViewer
                  source={activeSelectedSource}
                  glossaryTerms={glossaryTerms}
                  onToggleSource={handleToggleSource}
                  onClose={() => setSelectedSourceId(null)}
                  onBackToChat={() => {
                    setActiveTab("home");
                    setActiveMainView("chat");
                  }}
                  onChatWithSingleSource={handleChatWithSingleSource}
                />
              ) : (
                <div className="h-full w-full flex flex-col items-center justify-center text-center p-8 text-gray-400 max-w-md mx-auto space-y-4">
                  <BookOpen className="w-16 h-16 text-gray-200" />
                  <div className="space-y-1.5">
                    <h2 className="text-base font-bold text-[#1f1f1f]">استكشاف المستندات البحثية</h2>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      الرجاء الضغط على أحد المستندات في القائمة لقراءة محتواه بالكامل، أو إضافة وثيقة جديدة في الأسفل.
                    </p>
                  </div>
                </div>
              )}
            </Suspense>
          </div>

          <div className={`absolute inset-0 ${activeTab === "history" ? "" : "hidden"}`} aria-hidden={activeTab !== "history"}>
            <Suspense fallback={<WorkspaceViewFallback />}>
              <SynthesisHistory
                syntheses={syntheses}
                sources={sources}
                onDeleteSynthesis={handleDeleteSynthesis}
              />
            </Suspense>
          </div>

          <div className={`absolute inset-0 ${activeTab === "settings" ? "" : "hidden"}`} aria-hidden={activeTab !== "settings"}>
            <Suspense fallback={<WorkspaceViewFallback />}>
              <SettingsView
                temperature={temperature}
                setTemperature={setTemperature}
                onResetWorkspace={handleResetWorkspace}
                currentUser={currentUser}
                onSignOut={handleSignOut}
                onShowLandingPage={() => {
                  setShowLandingPage(true);
                  try {
                    localStorage.removeItem("bahthos_entered_app");
                    localStorage.removeItem("tawlif_entered_app");
                  } catch (e) {}
                }}
              />
            </Suspense>
          </div>

          {(editorWarm || activeTab === "editor") && (
            <div
              className={`absolute inset-0 z-10 flex bg-[#fafaf8] ${activeTab === "editor" ? "" : "hidden"}`}
              aria-hidden={activeTab !== "editor"}
            >
              <Suspense fallback={<WorkspaceViewFallback />}>
                <SynthesisEditor
                  key={currentProjectId || "guest"}
                  sources={sources}
                  onSaveSynthesis={handleSaveSynthesis}
                  dalilBriefing={dalilBriefing}
                  dalilCountdown={dalilCountdown}
                  isDalilGenerating={isDalilGenerating}
                  dalilError={dalilError}
                  isActive={activeTab === "editor"}
                  onTriggerDalilBriefing={handleTriggerDalilBriefing}
                />
              </Suspense>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
