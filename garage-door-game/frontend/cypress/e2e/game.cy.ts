describe('Game Functionality', () => {
  const testUser = {
    username: `gameuser${Date.now()}`,
    email: `game${Date.now()}@example.com`,
    password: 'TestPassword123!'
  };

  beforeEach(() => {
    // Register and login before each test
    cy.register(testUser.username, testUser.email, testUser.password);
    cy.visit('/game');
  });

  describe('Game Interface', () => {
    it('should display the game interface correctly', () => {
      cy.contains('GARAGE DOOR QUEST').should('be.visible');
      cy.contains('START GAME').should('be.visible');
      
      // Should show difficulty selection
      cy.contains('DIFFICULTY').should('be.visible');
    });

    it('should allow difficulty selection', () => {
      // Check if difficulty buttons are present
      cy.contains('EASY').should('be.visible');
      cy.contains('MEDIUM').should('be.visible');
      cy.contains('HARD').should('be.visible');
      
      // Select different difficulties
      cy.contains('EASY').click();
      cy.contains('MEDIUM').click();
      cy.contains('HARD').click();
    });
  });

  describe('Game Flow', () => {
    it('should start a game successfully', () => {
      cy.contains('START GAME').click();
      
      // Should show loading or game started state
      cy.contains('LOADING', { timeout: 10000 }).should('be.visible');
      
      // Game should eventually load
      cy.get('img', { timeout: 15000 }).should('be.visible');
      
      // Should show game controls
      cy.contains('How many garage doors').should('be.visible');
    });

    it('should display game timer', () => {
      cy.contains('START GAME').click();
      
      // Wait for game to load
      cy.get('img', { timeout: 15000 }).should('be.visible');
      
      // Should show timer
      cy.contains('Time remaining').should('be.visible');
    });

    it('should allow submitting a guess', () => {
      cy.contains('START GAME').click();
      
      // Wait for game to load
      cy.get('img', { timeout: 15000 }).should('be.visible');
      
      // Fill in guess form
      cy.get('input[type="number"]').first().type('2');
      cy.get('input[type="range"]').invoke('val', 80).trigger('input');
      
      // Submit guess
      cy.contains('SUBMIT GUESS').click();
      
      // Should show results
      cy.contains('GAME COMPLETE', { timeout: 10000 }).should('be.visible');
      cy.contains('Your Score').should('be.visible');
    });

    it('should show game results after submission', () => {
      cy.contains('START GAME').click();
      
      // Wait for game to load
      cy.get('img', { timeout: 15000 }).should('be.visible');
      
      // Submit a guess
      cy.get('input[type="number"]').first().type('1');
      cy.contains('SUBMIT GUESS').click();
      
      // Should show results
      cy.contains('GAME COMPLETE', { timeout: 10000 }).should('be.visible');
      cy.contains('Your Score').should('be.visible');
      cy.contains('Accuracy').should('be.visible');
      cy.contains('Points Earned').should('be.visible');
      
      // Should show correct answer
      cy.contains('Correct Answer').should('be.visible');
    });

    it('should allow starting a new game after completion', () => {
      // Complete a game first
      cy.contains('START GAME').click();
      cy.get('img', { timeout: 15000 }).should('be.visible');
      cy.get('input[type="number"]').first().type('2');
      cy.contains('SUBMIT GUESS').click();
      
      // Wait for results
      cy.contains('GAME COMPLETE', { timeout: 10000 }).should('be.visible');
      
      // Should be able to start new game
      cy.contains('PLAY AGAIN').click();
      
      // Should show start game interface again
      cy.contains('START GAME').should('be.visible');
    });
  });

  describe('Game Validation', () => {
    it('should require garage count input', () => {
      cy.contains('START GAME').click();
      
      // Wait for game to load
      cy.get('img', { timeout: 15000 }).should('be.visible');
      
      // Try to submit without garage count
      cy.contains('SUBMIT GUESS').click();
      
      // Should show validation error
      cy.contains('required').should('be.visible');
    });

    it('should validate garage count range', () => {
      cy.contains('START GAME').click();
      
      // Wait for game to load
      cy.get('img', { timeout: 15000 }).should('be.visible');
      
      // Try invalid garage count
      cy.get('input[type="number"]').first().clear().type('0');
      cy.contains('SUBMIT GUESS').click();
      
      // Should show validation error or prevent submission
      cy.get('input[type="number"]').first().should('have.attr', 'min', '1');
    });
  });

  describe('Game Features', () => {
    it('should show confidence slider', () => {
      cy.contains('START GAME').click();
      
      // Wait for game to load
      cy.get('img', { timeout: 15000 }).should('be.visible');
      
      // Should show confidence slider
      cy.contains('Confidence').should('be.visible');
      cy.get('input[type="range"]').should('be.visible');
    });

    it('should show optional garage details inputs', () => {
      cy.contains('START GAME').click();
      
      // Wait for game to load
      cy.get('img', { timeout: 15000 }).should('be.visible');
      
      // Should show optional inputs
      cy.contains('Width').should('be.visible');
      cy.contains('Height').should('be.visible');
      cy.contains('Type').should('be.visible');
    });

    it('should handle different difficulty levels', () => {
      // Test easy difficulty
      cy.contains('EASY').click();
      cy.contains('START GAME').click();
      cy.get('img', { timeout: 15000 }).should('be.visible');
      
      // Should show longer time limit for easy
      cy.contains('Time remaining').should('be.visible');
      
      // Go back and try hard difficulty
      cy.reload();
      cy.contains('HARD').click();
      cy.contains('START GAME').click();
      cy.get('img', { timeout: 15000 }).should('be.visible');
      
      // Should show shorter time limit for hard
      cy.contains('Time remaining').should('be.visible');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', () => {
      // Intercept API calls and simulate network error
      cy.intercept('POST', '**/game/start', { forceNetworkError: true }).as('gameStartError');
      
      cy.contains('START GAME').click();
      
      // Should show error message
      cy.contains('Network error', { timeout: 10000 }).should('be.visible');
    });

    it('should handle API errors gracefully', () => {
      // Intercept API calls and simulate server error
      cy.intercept('POST', '**/game/start', { statusCode: 500, body: { error: 'Server error' } }).as('gameStartError');
      
      cy.contains('START GAME').click();
      
      // Should show error message
      cy.contains('error', { timeout: 10000 }).should('be.visible');
    });
  });
});
