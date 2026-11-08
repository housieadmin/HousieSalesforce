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
import completeTicketCommand from '@salesforce/apex/HousieGameTicketService.completeTicketCommand';
import listMyPendingActions from '@salesforce/apex/HousieGameTicketService.listMyPendingActions';
import prepareStartRequest from '@salesforce/apex/HousieGameStartService.prepareStartRequest';
import commitStartRequest from '@salesforce/apex/HousieGameStartService.commitStartRequest';
import completeStartRequest from '@salesforce/apex/HousieGameStartService.completeStartRequest';
import respondToStartRequest from '@salesforce/apex/HousieGameStartService.respondToStartRequest';
import listOpenStartRequests from '@salesforce/apex/HousieGameStartService.listOpenStartRequests';
import listPendingStartRequests from '@salesforce/apex/HousieGameStartService.listPendingStartRequests';
import listPendingStartExecutions from '@salesforce/apex/HousieGameStartService.listPendingStartExecutions';
import prepareStartExecution from '@salesforce/apex/HousieGameStartService.prepareStartExecution';
import commitStartExecutionBatch from '@salesforce/apex/HousieGameStartService.commitStartExecutionBatch';
import completeStartExecutionBatch from '@salesforce/apex/HousieGameStartService.completeStartExecutionBatch';
import commitStartActivation from '@salesforce/apex/HousieGameStartService.commitStartActivation';
import completeStartActivation from '@salesforce/apex/HousieGameStartService.completeStartActivation';
import recordPresence from '@salesforce/apex/HousieGameStartService.recordPresence';

export default class HousieBoardHub extends LightningElement {
  @api recordId;
  _accountKey;
  @api get accountKey() { return this._accountKey; }
  set accountKey(value) {
    const changed = value && value !== this._accountKey;
    this._accountKey = value;
    if (changed && this.isConnected) {
      this.boards = [];
      this.sendPresenceHeartbeat();
      this.refresh();
    }
  }
  boards = [];
  publicBoards = [];
  publicSearch = '';
  boardName = '';
  visibility = 'PRIVATE';
  inviteBoardId = '';
  loading = false;
  error;
  success;
  _presenceTimer;

