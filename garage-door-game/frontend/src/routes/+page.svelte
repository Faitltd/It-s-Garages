<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	let user: any = null;


	onMount(() => {
		// Check if user is logged in
		if (browser) {
			const userData = localStorage.getItem('user');
			if (userData) {
				user = JSON.parse(userData);
			}
		}
	});


</script>

<svelte:head>
	<title>It's Garages - Garage Door Data Collection Platform</title>
	<meta name="description" content="Collect and validate garage door data with GPS-powered address detection and Street View integration." />
</svelte:head>

<!-- Hero Section -->
<section class="py-8 px-4">
	<div class="max-w-md mx-auto">
		<div class="text-center">
			<div class="text-box power-up mb-6">
				<h1 class="text-xl mb-4">
					IT'S GARAGES
				</h1>
				<p class="text-lg mb-4">
					Garage Door Data Collection Platform
				</p>
			</div>

			<div class="space-y-4">
				{#if user}
					<a href="/data-entry" class="btn-retro btn-success text-lg font-bold w-full block">
						SUBMIT DATA
					</a>
					<a href="/validation-game" class="btn-retro btn-warning w-full block">
						VALIDATION GAME
					</a>

				{:else}
					<a href="/login" class="btn-retro btn-primary text-lg font-bold w-full block">
						GET STARTED
					</a>
					<a href="/leaderboard" class="btn-retro btn-outline w-full block">
						HIGH SCORES
					</a>
				{/if}
			</div>


		</div>
	</div>
</section>




