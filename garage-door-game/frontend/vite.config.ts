import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	build: {
		// Enable minification and compression
		minify: 'terser',
		terserOptions: {
			compress: {
				drop_console: true, // Remove console.logs in production
				drop_debugger: true
			}
		},
		// Optimize chunk splitting
		rollupOptions: {
			output: {
				// Let Vite handle automatic chunk splitting
				chunkFileNames: 'assets/[name]-[hash].js',
				entryFileNames: 'assets/[name]-[hash].js',
				assetFileNames: 'assets/[name]-[hash].[ext]'
			}
		},
		// Enable source maps for debugging (can be disabled for smaller builds)
		sourcemap: false,
		// Set chunk size warning limit
		chunkSizeWarningLimit: 1000
	},
	// Optimize dependencies
	optimizeDeps: {
		include: ['axios']
	}
});
