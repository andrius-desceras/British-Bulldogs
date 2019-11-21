var http = require('http');
var fs = require('fs');
var path = require('path');
var Player = require(__dirname + '/Player.js');
var GameConfig = require (__dirname + '/GameConfig.js');
var Object = require(__dirname + '/Object.js');

//Hostname and port for server
var hostname = 'localhost';
var port = 8080;

//Create server with user join function
var server = http.createServer(function(req, res)
{
    console.log('New user ' + req.connection.remoteAddress + ' attempting to connect');

    console.log(path.join(__dirname, 'Public'));
    
    //Check if the page they are looking for exists
    switch(req.url)
    {
        case "/":
            //If they are looking for the main page, send Index.html
            res.writeHead(200, 'Content-Type', 'text/html');
            fs.createReadStream(__dirname + '/Public/Index.html', 'utf8').pipe(res);

            console.log(req.connection.remoteAddress + ' connected successfully');
            break;
        
        case "/Javascript/Client.js":
            //If they are looking for the main page javascript, send Client.js in the Javascript folder
            res.writeHead(200, 'Content-Type', 'application/javascript');
            fs.createReadStream(__dirname + '/Public/Javascript/Client.js', 'utf8').pipe(res);
            break;
            
        case "/socket.io":
            //If they are looking for the socket.io library, send the socket.io.js file
            res.writeHead(200, 'Content-Type', 'application/javascript');
            fs.createReadStream(__dirname + '/node_modules/socket.io-client/dist/socket.io.js', 'utf8').pipe(res);
            break;
            
        case "/Javascript/Style.css":
            //If they are looking for the main page CSS, send Style.css in the CSS folder
            res.writeHead(200, 'Content-Type', 'text/css');
            fs.createReadStream(__dirname + '/Public/CSS/Style.css', 'utf8').pipe(res);
            break;
        
        default:
            //If the page does not exist, send error 404 page
            res.writeHead(404, 'Content-Type', 'text/html');
            fs.createReadStream(__dirname + '/Public/404.html', 'utf8').pipe(res);
        
            console.log('Error 404: ' + req.connection.remoteAddress + ' attempted to connect to a page that does not exist: ' + req.url);
            break;
    }
});


var cfg = new GameConfig();
var Objects = [];
var Players = [];
var GameInProgress = false;

var io = require('socket.io')(server, {});

io.sockets.on('connection', function(socket)
{
    //console.log('New socket conncection');
    
    //New player joining
    socket.on('NewPlayer', function(data)
    {
        //Add new player to list of players
        Players.push(new Player(Players.length, data.Name, null, null));
        Players[Players.length - 1].setSocketID(socket.id);
        
        console.log('New user ' + data.Name + ' connected with ID: ' + Players.length);
        
        //If the game is already in progress, set their start position and inform the player that the game has already started
        if(GameInProgress)
        {
            Players[Players.length - 1].Position = [10, 6 + (Players.length * 18)];

            io.to(Players[Players.length - 1].SocketID).emit('NewGame',
            {
                MyPlayerID: Players.length - 1
            });
        }
        else
            //If the minimum number of players are met, start the game
            if(Players.length >= cfg.MinPlayers)
                StartGame();
    });
    
    //Called when a user presses a key
    socket.on('KeyPress', function(data)
    {
        //Set the player's new velocity
        Players[data.PlayerID].updateInputs(data.Key, data.isMoving);
    });
});

//Tell server to listen to the correct port
server.listen(port, hostname);
console.log('Now running on ' + hostname + ' at port ' + port);

