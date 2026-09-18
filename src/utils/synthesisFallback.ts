export const generateReportFollowUpFallback = (...args: any[]) => "";
export const generateSynthesisFallback = (...args: any[]) => "";
export const generateClientSynthesisFallback = (...args: any[]) => generateSynthesisFallback(...args);
export const generateReportFallback = (...args: any[]) => "";
export default generateReportFollowUpFallback;
