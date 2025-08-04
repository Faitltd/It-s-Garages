describe('Authentication Flow', () => {
  const testUser = {
    username: `testuser${Date.now()}`,
    email: `test${Date.now()}@example.com`,
    password: 'TestPassword123!'
  };

  beforeEach(() => {
    cy.visit('/login');
  });

  describe('User Registration', () => {
    it('should register a new user successfully', () => {
      // Click on create account button
      cy.contains('CREATE ACCOUNT').click();
      
      // Fill in registration form
      cy.get('input[name="username"]').type(testUser.username);
      cy.get('input[type="email"]').type(testUser.email);
      cy.get('input[type="password"]').first().type(testUser.password);
      cy.get('input[type="password"]').last().type(testUser.password);
      
      // Submit form
      cy.get('button[type="submit"]').click();
      
      // Should redirect to game page
      cy.url().should('include', '/game');
      
      // Should show user info or game interface
      cy.contains('GARAGE DOOR QUEST').should('be.visible');
    });

    it('should show validation errors for invalid input', () => {
      cy.contains('CREATE ACCOUNT').click();
      
      // Try to submit with empty fields
      cy.get('button[type="submit"]').click();
      
      // Should show validation errors
      cy.contains('required').should('be.visible');
    });

    it('should show error for mismatched passwords', () => {
      cy.contains('CREATE ACCOUNT').click();
      
      cy.get('input[name="username"]').type('testuser');
      cy.get('input[type="email"]').type('test@example.com');
      cy.get('input[type="password"]').first().type('password1');
      cy.get('input[type="password"]').last().type('password2');
      
      cy.get('button[type="submit"]').click();
      
      // Should show password mismatch error
      cy.contains('do not match').should('be.visible');
    });
  });

  describe('User Login', () => {
    beforeEach(() => {
      // Register a user first
      cy.register(testUser.username, testUser.email, testUser.password);
      cy.logout();
      cy.visit('/login');
    });

    it('should login successfully with valid credentials', () => {
      cy.get('input[type="email"]').type(testUser.email);
      cy.get('input[type="password"]').type(testUser.password);
      cy.get('button[type="submit"]').click();
      
      // Should redirect to game page
      cy.url().should('include', '/game');
      cy.contains('GARAGE DOOR QUEST').should('be.visible');
    });

    it('should show error for invalid credentials', () => {
      cy.get('input[type="email"]').type('invalid@example.com');
      cy.get('input[type="password"]').type('wrongpassword');
      cy.get('button[type="submit"]').click();
      
      // Should show error message
      cy.contains('Invalid email or password').should('be.visible');
    });

    it('should show validation errors for empty fields', () => {
      cy.get('button[type="submit"]').click();
      
      // Should show validation errors
      cy.contains('required').should('be.visible');
    });
  });

  describe('Authentication State', () => {
    it('should redirect to login when accessing protected routes without auth', () => {
      cy.visit('/game');
      cy.url().should('include', '/login');
    });

    it('should maintain authentication state after page refresh', () => {
      cy.register(testUser.username, testUser.email, testUser.password);
      
      // Refresh the page
      cy.reload();
      
      // Should still be authenticated
      cy.url().should('include', '/game');
    });

    it('should logout successfully', () => {
      cy.register(testUser.username, testUser.email, testUser.password);
      
      // Logout
      cy.logout();
      
      // Should redirect to login
      cy.url().should('include', '/login');
      
      // Trying to access protected route should redirect to login
      cy.visit('/game');
      cy.url().should('include', '/login');
    });
  });

  describe('Form Interactions', () => {
    it('should toggle between login and register forms', () => {
      // Should start with login form
      cy.contains('PLAYER LOGIN').should('be.visible');
      
      // Click create account
      cy.contains('CREATE ACCOUNT').click();
      
      // Should show register form
      cy.contains('JOIN THE QUEST').should('be.visible');
      cy.get('input[name="username"]').should('be.visible');
      
      // Click login instead
      cy.contains('LOGIN INSTEAD').click();
      
      // Should show login form again
      cy.contains('PLAYER LOGIN').should('be.visible');
      cy.get('input[name="username"]').should('not.exist');
    });

    it('should clear form when switching between login and register', () => {
      // Fill in login form
      cy.get('input[type="email"]').type('test@example.com');
      cy.get('input[type="password"]').type('password');
      
      // Switch to register
      cy.contains('CREATE ACCOUNT').click();
      
      // Switch back to login
      cy.contains('LOGIN INSTEAD').click();
      
      // Fields should be cleared
      cy.get('input[type="email"]').should('have.value', '');
      cy.get('input[type="password"]').should('have.value', '');
    });
  });
});
