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

	let features = [
		{
			icon: '🎮',
			title: 'Play & Earn',
			description: 'Guess garage door details from Street View images and earn points for correct answers.'
		},
		{
			icon: '📊',
			title: 'Submit Data',
			description: 'Upload photos and details of garage doors you encounter to help build our database.'
		},
		{
			icon: '🏆',
			title: 'Compete',
			description: 'Climb the leaderboard and compete with other players for the top spot.'
		},
		{
			icon: '💰',
			title: 'Rewards',
			description: 'Earn points for accurate guesses and valuable data submissions.'
		}
	];
</script>

<svelte:head>
	<title>Garage Door Game - Earn Points by Identifying Garage Doors</title>
	<meta name="description" content="Play the garage door identification game! Earn points by guessing garage door details from Street View images and submit your own data." />
</svelte:head>

<!-- Hero Section -->
<section class="py-20">
	<div class="max-w-4xl mx-auto px-4">
		<div class="text-center">
			<div class="text-box power-up mb-8">
				<h1 class="text-3xl md:text-4xl mb-6">
					🏠 GARAGE DOOR QUEST 🏠
				</h1>
				<p class="mb-6">
					Who Is The Best Tech?
				</p>
				<div class="flex justify-center mb-4">
					<div class="coin"></div>
					<div class="coin"></div>
					<div class="coin"></div>
				</div>
			</div>

			<div class="flex flex-col sm:flex-row gap-4 justify-center">
				{#if user}
					<a href="/game" class="btn-retro btn-success btn-lg">
						🎮 CONTINUE QUEST
					</a>
					<a href="/submit" class="btn-retro btn-warning btn-lg">
						📊 SUBMIT DATA
					</a>
				{:else}
					<a href="/login" class="btn-retro btn-primary btn-lg">
						🎮 START QUEST
					</a>
					<a href="/leaderboard" class="btn-retro btn-outline btn-lg">
						🏆 HIGH SCORES
					</a>
				{/if}
			</div>

			{#if user}
				<div class="text-box mt-6">
					<p class="text-yellow-300">
						Welcome back, <span class="text-white font-bold">{user.username}</span>!<br>
						Ready for another challenge?
					</p>
				</div>
			{/if}
		</div>
	</div>
</section>

<!-- Stats Section -->
<section class="py-16">
	<div class="max-w-6xl mx-auto px-4">
		<div class="text-box mb-8">
			<h2 class="text-2xl text-center mb-6">🏆 GLOBAL STATS 🏆</h2>
		</div>

		<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
			<div class="score-display power-up">
				<div class="score-number text-lg">
					{stats.totalPlayers.toLocaleString()}
				</div>
				<div class="text-white text-sm">PLAYERS</div>
				<div class="text-2xl">👥</div>
			</div>
			<div class="score-display power-up">
				<div class="score-number text-lg">
					{stats.gamesPlayed.toLocaleString()}
				</div>
				<div class="text-white text-sm">GAMES</div>
				<div class="text-2xl">🎮</div>
			</div>
			<div class="score-display power-up">
				<div class="score-number text-lg">
					{stats.dataSubmitted.toLocaleString()}
				</div>
				<div class="text-white text-sm">DATA</div>
				<div class="text-2xl">📊</div>
			</div>
			<div class="score-display power-up">
				<div class="score-number text-lg">
					{stats.pointsAwarded.toLocaleString()}
				</div>
				<div class="text-white text-sm">COINS</div>
				<div class="coin"></div>
			</div>
		</div>
	</div>
</section>

<!-- Features Section -->
<section class="py-20">
	<div class="max-w-6xl mx-auto px-4">
		<div class="text-box mb-8">
			<h2 class="text-2xl text-center mb-4">
				⚡ HOW IT WORKS ⚡
			</h2>
			<p class="text-center">
				Join thousands of players in building the most comprehensive<br>
				garage door database while having fun and earning coins!
			</p>
		</div>

		<div class="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
			{#each features as feature, index}
				<div class="text-box power-up text-center" style="animation-delay: {index * 0.2}s">
					<div class="text-4xl mb-4">{feature.icon}</div>
					<h3 class="text-lg text-yellow-300 mb-3">{feature.title}</h3>
					<p class="text-white text-sm">{feature.description}</p>
				</div>
			{/each}
		</div>
	</div>
</section>
