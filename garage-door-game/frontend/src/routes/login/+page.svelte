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

	const API_BASE = 'http://localhost:3001/api';

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

<div class="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
	<div class="sm:mx-auto sm:w-full sm:max-w-md">
		<div class="text-center">
			<h1 class="text-4xl font-bold text-gray-900 mb-2">🏠 Garage Door Game</h1>
			<h2 class="text-2xl font-semibold text-gray-700">
				{isLogin ? 'Sign in to your account' : 'Create your account'}
			</h2>
		</div>
	</div>

	<div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
		<div class="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
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
					<div class="p-3 bg-red-100 border border-red-400 text-red-700 rounded">
						{error}
					</div>
				{/if}

				<!-- Submit button -->
				<div>
					<button
						type="submit"
						disabled={loading}
						class="w-full btn-primary py-3 text-lg font-semibold"
					>
						{#if loading}
							<div class="flex items-center justify-center">
								<div class="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
								{isLogin ? 'Signing in...' : 'Creating account...'}
							</div>
						{:else}
							{isLogin ? '🔐 Sign In' : '🎮 Create Account & Play'}
						{/if}
					</button>
				</div>
			</form>

			<!-- Toggle between login and register -->
			<div class="mt-6 text-center">
				<button
					type="button"
					on:click={toggleMode}
					class="text-primary-600 hover:text-primary-500 font-medium"
				>
					{isLogin 
						? "Don't have an account? Sign up" 
						: 'Already have an account? Sign in'}
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
