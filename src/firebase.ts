import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
	collection,
	deleteDoc,
	doc,
	getDocs,
	getFirestore,
	setDoc
} from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
	apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
	authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
	projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
	storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
	messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
	appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);

const deletedProjectsKey = "bahthos_deleted_projects";
const deletedProjects = new Set<string>();
let quotaExceeded = false;

function isQuotaError(error: unknown): boolean {
	const code = typeof error === "object" && error !== null && "code" in error
		? String((error as { code?: unknown }).code)
		: "";
	return code.includes("resource-exhausted") || code.includes("quota");
}

function handleFirestoreError(error: unknown): never {
	if (isQuotaError(error)) quotaExceeded = true;
	throw error;
}

function projectCollection(userId: string, projectId: string, name: string) {
	return collection(db, "users", userId, "projects", projectId, name);
}

export async function loadUserProjects(userId: string): Promise<any[]> {
	if (quotaExceeded) return [];
	try {
		const snapshot = await getDocs(collection(db, "users", userId, "projects"));
		return snapshot.docs.map((project) => ({ id: project.id, ...project.data() }));
	} catch (error) {
		return handleFirestoreError(error);
	}
}

export async function saveUserProject(userId: string, project: any): Promise<void> {
	if (quotaExceeded || isProjectDeleted(project.id)) return;
	try {
		await setDoc(doc(db, "users", userId, "projects", project.id), project, { merge: true });
	} catch (error) {
		handleFirestoreError(error);
	}
}

export async function deleteUserProject(userId: string, projectId: string): Promise<void> {
	if (quotaExceeded) return;
	try {
		for (const name of ["sources", "messages", "syntheses", "glossaryTerms", "dalilBriefings"]) {
			const snapshot = await getDocs(projectCollection(userId, projectId, name));
			await Promise.all(snapshot.docs.map((item) => deleteDoc(item.ref)));
		}
		await deleteDoc(doc(db, "users", userId, "projects", projectId));
		markProjectAsDeleted(projectId);
	} catch (error) {
		handleFirestoreError(error);
	}
}

export async function loadProjectData(userId: string, projectId: string): Promise<Record<string, any[]>> {
	if (quotaExceeded || isProjectDeleted(projectId)) {
		return { sources: [], messages: [], syntheses: [], glossaryTerms: [], dalilBriefings: [] };
	}

	try {
		const names = ["sources", "messages", "syntheses", "glossaryTerms", "dalilBriefings"];
		const entries = await Promise.all(names.map(async (name) => {
			const snapshot = await getDocs(projectCollection(userId, projectId, name));
			return [name, snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))] as const;
		}));
		return Object.fromEntries(entries);
	} catch (error) {
		return handleFirestoreError(error);
	}
}

export async function saveProjectData(userId: string, projectId: string, data: Record<string, any>): Promise<void> {
	if (quotaExceeded || isProjectDeleted(projectId)) return;
	try {
		await Promise.all(Object.entries(data).map(async ([name, values]) => {
			if (!Array.isArray(values)) return;
			await Promise.all(values.map((value) => {
				const id = value?.id || `${name}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
				return setDoc(doc(projectCollection(userId, projectId, name), id), value, { merge: true });
			}));
		}));
	} catch (error) {
		handleFirestoreError(error);
	}
}

export function markProjectAsDeleted(projectId: string): void {
	deletedProjects.add(projectId);
	if (typeof window !== "undefined") {
		localStorage.setItem(deletedProjectsKey, JSON.stringify(Array.from(deletedProjects)));
	}
}

export function isProjectDeleted(projectId: string): boolean {
	if (deletedProjects.size === 0 && typeof window !== "undefined") {
		try {
			const saved = JSON.parse(localStorage.getItem(deletedProjectsKey) || "[]");
			if (Array.isArray(saved)) saved.forEach((id) => deletedProjects.add(String(id)));
		} catch {
			// Ignore malformed local state and use the in-memory registry.
		}
	}
	return deletedProjects.has(projectId);
}

export function clearDeletedProjectsRegistry(): void {
	deletedProjects.clear();
	if (typeof window !== "undefined") localStorage.removeItem(deletedProjectsKey);
}

export function isQuotaExceeded(): boolean {
	return quotaExceeded;
}

export async function getIdToken(): Promise<string> {
	return auth.currentUser ? auth.currentUser.getIdToken() : "";
}

export function getCurrentUser() {
	return auth.currentUser;
}

export async function getAuthHeaders(): Promise<Record<string, string>> {
	const token = await getIdToken();
	return token ? { Authorization: `Bearer ${token}` } : {};
}

export default auth;
