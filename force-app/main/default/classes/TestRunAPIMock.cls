@isTest
global class TestRunAPIMock implements HttpCalloutMock  {
    
    global HTTPResponse respond(HTTPRequest request) {
        HttpResponse response = new HttpResponse();
        response.setHeader('Content-Type', 'application/json');
        response.setBody('AsyncApexJob ID: "707Ws00000oIvZP"');
        response.setStatusCode(200);
        return response; 
    }
}