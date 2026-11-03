import { LightningElement, api, wire } from 'lwc';
import { getRecord, getFieldValue } from 'lightning/uiRecordApi';
import ACCOUNT_KEY_FIELD from '@salesforce/schema/Housie_Account__c.Account_Key__c';

import createBoardAction from '@salesforce/apex/HousieBoardService.createBoard';
import listMyBoards from '@salesforce/apex/HousieBoardService.listMyBoards';
import listPublicBoards from '@salesforce/apex/HousieBoardService.listPublicBoards';
import joinBoardAction from '@salesforce/apex/HousieBoardService.joinBoard';
import leaveBoardAction from '@salesforce/apex/HousieBoardService.leaveBoard';
import listMyTickets from '@salesforce/apex/HousieGameTicketService.listMyTickets';
import prepareTicketPurchase from '@salesforce/apex/HousieGameTicketService.prepareTicketPurchase';
import prepareWaitingGameWithdrawal from '@salesforce/apex/HousieGameTicketService.prepareWaitingGameWithdrawal';
import commitTicketCommand from '@salesforce/apex/HousieGameTicketService.commitTicketCommand';
import listMyPendingActions from '@salesforce/apex/HousieGameTicketService.listMyPendingActions';

export default class HousieBoardHub extends LightningElement {
  @api recordId;
  accountKey;
  boards = [];
  publicBoards = [];
  publicSearch = '';
  boardName = '';
  visibility = 'PRIVATE';
  inviteBoardId = '';
  loading = false;
  error;
  success;

  @wire(getRecord, { recordId: '$recordId', fields: [ACCOUNT_KEY_FIELD] })
  wiredAccount({ data, error }) {
    if (data) {
      const accountKey = getFieldValue(data, ACCOUNT_KEY_FIELD);
      if (accountKey && accountKey !== this.accountKey) {
        this.accountKey = accountKey;
        this.boards = [];
        this.refresh();
      }
    } else if (error) {
      this.error = error?.body?.message || error?.message || 'Unable to resolve this Housie account.';
    }
  }

  visibilityOptions = [
    { label: 'Private · invitation link', value: 'PRIVATE' },
    { label: 'Public · searchable directory', value: 'PUBLIC' }
  ];
  ticketModeOptions = [
    { label: 'Manual', value: 'MANUAL' },
    { label: 'Automatic · uses 1 token', value: 'AUTOMATIC' }
  ];

  get hasBoards() { return this.boards.length > 0; }
  get filteredPublicBoards() {
    const term = this.publicSearch.trim().toLowerCase();
    return this.publicBoards.filter(board =>
      !term || (board.name || '').toLowerCase().includes(term)
    );
  }
  get hasPublicBoards() { return this.filteredPublicBoards.length > 0; }
  handleName(event) { this.boardName = event.target.value; }
  handleVisibility(event) { this.visibility = event.detail.value; }
  handleInviteBoard(event) { this.inviteBoardId = event.target.value.trim(); }
  handlePublicSearch(event) { this.publicSearch = event.target.value; }

  async refresh() {
    if (!this.accountKey || this.loading) return;
    this.loading = true;
    this.error = undefined;
    try {
      const [myBoards, publicBoards, pendingActions] = await Promise.all([
        listMyBoards({ accountId: this.accountKey }),
        listPublicBoards(),
        listMyPendingActions({ accountId: this.accountKey })
      ]);
      const pendingByBoard = {};
      pendingActions.forEach(action => {
        if (!pendingByBoard[action.boardId]) pendingByBoard[action.boardId] = [];
        pendingByBoard[action.boardId].push({
          ...action,
          retryLabel: action.actionType === 'WITHDRAW'
            ? 'Finish withdrawal' : 'Finish ticket purchase'
        });
      });
      const previousModes = new Map(this.boards.map(board => [board.boardId, board.ticketMode]));
      const boardsWithTickets = await Promise.all(myBoards.map(async board => {
        const [tickets] = await Promise.all([
          listMyTickets({ boardId: board.boardId, accountId: this.accountKey })
        ]);
        const hasTickets = tickets.length > 0;
        const pending = pendingByBoard[board.boardId] || [];
        return {
          ...board,
          tickets,
          hasTickets,
          pendingActions: pending,
          hasPendingActions: pending.length > 0,
          ticketMode: previousModes.get(board.boardId) || 'MANUAL',
          ticketCount: tickets.length,
          canPurchase: board.currentGameStatus === 'WAITING' && pending.length === 0,
          canWithdraw: hasTickets && board.currentGameStatus === 'WAITING' && pending.length === 0
        };
      }));
      this.boards = boardsWithTickets;
      this.publicBoards = publicBoards.map(board => {
        const joined = myBoards.some(memberBoard => memberBoard.boardId === board.boardId);
        return { ...board, alreadyMember: joined, joinLabel: joined ? 'Joined' : 'Join board' };
      });
    } catch (e) {
      this.error = e?.body?.message || e?.message || 'Unable to load boards.';
    } finally {
      this.loading = false;
    }
  }

