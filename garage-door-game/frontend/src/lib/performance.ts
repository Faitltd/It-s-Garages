// Performance Monitoring Utilities
import { browser } from '$app/environment';
import { trackPerformance } from './analytics';

interface PerformanceMetrics {
	loadTime: number;
	domContentLoaded: number;
	firstContentfulPaint: number;
	largestContentfulPaint: number;
	cumulativeLayoutShift: number;
	firstInputDelay: number;
}

class PerformanceMonitor {
	private metrics: Partial<PerformanceMetrics> = {};
	private observers: PerformanceObserver[] = [];

	constructor() {
		if (browser) {
			this.initializeMonitoring();
		}
	}

	private initializeMonitoring() {
		// Monitor page load performance
		this.monitorPageLoad();
		
		// Monitor Core Web Vitals
		this.monitorWebVitals();
		
		// Monitor resource loading
		this.monitorResources();
	}

	private monitorPageLoad() {
		window.addEventListener('load', () => {
			const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
			
			if (navigation) {
				this.metrics.loadTime = navigation.loadEventEnd - navigation.fetchStart;
				this.metrics.domContentLoaded = navigation.domContentLoadedEventEnd - navigation.fetchStart;
				
				trackPerformance('page_load_time', this.metrics.loadTime);
				trackPerformance('dom_content_loaded', this.metrics.domContentLoaded);
			}
		});
	}

	private monitorWebVitals() {
		// First Contentful Paint (FCP)
		this.observePerformance('paint', (entries) => {
			const fcpEntry = entries.find(entry => entry.name === 'first-contentful-paint');
			if (fcpEntry) {
				this.metrics.firstContentfulPaint = fcpEntry.startTime;
				trackPerformance('first_contentful_paint', fcpEntry.startTime);
			}
		});

		// Largest Contentful Paint (LCP)
		this.observePerformance('largest-contentful-paint', (entries) => {
			const lastEntry = entries[entries.length - 1];
			if (lastEntry) {
				this.metrics.largestContentfulPaint = lastEntry.startTime;
				trackPerformance('largest_contentful_paint', lastEntry.startTime);
			}
		});

		// Cumulative Layout Shift (CLS)
		this.observePerformance('layout-shift', (entries) => {
			let clsValue = 0;
			entries.forEach((entry: any) => {
				if (!entry.hadRecentInput) {
					clsValue += entry.value;
				}
			});
			
			if (clsValue > 0) {
				this.metrics.cumulativeLayoutShift = clsValue;
				trackPerformance('cumulative_layout_shift', clsValue * 1000, 'score');
			}
		});

		// First Input Delay (FID)
		this.observePerformance('first-input', (entries) => {
			const firstInput = entries[0];
			if (firstInput) {
				this.metrics.firstInputDelay = firstInput.processingStart - firstInput.startTime;
				trackPerformance('first_input_delay', this.metrics.firstInputDelay);
			}
		});
	}

	private monitorResources() {
		this.observePerformance('resource', (entries) => {
			entries.forEach((entry: PerformanceResourceTiming) => {
				// Track slow resources (>1s)
				if (entry.duration > 1000) {
					trackPerformance('slow_resource', entry.duration, 'ms');
				}
				
				// Track failed resources
				if (entry.transferSize === 0 && entry.decodedBodySize === 0) {
					trackPerformance('failed_resource', 1, 'count');
				}
			});
		});
	}

	private observePerformance(type: string, callback: (entries: PerformanceEntry[]) => void) {
		try {
			const observer = new PerformanceObserver((list) => {
				callback(list.getEntries());
			});
			
			observer.observe({ type, buffered: true });
			this.observers.push(observer);
		} catch (e) {
			console.warn(`Performance observer for ${type} not supported:`, e);
		}
	}

	// Manual performance tracking
	startTimer(name: string): () => void {
		const startTime = performance.now();
		
		return () => {
			const duration = performance.now() - startTime;
			trackPerformance(name, duration);
			return duration;
		};
	}

	// Track API call performance
	trackApiCall(endpoint: string, duration: number, success: boolean) {
		trackPerformance(`api_${endpoint.replace(/[^a-zA-Z0-9]/g, '_')}`, duration);
		
		if (!success) {
			trackPerformance('api_error', 1, 'count');
		}
	}

	// Track component render performance
	trackComponentRender(componentName: string, duration: number) {
		trackPerformance(`component_${componentName}`, duration);
	}

	// Get current metrics
	getMetrics(): Partial<PerformanceMetrics> {
		return { ...this.metrics };
	}

	// Cleanup observers
	disconnect() {
		this.observers.forEach(observer => observer.disconnect());
		this.observers = [];
	}
}

// Create singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Utility functions
export const startTimer = (name: string) => performanceMonitor.startTimer(name);
export const trackApiCall = (endpoint: string, duration: number, success: boolean) => 
	performanceMonitor.trackApiCall(endpoint, duration, success);
export const trackComponentRender = (componentName: string, duration: number) => 
	performanceMonitor.trackComponentRender(componentName, duration);

// Performance-aware fetch wrapper
export async function performanceFetch(url: string, options?: RequestInit): Promise<Response> {
	const endTimer = startTimer(`fetch_${url.split('/').pop() || 'unknown'}`);
	const startTime = performance.now();
	
	try {
		const response = await fetch(url, options);
		const duration = performance.now() - startTime;
		
		trackApiCall(url, duration, response.ok);
		endTimer();
		
		return response;
	} catch (error) {
		const duration = performance.now() - startTime;
		trackApiCall(url, duration, false);
		endTimer();
		throw error;
	}
}

// Component performance decorator
export function withPerformanceTracking<T extends any[]>(
	componentName: string,
	fn: (...args: T) => any
) {
	return (...args: T) => {
		const endTimer = startTimer(`component_${componentName}`);
		try {
			const result = fn(...args);
			endTimer();
			return result;
		} catch (error) {
			endTimer();
			throw error;
		}
	};
}
