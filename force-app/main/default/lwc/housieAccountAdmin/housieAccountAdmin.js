import { LightningElement } from 'lwc';
import createAccount from '@salesforce/apex/HousieAccountService.createAccount';
export default class HousieAccountAdmin extends LightningElement {
  email=''; displayName=''; created; error; busy=false;
  onEmail(e){this.email=e.target.value;}
  onName(e){this.displayName=e.target.value;}
  async create(){
    this.busy=true; this.error=undefined; this.created=undefined;
    try { this.created=await createAccount({input:{email:this.email,displayName:this.displayName}}); }
    catch(e){this.error=e?.body?.message||e.message;}
    finally{this.busy=false;}
  }
}
