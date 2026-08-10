import { initializeApp } from "firebase/app";
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
  getDocFromServer,
  writeBatch
} from "firebase/firestore";
import { Project, Source, Synthesis, GlossaryTerm, Message, DalilBriefing } from "./types";

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
const auth = getAuth(app);
const db = getFirestore(app, DATABASE_ID);

// Verify Connection as mandated by instructions
async function testConnection() {
  try {
    await getDocFromServer(doc(db, "test", "connection"));
  } catch (error) {
    if (error instanceof Error && error.message.includes("the client is offline")) {
      console.error("Please check your Firebase configuration or internet connection.");
    }
  }
}
testConnection();

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
export async function saveUserProject(userId: string, project: Project): Promise<void> {
  if (isProjectDeleted(project.id)) {
    console.log(`[Firestore] Skipping saveUserProject for deleted project: ${project.id}`);
    return;
  }
  const projectDocRef = doc(db, "users", userId, "projects", project.id);
  const dataToSave = sanitizeForFirestore({
    id: project.id,
    name: project.name,
    dateCreated: project.dateCreated,
    temperature: project.temperature ?? 0.2
  });
  await setDoc(projectDocRef, dataToSave, { merge: true });
}

// Helper to delete a project from Firestore
export async function deleteUserProject(userId: string, projectId: string): Promise<void> {
  markProjectAsDeleted(projectId);
  // Delete subcollection documents first in chunks, then the project document itself
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
}

// Reusable helper to diff and sync a collection in Firestore
export async function syncCollection<T extends { id?: string; term?: string }>(
  userId: string,
  projectId: string,
  collectionName: string,
  items: T[] | undefined
): Promise<void> {
  if (items === undefined) return;

  const colRef = collection(db, "users", userId, "projects", projectId, collectionName);
  const snap = await getDocs(colRef);
  const getItemId = (item: T): string => item.id || item.term || "";
  const newIds = new Set(items.map((item) => getItemId(item)));

  const batch = writeBatch(db);
  snap.forEach((d) => {
    if (!newIds.has(d.id)) {
      batch.delete(d.ref);
    }
  });
  await batch.commit();

  for (const item of items) {
    const docId = getItemId(item);
    if (!docId) continue;
    await setDoc(
      doc(db, "users", userId, "projects", projectId, collectionName, docId),
      sanitizeForFirestore(item)
    );
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
  if (isProjectDeleted(projectId)) {
    console.log(`[Firestore] Skipping saveProjectData for deleted project: ${projectId}`);
    return;
  }
  const { sources, messages, syntheses, glossaryTerms, dalilBriefings } = data;

  await syncCollection(userId, projectId, "sources", sources);
  await syncCollection(userId, projectId, "messages", messages);
  await syncCollection(userId, projectId, "syntheses", syntheses);
  await syncCollection(userId, projectId, "glossaryTerms", glossaryTerms);
  await syncCollection(userId, projectId, "dalilBriefings", dalilBriefings);
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
}
