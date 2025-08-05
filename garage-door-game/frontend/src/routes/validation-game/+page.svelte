<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth';
  import { get } from 'svelte/store';

  let gameState = 'menu'; // 'menu', 'playing', 'question-result', 'final-results'
  let sessionId = '';
  let address = '';
  let imageUrl = '';
  let imageError = false;
  let timeLimit = 60;
  let timeLeft = 60;
  let timer: any;
  let questionsAnswered = 0;
  let totalScore = 0;

  // Game form data
  let garage_door_count = 1;
  let garage_door_width = 8;
  let garage_door_height = 7;
  let garage_door_type = 'single';
  let confidence = 3;

  // Results
  let gameResult: any = null;
  let loading = false;
  let message = '';

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

  async function startGame() {
    loading = true;
    message = '';

    try {
      const auth = get(authStore);
      const response = await fetch('/api/validation-game/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auth.token}`
        }
      });

      const data = await response.json();

      if (data.success) {
        sessionId = data.data.sessionId;
        address = data.data.address;
        imageUrl = data.data.imageUrl;
        imageError = false; // Reset error state
        timeLimit = data.data.timeLimit;
        timeLeft = timeLimit;

        gameState = 'playing';
        startTimer();
      } else {
        message = data.error?.message || 'Failed to start game';
      }
    } catch (error) {
      console.error('Start game error:', error);
      message = 'Network error. Please try again.';
    } finally {
      loading = false;
    }
  }

  function startTimer() {
    timer = setInterval(() => {
      timeLeft--;
      if (timeLeft <= 0) {
        clearInterval(timer);
        submitGuess(); // Auto-submit when time runs out
      }
    }, 1000);
  }

  async function submitGuess(skip = false, notVisible = false) {
    if (timer) clearInterval(timer);
    loading = true;

    try {
      const auth = get(authStore);
      const payload = {
        sessionId,
        skipped: skip,
        notVisible: notVisible
      };

      // Only include guess data if not skipping or marking as not visible
      if (!skip && !notVisible) {
        Object.assign(payload, {
          garage_door_count,
          garage_door_width,
          garage_door_height,
          garage_door_type,
          confidence
        });
      }

      const response = await fetch('/api/validation-game/guess', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auth.token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (data.success) {
        gameResult = data.data;
        gameState = 'question-result';
      } else {
        message = data.error?.message || 'Failed to submit guess';
      }
    } catch (error) {
      console.error('Submit guess error:', error);
      message = 'Network error. Please try again.';
    } finally {
      loading = false;
    }
  }

  async function nextQuestion() {
    loading = true;
    message = '';

    try {
      const auth = get(authStore);
      const response = await fetch('/api/validation-game/next-question', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auth.token}`
        },
        body: JSON.stringify({ sessionId })
      });

      const data = await response.json();

      if (data.success) {
        // Update with new question data
        address = data.data.address;
        imageUrl = data.data.imageUrl;
        imageError = false;
        timeLimit = data.data.timeLimit;
        timeLeft = timeLimit;
        questionsAnswered = data.data.questionsAnswered;
        totalScore = data.data.totalScore;

        // Reset form
        garage_door_count = 1;
        garage_door_width = 8;
        garage_door_height = 7;
        garage_door_type = 'single';
        confidence = 3;

        gameState = 'playing';
        startTimer();
      } else {
        // No more questions available
        gameState = 'final-results';
      }
    } catch (error) {
      console.error('Next question error:', error);
      message = 'Failed to load next question';
    } finally {
      loading = false;
    }
  }

  async function endSession() {
    try {
      const auth = get(authStore);
      await fetch('/api/validation-game/end-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auth.token}`
        },
        body: JSON.stringify({ sessionId })
      });
    } catch (error) {
      console.error('End session error:', error);
    }

    gameState = 'final-results';
  }

  async function playAgain() {
    // Reset all game state
    gameResult = null;
    garage_door_count = 1;
    garage_door_width = 8;
    garage_door_height = 7;
    garage_door_type = 'single';
    confidence = 3;
    message = '';
    sessionId = '';
    address = '';
    imageUrl = '';
    imageError = false;
    timeLeft = 60;
    questionsAnswered = 0;
    totalScore = 0;
    if (timer) clearInterval(timer);

    // Start a new game immediately
    await startGame();
  }

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
</script>

