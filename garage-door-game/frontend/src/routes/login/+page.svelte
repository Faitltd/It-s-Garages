<script lang="ts">
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';

	let email = '';
	let password = '';
	let loading = false;
	let error = '';
	let isLogin = true; // Toggle between login and register

	// Registration fields
	let username = '';
	let confirmPassword = '';

	const API_BASE = 'https://garage-door-backend-341270520862.us-central1.run.app/api';

	// Handle login
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
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ email, password })
			});

			const data = await response.json();

			if (response.ok) {
				// Store token in localStorage
				if (browser) {
					localStorage.setItem('authToken', data.data.token);
					localStorage.setItem('user', JSON.stringify(data.data.user));
				}
				goto('/game');
			} else {
				error = data.error?.message || 'Login failed';
			}
		} catch (err) {
			error = 'Network error. Please try again.';
			console.error('Login error:', err);
		} finally {
			loading = false;
		}
	}

	// Handle registration
	async function handleRegister() {
		if (!username || !email || !password || !confirmPassword) {
			error = 'Please fill in all fields';
			return;
		}

		if (password !== confirmPassword) {
			error = 'Passwords do not match';
			return;
		}

		loading = true;
		error = '';

		try {
			const response = await fetch(`${API_BASE}/auth/register`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ username, email, password, confirmPassword })
			});

			const data = await response.json();

			if (response.ok) {
				// Store token in localStorage
				if (browser) {
					localStorage.setItem('authToken', data.data.token);
					localStorage.setItem('user', JSON.stringify(data.data.user));
				}
				goto('/game');
			} else {
				error = data.error?.message || 'Registration failed';
			}
		} catch (err) {
			error = 'Network error. Please try again.';
			console.error('Registration error:', err);
		} finally {
			loading = false;
		}
	}

	// Handle form submission
	function handleSubmit() {
		if (isLogin) {
			handleLogin();
		} else {
			handleRegister();
		}
	}

	// Toggle between login and register
	function toggleMode() {
		isLogin = !isLogin;
		error = '';
		// Clear form fields when switching
		email = '';
		password = '';
		username = '';
		confirmPassword = '';
	}
</script>

<svelte:head>
	<title>{isLogin ? 'Login' : 'Register'} - Garage Door Game</title>
</svelte:head>

<div class="min-h-screen flex flex-col justify-center py-12 px-4">
	<div class="max-w-md mx-auto w-full">
		<div class="text-box power-up mb-6">
			<h1 class="text-2xl mb-4">🏠 GARAGE DOOR QUEST 🏠</h1>
			<h2 class="text-lg">
				{isLogin ? '🎮 PLAYER LOGIN 🎮' : '⭐ JOIN THE QUEST ⭐'}
			</h2>
		</div>

		<div class="text-box">
			<form on:submit|preventDefault={handleSubmit} class="space-y-6">
				{#if !isLogin}
					<!-- Username field for registration -->
					<div>
						<label for="username" class="block text-sm font-medium text-gray-700">
							Username
						</label>
						<div class="mt-1">
							<input
								id="username"
								name="username"
								type="text"
								bind:value={username}
								required={!isLogin}
								class="input-field"
								placeholder="Enter your username"
							/>
						</div>
					</div>
				{/if}

				<!-- Email field -->
				<div>
					<label for="email" class="block text-sm font-medium text-gray-700">
						Email address
					</label>
					<div class="mt-1">
						<input
							id="email"
							name="email"
							type="email"
							bind:value={email}
							required
							class="input-field"
							placeholder="Enter your email"
						/>
					</div>
				</div>

				<!-- Password field -->
				<div>
					<label for="password" class="block text-sm font-medium text-gray-700">
						Password
					</label>
					<div class="mt-1">
						<input
							id="password"
							name="password"
							type="password"
							bind:value={password}
							required
							class="input-field"
							placeholder="Enter your password"
						/>
					</div>
				</div>

				{#if !isLogin}
					<!-- Confirm password field for registration -->
					<div>
						<label for="confirmPassword" class="block text-sm font-medium text-gray-700">
							Confirm Password
						</label>
						<div class="mt-1">
							<input
								id="confirmPassword"
								name="confirmPassword"
								type="password"
								bind:value={confirmPassword}
								required={!isLogin}
								class="input-field"
								placeholder="Confirm your password"
							/>
						</div>
					</div>
				{/if}

				<!-- Error message -->
				{#if error}
					<div class="text-box text-center" style="background: linear-gradient(45deg, #dc2626, #991b1b);">
						<div class="text-yellow-300">💥 ERROR 💥</div>
						<div class="text-white mt-2">{error}</div>
					</div>
				{/if}

				<!-- Submit button -->
				<div>
					<button
						type="submit"
						disabled={loading}
						class="w-full btn-retro btn-primary"
					>
						{#if loading}
							<div class="flex items-center justify-center">
								<div class="coin mr-2"></div>
								{isLogin ? 'LOGGING IN...' : 'CREATING PLAYER...'}
							</div>
						{:else}
							{isLogin ? '🔐 LOGIN' : '🎮 CREATE PLAYER'}
						{/if}
					</button>
				</div>
			</form>

			<!-- Toggle between login and register -->
			<div class="mt-6 text-center">
				<button
					type="button"
					on:click={toggleMode}
					class="btn-retro btn-outline"
				>
					{isLogin
						? "🆕 CREATE ACCOUNT"
						: '🔐 LOGIN INSTEAD'}
				</button>
			</div>

			<!-- Game info -->
			<div class="mt-8 p-4 bg-gray-50 rounded-lg">
				<h3 class="text-sm font-semibold text-gray-900 mb-2">🎯 How to Play</h3>
				<ul class="text-xs text-gray-600 space-y-1">
					<li>• View Street View images and identify garage doors</li>
					<li>• Count the doors, estimate size, and select type</li>
					<li>• Earn points based on accuracy and confidence</li>
					<li>• Compete on the leaderboard with other players</li>
				</ul>
			</div>
		</div>
	</div>
</div>
