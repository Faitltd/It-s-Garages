<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { getApiBase } from '$lib/config';

	const API_BASE = getApiBase();

	interface Achievement {
		id: string;
		name: string;
		description: string;
		emoji: string;
		category: string;
		requirement: string;
		points: number;
		unlocked: boolean;
		unlocked_at?: string;
		progress?: number;
		max_progress?: number;
	}

	let achievements: Achievement[] = [];
	let loading = true;
	let error = '';
	let user: any = null;
	let stats = {
		total_achievements: 0,
		unlocked_achievements: 0,
		total_points: 0,
		completion_percentage: 0
	};

	// Achievement definitions
	const achievementDefinitions: Achievement[] = [
		{
			id: 'first_game',
			name: 'First Steps',
			description: 'Play your first game',
			emoji: '🎮',
			category: 'Getting Started',
			requirement: 'Complete 1 game',
			points: 10,
			unlocked: false,
			max_progress: 1
		},
		{
			id: 'accuracy_master',
			name: 'Accuracy Master',
			description: 'Achieve 90% accuracy over 10 games',
			emoji: '🎯',
			category: 'Skill',
			requirement: '90% accuracy in 10+ games',
			points: 50,
			unlocked: false,
			max_progress: 10
		},
		{
			id: 'data_contributor',
			name: 'Data Contributor',
			description: 'Submit 5 garage door photos',
			emoji: '📊',
			category: 'Community',
			requirement: 'Submit 5 photos',
			points: 25,
			unlocked: false,
			max_progress: 5
		},
		{
			id: 'speed_demon',
			name: 'Speed Demon',
			description: 'Complete a game in under 10 seconds',
			emoji: '⚡',
			category: 'Skill',
			requirement: 'Complete game in <10s',
			points: 30,
			unlocked: false,
			max_progress: 1
		},
		{
			id: 'perfectionist',
			name: 'Perfectionist',
			description: 'Get 5 perfect scores in a row',
			emoji: '💎',
			category: 'Skill',
			requirement: '5 consecutive perfect scores',
			points: 75,
			unlocked: false,
			max_progress: 5
		},
		{
			id: 'explorer',
			name: 'Explorer',
			description: 'Play games in 10 different locations',
			emoji: '🗺️',
			category: 'Exploration',
			requirement: 'Play in 10 locations',
			points: 40,
			unlocked: false,
			max_progress: 10
		},
		{
			id: 'veteran',
			name: 'Veteran Player',
			description: 'Play 100 games',
			emoji: '🏆',
			category: 'Dedication',
			requirement: 'Play 100 games',
			points: 100,
			unlocked: false,
			max_progress: 100
		},
		{
			id: 'social_butterfly',
			name: 'Social Butterfly',
			description: 'Refer 3 friends to the game',
			emoji: '🦋',
			category: 'Community',
			requirement: 'Refer 3 friends',
			points: 60,
			unlocked: false,
			max_progress: 3
		}
	];

	onMount(async () => {
		// Check if user is logged in
		if (browser) {
			const userData = localStorage.getItem('user');
			if (userData) {
				user = JSON.parse(userData);
				await loadAchievements();
			} else {
				// Show achievements without progress for non-logged-in users
				achievements = achievementDefinitions;
				loading = false;
			}
		}
	});

	async function loadAchievements() {
		loading = true;
		error = '';
		
		try {
			const token = localStorage.getItem('token');
			const response = await fetch(`${API_BASE}/users/achievements`, {
				headers: {
					'Authorization': `Bearer ${token}`,
					'Content-Type': 'application/json'
				}
			});

			if (response.ok) {
				const data = await response.json();
				achievements = data.achievements || achievementDefinitions;
				stats = data.stats || stats;
			} else {
				// Fallback to static achievements
				achievements = achievementDefinitions;
			}
		} catch (err) {
			console.error('Achievements error:', err);
			achievements = achievementDefinitions;
		} finally {
			loading = false;
		}
	}

	function getCategoryColor(category: string) {
		const colors: Record<string, string> = {
			'Getting Started': 'text-green-400',
			'Skill': 'text-blue-400',
			'Community': 'text-purple-400',
			'Exploration': 'text-yellow-400',
			'Dedication': 'text-red-400'
		};
		return colors[category] || 'text-white';
	}

	function getProgressPercentage(achievement: Achievement) {
		if (!achievement.max_progress) return 0;
		return Math.min(100, ((achievement.progress || 0) / achievement.max_progress) * 100);
	}

	const categories = [...new Set(achievementDefinitions.map(a => a.category))];
