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
		sessionId: number;
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
	let gameStarted = true; // Always start the game immediately
	let gameCompleted = false;
	let timeRemaining = 0;
	let timer: NodeJS.Timeout;
	let showLogin = false; // Control login visibility
	let user: any = null;

	// Login form data
	let email = '';
	let password = '';
	let username = '';
	let isLogin = true;

	// Game form data
	let garageCount = 1;
	let garageWidth: number | undefined = undefined;
	let garageHeight: number | undefined = undefined;
	let garageType = '';
	let confidence = 50;

	// Multiple choice options for common garage door sizes
	const garageSizeOptions = [
		{ width: '8', height: '7', label: '8\' × 7\' (Single Standard)' },
		{ width: '9', height: '7', label: '9\' × 7\' (Single Wide)' },
		{ width: '16', height: '7', label: '16\' × 7\' (Double Standard)' },
		{ width: '18', height: '7', label: '18\' × 7\' (Double Wide)' },
		{ width: '8', height: '8', label: '8\' × 8\' (Single Tall)' },
		{ width: '16', height: '8', label: '16\' × 8\' (Double Tall)' }
	];

	const garageTypeOptions = [
		{ value: 'single', label: '🏠 Single Car', emoji: '🚗' },
		{ value: 'double', label: '🏡 Double Car', emoji: '🚗🚗' },
		{ value: 'triple', label: '🏘️ Triple Car', emoji: '🚗🚗🚗' },
		{ value: 'commercial', label: '🏢 Commercial', emoji: '🚛' },
		{ value: 'other', label: '❓ Other/Custom', emoji: '🤔' }
	];

	// Selected options
	let selectedSize = '';
	let selectedType = '';

	// Functions to handle selections
	function selectSize(option: any) {
		selectedSize = `${option.width}x${option.height}`;
		garageWidth = parseFloat(option.width);
		garageHeight = parseFloat(option.height);
	}

	function selectType(option: any) {
		selectedType = option.value;
		garageType = option.value;
	}

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
		garageWidth = undefined;
		garageHeight = undefined;
		garageType = '';
		confidence = 50;
		selectedSize = '';
		selectedType = '';
	}

	// Format time display
	function formatTime(seconds: number): string {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	}

	// Login functions
	async function handleLogin() {
		if (!email || !password) {
			error = 'Please fill in all fields';
			return;
		}

		loading = true;
		error = '';

		try {
			const response = await fetch(`${API_BASE}/auth/login`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, password })
			});

			const data = await response.json();

			if (response.ok) {
				if (browser) {
					localStorage.setItem('authToken', data.data.token);
					localStorage.setItem('user', JSON.stringify(data.data.user));
				}
				user = data.data.user;
				showLogin = false;
				// Auto-start game after login
				startGame('medium');
			} else {
				error = data.error?.message || 'Login failed';
			}
		} catch (err) {
			error = 'Network error. Please try again.';
		} finally {
			loading = false;
		}
	}

	async function handleRegister() {
		if (!username || !email || !password) {
			error = 'Please fill in all fields';
			return;
		}

		loading = true;
		error = '';

		try {
			const response = await fetch(`${API_BASE}/auth/register`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ username, email, password })
			});

			const data = await response.json();

			if (response.ok) {
				if (browser) {
					localStorage.setItem('authToken', data.data.token);
					localStorage.setItem('user', JSON.stringify(data.data.user));
				}
				user = data.data.user;
				showLogin = false;
				// Auto-start game after registration
				startGame('medium');
			} else {
				error = data.error?.message || 'Registration failed';
			}
		} catch (err) {
			error = 'Network error. Please try again.';
		} finally {
			loading = false;
		}
	}

	function logout() {
		if (browser) {
			localStorage.removeItem('authToken');
			localStorage.removeItem('user');
		}
		user = null;
		showLogin = true;
		gameSession = null;
		gameCompleted = false;
	}

	onMount(() => {
		// Check if user is authenticated
		const token = getAuthToken();
		if (browser) {
			const userData = localStorage.getItem('user');
			if (userData) {
				user = JSON.parse(userData);
			}
		}

		if (!token || !user) {
			showLogin = true;
		} else {
			// Auto-start game for authenticated users
			startGame('medium');
		}
	});
</script>

<svelte:head>
	<title>Play Game - Garage Door Game</title>
