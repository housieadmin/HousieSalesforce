import { LightningElement, wire } from 'lwc';
import { CurrentPageReference } from 'lightning/navigation';
import resolve from '@salesforce/apex/HousieRouteController.resolve';

export default class HousieApp extends LightningElement {
  context;
  error;
  loading = true;
  pageRef;
  @wire(CurrentPageReference)
  setPageRef(ref) {
    this.pageRef = ref;
    const token = ref?.state?.c__token || ref?.state?.token || this.readTokenFromPath();
    resolve({ token }).then(result => {
      this.context = result;
      this.error = undefined;
    }).catch(e => {
      this.error = e?.body?.message || e.message || 'Unable to resolve account context.';
    }).finally(() => { this.loading = false; });
  }
  readTokenFromPath() {
    const parts = window.location.pathname.split('/').filter(Boolean);
    return parts.length ? parts[parts.length - 1] : null;
  }
}