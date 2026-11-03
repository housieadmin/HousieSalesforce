import { LightningElement, api } from 'lwc';
import createBoardAction from '@salesforce/apex/HousieBoardService.createBoard';
import listMyBoards from '@salesforce/apex/HousieBoardService.listMyBoards';
import listPublicBoards from '@salesforce/apex/HousieBoardService.listPublicBoards';
import joinBoardAction from '@salesforce/apex/HousieBoardService.joinBoard';
import leaveBoardAction from '@salesforce/apex/HousieBoardService.leaveBoard';

export default class HousieBoardHub extends LightningElement {
  @api accountKey;
  boards = [];
  publicBoards = [];
  publicSearch = '';
  boardName = '';
  visibility = 'PRIVATE';
  inviteBoardId = '';
  loading = false;
  error;
  success;

  visibilityOptions = [
    { label: 'Private · invitation link', value: 'PRIVATE' },
    { label: 'Public · searchable directory', value: 'PUBLIC' }
  ];

  connectedCallback() { this.refresh(); }
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
    if (!this.accountKey) return;
    this.loading = true;
    this.error = undefined;
    try {
      const [myBoards, publicBoards] = await Promise.all([
        listMyBoards({ accountId: this.accountKey }),
        listPublicBoards()
      ]);
      this.boards = myBoards;
      this.publicBoards = publicBoards.map(board => {
        const joined = myBoards.some(memberBoard => memberBoard.boardId === board.boardId);
        return {
          ...board,
          alreadyMember: joined,
          joinLabel: joined ? 'Joined' : 'Join board'
        };
      });
    } catch (e) {
      this.error = e?.body?.message || e?.message || 'Unable to load boards.';
    } finally {
      this.loading = false;
    }
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
      await this.refresh();
    } catch (e) {
      this.error = e?.body?.message || e?.message || 'Unable to create board.';
    } finally {
      this.loading = false;
    }
  }

  async joinBoard() {
    this.clearMessages();
    if (!this.inviteBoardId) {
      this.error = 'Enter the invitation board ID.'; return;
    }
    this.loading = true;
    try {
      const result = await joinBoardAction({
        boardId: this.inviteBoardId, accountId: this.accountKey
      });
      this.success = result.message;
      this.inviteBoardId = '';
      await this.refresh();
    } catch (e) {
      this.error = e?.body?.message || e?.message || 'Unable to join board.';
    } finally {
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
      await this.refresh();
    } catch (e) {
      this.error = e?.body?.message || e?.message || 'Unable to join public board.';
    } finally {
      this.loading = false;
    }
  }

  async leaveOwnedBoard(event) {
    this.clearMessages();
    const boardId = event.currentTarget.dataset.boardId;
    this.loading = true;
    try {
      const result = await leaveBoardAction({
        boardId, accountId: this.accountKey
      });
      this.success = result.message;
      await this.refresh();
    } catch (e) {
      this.error = e?.body?.message || e?.message || 'Unable to leave board.';
    } finally {
      this.loading = false;
    }
  }

  clearMessages() { this.error = undefined; this.success = undefined; }
}