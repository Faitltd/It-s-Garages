<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';

	interface GameSession {
		sessionId: number;
		streetViewUrl: string;
		location: {
			lat: number;
			lng: number;
			address: string;
		};
		difficulty: string;
		timeLimit: number;
	}

	interface GameGuess {
		garageCount: number;
		garageWidth?: number;
		garageHeight?: number;
		garageType?: string;
		confidence: number;
	}

	interface ScoreResult {
		score: number;
		accuracy: number;
		feedback: string;
		correctAnswer: any;
		breakdown: any;
	}

	let gameSession: GameSession | null = null;
	let loading = false;
	let error = '';
	let gameStarted = false;
	let gameCompleted = false;
	let timeRemaining = 0;
	let timer: NodeJS.Timeout;

	// Game form data
	let garageCount = 1;
	let garageWidth = 8;
	let garageHeight = 7;
	let garageType = 'single';
	let confidence = 50;

	// Results
	let scoreResult: ScoreResult | null = null;

	const API_BASE = 'http://localhost:3001/api';

	// Get auth token from localStorage
	function getAuthToken(): string | null {
		if (!browser) return null;
		return localStorage.getItem('authToken');
	}

	// API call helper
	async function apiCall(endpoint: string, options: RequestInit = {}) {
		const token = getAuthToken();
		if (!token) {
			goto('/login');
			return null;
		}

		const response = await fetch(`${API_BASE}${endpoint}`, {
			...options,
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${token}`,
				...options.headers
			}
		});

		if (response.status === 401) {
			localStorage.removeItem('authToken');
			goto('/login');
			return null;
		}

		return response;
	}

	// Start a new game
	async function startGame(difficulty: string = 'medium') {
		loading = true;
		error = '';

		try {
			const response = await apiCall('/game/start', {
				method: 'POST',
				body: JSON.stringify({ difficulty })
			});

			if (!response) return;

			if (response.ok) {
				const data = await response.json();
				gameSession = data.data;
				gameStarted = true;
				timeRemaining = gameSession!.timeLimit;
				startTimer();
			} else {
				const errorData = await response.json();
				error = errorData.error?.message || 'Failed to start game';
			}
		} catch (err) {
			error = 'Network error. Please try again.';
			console.error('Start game error:', err);
		} finally {
			loading = false;
		}
	}

	// Start countdown timer
	function startTimer() {
		timer = setInterval(() => {
			timeRemaining--;
			if (timeRemaining <= 0) {
				clearInterval(timer);
				submitGuess(); // Auto-submit when time runs out
			}
		}, 1000);
	}

	// Submit guess
	async function submitGuess() {
		if (!gameSession || gameCompleted) return;

		loading = true;
		clearInterval(timer);

		try {
			const guess: GameGuess = {
				sessionId: gameSession.sessionId,
				garageCount,
				garageWidth: garageWidth || undefined,
				garageHeight: garageHeight || undefined,
				garageType: garageType || undefined,
				confidence
			};

			const response = await apiCall('/game/guess', {
				method: 'POST',
				body: JSON.stringify(guess)
			});

			if (!response) return;

			if (response.ok) {
				const data = await response.json();
				scoreResult = data.data;
				gameCompleted = true;
			} else {
				const errorData = await response.json();
				error = errorData.error?.message || 'Failed to submit guess';
			}
		} catch (err) {
			error = 'Network error. Please try again.';
			console.error('Submit guess error:', err);
		} finally {
			loading = false;
		}
	}

	// Play again
	function playAgain() {
		gameSession = null;
		gameStarted = false;
		gameCompleted = false;
		scoreResult = null;
		error = '';
		garageCount = 1;
		garageWidth = 8;
		garageHeight = 7;
		garageType = 'single';
		confidence = 50;
	}

	// Format time display
	function formatTime(seconds: number): string {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	}

	onMount(() => {
		// Check if user is authenticated
		if (!getAuthToken()) {
			goto('/login');
		}
	});
</script>

<svelte:head>
	<title>Play Game - Garage Door Game</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 py-8">
	<div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
		{#if !gameStarted}
			<!-- Game Start Screen -->
			<div class="text-center">
				<h1 class="text-4xl font-bold text-gray-900 mb-8">🎮 Garage Door Game</h1>
				<p class="text-lg text-gray-600 mb-8">
					Test your skills at identifying garage doors from Street View images!
				</p>

				<div class="bg-white rounded-lg shadow-md p-8 max-w-md mx-auto">
					<h2 class="text-2xl font-semibold mb-6">Choose Difficulty</h2>
					
					<div class="space-y-4">
						<button
							on:click={() => startGame('easy')}
							disabled={loading}
							class="w-full btn-primary py-3 text-lg"
						>
							🟢 Easy (60 seconds)
						</button>
						
						<button
							on:click={() => startGame('medium')}
							disabled={loading}
							class="w-full btn-primary py-3 text-lg"
						>
							🟡 Medium (45 seconds)
						</button>
						
						<button
							on:click={() => startGame('hard')}
							disabled={loading}
							class="w-full btn-primary py-3 text-lg"
						>
							🔴 Hard (30 seconds)
						</button>
					</div>

					{#if loading}
						<div class="mt-4 text-center">
							<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
							<p class="mt-2 text-gray-600">Starting game...</p>
						</div>
					{/if}

					{#if error}
						<div class="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
							{error}
						</div>
					{/if}
				</div>
			</div>
		{:else if gameCompleted && scoreResult}
			<!-- Results Screen -->
			<div class="text-center">
				<h1 class="text-4xl font-bold text-gray-900 mb-8">🎯 Game Results</h1>
				
				<div class="bg-white rounded-lg shadow-md p-8 max-w-2xl mx-auto">
					<div class="mb-6">
						<div class="text-6xl font-bold text-primary-600 mb-2">{scoreResult.score}</div>
						<div class="text-xl text-gray-600">Points Earned</div>
					</div>

					<div class="mb-6">
						<div class="text-2xl font-semibold mb-2">Accuracy: {Math.round(scoreResult.accuracy * 100)}%</div>
						<p class="text-lg text-gray-600">{scoreResult.feedback}</p>
					</div>

					<div class="grid grid-cols-2 gap-4 mb-6 text-sm">
						<div class="bg-gray-50 p-3 rounded">
							<div class="font-semibold">Your Guess</div>
							<div>Count: {garageCount}</div>
							<div>Type: {garageType}</div>
							<div>Confidence: {confidence}%</div>
						</div>
						<div class="bg-gray-50 p-3 rounded">
							<div class="font-semibold">Correct Answer</div>
							<div>Count: {scoreResult.correctAnswer.garageCount}</div>
							<div>Type: {scoreResult.correctAnswer.garageType}</div>
							<div>Size: {Math.round(scoreResult.correctAnswer.garageWidth)}' × {Math.round(scoreResult.correctAnswer.garageHeight)}'</div>
						</div>
					</div>

					<div class="space-y-4">
						<button
							on:click={playAgain}
							class="w-full btn-primary py-3 text-lg"
						>
							🎮 Play Again
						</button>
						
						<a href="/leaderboard" class="block w-full btn-outline py-3 text-lg text-center">
							🏆 View Leaderboard
						</a>
					</div>
				</div>
			</div>
		{:else if gameSession}
			<!-- Game Play Screen -->
			<div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
				<!-- Street View Image -->
				<div class="bg-white rounded-lg shadow-md overflow-hidden">
					<div class="p-4 bg-gray-50 border-b">
						<div class="flex justify-between items-center">
							<h2 class="text-lg font-semibold">📍 {gameSession.location.address}</h2>
							<div class="text-lg font-mono font-bold {timeRemaining <= 10 ? 'text-red-600' : 'text-gray-900'}">
								⏱️ {formatTime(timeRemaining)}
							</div>
						</div>
						<div class="text-sm text-gray-600 mt-1">
							Difficulty: <span class="capitalize font-medium">{gameSession.difficulty}</span>
						</div>
					</div>
					
					<div class="aspect-square">
						<img
							src={gameSession.streetViewUrl}
							alt="Street View"
							class="w-full h-full object-cover"
							on:error={() => error = 'Failed to load Street View image'}
						/>
					</div>
				</div>

				<!-- Game Form -->
				<div class="bg-white rounded-lg shadow-md p-6">
					<h2 class="text-2xl font-semibold mb-6">🏠 Identify the Garage Doors</h2>
					
					<form on:submit|preventDefault={submitGuess} class="space-y-6">
						<!-- Garage Count -->
						<div>
							<label class="block text-sm font-medium text-gray-700 mb-2">
								Number of Garage Doors *
							</label>
							<select bind:value={garageCount} class="input-field">
								<option value={0}>0 - No garage doors visible</option>
								<option value={1}>1 - Single door</option>
								<option value={2}>2 - Two doors</option>
								<option value={3}>3 - Three doors</option>
								<option value={4}>4+ - Four or more doors</option>
							</select>
						</div>

						<!-- Garage Type -->
						<div>
							<label class="block text-sm font-medium text-gray-700 mb-2">
								Garage Type
							</label>
							<select bind:value={garageType} class="input-field">
								<option value="single">Single Car</option>
								<option value="double">Double Car</option>
								<option value="triple">Triple Car</option>
								<option value="commercial">Commercial</option>
								<option value="other">Other</option>
							</select>
						</div>

						<!-- Size Estimation -->
						<div class="grid grid-cols-2 gap-4">
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-2">
									Width (feet)
								</label>
								<input
									type="number"
									bind:value={garageWidth}
									min="6"
									max="30"
									step="0.5"
									class="input-field"
								/>
							</div>
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-2">
									Height (feet)
								</label>
								<input
									type="number"
									bind:value={garageHeight}
									min="6"
									max="12"
									step="0.5"
									class="input-field"
								/>
							</div>
						</div>

						<!-- Confidence -->
						<div>
							<label class="block text-sm font-medium text-gray-700 mb-2">
								Confidence Level: {confidence}%
							</label>
							<input
								type="range"
								bind:value={confidence}
								min="0"
								max="100"
								step="5"
								class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
							/>
							<div class="flex justify-between text-xs text-gray-500 mt-1">
								<span>Not sure</span>
								<span>Very confident</span>
							</div>
						</div>

						<!-- Submit Button -->
						<button
							type="submit"
							disabled={loading || timeRemaining <= 0}
							class="w-full btn-primary py-3 text-lg font-semibold"
						>
							{#if loading}
								<div class="flex items-center justify-center">
									<div class="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
									Submitting...
								</div>
							{:else}
								🎯 Submit Guess
							{/if}
						</button>
					</form>

					{#if error}
						<div class="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
							{error}
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	.slider::-webkit-slider-thumb {
		appearance: none;
		height: 20px;
		width: 20px;
		border-radius: 50%;
		background: #3b82f6;
		cursor: pointer;
	}

	.slider::-moz-range-thumb {
		height: 20px;
		width: 20px;
		border-radius: 50%;
		background: #3b82f6;
		cursor: pointer;
		border: none;
	}
</style>
