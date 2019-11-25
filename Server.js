var http = require('http');
var fs = require('fs');
var path = require('path');
var Player = require(__dirname + '/Player.js');
var GameConfig = require (__dirname + '/GameConfig.js');
var Object = require(__dirname + '/Object.js');

var cfg;

cfg = JSON.parse(fs.readFileSync(__dirname + '/cfg.json', 'utf8', function(err)
{
    console.log('ERROR: Cannot read config file at ' + __dirname + '/cfg.json');
    
    cfg = new GameConfig();
}));

//Hostname and port for server
var hostname = cfg.ServerAddress;
var port = cfg.Port;

//Create server with user join function
var server = http.createServer(function(req, res)
{
    //console.log('New user ' + req.connection.remoteAddress + ' attempting to connect');
    
    //Check if the page they are looking for exists
    switch(req.url)
    {
        case "/":
            //If they are looking for the main page, send Index.html
            res.writeHead(200, 'Content-Type', 'text/html');
            fs.createReadStream(__dirname + '/Public/Index.html', 'utf8').pipe(res);
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
            
        case "/CSS/Style.css":
            //If they are looking for the main page CSS, send Style.css in the CSS folder
            res.writeHead(200, 'Content-Type', 'text/css');
            fs.createReadStream(__dirname + '/Public/CSS/Style.css', 'utf8').pipe(res);
            break;
        
        case "/":
            //If they are looking for the main page, send Index.html
            res.writeHead(200, 'Content-Type', 'text/html');
            fs.createReadStream(__dirname + '/Public/Index.html', 'utf8').pipe(res);
            break;

        default:
            break;
    }
});

var Objects = [];
var Players = [];
var ActivePlayers = 0;
var GameInProgress = false;
var CurrentWaitTime;
var PlayersAlive;
var SafeZone;
var RoundStartTime;
var TickFunctionID;
var LeaderboardData;

var io = require('socket.io')(server, {});

io.sockets.on('connection', function(socket)
{
    //New player joining
    socket.on('NewPlayer', function(data)
    {
        if(ActivePlayers < cfg.MaxPlayers)
        {
            if(ActivePlayers === 0)
            {
                CurrentWaitTime = cfg.MaxWaitTime;

                StartTimer = setInterval(function()
                {
                    CurrentWaitTime-= 1000;
                }, 1000);

                setTimeout(function()
                {
                    clearInterval(StartTimer);

                    if(!GameInProgress)
                        StartGame();
                }, cfg.MaxWaitTime);
            }

            if(!GameInProgress)
                socket.emit('SetStartTimer', {Time: CurrentWaitTime});

            var PlayerPosition = -1;

            for(var i = 0; i < Players.length; i++)
            {
                if(Players[i] !== undefined && Players[i].SocketID === socket.id)
                {
                    Players[i].Active = true;

                    PlayerPosition = i;

                    ActivePlayers++;
                }          
            }

            if(PlayerPosition === -1)
            {
                console.log('New socket conncection with ' + socket.id);

                //Add new player to list of players
                Players.push(new Player(Players.length, data.Name, cfg.SprintMultiplier, cfg.StaminaConsumptionRate));
                Players[Players.length - 1].SocketID = socket.id;

                ActivePlayers++;

                console.log('New user ' + data.Name + ' connected with ID: ' + Players.length);
            }
            else
            {
                console.log(Players[PlayerPosition].Name + ' is rejoining for another game');
            }

            //If the game is already in progress, set their start position and inform the player that the game has already started
            if(GameInProgress)
            {
                io.to(Players[Players.length - 1].SocketID).emit('NewGame',
                {
                    MyPlayerID: -1
                });

                Players[Players.length - 1].Eliminated = true;
                Players[Players.length - 1].Active = true;
            }
            else
                //If the minimum number of players are met, start the game
                if(ActivePlayers >= cfg.MinPlayers)
                    StartGame();
        }
        else
        {
            socket.emit('Full');
            socket.disconnect();
        }
    });
    
    //Called when a user presses a key
    socket.on('KeyPress', function(data)
    {
        var PlayerID;
        
        for(var i = 0; i < Players.length; i++)
            if(Players[i].SocketID === socket.id)
                PlayerID = i;
        
        //Set the player's new velocity
        if(Players[PlayerID] !== undefined && !Players[PlayerID].Eliminated)
            Players[PlayerID].updateInputs(data.Key, data.isMoving);
    });
    
    //Called when the user requests to view the leaderboard
    socket.on('RequestLeaderboard', function()
    {
        var Leaderboard = [];
        
        //If the leaderboard is not loaded, load it
        if(LeaderboardData === undefined)
            LeaderboardData = JSON.parse(fs.readFileSync(__dirname + '/Leaderboard.json', 'utf8', function(err)
            {
                console.log('ERROR: Cannot read leaderboard file at ' + __dirname + '/Leaderboard.json');
            }));
        
        //Select the top 10
        Leaderboard = LeaderboardData.slice(0, 10);
        
        //Send the leaderboard data to the client
        socket.emit('LeaderboardData', {LB: Leaderboard});
    });
});

