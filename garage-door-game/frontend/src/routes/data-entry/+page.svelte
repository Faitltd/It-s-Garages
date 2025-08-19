<script lang="ts">
  import { onMount } from 'svelte';
  import { getApiBase } from '$lib/config';
  const API_BASE = getApiBase();

  // Basic data
  let address = '';
  let latitude: number | null = null;
  let longitude: number | null = null;
  let addressSource = 'manual'; // 'gps', 'manual', 'approximate'

  // Door measurements
  let garage_door_count = 1;
  let garage_door_width = 8;
  let garage_door_height = 7;

  // ML Training Tags - Door characteristics
  let door_size_category = 'single'; // single, double, custom
  let door_material = 'steel'; // wood, steel, aluminum, composite, vinyl, glass
  let door_style = 'traditional'; // traditional, carriage_house, contemporary, modern, custom
  let door_condition = 'good'; // new, good, fair, poor

  // ML Training Tags - Visibility and quality
  let visibility_quality = 'clear'; // clear, partially_obscured, poor_lighting, distant
  let image_quality = 'high'; // high, medium, low
  let weather_conditions = 'clear'; // clear, overcast, rainy, snowy

  // Additional data
  let notes = '';
  let confidence_level = 3;

  // UI state
  let loading = false;
  let message = '';
  let messageType = '';
  let gettingLocation = false;
  let locationSupported = 'geolocation' in navigator;
  let gettingCentennialAddress = false;

  // Initialize component
  onMount(() => {
    // Component ready
  });

  // Get user's current location and reverse geocode to address
  async function getCurrentLocation() {
    if (!locationSupported) {
      message = 'Geolocation is not supported by this browser';
      messageType = 'error';
      return;
    }

    gettingLocation = true;
    message = '';

    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes
        });
      });

      const coords = (position as GeolocationPosition).coords;
      latitude = coords.latitude;
      longitude = coords.longitude;
      addressSource = 'gps';

      // Reverse geocode using Google Maps API
      const response = await fetch(`${API_BASE}/data-entry/reverse-geocode`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ latitude, longitude })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.address) {
          address = data.address;
          message = 'Location detected! Address auto-filled from GPS.';
          messageType = 'success';
        } else {
          message = 'Could not determine address from your location';
          messageType = 'error';
          addressSource = 'approximate';
        }
      } else {
        throw new Error('Failed to get address from location');
      }
    } catch (error) {
      console.error('Geolocation error:', error);
      if ((error as any).code === 1) {
        message = 'Location access denied. Please enable location services and try again.';
      } else if ((error as any).code === 2) {
        message = 'Location unavailable. Please check your GPS/network connection.';
      } else if ((error as any).code === 3) {
        message = 'Location request timed out. Please try again.';
      } else {
        message = 'Failed to get your location. Please enter address manually.';
      }
      messageType = 'error';
    } finally {
      gettingLocation = false;
    }
  }

  // Get a random Centennial address for data entry
  async function getCentennialAddress() {
    gettingCentennialAddress = true;
    message = '';

    try {
      const response = await fetch(`${API_BASE}/data-entry/centennial-address`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          address = data.data.address;
          message = 'Centennial address loaded! Please verify the garage door details.';
          messageType = 'success';

          // If the address has known garage door data, pre-fill some fields
          if (data.data.hasKnownGarageDoor) {
            if (data.data.knownGarageDoorCount) {
              garage_door_count = data.data.knownGarageDoorCount;
            }
            if (data.data.knownGarageDoorWidth) {
              garage_door_width = data.data.knownGarageDoorWidth;
            }
            if (data.data.knownGarageDoorHeight) {
              garage_door_height = data.data.knownGarageDoorHeight;
            }
          }
        } else {
          message = 'No Centennial addresses available';
          messageType = 'error';
        }
      } else {
        throw new Error('Failed to get Centennial address');
      }
    } catch (error) {
      console.error('Centennial address error:', error);
      message = 'Failed to get Centennial address. Please try again.';
      messageType = 'error';
    } finally {
      gettingCentennialAddress = false;
    }
  }



  // ML Training Tag Options
  const doorSizeCategories = [
    { value: 'single', label: 'Single Door' },
    { value: 'double', label: 'Double Door' },
    { value: 'custom', label: 'Custom Size' }
  ];

  const doorMaterials = [
    { value: 'wood', label: 'Wood' },
    { value: 'steel', label: 'Steel' },
    { value: 'aluminum', label: 'Aluminum' },
    { value: 'composite', label: 'Composite' },
    { value: 'vinyl', label: 'Vinyl' },
    { value: 'glass', label: 'Glass' }
  ];

  const doorStyles = [
    { value: 'traditional', label: 'Traditional' },
    { value: 'carriage_house', label: 'Carriage House' },
    { value: 'contemporary', label: 'Contemporary' },
    { value: 'modern', label: 'Modern' },
    { value: 'custom', label: 'Custom' }
  ];

  const doorConditions = [
    { value: 'new', label: 'New' },
    { value: 'good', label: 'Good' },
    { value: 'fair', label: 'Fair' },
    { value: 'poor', label: 'Poor' }
  ];

  const visibilityQualities = [
    { value: 'clear', label: 'Clear View' },
    { value: 'partially_obscured', label: 'Partially Obscured' },
    { value: 'poor_lighting', label: 'Poor Lighting' },
    { value: 'distant', label: 'Distant' }
  ];

  const imageQualities = [
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' }
  ];

  const weatherConditions = [
    { value: 'clear', label: 'Clear' },
    { value: 'overcast', label: 'Overcast' },
    { value: 'rainy', label: 'Rainy' },
    { value: 'snowy', label: 'Snowy' }
  ];

  // Common door sizes for quick selection
  const doorSizeOptions = [
    { value: '8x7', width: 8, height: 7, label: "8' × 7' (Single Standard)" },
    { value: '9x7', width: 9, height: 7, label: "9' × 7' (Single Wide)" },
    { value: '16x7', width: 16, height: 7, label: "16' × 7' (Double Standard)" },
    { value: '18x7', width: 18, height: 7, label: "18' × 7' (Double Wide)" },
    { value: '8x8', width: 8, height: 8, label: "8' × 8' (Single Tall)" },
    { value: '16x8', width: 16, height: 8, label: "16' × 8' (Double Tall)" },
    { value: 'custom', width: 0, height: 0, label: 'Custom Size' }
  ];

  let customSizeMode = false;
  function computeIsCustom() {
    return !doorSizeOptions.some((opt) => opt.value !== 'custom' && opt.width === garage_door_width && opt.height === garage_door_height);
  }
  // Initialize custom mode based on defaults
  customSizeMode = computeIsCustom();

  function selectDoorSize(option: { value: string; width: number; height: number }) {
    if (option.value === 'custom') {
      customSizeMode = true;
      return;
    }
    garage_door_width = option.width;
    garage_door_height = option.height;
    customSizeMode = false;
  }


  async function submitData() {
    if (!address.trim()) {
      showMessage('Please enter an address', 'error');
      return;
    }

    loading = true;
    message = '';

    try {
      const response = await fetch(`${API_BASE}/data-entry/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          // Basic data
          address: address.trim(),
          latitude,
          longitude,
          address_source: addressSource,

          // Door measurements
          garage_door_count,
          garage_door_width,
          garage_door_height,

          // ML Training Tags
          door_size_category,
          door_material,
          door_style,
          door_condition,
          visibility_quality,
          image_quality,
          weather_conditions,

          // Additional data
          notes: notes.trim() || undefined,
          confidence_level
        })
      });

      const data = await response.json();

      if (data.success) {
        showMessage('Data submitted successfully! Street View image captured.', 'success');
        // Reset form
        address = '';
        latitude = null;
        longitude = null;
        addressSource = 'manual';
        garage_door_count = 1;
        garage_door_width = 8;
        garage_door_height = 7;
        door_size_category = 'single';
        door_material = 'steel';
        door_style = 'traditional';
        door_condition = 'good';
        visibility_quality = 'clear';
        image_quality = 'high';
        weather_conditions = 'clear';
        notes = '';
        confidence_level = 3;
      } else {
        showMessage(data.error?.message || 'Failed to submit data', 'error');
      }
    } catch (error) {
      console.error('Submit error:', error);
      showMessage('Network error. Please try again.', 'error');
    } finally {
      loading = false;
    }
  }

  function showMessage(text: string, type: string) {
    message = text;
    messageType = type;
    setTimeout(() => {
      message = '';
      messageType = '';
    }, 5000);
  }
</script>

<svelte:head>
  <title>Garage Door Data Collection - It's Garages</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 py-4">
  <div class="max-w-lg mx-auto px-4">
    <div class="text-box p-4">
      <h1 class="text-xl font-bold mb-2">📏 GARAGE DOOR DATA COLLECTION</h1>
      <p class="text-xs text-gray-300 mb-4">
        Use GPS to find your location, measure garage doors, and add comprehensive ML training tags for our database.
      </p>

      {#if message}
        <div class="mb-4 p-4 rounded-md {messageType === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}">
          {message}
        </div>
      {/if}

      <form on:submit|preventDefault={submitData} class="space-y-6">
        <!-- Address -->
        <div>
          <label for="address" class="block text-sm font-medium text-gray-700 mb-2">
            Address *
          </label>
          <div class="flex gap-2">
            <input
              type="text"
              id="address"
              bind:value={address}
              placeholder="123 Main St, City, State"
              required
              class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              type="button"
              on:click={getCentennialAddress}
              disabled={gettingCentennialAddress}
              class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              title="Get a random Centennial address"
            >
              {#if gettingCentennialAddress}
                <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Loading...
              {:else}
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
                </svg>
                Centennial Address
              {/if}
            </button>
            {#if locationSupported}
              <button
                type="button"
                on:click={getCurrentLocation}
                disabled={gettingLocation}
                class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                title="Use my current location"
              >
                {#if gettingLocation}
                  <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Getting...
                {:else}
                  <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                  </svg>
                  Use Location
                {/if}
              </button>
            {/if}
          </div>
          <p class="text-sm text-gray-500 mt-1">
            Enter the full address including city and state, use "Centennial Address" for a random Centennial location
            {#if locationSupported}
              , or click "Use Location" to auto-fill your current address
            {/if}
          </p>
        </div>

        <!-- Door Count -->
        <div>
          <p class="block text-sm font-medium text-gray-700 mb-2">
            Number of Garage Doors *
          </p>
          <div class="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {#each Array(10) as _, i}
              <button
                type="button"
                class="choice-option {garage_door_count === i + 1 ? 'selected' : ''}"
                on:click={() => (garage_door_count = i + 1)}
                aria-pressed={garage_door_count === i + 1}
              >
                {i + 1} door{i > 0 ? 's' : ''}
              </button>
            {/each}
          </div>
        </div>

        <!-- Door Size -->
        <div>
          <p class="block text-sm font-medium text-gray-700 mb-2">
            Door Size
          </p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
            {#each doorSizeOptions as option}
              <button
                type="button"
                class="choice-option {(!customSizeMode && option.value !== 'custom' && garage_door_width === option.width && garage_door_height === option.height) || (customSizeMode && option.value === 'custom') ? 'selected' : ''}"
                on:click={() => selectDoorSize(option)}
                aria-pressed={(!customSizeMode && option.value !== 'custom' && garage_door_width === option.width && garage_door_height === option.height) || (customSizeMode && option.value === 'custom')}
              >
                {option.label}
              </button>
            {/each}
          </div>

          {#if customSizeMode}
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label for="door_width" class="block text-sm font-medium text-gray-700 mb-2">
                  Door Width (feet) *
                </label>
                <input
                  type="number"
                  id="door_width"
                  bind:value={garage_door_width}
                  min="4"
                  max="20"
                  step="0.5"
                  required
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label for="door_height" class="block text-sm font-medium text-gray-700 mb-2">
                  Door Height (feet) *
                </label>
                <input
                  type="number"
                  id="door_height"
                  bind:value={garage_door_height}
                  min="6"
                  max="12"
                  step="0.5"
                  required
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          {/if}
        </div>

        <!-- Door Size Category -->
        <div>
          <p class="block text-sm font-medium text-gray-700 mb-2">
            Door Size Category *
          </p>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {#each doorSizeCategories as category}
              <button
                type="button"
                class="choice-option {door_size_category === category.value ? 'selected' : ''}"
                on:click={() => (door_size_category = category.value)}
                aria-pressed={door_size_category === category.value}
              >
                {category.label}
              </button>
            {/each}
          </div>
        </div>

        <!-- Door Material -->
        <div>
          <p class="block text-sm font-medium text-gray-700 mb-2">
            Door Material *
          </p>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {#each doorMaterials as material}
              <button
                type="button"
                class="choice-option {door_material === material.value ? 'selected' : ''}"
                on:click={() => (door_material = material.value)}
                aria-pressed={door_material === material.value}
              >
                {material.label}
              </button>
            {/each}
          </div>
        </div>

        <!-- Door Style -->
        <div>
          <p class="block text-sm font-medium text-gray-700 mb-2">
            Door Style *
          </p>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {#each doorStyles as style}
              <button
                type="button"
                class="choice-option {door_style === style.value ? 'selected' : ''}"
                on:click={() => (door_style = style.value)}
                aria-pressed={door_style === style.value}
              >
                {style.label}
              </button>
            {/each}
          </div>
        </div>

        <!-- Door Condition -->
        <div>
          <p class="block text-sm font-medium text-gray-700 mb-2">
            Door Condition *
          </p>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {#each doorConditions as condition}
              <button
                type="button"
                class="choice-option {door_condition === condition.value ? 'selected' : ''}"
                on:click={() => (door_condition = condition.value)}
                aria-pressed={door_condition === condition.value}
              >
                {condition.label}
              </button>
            {/each}
          </div>
        </div>

        <!-- Visibility Quality -->
        <div>
          <p class="block text-sm font-medium text-gray-700 mb-2">
            Visibility Quality *
          </p>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {#each visibilityQualities as quality}
              <button
                type="button"
                class="choice-option {visibility_quality === quality.value ? 'selected' : ''}"
                on:click={() => (visibility_quality = quality.value)}
                aria-pressed={visibility_quality === quality.value}
              >
                {quality.label}
              </button>
            {/each}
          </div>
        </div>

        <!-- Image Quality -->
        <div>
          <p class="block text-sm font-medium text-gray-700 mb-2">
            Image Quality *
          </p>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {#each imageQualities as quality}
              <button
                type="button"
                class="choice-option {image_quality === quality.value ? 'selected' : ''}"
                on:click={() => (image_quality = quality.value)}
                aria-pressed={image_quality === quality.value}
              >
                {quality.label}
              </button>
            {/each}
          </div>
        </div>

        <!-- Weather Conditions -->
        <div>
          <p class="block text-sm font-medium text-gray-700 mb-2">
            Weather Conditions *
          </p>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {#each weatherConditions as weather}
              <button
                type="button"
                class="choice-option {weather_conditions === weather.value ? 'selected' : ''}"
                on:click={() => (weather_conditions = weather.value)}
                aria-pressed={weather_conditions === weather.value}
              >
                {weather.label}
              </button>
            {/each}
          </div>
        </div>

        <!-- Confidence Level -->
        <div>
          <p class="block text-sm font-medium text-gray-700 mb-2">
            Confidence Level: {confidence_level}/5
          </p>
          <div class="grid grid-cols-5 gap-2">
            {#each [1, 2, 3, 4, 5] as lvl}
              <button
                type="button"
                class="choice-option {confidence_level === lvl ? 'selected' : ''}"
                on:click={() => (confidence_level = lvl)}
                aria-pressed={confidence_level === lvl}
              >
                {lvl}
              </button>
            {/each}
          </div>
          <div class="flex justify-between text-xs text-gray-500 mt-2">
            <span>Not sure</span>
            <span>Very confident</span>
          </div>
        </div>

        <!-- Image Upload -->
        <div>
          <label for="image" class="block text-sm font-medium text-gray-700 mb-2">
            Garage Door Photo (Optional)
          </label>
          <input
            type="file"
            id="image"
            accept="image/*"
            capture="environment"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p class="text-xs text-gray-500 mt-1">
            Take a photo of the garage door for better ML training data
          </p>
        </div>

        <!-- Notes -->
        <div>
          <label for="notes" class="block text-sm font-medium text-gray-700 mb-2">
            Additional Notes
          </label>
          <textarea
            id="notes"
            bind:value={notes}
            rows="3"
            placeholder="Any additional details about the garage door..."
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          ></textarea>
        </div>

        <!-- Submit Button -->
        <div class="text-center">
          <button
            type="submit"
            disabled={loading}
            class="btn-retro btn-primary w-full text-lg"
          >
            {loading ? '⏳ SUBMITTING...' : '🚀 SUBMIT DATA'}
          </button>
        </div>
      </form>
    </div>

    <!-- Info Box -->
    <div class="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
      <h3 class="font-medium text-blue-900 mb-2">📊 ML Training Data Collection:</h3>
      <ul class="text-sm text-blue-800 space-y-1">
        <li>• 📍 Use GPS to automatically detect your location</li>
        <li>• 📏 Enter precise garage door measurements</li>
        <li>• 🏷️ Add comprehensive ML training tags</li>
        <li>• 📸 Upload photos for visual training data</li>
        <li>• 🤖 Help train AI models to recognize garage doors</li>
      </ul>
    </div>
  </div>
</div>


