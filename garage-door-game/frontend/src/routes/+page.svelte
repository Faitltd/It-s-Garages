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
<section class="bg-gradient-to-br from-primary-600 to-primary-800 text-white">
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
		<div class="text-center">
			<h1 class="text-4xl md:text-6xl font-bold mb-6 animate-fade-in">
				🏠 Garage Door Game
			</h1>
			<p class="text-xl md:text-2xl mb-8 text-primary-100 max-w-3xl mx-auto animate-slide-up">
				Turn your knowledge of garage doors into points! Identify garage doors from Street View images and help build the world's largest garage door database.
			</p>
			<div class="flex flex-col sm:flex-row gap-4 justify-center animate-bounce-in">
				{#if user}
					<a href="/game" class="btn-lg bg-white text-primary-600 hover:bg-gray-100 font-semibold">
						🎮 Continue Playing
					</a>
					<a href="/submit" class="btn-lg border-2 border-white text-white hover:bg-white hover:text-primary-600 font-semibold">
						📊 Submit Data
					</a>
				{:else}
					<a href="/login" class="btn-lg bg-white text-primary-600 hover:bg-gray-100 font-semibold">
						🎮 Start Playing
					</a>
					<a href="/leaderboard" class="btn-lg border-2 border-white text-white hover:bg-white hover:text-primary-600 font-semibold">
						🏆 View Leaderboard
					</a>
				{/if}
			</div>

			{#if user}
				<div class="mt-6 text-primary-100">
					Welcome back, <span class="font-semibold">{user.username}</span>!
					Ready for another challenge?
				</div>
			{/if}
		</div>
	</div>
</section>

<!-- Stats Section -->
<section class="py-16 bg-white">
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
		<div class="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
			<div class="animate-fade-in">
				<div class="text-3xl md:text-4xl font-bold text-primary-600 mb-2">
					{stats.totalPlayers.toLocaleString()}
				</div>
				<div class="text-gray-600 font-medium">Players</div>
			</div>
			<div class="animate-fade-in">
				<div class="text-3xl md:text-4xl font-bold text-success-600 mb-2">
					{stats.gamesPlayed.toLocaleString()}
				</div>
				<div class="text-gray-600 font-medium">Games Played</div>
			</div>
			<div class="animate-fade-in">
				<div class="text-3xl md:text-4xl font-bold text-warning-600 mb-2">
					{stats.dataSubmitted.toLocaleString()}
				</div>
				<div class="text-gray-600 font-medium">Data Submitted</div>
			</div>
			<div class="animate-fade-in">
				<div class="text-3xl md:text-4xl font-bold text-danger-600 mb-2">
					{stats.pointsAwarded.toLocaleString()}
				</div>
				<div class="text-gray-600 font-medium">Points Awarded</div>
			</div>
		</div>
	</div>
</section>

<!-- Features Section -->
<section class="py-20 bg-gray-50">
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
		<div class="text-center mb-16">
			<h2 class="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
				How It Works
			</h2>
			<p class="text-xl text-gray-600 max-w-2xl mx-auto">
				Join thousands of players in building the most comprehensive garage door database while having fun and earning rewards.
			</p>
		</div>

		<div class="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
			{#each features as feature, index}
				<div class="card text-center hover:shadow-lg transition-shadow duration-300 animate-slide-up" style="animation-delay: {index * 0.1}s">
					<div class="text-4xl mb-4">{feature.icon}</div>
					<h3 class="text-xl font-semibold text-gray-900 mb-3">{feature.title}</h3>
					<p class="text-gray-600">{feature.description}</p>
				</div>
			{/each}
		</div>
	</div>
</section>
