<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth';
  import { get } from 'svelte/store';
  import { getApiBase } from '$lib/config';

  let address = '';
  let garage_door_count = 1;
  let garage_door_width = 8;
  let garage_door_height = 7;
  let garage_door_type = 'single';
  let notes = '';
  let confidence_level = 3;
  let loading = false;
  let message = '';
  let messageType = '';
  let gettingLocation = false;
  let locationSupported = 'geolocation' in navigator;
  let gettingCentennialAddress = false;
  let addressSuggestions = [];
  let showSuggestions = false;
  let searchTimeout;

  // Check authentication
  onMount(() => {
    // Initialize auth store to load token from localStorage
    authStore.init();

    const auth = get(authStore);
    if (!auth.isAuthenticated) {
      goto('/login');
    }
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

      const { latitude, longitude } = (position as GeolocationPosition).coords;

      // Reverse geocode using Google Maps API
      const auth = get(authStore);
      const response = await fetch(`${getApiBase()}/data-entry/reverse-geocode`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auth.token}`
        },
        body: JSON.stringify({ latitude, longitude })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.address) {
          address = data.address;
          message = 'Location detected! Address auto-filled.';
          messageType = 'success';
        } else {
          message = 'Could not determine address from your location';
          messageType = 'error';
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
      const auth = get(authStore);

      if (!auth.token) {
        console.error('No authentication token found');
        message = 'Authentication required. Please log in again.';
        messageType = 'error';
        goto('/login');
        return;
      }

      const response = await fetch(`${getApiBase()}/data-entry/centennial-address`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${auth.token}`
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

  // Local Centennial addresses (sample from CSV)
  const centennialAddresses = [
    "8342 E Briarwood Blvd, Centennial, CO",
    "8333 E Davies Ave, Centennial, CO",
    "6701 S Willow St, Centennial, CO",
    "6754 S Willow St, Centennial, CO",
    "8016 E Fremont Ave, Centennial, CO",
    "8898 E Easter Ave, Centennial, CO",
    "8799 E Easter Pl, Centennial, CO",
    "8710 E Easter Pl, Centennial, CO",
    "8691 E Briarwood Blvd, Centennial, CO",
    "8634 E Easter Pl, Centennial, CO",
    "8544 E Briarwood Pl, Centennial, CO",
    "7066 S Verbena Cir, Centennial, CO",
    "7267 S Verbena Way, Centennial, CO",
    "8386 E Fremont Ct, Centennial, CO",
    "7205 S Valentia Way, Centennial, CO",
    "8308 E Costilla Ave, Centennial, CO",
    "8242 E Briarwood Pl, Centennial, CO",
    "8200 E Briarwood Blvd, Centennial, CO",
    "8150 E Davies Ave, Centennial, CO",
    "7100 S Willow St, Centennial, CO",
    "8500 E Easter Ave, Centennial, CO",
    "8400 E Fremont Ave, Centennial, CO",
    "7300 S Verbena Way, Centennial, CO",
    "8600 E Briarwood Blvd, Centennial, CO",
    "7200 S Valentia Way, Centennial, CO"
  ];

  // Address autocomplete search (local)
  function searchAddresses(query) {
    if (!query || query.length < 2) {
      addressSuggestions = [];
      showSuggestions = false;
      return;
    }

    const lowerQuery = query.toLowerCase();
    const matches = centennialAddresses
      .filter(addr => addr.toLowerCase().includes(lowerQuery))
      .slice(0, 5)
      .map(addr => ({
        address: addr,
        description: "Centennial, Colorado"
      }));

    addressSuggestions = matches;
    showSuggestions = matches.length > 0;
  }

  // Handle address input changes
  function onAddressInput(event) {
    const query = event.target.value;
    address = query;

    // Clear previous timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    // Debounce search
    searchTimeout = setTimeout(() => {
      searchAddresses(query);
    }, 300);
  }

  // Select address from suggestions
  function selectAddress(suggestion) {
    address = suggestion.address;
    addressSuggestions = [];
    showSuggestions = false;
  }

  // Hide suggestions when clicking outside
  function hideSuggestions() {
    setTimeout(() => {
      showSuggestions = false;
    }, 200);
  }

  const doorTypes = [
    { value: 'single', label: 'Single Door' },
    { value: 'double', label: 'Double Door' },
    { value: 'triple', label: 'Triple Door' },
    { value: 'commercial', label: 'Commercial' },
    { value: 'custom', label: 'Custom' }
  ];

  const doorWidths = [
    { value: 6, label: '6 feet' },
    { value: 6.5, label: '6.5 feet' },
    { value: 7, label: '7 feet' },
    { value: 7.5, label: '7.5 feet' },
    { value: 8, label: '8 feet' },
    { value: 8.5, label: '8.5 feet' },
    { value: 9, label: '9 feet' },
    { value: 9.5, label: '9.5 feet' },
    { value: 10, label: '10 feet' },
    { value: 12, label: '12 feet' },
    { value: 14, label: '14 feet' },
    { value: 16, label: '16 feet' },
    { value: 18, label: '18 feet' },
    { value: 20, label: '20 feet' }
  ];

  const doorHeights = [
    { value: 6, label: '6 feet' },
    { value: 6.5, label: '6.5 feet' },
    { value: 7, label: '7 feet' },
    { value: 7.5, label: '7.5 feet' },
    { value: 8, label: '8 feet' },
    { value: 8.5, label: '8.5 feet' },
    { value: 9, label: '9 feet' },
    { value: 9.5, label: '9.5 feet' },
    { value: 10, label: '10 feet' },
    { value: 11, label: '11 feet' },
    { value: 12, label: '12 feet' }
  ];

  async function submitData() {
    if (!address.trim()) {
      showMessage('Please enter an address', 'error');
      return;
    }

    loading = true;
    message = '';

    try {
      const auth = get(authStore);
      const response = await fetch(`${getApiBase()}/data-entry/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auth.token}`
        },
        body: JSON.stringify({
          address: address.trim(),
          garage_door_count,
          garage_door_width,
          garage_door_height,
          garage_door_type,
          notes: notes.trim() || undefined,
          confidence_level
        })
      });

      const data = await response.json();

      if (data.success) {
        showMessage('Data submitted successfully! Street View image captured.', 'success');
        // Reset form
        address = '';
        garage_door_count = 1;
        garage_door_width = 8;
        garage_door_height = 7;
        garage_door_type = 'single';
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
  <title>Data Entry - It's Garages</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 py-4">
  <div class="max-w-lg mx-auto px-4">
    <div class="text-box p-4">
      <h1 class="text-xl font-bold mb-2">📏 MEASURE DOORS</h1>
      <p class="text-xs text-gray-300 mb-4">
        Add real garage door measurements with GPS location.
      </p>

      {#if message}
        <div class="mb-4 p-4 rounded-md {messageType === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}">
          {message}
        </div>
      {/if}

      <form on:submit|preventDefault={submitData} class="space-y-6">
        <!-- Address -->
        <div class="relative">
          <label for="address" class="block text-sm font-medium text-gray-700 mb-2">
            Address *
          </label>
          <div class="flex gap-2">
            <div class="flex-1 relative">
              <input
                type="text"
                id="address"
                bind:value={address}
                on:input={onAddressInput}
                on:blur={hideSuggestions}
                placeholder="Start typing address..."
                required
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autocomplete="off"
              />

              <!-- Address Suggestions Dropdown -->
              {#if showSuggestions && addressSuggestions.length > 0}
                <div class="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {#each addressSuggestions as suggestion}
                    <button
                      type="button"
                      class="w-full px-3 py-2 text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none border-b border-gray-100 last:border-b-0"
                      on:click={() => selectAddress(suggestion)}
                    >
                      <div class="text-sm font-medium text-gray-900">{suggestion.address}</div>
                      {#if suggestion.description}
                        <div class="text-xs text-gray-500">{suggestion.description}</div>
                      {/if}
                    </button>
                  {/each}
                </div>
              {/if}
            </div>
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
          <label for="door_count" class="block text-sm font-medium text-gray-700 mb-2">
            Number of Garage Doors *
          </label>
          <select
            id="door_count"
            bind:value={garage_door_count}
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {#each Array(10) as _, i}
              <option value={i + 1}>{i + 1} door{i > 0 ? 's' : ''}</option>
            {/each}
          </select>
        </div>

        <!-- Door Dimensions -->
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label for="door_width" class="block text-sm font-medium text-gray-700 mb-2">
              Door Width *
            </label>
            <select
              id="door_width"
              bind:value={garage_door_width}
              required
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {#each doorWidths as width}
                <option value={width.value}>{width.label}</option>
              {/each}
            </select>
          </div>
          <div>
            <label for="door_height" class="block text-sm font-medium text-gray-700 mb-2">
              Door Height *
            </label>
            <select
              id="door_height"
              bind:value={garage_door_height}
              required
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {#each doorHeights as height}
                <option value={height.value}>{height.label}</option>
              {/each}
            </select>
          </div>
        </div>

        <!-- Door Type -->
        <div>
          <label for="door_type" class="block text-sm font-medium text-gray-700 mb-2">
            Door Type *
          </label>
          <select
            id="door_type"
            bind:value={garage_door_type}
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {#each doorTypes as type}
              <option value={type.value}>{type.label}</option>
            {/each}
          </select>
        </div>

        <!-- Confidence Level -->
        <div>
          <label for="confidence" class="block text-sm font-medium text-gray-700 mb-2">
            Confidence Level: {confidence_level}/5
          </label>
          <input
            type="range"
            id="confidence"
            bind:value={confidence_level}
            min="1"
            max="5"
            class="w-full"
          />
          <div class="flex justify-between text-sm text-gray-500 mt-1">
            <span>Not sure</span>
            <span>Very confident</span>
          </div>
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
        <div class="flex justify-between items-center">
          <button
            type="button"
            on:click={() => goto('/validation-game')}
            class="px-4 py-2 text-blue-600 hover:text-blue-800 font-medium"
          >
            Play Validation Game →
          </button>
          
          <button
            type="submit"
            disabled={loading}
            class="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Submitting...' : 'Submit Data'}
          </button>
        </div>
      </form>
    </div>

    <!-- Info Box -->
    <div class="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
      <h3 class="font-medium text-blue-900 mb-2">How it works:</h3>
      <ul class="text-sm text-blue-800 space-y-1">
        <li>• Enter accurate measurements of garage doors you can see</li>
        <li>• We automatically capture Street View images for the address</li>
        <li>• Your data helps train machine learning models</li>
        <li>• Play the validation game to test your skills!</li>
      </ul>
    </div>
  </div>
</div>

<style>
  input[type="range"] {
    -webkit-appearance: none;
    appearance: none;
    height: 6px;
    background: #e5e7eb;
    border-radius: 3px;
    outline: none;
  }

  input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 20px;
    height: 20px;
    background: #3b82f6;
    border-radius: 50%;
    cursor: pointer;
  }

  input[type="range"]::-moz-range-thumb {
    width: 20px;
    height: 20px;
    background: #3b82f6;
    border-radius: 50%;
    cursor: pointer;
    border: none;
  }
</style>
