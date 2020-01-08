/// <reference types="Cypress" />

it('can create a new team', () => {
  cy.server();
  cy.route('/balancer/teams/*/wait-till-ready').as('awaitStartup');

  cy.visit('/balancer');

  cy.contains('MultiJuicer');

  cy.get('[data-test-id="teamname-input"]')
    .type('team42')
    .should('have.value', 'team42');

  cy.get('[data-test-id="create-join-team-button"]').click();

  cy.url().should('include', '/balancer/teams/team42/joined/');

  cy.contains('Team Created');
  cy.get('[data-test-id="instance-status"]').contains(
    'Starting a new Juice Shop Instance'
  );

  cy.wait('@awaitStartup');

  cy.get('[data-test-id="instance-status"]').contains(
    'Juice Shop Instance ready'
  );

  cy.get('[data-test-id="start-hacking-button"]').click();

  cy.url().should('eq', Cypress.config().baseUrl + '/#/');
  cy.contains('Welcome to OWASP Juice Shop');
});

it('can join an existing team', () => {
  cy.server();
  cy.route('/balancer/teams/*/wait-till-ready').as('awaitStartup');

  // First Person creating Instance (very simmilar to previous test case)
  cy.visit('/balancer');
  cy.contains('MultiJuicer');
  cy.get('[data-test-id="teamname-input"]')
    .type('team43')
    .should('have.value', 'team43');
  cy.get('[data-test-id="create-join-team-button"]').click();
  cy.url().should('include', '/balancer/teams/team43/joined/');

  cy.contains('Team Created');
  cy.get('[data-test-id="instance-status"]').contains(
    'Starting a new Juice Shop Instance'
  );

  cy.get('[data-test-id="passcode-display"]')
    .should('be.visible')
    .then(passcodeDisplay => {
      const passcode = passcodeDisplay.text();

      expect(passcode).to.match(/[a-zA-Z0-9]{8}/);

      // Second team trying to join in
      cy.visit('/balancer');
      cy.contains('MultiJuicer');
      cy.get('[data-test-id="teamname-input"]').type('team43');
      cy.get('[data-test-id="create-join-team-button"]').click();

      // Should not route to joining page instead of join page
      cy.url().should('include', '/balancer/teams/team43/joining/');

      cy.get('[data-test-id="passcode-input"]')
        .type(passcode)
        .should('have.value', passcode);
      cy.get('[data-test-id="join-team-button"]').click();

      cy.contains('Logged in as');
      cy.contains('team43');
    });
});

it('can login as admin', () => {
  cy.server();

  cy.visit('/balancer');

  cy.contains('MultiJuicer');

  cy.get('[data-test-id="teamname-input"]')
    .type('admin')
    .should('have.value', 'admin');

  cy.get('[data-test-id="create-join-team-button"]').click();

  cy.url().should('include', '/balancer/teams/admin/joining/');

  cy.get('[data-test-id="passcode-input"]')
    .type(Cypress.env('ADMIN_PASSWORD'))
    .should('have.value', 'ADMIN_PASSWORD');
  cy.get('[data-test-id="join-team-button"]').click();

  cy.url().should('include', '/balancer/admin');

  cy.contains('Active Teams');
});