<svelte:head>
  <title>Garage Door Game - It's Garages</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 py-4">
  <div class="max-w-2xl mx-auto px-4">
    
    {#if gameState === 'menu'}
      <!-- Game Menu -->
      <div class="text-box p-6 text-center">
        <h1 class="text-2xl font-bold mb-4">🎮 GARAGE DOOR GAME</h1>
        <p class="text-sm text-gray-300 mb-6">
          Guess garage door sizes from Street View images. Skip if no door is visible!
        </p>

        {#if message}
          <div class="mb-4 p-3 bg-red-900 border border-red-700 rounded text-red-300 text-sm">
            {message}
          </div>
        {/if}

        <div class="space-y-3">
          <button
            on:click={startGame}
            disabled={loading}
            class="btn-retro btn-primary w-full text-sm"
          >
            {loading ? '⏳ STARTING...' : '🚀 START GAME'}
          </button>

          <div class="text-xs text-gray-400 space-y-1">
            <p>• Look at the garage door in the image</p>
            <p>• Estimate count, size, and type</p>
            <p>• Skip if no door visible</p>
            <p>• Earn points for participation!</p>
          </div>

          <button
            on:click={() => goto('/')}
            class="btn-retro btn-outline w-full text-sm"
          >
            ← BACK TO MENU
          </button>
        </div>
      </div>

    {:else if gameState === 'playing'}
      <!-- Game Playing -->
      <div class="text-box overflow-hidden">
        <!-- Header -->
        <div class="bg-blue-900 text-white p-3 flex justify-between items-center border-b border-blue-700">
          <h2 class="text-lg font-bold">🎮 GARAGE DOOR GAME</h2>
          <div class="text-sm font-mono">
            ⏱️ {formatTime(timeLeft)}
          </div>
        </div>

        <div class="p-4">
          <!-- Address -->
          <div class="mb-4">
            <h3 class="text-sm font-bold text-gray-300 mb-1">ADDRESS:</h3>
            <p class="text-xs text-gray-400">{address}</p>
          </div>

          <div class="space-y-6">
            <!-- Street View Image -->
            <div>
              <h3 class="text-sm font-bold text-gray-300 mb-2">STREET VIEW:</h3>
              {#if imageUrl && !imageError}
                <img
                  src={imageUrl}
                  alt="Street view of {address}"
                  class="w-full h-48 object-cover rounded border border-gray-600"
                  on:error={() => imageError = true}
                />
              {:else}
                <div class="w-full h-48 bg-gray-800 rounded flex items-center justify-center border border-gray-600">
                  <div class="text-center">
                    <div class="text-3xl text-gray-500 mb-2">🏠</div>
                    <p class="text-gray-400 font-bold text-sm">NO IMAGE</p>
                    <p class="text-gray-500 text-xs">Use address info</p>
                  </div>
                </div>
              {/if}
            </div>

            <!-- Guess Form -->
            <div>
              <h3 class="text-sm font-bold text-gray-300 mb-3">YOUR GUESS:</h3>

              <form on:submit|preventDefault={submitGuess} class="space-y-3">
                <!-- Door Count -->
                <div>
                  <label class="block text-xs font-bold text-gray-400 mb-1">
                    DOORS
                  </label>
                  <select bind:value={garage_door_count} class="w-full px-2 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm">
                    {#each [1, 2, 3, 4, 5] as count}
                      <option value={count}>{count}</option>
                    {/each}
                  </select>
                </div>

                <!-- Dimensions -->
                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label class="block text-xs font-bold text-gray-400 mb-1">
                      WIDTH (ft)
                    </label>
                    <input
                      type="number"
                      bind:value={garage_door_width}
                      min="4"
                      max="20"
                      step="0.5"
                      class="w-full px-2 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm"
                    />
                  </div>
                  <div>
                    <label class="block text-xs font-bold text-gray-400 mb-1">
                      HEIGHT (ft)
                    </label>
                    <input
                      type="number"
                      bind:value={garage_door_height}
                      min="6"
                      max="12"
                      step="0.5"
                      class="w-full px-2 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm"
                    />
                  </div>
                </div>

                <!-- Door Type -->
                <div>
                  <label class="block text-xs font-bold text-gray-400 mb-1">
                    TYPE
                  </label>
                  <select bind:value={garage_door_type} class="w-full px-2 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm">
                    {#each doorTypes as type}
                      <option value={type.value}>{type.label}</option>
                    {/each}
                  </select>
                </div>

                <!-- Confidence -->
                <div>
                  <label class="block text-xs font-bold text-gray-400 mb-1">
                    CONFIDENCE: {confidence}/5
                  </label>
                  <input
                    type="range"
                    bind:value={confidence}
                    min="1"
                    max="5"
                    class="w-full"
                  />
                </div>

                <div class="space-y-2">
                  <button
                    type="button"
                    on:click={() => submitGuess(true)}
                    disabled={loading}
                    class="btn-retro btn-outline w-full text-xs"
                  >
                    {loading ? '⏳ SKIPPING...' : '⏭️ SKIP QUESTION'}
                  </button>
                  <button
                    type="button"
                    on:click={() => submitGuess(false, true)}
                    disabled={loading}
                    class="btn-retro btn-warning w-full text-xs"
                  >
                    {loading ? '⏳ MARKING...' : '🚫 NO DOOR VISIBLE'}
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    class="btn-retro btn-success w-full text-xs"
                  >
                    {loading ? '⏳ SUBMITTING...' : '✅ SUBMIT GUESS'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

    {:else if gameState === 'question-result'}
      <!-- Game Results -->
      <div class="bg-white rounded-lg shadow-md p-8">
        <h2 class="text-3xl font-bold text-center mb-6 {gameResult.pointsEarned === 0 && gameResult.accuracy === 0 ? 'text-gray-600' : gameResult.correct ? 'text-green-600' : 'text-orange-600'}">
          {gameResult.pointsEarned === 0 && gameResult.accuracy === 0 ? '⏭️ Question Skipped' : gameResult.correct ? '🎉 Great Job!' : '📏 Good Try!'}
        </h2>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <!-- Your Guess -->
          <div class="bg-gray-50 p-6 rounded-lg">
            <h3 class="text-lg font-bold text-gray-900 mb-4">Your Guess:</h3>
            {#if gameResult.pointsEarned === 0 && gameResult.accuracy === 0}
              <div class="text-center text-gray-600">
                <p class="text-lg">Question Skipped</p>
                <p class="text-sm">No guess submitted</p>
              </div>
            {:else}
              <div class="space-y-2 text-sm">
                <p><strong>Count:</strong> {garage_door_count} door{garage_door_count > 1 ? 's' : ''}</p>
                <p><strong>Size:</strong> {garage_door_width} × {garage_door_height} feet</p>
                <p><strong>Type:</strong> {garage_door_type}</p>
                <p><strong>Confidence:</strong> {confidence}/5</p>
              </div>
            {/if}
          </div>

          <!-- Data Collection Info -->
          <div class="bg-green-50 p-6 rounded-lg">
            <h3 class="text-lg font-bold text-gray-900 mb-4">Data Collected!</h3>
            <div class="space-y-2 text-sm">
              <p><strong>Your Submission:</strong> {garage_door_count} door{garage_door_count > 1 ? 's' : ''}</p>
              <p><strong>Size:</strong> {garage_door_width} × {garage_door_height} feet</p>
              <p><strong>Type:</strong> {garage_door_type}</p>
              <p><strong>Confidence:</strong> {confidence}/5</p>
            </div>
          </div>
        </div>

        <!-- Points Earned -->
        <div class="bg-gradient-to-r from-green-50 to-blue-50 p-6 rounded-lg mb-6">
          <div class="text-center">
            <div class="text-4xl font-bold text-green-600 mb-2">+{gameResult.pointsEarned} Points</div>
            <div class="text-lg text-gray-600">Thanks for contributing data!</div>
            <div class="text-sm text-gray-500 mt-2">
              Total Questions: {gameResult.questionsAnswered} | Total Score: {gameResult.totalScore}
            </div>
          </div>
        </div>

        <!-- Feedback -->
        <div class="text-center mb-6">
          <p class="text-lg text-gray-700 italic">"{gameResult.feedback}"</p>
        </div>

        <!-- Actions -->
        <div class="flex justify-center space-x-4">
          <button
            on:click={nextQuestion}
            disabled={loading}
            class="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Next Question'}
          </button>
          <button
            on:click={endSession}
            disabled={loading}
            class="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            End Session
          </button>
        </div>
      </div>

    {:else if gameState === 'final-results'}
      <!-- Final Results -->
      <div class="bg-white rounded-lg shadow-md p-8 text-center">
        <h2 class="text-3xl font-bold text-green-600 mb-6">🎉 Session Complete!</h2>

        <div class="mb-8">
          <div class="text-6xl font-bold text-blue-600 mb-2">{totalScore}</div>
          <p class="text-lg text-gray-600">Total Points Earned</p>
        </div>

        <div class="mb-8">
          <div class="text-3xl font-bold text-gray-800 mb-2">{questionsAnswered}</div>
          <p class="text-lg text-gray-600">Questions Answered</p>
        </div>

        <div class="flex justify-center space-x-4">
          <button
            on:click={playAgain}
            class="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Play Again
          </button>
          <button
            on:click={() => goto('/data-entry')}
            class="px-6 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            Submit More Data
          </button>
        </div>
      </div>
    {/if}
  </div>
</div>
