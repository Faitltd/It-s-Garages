<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth';
  import { get } from 'svelte/store';

  let address = '';
  let garage_door_count = 1;
  let garage_door_width = 8;
  let garage_door_height = 7;
  let garage_door_type = 'single';
  let garage_door_material = 'steel';
  let notes = '';
  let confidence_level = 3;
  let loading = false;
  let message = '';
  let messageType = '';

  // Check authentication
  onMount(() => {
    const auth = get(authStore);
    if (!auth.isAuthenticated) {
      goto('/login');
    }
  });

  const doorTypes = [
    { value: 'single', label: 'Single Door' },
    { value: 'double', label: 'Double Door' },
    { value: 'triple', label: 'Triple Door' },
    { value: 'commercial', label: 'Commercial' },
    { value: 'custom', label: 'Custom' }
  ];

  const materials = [
    { value: 'steel', label: 'Steel' },
    { value: 'wood', label: 'Wood' },
    { value: 'aluminum', label: 'Aluminum' },
    { value: 'composite', label: 'Composite' },
    { value: 'glass', label: 'Glass' },
    { value: 'other', label: 'Other' }
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
      const response = await fetch('/api/data-entry/submit', {
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
          garage_door_material,
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
        garage_door_material = 'steel';
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
  <title>Data Entry - Garage Door Game</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 py-8">
  <div class="max-w-2xl mx-auto px-4">
    <div class="bg-white rounded-lg shadow-md p-6">
      <h1 class="text-3xl font-bold text-gray-900 mb-2">Garage Door Data Entry</h1>
      <p class="text-gray-600 mb-6">
        Help us collect accurate garage door measurements for machine learning training. 
        Enter the address and measurements, and we'll automatically capture a Street View image.
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
          <input
            type="text"
            id="address"
            bind:value={address}
            placeholder="123 Main St, City, State"
            required
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p class="text-sm text-gray-500 mt-1">Enter the full address including city and state</p>
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

        <!-- Door Material -->
        <div>
          <label for="door_material" class="block text-sm font-medium text-gray-700 mb-2">
            Door Material
          </label>
          <select
            id="door_material"
            bind:value={garage_door_material}
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {#each materials as material}
              <option value={material.value}>{material.label}</option>
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