//Begin the game
function StartGame()
{
    console.log('Starting new game with ' + Players.length + ' players');
    
    GameInProgress = true;
    
    //Inform the connected players that the game is starting
    for(var i = 0; i < Players.length; i++)
    {
        Players[i].Position = [10, 6 + (18 * i)];
        
        io.to(Players[i].SocketID).emit('NewGame', 
        {
            MyPlayerID: i
        });
    }
    
    //The 4 outer walls of the map
    Objects.push(new Object(0, [-10, -10], [cfg.MapSize[0] + 20, 11], [0, 0]));
    Objects.push(new Object(1, [-10, -10], [11, cfg.MapSize[1] + 20], [0, 0]));
    Objects.push(new Object(2, [-10, cfg.MapSize[1] - 1], [cfg.MapSize[0] + 20, 11], [0, 0]));
    Objects.push(new Object(3, [cfg.MapSize[0] - 1, -10], [11, cfg.MapSize[1] + 20], [0, 0]));
    
    //Add any new objects here the arguments are ID, Position, Size, Velocity
    Objects.push(new Object(4, [50, 50], [50, 50], [0, 0]));
    Objects.push(new Object(5, [120, 20], [20, 20], [0, 1]));
    
    //Set the interval for updating all of the positions in the game
    setInterval(function()
    { 
        data = [];
        
        //Update position for all moving objects
        for(var i = 0; i < Objects.length; i++)
        {
            var v = Objects[i].Velocity;
            
            //If the object is moving, check for collisions
            if(v !== [0, 0])
            {
                //New potential coordinates if their are no collisions
                var newX = Objects[i].Position[0] + (v[0] * cfg.GlobalSpeed);
                var newY = Objects[i].Position[1] + (v[1] * cfg.GlobalSpeed);
                
                //Check if the object will be colliding with anything if it moves to it's new potential position
                if(!CheckForCollisions([newX, newY], Objects[i].Size, true, false, i))
                    Objects[i].Position = [newX, newY];
                else
                {
                    if(!CheckForCollisions([newX, Objects[i].Position[1]], Objects[i].Size, true, false, i))
                        Objects[i].Position[0] = newX;
                    else
                        if(!CheckForCollisions([Objects[i].Position[0], newY], Objects[i].Size, true, false, i))
                            Objects[i].Position[1] = newY;
                }
            }
        }
        
        for(var i = 0; i < Players.length; i++)
        {
            var v = Players[i].getVelocity();
            
            //If the player is moving, check for collisions
            if(v !== [0, 0])
            {   
                //If the player is moving diagonally, scale their velocity appropriately
                if(v[0] !== 0 && v[1] !== 0)
                {
                    v[0] = v[0] * 0.7;
                    v[1] = v[1] * 0.7;
                }
                
                //New potential coordinations if their are no collisions
                var newX = Players[i].Position[0] + (v[0] * cfg.GlobalSpeed * Players[i].SpeedBuffMultiplier);
                var newY = Players[i].Position[1] + (v[1] * cfg.GlobalSpeed * Players[i].SpeedBuffMultiplier);

                //Check if the player will be colliding with anything if it moves to it's new potential position
                if(!CheckForCollisions([newX, newY], cfg.PlayerSize, cfg.PlayerCollision, true, i))
                    Players[i].Position = [newX, newY];
                else
                {
                    if(!CheckForCollisions([newX, Players[i].Position[1]], cfg.PlayerSize, cfg.PlayerCollision, true, i))
                        Players[i].Position[0] = newX;
                    else
                        if(!CheckForCollisions([Players[i].Position[0], newY], cfg.PlayerSize, cfg.PlayerCollision, true, i))
                            Players[i].Position[1] = newY;
                }
            }
            
            //Package all of the required player data together
            data.push(
            {
                Position: Players[i].Position,
                ObjectTypeID: 1
            });
        }
        
        //Add the required object data to the package
        for(var i = 0; i < Objects.length; i++)
        {
            data.push(
            {
                Position: Objects[i].Position,
                Size: Objects[i].Size,
                ObjectTypeID: 2
            });
        }
        
        //Send the data package to all of the players in the game
        for(var i = 0; i < Players.length; i++)
            io.to(Players[i].SocketID).emit('UpdateMovement', {PlayerPositions: data, ID: i});
    }, Math.round(1000 / cfg.TickRate));
}

function CheckForCollisions(Position, Size, CheckPlayers, IsPlayer, ID)
{
    //If collision is turned off in the config, return false
    if(!cfg.Collision)
        return false;
    
    //Calculate boundaries of the object from it's position and size
    var Bounds = [Position, [Position[0] + Size[0], Position[1] + Size[1]]];
    
    //Check for collisions with all objects in the game
    for(var i = 0; i < Objects.length; i++)
        if((!IsPlayer && i !== ID) || IsPlayer)
            if(CheckCollision(Bounds, Objects[i].getBounds()) || CheckCollision(Objects[i].getBounds(), Bounds))
                return true;
    
    //Check for collisions against all players if it is enabled
    if(CheckPlayers)
        for(var i = 0; i < Players.length; i++)
        {
            //Ensure it is not checking for collisions against itself
            if((IsPlayer && i !== ID) || !IsPlayer)
            {
                //Calculate the boundaries of the player
                var ObjectBounds = [Players[i].Position, [Players[i].Position[0] + cfg.PlayerSize[0], Players[i].Position[1] + cfg.PlayerSize[1]]];

                //Check for collisions between the 2 boundaries
                if(CheckCollision(Bounds, ObjectBounds))
                    return true;
            }
        }   
    
    //Return false if no collisions are found
    return false;
}

//Check if 2 sets of coordinates are intersecting
function CheckCollision(Bounds1, Bounds2)
{
    return ((Bounds1[0][0] >= Bounds2[0][0] && Bounds1[0][0] < Bounds2[1][0]) || (Bounds1[1][0] >= Bounds2[0][0] && Bounds1[1][0] < Bounds2[1][0])) && ((Bounds1[0][1] >= Bounds2[0][1] && Bounds1[0][1] < Bounds2[1][1]) || (Bounds1[1][1] >= Bounds2[0][1] && Bounds1[1][1] < Bounds2[1][1]));
}