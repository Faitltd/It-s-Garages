// ***********************************************
// This example commands.ts shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************

// Custom command to login
Cypress.Commands.add('login', (email: string, password: string) => {
  cy.visit('/login');
  cy.get('input[type="email"]').type(email);
  cy.get('input[type="password"]').type(password);
  cy.get('button[type="submit"]').click();
  cy.url().should('not.include', '/login');
});

// Custom command to register
Cypress.Commands.add('register', (username: string, email: string, password: string) => {
  cy.visit('/login');
  cy.contains('CREATE ACCOUNT').click();
  cy.get('input[name="username"]').type(username);
  cy.get('input[type="email"]').type(email);
  cy.get('input[type="password"]').first().type(password);
  cy.get('input[type="password"]').last().type(password);
  cy.get('button[type="submit"]').click();
  cy.url().should('not.include', '/login');
});

// Custom command to logout
Cypress.Commands.add('logout', () => {
  cy.window().then((win) => {
    win.localStorage.removeItem('authToken');
    win.localStorage.removeItem('user');
  });
  cy.visit('/login');
});

// Custom command to get element by test ID
Cypress.Commands.add('getByTestId', (testId: string) => {
  return cy.get(`[data-testid="${testId}"]`);
});
