export interface BillingStatus {
	tier: "free" | "pro";
	status: string;
	currentPeriodEnd?: string;
}

export async function fetchBillingStatus(): Promise<BillingStatus> {
	const response = await fetch("/api/billing/status");
	if (!response.ok) throw new Error("Unable to load billing status");
	return response.json();
}

export const redirectToCheckout = async (...args: any[]) => {};
export const redirectToCustomerPortal = async (...args: any[]) => ({ error: "" });
export const createCheckoutSession = async (...args: any[]) => {};
export const getSubscriptionStatus = async (...args: any[]) => {};
export const cancelSubscription = async (...args: any[]) => {};
export const handleStripeWebhook = async (...args: any[]) => {};
export default redirectToCheckout;
