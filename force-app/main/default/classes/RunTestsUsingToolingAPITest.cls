@isTest
public class RunTestsUsingToolingAPITest {
    
    static testMethod void testPostCallout() {
        Test.setMock(HttpCalloutMock.class, new TestRunAPIMock());  
        HttpResponse response = RunTestsUsingToolingAPI.runAsynchronousTestsWithToolingAPI();
    }

}