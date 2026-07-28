import React, { useState, useEffect, useRef } from "react";
import { defaultSources } from "./data/defaultSources";
import { Source, Message, Conversation, Synthesis, GlossaryTerm, ActiveTab, Project } from "./types";
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
import { extractFallbackTermsFromText, isTrivialOrCitationTerm } from "./utils/termExtractor";
import { BookOpen, Sparkles, MessageSquare, AlertCircle, Loader2 } from "lucide-react";
import { 
  auth, 
  loadUserProjects, 
  saveUserProject, 
  deleteUserProject, 
  saveProjectData, 
  loadProjectData 
} from "./firebase";
import { onAuthStateChanged, User as FirebaseUser, signOut } from "firebase/auth";
import AuthView from "./components/AuthView";

// Default glossary terms to populate on first load (empty by default)
const initialGlossary: GlossaryTerm[] = [];

// Pre-baked high-quality academic synthesis report
const initialSyntheses: Synthesis[] = [];

// Helper to clean phonetic transliterations of academic/technical terms to real Arabic equivalents
export function cleanAndMigrateGlossary(terms: GlossaryTerm[]): GlossaryTerm[] {
  if (!terms || !Array.isArray(terms)) return [];

  const validTerms = terms.filter((t) => {
    if (!t) return false;
    const eng = t.term || "";
    const arabic = t.transliteration || t.verified_term || t.draft_term || "";
    if (isTrivialOrCitationTerm(eng, t.definition)) return false;
    if (isTrivialOrCitationTerm(arabic, t.definition)) return false;
    return true;
  });

  // Cap terms to max 3 items per source
  const sourceCounts: Record<string, number> = {};
  const cappedTerms: GlossaryTerm[] = [];
  for (const t of validTerms) {
    const sId = t.sourceId || "default";
    sourceCounts[sId] = (sourceCounts[sId] || 0) + 1;
    if (sourceCounts[sId] <= 3) {
      cappedTerms.push(t);
    }
  }

  return cappedTerms.map((t) => {
    const currentTransliteration = t.transliteration || t.verified_term || t.draft_term || "";
    return {
      ...t,
      term: t.term || currentTransliteration,
      transliteration: currentTransliteration || t.term,
      draft_term: t.draft_term || currentTransliteration || t.term,
      verified_term: t.verified_term || currentTransliteration || t.term,
    };
  });
}

