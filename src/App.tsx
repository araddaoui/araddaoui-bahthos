import React, { useState, useEffect, useRef } from "react";
import { defaultSources } from "./data/defaultSources";
import { Source, Message, Conversation, Synthesis, GlossaryTerm, ActiveTab, Project, DalilBriefing } from "./types";
import Sidebar from "./components/Sidebar";
import SourcesList from "./components/SourcesList";
import ChatWindow from "./components/ChatWindow";
import SourceViewer from "./components/SourceViewer";
import SynthesisEditor from "./components/SynthesisEditor";
import SynthesisHistory from "./components/SynthesisHistory";
import SettingsView from "./components/SettingsView";
import LandingPage from "./components/LandingPage";
import TermsOfService from "./components/TermsOfService";
import PrivacyPolicy from "./components/PrivacyPolicy";
import { extractFallbackTermsFromText, isTrivialOrCitationTerm, ensureArabicSummary, areTermsEquivalent, cleanAndSanitizeAcademicTerm, spellcheckAndRepairArabicAndEnglishText, buildContextDefinition } from "./utils/termExtractor";
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
} from "./firebase";
import { onAuthStateChanged, User as FirebaseUser, signOut } from "firebase/auth";
import AuthView from "./components/AuthView";

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

  const validTerms = terms.filter((t) => {
    if (!t) return false;
    // Strict isolation: if sources list is supplied, term MUST have a sourceId matching one of current sources
    if (validSourceIds) {
      if (!t.sourceId || !validSourceIds.has(t.sourceId)) {
        return false;
      }
    }
    const sanitized = cleanAndSanitizeAcademicTerm(t.term, t.draft_term, t.verified_term || t.transliteration, t.definition);
    if (!sanitized.isValid) return false;

    if (isTrivialOrCitationTerm(sanitized.term, t.definition)) return false;
    if (isTrivialOrCitationTerm(sanitized.verified_term, t.definition)) return false;
    if (t.definition && (/\b\d{1,4}\s*[-–]\s*\d{1,4}\b/.test(t.definition) || t.definition.includes("جامعة") || t.definition.includes("أنموذجا"))) {
      return false;
    }
    return true;
  });

  // Deduplicate terms globally across all sources and cap to max 3 items per source
  const sourceCounts: Record<string, number> = {};
  const cappedTerms: GlossaryTerm[] = [];
  for (const t of validTerms) {
    const sId = t.sourceId;
    if (!sId || (validSourceIds && !validSourceIds.has(sId))) {
      continue;
    }

    const currentCount = sourceCounts[sId] || 0;
    if (currentCount < 3) {
      const sanitized = cleanAndSanitizeAcademicTerm(t.term, t.draft_term, t.verified_term || t.transliteration, t.definition);
      const eng = sanitized.term;
      const ar = sanitized.verified_term;

      const isDuplicate = cappedTerms.some(
        (ex) =>
          areTermsEquivalent(ex.term, eng) ||
          areTermsEquivalent(ex.verified_term || ex.transliteration, ar) ||
          areTermsEquivalent(ex.term, ar) ||
          areTermsEquivalent(ex.verified_term || ex.transliteration, eng) ||
          eng.trim().toLowerCase() === (ex.term || "").trim().toLowerCase() ||
          ar.trim().toLowerCase() === (ex.verified_term || ex.transliteration || "").trim().toLowerCase()
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
        const fallbacks = extractFallbackTermsFromText(src.content || "", src.id, src.title, cappedTerms);
        for (const fb of fallbacks) {
          if ((sourceCounts[src.id] || 0) < 3) {
            cappedTerms.push(fb);
            sourceCounts[src.id] = (sourceCounts[src.id] || 0) + 1;
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
      const extracted = extractFallbackTermsFromText(textToExtract, source.id, source.title, updatedTerms);
      const toAdd = extracted.filter(
        (t) =>
          !updatedTerms.some(
            (ex) =>
              areTermsEquivalent(ex.term, t.term) ||
              areTermsEquivalent(ex.verified_term || ex.transliteration, t.verified_term || t.transliteration || t.term) ||
              t.term.trim().toLowerCase() === ex.term.trim().toLowerCase() ||
              (t.verified_term || t.transliteration || "").trim().toLowerCase() === (ex.verified_term || ex.transliteration || "").trim().toLowerCase()
          )
      );
      updatedTerms = [...updatedTerms, ...toAdd];
    }
  });

  return cleanAndMigrateGlossary(updatedTerms, sources);
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
      setCurrentUser(user);
      setAuthChecking(false);
    });
    return unsubscribe;
  }, []);

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
          // Sync existing localStorage data on initial login
          const localProjectsStr = localStorage.getItem("bahthos_projects");
          let projectsToMigrate: Project[] = [];
          if (localProjectsStr) {
            try {
              projectsToMigrate = JSON.parse(localProjectsStr);
            } catch (e) {}
          }
          
          if (projectsToMigrate.length === 0) {
            projectsToMigrate = [
              {
                id: "default",
                name: "المشروع التجريبي الأول",
                dateCreated: new Date().toISOString().split("T")[0],
                temperature: 0.2
              }
            ];
          }

          for (const proj of projectsToMigrate) {
            if (isQuotaExceeded()) break;
            await saveUserProject(currentUser.uid, proj);
            if (isQuotaExceeded()) break;
            const savedSources = localStorage.getItem(`bahthos_sources_${proj.id}`);
            const savedMessages = localStorage.getItem(`bahthos_messages_${proj.id}`);
            const savedSyntheses = localStorage.getItem(`bahthos_syntheses_${proj.id}`);
            const savedGlossary = localStorage.getItem(`bahthos_glossary_${proj.id}`);
            
            const localSources = savedSources ? JSON.parse(savedSources) : [];
            const localMessages = savedMessages ? JSON.parse(savedMessages) : [];
            const localSyntheses = savedSyntheses ? JSON.parse(savedSyntheses) : [];
            const localGlossary = savedGlossary ? JSON.parse(savedGlossary) : [];
            
            await saveProjectData(currentUser.uid, proj.id, {
              sources: localSources,
              messages: localMessages,
              syntheses: localSyntheses,
              glossaryTerms: localGlossary
            });
          }
          if (!isQuotaExceeded()) {
            cloudProjects = await loadUserProjects(currentUser.uid);
          }
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

        // Retrieve local backup from localStorage for activeId
        const savedLocalSources = localStorage.getItem(`bahthos_sources_${activeId}`);
        const localSourcesParsed: Source[] = savedLocalSources ? JSON.parse(savedLocalSources) : [];

        // If cloud sources is empty but local storage has uploaded sources, preserve local sources
        const effectiveSources = (cloudSources && cloudSources.length > 0) ? cloudSources : localSourcesParsed;

        // If effectiveSources is empty, glossary and syntheses MUST be empty
        const rawGlossary = cloudSources.length > 0 
          ? cloudGlossary 
          : (localStorage.getItem(`bahthos_glossary_${activeId}`) ? JSON.parse(localStorage.getItem(`bahthos_glossary_${activeId}`)!) : []);
        const effectiveGlossary = effectiveSources.length > 0 ? rawGlossary : [];
        const effectiveSyntheses = effectiveSources.length > 0 ? cloudSyntheses : [];

        if (!isQuotaExceeded() && cloudSources.length === 0 && localSourcesParsed.length > 0) {
          saveProjectData(currentUser.uid, activeId, {
            sources: localSourcesParsed,
            messages: cloudMessages,
            syntheses: effectiveSyntheses,
            glossaryTerms: effectiveGlossary
          }).catch(console.error);
        }

        loadedProjectIdRef.current = activeId;
        setSources(effectiveSources);
        setMessages(cloudMessages);
        setSyntheses(effectiveSyntheses);
        setGlossaryTerms(effectiveGlossary);
        setTemperature(cloudTemp);
        setCurrentProjectId(activeId);

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
      const saved = localStorage.getItem("bahthos_projects");
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
      const saved = localStorage.getItem("bahthos_current_project_id");
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
  }, [currentProjectId]);

  // Save projects on change
  useEffect(() => {
    try {
      localStorage.setItem("bahthos_projects", JSON.stringify(projects));
    } catch (e) {
      console.error(e);
    }
  }, [projects]);

  // Save active project ID on change
  useEffect(() => {
    try {
      localStorage.setItem("bahthos_current_project_id", currentProjectId);
    } catch (e) {
      console.error(e);
    }
  }, [currentProjectId]);

  // Lazily load sources for the current project
  const [sources, setSources] = useState<Source[]>(() => {
    try {
      const activeId = localStorage.getItem("bahthos_current_project_id") || "default";
      const saved = localStorage.getItem(`bahthos_sources_${activeId}`);
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

  const [activeTab, setActiveTab] = useState<ActiveTab>("home");

  // Lazily load messages for the current project
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const activeId = localStorage.getItem("bahthos_current_project_id") || "default";
      const saved = localStorage.getItem(`bahthos_messages_${activeId}`);
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
      const activeId = localStorage.getItem("bahthos_current_project_id") || "default";
      const savedSources = localStorage.getItem(`bahthos_sources_${activeId}`);
      const parsedSources = savedSources ? JSON.parse(savedSources) : [];
      if (!Array.isArray(parsedSources) || parsedSources.length === 0) {
        return [];
      }
      const saved = localStorage.getItem(`bahthos_syntheses_${activeId}`);
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
      const activeId = localStorage.getItem("bahthos_current_project_id") || "default";
      const saved = localStorage.getItem(`bahthos_temperature_${activeId}`);
      if (saved) return parseFloat(saved);
    } catch (e) {
      console.error(e);
    }
    return 0.2;
  });

  // Lazily load Dalil briefing for the current project
  const [dalilBriefing, setDalilBriefing] = useState<DalilBriefing | null>(() => {
    try {
      const activeId = localStorage.getItem("bahthos_current_project_id") || "default";
      const saved = localStorage.getItem(`bahthos_dalil_${activeId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === "object" && parsed.id) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return null;
  });

  const [dalilCountdown, setDalilCountdown] = useState<number | null>(null);
  const [isDalilGenerating, setIsDalilGenerating] = useState(false);
  const dalilTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingNewSourceIdsRef = useRef<Set<string>>(new Set());

  // Lazily load glossary terms for the current project
  const [glossaryTerms, setGlossaryTerms] = useState<GlossaryTerm[]>(() => {
    try {
      const activeId = localStorage.getItem("bahthos_current_project_id") || "default";
      const savedSources = localStorage.getItem(`bahthos_sources_${activeId}`);
      const parsedSources = savedSources ? JSON.parse(savedSources) : [];
      if (!Array.isArray(parsedSources) || parsedSources.length === 0) {
        return [];
      }
      const saved = localStorage.getItem(`bahthos_glossary_${activeId}`);
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
  }, [sources]);

  useEffect(() => {
    const runSweep = async () => {
      const toSweep = glossaryTerms.filter((t) => !t.verified_term);
      if (toSweep.length === 0 || isSweeping) return;

      setIsSweeping(true);
      try {
        console.log(`Retroactive sweep started for ${toSweep.length} glossary terms...`);
        const response = await fetch("/api/sweep-glossary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ terms: toSweep }),
        });
        if (response.ok) {
          const data = await response.json();
          if (data.terms && Array.isArray(data.terms)) {
            let corrections = 0;
            const updatedTerms = glossaryTerms.map((orig) => {
              const matched = data.terms.find((t: any) => t.term.toLowerCase() === orig.term.toLowerCase());
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

            setSweepCorrectionCount(corrections);
            setGlossaryTerms(updatedTerms);
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
        setDalilBriefing(cloudDalil && cloudDalil.length > 0 ? cloudDalil[cloudDalil.length - 1] : null);
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
        localStorage.setItem(`bahthos_sources_${currentProjectId}`, JSON.stringify(sources));
        localStorage.setItem(`bahthos_messages_${currentProjectId}`, JSON.stringify(messages));
        localStorage.setItem(`bahthos_syntheses_${currentProjectId}`, JSON.stringify(syntheses));
        localStorage.setItem(`bahthos_glossary_${currentProjectId}`, JSON.stringify(glossaryTerms));
        if (dalilBriefing) {
          localStorage.setItem(`bahthos_dalil_${currentProjectId}`, JSON.stringify(dalilBriefing));
        } else {
          localStorage.removeItem(`bahthos_dalil_${currentProjectId}`);
        }
        localStorage.setItem(`bahthos_temperature_${currentProjectId}`, temperature.toString());
      } catch (e) {
        console.error("Failed to save state during switch:", e);
      }
    }

    // 2. Load the new project's state
    try {
      const savedSources = localStorage.getItem(`bahthos_sources_${newProjectId}`);
      const savedMessages = localStorage.getItem(`bahthos_messages_${newProjectId}`);
      const savedSyntheses = localStorage.getItem(`bahthos_syntheses_${newProjectId}`);
      const savedGlossary = localStorage.getItem(`bahthos_glossary_${newProjectId}`);
      const savedDalil = localStorage.getItem(`bahthos_dalil_${newProjectId}`);
      const savedTemp = localStorage.getItem(`bahthos_temperature_${newProjectId}`);

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
      setDalilBriefing(loadedDalil);
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

    // 5. Delete from Firestore asynchronously if user is logged in
    if (currentUser && !isQuotaExceeded()) {
      try {
        await deleteUserProject(currentUser.uid, projectId);
      } catch (err) {
        console.error("Failed to delete project from Firestore:", err);
      }
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
          const savedSources = localStorage.getItem(`bahthos_sources_${nextActiveProject.id}`);
          const savedMessages = localStorage.getItem(`bahthos_messages_${nextActiveProject.id}`);
          const savedSyntheses = localStorage.getItem(`bahthos_syntheses_${nextActiveProject.id}`);
          const savedGlossary = localStorage.getItem(`bahthos_glossary_${nextActiveProject.id}`);
          const savedTemp = localStorage.getItem(`bahthos_temperature_${nextActiveProject.id}`);

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
    if (currentProjectId !== loadedProjectIdRef.current) return;
    try {
      localStorage.setItem(`bahthos_sources_${currentProjectId}`, JSON.stringify(sources));
    } catch (e) {
      console.error("Failed to save sources to localStorage", e);
    }
  }, [sources, currentProjectId]);

  // Save messages to localStorage on change
  useEffect(() => {
    if (currentProjectId !== loadedProjectIdRef.current) return;
    try {
      localStorage.setItem(`bahthos_messages_${currentProjectId}`, JSON.stringify(messages));
    } catch (e) {
      console.error("Failed to save messages to localStorage", e);
    }
  }, [messages, currentProjectId]);

  // Save syntheses to localStorage on change
  useEffect(() => {
    if (currentProjectId !== loadedProjectIdRef.current) return;
    try {
      localStorage.setItem(`bahthos_syntheses_${currentProjectId}`, JSON.stringify(syntheses));
    } catch (e) {
      console.error("Failed to save syntheses to localStorage", e);
    }
  }, [syntheses, currentProjectId]);

  // Save temperature to localStorage on change
  useEffect(() => {
    if (currentProjectId !== loadedProjectIdRef.current) return;
    try {
      localStorage.setItem(`bahthos_temperature_${currentProjectId}`, temperature.toString());
    } catch (e) {
      console.error(e);
    }
  }, [temperature, currentProjectId]);

  // Save glossary to localStorage on change
  useEffect(() => {
    if (currentProjectId !== loadedProjectIdRef.current) return;
    try {
      localStorage.setItem(`bahthos_glossary_${currentProjectId}`, JSON.stringify(glossaryTerms));
    } catch (e) {
      console.error("Failed to save glossary to localStorage", e);
    }
  }, [glossaryTerms, currentProjectId]);

  // Save dalilBriefing to localStorage on change
  useEffect(() => {
    if (currentProjectId !== loadedProjectIdRef.current) return;
    try {
      if (dalilBriefing) {
        localStorage.setItem(`bahthos_dalil_${currentProjectId}`, JSON.stringify(dalilBriefing));
      } else {
        localStorage.removeItem(`bahthos_dalil_${currentProjectId}`);
      }
    } catch (e) {
      console.error("Failed to save dalilBriefing to localStorage", e);
    }
  }, [dalilBriefing, currentProjectId]);

  // Save sources, messages, syntheses, glossary terms, and dalilBriefings to Firebase Firestore when they change (debounced)
  useEffect(() => {
    if (!currentUser || isFirebaseLoading || isQuotaExceeded()) return;
    if (currentProjectId !== loadedProjectIdRef.current) return;
    if (isProjectDeleted(currentProjectId)) return;

    const timer = setTimeout(() => {
      saveProjectData(currentUser.uid, currentProjectId, {
        sources,
        messages,
        syntheses,
        glossaryTerms,
        dalilBriefings: dalilBriefing ? [dalilBriefing] : []
      }).catch((err) => console.error("Failed to sync project data to Firestore:", err));

      const currentProjectObj = projects.find((p) => p.id === currentProjectId);
      if (currentProjectObj) {
        saveUserProject(currentUser.uid, {
          ...currentProjectObj,
          temperature
        }).catch((err) => console.error("Failed to sync project config to Firestore:", err));
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [sources, messages, syntheses, glossaryTerms, dalilBriefing, temperature, currentUser, currentProjectId, isFirebaseLoading]);

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
        localStorage.removeItem(`bahthos_sources_${p.id}`);
        localStorage.removeItem(`bahthos_messages_${p.id}`);
        localStorage.removeItem(`bahthos_syntheses_${p.id}`);
        localStorage.removeItem(`bahthos_glossary_${p.id}`);
        localStorage.removeItem(`bahthos_temperature_${p.id}`);
        localStorage.removeItem(`tawlif_sources_${p.id}`);
        localStorage.removeItem(`tawlif_messages_${p.id}`);
        localStorage.removeItem(`tawlif_syntheses_${p.id}`);
        localStorage.removeItem(`tawlif_glossary_${p.id}`);
        localStorage.removeItem(`tawlif_temperature_${p.id}`);
      });
      localStorage.removeItem("bahthos_projects");
      localStorage.removeItem("bahthos_current_project_id");
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
      setSelectedSourceId(null);
      setActiveMainView("chat");
      setActiveTab("home");
    } catch (err) {
      console.error("Failed to sign out:", err);
    }
  };

  // Passive background extraction of technical/academic terms
  const extractGlossaryTerms = async (text: string, sourceId?: string) => {
    if (!text || text.trim().length < 10) return;
    let extractedCount = 0;
    try {
      const response = await fetch("/api/extract-glossary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, existingTerms: glossaryTerms }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.terms && Array.isArray(data.terms) && data.terms.length > 0) {
          addGlossaryTermsDirectly(data.terms, sourceId);
          extractedCount = data.terms.length;
        }
      }
    } catch (e) {
      console.warn("Passive glossary extraction API failed:", e);
    }

    // Always run local fallback extractor if server API returned 0 terms
    if (extractedCount === 0) {
      const fallbackTerms = extractFallbackTermsFromText(text, sourceId, undefined, glossaryTerms);
      if (fallbackTerms.length > 0) {
        addGlossaryTermsDirectly(fallbackTerms, sourceId);
      }
    }
  };

  // Add pre-extracted terms directly to the glossary
  const addGlossaryTermsDirectly = (terms: any[], targetSourceId?: string) => {
    if (!terms || !Array.isArray(terms) || terms.length === 0) return;

    const resolvedSourceId = targetSourceId || sources?.[0]?.id || "default-source";
    if (!resolvedSourceId) return;

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

      const filteredNew = normalizedNewTerms.filter(
        (t) =>
          !prev.some(
            (ex) =>
              areTermsEquivalent(ex.term, t.term) ||
              areTermsEquivalent(ex.verified_term || ex.transliteration, t.verified_term || t.transliteration || t.term) ||
              t.term.trim().toLowerCase() === ex.term.trim().toLowerCase() ||
              (t.verified_term || t.transliteration || "").trim().toLowerCase() === (ex.verified_term || ex.transliteration || "").trim().toLowerCase()
          )
      );

      if (filteredNew.length > 0) {
        return cleanAndMigrateGlossary([...prev, ...filteredNew], sources);
      }
      return cleanAndMigrateGlossary(prev, sources);
    });
  };

  // Ensure every uploaded source automatically has an Arabic summary and 2 to 3 concepts
  useEffect(() => {
    if (sources.length === 0) {
      setGlossaryTerms([]);
      return;
    }

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
  }, [sources]);

  // Guard ref to track whether initial briefing was triggered for the active sources
  const dalilAttemptedRef = useRef<boolean>(false);

  // Auto-trigger Al-Dalil initial briefing if active project has sources but briefing is not generated yet
  useEffect(() => {
    if (sources.length > 0 && !dalilBriefing && !isDalilGenerating && !dalilAttemptedRef.current) {
      dalilAttemptedRef.current = true;
      triggerDalilUpdateBriefing(sources, true);
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

  const triggerDalilUpdateBriefing = async (currentSourcesList: Source[], force = false) => {
    if (!force && pendingNewSourceIdsRef.current.size === 0 && currentSourcesList.length === 0) return;
    const newIds = Array.from(pendingNewSourceIdsRef.current);
    pendingNewSourceIdsRef.current.clear();
    setIsDalilGenerating(true);

    let briefingText = "";

    try {
      const res = await fetch("/api/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sources: currentSourcesList,
          toolType: "dalil-update",
          newSourceIds: newIds,
          priorBriefingText: dalilBriefing?.text ?? null
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data && !data.silent && data.text && data.text.trim().length > 5) {
          briefingText = data.text.trim();
        }
      }
    } catch (err) {
      console.error("Failed to generate al-Dalil update briefing:", err);
    } finally {
      // Fallback briefing if API failed or returned empty text
      if (!briefingText && currentSourcesList.length > 0) {
        const titles = currentSourcesList.map((s) => s.title || "مستند").join("، ");
        briefingText = `أهلاً بك في نظام بحث OS. || يتضمن مشروعك البحثي حالياً ${currentSourcesList.length} من المصادر المرفقة: ${titles}. || أظهر التحليل الأولي وجود تقاطعات ومفاهيم بحثية هامة تستدعي التوليف والمقارنة. || يمكنك استخدام أدوات محرر التوليف أدناه لاستخراج مصفوفة الأدلة، تقرير الفجوات، والتوصيات الموثقة.`;
      }

      if (briefingText) {
        const newBriefing: DalilBriefing = {
          id: "dalil-" + Date.now(),
          text: briefingText,
          sourceIdsAtTime: currentSourcesList.map((s) => s.id),
          dateCreated: new Date().toISOString()
        };
        setDalilBriefing(newBriefing);
      }

      setIsDalilGenerating(false);
    }
  };

  // Add custom source text with optional summary and pre-extracted terms
  const handleAddSource = (
    title: string,
    content: string,
    language: "ar" | "en" | "fr",
    summary?: string,
    error?: string,
    terms?: any[]
  ) => {
    // Basic word count logic
    const wordCount = content ? content.trim().split(/\s+/).filter(Boolean).length : 0;
    
    const newSrc: Source = {
      id: "source-" + Date.now(),
      title,
      content,
      dateAdded: new Date().toISOString().split("T")[0],
      wordCount,
      enabled: !error,
      language,
      ...(error || summary ? { summary: error || summary } : {}),
      ...(error ? { error } : {}),
    };

    const nextSources = [...sources, newSrc];
    setSources(nextSources);

    // Save immediately to localStorage
    try {
      localStorage.setItem(`bahthos_sources_${currentProjectId}`, JSON.stringify(nextSources));
    } catch (e) {
      console.error("Failed to save sources to localStorage:", e);
    }

    // Save immediately to Firestore
    if (currentUser && currentProjectId && !isQuotaExceeded()) {
      saveProjectData(currentUser.uid, currentProjectId, { sources: nextSources, glossaryTerms }).catch(console.error);
    }

    if (!error) {
      setSelectedSourceId(newSrc.id);
      setActiveMainView("source");

      // Register new source for al-Dalil update briefing and trigger briefing immediately
      pendingNewSourceIdsRef.current.add(newSrc.id);

      if (dalilTimerRef.current) {
        clearInterval(dalilTimerRef.current);
        dalilTimerRef.current = null;
      }
      setDalilCountdown(null);

      // Trigger briefing generation immediately right after document upload
      triggerDalilUpdateBriefing(nextSources, true);
      
      // If terms were returned in the same payload, add them directly
      if (terms && terms.length > 0) {
        addGlossaryTermsDirectly(terms, newSrc.id);
      } else {
        // Passively extract terms if not already provided
        extractGlossaryTerms(content.substring(0, 4000), newSrc.id);
      }
    }
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

  if (authChecking) {
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

  if (isFirebaseLoading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#fafaf8] space-y-4" dir="rtl" id="firebase-loading-loader">
        <Loader2 className="w-10 h-10 text-[#0d6264] animate-spin" />
        <span className="text-xs text-gray-500 font-bold">جاري جلب ومزامنة مساحة العمل السحابية الآمنة...</span>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-[#fafaf8] text-[#1f1f1f] font-sans antialiased" dir="rtl" id="bahthos-root-container">
      {/* 1. RIGHT COLUMN (Narrow Sidebar Navigation) */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={(tab) => {
          setActiveTab(tab);
          // If switching tab to other things, close source reading view unless on sources tab
          if (tab !== "sources" && tab !== "home") {
            setSelectedSourceId(null);
            setActiveMainView("chat");
          }
        }} 
        activeSourcesCount={sources.filter((s) => s.enabled).length}
        projects={projects}
        currentProjectId={currentProjectId}
        onSwitchProject={handleSwitchProject}
        onCreateProject={handleCreateProject}
        onDeleteProject={handleDeleteProject}
        onShowLandingPage={() => setShowLandingPage(true)}
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
            onTriggerDalilBriefing={() => triggerDalilUpdateBriefing(sources, true)}
          />
        </div>

        {/* 3. MAIN COLUMN (Content Area) */}
        <main className={`flex-1 h-full overflow-hidden relative ${
          activeTab === "sources" && selectedSourceId === null ? "hidden md:flex" : "flex"
        }`}>
          {/* Render content based on selected tab and reading state */}
          {activeTab === "home" && (
            activeMainView === "chat" || !activeSelectedSource ? (
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
                onTriggerDalilBriefing={() => triggerDalilUpdateBriefing(sources, true)}
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
            )
          )}

          {activeTab === "sources" && (
            activeSelectedSource ? (
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
              /* Fallback if on sources tab but no source selected */
              <div className="h-full w-full flex flex-col items-center justify-center text-center p-8 text-gray-400 max-w-md mx-auto space-y-4">
                <BookOpen className="w-16 h-16 text-gray-200" />
                <div className="space-y-1.5">
                  <h2 className="text-base font-bold text-[#1f1f1f]">استكشاف المستندات البحثية</h2>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    الرجاء الضغط على أحد المستندات في القائمة لقراءة محتواه بالكامل، أو إضافة وثيقة جديدة في الأسفل.
                  </p>
                </div>
              </div>
            )
          )}

          {activeTab === "editor" && (
            <SynthesisEditor
              sources={sources}
              onSaveSynthesis={handleSaveSynthesis}
              dalilBriefing={dalilBriefing}
              dalilCountdown={dalilCountdown}
              isDalilGenerating={isDalilGenerating}
              onTriggerDalilBriefing={() => triggerDalilUpdateBriefing(sources, true)}
            />
          )}

          {activeTab === "history" && (
            <SynthesisHistory
              syntheses={syntheses}
              sources={sources}
              onDeleteSynthesis={handleDeleteSynthesis}
            />
          )}

          {activeTab === "settings" && (
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
          )}
        </main>
      </div>
    </div>
  );
}
