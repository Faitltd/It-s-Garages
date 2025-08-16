<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { getApiBase } from '$lib/config';

	const API_BASE = getApiBase();

	let user = null;
	let loading = false;
	let error = '';
	let success = '';

	// Form data - simplified to only address and doors
	let address = '';
	let doors: { size: string }[] = [{ size: '' }];

	// Garage door size options
	const sizeOptions = [
		'8x7 feet',
		'9x7 feet',
		'16x7 feet',
		'18x7 feet',
		'8x8 feet',
		'9x8 feet',
		'16x8 feet',
		'18x8 feet',
		'Custom size'
	];

	// Add a new door to the list
	function addDoor() {
		doors = [...doors, { size: '' }];
	}

	// Remove a door from the list
	function removeDoor(index: number) {
		if (doors.length > 1) {
			doors = doors.filter((_, i) => i !== index);
		}
	}

	onMount(() => {
		if (browser) {
			const token = localStorage.getItem('authToken');
			const userData = localStorage.getItem('user');

			if (!token || !userData) {
				goto('/login');
				return;
			}

			user = JSON.parse(userData);
		}
	});

	async function handleSubmit(event: Event) {
		event.preventDefault();
		
		if (!user) {
			error = 'Please log in to submit data';
			return;
		}

		// Validate required fields
		if (!address.trim()) {
			error = 'Address is required';
			return;
		}

		// Check that at least one door has a size
		const validDoors = doors.filter(door => door.size.trim() !== '');
		if (validDoors.length === 0) {
			error = 'At least one garage door size is required';
			return;
		}

		loading = true;
		error = '';
		success = '';

		try {
			const token = localStorage.getItem('authToken');
			
			const submitData = {
				address: address.trim(),
				doors: validDoors
			};

			const response = await fetch(`${API_BASE}/data/submit`, {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${token}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(submitData)
			});

			const result = await response.json();

			if (response.ok) {
				success = `Data submitted successfully! Added ${validDoors.length} garage door(s) for this address.`;
				
				// Reset form
				address = '';
				doors = [{ size: '' }];
			} else {
				error = result.error || 'Failed to submit data';
			}
		} catch (err) {
			error = 'Network error. Please try again.';
			console.error('Submit error:', err);
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Submit Data - Garage Door Quest</title>
	<meta name="description" content="Submit garage door data to help improve our detection system" />
</svelte:head>

<div class="min-h-screen py-4 px-2">
	<div class="max-w-md mx-auto">
		<!-- Header -->
		<div class="text-box mb-6">
			<h1 class="text-xl mb-4 text-center">📊 SUBMIT DATA 📊</h1>
			<p class="text-center text-sm">
				Help improve our garage door detection by submitting property data
			</p>
		</div>

		<!-- Form -->
		<form on:submit={handleSubmit} class="space-y-4">
			<!-- Address Input -->
			<div class="text-box">
				<label for="address" class="block text-white text-sm mb-2">
					🏠 PROPERTY ADDRESS *
				</label>
				<input
					type="text"
					id="address"
					bind:value={address}
					placeholder="123 Main Street, City, State"
					class="w-full p-3 bg-gray-800 border-2 border-white text-white text-sm font-mono focus:border-yellow-400 focus:outline-none"
					required
				/>
			</div>

			<!-- Garage Doors Section -->
			<div class="text-box">
				<h2 class="text-white text-sm mb-4">🚪 GARAGE DOORS</h2>
				
				{#each doors as door, index}
					<div class="mb-4 p-3 bg-gray-800 border border-gray-600 rounded">
						<div class="flex items-center justify-between mb-2">
							<label class="text-white text-xs">
								DOOR {index + 1} SIZE *
							</label>
							{#if doors.length > 1}
								<button
									type="button"
									on:click={() => removeDoor(index)}
									class="text-red-400 hover:text-red-300 text-xs"
								>
									❌ REMOVE
								</button>
							{/if}
						</div>
						
						<select
							bind:value={door.size}
							class="w-full p-2 bg-gray-700 border border-white text-white text-xs font-mono focus:border-yellow-400 focus:outline-none"
							required
						>
							<option value="">Select size...</option>
							{#each sizeOptions as size}
								<option value={size}>{size}</option>
							{/each}
						</select>
					</div>
				{/each}

				<!-- Add Another Door Button -->
				<button
					type="button"
					on:click={addDoor}
					class="btn-retro btn-outline w-full"
				>
					➕ ADD ANOTHER DOOR
				</button>
			</div>

			<!-- Error Message -->
			{#if error}
				<div class="text-box">
					<div class="text-red-400 text-center text-sm">
						❌ {error}
					</div>
				</div>
			{/if}

			<!-- Success Message -->
			{#if success}
				<div class="text-box power-up">
					<div class="text-green-400 text-center text-sm">
						✅ {success}
					</div>
				</div>
			{/if}

			<!-- Submit Button -->
			<button
				type="submit"
				disabled={loading}
				class="btn-retro btn-primary w-full {loading ? 'opacity-50 cursor-not-allowed' : ''}"
			>
				{#if loading}
					⏳ SUBMITTING...
				{:else}
					📤 SUBMIT DATA
				{/if}
			</button>
		</form>

		<!-- Info Box -->
		<div class="text-box mt-6">
			<h3 class="text-sm mb-2">ℹ️ HOW IT HELPS</h3>
			<ul class="text-xs space-y-1 text-gray-300">
				<li>• Improves our AI detection accuracy</li>
				<li>• Helps provide better price estimates</li>
				<li>• Contributes to the community database</li>
				<li>• Earns you points and achievements</li>
			</ul>
		</div>

		<!-- Navigation -->
		<div class="mt-6 text-center">
			<a href="/game" class="btn-retro btn-outline">
				🎮 BACK TO GAME
			</a>
		</div>
	</div>
</div>
