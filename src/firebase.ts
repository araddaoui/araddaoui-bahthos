export const auth = {};
export const db = {};
export const storage = {};
export const getAuthHeaders = async (...args: any[]) => ({ Authorization: "" });
export const getIdToken = async (...args: any[]) => "";
export const getCurrentUser = () => null;
export default auth;
