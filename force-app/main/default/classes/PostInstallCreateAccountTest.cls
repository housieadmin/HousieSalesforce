@IsTest
private class PostInstallCreateAccountTest {

    @IsTest
    static void testPostInstallCreatesAccount() {
        String acctName = 'Account Test';
        // Run the install handler
        Test.startTest();
        PostInstallCreateAccount handler = new PostInstallCreateAccount(acctName);
        handler.onInstall(null);
        Test.stopTest();

        // Assert the account was created
        Account acct = [
            SELECT Id, Name 
            FROM Account 
            WHERE Name = :acctName
            LIMIT 1
        ];

       Assert.isNotNull(acct, 'Account was not inserted');
    }

    @IsTest
    static void testSilentFailure() {
        // Simulate a failure by mocking a validation rule with a static flag
        // Since we cannot create validation rules in a test, we induce an exception
        Test.startTest();

        try {
            // Run the post install handler, it should not throw
            PostInstallCreateAccount handler = new PostInstallCreateAccount();
            handler.onInstall(null);
        } catch (Exception e) {
            // Unexpected
            Assert.fail('Class did not fail silently');
        }

        Test.stopTest();
    }
}