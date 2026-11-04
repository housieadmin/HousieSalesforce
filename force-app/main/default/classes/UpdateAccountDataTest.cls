@isTest
Private class UpdateAccountDataTest {

    // Use a test setup method to create reusable test data
    @testSetup
    static void setupTestData() {
        // Create a list of test accounts
        List<Account> accounts = new List<Account>();

        // High Value Account test case: Account with High AnnualRevenue
        accounts.add(new Account(
            Name = 'ABC AUTOMOBILES',
            AnnualRevenue = 5000000.00,
            Description =''
        ));

        // Low Value account test case: Account with less AnnualRevenue
        accounts.add(new Account(
            Name = 'XYZ AUTOMOBILES',
            AnnualRevenue = 100000.00,
            Description =''
        ));

        // Insert all accounts in a single DML operation
        insert accounts;
    }

    @isTest
    static void testHighValueAccountDescriptionUpdate() {
        // Retrieve the test data created in the setup method
        List<Account> accountsToTest = [
            SELECT Id, Name, AnnualRevenue,description
            FROM Account
            WHERE Name LIKE '% AUTOMOBILES'
        ];

        // Ensure we retrieved the correct number of records
        System.assertEquals(2, accountsToTest.size(), 'Two specific accounts should have been retrieved.');

        // Isolate the test execution within Test.startTest() and Test.stopTest()
        Test.startTest();
        // Call the method to test
        UpdateAccountData.updateAccountDescription(accountsToTest[0]);
        UpdateAccountData.updateAccountDescription(accountsToTest[1]);
        Test.stopTest();
		
        Account highValueCaseAccount;
        Account lowValueCaseAccount; 
        
        // Separate accounts for assertion based on scenario
        for (Account accountToUpdate : accountsToTest ) {
            if(accountToUpdate.AnnualRevenue >= 5000000){
                highValueCaseAccount = accountToUpdate;
            }else {
                lowValueCaseAccount = accountToUpdate;
            }
        }
       

        // High Value Account Test Case: Verify description is updated correctly for an account
        System.assertEquals('High Value Account as annual revenue is more than the High value threshold limit',
            highValueCaseAccount.description,
            'Account description was not updated correctly.'
        );

        // Low Value Account Test Case: Verify description is updated correctly for an account
        System.assertEquals(
            'Low Value Account as annual revenue is less than the High value threshold limit',
            lowValueCaseAccount.description,
            'Account description was not updated correctly.'
        );
    }

}