public class RunTestsUsingToolingAPI {
    
    public static HttpResponse runAsynchronousTestsWithToolingAPI() {
        
    	String endpoint = '/services/data/v65.0/tooling/runTestsAsynchronous/';
        
        // Set up the HTTP request
        String urlString = endpoint;
        String baseUrl = URL.getOrgDomainUrl().toExternalForm();
        
        HttpRequest request = new HttpRequest();
        request.setEndpoint(baseUrl + urlString);
        request.setMethod('POST');
        request.setHeader('Authorization', 'Bearer ' + UserInfo.getSessionId());
        request.setHeader('Content-Type', 'application/json'); 
        
        String requestBody = '{"tests": [{"className": "FlowTesting.Account_Update", "testMethods": ["Account_Update_Test_Account_Update_Description"]},{"className": "UpdateAccountDataTest", "testMethods": ["testHighValueAccountDescriptionUpdate"]}]}';
        request.setBody(requestBody); 
        
        // Send the request
        try {
            Http http = new Http();
            HttpResponse response = http.send(request);

            // Check for a successful response (status code 200)
            if (response.getStatusCode() == 200) {
                String result = response.getBody();
                System.debug('Test run successfully queued. AsyncApexJob ID: ' + result);
            } else {
                System.debug('Error calling runTestsAsynchronous. Status code: ' + response.getStatusCode() + ' - ' + response.getStatus());
                System.debug('Response body: ' + response.getBody());
            }
            return response;
        } catch (Exception e) {
            System.debug('Exception during Tooling API callout: ' + e.getMessage());
        }
       return null;
    }

}