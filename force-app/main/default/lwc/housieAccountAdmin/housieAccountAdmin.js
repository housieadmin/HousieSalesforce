import { LightningElement } from 'lwc';
import createAccount from '@salesforce/apex/HousieAccountService.createAccount';

export default class HousieAccountAdmin extends LightningElement {
  email = '';
  displayName = '';
  created;
  error;
  busy = false;

  onEmail(event) { this.email = event.target.value; }
  onName(event) { this.displayName = event.target.value; }

  async create() {
    const emailInput = this.template.querySelector('[data-email]');
    if (!emailInput || !emailInput.reportValidity()) return;
    this.busy = true;
    this.error = undefined;
    this.created = undefined;
    try {
      this.created = await createAccount({
        email: this.email.trim(),
        displayName: this.displayName.trim()
      });
      this.email = '';
      this.displayName = '';
    } catch (error) {
      this.error = error?.body?.message || error?.message || 'Unable to create account.';
    } finally {
      this.busy = false;
    }
  }
}