//Tell server to listen to the correct port
server.listen(port, hostname);
console.log('Now running on ' + hostname + ' at port ' + port);

//Begin the game
function StartGame()
{
    console.log('Starting new game with ' + ActivePlayers + ' players');
    
    GameInProgress = true;
    
    var InactivePlayersPassed = 0;
    
    //Inform the connected players that the game is starting
    for(var i = 0; i < Players.length; i++)
    {
        if(Players[i].Active)
        {
            Players[i].Position = [10, 20 + (18 * (i - InactivePlayersPassed))];
            
            Players[i].Eliminated = false;
            Players[i].Safe = false;
            Players[i].Stamina = Players[i].MaxStamina;
            Players[i].Inputs = [false, false, false, false, false];
            Players[i].KillTouchDuration = 0;
            
            io.to(Players[i].SocketID).emit('NewGame', 
            {
                MyPlayerID: i
            });
        }
        else
            InactivePlayersPassed++;
    }
    
    PlayersAlive = ActivePlayers;
    
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
    
    //If There are PowerUps enabled, spawn a random number of them between PowerUpCount[0] and PowerUpCount[1]
    if(cfg.PowerUpCount[1] > 0)
    {
        for(var i = 0; i < ((Math.random() * (cfg.PowerUpCount[1] - cfg.PowerUpCount[0])) + cfg.PowerUpCount[0]); i++)
        {
            //Set the PowerUp position so that it in a random place in the middle of the map
            var NewObject = new Object(Objects.length, [(Math.random() * (cfg.PowerUpDropRange[1] - cfg.PowerUpDropRange[0]) + cfg.PowerUpDropRange[0]), (Math.random() * (cfg.MapSize[1] - 50)) + 25], cfg.PowerUpSize, [0, 0], false);
            
            //For adding new PowerUp effects, add 1 to the multiplier in the switch and add a new case for it's collision function
            switch(Math.floor(Math.random() * 2))
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
                    
                case 1:
                    NewObject.setCollisionFunction(function(Data)
                    {
                        //Add a new speed buff to the speed buff multipliers for the player
                        Players[Data.ID].KillTouchDuration = cfg.TickRate * 5;
                        
                        //Move it so that it is outside of the map
                        this.Position = cfg.MapSize;
                    });
                    
                    NewObject.BorderColour = 'green';
                    
                    break;
            }
            
            Objects.push(NewObject);
        }
    }
    
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
                    
                    if(Math.random() > cfg.GhostTargetChance)
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
    TickFunctionID = setInterval(function()
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
                    
                    var SpeedBuff = Players[i].SpeedBuffMultiplier > cfg.SpeedMultiplierCap ? cfg.SpeedMultiplierCap : Players[i].SpeedBuffMultiplier;
                    
                    //New potential coordinations if their are no collisions
                    var newX = Players[i].Position[0] + (v[0] * cfg.GlobalSpeed * SpeedBuff);
                    var newY = Players[i].Position[1] + (v[1] * cfg.GlobalSpeed * SpeedBuff);
                    
                    var CollisionData = CheckForCollisions([newX, newY], cfg.PlayerSize, cfg.PlayerCollision, true, true, i)
                    
                    //Check if the player will be colliding with anything if it moves to it's new potential position
                    if(CollisionData.ID === -1)
                        Players[i].Position = [newX, newY];
                    else
                    {
                        if(CollisionData.ObjectType === 2 && Objects[CollisionData.ID].CollisionFunction !== undefined)
                            Objects[CollisionData.ID].CollisionFunction({ID: Players[i].ID, ObjectType: 1});
                        else
                            if(CollisionData.ObjectType === 1 && Players[i].KillTouchDuration > 0)
                                EliminatePlayer(CollisionData.ID);
                        
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
                    ObjectID: Players[i].ID,
                    BorderColour: Players[i].KillTouchDuration > 0 ? 'red' : undefined
                });
            }
            else
                data.push(
                {
                    Alive: false
                });
            
            //Regenerate player stamina
            if(Players[i].Stamina < Players[i].MaxStamina - cfg.StaminaRegenerationRate)
                Players[i].Stamina += cfg.StaminaRegenerationRate;
        }
        
        //Send the data package to all of the players in the game
        for(var i = 0; i < Players.length; i++)
            io.to(Players[i].SocketID).emit('UpdateMovement', {PlayerPositions: data, ID: Objects.length + i, Stamina: Players[i].Stamina});
        
    }, Math.round(1000 / cfg.TickRate));
    
    RoundStartTime = new Date();
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
                
    //Inform the player that they have been eliminated
    io.to(Players[PlayerID].SocketID).emit('Eliminated', {PlayersAlive: PlayersAlive});
                
    PlayersAlive--;
    
    //Reset the player's completion streak
    Players[PlayerID].CompletionTimes = [];
    
    //If there are no more players in the game, end it
    if(PlayersAlive === 0)
        EndGame();
}

