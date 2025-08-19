<script lang="ts">
	// Simple data entry page - no authentication required
</script>

<svelte:head>
	<title>It's Garages - Garage Door Data Collection Platform</title>
	<meta name="description" content="Collect and validate garage door data with GPS-powered address detection and Street View integration." />
</svelte:head>

<!-- Hero Section -->
<section class="py-8 px-4">
	<div class="max-w-2xl mx-auto">
		<div class="text-center">
			<div class="text-box power-up mb-8">
				<h1 class="text-2xl mb-4">
					🏠 IT'S GARAGES
				</h1>
				<p class="text-lg mb-4">
					Garage Door Data Collection Platform
				</p>
			</div>

			<!-- Main Action - Data Collection -->
			<div class="mb-6">
				<div class="text-box p-6">
					<div class="text-center mb-6">
						<div class="text-4xl mb-4">📏</div>
						<h3 class="text-xl font-bold mb-3">COLLECT GARAGE DOOR DATA</h3>
						<p class="text-sm text-gray-300 mb-6">
							Use GPS to find your location, measure garage doors, and contribute to our comprehensive database.
						</p>
					</div>
					<a href="/data-entry" class="btn-retro btn-primary w-full text-lg">
						🚀 START DATA COLLECTION
					</a>
				</div>
			</div>
		</div>
	</div>
</section>
