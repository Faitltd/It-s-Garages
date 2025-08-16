// Analytics and Error Tracking Service
import { browser } from '$app/environment';

interface AnalyticsEvent {
	event: string;
	category: string;
	label?: string;
	value?: number;
	properties?: Record<string, any>;
}

interface ErrorReport {
	message: string;
	stack?: string;
	url: string;
	userAgent: string;
	timestamp: string;
	userId?: string;
	sessionId: string;
}

class AnalyticsService {
	private sessionId: string;
	private userId?: string;
	private apiBase: string;

	constructor() {
		this.sessionId = this.generateSessionId();
		this.apiBase = 'https://garage-door-backend-341270520862.us-central1.run.app/api';
		
		if (browser) {
			this.initializeUser();
			this.setupErrorTracking();
			this.trackPageView();
		}
	}

	private generateSessionId(): string {
		return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}

	private initializeUser() {
		const userData = localStorage.getItem('user');
		if (userData) {
			try {
				const user = JSON.parse(userData);
				this.userId = user.id;
			} catch (e) {
				console.warn('Failed to parse user data for analytics');
			}
		}
	}

	private setupErrorTracking() {
		// Global error handler
		window.addEventListener('error', (event) => {
			this.reportError({
				message: event.message,
				stack: event.error?.stack,
				url: event.filename || window.location.href,
				userAgent: navigator.userAgent,
				timestamp: new Date().toISOString(),
				userId: this.userId,
				sessionId: this.sessionId
			});
		});

		// Unhandled promise rejection handler
		window.addEventListener('unhandledrejection', (event) => {
			this.reportError({
				message: `Unhandled Promise Rejection: ${event.reason}`,
				stack: event.reason?.stack,
				url: window.location.href,
				userAgent: navigator.userAgent,
				timestamp: new Date().toISOString(),
				userId: this.userId,
				sessionId: this.sessionId
			});
		});
	}

	// Track page views
	trackPageView(page?: string) {
		if (!browser) return;
		
		const currentPage = page || window.location.pathname;
		this.track({
			event: 'page_view',
			category: 'navigation',
			label: currentPage,
			properties: {
				page: currentPage,
				referrer: document.referrer,
				timestamp: new Date().toISOString()
			}
		});
	}

	// Track user interactions
	track(event: AnalyticsEvent) {
		if (!browser) return;

		const payload = {
			...event,
			sessionId: this.sessionId,
			userId: this.userId,
			timestamp: new Date().toISOString(),
			url: window.location.href,
			userAgent: navigator.userAgent
		};

		// Send to backend analytics endpoint
		this.sendAnalytics(payload);

		// Log to console in development
		if (import.meta.env.DEV) {
			console.log('📊 Analytics Event:', payload);
		}
	}

	// Track game events
	trackGameEvent(action: string, properties?: Record<string, any>) {
		this.track({
			event: 'game_action',
			category: 'game',
			label: action,
			properties: {
				action,
				...properties
			}
		});
	}

	// Track user authentication
	trackAuth(action: 'login' | 'register' | 'logout', success: boolean) {
		this.track({
			event: 'auth_action',
			category: 'authentication',
			label: action,
			value: success ? 1 : 0,
			properties: {
				action,
				success
			}
		});
	}

	// Track performance metrics
	trackPerformance(metric: string, value: number, unit: string = 'ms') {
		this.track({
			event: 'performance_metric',
			category: 'performance',
			label: metric,
			value,
			properties: {
				metric,
				value,
				unit
			}
		});
	}

	// Report errors
	private async reportError(error: ErrorReport) {
		try {
			await fetch(`${this.apiBase}/analytics/error`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(error)
			});
		} catch (e) {
			console.warn('Failed to report error to analytics service:', e);
		}
	}

	// Send analytics data
	private async sendAnalytics(data: any) {
		try {
			await fetch(`${this.apiBase}/analytics/event`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(data)
			});
		} catch (e) {
			console.warn('Failed to send analytics data:', e);
		}
	}

	// Track user engagement
	trackEngagement(action: string, duration?: number) {
		this.track({
			event: 'user_engagement',
			category: 'engagement',
			label: action,
			value: duration,
			properties: {
				action,
				duration
			}
		});
	}

	// Update user ID when user logs in
	setUserId(userId: string) {
		this.userId = userId;
	}

	// Clear user ID when user logs out
	clearUserId() {
		this.userId = undefined;
	}
}

// Create singleton instance
export const analytics = new AnalyticsService();

// Convenience functions
export const trackPageView = (page?: string) => analytics.trackPageView(page);
export const trackEvent = (event: AnalyticsEvent) => analytics.track(event);
export const trackGameEvent = (action: string, properties?: Record<string, any>) => 
	analytics.trackGameEvent(action, properties);
export const trackAuth = (action: 'login' | 'register' | 'logout', success: boolean) => 
	analytics.trackAuth(action, success);
export const trackPerformance = (metric: string, value: number, unit?: string) => 
	analytics.trackPerformance(metric, value, unit);
export const trackEngagement = (action: string, duration?: number) => 
	analytics.trackEngagement(action, duration);
export const setUserId = (userId: string) => analytics.setUserId(userId);
export const clearUserId = () => analytics.clearUserId();