  handleTicketMode(event) {
    const boardId = event.currentTarget.dataset.boardId;
    this.boards = this.boards.map(board =>
      board.boardId === boardId ? { ...board, ticketMode: event.detail.value } : board
    );
  }

  async createBoard() {
    this.clearMessages();
    if (!this.boardName.trim()) { this.error = 'Enter a board name.'; return; }
    this.loading = true;
    try {
      const result = await createBoardAction({
        accountId: this.accountKey, boardName: this.boardName, visibility: this.visibility
      });
      this.success = result.message + ' Board ID: ' + result.boardId;
      this.boardName = '';
      this.loading = false;
      await this.refresh();
    } catch (e) {
      this.error = e?.body?.message || e?.message || 'Unable to create board.';
      this.loading = false;
    }
  }

  async joinBoard() {
    this.clearMessages();
    if (!this.inviteBoardId) { this.error = 'Enter the invitation board ID.'; return; }
    this.loading = true;
    try {
      const result = await joinBoardAction({ boardId: this.inviteBoardId, accountId: this.accountKey });
      this.success = result.message;
      this.inviteBoardId = '';
      this.loading = false;
      await this.refresh();
    } catch (e) {
      this.error = e?.body?.message || e?.message || 'Unable to join board.';
      this.loading = false;
    }
  }

  async joinPublicBoard(event) {
    this.clearMessages();
    const boardId = event.currentTarget.dataset.boardId;
    this.loading = true;
    try {
      const result = await joinBoardAction({ boardId, accountId: this.accountKey });
      this.success = result.message;
      this.loading = false;
      await this.refresh();
    } catch (e) {
      this.error = e?.body?.message || e?.message || 'Unable to join public board.';
      this.loading = false;
    }
  }

  async leaveOwnedBoard(event) {
    this.clearMessages();
    const boardId = event.currentTarget.dataset.boardId;
    this.loading = true;
    try {
      const result = await leaveBoardAction({ boardId, accountId: this.accountKey });
      this.success = result.message;
      this.loading = false;
      await this.refresh();
    } catch (e) {
      this.error = e?.body?.message || e?.message || 'Unable to leave board.';
      this.loading = false;
    }
  }

  createRequestId() {
    return String(Date.now()) + '-' + Math.random().toString(36).slice(2);
  }

  async buyTicket(event) {
    this.clearMessages();
    const boardId = event.currentTarget.dataset.boardId;
    const board = this.boards.find(item => item.boardId === boardId);
    this.loading = true;
    try {
      const prepared = await prepareTicketPurchase({
        boardId,
        accountId: this.accountKey,
        mode: board?.ticketMode || 'MANUAL',
        requestId: this.createRequestId()
      });
      let result = prepared;
      if (prepared.requestId && prepared.status !== 'ACTIVE' && prepared.status !== 'COMMITTED') {
        result = await commitTicketCommand({
          requestId: prepared.requestId,
          accountId: this.accountKey
        });
      }
      this.success = result.message + (result.ticketId ? ' Ticket: ' + result.ticketId : '');
      this.loading = false;
      await this.refresh();
    } catch (e) {
      this.error = e?.body?.message || e?.message || 'Ticket purchase is pending. Use the retry action below.';
      this.loading = false;
      await this.refresh();
    }
  }

  async retryPendingAction(event) {
    this.clearMessages();
    const requestId = event.currentTarget.dataset.requestId;
    this.loading = true;
    try {
      const result = await commitTicketCommand({ requestId, accountId: this.accountKey });
      this.success = result.message;
      this.loading = false;
      await this.refresh();
    } catch (e) {
      this.error = e?.body?.message || e?.message || 'The pending action could not be completed. Retry again.';
      this.loading = false;
      await this.refresh();
    }
  }

  async withdrawFromGame(event) {
    this.clearMessages();
    const boardId = event.currentTarget.dataset.boardId;
    this.loading = true;
    try {
      const prepared = await prepareWaitingGameWithdrawal({
        boardId,
        accountId: this.accountKey,
        requestId: this.createRequestId()
      });
      const result = await commitTicketCommand({
        requestId: prepared.requestId,
        accountId: this.accountKey
      });
      this.success = result.message;
      this.loading = false;
      await this.refresh();
    } catch (e) {
      this.error = e?.body?.message || e?.message || 'Withdrawal is pending. Use the retry action below.';
      this.loading = false;
      await this.refresh();
    }
  }

  clearMessages() { this.error = undefined; this.success = undefined; }
}
