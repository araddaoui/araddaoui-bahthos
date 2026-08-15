import { initializeApp, setLogLevel } from "firebase/app";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser 
} from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  deleteDoc, 
  writeBatch,
  disableNetwork
} from "firebase/firestore";
import { Project, Source, Synthesis, GlossaryTerm, Message, DalilBriefing } from "./types.js";

// Firebase configuration from firebase-applet-config
const firebaseConfig = {
  apiKey: "AIzaSyCU03vn4pn8E0DV7gyL6InQ3sFxG9x-uAU",
  authDomain: "gen-lang-client-0535812922.firebaseapp.com",
  projectId: "gen-lang-client-0535812922",
  storageBucket: "gen-lang-client-0535812922.firebasestorage.app",
  messagingSenderId: "733534710623",
  appId: "1:733534710623:web:5face9eab5188e1bdea4ea"
};

const DATABASE_ID = "ai-studio-bahthosos-387d5c26-c1cd-4070-97da-dc8503fc3a7f";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
try {
  setLogLevel("silent");
} catch (e) {}
const auth = getAuth(app);
const db = getFirestore(app, DATABASE_ID);

// Global flag to track if Firestore daily quota has been exceeded, avoiding retry loops
let isFirestoreQuotaExceeded = false;

try {
  const quotaTS = localStorage.getItem("bahthos_firestore_quota_exceeded");
  if (quotaTS) {
    const ts = parseInt(quotaTS, 10);
    // If quota was exceeded within last 24 hours, keep network disabled
    if (Date.now() - ts < 24 * 60 * 60 * 1000) {
      isFirestoreQuotaExceeded = true;
      disableNetwork(db).catch(() => {});
    }
  }
} catch (e) {}

export function isQuotaExceeded(): boolean {
  return isFirestoreQuotaExceeded;
}

function handleFirestoreError(error: any, actionName: string) {
  const msg = error?.message || String(error || "");
  if (
    error?.code === "resource-exhausted" || 
    msg.includes("resource-exhausted") || 
    msg.includes("Quota limit exceeded") ||
    msg.includes("quota")
  ) {
    if (!isFirestoreQuotaExceeded) {
      isFirestoreQuotaExceeded = true;
      try {
        localStorage.setItem("bahthos_firestore_quota_exceeded", Date.now().toString());
      } catch (e) {}
      console.warn(`[Firestore] Daily quota limit reached during ${actionName}. Disabling network connection to prevent background retries.`);
      disableNetwork(db).catch(() => {});
    }
  } else {
    console.error(`[Firestore] Error during ${actionName}:`, error);
  }
}

export { app, auth, db };

// Tracking set for deleted project IDs to prevent race conditions and re-persisting deleted projects
const deletedProjectIds = new Set<string>();

try {
  const saved = localStorage.getItem("bahthos_deleted_projects");
  if (saved) {
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed)) {
      parsed.forEach((id) => deletedProjectIds.add(id));
    }
  }
} catch (e) {
  console.error("Failed to load deleted project IDs from localStorage", e);
}

export function markProjectAsDeleted(projectId: string): void {
  if (!projectId) return;
  deletedProjectIds.add(projectId);
  try {
    localStorage.setItem("bahthos_deleted_projects", JSON.stringify(Array.from(deletedProjectIds)));
  } catch (e) {
    console.error("Failed to save deleted project IDs to localStorage", e);
  }
}

export function isProjectDeleted(projectId: string): boolean {
  if (!projectId) return false;
  return deletedProjectIds.has(projectId);
}

export function clearDeletedProjectsRegistry(): void {
  deletedProjectIds.clear();
  try {
    localStorage.removeItem("bahthos_deleted_projects");
  } catch (e) {}
}

// Helper to load all user projects from Firestore
export async function loadUserProjects(userId: string): Promise<Project[]> {
  if (isFirestoreQuotaExceeded) return [];
  try {
    const projectsRef = collection(db, "users", userId, "projects");
    const snapshot = await getDocs(projectsRef);
    const projects: Project[] = [];
    snapshot.forEach((doc) => {
      if (!isProjectDeleted(doc.id)) {
        projects.push({
          id: doc.id,
          ...doc.data()
        } as Project);
      }
    });
    return projects;
  } catch (err) {
    handleFirestoreError(err, "loadUserProjects");
    return [];
  }
}

// Helper to recursively remove undefined properties from objects so Firestore setDoc won't throw invalid data error
export function sanitizeForFirestore<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }
  if (typeof data !== "object") {
    return data;
  }
  if (Array.isArray(data)) {
    return data
      .filter((item) => item !== undefined)
      .map((item) => sanitizeForFirestore(item)) as unknown as T;
  }
  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      cleaned[key] = sanitizeForFirestore(value);
    }
  }
  return cleaned as T;
}

// Helper to save/update a single project to Firestore
const lastSavedProjects = new Map<string, string>();

export async function saveUserProject(userId: string, project: Project): Promise<void> {
  if (isFirestoreQuotaExceeded || isProjectDeleted(project.id)) {
    return;
  }
  const dataToSave = sanitizeForFirestore({
    id: project.id,
    name: project.name,
    dateCreated: project.dateCreated,
    temperature: project.temperature ?? 0.2
  });
  const serialized = JSON.stringify(dataToSave);
  if (lastSavedProjects.get(project.id) === serialized) {
    return;
  }

  try {
    const projectDocRef = doc(db, "users", userId, "projects", project.id);
    await setDoc(projectDocRef, dataToSave, { merge: true });
    lastSavedProjects.set(project.id, serialized);
  } catch (err) {
    handleFirestoreError(err, "saveUserProject");
  }
}

