<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { getApiBase } from '$lib/config';

	const API_BASE = getApiBase();

	let user = null;
	let loading = false;
	let error = '';
	let success = '';

	// Form data
	let formData = {
		address: '',
		garageDoorSize: '',
		material: '',
		color: '',
		style: '',
		notes: '',
		photo: null
	};

	// Garage door options
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

	const materialOptions = [
		'Steel',
		'Wood',
		'Aluminum',
		'Fiberglass',
		'Vinyl',
		'Composite'
	];

	const styleOptions = [
		'Traditional',
		'Carriage House',
		'Contemporary',
		'Modern',
		'Rustic',
		'Custom'
	];

	onMount(() => {
		if (browser) {
			const token = localStorage.getItem('token');
			const userData = localStorage.getItem('user');
			
			if (!token || !userData) {
				goto('/login');
				return;
			}
			
			user = JSON.parse(userData);
		}
	});

	async function handleSubmit(event) {
		event.preventDefault();
		loading = true;
		error = '';
		success = '';

		try {
			const token = localStorage.getItem('token');
			
			const submitData = new FormData();
			Object.keys(formData).forEach(key => {
				if (formData[key] !== null && formData[key] !== '') {
					submitData.append(key, formData[key]);
				}
			});

			const response = await fetch(`${API_BASE}/data/submit`, {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${token}`
				},
				body: submitData
			});

			const result = await response.json();

			if (response.ok) {
				success = 'Data submitted successfully! Thank you for contributing.';
				// Reset form
				formData = {
					address: '',
					garageDoorSize: '',
					material: '',
					color: '',
					style: '',
					notes: '',
					photo: null
				};
				// Reset file input
				const fileInput = document.getElementById('photo');
				if (fileInput) fileInput.value = '';
			} else {
				error = result.error || 'Failed to submit data';
			}
		} catch (err) {
			error = 'Network error. Please try again.';
		} finally {
			loading = false;
		}
	}

	function handleFileChange(event) {
		const file = event.target.files[0];
		if (file) {
			if (file.size > 5 * 1024 * 1024) { // 5MB limit
				error = 'File size must be less than 5MB';
				event.target.value = '';
				return;
			}
			formData.photo = file;
		}
	}
</script>

<svelte:head>
	<title>Submit Data - Garage Door Quest</title>
</svelte:head>

<div class="min-h-screen py-4 px-2">
	<div class="max-w-md mx-auto">
		<!-- Header -->
		<div class="text-box mb-6">
			<h1 class="text-xl mb-4">📊 SUBMIT DATA 📊</h1>
			<p class="text-sm">
				Help build the garage door database!<br>
				Submit photos and details of garage doors you encounter.
			</p>
		</div>

		<!-- Back Button -->
		<div class="mb-4">
			<a href="/" class="btn-retro btn-outline text-sm">
				← BACK TO HOME
			</a>
		</div>

		{#if error}
			<div class="text-box mb-4" style="background: linear-gradient(45deg, #dc2626, #991b1b);">
				<p class="text-white text-sm">💥 ERROR: {error}</p>
			</div>
		{/if}

		{#if success}
			<div class="text-box mb-4" style="background: linear-gradient(45deg, #16a34a, #15803d);">
				<p class="text-white text-sm">✅ {success}</p>
			</div>
		{/if}

		<!-- Submit Form -->
		<form on:submit={handleSubmit} class="space-y-4">
			<!-- Address -->
			<div class="text-box">
				<label for="address" class="block text-white text-sm mb-2">Address or Location</label>
				<input
					id="address"
					type="text"
					bind:value={formData.address}
					class="input-field"
					placeholder="123 Main St, City, State"
					required
				/>
			</div>

			<!-- Garage Door Size -->
			<div class="text-box">
				<label for="size" class="block text-white text-sm mb-2">Garage Door Size</label>
				<select
					id="size"
					bind:value={formData.garageDoorSize}
					class="input-field"
					required
				>
					<option value="">Select size...</option>
					{#each sizeOptions as size}
						<option value={size}>{size}</option>
					{/each}
				</select>
			</div>

			<!-- Material -->
			<div class="text-box">
				<label for="material" class="block text-white text-sm mb-2">Material</label>
				<select
					id="material"
					bind:value={formData.material}
					class="input-field"
					required
				>
					<option value="">Select material...</option>
					{#each materialOptions as material}
						<option value={material}>{material}</option>
					{/each}
				</select>
			</div>

			<!-- Color -->
			<div class="text-box">
				<label for="color" class="block text-white text-sm mb-2">Color</label>
				<input
					id="color"
					type="text"
					bind:value={formData.color}
					class="input-field"
					placeholder="White, Brown, Black, etc."
					required
				/>
			</div>

			<!-- Style -->
			<div class="text-box">
				<label for="style" class="block text-white text-sm mb-2">Style</label>
				<select
					id="style"
					bind:value={formData.style}
					class="input-field"
					required
				>
					<option value="">Select style...</option>
					{#each styleOptions as style}
						<option value={style}>{style}</option>
					{/each}
				</select>
			</div>

			<!-- Photo -->
			<div class="text-box">
				<label for="photo" class="block text-white text-sm mb-2">Photo (Optional)</label>
				<input
					id="photo"
					type="file"
					accept="image/*"
					on:change={handleFileChange}
					class="input-field text-sm"
				/>
				<p class="text-xs text-gray-300 mt-1">Max file size: 5MB</p>
			</div>

			<!-- Notes -->
			<div class="text-box">
				<label for="notes" class="block text-white text-sm mb-2">Additional Notes (Optional)</label>
				<textarea
					id="notes"
					bind:value={formData.notes}
					class="input-field"
					placeholder="Any additional details about the garage door..."
					rows="3"
				></textarea>
			</div>

			<!-- Submit Button -->
			<button
				type="submit"
				disabled={loading}
				class="btn-retro btn-success w-full text-lg font-bold"
			>
				{loading ? '⏳ SUBMITTING...' : '📊 SUBMIT DATA'}
			</button>
		</form>

		<!-- Info Box -->
		<div class="text-box mt-6">
			<h3 class="text-sm font-bold mb-2">💰 EARN REWARDS</h3>
			<p class="text-xs">
				Earn points for each data submission!<br>
				Quality submissions help build our database.
			</p>
		</div>
	</div>
</div>