//Set a player as 'safe' when they have completed the map
function SetPlayerSafe(PlayerID)
{
    Players[PlayerID].Safe = true;
    
    Players[PlayerID].Position[0]+= (cfg.PlayerSize[0] + 10);
    
    //Inform the player that they are safe
    io.to(Players[PlayerID].SocketID).emit('Safe', {});
    
    //Record their completion time
    Players[PlayerID].CompletionTimes.push((new Date() - RoundStartTime));

    var TotalTime = Players[PlayerID].TotalTime();
    
    //If the player has completed the game enough consecutive times, insert them into the leaderboard
    if(Players[PlayerID].CompletionTimes.length > LeaderboardData[LeaderboardData.length - 1].Rounds)
    {
        //Remove the old leaderboard entry
        LeaderboardData = LeaderboardData.slice(0, LeaderboardData.length - 1);
        
        //Add the new player to the leaderboard
        LeaderboardData.push({Name: Players[PlayerID].Name, Rounds: Players[PlayerID].CompletionTimes.length, Time: TotalTime});
        
        //Sort the leaderboard
        LeaderboardData.sort(function(a, b)
        {
            return b.Rounds - a.Rounds;
        });
        
        //Write the new leaderboard to the file
        fs.writeFile(__dirname + '/Leaderboard.json', JSON.stringify(LeaderboardData), function(err)
        {
            console.log('Added new high score to leaderboard successfully');
        });
    }
    
    PlayersAlive--;
    
    //If there are no more players in the game, end it
    if(PlayersAlive === 0)
        EndGame();
}

//End the game
function EndGame()
{
    var Winner;
    
    //Find the player with the fastest completion time, if there are any
    for(var i = 0; i < Players.length; i++)
        if(Players[i] !== undefined && Players[i].CompletionTimes.length > 0 && (Winner === undefined || Winner.TotalTime() < Players[i].TotalTime()))
            Winner = Players[i];

    var WinnerData = undefined;
    
    //Package their data
    if(Winner !== undefined)
        WinnerData = {Username: Winner.Name, CompletionTime: Winner.TotalTime()};

    //Send the end game data to all of the players in the game
    for(var i = 0; i < Players.length; i++)
        io.to(Players[i].SocketID).emit('EndGame', WinnerData);

    console.log('Round complete, preparing to restart');
    
    //After 4 seconds, end the game
    setTimeout(function ()
    {
        Objects = [];

        clearInterval(TickFunctionID);
        
        var NewPlayers = [];
        
        //Any active players will have the ability to have their progress transferred to the next round
        for(var i = 0; i < Players.length; i++)
            if(Players[i].Active)
            {
                NewPlayers.push(Players[i]);
                NewPlayers[NewPlayers.length - 1].ID = NewPlayers.length - 1;
                NewPlayers[NewPlayers.length - 1].Active = false;
                NewPlayers[NewPlayers.length - 1].Eliminated = true;
            }
            else
            {
                if(io.sockets.connected[Players[i].SocketID] !== undefined)
                {
                    io.sockets.connected[Players[i].SocketID].disconnect();

                    console.log('Forcibly disconnected ' + Players[i].Name + ' for not playing');
                }
            }
        
        Players = NewPlayers;
        
        GameInProgress = false;
        
        ActivePlayers = 0;
    }, 4000);
}