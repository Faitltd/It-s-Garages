<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	let user: any = null;
	let stats = {
		totalPlayers: 1247,
		gamesPlayed: 8934,
		dataSubmitted: 3421,
		pointsAwarded: 156789
	};

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
	<title>Garage Door Game - Earn Points by Identifying Garage Doors</title>
	<meta name="description" content="Play the garage door identification game! Earn points by guessing garage door details from Street View images and submit your own data." />
</svelte:head>

<!-- Hero Section -->
<section class="py-8 px-4">
	<div class="max-w-md mx-auto">
		<div class="text-center">
			<div class="text-box power-up mb-6">
				<h1 class="text-xl mb-4">
					🏠 GARAGE DOOR QUEST 🏠
				</h1>
				<p class="text-lg mb-4">
					Who Is The Best Tech?
				</p>
				<div class="flex justify-center mb-2">
					<div class="coin"></div>
					<div class="coin"></div>
					<div class="coin"></div>
				</div>
			</div>

			<div class="space-y-4">
				{#if user}
					<a href="/game" class="btn-retro btn-success text-lg font-bold w-full block">
						🎮 CONTINUE QUEST
					</a>
					<a href="/submit" class="btn-retro btn-warning w-full block">
						📊 SUBMIT DATA
					</a>
				{:else}
					<a href="/login" class="btn-retro btn-primary text-lg font-bold w-full block">
						🎮 START QUEST
					</a>
					<a href="/leaderboard" class="btn-retro btn-outline w-full block">
						🏆 HIGH SCORES
					</a>
				{/if}
			</div>

			{#if user}
				<div class="text-box mt-4">
					<p class="text-yellow-300 text-sm">
						Welcome back, <span class="text-white font-bold">{user.username}</span>!<br>
						Ready for another challenge?
					</p>
				</div>
			{/if}
		</div>
	</div>
</section>

<!-- Stats Section -->
<section class="py-8 px-4">
	<div class="max-w-md mx-auto">
		<div class="text-box mb-4">
			<h2 class="text-lg mb-4">🏆 GLOBAL STATS 🏆</h2>
		</div>

		<div class="space-y-3">
			<div class="score-display power-up">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-3">
						<div class="text-2xl">👥</div>
						<div class="text-white text-sm">PLAYERS</div>
					</div>
					<div class="score-number text-lg">
						{stats.totalPlayers.toLocaleString()}
					</div>
				</div>
			</div>
			<div class="score-display power-up">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-3">
						<div class="text-2xl">🎮</div>
						<div class="text-white text-sm">GAMES</div>
					</div>
					<div class="score-number text-lg">
						{stats.gamesPlayed.toLocaleString()}
					</div>
				</div>
			</div>
			<div class="score-display power-up">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-3">
						<div class="text-2xl">📊</div>
						<div class="text-white text-sm">DATA</div>
					</div>
					<div class="score-number text-lg">
						{stats.dataSubmitted.toLocaleString()}
					</div>
				</div>
			</div>
			<div class="score-display power-up">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-3">
						<div class="coin"></div>
						<div class="text-white text-sm">COINS</div>
					</div>
					<div class="score-number text-lg">
						{stats.pointsAwarded.toLocaleString()}
					</div>
				</div>
			</div>
		</div>
	</div>
</section>


