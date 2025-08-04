describe('Navigation and Routing', () => {
  const testUser = {
    username: `navuser${Date.now()}`,
    email: `nav${Date.now()}@example.com`,
    password: 'TestPassword123!'
  };

  describe('Public Routes', () => {
    it('should access login page without authentication', () => {
      cy.visit('/login');
      cy.contains('GARAGE DOOR QUEST').should('be.visible');
      cy.contains('PLAYER LOGIN').should('be.visible');
    });

    it('should redirect to login from root when not authenticated', () => {
      cy.visit('/');
      cy.url().should('include', '/login');
    });
  });

  describe('Protected Routes', () => {
    beforeEach(() => {
      cy.register(testUser.username, testUser.email, testUser.password);
    });

    it('should access game page when authenticated', () => {
      cy.visit('/game');
      cy.contains('GARAGE DOOR QUEST').should('be.visible');
      cy.contains('START GAME').should('be.visible');
    });

    it('should redirect authenticated users from login to game', () => {
      cy.visit('/login');
      cy.url().should('include', '/game');
    });

    it('should handle direct navigation to game page', () => {
      cy.visit('/game');
      cy.url().should('include', '/game');
      cy.contains('GARAGE DOOR QUEST').should('be.visible');
    });
  });

  describe('Authentication State Persistence', () => {
    it('should maintain authentication across page reloads', () => {
      cy.register(testUser.username, testUser.email, testUser.password);
      
      // Reload the page
      cy.reload();
      
      // Should still be on game page
      cy.url().should('include', '/game');
      cy.contains('GARAGE DOOR QUEST').should('be.visible');
    });

    it('should maintain authentication across browser tabs', () => {
      cy.register(testUser.username, testUser.email, testUser.password);
      
      // Open new tab/window (simulate by visiting login)
      cy.visit('/login');
      
      // Should redirect to game since already authenticated
      cy.url().should('include', '/game');
    });

    it('should handle expired authentication gracefully', () => {
      cy.register(testUser.username, testUser.email, testUser.password);
      
      // Manually clear auth token to simulate expiration
      cy.window().then((win) => {
        win.localStorage.removeItem('authToken');
      });
      
      // Try to access protected route
      cy.visit('/game');
      
      // Should redirect to login
      cy.url().should('include', '/login');
    });
  });

  describe('URL Handling', () => {
    it('should handle invalid routes gracefully', () => {
      cy.visit('/nonexistent-page', { failOnStatusCode: false });
      
      // Should either redirect to login or show 404
      // Depending on your app's routing configuration
      cy.url().should('match', /(login|404)/);
    });

    it('should preserve intended destination after login', () => {
      // Try to access game page without auth
      cy.visit('/game');
      
      // Should redirect to login
      cy.url().should('include', '/login');
      
      // Login
      cy.register(testUser.username, testUser.email, testUser.password);
      
      // Should redirect to originally intended page (game)
      cy.url().should('include', '/game');
    });
  });

  describe('Browser Navigation', () => {
    beforeEach(() => {
      cy.register(testUser.username, testUser.email, testUser.password);
    });

    it('should handle browser back button correctly', () => {
      cy.visit('/game');
      
      // Navigate to login (should redirect back to game)
      cy.visit('/login');
      cy.url().should('include', '/game');
      
      // Use browser back button
      cy.go('back');
      
      // Should still be on game page or handle gracefully
      cy.url().should('include', '/game');
    });

    it('should handle browser forward button correctly', () => {
      cy.visit('/game');
      cy.visit('/login'); // redirects to game
      
      cy.go('back');
      cy.go('forward');
      
      // Should handle navigation gracefully
      cy.url().should('include', '/game');
    });
  });

  describe('Mobile Navigation', () => {
    beforeEach(() => {
      cy.viewport('iphone-x');
      cy.register(testUser.username, testUser.email, testUser.password);
    });

    it('should display correctly on mobile devices', () => {
      cy.visit('/game');
      
      // Should be responsive
      cy.contains('GARAGE DOOR QUEST').should('be.visible');
      cy.contains('START GAME').should('be.visible');
      
      // Check if layout adapts to mobile
      cy.get('body').should('have.css', 'width').and('match', /375px|414px/);
    });

    it('should handle touch interactions on mobile', () => {
      cy.visit('/game');
      
      // Should be able to tap buttons
      cy.contains('START GAME').should('be.visible').click();
      
      // Should handle mobile-specific interactions
      cy.get('img', { timeout: 15000 }).should('be.visible');
    });
  });

  describe('Performance and Loading', () => {
    it('should load pages within reasonable time', () => {
      const startTime = Date.now();
      
      cy.visit('/login');
      cy.contains('GARAGE DOOR QUEST').should('be.visible');
      
      cy.then(() => {
        const loadTime = Date.now() - startTime;
        expect(loadTime).to.be.lessThan(5000); // Should load within 5 seconds
      });
    });

    it('should show loading states appropriately', () => {
      cy.register(testUser.username, testUser.email, testUser.password);
      cy.visit('/game');
      
      cy.contains('START GAME').click();
      
      // Should show loading state
      cy.contains('LOADING').should('be.visible');
      
      // Loading should eventually complete
      cy.get('img', { timeout: 15000 }).should('be.visible');
    });
  });
});