  @wire(getRecord, { recordId: '$recordId', fields: [ACCOUNT_KEY_FIELD] })
  wiredAccount({ data, error }) {
    if (data) {
      const accountKey = getFieldValue(data, ACCOUNT_KEY_FIELD);
      if (accountKey && accountKey !== this.accountKey) {
        this.accountKey = accountKey;
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

  connectedCallback() {
    // Presence is account-scoped: multiple open tabs/devices refresh one timestamp.
    if (this.accountKey) {
      this.sendPresenceHeartbeat();
      this.refresh();
    }
    this._presenceTimer = window.setInterval(() => this.sendPresenceHeartbeat(), 30000);
  }

  disconnectedCallback() {
    if (this._presenceTimer) {
      window.clearInterval(this._presenceTimer);
      this._presenceTimer = undefined;
    }
  }

  async sendPresenceHeartbeat() {
    if (!this.accountKey) return;
    try {
      await recordPresence({ accountId: this.accountKey });
    } catch (e) {
      // A failed heartbeat is intentionally not treated as online by the server.
    }
  }

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
      const [myBoards, publicBoards, pendingActions, pendingStartRequests, pendingStartExecutions] = await Promise.all([
        listMyBoards({ accountId: this.accountKey }),
        listPublicBoards(),
        listMyPendingActions({ accountId: this.accountKey }),
        listPendingStartRequests({ accountId: this.accountKey }),
        listPendingStartExecutions({ accountId: this.accountKey })
      ]);
      const pendingByBoard = {};
      pendingActions.filter(action => ['PURCHASE', 'WITHDRAW'].includes(action.actionType)).forEach(action => {
        if (!pendingByBoard[action.boardId]) pendingByBoard[action.boardId] = [];
        pendingByBoard[action.boardId].push({
          ...action,
          retryLabel: action.actionType === 'WITHDRAW'
            ? 'Finish withdrawal' : 'Finish ticket purchase'
        });
      });
      const pendingStartRequestByBoard = {};
      pendingStartRequests.forEach(action => { pendingStartRequestByBoard[action.boardId] = action; });
      const pendingStartExecutionByBoard = {};
      pendingStartExecutions.forEach(action => { pendingStartExecutionByBoard[action.boardId] = action; });
      const previousModes = new Map(this.boards.map(board => [board.boardId, board.ticketMode]));
      const boardsWithTickets = await Promise.all(myBoards.map(async board => {
        const [tickets, startRequests] = await Promise.all([
          listMyTickets({ boardId: board.boardId, accountId: this.accountKey }),
          listOpenStartRequests({ boardId: board.boardId, accountId: this.accountKey })
        ]);
        const hasTickets = tickets.length > 0;
        const pending = pendingByBoard[board.boardId] || [];
        const startRequestsForBoard = startRequests.map(request => ({
          ...request,
          canRespond: request.canApprove && request.requesterAccountId !== this.accountKey && !request.currentUserResponse,
          canExecute: request.canExecute && request.readyToExecute
        }));
        const pendingStartRequest = pendingStartRequestByBoard[board.boardId];
        const pendingStartExecution = pendingStartExecutionByBoard[board.boardId];
        const hasPendingStart = Boolean(pendingStartRequest || pendingStartExecution);
        return {
          ...board,
          tickets,
          hasTickets,
          pendingActions: pending,
          hasPendingActions: pending.length > 0,
          startRequests: startRequestsForBoard,
          hasStartRequests: startRequestsForBoard.length > 0,
          pendingStartRequest,
          pendingStartExecution,
          hasPendingStartRequest: Boolean(pendingStartRequest),
          hasPendingStartExecution: Boolean(pendingStartExecution),
          hasPendingStart,
          canRequestStart: board.currentGameStatus === 'WAITING' && !hasPendingStart && startRequestsForBoard.length === 0,
          ticketMode: previousModes.get(board.boardId) || 'MANUAL',
          ticketCount: tickets.length,
          canPurchase: board.currentGameStatus === 'WAITING' && pending.length === 0 && !hasPendingStart,
          canWithdraw: hasTickets && board.currentGameStatus === 'WAITING' && pending.length === 0 && !hasPendingStart,
          canLeave: pending.length === 0 && !hasPendingStart,
          disableLeave: pending.length > 0 || hasPendingStart
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

  async requestGameStart(event) {
    this.clearMessages();
    const boardId = event.currentTarget.dataset.boardId;
    this.loading = true;
    try {
      const prepared = await prepareStartRequest({
        boardId, accountId: this.accountKey, clientRequestId: this.createRequestId()
      });
      await commitStartRequest({ requestId: prepared.requestId, accountId: this.accountKey });
      const completed = await completeStartRequest({ requestId: prepared.requestId, accountId: this.accountKey });
      if (completed.readyToExecute) {
        const result = await this.runStartExecution(boardId, prepared.requestId);
        this.success = result.message;
      } else {
        this.success = completed.message;
      }
      this.loading = false;
      await this.refresh();
    } catch (e) {
      const message = e?.body?.message || e?.message || 'The start request is pending. Resume it from the board card.';
      this.loading = false;
      await this.refresh();
      this.error = message;
    }
  }

  async resumeStartRequest(event) {
    this.clearMessages();
    const boardId = event.currentTarget.dataset.boardId;
    const requestId = event.currentTarget.dataset.requestId;
    this.loading = true;
    try {
      await commitStartRequest({ requestId, accountId: this.accountKey });
      const completed = await completeStartRequest({ requestId, accountId: this.accountKey });
      if (completed.readyToExecute) {
        const result = await this.runStartExecution(boardId, requestId);
        this.success = result.message;
      } else {
        this.success = completed.message;
      }
      this.loading = false;
      await this.refresh();
    } catch (e) {
      const message = e?.body?.message || e?.message || 'The start request could not be resumed.';
      this.loading = false;
      await this.refresh();
      this.error = message;
    }
  }

  async respondToStart(event) {
    this.clearMessages();
    const boardId = event.currentTarget.dataset.boardId;
    const requestId = event.currentTarget.dataset.requestId;
    const response = event.currentTarget.dataset.response;
    this.loading = true;
    try {
      const result = await respondToStartRequest({
        boardId, requestId, accountId: this.accountKey, response
      });
      if (result.readyToExecute) {
        const started = await this.runStartExecution(boardId, requestId);
        this.success = started.message;
      } else {
        this.success = response === 'APPROVE'
          ? 'Approval recorded. Waiting for the other required approval role.'
          : 'Rejection recorded. The request remains open until the required approvals are satisfied or it expires.';
      }
      this.loading = false;
      await this.refresh();
    } catch (e) {
      const message = e?.body?.message || e?.message || 'Unable to record the start response.';
      this.loading = false;
      await this.refresh();
      this.error = message;
    }
  }

  async executeApprovedStart(event) {
    this.clearMessages();
    const boardId = event.currentTarget.dataset.boardId;
    const requestId = event.currentTarget.dataset.requestId;
    this.loading = true;
    try {
      const result = await this.runStartExecution(boardId, requestId);
      this.success = result.message;
      this.loading = false;
      await this.refresh();
    } catch (e) {
      const message = e?.body?.message || e?.message || 'The approved game start could not be executed.';
      this.loading = false;
      await this.refresh();
      this.error = message;
    }
  }

  async resumeStartExecution(event) {
    this.clearMessages();
    const boardId = event.currentTarget.dataset.boardId;
    const requestId = event.currentTarget.dataset.requestId;
    this.loading = true;
    try {
      const result = await this.runStartExecution(boardId, requestId);
      this.success = result.message;
      this.loading = false;
      await this.refresh();
    } catch (e) {
      const message = e?.body?.message || e?.message || 'Game start is still pending. Retry from this board.';
      this.loading = false;
      await this.refresh();
      this.error = message;
    }
  }

  async runStartExecution(boardId, requestId) {
    let state = await prepareStartExecution({
      boardId, requestId, accountId: this.accountKey
    });
    if (state.status === 'COMMITTED') return state;
    if (state.status !== 'CAPTURED') {
      let captured = false;
      for (let batch = 0; batch < 180; batch += 1) {
        const persisted = await commitStartExecutionBatch({
          requestId, accountId: this.accountKey
        });
        if (persisted.status === 'CAPTURED') {
          captured = true;
          break;
        }
        const finalized = await completeStartExecutionBatch({
          requestId, accountId: this.accountKey, nextCursor: persisted.nextCursor
        });
        if (finalized.status === 'CAPTURED') {
          captured = true;
          break;
        }
      }
      if (!captured) throw new Error('Start funding exceeded the supported batch recovery window.');
    }
    await commitStartActivation({ requestId, accountId: this.accountKey });
    return completeStartActivation({ requestId, accountId: this.accountKey });
  }

  async buyTicket(event) {
    this.clearMessages();
    const boardId = event.currentTarget.dataset.boardId;
    const board = this.boards.find(item => item.boardId === boardId);
    this.loading = true;
    let purchaseStage = 'prepare';
    try {
      const prepared = await prepareTicketPurchase({
        boardId,
        accountId: this.accountKey,
        mode: board?.ticketMode || 'MANUAL',
        requestId: this.createRequestId()
      });
      let result = prepared;
      if (prepared.requestId && prepared.status !== 'ACTIVE' && prepared.status !== 'COMMITTED') {
        purchaseStage = 'commit';
        await commitTicketCommand({
          requestId: prepared.requestId,
          accountId: this.accountKey
        });
        purchaseStage = 'complete';
        result = await completeTicketCommand({
          requestId: prepared.requestId,
          accountId: this.accountKey
        });
      }
      this.success = result.message + (result.ticketId ? ' Ticket: ' + result.ticketId : '');
      this.loading = false;
      await this.refresh();
    } catch (e) {
      const message = e?.body?.message || e?.message || 'Ticket purchase is pending. Use the retry action below.';
      this.loading = false;
      await this.refresh();
      this.error = 'Ticket purchase failed during ' + purchaseStage + ': ' + message;
    }
  }

  async retryPendingAction(event) {
    this.clearMessages();
    const requestId = event.currentTarget.dataset.requestId;
    this.loading = true;
    try {
      await commitTicketCommand({ requestId, accountId: this.accountKey });
      const result = await completeTicketCommand({ requestId, accountId: this.accountKey });
      this.success = result.message;
      this.loading = false;
      await this.refresh();
    } catch (e) {
      const message = e?.body?.message || e?.message || 'The pending action could not be completed. Retry again.';
      this.loading = false;
      await this.refresh();
      this.error = message;
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
      await commitTicketCommand({
        requestId: prepared.requestId,
        accountId: this.accountKey
      });
      const result = await completeTicketCommand({
        requestId: prepared.requestId,
        accountId: this.accountKey
      });
      this.success = result.message;
      this.loading = false;
      await this.refresh();
    } catch (e) {
      const message = e?.body?.message || e?.message || 'Withdrawal is pending. Use the retry action below.';
      this.loading = false;
      await this.refresh();
      this.error = message;
    }
  }

  clearMessages() { this.error = undefined; this.success = undefined; }
}