</script>

<svelte:head>
	<title>Achievements - Garage Door Game</title>
	<meta name="description" content="Track your progress and unlock achievements in the garage door game!" />
</svelte:head>

<div class="container mx-auto px-4 py-8 max-w-4xl">
	<!-- Header -->
	<div class="text-box mb-6">
		<h1 class="text-xl mb-4 text-center">🏅 ACHIEVEMENTS 🏅</h1>
		<p class="text-center text-sm">
			Unlock rewards by mastering the game
		</p>
	</div>

	<!-- Stats Overview -->
	{#if user}
		<div class="text-box power-up mb-6">
			<div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
				<div>
					<div class="text-2xl font-bold text-yellow-300">{stats.unlocked_achievements}</div>
					<div class="text-sm">Unlocked</div>
				</div>
				<div>
					<div class="text-2xl font-bold text-white">{stats.total_achievements}</div>
					<div class="text-sm">Total</div>
				</div>
				<div>
					<div class="text-2xl font-bold text-green-400">{stats.total_points}</div>
					<div class="text-sm">Points</div>
				</div>
				<div>
					<div class="text-2xl font-bold text-blue-400">{Math.round(stats.completion_percentage)}%</div>
					<div class="text-sm">Complete</div>
				</div>
			</div>
		</div>
	{/if}

	<!-- Loading State -->
	{#if loading}
		<div class="text-box text-center">
			<div class="text-2xl mb-4">⏳</div>
			<p>Loading achievements...</p>
		</div>
	{/if}

	<!-- Achievements by Category -->
	{#if !loading}
		{#each categories as category}
			<div class="mb-8">
				<div class="text-box mb-4">
					<h2 class="text-lg {getCategoryColor(category)}">{category}</h2>
				</div>

				<div class="space-y-3">
					{#each achievements.filter(a => a.category === category) as achievement}
						<div class="score-display {achievement.unlocked ? 'power-up' : ''}">
							<div class="flex items-center justify-between">
								<div class="flex items-center gap-4">
									<!-- Achievement Icon -->
									<div class="text-3xl {achievement.unlocked ? '' : 'grayscale opacity-50'}">
										{achievement.emoji}
									</div>
									
									<!-- Achievement Info -->
									<div class="flex-1">
										<div class="flex items-center gap-2">
											<h3 class="text-white font-bold">{achievement.name}</h3>
											{#if achievement.unlocked}
												<span class="text-green-400 text-sm">✓</span>
											{/if}
										</div>
										<p class="text-sm text-gray-300 mb-1">{achievement.description}</p>
										<p class="text-xs text-yellow-300">{achievement.requirement}</p>
										
										<!-- Progress Bar -->
										{#if !achievement.unlocked && achievement.max_progress && user}
											<div class="mt-2">
												<div class="bg-gray-700 h-2 rounded-full overflow-hidden">
													<div 
														class="bg-yellow-400 h-full transition-all duration-300"
														style="width: {getProgressPercentage(achievement)}%"
													></div>
												</div>
												<div class="text-xs text-gray-400 mt-1">
													{achievement.progress || 0} / {achievement.max_progress}
												</div>
											</div>
										{/if}
									</div>
								</div>

								<!-- Points -->
								<div class="text-right">
									<div class="text-lg font-bold text-yellow-300">
										{achievement.points}
									</div>
									<div class="text-xs text-gray-400">points</div>
									{#if achievement.unlocked && achievement.unlocked_at}
										<div class="text-xs text-green-400 mt-1">
											Unlocked {new Date(achievement.unlocked_at).toLocaleDateString()}
										</div>
									{/if}
								</div>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/each}
	{/if}

	<!-- Call to Action for Non-Logged-In Users -->
	{#if !user}
		<div class="text-box text-center mt-8">
			<h2 class="text-lg mb-4">TRACK YOUR PROGRESS</h2>
			<p class="mb-4">Sign up to unlock achievements and earn points!</p>
			<a href="/login" class="btn-retro btn-success">
				CREATE ACCOUNT
			</a>
		</div>
	{/if}
</div>

<style>
	.grayscale {
		filter: grayscale(100%);
	}
</style>
