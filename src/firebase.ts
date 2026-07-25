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
import { Project, Source, Synthesis, GlossaryTerm, Message } from "./types";

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

// Helper to load all user projects from Firestore
export async function loadUserProjects(userId: string): Promise<Project[]> {
  const projectsRef = collection(db, "users", userId, "projects");
  const snapshot = await getDocs(projectsRef);
  const projects: Project[] = [];
  snapshot.forEach((doc) => {
    projects.push({
      id: doc.id,
      ...doc.data()
    } as Project);
  });
  return projects;
}

// Helper to save/update a single project to Firestore
export async function saveUserProject(userId: string, project: Project): Promise<void> {
  const projectDocRef = doc(db, "users", userId, "projects", project.id);
  await setDoc(projectDocRef, {
    id: project.id,
    name: project.name,
    dateCreated: project.dateCreated,
    temperature: project.temperature ?? 0.2
  }, { merge: true });
}

// Helper to delete a project from Firestore
export async function deleteUserProject(userId: string, projectId: string): Promise<void> {
  // Delete subcollection documents first, then the project document itself
  const subcollections = ["sources", "messages", "syntheses", "glossaryTerms"];
  for (const sub of subcollections) {
    const colRef = collection(db, "users", userId, "projects", projectId, sub);
    const snap = await getDocs(colRef);
    const batch = writeBatch(db);
    snap.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();
  }
  const projectDocRef = doc(db, "users", userId, "projects", projectId);
  await deleteDoc(projectDocRef);
}

// Helper to save all documents of a project to Firestore with reconciliation (deleting removed items only on explicit reset or confirmed complete state)
export async function saveProjectData(
  userId: string,
  projectId: string,
  data: {
    sources?: Source[];
    messages?: Message[];
    syntheses?: Synthesis[];
    glossaryTerms?: GlossaryTerm[];
    isExplicitReset?: boolean;
  }
): Promise<void> {
  const { sources, messages, syntheses, glossaryTerms, isExplicitReset } = data;

  if (sources !== undefined && sources.length >= 0) {
    // 1. Save all current sources first
    for (const source of sources) {
      try {
        // Clone source object to ensure Firestore payload size stays under 1MB limit per doc
        const cleanSource = { ...source };
        if (cleanSource.content && cleanSource.content.length > 700000) {
          cleanSource.content = cleanSource.content.substring(0, 700000) + "\n\n[المحتوى المتبقي محفوظ محلياً وعبر الخادم]";
        }
        await setDoc(doc(db, "users", userId, "projects", projectId, "sources", source.id), cleanSource, { merge: true });
      } catch (err) {
        console.error(`Failed to save source ${source.id} to Firestore:`, err);
      }
    }

    // 2. Always delete non-existent sources from Firestore
    try {
      const colRef = collection(db, "users", userId, "projects", projectId, "sources");
      const snapshot = await getDocs(colRef);
      const existingIds = snapshot.docs.map(d => d.id);
      const currentIds = new Set(sources.map(s => s.id));
      const batch = writeBatch(db);
      let hasDeletes = false;
      for (const id of existingIds) {
        if (!currentIds.has(id)) {
          batch.delete(doc(db, "users", userId, "projects", projectId, "sources", id));
          hasDeletes = true;
        }
      }
      if (hasDeletes) {
        await batch.commit();
      }
    } catch (err) {
      console.error("Failed to perform source deletes in Firestore:", err);
    }
  }

  if (messages !== undefined && messages.length >= 0) {
    for (const msg of messages) {
      try {
        await setDoc(doc(db, "users", userId, "projects", projectId, "messages", msg.id), msg, { merge: true });
      } catch (err) {
        console.error(`Failed to save message ${msg.id} to Firestore:`, err);
      }
    }

    try {
      const colRef = collection(db, "users", userId, "projects", projectId, "messages");
      const snapshot = await getDocs(colRef);
      const existingIds = snapshot.docs.map(d => d.id);
      const currentIds = new Set(messages.map(m => m.id));
      const batch = writeBatch(db);
      let hasDeletes = false;
      for (const id of existingIds) {
        if (!currentIds.has(id)) {
          batch.delete(doc(db, "users", userId, "projects", projectId, "messages", id));
          hasDeletes = true;
        }
      }
      if (hasDeletes) {
        await batch.commit();
      }
    } catch (err) {
      console.error("Failed to perform message deletes in Firestore:", err);
    }
  }

  if (syntheses !== undefined && syntheses.length >= 0) {
    for (const syn of syntheses) {
      try {
        await setDoc(doc(db, "users", userId, "projects", projectId, "syntheses", syn.id), syn, { merge: true });
      } catch (err) {
        console.error(`Failed to save synthesis ${syn.id} to Firestore:`, err);
      }
    }

    try {
      const colRef = collection(db, "users", userId, "projects", projectId, "syntheses");
      const snapshot = await getDocs(colRef);
      const existingIds = snapshot.docs.map(d => d.id);
      const currentIds = new Set(syntheses.map(s => s.id));
      const batch = writeBatch(db);
      let hasDeletes = false;
      for (const id of existingIds) {
        if (!currentIds.has(id)) {
          batch.delete(doc(db, "users", userId, "projects", projectId, "syntheses", id));
          hasDeletes = true;
        }
      }
      if (hasDeletes) {
        await batch.commit();
      }
    } catch (err) {
      console.error("Failed to perform synthesis deletes in Firestore:", err);
    }
  }

  if (glossaryTerms !== undefined && glossaryTerms.length >= 0) {
    for (const term of glossaryTerms) {
      try {
        const termDocId = (term.term || "term-" + Date.now()).replace(/[\/\#\?\[\]]/g, "_");
        await setDoc(doc(db, "users", userId, "projects", projectId, "glossaryTerms", termDocId), term, { merge: true });
      } catch (err) {
        console.error(`Failed to save glossary term to Firestore:`, err);
      }
    }

    try {
      const colRef = collection(db, "users", userId, "projects", projectId, "glossaryTerms");
      const snapshot = await getDocs(colRef);
      const existingIds = snapshot.docs.map(d => d.id);
      const currentIds = new Set(glossaryTerms.map(t => (t.term || "").replace(/[\/\#\?\[\]]/g, "_")));
      const batch = writeBatch(db);
      let hasDeletes = false;
      for (const id of existingIds) {
        if (!currentIds.has(id)) {
          batch.delete(doc(db, "users", userId, "projects", projectId, "glossaryTerms", id));
          hasDeletes = true;
        }
      }
      if (hasDeletes) {
        await batch.commit();
      }
    } catch (err) {
      console.error("Failed to perform glossary deletes in Firestore:", err);
    }
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
}> {
  const sourcesRef = collection(db, "users", userId, "projects", projectId, "sources");
  const messagesRef = collection(db, "users", userId, "projects", projectId, "messages");
  const synthesesRef = collection(db, "users", userId, "projects", projectId, "syntheses");
  const glossaryTermsRef = collection(db, "users", userId, "projects", projectId, "glossaryTerms");

  const [sourcesSnap, messagesSnap, synthesesSnap, glossarySnap] = await Promise.all([
    getDocs(sourcesRef),
    getDocs(messagesRef),
    getDocs(synthesesRef),
    getDocs(glossaryTermsRef)
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

  return { sources, messages, syntheses, glossaryTerms };
}