</svelte:head>

<div class="min-h-screen py-8">
	<div class="max-w-6xl mx-auto px-4">
		<!-- Login Section (always visible at top) -->
		{#if showLogin}
			<div class="text-box mb-6">
				<h2 class="text-lg mb-4">
					{isLogin ? '🎮 PLAYER LOGIN 🎮' : '⭐ JOIN THE QUEST ⭐'}
				</h2>

				<div class="form-container">
					{#if !isLogin}
						<div class="form-group">
							<label class="form-label">USERNAME</label>
							<input
								type="text"
								bind:value={username}
								class="input-field"
								placeholder="Enter username"
							/>
						</div>
					{/if}

					<div class="form-group">
						<label class="form-label">EMAIL</label>
						<input
							type="email"
							bind:value={email}
							class="input-field"
							placeholder="Enter email"
						/>
					</div>

					<div class="form-group">
						<label class="form-label">PASSWORD</label>
						<input
							type="password"
							bind:value={password}
							class="input-field"
							placeholder="Enter password"
						/>
					</div>

					<button
						on:click={isLogin ? handleLogin : handleRegister}
						disabled={loading}
						class="btn-retro btn-primary"
					>
						{#if loading}
							<div class="coin"></div> LOADING...
						{:else}
							{isLogin ? '🔐 LOGIN' : '⭐ CREATE PLAYER'}
						{/if}
					</button>

					<button
						on:click={() => isLogin = !isLogin}
						class="btn-retro btn-outline"
					>
						{isLogin ? '🆕 CREATE ACCOUNT' : '🔐 LOGIN INSTEAD'}
					</button>
				</div>
			</div>
		{:else if user}
			<!-- User Info Bar -->
			<div class="text-box mb-6">
				<div class="flex justify-between items-center">
					<div>Welcome, <span class="text-yellow-300">{user.username}</span>!</div>
					<button on:click={logout} class="btn-retro btn-outline">🚪 LOGOUT</button>
				</div>
			</div>
		{/if}

		<!-- Game Interface (always visible when user is logged in) -->
		{#if !showLogin && user}
			{#if gameCompleted && scoreResult}
			<!-- Results Screen -->
			<div class="text-center">
				<div class="text-box power-up">
					<h1 class="text-2xl mb-4">🎯 LEVEL COMPLETE! 🎯</h1>
				</div>

				<div class="score-display">
					<div class="mb-4">
						<div class="score-number">{scoreResult.score}</div>
						<div class="text-white">COINS EARNED</div>
						<div class="flex justify-center mt-2">
							{#each Array(Math.min(scoreResult.score / 10, 10)) as _}
								<div class="coin"></div>
							{/each}
						</div>
					</div>

					<div class="mb-4">
						<div class="text-lg text-yellow-300">ACCURACY: {Math.round(scoreResult.accuracy * 100)}%</div>
						<p class="text-white mt-2">{scoreResult.feedback}</p>
					</div>
				</div>

				<div class="text-box">
					<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 text-sm">
						<div class="bg-green-800 p-4 border-2 border-white">
							<div class="text-yellow-300 font-bold mb-2">YOUR GUESS</div>
							<div class="text-white">🚪 Count: {garageCount}</div>
							<div class="text-white">🏠 Type: {garageType}</div>
							<div class="text-white">🎯 Confidence: {confidence}%</div>
						</div>
						<div class="bg-green-800 p-4 border-2 border-white">
							<div class="text-lime-300 font-bold mb-2">CORRECT ANSWER</div>
							<div class="text-white">🚪 Count: {scoreResult.correctAnswer.garageCount}</div>
							<div class="text-white">🏠 Type: {scoreResult.correctAnswer.garageType}</div>
							<div class="text-white">📏 Size: {Math.round(scoreResult.correctAnswer.garageWidth)}' × {Math.round(scoreResult.correctAnswer.garageHeight)}'</div>
						</div>
					</div>

					<div class="space-y-4">
						<button
							on:click={playAgain}
							class="w-full btn-retro btn-success"
						>
							🎮 PLAY AGAIN
						</button>

						<a href="/leaderboard" class="block w-full btn-retro btn-outline text-center">
							🏆 HIGH SCORES
						</a>
					</div>
				</div>
			</div>
		{:else if gameSession}
			<!-- Game Play Screen -->
			<div class="max-w-6xl mx-auto">
				<!-- Game Header -->
				<div class="text-box mb-4">
					<div class="flex justify-between items-center">
						<h2 class="text-lg">📍 {gameSession.location.address}</h2>
						<div class="text-lg font-bold {timeRemaining <= 10 ? 'text-red-400' : 'text-yellow-300'}">
							⏱️ {formatTime(timeRemaining)}
						</div>
					</div>
					<div class="text-center mt-2">
						<span class="text-yellow-300">DIFFICULTY: {gameSession.difficulty.toUpperCase()}</span>
					</div>
				</div>

				<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
					<!-- Street View Image -->
					<div class="text-box p-2">
						<div class="aspect-square border-4 border-white">
							<img
								src={gameSession.streetViewUrl}
								alt="Street View"
								class="w-full h-full object-cover"
								on:error={() => error = 'Failed to load Street View image'}
							/>
						</div>
					</div>

					<!-- Game Questions -->
					<div class="space-y-4">
						<!-- Question 1: Garage Count -->
						<div class="text-box">
							<h3 class="text-lg mb-4 text-center">🚪 HOW MANY GARAGE DOORS?</h3>
							<div class="choice-container">
								{#each [0, 1, 2, 3, 4] as count}
									<button
										class="choice-option {garageCount === count ? 'selected' : ''}"
										on:click={() => garageCount = count}
									>
										{count === 0 ? 'NONE' : count === 4 ? '4+' : count}
										<br>
										<small>{count === 0 ? '🚫' : count === 1 ? '🚗' : count === 2 ? '🚗🚗' : count === 3 ? '🚗🚗🚗' : '🚗🚗🚗+'}</small>
									</button>
								{/each}
							</div>
						</div>

						<!-- Question 2: Garage Type -->
						<div class="text-box">
							<h3 class="text-lg mb-4 text-center">🏠 WHAT TYPE OF GARAGE?</h3>
							<div class="choice-container">
								{#each garageTypeOptions as option}
									<button
										class="choice-option {selectedType === option.value ? 'selected' : ''}"
										on:click={() => selectType(option)}
									>
										{option.emoji}
										<br>
										<small>{option.label}</small>
									</button>
								{/each}
							</div>
						</div>

						<!-- Question 3: Garage Size -->
						<div class="text-box">
							<h3 class="text-lg mb-4 text-center">📏 WHAT SIZE IS IT?</h3>
							<div class="choice-container">
								{#each garageSizeOptions as option}
									<button
										class="choice-option {selectedSize === `${option.width}x${option.height}` ? 'selected' : ''}"
										on:click={() => selectSize(option)}
									>
										{option.label}
									</button>
								{/each}
							</div>
						</div>

						<!-- Confidence Slider -->
						<div class="text-box">
							<h3 class="text-lg mb-4 text-center">🎯 HOW CONFIDENT ARE YOU?</h3>
							<div class="text-center mb-4">
								<span class="text-2xl text-yellow-300">{confidence}%</span>
							</div>
							<input
								type="range"
								bind:value={confidence}
								min="0"
								max="100"
								step="10"
								class="slider w-full"
							/>
							<div class="flex justify-between text-xs text-white mt-2">
								<span>😕 GUESS</span>
								<span>😐 MAYBE</span>
								<span>😊 SURE</span>
								<span>😎 CERTAIN</span>
							</div>
						</div>

						<!-- Submit Button -->
						<div class="text-box text-center">
							<button
								on:click={submitGuess}
								disabled={loading || timeRemaining <= 0 || !garageCount || !selectedType || !selectedSize}
								class="btn-retro btn-primary w-full"
							>
								{#if loading}
									<div class="flex items-center justify-center">
										<div class="coin mr-2"></div>
										SUBMITTING...
									</div>
								{:else}
									🎯 SUBMIT ANSWER
								{/if}
							</button>
						</div>

						{#if error}
							<div class="text-box bg-red-600 text-white text-center">
								💥 ERROR: {error}
							</div>
						{/if}
					</div>
				</div>
			</div>
			{:else}
				<!-- Game Play Interface -->
				{#if gameSession}
					<!-- Game Header -->
					<div class="text-box mb-4">
						<div class="flex justify-between items-center">
							<h2 class="text-lg">📍 {gameSession.location.address}</h2>
							<div class="text-lg font-bold {timeRemaining <= 10 ? 'text-red-400' : 'text-yellow-300'}">
								⏱️ {formatTime(timeRemaining)}
							</div>
						</div>
						<div class="text-center mt-2">
							<span class="text-yellow-300">DIFFICULTY: {gameSession.difficulty.toUpperCase()}</span>
						</div>
					</div>

					<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
						<!-- Street View Image -->
						<div class="text-box p-2">
							<div class="aspect-square border-4 border-white">
								<img
									src={gameSession.streetViewUrl}
									alt="Street View"
									class="w-full h-full object-cover"
									on:error={() => error = 'Failed to load Street View image'}
								/>
							</div>
						</div>

						<!-- Game Questions -->
						<div class="space-y-4">
							<!-- Question 1: Garage Count -->
							<div class="text-box">
								<h3 class="text-lg mb-4 text-center">🚪 HOW MANY GARAGE DOORS?</h3>
								<div class="choice-container">
									{#each [0, 1, 2, 3, 4] as count}
										<button
											class="choice-option {garageCount === count ? 'selected' : ''}"
											on:click={() => garageCount = count}
										>
											{count === 0 ? 'NONE' : count === 4 ? '4+' : count}
											<br>
											<small>{count === 0 ? '🚫' : count === 1 ? '🚗' : count === 2 ? '🚗🚗' : count === 3 ? '🚗🚗🚗' : '🚗🚗🚗+'}</small>
										</button>
									{/each}
								</div>
							</div>

							<!-- Question 2: Garage Type -->
							<div class="text-box">
								<h3 class="text-lg mb-4 text-center">🏠 WHAT TYPE OF GARAGE?</h3>
								<div class="choice-container">
									{#each garageTypeOptions as option}
										<button
											class="choice-option {selectedType === option.value ? 'selected' : ''}"
											on:click={() => selectType(option)}
										>
											{option.emoji}
											<br>
											<small>{option.label}</small>
										</button>
									{/each}
								</div>
							</div>

							<!-- Question 3: Garage Size -->
							<div class="text-box">
								<h3 class="text-lg mb-4 text-center">📏 WHAT SIZE IS IT?</h3>
								<div class="choice-container">
									{#each garageSizeOptions as option}
										<button
											class="choice-option {selectedSize === `${option.width}x${option.height}` ? 'selected' : ''}"
											on:click={() => selectSize(option)}
										>
											{option.label}
										</button>
									{/each}
								</div>
							</div>

							<!-- Confidence Slider -->
							<div class="text-box">
								<h3 class="text-lg mb-4 text-center">🎯 HOW CONFIDENT ARE YOU?</h3>
								<div class="text-center mb-4">
									<span class="text-2xl text-yellow-300">{confidence}%</span>
								</div>
								<input
									type="range"
									bind:value={confidence}
									min="0"
									max="100"
									step="10"
									class="slider w-full"
								/>
								<div class="flex justify-between text-xs text-white mt-2">
									<span>😕 GUESS</span>
									<span>😐 MAYBE</span>
									<span>😊 SURE</span>
									<span>😎 CERTAIN</span>
								</div>
							</div>

							<!-- Submit Button -->
							<div class="text-box text-center">
								<button
									on:click={submitGuess}
									disabled={loading || timeRemaining <= 0 || !garageCount || !selectedType || !selectedSize}
									class="btn-retro btn-primary w-full"
								>
									{#if loading}
										<div class="flex items-center justify-center">
											<div class="coin mr-2"></div>
											SUBMITTING...
										</div>
									{:else}
										🎯 SUBMIT ANSWER
									{/if}
								</button>
							</div>
						</div>
					</div>
				{:else}
					<!-- Loading new game -->
					<div class="text-box text-center">
						<div class="coin"></div>
						<div class="coin"></div>
						<div class="coin"></div>
						<p class="mt-4">LOADING NEW GAME...</p>
					</div>
				{/if}
			{/if}
		{/if}

		{#if error}
			<div class="text-box text-center" style="background: linear-gradient(45deg, #dc2626, #991b1b);">
				<div class="text-yellow-300">💥 ERROR 💥</div>
				<div class="text-white mt-2">{error}</div>
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
