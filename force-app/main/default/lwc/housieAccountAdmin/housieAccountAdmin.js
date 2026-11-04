import { LightningElement } from 'lwc';
import createAccount from '@salesforce/apex/HousieAccountService.createAccount';
import writeSignupGrants from '@salesforce/apex/HousieAccountService.writeSignupGrants';
import activateAccount from '@salesforce/apex/HousieAccountService.activateAccount';

export default class HousieAccountAdmin extends LightningElement {
  email = '';
  displayName = '';
  created;
  error;
  busy = false;
  setupPending = false;

  onEmail(event) { this.email = event.target.value; }
  onName(event) { this.displayName = event.target.value; }

  async create() {
    const emailInput = this.template.querySelector('[data-email]');
    if (!emailInput || !emailInput.reportValidity()) return;
    this.busy = true;
    this.error = undefined;
    this.created = undefined;
    this.setupPending = false;
    try {
      const account = await createAccount({
        email: this.email.trim(),
        displayName: this.displayName.trim()
      });
      this.created = account;
      this.email = '';
      this.displayName = '';
      try {
        await writeSignupGrants({ accountKey: account.Account_Key__c });
        this.created = await activateAccount({ accountKey: account.Account_Key__c });
      } catch (setupError) {
        this.setupPending = true;
        this.error = setupError?.body?.message || setupError?.message ||
          'Account created, but initial resource setup is pending. Retry setup below.';
      }
    } catch (error) {
      this.error = error?.body?.message || error?.message || 'Unable to create account.';
    } finally {
      this.busy = false;
    }
  }

  async retrySetup() {
    if (!this.created?.Account_Key__c) return;
    this.busy = true;
    this.error = undefined;
    try {
      await writeSignupGrants({ accountKey: this.created.Account_Key__c });
      this.created = await activateAccount({ accountKey: this.created.Account_Key__c });
      this.setupPending = false;
    } catch (error) {
      this.error = error?.body?.message || error?.message ||
        'Initial resource setup is still pending. Retry again.';
    } finally {
      this.busy = false;
    }
  }
}