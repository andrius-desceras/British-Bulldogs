var http = require('http');
var fs = require('fs');

//Hostname and port for server
var hostname = 'localhost';
var port = 8080;

//Create server with user join function
var server = http.createServer(function(req, res) 
{
    console.log('New user ' + req.connection.remoteAddress + ' attempting to connect');
    
    //Check if the page they are looking for exists
    if(req.url === '/')
    {
        //If they are looking for the homepage, send Index.html
        res.writeHead(200, 'Content-Type', 'text/html');
        fs.createReadStream(__dirname + '/Index.html', 'utf8').pipe(res);
        
        console.log(req.connection.remoteAddress + ' connected successfully');
    }
    else
    {
        //If the page does not exist, send error 404 page
        res.writeHead(404, 'Content-Type', 'text/html');
        fs.createReadStream(__dirname + '/404.html', 'utf8').pipe(res);
        
        console.log('Error 404: ' + req.connection.remoteAddress + ' attempted to connect to a page that does not exist');
    }
});

//Tell server to listen to the correct port
server.listen(port, hostname);
console.log('Now running on ' + hostname + ' at port ' + port);