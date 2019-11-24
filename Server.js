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
var EliminatedPlayers = [];
var GameInProgress = false;
var PlayersAlive;
var SafeZone;
var RoundStartTime;

var io = require('socket.io')(server, {});

io.sockets.on('connection', function(socket)
{
    //console.log('New socket conncection');
    
    //New player joining
    socket.on('NewPlayer', function(data)
    {
        //Add new player to list of players
        Players.push(new Player(Players.length, data.Name, cfg.SprintMultiplier, cfg.StaminaConsumptionRate));
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
        if(Players[data.PlayerID] !== undefined && !Players[data.PlayerID].Eliminated)
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
    
    PlayersAlive = Players.length;
    
    //The 4 outer walls of the map
    Objects.push(new Object(0, [-10, -10], [cfg.MapSize[0] + 20, 11], [0, 0], true));
    Objects.push(new Object(1, [-10, -10], [11, cfg.MapSize[1] + 20], [0, 0], true));
    Objects.push(new Object(2, [-10, cfg.MapSize[1] - 1], [cfg.MapSize[0] + 20, 11], [0, 0], true));
    Objects.push(new Object(3, [cfg.MapSize[0] - 1, -10], [11, cfg.MapSize[1] + 20], [0, 0], true));
    
    //Add any new objects here the arguments are ID, Position, Size, Velocity, Interobject collision
    //Objects.push(new Object(6, [50, 50], [50, 50], [0, 0], true));
    //Objects.push(new Object(7, [120, 20], [20, 20], [0, 1], true));
    
    //Create the safe zone boundary that players who have completed the map will get moved into
    SafeZone = new Object(Objects.length, [cfg.MapSize[0] - cfg.SafeZoneSize, 0], [5, cfg.MapSize[1]], [0, 0], false);
    
    //Set it's collision function so that any player that collides with it will be moved into the safe zone
    SafeZone.setCollisionFunction(function(Data)
    {
        if(Data.ObjectType === 1 && !Players[Data.ID].Safe)
            SetPlayerSafe(Data.ID);
    });
    
    SafeZone.Colour = 'green';
    
    Objects.push(SafeZone);
    
    var CurrentPosition = cfg.MovingObjectZoneX[0];
    
    //Fill the moving object zone with moving objects
    while(CurrentPosition < (cfg.MovingObjectZoneX[1] - cfg.MovingObjectSize[0]))
    {
        //Create the new moving object
        var NewObject = new Object(Objects.length, [CurrentPosition, 20 + Math.floor(Math.random() * (cfg.MapSize[1] - (cfg.MovingObjectSize[1] + 40)))], cfg.MovingObjectSize, [0, (Math.random() > 0.5 ? 1 : -1) * (Math.random() * (cfg.MovingObjectSpeed[1] - cfg.MovingObjectSpeed[0]) + cfg.MovingObjectSpeed[0])], false);
        
        //Set the tick function so that changes it's direction when it has reached the boundaries
        NewObject.setTickFunction(function()
        {
            if(!(this.Position[1] > 0 && this.Position[1] < (cfg.MapSize[1] - this.Size[1])))
                this.Velocity[1] *= -1;
        });
        
        //Set the collision function so that it eliminates the player on contact
        NewObject.setCollisionFunction(function(Data)
        {
            if(Data.ObjectType === 1)
                EliminatePlayer(Data.ID);
        });
                
        NewObject.BorderColour = 'red';
        
        Objects.push(NewObject);
        
        //Add a random value to current position
        CurrentPosition += (cfg.MovingObjectSize[0] + Math.floor(Math.random() * (cfg.MovingObjectSpacing[1] - cfg.MovingObjectSpacing[0])) + cfg.MovingObjectSpacing[0]);
    }
    
    //If There are PowerUps enabled, spawn a random number of them between PowerUpCount[0] and PowerUpCount[1]
    if(cfg.PowerUpCount[1] > 0)
    {
        for(var i = 0; i < ((Math.random() * (cfg.PowerUpCount[1] - cfg.PowerUpCount[0])) + cfg.PowerUpCount[0]); i++)
        {
            //Set the PowerUp position so that it in a random place in the middle of the map
            var NewObject = new Object(Objects.length, [(Math.random() * (cfg.PowerUpDropRange[1] - cfg.PowerUpDropRange[0]) + cfg.PowerUpDropRange[0]), (Math.random() * (cfg.MapSize[1] - 50)) + 25], cfg.PowerUpSize, [0, 0], false);
            
            //For adding new PowerUp effects, add 1 to the multiplier in the switch and add a new case for it's collision function
            switch(Math.random() * 0)
            {
                //The PowerUp grants a temporary speed boost
                case 0:
                    NewObject.setCollisionFunction(function(Data)
                    {
                        //Add a new speed buff to the speed buff multipliers for the player
                        Players[Data.ID].SpeedBuffMultipliers.push(
                        {
                            Multipler: cfg.PowerUpSprintMultiplier, 
                            Duration: (cfg.TickRate * 2)
                        });
                        
                        //Move it so that it is outside of the map
                        this.Position = cfg.MapSize;
                    });
                    
                    NewObject.BorderColour = 'green';
                    
                    break;
                   
            }
            
            Objects.push(NewObject);
        }
        
    }
    
    //If There are Ghosts enabled, spawn a random number of them between GhostCount[0] and GhostCount[1]
    if(cfg.GhostCount[0] > 0)
    {
        for(var i = 0; i < ((Math.random() * (cfg.GhostCount[1] - cfg.GhostCount[0])) + cfg.GhostCount[0]); i++)
        {
            //Set the Ghost's start position as outside of the map so that they arrive when the game has already started
            var NewObject = new Object(Objects.length, [((Math.random() * (cfg.GhostXRange[1] - cfg.GhostXRange[0])) + cfg.GhostXRange[0]), Math.random() > 0.5 ? 0 - ((Math.random() * (cfg.GhostYRange[1] - cfg.GhostYRange[0])) + cfg.GhostYRange[0]) : cfg.MapSize[1] + ((Math.random() * (cfg.GhostXRange[1] - cfg.GhostXRange[0])) + cfg.GhostXRange[0])], cfg.GhostSize, [0, 0], false);
            
            NewObject.Target = NewObject.Position;
            
            //Set the Ghost's tick function so that it paths towards players within vision range
            NewObject.setTickFunction(function()
            {
                //If there is a player target, but it it no longer within vision range, or has been eliminated or is safe, untarget it
                if(this.PlayerTarget !== undefined && ((Math.abs(this.Target[0] - this.Position[0]) + Math.abs(this.Target[1] - this.Position[1])) > cfg.GhostVisionRange * 1.5 || this.PlayerTarget.Eliminated || this.PlayerTarget.Safe))
                {
                    this.PlayerTarget = undefined;
                        
                    //Reset to passive mode colour
                    this.Colour = 'yellow';
                }
                
                //If there is a player target
                if(this.PlayerTarget === undefined)
                {
                    //If the target has been reached then set a new one
                    if(Math.abs(this.Target[0] - this.Position[0]) < 1 && Math.abs(this.Target[1] - this.Position[1]) < 1)
                    {
                        this.Target = [(cfg.MapSize[0] * 0.2) + (cfg.MapSize[0] * Math.random() * 0.6), (cfg.MapSize[1] * 0.2) + (cfg.MapSize[1] * Math.random() * 0.6)];
                    }
                    
                    if(Math.random() > 0.97)
                    {
                        //Calculate the vision range boundaries
                        var Bounds = [this.Position, [this.Position[0] + cfg.GhostVisionRange, this.Position[1] + cfg.GhostVisionRange]];

                        PotentialTargets = [];

                        //Loop through all of the players and find if there are any within vision range
                        for(var j = 0; j < Players.length; j++)
                        {
                            if(!Players[j].Eliminated && !Players[j].Safe)
                            {
                                //Calculate the player's boundaries
                                var PlayerBounds = [Players[j].Position, [Players[j].Position[0] + cfg.PlayerSize[0], Players[j].Position[1] + cfg.PlayerSize[1]]];

                                if(CheckCollision(PlayerBounds, Bounds) || CheckCollision(Bounds, PlayerBounds))
                                    PotentialTargets.push(Players[j]);
                            }
                        }

                        //If there are any targets, select a random one from the list
                        if(PotentialTargets.length > 0)
                        {
                            this.PlayerTarget = PotentialTargets[Math.floor(PotentialTargets.length * Math.random())];

                            //Set to aggressive mode colour
                            this.Colour = 'red';
                        }
                    }
                }
                
                //If there is a player target, target it's current position
                if(this.PlayerTarget !== undefined)
                    this.Target = this.PlayerTarget.Position;
                
                //Set the Ghost's velocity so that it is moving towards the target
                this.Velocity = [(this.Target[0] > this.Position[0] ? cfg.GhostSpeed : cfg.GhostSpeed * -1) * (this.PlayerTarget === undefined ? 0.7 : 1.5), (this.Target[1] > this.Position[1] ? cfg.GhostSpeed : cfg.GhostSpeed * -1) * (this.PlayerTarget === undefined ? 0.7 : 1.5)];
            });
            
            //Set the Ghost's collision function to eliminate the player
            NewObject.setCollisionFunction(function(Data)
            {
                if(this.PlayerTarget !== undefined)
                {
                    EliminatePlayer(Data.ID);

                    this.PlayerTarget = undefined;

                    //Reset to passive mode colour
                    this.Colour = 'yellow';
                }
            });
            
            NewObject.Colour = 'yellow';
            
            Objects.push(NewObject);
        }
        
    }
    
    //If the redzone is enabled, create one
    if(cfg.RedZone)
    {
        var RedZone = new Object(5, [0 - (cfg.MapSize[0] + cfg.RedZoneStartX), 0], [cfg.MapSize[0] - cfg.SafeZoneSize, cfg.MapSize[1]], [cfg.RedZoneSpeed, 0], false);

        //Set it's collision function so that any player that it collides with is eliminated
        RedZone.setCollisionFunction(function(Data)
        {
            if(Data.ObjectType === 1)
                EliminatePlayer(Data.ID);
        });
        
        //Set it's tick function so that it will stop when it gets to the safe zone
        RedZone.setTickFunction(function()
        {
            if(this.Position[0] > -1)
                this.Velocity[0] = 0;
        });

        RedZone.Colour = 'red';

        Objects.push(RedZone);
    }
    
    //Set the interval for updating all of the positions in the game
    setInterval(function()
    { 
        data = [];
        
        //Update position for all moving objects
        for(var i = 0; i < Objects.length; i++)
        {
            //If the object has a TickFunction, call it
            if(Objects[i].TickFunction !== undefined)
                Objects[i].TickFunction();
            
            var v = Objects[i].Velocity;
            
            //If the object is moving, check for collisions
            if(v !== [0, 0])
            {
                //New potential coordinates if their are no collisions
                var newX = Objects[i].Position[0] + (v[0] * cfg.GlobalSpeed);
                var newY = Objects[i].Position[1] + (v[1] * cfg.GlobalSpeed);
                
                //Check if the object will be colliding with anything if it moves to it's new potential position
                var CollisionData = CheckForCollisions([newX, newY], Objects[i].Size, true, Objects[i].ObjectCollision, false, i)
                
                if(CollisionData.ID === -1)
                    Objects[i].Position = [newX, newY];
                else
                {
                    //If the object has a collision function, call it
                    if(Objects[i].CollisionFunction !== undefined)
                        Objects[i].CollisionFunction(CollisionData);
                    
                    //If the object can only move along the x or y coordinate, then move it accordingly
                    if(CheckForCollisions([newX, Objects[i].Position[1]], Objects[i].Size, true, Objects[i].ObjectCollision, false, i).ID === -1)
                        Objects[i].Position[0] = newX;
                    else
                        if(CheckForCollisions([Objects[i].Position[0], newY], Objects[i].Size, true, Objects[i].ObjectCollision, false, i).ID === -1)
                            Objects[i].Position[1] = newY;
                }
            }
            
            //Add the required object data to the package
            data.push(
            {
                Alive: true,
                Position: Objects[i].Position,
                Size: Objects[i].Size,
                ObjectTypeID: 2,
                Colour: Objects[i].Colour,
                BorderColour: Objects[i].BorderColour
            });
        }
        
        //Update position for all moving players
        for(var i = 0; i < Players.length; i++)
        {         
            if(Players[i] !== undefined && !Players[i].Eliminated)
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
                    
                    var CollisionData = CheckForCollisions([newX, newY], cfg.PlayerSize, cfg.PlayerCollision, true, true, i)
                    
                    //Check if the player will be colliding with anything if it moves to it's new potential position
                    if(CollisionData.ID === -1)
                        Players[i].Position = [newX, newY];
                    else
                    {
                        //If the player is touching the safe zone barrier, move them to the safe zone
                        //if(CollisionData.ObjectType === 2 && CollisionData.ID === SafeZone.ID && !Players[i].Safe)
                            //SetPlayerSafe(i);
                        
                        if(CollisionData.ObjectType === 2 && Objects[CollisionData.ID].CollisionFunction !== undefined)
                            Objects[CollisionData.ID].CollisionFunction({ID: Players[i].ID, ObjectType: 1});
                        
                        //If the player can only move along the x or y coordinate, then move it accordingly
                        if(CheckForCollisions([newX, Players[i].Position[1]], cfg.PlayerSize, cfg.PlayerCollision, true, true, i).ID === -1)
                            Players[i].Position[0] = newX;
                        else
                            if(CheckForCollisions([Players[i].Position[0], newY], cfg.PlayerSize, cfg.PlayerCollision, true, true, i).ID === -1)
                                Players[i].Position[1] = newY;
                    }
                    
                }

                //Package all of the required player data together
                data.push(
                {
                    Alive: true,
                    Position: [Math.round(Players[i].Position[0]), Math.round(Players[i].Position[1])],
                    ObjectTypeID: 1,
                    ObjectID: Players[i].ID
                });
            }
            else
                data.push(
                {
                    Alive: false
                });
            
            //Regenerate player stamina
            if(Players[i].Stamina < Players[1].MaxStamina - cfg.StaminaRegenerationRate)
                Players[i].Stamina += cfg.StaminaRegenerationRate;
        }
        
        //Send the data package to all of the players in the game
        for(var i = 0; i < Players.length; i++)
            io.to(Players[i].SocketID).emit('UpdateMovement', {PlayerPositions: data, ID: Objects.length + i, Stamina: Players[i].Stamina});
        
    }, Math.round(1000 / cfg.TickRate));
    
    RoundStartTime = new Date().getMilliseconds();
}

function CheckForCollisions(Position, Size, CheckPlayers, CheckObjects, IsPlayer, ID)
{
    //If collision is turned off in the config, return false
    if(!cfg.Collision)
        return {ID: -1, ObjectType: -1};
    
    //Calculate boundaries of the object from it's position and size
    var Bounds = [Position, [Position[0] + Size[0], Position[1] + Size[1]]];
    
    //Check for collisions with all objects in the game if it is enabled
    if(CheckObjects)
        for(var i = 0; i < Objects.length; i++)
            if((!IsPlayer && i !== ID) || IsPlayer)
                if(CheckCollision(Bounds, Objects[i].getBounds()) || CheckCollision(Objects[i].getBounds(), Bounds))
                    return {ID: i, ObjectType: 2};
    
    //Check for collisions against all players if it is enabled
    if(CheckPlayers)
        for(var i = 0; i < Players.length; i++)
        {
            //Ensure that the player has not been eliminated and that it is not checking for collisions against itself
            if(!Players[i].Eliminated && ((IsPlayer && i !== ID) || !IsPlayer))
            {
                //Calculate the boundaries of the player
                var ObjectBounds = [Players[i].Position, [Players[i].Position[0] + cfg.PlayerSize[0], Players[i].Position[1] + cfg.PlayerSize[1]]];

                //Check for collisions between the 2 boundaries
                if(CheckCollision(Bounds, ObjectBounds) || CheckCollision(ObjectBounds, Bounds))
                    return {ID: i, ObjectType: 1};
            }
        }   
    
    //Return -1 if no collisions are found
    return {ID: -1, ObjectType: -1};
}

//Check if 2 sets of coordinates are intersecting
function CheckCollision(Bounds1, Bounds2)
{
    return ((Bounds1[0][0] >= Bounds2[0][0] && Bounds1[0][0] < Bounds2[1][0]) || (Bounds1[1][0] >= Bounds2[0][0] && Bounds1[1][0] < Bounds2[1][0])) && ((Bounds1[0][1] >= Bounds2[0][1] && Bounds1[0][1] < Bounds2[1][1]) || (Bounds1[1][1] >= Bounds2[0][1] && Bounds1[1][1] < Bounds2[1][1]));
}

//Eliminates a player from the game
function EliminatePlayer(PlayerID)
{
    Players[PlayerID].Eliminated = true;
                
    io.to(Players[PlayerID].SocketID).emit('Eliminated', {PlayersAlive: PlayersAlive});
                
    PlayersAlive--;
    
    if(PlayersAlive === 0)
    {
        EndGame();
    }
}

//Set a player as 'safe' when they have completed the map
function SetPlayerSafe(PlayerID)
{
    Players[PlayerID].Safe = true;
    
    Players[PlayerID].Position[0]+= (cfg.PlayerSize[0] + 10);
    
    io.to(Players[PlayerID].SocketID).emit('Safe', {});
    
    Players[PlayerID].CompletionTime = RoundStartTime - new Date().getMilliseconds();
}

function EndGame()
{
    var Winner;
    
    //Find the player with the fastest completion time, if there are any
    for(var i = 0; i < Players.length; i++)
        if(Player[i] !== undefined && Player[i].CompletionTime !== undefined && (Winner === undefined || Winner.CompletionTime < Players[i].CompletionTime))
            Winner = Players[i].CompletionTime;
    
    var WinnerData = undefined;
    
    //Package their data
    if(Winner !== undefined)
        WinnerData = {Username: Winner.Username, CompletionTime: Winner.CompletionTime};
        
    //Send the end game data to all of the players in the game
    for(var i = 0; i < Players.length; i++)
        io.to(Players[i].SocketID).emit('EndGame', WinnerData);
}