// Helper to delete a project from Firestore
export async function deleteUserProject(userId: string, projectId: string): Promise<void> {
  markProjectAsDeleted(projectId);
  lastSavedProjects.delete(projectId);
  if (isFirestoreQuotaExceeded) return;
  try {
    const subcollections = ["sources", "messages", "syntheses", "glossaryTerms", "dalilBriefings"];
    for (const sub of subcollections) {
      const colRef = collection(db, "users", userId, "projects", projectId, sub);
      const snap = await getDocs(colRef);
      const docs = snap.docs;
      for (let i = 0; i < docs.length; i += 400) {
        const batch = writeBatch(db);
        const chunk = docs.slice(i, i + 400);
        chunk.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    }
    const projectDocRef = doc(db, "users", userId, "projects", projectId);
    await deleteDoc(projectDocRef);
  } catch (err) {
    handleFirestoreError(err, "deleteUserProject");
  }
}

// Reusable helper to diff and sync a collection in Firestore
export async function syncCollection<T extends { id?: string; term?: string }>(
  userId: string,
  projectId: string,
  collectionName: string,
  items: T[] | undefined
): Promise<void> {
  if (isFirestoreQuotaExceeded || items === undefined) return;

  try {
    const colRef = collection(db, "users", userId, "projects", projectId, collectionName);
    const snap = await getDocs(colRef);
    const getItemId = (item: T): string => item.id || item.term || "";
    const newIds = new Set(items.map((item) => getItemId(item)));

    const existingMap = new Map<string, any>();
    snap.forEach((d) => {
      existingMap.set(d.id, d.data());
    });

    const batch = writeBatch(db);
    let opCount = 0;

    // Sync remote collection by deleting items not in the new set and upserting changed/new items.
    snap.forEach((d) => {
      if (!newIds.has(d.id)) {
        batch.delete(d.ref);
        opCount++;
      }
    });

    for (const item of items) {
      const docId = getItemId(item);
      if (!docId) continue;

      const sanitized = sanitizeForFirestore(item);
      const existingData = existingMap.get(docId);

      // Diff check: only write if document is new or changed
      if (!existingData || JSON.stringify(existingData) !== JSON.stringify(sanitized)) {
        const docRef = doc(db, "users", userId, "projects", projectId, collectionName, docId);
        batch.set(docRef, sanitized, { merge: true });
        opCount++;
      }
    }

    if (opCount > 0) {
      await batch.commit();
    }
  } catch (err) {
    handleFirestoreError(err, `syncCollection(${collectionName})`);
  }
}

// Helper to save all documents of a project to Firestore
export async function saveProjectData(
  userId: string,
  projectId: string,
  data: {
    sources?: Source[];
    messages?: Message[];
    syntheses?: Synthesis[];
    glossaryTerms?: GlossaryTerm[];
    dalilBriefings?: DalilBriefing[];
  }
): Promise<void> {
  if (isFirestoreQuotaExceeded || isProjectDeleted(projectId)) {
    return;
  }
  const { sources, messages, syntheses, glossaryTerms, dalilBriefings } = data;

  try {
    await syncCollection(userId, projectId, "sources", sources);
    await syncCollection(userId, projectId, "messages", messages);
    await syncCollection(userId, projectId, "syntheses", syntheses);
    await syncCollection(userId, projectId, "glossaryTerms", glossaryTerms);
    await syncCollection(userId, projectId, "dalilBriefings", dalilBriefings);
  } catch (err) {
    handleFirestoreError(err, "saveProjectData");
  }
}

// Helper to load project state from Firestore
export async function loadProjectData(
  userId: string,
  projectId: string
): Promise<{
  sources: Source[];
  messages: Message[];
  syntheses: Synthesis[];
  glossaryTerms: GlossaryTerm[];
  dalilBriefings: DalilBriefing[];
}> {
  if (isFirestoreQuotaExceeded) {
    return { sources: [], messages: [], syntheses: [], glossaryTerms: [], dalilBriefings: [] };
  }
  try {
    const sourcesRef = collection(db, "users", userId, "projects", projectId, "sources");
    const messagesRef = collection(db, "users", userId, "projects", projectId, "messages");
    const synthesesRef = collection(db, "users", userId, "projects", projectId, "syntheses");
    const glossaryTermsRef = collection(db, "users", userId, "projects", projectId, "glossaryTerms");
    const dalilBriefingsRef = collection(db, "users", userId, "projects", projectId, "dalilBriefings");

    const [sourcesSnap, messagesSnap, synthesesSnap, glossarySnap, dalilSnap] = await Promise.all([
      getDocs(sourcesRef),
      getDocs(messagesRef),
      getDocs(synthesesRef),
      getDocs(glossaryTermsRef),
      getDocs(dalilBriefingsRef)
    ]);

    const sources: Source[] = [];
    sourcesSnap.forEach((d) => sources.push(d.data() as Source));

    const messages: Message[] = [];
    messagesSnap.forEach((d) => messages.push(d.data() as Message));
    // Sort messages by timestamp if present, otherwise by ID or order
    messages.sort((a, b) => new Date(a.timestamp || "").getTime() - new Date(b.timestamp || "").getTime());

    const syntheses: Synthesis[] = [];
    synthesesSnap.forEach((d) => syntheses.push(d.data() as Synthesis));

    const glossaryTerms: GlossaryTerm[] = [];
    glossarySnap.forEach((d) => glossaryTerms.push(d.data() as GlossaryTerm));

    const dalilBriefings: DalilBriefing[] = [];
    dalilSnap.forEach((d) => dalilBriefings.push(d.data() as DalilBriefing));

    return { sources, messages, syntheses, glossaryTerms, dalilBriefings };
  } catch (err) {
    handleFirestoreError(err, "loadProjectData");
    return { sources: [], messages: [], syntheses: [], glossaryTerms: [], dalilBriefings: [] };
  }
}
