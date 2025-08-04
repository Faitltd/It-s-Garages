<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { goto } from '$app/navigation';
  import { authStore } from '../../lib/stores/auth';

  let data: any = null;
  let loading = true;
  let error = '';

  onMount(() => {
    const auth = get(authStore);
    if (!auth.isAuthenticated) {
      goto('/login');
      return;
    }
    loadData();
  });

  async function loadData() {
    try {
      const auth = get(authStore);
      const response = await fetch('/api/data-entry/export', {
        headers: {
          'Authorization': `Bearer ${auth.token}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        data = result.data;
      } else {
        error = 'Failed to load data';
      }
    } catch (err) {
      error = 'Network error loading data';
    } finally {
      loading = false;
    }
  }

  function downloadJSON() {
    if (!data) return;
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `garage-door-data-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function downloadCSV() {
    if (!data || !data.entries) return;

    const headers = [
      'ID', 'Address', 'Latitude', 'Longitude', 'Street View URL',
      'Door Count', 'Door Width', 'Door Height', 'Door Type', 'Door Material',
      'Notes', 'Confidence Level', 'Created At', 'Username', 'Email',
      'Validation Count', 'Avg Validation Accuracy', 'Avg Points Earned'
    ];

    const csvContent = [
      headers.join(','),
      ...data.entries.map((entry: any) => [
        entry.id,
        `"${entry.address}"`,
        entry.latitude,
        entry.longitude,
        `"${entry.street_view_url}"`,
        entry.garage_door_count,
        entry.garage_door_width,
        entry.garage_door_height,
        entry.garage_door_type,
        entry.garage_door_material || '',
        `"${entry.notes || ''}"`,
        entry.confidence_level,
        entry.created_at,
        entry.username,
        entry.email,
        entry.validation_count,
        entry.avg_validation_accuracy || 0,
        entry.avg_points_earned || 0
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `garage-door-data-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
</script>

<svelte:head>
  <title>Data Dashboard - Garage Door Game</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 py-8">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900">Data Dashboard</h1>
      <p class="mt-2 text-gray-600">View and export collected garage door data for ML training</p>
    </div>

    {#if loading}
      <div class="flex justify-center items-center py-12">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    {:else if error}
      <div class="bg-red-50 border border-red-200 rounded-md p-4">
        <p class="text-red-800">{error}</p>
      </div>
    {:else if data}
      <!-- Statistics Cards -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div class="bg-white rounded-lg shadow p-6">
          <h3 class="text-sm font-medium text-gray-500">Total Entries</h3>
          <p class="text-3xl font-bold text-blue-600">{data.statistics.total_entries}</p>
        </div>
        <div class="bg-white rounded-lg shadow p-6">
          <h3 class="text-sm font-medium text-gray-500">Contributors</h3>
          <p class="text-3xl font-bold text-green-600">{data.statistics.unique_contributors}</p>
        </div>
        <div class="bg-white rounded-lg shadow p-6">
          <h3 class="text-sm font-medium text-gray-500">Avg Door Count</h3>
          <p class="text-3xl font-bold text-purple-600">{data.statistics.avg_door_count?.toFixed(1) || 0}</p>
        </div>
        <div class="bg-white rounded-lg shadow p-6">
          <h3 class="text-sm font-medium text-gray-500">Avg Confidence</h3>
          <p class="text-3xl font-bold text-orange-600">{data.statistics.avg_confidence?.toFixed(1) || 0}/5</p>
        </div>
      </div>

      <!-- Export Buttons -->
      <div class="bg-white rounded-lg shadow p-6 mb-8">
        <h2 class="text-xl font-bold text-gray-900 mb-4">Export Data</h2>
        <div class="flex gap-4">
          <button
            on:click={downloadJSON}
            class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            📄 Download JSON
          </button>
          <button
            on:click={downloadCSV}
            class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            📊 Download CSV
          </button>
        </div>
        <p class="text-sm text-gray-500 mt-2">
          Export timestamp: {new Date(data.export_timestamp).toLocaleString()}
        </p>
      </div>

      <!-- Data Table -->
      <div class="bg-white rounded-lg shadow overflow-hidden">
        <div class="px-6 py-4 border-b border-gray-200">
          <h2 class="text-xl font-bold text-gray-900">Recent Entries</h2>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Address</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Doors</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Size</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Confidence</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Validations</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              {#each data.entries.slice(0, 50) as entry}
                <tr>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div class="max-w-xs truncate" title={entry.address}>
                      {entry.address}
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{entry.garage_door_count}</td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {entry.garage_door_width}×{entry.garage_door_height}ft
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{entry.garage_door_type}</td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{entry.confidence_level}/5</td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {entry.validation_count} 
                    {#if entry.avg_validation_accuracy}
                      <span class="text-gray-500">({(entry.avg_validation_accuracy * 100).toFixed(0)}%)</span>
                    {/if}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(entry.created_at).toLocaleDateString()}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        {#if data.entries.length > 50}
          <div class="px-6 py-4 bg-gray-50 text-sm text-gray-500">
            Showing first 50 of {data.entries.length} entries. Download full dataset using export buttons above.
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>
