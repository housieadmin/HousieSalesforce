global class PostInstallCreateAccount implements InstallHandler {

    private String acctName;

    // Constructor receives the account name
    public PostInstallCreateAccount(String acctName) {
        this.acctName = acctName;
    }
    
    // Constructor for zero argument
    public PostInstallCreateAccount() {
        this.acctName = 'Account with Flow';
    }

    global void onInstall(InstallContext context) {
        createAccountWithFlow(acctName);
    }

    public static void createAccountWithFlow(String acctName) {
        try {
            Account acc = new Account(
                Name = acctName
            );
            insert acc;
        } catch (Exception e) {
            // Fail silently so install is not blocked
        }
    }
}