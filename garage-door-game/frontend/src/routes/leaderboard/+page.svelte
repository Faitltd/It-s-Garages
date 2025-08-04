<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { getApiBase } from '$lib/config';

	const API_BASE = getApiBase();

	interface LeaderboardEntry {
		id: number;
		username: string;
		total_points: number;
		games_played: number;
		accuracy: number;
		data_submitted: number;
		rank: number;
		achievements: string[];
		last_active: string;
	}

	let leaderboard: LeaderboardEntry[] = [];
	let loading = true;
	let error = '';
	let currentUser: any = null;
	let userRank: LeaderboardEntry | null = null;
	let timeFilter = 'all'; // all, week, month
	let categoryFilter = 'points'; // points, accuracy, games

	onMount(async () => {
		// Check if user is logged in
		if (browser) {
			const userData = localStorage.getItem('user');
			if (userData) {
				currentUser = JSON.parse(userData);
			}
		}
		
		await loadLeaderboard();
	});

	async function loadLeaderboard() {
		loading = true;
		error = '';
		
		try {
			const response = await fetch(`${API_BASE}/leaderboard?period=${timeFilter}&category=${categoryFilter}`, {
				headers: {
					'Content-Type': 'application/json'
				}
			});

			if (response.ok) {
				const data = await response.json();
				leaderboard = data.leaderboard || [];
				
				// Get current user's rank if logged in
				if (currentUser) {
					const rankResponse = await fetch(`${API_BASE}/leaderboard/rank/${currentUser.id}`);
					if (rankResponse.ok) {
						const rankData = await rankResponse.json();
						userRank = rankData.user;
					}
				}
			} else {
				error = 'Failed to load leaderboard';
			}
		} catch (err) {
			error = 'Network error. Please try again.';
			console.error('Leaderboard error:', err);
		} finally {
			loading = false;
		}
	}

	function formatDate(dateString: string) {
		return new Date(dateString).toLocaleDateString();
	}

	function getAchievementEmoji(achievement: string) {
		const emojiMap: Record<string, string> = {
			'first_game': '🎮',
			'accuracy_master': '🎯',
			'data_contributor': '📊',
			'speed_demon': '⚡',
			'perfectionist': '💎',
			'explorer': '🗺️',
			'veteran': '🏆'
		};
		return emojiMap[achievement] || '🏅';
	}

	async function handleFilterChange() {
		await loadLeaderboard();
	}
</script>

<svelte:head>
	<title>Leaderboard - Garage Door Game</title>
	<meta name="description" content="See the top players in the garage door identification game!" />
</svelte:head>

<div class="container mx-auto px-4 py-8 max-w-4xl">
	<!-- Header -->
	<div class="text-box mb-6">
		<h1 class="text-xl mb-4 text-center">🏆 LEADERBOARD 🏆</h1>
		<p class="text-center text-sm">
			Top garage door identification experts
		</p>
	</div>

	<!-- Filters -->
	<div class="text-box mb-6">
		<div class="grid grid-cols-2 gap-4">
			<div>
				<label class="block text-white text-sm mb-2">TIME PERIOD</label>
				<select bind:value={timeFilter} on:change={handleFilterChange} class="retro-select w-full">
					<option value="all">All Time</option>
					<option value="month">This Month</option>
					<option value="week">This Week</option>
				</select>
			</div>
			<div>
				<label class="block text-white text-sm mb-2">CATEGORY</label>
				<select bind:value={categoryFilter} on:change={handleFilterChange} class="retro-select w-full">
					<option value="points">Total Points</option>
					<option value="accuracy">Accuracy</option>
					<option value="games">Games Played</option>
				</select>
			</div>
		</div>
	</div>

	<!-- Current User Rank -->
	{#if currentUser && userRank}
		<div class="text-box power-up mb-6">
			<h2 class="text-lg mb-3">YOUR RANK</h2>
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-3">
					<div class="text-2xl">#{userRank.rank}</div>
					<div>
						<div class="text-white font-bold">{userRank.username}</div>
						<div class="text-yellow-300 text-sm">{userRank.total_points} points</div>
					</div>
				</div>
				<div class="text-right">
					<div class="text-sm text-white">Accuracy: {Math.round(userRank.accuracy)}%</div>
					<div class="text-sm text-yellow-300">{userRank.games_played} games</div>
				</div>
			</div>
		</div>
	{/if}

	<!-- Loading State -->
	{#if loading}
		<div class="text-box text-center">
			<div class="text-2xl mb-4">⏳</div>
			<p>Loading leaderboard...</p>
		</div>
	{/if}

	<!-- Error State -->
	{#if error}
		<div class="text-box text-center">
			<div class="text-2xl mb-4">❌</div>
			<p class="text-red-300">{error}</p>
			<button on:click={loadLeaderboard} class="btn-retro btn-primary mt-4">
				TRY AGAIN
			</button>
		</div>
	{/if}

	<!-- Leaderboard -->
	{#if !loading && !error && leaderboard.length > 0}
		<div class="space-y-3">
			{#each leaderboard as player, index}
				<div class="score-display {currentUser && player.id === currentUser.id ? 'power-up' : ''}">
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-4">
							<!-- Rank -->
							<div class="text-2xl font-bold {index < 3 ? 'text-yellow-300' : 'text-white'}">
								{#if index === 0}🥇
								{:else if index === 1}🥈
								{:else if index === 2}🥉
								{:else}#{player.rank}
								{/if}
							</div>
							
							<!-- Player Info -->
							<div>
								<div class="text-white font-bold">{player.username}</div>
								<div class="text-yellow-300 text-sm">
									{player.total_points} points • {Math.round(player.accuracy)}% accuracy
								</div>
								<div class="text-xs text-gray-300">
									{player.games_played} games • {player.data_submitted} submissions
								</div>
							</div>
						</div>

						<!-- Achievements -->
						<div class="text-right">
							<div class="flex gap-1 justify-end mb-1">
								{#each player.achievements.slice(0, 3) as achievement}
									<span class="text-lg" title={achievement}>
										{getAchievementEmoji(achievement)}
									</span>
								{/each}
								{#if player.achievements.length > 3}
									<span class="text-sm text-yellow-300">+{player.achievements.length - 3}</span>
								{/if}
							</div>
							<div class="text-xs text-gray-300">
								Last active: {formatDate(player.last_active)}
							</div>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Empty State -->
	{#if !loading && !error && leaderboard.length === 0}
		<div class="text-box text-center">
			<div class="text-4xl mb-4">🏆</div>
			<h2 class="text-lg mb-4">No Players Yet</h2>
			<p class="mb-4">Be the first to join the leaderboard!</p>
			<a href="/game" class="btn-retro btn-primary">
				START PLAYING
			</a>
		</div>
	{/if}

	<!-- Call to Action -->
	{#if !currentUser}
		<div class="text-box text-center mt-8">
			<h2 class="text-lg mb-4">JOIN THE COMPETITION</h2>
			<p class="mb-4">Create an account to track your progress and compete!</p>
			<a href="/login" class="btn-retro btn-success">
				SIGN UP NOW
			</a>
		</div>
	{/if}
</div>

<style>
	.retro-select {
		background: #2a2a2a;
		border: 2px solid #fff;
		color: #fff;
		padding: 8px 12px;
		font-family: 'Press Start 2P', monospace;
		font-size: 10px;
	}

	.retro-select:focus {
		outline: none;
		border-color: #ffd700;
	}
</style>
