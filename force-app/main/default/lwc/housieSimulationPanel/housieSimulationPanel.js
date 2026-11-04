import { LightningElement } from 'lwc';
import simulate from '@salesforce/apex/HousieSimulationController.simulate';
export default class HousieSimulationPanel extends LightningElement {
  scenario='CREATE_BOARD'; payload='{}'; result; error;
  options=['CREATE_BOARD','CREATE_GAME','BUY_TICKET','BOT_OFFER','START_REQUEST','PAUSE_REQUEST','RESUME_REQUEST','CANCEL_REQUEST','DRAW_NUMBER','SUBMIT_CLAIM','SETTLE_GAME','WALLET_GRANT'].map(x=>({label:x,value:x}));
  onScenario(e){this.scenario=e.detail.value;}
  onPayload(e){this.payload=e.detail.value;}
  async run(){this.result=undefined;this.error=undefined;try{this.result=await simulate({scenario:this.scenario,payloadJson:this.payload});}catch(e){this.error=e?.body?.message||e.message;}}
}