<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';


	let { children } = $props();
	let isMenuOpen = $state(false);
	let user = $state<any>(null);

	function toggleMenu() {
		isMenuOpen = !isMenuOpen;
	}

	function closeMenu() {
		isMenuOpen = false;
	}

	// Check authentication status
	function checkAuth() {
		if (!browser) return;

		const token = localStorage.getItem('authToken');
		const userData = localStorage.getItem('user');

		if (token && userData) {
			user = JSON.parse(userData);
		}
	}

	// Logout function
	function logout() {
		if (!browser) return;

		localStorage.removeItem('authToken');
		localStorage.removeItem('user');
		user = null;
		goto('/login');
	}

	// Close menu when route changes and check auth
	$effect(() => {
		if ($page.url.pathname) {
			isMenuOpen = false;
		}
		checkAuth();
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="min-h-screen bg-gray-50">
	<!-- Navigation -->
	<nav class="bg-white shadow-sm border-b border-gray-200">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
			<div class="flex justify-between h-16">
				<div class="flex items-center">
					<!-- Logo -->
					<a href="/" class="flex items-center space-x-2">
						<div class="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
							<span class="text-white font-bold text-sm">GD</span>
						</div>
						<span class="text-xl font-semibold text-gray-900">Garage Door Game</span>
					</a>
				</div>

				<!-- Desktop Navigation -->
				<div class="hidden md:flex items-center space-x-8">
					<a href="/" class="text-gray-700 hover:text-primary-600 px-3 py-2 text-sm font-medium transition-colors">
						Home
					</a>
					{#if user}
						<a href="/data-entry" class="text-gray-700 hover:text-primary-600 px-3 py-2 text-sm font-medium transition-colors">
							📝 Data Entry
						</a>
						<a href="/validation-game" class="text-gray-700 hover:text-primary-600 px-3 py-2 text-sm font-medium transition-colors">
							🎮 Validation Game
						</a>
						<a href="/submit" class="text-gray-700 hover:text-primary-600 px-3 py-2 text-sm font-medium transition-colors">
							📝 Submit Data
						</a>
						<a href="/leaderboard" class="text-gray-700 hover:text-primary-600 px-3 py-2 text-sm font-medium transition-colors">
							🏆 Leaderboard
						</a>
						<a href="/data-dashboard" class="text-gray-700 hover:text-primary-600 px-3 py-2 text-sm font-medium transition-colors">
							📊 Data Dashboard
						</a>
						<a href="/achievements" class="text-gray-700 hover:text-primary-600 px-3 py-2 text-sm font-medium transition-colors">
							🏅 Achievements
						</a>
						<a href="/profile" class="text-gray-700 hover:text-primary-600 px-3 py-2 text-sm font-medium transition-colors">
							👤 Profile
						</a>

						<!-- User info and logout -->
						<div class="flex items-center space-x-4">
							<span class="text-sm text-gray-600">Welcome, {user.username}!</span>
							<button onclick={logout} class="btn-outline text-sm py-1 px-3">
								Logout
							</button>
						</div>
					{:else}
						<a href="/leaderboard" class="text-gray-700 hover:text-primary-600 px-3 py-2 text-sm font-medium transition-colors">
							🏆 Leaderboard
						</a>
						<a href="/achievements" class="text-gray-700 hover:text-primary-600 px-3 py-2 text-sm font-medium transition-colors">
							🏅 Achievements
						</a>

						<!-- Auth buttons -->
						<div class="flex items-center space-x-4">
							<a href="/login" class="btn-outline">
								Login
							</a>
							<a href="/login" class="btn-primary">
								Sign Up
							</a>
						</div>
					{/if}
				</div>

				<!-- Mobile menu button -->
				<div class="md:hidden flex items-center">
					<button
						onclick={toggleMenu}
						class="text-gray-700 hover:text-primary-600 focus:outline-none focus:text-primary-600 p-2"
						aria-label="Toggle menu"
					>
						<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							{#if isMenuOpen}
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
							{:else}
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
							{/if}
						</svg>
					</button>
				</div>
			</div>
		</div>

		<!-- Mobile Navigation -->
		{#if isMenuOpen}
			<div class="md:hidden bg-white border-t border-gray-200">
				<div class="px-2 pt-2 pb-3 space-y-1">
					<a href="/" onclick={closeMenu} class="block px-3 py-2 text-base font-medium text-gray-700 hover:text-primary-600 hover:bg-gray-50 rounded-md transition-colors">
						Home
					</a>
					{#if user}
						<a href="/data-entry" onclick={closeMenu} class="block px-3 py-2 text-base font-medium text-gray-700 hover:text-primary-600 hover:bg-gray-50 rounded-md transition-colors">
							📝 Data Entry
						</a>
						<a href="/validation-game" onclick={closeMenu} class="block px-3 py-2 text-base font-medium text-gray-700 hover:text-primary-600 hover:bg-gray-50 rounded-md transition-colors">
							🎮 Validation Game
						</a>
						<a href="/game" onclick={closeMenu} class="block px-3 py-2 text-base font-medium text-gray-700 hover:text-primary-600 hover:bg-gray-50 rounded-md transition-colors">
							🎮 Play Game
						</a>
						<a href="/submit" onclick={closeMenu} class="block px-3 py-2 text-base font-medium text-gray-700 hover:text-primary-600 hover:bg-gray-50 rounded-md transition-colors">
							📝 Submit Data
						</a>
						<a href="/leaderboard" onclick={closeMenu} class="block px-3 py-2 text-base font-medium text-gray-700 hover:text-primary-600 hover:bg-gray-50 rounded-md transition-colors">
							🏆 Leaderboard
						</a>
						<a href="/profile" onclick={closeMenu} class="block px-3 py-2 text-base font-medium text-gray-700 hover:text-primary-600 hover:bg-gray-50 rounded-md transition-colors">
							👤 Profile
						</a>

						<!-- Mobile user info and logout -->
						<div class="pt-4 pb-2 border-t border-gray-200 space-y-2">
							<div class="px-3 py-2 text-sm text-gray-600">Welcome, {user.username}!</div>
							<button onclick={() => { logout(); closeMenu(); }} class="block w-full text-center btn-outline">
								Logout
							</button>
						</div>
					{:else}
						<a href="/leaderboard" onclick={closeMenu} class="block px-3 py-2 text-base font-medium text-gray-700 hover:text-primary-600 hover:bg-gray-50 rounded-md transition-colors">
							🏆 Leaderboard
						</a>

						<!-- Mobile auth buttons -->
						<div class="pt-4 pb-2 border-t border-gray-200 space-y-2">
							<a href="/login" onclick={closeMenu} class="block w-full text-center btn-outline">
								Login
							</a>
							<a href="/login" onclick={closeMenu} class="block w-full text-center btn-primary">
								Sign Up
							</a>
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</nav>

	<!-- Main Content -->
	<main class="flex-1">
		{@render children?.()}
	</main>

	<!-- Footer -->
	<footer class="bg-white border-t border-gray-200 mt-auto">
		<div class="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
			<div class="flex flex-col md:flex-row justify-between items-center">
				<div class="flex items-center space-x-2 mb-4 md:mb-0">
					<div class="w-6 h-6 bg-gradient-primary rounded flex items-center justify-center">
						<span class="text-white font-bold text-xs">GD</span>
					</div>
					<span class="text-gray-600 text-sm">© 2025 Garage Door Game. All rights reserved.</span>
				</div>
				<div class="flex space-x-6 text-sm text-gray-600">
					<a href="/about" class="hover:text-primary-600 transition-colors">About</a>
					<a href="/privacy" class="hover:text-primary-600 transition-colors">Privacy</a>
					<a href="/terms" class="hover:text-primary-600 transition-colors">Terms</a>
					<a href="/contact" class="hover:text-primary-600 transition-colors">Contact</a>
				</div>
			</div>
		</div>
	</footer>
</div>