export default function App() {
  const [showLandingPage, setShowLandingPage] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("bahthos_entered_app") || localStorage.getItem("tawlif_entered_app");
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
      try {
        let cloudProjects = await loadUserProjects(currentUser.uid);
        
        if (cloudProjects.length === 0) {
          // Sync existing localStorage data on initial login
          const localProjectsStr = localStorage.getItem("bahthos_projects") || localStorage.getItem("tawlif_projects");
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
            await saveUserProject(currentUser.uid, proj);
            const savedSources = localStorage.getItem(`bahthos_sources_${proj.id}`) || localStorage.getItem(`tawlif_sources_${proj.id}`);
            const savedMessages = localStorage.getItem(`bahthos_messages_${proj.id}`) || localStorage.getItem(`tawlif_messages_${proj.id}`);
            const savedSyntheses = localStorage.getItem(`bahthos_syntheses_${proj.id}`) || localStorage.getItem(`tawlif_syntheses_${proj.id}`);
            const savedGlossary = localStorage.getItem(`bahthos_glossary_${proj.id}`) || localStorage.getItem(`tawlif_glossary_${proj.id}`);
            
            const localSources = savedSources ? JSON.parse(savedSources) : (proj.id === "default" ? defaultSources : []);
            const localMessages = savedMessages ? JSON.parse(savedMessages) : [];
            const localSyntheses = savedSyntheses ? JSON.parse(savedSyntheses) : (proj.id === "default" ? initialSyntheses : []);
            const localGlossary = savedGlossary ? JSON.parse(savedGlossary) : (proj.id === "default" ? initialGlossary : []);
            
            await saveProjectData(currentUser.uid, proj.id, {
              sources: localSources,
              messages: localMessages,
              syntheses: localSyntheses,
              glossaryTerms: localGlossary
            });
          }
          cloudProjects = await loadUserProjects(currentUser.uid);
        }

        setProjects(cloudProjects);

        let activeId = currentProjectId;
        if (!cloudProjects.some(p => p.id === activeId)) {
          activeId = cloudProjects[0]?.id || "default";
        }

        const { sources: cloudSources, messages: cloudMessages, syntheses: cloudSyntheses, glossaryTerms: cloudGlossary } = 
          await loadProjectData(currentUser.uid, activeId);

        const activeProjObj = cloudProjects.find(p => p.id === activeId);
        const cloudTemp = activeProjObj?.temperature ?? 0.2;

        // Retrieve local backup from localStorage for activeId
        const savedLocalSources = localStorage.getItem(`bahthos_sources_${activeId}`) || localStorage.getItem(`tawlif_sources_${activeId}`);
        const localSourcesParsed: Source[] = savedLocalSources ? JSON.parse(savedLocalSources) : [];

        // If cloud sources is empty but local storage has uploaded sources, preserve local sources
        const effectiveSources = (cloudSources && cloudSources.length > 0) ? cloudSources : localSourcesParsed;

// If effectiveSources is empty, glossary and syntheses MUST be empty
const rawGlossary = cloudSources.length > 0 
  ? cloudGlossary 
  : (localStorage.getItem(`bahthos_glossary_${activeId}`) ? JSON.parse(localStorage.getItem(`bahthos_glossary_${activeId}`)!) : []);
const effectiveGlossary = effectiveSources.length > 0 ? rawGlossary : [];
const effectiveSyntheses = effectiveSources.length > 0 ? cloudSyntheses : [];

        if (cloudSources.length === 0 && localSourcesParsed.length > 0) {
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
      const saved = localStorage.getItem("bahthos_projects") || localStorage.getItem("tawlif_projects");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
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
      const saved = localStorage.getItem("bahthos_current_project_id") || localStorage.getItem("tawlif_current_project_id");
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
      const activeId = localStorage.getItem("bahthos_current_project_id") || localStorage.getItem("tawlif_current_project_id") || "default";
      const saved = localStorage.getItem(`bahthos_sources_${activeId}`) || localStorage.getItem(`tawlif_sources_${activeId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
      if (activeId === "default") {
        // Migration of legacy non-prefixed key
        const legacy = localStorage.getItem("bahthos_sources") || localStorage.getItem("tawlif_sources") || localStorage.getItem("al_dalil_sources");
        if (legacy) return JSON.parse(legacy);
        return defaultSources;
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  const [activeTab, setActiveTab] = useState<ActiveTab>("home");

  // Lazily load messages for the current project
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const activeId = localStorage.getItem("bahthos_current_project_id") || localStorage.getItem("tawlif_current_project_id") || "default";
      const saved = localStorage.getItem(`bahthos_messages_${activeId}`) || localStorage.getItem(`tawlif_messages_${activeId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
      if (activeId === "default") {
        const legacy = localStorage.getItem("bahthos_messages") || localStorage.getItem("tawlif_messages") || localStorage.getItem("al_dalil_messages");
        if (legacy) return JSON.parse(legacy);
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
      const activeId = localStorage.getItem("bahthos_current_project_id") || localStorage.getItem("tawlif_current_project_id") || "default";
      const savedSources = localStorage.getItem(`bahthos_sources_${activeId}`) || localStorage.getItem(`tawlif_sources_${activeId}`);
      const parsedSources = savedSources ? JSON.parse(savedSources) : [];
      if (!Array.isArray(parsedSources) || parsedSources.length === 0) {
        return [];
      }
      const saved = localStorage.getItem(`bahthos_syntheses_${activeId}`) || localStorage.getItem(`tawlif_syntheses_${activeId}`);
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
      const activeId = localStorage.getItem("bahthos_current_project_id") || localStorage.getItem("tawlif_current_project_id") || "default";
      const saved = localStorage.getItem(`bahthos_temperature_${activeId}`) || localStorage.getItem(`tawlif_temperature_${activeId}`);
      if (saved) return parseFloat(saved);
      if (activeId === "default") {
        const legacy = localStorage.getItem("bahthos_temperature") || localStorage.getItem("tawlif_temperature") || localStorage.getItem("al_dalil_temperature");
        if (legacy) return parseFloat(legacy);
      }
    } catch (e) {
      console.error(e);
    }
    return 0.2;
  });

  // Lazily load glossary terms for the current project
  const [glossaryTerms, setGlossaryTerms] = useState<GlossaryTerm[]>(() => {
    try {
      const activeId = localStorage.getItem("bahthos_current_project_id") || localStorage.getItem("tawlif_current_project_id") || "default";
      const savedSources = localStorage.getItem(`bahthos_sources_${activeId}`) || localStorage.getItem(`tawlif_sources_${activeId}`);
      const parsedSources = savedSources ? JSON.parse(savedSources) : [];
      if (!Array.isArray(parsedSources) || parsedSources.length === 0) {
        return [];
      }
      const saved = localStorage.getItem(`bahthos_glossary_${activeId}`) || localStorage.getItem(`tawlif_glossary_${activeId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  const [isSweeping, setIsSweeping] = useState(false);
  const [sweepCorrectionCount, setSweepCorrectionCount] = useState<number | null>(null);

  const [stateLoadedFromServer, setStateLoadedFromServer] = useState(false);
  useEffect(() => {
    if (sources.length === 0) {
      if (glossaryTerms.length > 0) setGlossaryTerms([]);
      if (syntheses.length > 0) setSyntheses([]);
    } else {
      setGlossaryTerms((prev) => {
        const validSourceIds = new Set(sources.map((s) => s.id));
        const filtered = prev.filter((t) => !t.sourceId || validSourceIds.has(t.sourceId));
        return filtered.length !== prev.length ? filtered : prev;
      });
    }
  }, [sources]);

  // Load state from server on startup (for whatever project is loaded)
  useEffect(() => {
    const fetchState = async () => {
      try {
        const res = await fetch("/api/load-state");
        if (res.ok) {
          const data = await res.json();
          if (data) {
            const serverSources: Source[] = Array.isArray(data.sources) ? data.sources : [];
            const serverGlossary: GlossaryTerm[] = Array.isArray(data.glossaryTerms) ? data.glossaryTerms : [];

            if (serverSources.length > 0) {
              setSources(serverSources);
              if (serverGlossary.length > 0) {
setGlossaryTerms(serverGlossary);
              }
            } else {
              // Server has no sources. Ensure local state also reflects empty glossary if sources is empty
              setSources((currSources) => {
                if (currSources.length === 0) {
                  setGlossaryTerms([]);
                  setSyntheses([]);
                }
                return currSources;
              });
            }
          }
        }
      } catch (err) {
        console.error("Failed to load state from server:", err);
      } finally {
        setStateLoadedFromServer(true);
      }
    };
    fetchState();
  }, []);

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

    if (currentUser) {
      setIsFirebaseLoading(true);
      try {
        // 1. Save current state of the old project to Firestore first (to ensure no state loss)
        await saveProjectData(currentUser.uid, currentProjectId, {
          sources,
          messages,
          syntheses,
          glossaryTerms
        });

        // 2. Load the new project's state from Firestore
        const { sources: cloudSources, messages: cloudMessages, syntheses: cloudSyntheses, glossaryTerms: cloudGlossary } = 
          await loadProjectData(currentUser.uid, newProjectId);

        const newProjObj = projects.find((p) => p.id === newProjectId);
        const cloudTemp = newProjObj?.temperature ?? 0.2;

        loadedProjectIdRef.current = newProjectId;
        setSources(cloudSources);
        setMessages(cloudMessages);
        setSyntheses(cloudSyntheses);
        setGlossaryTerms(cloudGlossary);
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

    // 1. Save current state of the old project to its specific keys
    if (currentProjectId) {
      try {
        localStorage.setItem(`bahthos_sources_${currentProjectId}`, JSON.stringify(sources));
        localStorage.setItem(`bahthos_messages_${currentProjectId}`, JSON.stringify(messages));
        localStorage.setItem(`bahthos_syntheses_${currentProjectId}`, JSON.stringify(syntheses));
        localStorage.setItem(`bahthos_glossary_${currentProjectId}`, JSON.stringify(glossaryTerms));
        localStorage.setItem(`bahthos_temperature_${currentProjectId}`, temperature.toString());
      } catch (e) {
        console.error("Failed to save state during switch:", e);
      }
    }

    // 2. Load the new project's state
    try {
      const savedSources = localStorage.getItem(`bahthos_sources_${newProjectId}`) || localStorage.getItem(`tawlif_sources_${newProjectId}`);
      const savedMessages = localStorage.getItem(`bahthos_messages_${newProjectId}`) || localStorage.getItem(`tawlif_messages_${newProjectId}`);
      const savedSyntheses = localStorage.getItem(`bahthos_syntheses_${newProjectId}`) || localStorage.getItem(`tawlif_syntheses_${newProjectId}`);
      const savedGlossary = localStorage.getItem(`bahthos_glossary_${newProjectId}`) || localStorage.getItem(`tawlif_glossary_${newProjectId}`);
      const savedTemp = localStorage.getItem(`bahthos_temperature_${newProjectId}`) || localStorage.getItem(`tawlif_temperature_${newProjectId}`);

      const loadedSources = savedSources ? JSON.parse(savedSources) : (newProjectId === "default" ? defaultSources : []);
      const loadedMessages = savedMessages ? JSON.parse(savedMessages) : [];
      const loadedSyntheses = savedSyntheses ? JSON.parse(savedSyntheses) : (newProjectId === "default" ? initialSyntheses : []);
      const loadedGlossary = savedGlossary ? JSON.parse(savedGlossary) : (newProjectId === "default" ? initialGlossary : []);
      const loadedTemp = savedTemp ? parseFloat(savedTemp) : 0.2;

      // 3. Update the ref immediately to block reactive saving of old values during render
      loadedProjectIdRef.current = newProjectId;

      // 4. Update the state
      setSources(loadedSources);
      setMessages(loadedMessages);
      setSyntheses(loadedSyntheses);
      setGlossaryTerms(loadedGlossary);
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

    if (currentUser) {
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
    const index = projects.findIndex((p) => p.id === projectId);
    if (index === -1) return;

    if (currentUser) {
      try {
        await deleteUserProject(currentUser.uid, projectId);
      } catch (err) {
        console.error("Failed to delete project from Firestore:", err);
      }
    }

    // Clean up localstorage for deleted project
    try {
      const keys = [
        `bahthos_sources_${projectId}`, `bahthos_messages_${projectId}`,
        `bahthos_syntheses_${projectId}`, `bahthos_glossary_${projectId}`,
        `bahthos_temperature_${projectId}`, `tawlif_sources_${projectId}`,
        `tawlif_messages_${projectId}`, `tawlif_syntheses_${projectId}`,
        `tawlif_glossary_${projectId}`, `tawlif_temperature_${projectId}`
      ];
      keys.forEach((k) => localStorage.removeItem(k));
    } catch (e) {
      console.error(e);
    }

    const updatedProjects = projects.filter((p) => p.id !== projectId);

    if (updatedProjects.length === 0) {
      // If all projects were deleted, create a fresh empty project
      const newProj: Project = {
        id: "proj-" + Date.now(),
        name: "المشروع التجريبي الأول",
        dateCreated: new Date().toISOString().split("T")[0],
        temperature: 0.2
      };

      if (currentUser) {
        await saveUserProject(currentUser.uid, newProj);
        await saveProjectData(currentUser.uid, newProj.id, {
          sources: [],
          messages: [],
          syntheses: [],
          glossaryTerms: []
        });
      }

      setProjects([newProj]);
      setCurrentProjectId(newProj.id);
      loadedProjectIdRef.current = newProj.id;
      setSources([]);
      setMessages([]);
      setSyntheses([]);
      setGlossaryTerms([]);
      setSelectedSourceId(null);

      // Reset server persistent state
      fetch("/api/reset-state", { method: "POST" }).catch(console.error);
    } else {
      setProjects(updatedProjects);
      if (currentProjectId === projectId) {
        const nextActiveProject = updatedProjects[0];
        handleSwitchProject(nextActiveProject.id);
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

  // Save sources, messages, syntheses, and glossary terms to Firebase Firestore when they change
  useEffect(() => {
    if (!currentUser || isFirebaseLoading) return;
    if (currentProjectId !== loadedProjectIdRef.current) return;

    saveProjectData(currentUser.uid, currentProjectId, {
      sources,
      messages,
      syntheses,
      glossaryTerms
    }).catch((err) => console.error("Failed to sync project data to Firestore:", err));

    const currentProjectObj = projects.find((p) => p.id === currentProjectId);
    if (currentProjectObj) {
      saveUserProject(currentUser.uid, {
        ...currentProjectObj,
        temperature
      }).catch((err) => console.error("Failed to sync project config to Firestore:", err));
    }
  }, [sources, messages, syntheses, glossaryTerms, temperature, currentUser, currentProjectId, isFirebaseLoading]);

  // Save sources and glossary terms to the server when they change (only if NOT logged in)
  useEffect(() => {
    if (stateLoadedFromServer && !currentUser) {
      fetch("/api/save-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sources, glossaryTerms }),
      }).catch((err) => console.error("Failed to save state to server:", err));
    }
  }, [sources, glossaryTerms, stateLoadedFromServer, currentUser]);
  const handleResetWorkspace = async () => {
    if (currentUser) {
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

    try {
      await fetch("/api/reset-state", { method: "POST" });
    } catch (err) {
      console.error("Failed to reset state on server:", err);
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
        body: JSON.stringify({ text }),
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
      const fallbackTerms = extractFallbackTermsFromText(text, sourceId);
      if (fallbackTerms.length > 0) {
        addGlossaryTermsDirectly(fallbackTerms, sourceId);
      }
    }
  };

  // Add pre-extracted terms directly to the glossary
  const addGlossaryTermsDirectly = (terms: any[], sourceId?: string) => {
    if (!terms || !Array.isArray(terms) || terms.length === 0) return;
    setGlossaryTerms((prev) => {
      const normalizedNewTerms = terms
        .filter((t: any) => 
          t && (t.term || t.transliteration || t.verified_term || t.draft_term) &&
          !isTrivialOrCitationTerm(t.term || t.verified_term || t.draft_term, t.definition)
        )
        .map((t: any) => ({
          term: t.term || t.transliteration || t.verified_term || t.draft_term,
          transliteration: t.transliteration || t.verified_term || t.draft_term || t.term,
          definition: t.definition,
          draft_term: t.draft_term || t.transliteration || t.term,
          verified_term: t.verified_term || t.transliteration || t.draft_term || t.term,
          sourceId: sourceId
        }));

      const existingTermsLower = prev.map((t) => t.term.toLowerCase());
      const existingTransLower = prev.map((t) => t.transliteration.toLowerCase());

      const filteredNew = normalizedNewTerms.filter(
        (t) =>
          !existingTermsLower.includes(t.term.toLowerCase()) &&
          !existingTransLower.includes(t.transliteration.toLowerCase())
      );

      if (filteredNew.length > 0) {
        return [...prev, ...filteredNew];
      }
      return prev;
    });
  };

  // Guarantee that every uploaded source automatically has concepts and terms generated immediately upon upload
  useEffect(() => {
    if (!stateLoadedFromServer || sources.length === 0) return;

    sources.forEach((source) => {
      const sourceHasTerms = glossaryTerms.some(
        (gt) =>
          gt.sourceId === source.id ||
          (gt.term && source.content.toLowerCase().includes(gt.term.toLowerCase())) ||
          (gt.transliteration && source.content.includes(gt.transliteration))
      );

      if (!sourceHasTerms && source.content && source.content.trim().length > 10) {
        console.log(`Auto-extracting concepts and terms for source: ${source.title}`);
        extractGlossaryTerms(source.content, source.id);
      }
    });
  }, [sources, stateLoadedFromServer, glossaryTerms]);

  // Auto-populate glossary for uploaded Westphalian/Eurocentrism sources if not already present
  useEffect(() => {
    if (!stateLoadedFromServer) return;

    const hasWestphalianSource = sources.some(s => 
      s.title?.toLowerCase().includes("westphalian") || 
      s.title?.toLowerCase().includes("eurocentrism") ||
      s.content?.toLowerCase().includes("westphalian") ||
      s.content?.toLowerCase().includes("eurocentrism")
    );

    if (hasWestphalianSource) {
      const westphalianTerms = [
        {
          term: "Westphalian Sovereignty",
          transliteration: "السيادة الويستفالية",
          draft_term: "السيادة الويستفالية",
          verified_term: "السيادة الويستفالية",
          definition: "مفهوم قانوني وسياسي يفترض استقلالية الدولة المطلقة وسلطتها الحصرية على أراضيها ومواطنيها دون أي تدخل خارجي."
        },
        {
          term: "Eurocentrism",
          transliteration: "المركزية الأوروبية",
          draft_term: "المركزية الأوروبية",
          verified_term: "المركزية الأوروبية",
          definition: "منظور فكري يفسر التاريخ والظواهر العالمية من خلال التركيز على القيم والخبرات والمنظومات الغربية كمعيار أساسي."
        },
        {
          term: "Standard of Civilization",
          transliteration: "معيار التحضر",
          draft_term: "ستاندرد أوف سيفيليزيشن",
          verified_term: "معيار التحضر",
          definition: "مفهوم تاريخي قانوني استُخدم لتبرير فرض الهيمنة الاستعمارية من خلال تصنيف الدول غير الأوروبية على أنها غير متحضرة."
        },
        {
          term: "Legal Positivism",
          transliteration: "الوضعية القانونية",
          draft_term: "الوضعية القانونية",
          verified_term: "الوضعية القانونية",
          definition: "مدرسة في الفلسفة القانونية ترى أن صلاحية القوانين تستند إلى إرادة الدولة والتشريعات الوضعية بدلاً من المبادئ الأخلاقية الطبيعية."
        },
        {
          term: "International Society",
          transliteration: "المجتمع الدولي",
          draft_term: "المجتمع الدولي",
          verified_term: "المجتمع الدولي",
          definition: "مجموعة من الدول تجمعها قواعد ومؤسسات ومصالح مشتركة تلتزم بمراعاتها وتنظيم علاقاتها المتبادلة وفقاً لها."
        }
      ];

      setGlossaryTerms((prev) => {
        const existingLower = prev.map(t => t.term.toLowerCase());
        const toAdd = westphalianTerms.filter(t => !existingLower.includes(t.term.toLowerCase()));
        if (toAdd.length > 0) {
          return [...prev, ...toAdd];
        }
        return prev;
      });
    }
  }, [sources, stateLoadedFromServer]);

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

    // Save immediately to server persistent state
    fetch("/api/save-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sources: nextSources, glossaryTerms }),
    }).catch(console.error);

    // Save immediately to Firestore
    if (currentUser && currentProjectId) {
      saveProjectData(currentUser.uid, currentProjectId, { sources: nextSources, glossaryTerms }).catch(console.error);
    }

    if (!error) {
      setSelectedSourceId(newSrc.id);
      setActiveMainView("source");
      
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

    // Filter out terms derived from this source
    const nextTerms = glossaryTerms.filter((t) => t.sourceId !== id);

    if (nextSources.length === 0) {
      setGlossaryTerms([]);
      setSyntheses([]);
      setMessages([]);
    } else {
      setGlossaryTerms(nextTerms);
    }

    if (currentUser && currentProjectId) {
      saveProjectData(currentUser.uid, currentProjectId, {
        sources: nextSources,
        glossaryTerms: nextSources.length === 0 ? [] : nextTerms,
        syntheses: nextSources.length === 0 ? [] : syntheses,
        messages: nextSources.length === 0 ? [] : messages
      }).catch(console.error);
    }

    fetch("/api/save-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sources: nextSources,
        glossaryTerms: nextSources.length === 0 ? [] : nextTerms
      })
    }).catch(console.error);
  };

  // Delete all research sources completely
  const handleDeleteAllSources = () => {
    setSources([]);
    setGlossaryTerms([]);
    setSyntheses([]);
    setMessages([]);
    setSelectedSourceId(null);
    setActiveMainView("chat");

    if (currentUser && currentProjectId) {
      saveProjectData(currentUser.uid, currentProjectId, {
        sources: [],
        glossaryTerms: [],
        syntheses: [],
        messages: []
      }).catch(console.error);
    }

    fetch("/api/save-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sources: [],
        glossaryTerms: []
      })
    }).catch(console.error);
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
            />
          )}

          {activeTab === "history" && (
            <SynthesisHistory
              syntheses={syntheses}
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
