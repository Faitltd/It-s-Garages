<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { authStore } from '$lib/stores/auth';
	import { get } from 'svelte/store';

	let user: any = null;

	onMount(() => {
		// Check if user is logged in
		if (browser) {
			const auth = get(authStore);
			if (auth.isAuthenticated && auth.user) {
				user = auth.user;
			}
		}
	});

	function logout() {
		authStore.logout();
		user = null;
	}
</script>

<svelte:head>
	<title>It's Garages - Garage Door Data Collection Platform</title>
	<meta name="description" content="Collect and validate garage door data with GPS-powered address detection and Street View integration." />
</svelte:head>

<!-- Hero Section -->
<section class="py-8 px-4">
	<div class="max-w-2xl mx-auto">
		<div class="text-center">
			<div class="text-box power-up mb-8">
				<h1 class="text-2xl mb-4">
					🏠 IT'S GARAGES
				</h1>
				<p class="text-lg mb-4">
					Garage Door Data Collection Platform
				</p>
			</div>

			{#if user}
				<!-- Dashboard for logged-in users -->
				<div class="mb-6">
					<div class="text-box mb-4">
						<h2 class="text-lg mb-2">Welcome back, {user.username}!</h2>
						<p class="text-sm text-gray-300">Choose what you'd like to do:</p>
					</div>
				</div>

				<div class="space-y-4 mb-6">
					<!-- Data Entry Option -->
					<div class="text-box p-4">
						<div class="mb-4">
							<div class="text-3xl mb-2">📏</div>
							<h3 class="text-base font-bold mb-2">MEASURE DOORS</h3>
							<p class="text-xs text-gray-300 mb-4">
								Add real garage door measurements with GPS location.
							</p>
						</div>
						<a href="/data-entry" class="btn-retro btn-success w-full text-sm">
							START MEASURING
						</a>
					</div>

					<!-- Single Game Option -->
					<div class="text-box p-4">
						<div class="mb-4">
							<div class="text-3xl mb-2">🎮</div>
							<h3 class="text-base font-bold mb-2">GARAGE DOOR GAME</h3>
							<p class="text-xs text-gray-300 mb-4">
								Guess garage door sizes from Street View images. Skip if no door visible.
							</p>
						</div>
						<a href="/validation-game" class="btn-retro btn-primary w-full text-sm">
							PLAY GAME
						</a>
					</div>
				</div>

				<!-- Additional Options -->
				<div class="space-y-2 mb-6">
					<a href="/leaderboard" class="btn-retro btn-outline w-full text-sm">
						🏆 LEADERBOARD
					</a>
					<a href="/achievements" class="btn-retro btn-outline w-full text-sm">
						🎖️ ACHIEVEMENTS
					</a>
				</div>

				<!-- Logout -->
				<button on:click={logout} class="btn-retro btn-outline w-full text-sm">
					LOGOUT
				</button>

			{:else}
				<!-- Login prompt for new users -->
				<div class="space-y-6">
					<div class="text-box p-6">
						<h2 class="text-lg mb-4">Join the Garage Door Revolution!</h2>
						<p class="text-sm text-gray-300 mb-4">
							Help us build the world's most comprehensive garage door database.
							Measure real doors, play games, and earn points!
						</p>
					</div>

					<a href="/login" class="btn-retro btn-primary text-lg font-bold w-full block">
						🚀 GET STARTED
					</a>
				</div>
			{/if}
		</div>
	</div>
</section>
